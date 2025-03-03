// handlers/gig_handlers.go

package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"net/http"
	"os"
	"regexp"
	"sort"
	"strconv"
	"strings"

	"time"

	"Thegridproduct/backend/db"
	"Thegridproduct/backend/embeddings"
	"Thegridproduct/backend/models"

	"github.com/gorilla/mux"
	"github.com/sashabaranov/go-openai"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// CreateGigRequest defines the expected payload for creating a gig
type CreateGigRequest struct {
	Title          string   `json:"title"`
	Description    string   `json:"description"`
	Category       string   `json:"category"`
	Price          string   `json:"price"`
	DeliveryTime   string   `json:"deliveryTime"`
	Images         []string `json:"images"`
	ExpirationDate string   `json:"expirationDate,omitempty"` // Optional
	CampusPresence string   `json:"campusPresence"`           // "inCampus" or "flexible"
	IsAnonymous    *bool    `json:"isAnonymous,omitempty"`    // Optional
}

// UpdateGigRequest defines the expected payload for updating a gig
type UpdateGigRequest struct {
	Title          *string   `json:"title,omitempty"`
	Description    *string   `json:"description,omitempty"`
	Category       *string   `json:"category,omitempty"`
	Price          *string   `json:"price,omitempty"`
	DeliveryTime   *string   `json:"deliveryTime,omitempty"`
	Images         *[]string `json:"images,omitempty"`
	ExpirationDate *string   `json:"expirationDate,omitempty"` // Optional
	CampusPresence *string   `json:"campusPresence,omitempty"` // "inCampus" or "flexible"
}

// AddGigHandler handles the creation of a new gig
func AddGigHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodPost {
		WriteJSONError(w, "Invalid request method", http.StatusMethodNotAllowed)
		return
	}

	// Retrieve authenticated user details from context
	userID, ok := r.Context().Value(userIDKey).(string)
	if !ok || userID == "" {
		WriteJSONError(w, "User not authenticated", http.StatusUnauthorized)
		return
	}

	university, ok := r.Context().Value(userInstitution).(string)
	if !ok || university == "" {
		WriteJSONError(w, "User university information missing", http.StatusUnauthorized)
		return
	}

	studentType, ok := r.Context().Value(userStudentType).(string)
	if !ok || studentType == "" {
		WriteJSONError(w, "User student type information missing", http.StatusUnauthorized)
		return
	}

	userObjID, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		WriteJSONError(w, "Invalid user ID", http.StatusBadRequest)
		return
	}

	var gigReq CreateGigRequest
	if err := json.NewDecoder(r.Body).Decode(&gigReq); err != nil {
		log.Printf("Error decoding request body: %v", err)
		WriteJSONError(w, "Invalid input format", http.StatusBadRequest)
		return
	}

	// Validate required fields
	if strings.TrimSpace(gigReq.Title) == "" {
		WriteJSONError(w, "Title is required", http.StatusBadRequest)
		return
	}
	if strings.TrimSpace(gigReq.Category) == "" {
		WriteJSONError(w, "Category is required", http.StatusBadRequest)
		return
	}
	if strings.TrimSpace(gigReq.Description) == "" {
		WriteJSONError(w, "Description is required", http.StatusBadRequest)
		return
	}

	// Validate price
	if gigReq.Price != "Open to Communication" {
		if !isValidNumericPrice(gigReq.Price) {
			WriteJSONError(w, "Invalid price. Must be numeric or 'Open to Communication'.", http.StatusBadRequest)
			return
		}
	}

	// Validate deliveryTime
	finalDeliveryTime := "Not Required"
	if strings.TrimSpace(gigReq.DeliveryTime) != "" {
		finalDeliveryTime = gigReq.DeliveryTime
	}

	// Validate expirationDate
	var expirationDate time.Time
	if strings.TrimSpace(gigReq.ExpirationDate) != "" {
		parsedDate, err := time.Parse(time.RFC3339, gigReq.ExpirationDate)
		if err != nil {
			parsedDate, err = time.Parse("2006-01-02 15:04", gigReq.ExpirationDate)
			if err != nil {
				WriteJSONError(w, "Invalid expiration date format. Use RFC3339 or 'YYYY-MM-DD HH:MM' format.", http.StatusBadRequest)
				return
			}
		}
		expirationDate = parsedDate
	} else {
		expirationDate = time.Now().AddDate(0, 0, 30) // Default to 30 days from now
	}

	// Check if the gig is already expired
	isExpired := time.Now().After(expirationDate)

	// Validate campusPresence
	campusPresence := "inCampus"
	if strings.TrimSpace(gigReq.CampusPresence) != "" {
		campusPresence = gigReq.CampusPresence
	}

	// Prepare Gig model
	isAnonymous := false
	if gigReq.IsAnonymous != nil {
		isAnonymous = *gigReq.IsAnonymous
	}

	// Create the gig object
	gig := models.Gig{
		UserID:         userObjID,
		University:     university,
		StudentType:    studentType,
		Title:          gigReq.Title,
		Category:       gigReq.Category,
		Price:          gigReq.Price,
		DeliveryTime:   finalDeliveryTime,
		Description:    gigReq.Description,
		Images:         gigReq.Images,
		ExpirationDate: expirationDate,
		PostedDate:     time.Now(),
		Expired:        isExpired,
		Status:         "active",
		LikeCount:      0,
		CampusPresence: campusPresence,
		IsAnonymous:    isAnonymous,
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Insert the gig into MongoDB
	collection := db.GetCollection("gridlyapp", "gigs")
	result, err := collection.InsertOne(ctx, gig)
	if err != nil {
		log.Printf("Error inserting gig: %v", err)
		WriteJSONError(w, "Error saving gig", http.StatusInternalServerError)
		return
	}

	// ✅ Increment the user's grids count
	err = IncrementUserGrids(userObjID, studentType)
	if err != nil {
		log.Printf("Failed to increment grids: %v", err)
	}

	// ✅ Fetch updated user details (including grids count)
	req, _ := http.NewRequest("GET", fmt.Sprintf("https://thegridproduct-production.up.railway.app/users/%s", userID), nil)
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("Error calling GetUserHandler: %v", err)
		WriteJSONError(w, "Gig added but failed to retrieve updated user data", http.StatusOK)
		return
	}
	defer resp.Body.Close()

	var updatedUser models.User
	if err := json.NewDecoder(resp.Body).Decode(&updatedUser); err != nil {
		log.Printf("Error decoding GetUserHandler response: %v", err)
		WriteJSONError(w, "Gig added but failed to retrieve updated user data", http.StatusOK)
		return
	}

	// ✅ Return success response including updated grids count
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message": "Gig added successfully",
		"id":      result.InsertedID,
		"grids":   updatedUser.Grids, // ✅ Return updated grids count
	})
}

func updateExpiredGigs() {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	collection := db.GetCollection("gridlyapp", "gigs")

	filter := bson.M{
		"expirationDate": bson.M{"$lt": time.Now()},
		"expired":        false,
	}
	update := bson.M{
		"$set": bson.M{"expired": true},
	}

	_, err := collection.UpdateMany(ctx, filter, update)
	if err != nil {
		log.Printf("Error updating expired gigs: %v", err)
	}
}

func SearchGigsHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodPost {
		WriteJSONError(w, "Invalid request method", http.StatusMethodNotAllowed)
		return
	}

	// 1️⃣ Retrieve authenticated user details
	userID, ok := r.Context().Value(userIDKey).(string)
	if !ok || userID == "" {
		WriteJSONError(w, "User not authenticated", http.StatusUnauthorized)
		return
	}

	userObjID, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		WriteJSONError(w, "Invalid user ID", http.StatusBadRequest)
		return
	}

	university, ok := r.Context().Value(userInstitution).(string)
	if !ok || university == "" {
		WriteJSONError(w, "User university information missing", http.StatusUnauthorized)
		return
	}

	// 2️⃣ Parse user query
	var req struct {
		Query string `json:"query"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Printf("Error decoding request body: %v", err)
		WriteJSONError(w, "Invalid input format", http.StatusBadRequest)
		return
	}
	cleanedQuery := strings.TrimSpace(req.Query)
	if cleanedQuery == "" {
		WriteJSONError(w, "Query is required", http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	refinedQuery, err := RefineQueryWithPrompt(cleanedQuery)
	if err != nil {
		log.Printf("Error refining query with GPT: %v", err)
		WriteJSONError(w, "Error processing query", http.StatusInternalServerError)
		return
	}
	log.Printf("🔍 Refined Query from GPT: %s", refinedQuery)

	// 3️⃣ Apply the filter to restrict gigs to those visible to the user
	filter := bson.M{
		"status":  "active",
		"expired": false,
		"userId":  bson.M{"$ne": userObjID}, // Exclude user's own gigs
		"requestedBy": bson.M{
			"$nin": []primitive.ObjectID{userObjID}, // Exclude gigs already requested by user
		},
		"$or": []bson.M{
			{"campusPresence": "flexible"},                           // Include all "flexible" gigs
			{"campusPresence": "inCampus", "university": university}, // Include "inCampus" gigs from the same university
		},
		"embeddings": bson.M{"$exists": true}, // Ensure embeddings exist
	}

	// 4️⃣ Get the query embedding
	queryEmbedding, err := embeddings.GetEmbeddingForText(ctx, refinedQuery)
	if err != nil {
		log.Printf("❌ Error generating query embedding: %v", err)
		WriteJSONError(w, "Error generating query embedding", http.StatusInternalServerError)
		return
	}

	// 5️⃣ Fetch only the gigs that match the filter
	collection := db.GetCollection("gridlyapp", "gigs")
	cursor, err := collection.Find(
		ctx,
		filter,
		options.Find().SetProjection(bson.M{
			"_id":         1,
			"userId":      1, // ✅ Keep userId in response
			"title":       1,
			"description": 1,
			"embeddings":  1,
			"price":       1,
			"category":    1,
		}),
	)
	if err != nil {
		log.Printf("❌ Error fetching gigs: %v", err)
		WriteJSONError(w, "Error fetching gigs", http.StatusInternalServerError)
		return
	}
	defer cursor.Close(ctx)

	type GigMinimal struct {
		ID          primitive.ObjectID `bson:"_id" json:"id"`
		UserID      primitive.ObjectID `bson:"userId" json:"userId"`
		Title       string             `bson:"title" json:"title"`
		Description string             `bson:"description" json:"description"`
		Embeddings  []float32          `bson:"embeddings"`
		Price       string             `bson:"price" json:"price"`
		Category    string             `bson:"category" json:"category"`
	}

	var gigs []GigMinimal
	if err := cursor.All(ctx, &gigs); err != nil {
		log.Printf("❌ Error decoding gigs: %v", err)
		WriteJSONError(w, "Error decoding gigs", http.StatusInternalServerError)
		return
	}

	// ✅ Debugging: Log how many gigs were retrieved after applying the filter
	log.Printf("📊 Retrieved %d gigs matching the visibility filter", len(gigs))

	type GigMatch struct {
		ID          primitive.ObjectID `json:"id"`
		UserID      primitive.ObjectID `json:"userId"`
		Title       string             `json:"title"`
		Description string             `json:"description"`
		Price       string             `json:"price"`
		Category    string             `json:"category"`
		Similarity  float64            `json:"similarity"`
	}

	var matches []GigMatch
	for _, gig := range gigs {
		similarity := computeCosineSimilarity(queryEmbedding, gig.Embeddings)

		// ✅ Debugging: Log similarity scores
		log.Printf("🔍 Gig: %s | Similarity: %f", gig.Title, similarity)

		if similarity >= 0.6 { // Adjusted similarity threshold for debugging
			matches = append(matches, GigMatch{
				ID:          gig.ID,
				UserID:      gig.UserID,
				Title:       gig.Title,
				Description: gig.Description,
				Price:       gig.Price,
				Category:    gig.Category,
				Similarity:  similarity,
			})
		}
	}

	// Sort by similarity
	sort.Slice(matches, func(i, j int) bool {
		return matches[i].Similarity > matches[j].Similarity
	})

	// Limit to top 5 results
	if len(matches) > 5 {
		matches = matches[:5]
	}

	if len(matches) == 0 {
		log.Println("⚠️ No gigs matched the query after similarity check.")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode([]map[string]interface{}{
			{
				"message": "No gigs matched your query. Could you clarify your preferred category, price range, or other details?",
			},
		})
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(matches)
}

func RefineQueryWithPrompt(userQuery string) (string, error) {
	client := openai.NewClient(os.Getenv("OPENAI_API_KEY"))

	// Define the system prompt for refinement
	systemPrompt := `
You are an assistant specializing in understanding and refining user queries for a gig search platform.
- Extract key intent from the query, paying special attention to preferences like "open to communication," numeric rates ("30 dollars an hour"), or "non-academic."
- Emphasize important qualifiers and explicitly exclude "academic" if the user says "non-academic."
- If the query is vague, make it more specific by adding synonyms or clarifications, but do not change user intent.
- The goal is to help find the best matching gigs in a database.
`
	resp, err := client.CreateChatCompletion(context.Background(), openai.ChatCompletionRequest{
		Model: openai.GPT4, // Or whichever model you use
		Messages: []openai.ChatCompletionMessage{
			{Role: "system", Content: systemPrompt},
			{Role: "user", Content: userQuery},
		},
		Temperature: 0.8,
		MaxTokens:   150,
	})
	if err != nil {
		return "", err
	}

	if len(resp.Choices) == 0 {
		return "", fmt.Errorf("no GPT response")
	}

	refinedQuery := strings.TrimSpace(resp.Choices[0].Message.Content)
	log.Printf("Refined Query: %s", refinedQuery) // Debug
	return refinedQuery, nil
}

// --------------------------------------------------------------------------
// Helper for computing cosine similarity between two float32 vectors
func computeCosineSimilarity(a, b []float32) float64 {
	if len(a) != len(b) {
		return 0.0 // Embeddings must be the same length
	}

	var dotProduct, normA, normB float64
	for i := 0; i < len(a); i++ {
		dotProduct += float64(a[i]) * float64(b[i])
		normA += float64(a[i]) * float64(a[i])
		normB += float64(b[i]) * float64(b[i])
	}

	if normA == 0 || normB == 0 {
		return 0.0
	}

	return dotProduct / (math.Sqrt(normA) * math.Sqrt(normB))
}

// GetSingleGigHandler handles fetching a single gig by its ID
func GetSingleGigHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodGet {
		WriteJSONError(w, "Invalid request method", http.StatusMethodNotAllowed)
		return
	}

	vars := mux.Vars(r)
	id := vars["id"]

	gigID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		WriteJSONError(w, "Invalid gig ID format", http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	collection := db.GetCollection("gridlyapp", "gigs")
	var gig models.Gig
	err = collection.FindOne(ctx, bson.M{"_id": gigID, "status": "active"}).Decode(&gig)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			WriteJSONError(w, "Gig not found", http.StatusNotFound)
			return
		}
		log.Printf("Error fetching gig: %v", err)
		WriteJSONError(w, "Error fetching gig", http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(gig)
}

func GetAllGigsHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodGet {
		WriteJSONError(w, "Invalid request method", http.StatusMethodNotAllowed)
		return
	}

	// ✅ Ensure expired gigs are updated before fetching
	updateExpiredGigs()

	// 🔥 Retrieve authenticated user details
	userId, ok := r.Context().Value(userIDKey).(string)
	if !ok || userId == "" {
		WriteJSONError(w, "User not authenticated", http.StatusUnauthorized)
		return
	}

	userObjID, err := primitive.ObjectIDFromHex(userId)
	if err != nil {
		WriteJSONError(w, "Invalid user ID format", http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	userCollection := db.GetCollection("gridlyapp", "university_users")
	var user models.User
	err = userCollection.FindOne(ctx, bson.M{"_id": userObjID}).Decode(&user)
	if err == mongo.ErrNoDocuments {
		userCollection = db.GetCollection("gridlyapp", "highschool_users")
		err = userCollection.FindOne(ctx, bson.M{"_id": userObjID}).Decode(&user)
	}
	if err != nil {
		log.Printf("Error fetching user details: %v", err)
		WriteJSONError(w, "Error fetching user details", http.StatusInternalServerError)
		return
	}

	if user.Institution == "" {
		WriteJSONError(w, "User institution information missing", http.StatusBadRequest)
		return
	}

	collection := db.GetCollection("gridlyapp", "gigs")

	// ✅ Fetch gigs where:
	// - `expired` is `false`
	// - `status` is `active`
	// - `campusPresence` is `flexible` (show to everyone) OR `inCampus` but matching user institution
	// - 🔥 Exclude gigs where `userId` matches the current user's ID
	// - 🔥 Exclude gigs where current user's ID is in the `requestedBy` field
	filter := bson.M{
		"status":  bson.M{"$in": []string{"active"}},
		"expired": false,
		"userId":  bson.M{"$ne": userObjID}, // Exclude user's own gigs
		"requestedBy": bson.M{
			"$nin": []primitive.ObjectID{userObjID},
		},
		"$or": []bson.M{
			{"campusPresence": "flexible"},                                 // Show all "flexible" gigs
			{"campusPresence": "inCampus", "university": user.Institution}, // Match institution for "inCampus"
		},
	}

	cursor, err := collection.Find(ctx, filter)
	if err != nil {
		log.Printf("Error fetching gigs: %v", err)
		WriteJSONError(w, "Error fetching gigs", http.StatusInternalServerError)
		return
	}
	defer cursor.Close(ctx)

	var gigs []models.Gig
	if err = cursor.All(ctx, &gigs); err != nil {
		log.Printf("Error decoding gigs: %v", err)
		WriteJSONError(w, "Error decoding gigs", http.StatusInternalServerError)
		return
	}

	// ✅ Return filtered gigs
	json.NewEncoder(w).Encode(gigs)
}

func UpdateGigHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodPut {
		WriteJSONError(w, "Invalid request method", http.StatusMethodNotAllowed)
		return
	}

	// Retrieve authenticated user details from context
	userID, ok := r.Context().Value(userIDKey).(string)
	if !ok || userID == "" {
		WriteJSONError(w, "User not authenticated", http.StatusUnauthorized)
		return
	}

	userObjID, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		WriteJSONError(w, "Invalid user ID", http.StatusBadRequest)
		return
	}

	vars := mux.Vars(r)
	id := vars["id"]

	gigID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		WriteJSONError(w, "Invalid gig ID format", http.StatusBadRequest)
		return
	}

	var gigReq UpdateGigRequest
	if err := json.NewDecoder(r.Body).Decode(&gigReq); err != nil {
		log.Printf("Error decoding request body: %v", err)
		WriteJSONError(w, "Invalid input format", http.StatusBadRequest)
		return
	}

	// Fetch existing gig to verify ownership
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	collection := db.GetCollection("gridlyapp", "gigs")
	var existingGig models.Gig
	err = collection.FindOne(ctx, bson.M{"_id": gigID, "status": "active"}).Decode(&existingGig)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			WriteJSONError(w, "Gig not found", http.StatusNotFound)
			return
		}
		log.Printf("Error fetching gig: %v", err)
		WriteJSONError(w, "Error fetching gig", http.StatusInternalServerError)
		return
	}

	if existingGig.UserID != userObjID {
		WriteJSONError(w, "Unauthorized to update this gig", http.StatusUnauthorized)
		return
	}

	// Prepare update document
	updateFields := bson.M{}

	if gigReq.Title != nil && strings.TrimSpace(*gigReq.Title) != "" {
		updateFields["title"] = strings.TrimSpace(*gigReq.Title)
	}
	if gigReq.Category != nil && strings.TrimSpace(*gigReq.Category) != "" {
		updateFields["category"] = strings.TrimSpace(*gigReq.Category)
	}
	if gigReq.Description != nil && strings.TrimSpace(*gigReq.Description) != "" {
		updateFields["description"] = strings.TrimSpace(*gigReq.Description)
	}
	if gigReq.Price != nil && strings.TrimSpace(*gigReq.Price) != "" {
		// Validate price: either "Open to Communication" or a numeric string
		if *gigReq.Price != "Open to Communication" {
			if !isValidNumericPrice(*gigReq.Price) {
				WriteJSONError(w, "Invalid price. Must be numeric or 'Open to Communication'.", http.StatusBadRequest)
				return
			}
		}
		updateFields["price"] = strings.TrimSpace(*gigReq.Price)
	}
	if gigReq.DeliveryTime != nil && strings.TrimSpace(*gigReq.DeliveryTime) != "" {
		updateFields["deliveryTime"] = strings.TrimSpace(*gigReq.DeliveryTime)
	}
	if gigReq.Images != nil && len(*gigReq.Images) > 0 {
		updateFields["images"] = *gigReq.Images
	}
	if gigReq.ExpirationDate != nil {
		if strings.TrimSpace(*gigReq.ExpirationDate) != "" {
			// Parse the expirationDate string
			parsedDate, err := time.Parse(time.RFC3339, *gigReq.ExpirationDate)
			if err != nil {
				parsedDate, err = time.Parse("2006-01-02 15:04", *gigReq.ExpirationDate)
				if err != nil {
					WriteJSONError(w, "Invalid expiration date format. Use RFC3339 or 'YYYY-MM-DD HH:MM' format.", http.StatusBadRequest)
					return
				}
			}
			updateFields["expirationDate"] = parsedDate
		} else {
			// If expirationDate is empty, default to 30 days from now
			updateFields["expirationDate"] = time.Now().AddDate(0, 0, 30)
		}
	}

	// NEW: campusPresence
	if gigReq.CampusPresence != nil && strings.TrimSpace(*gigReq.CampusPresence) != "" {
		updateFields["campusPresence"] = strings.TrimSpace(*gigReq.CampusPresence)
	}

	if len(updateFields) == 0 {
		WriteJSONError(w, "No valid fields provided for update", http.StatusBadRequest)
		return
	}

	update := bson.M{
		"$set": updateFields,
	}

	result, err := collection.UpdateOne(ctx, bson.M{"_id": gigID}, update)
	if err != nil {
		log.Printf("Error updating gig: %v", err)
		WriteJSONError(w, "Error updating gig", http.StatusInternalServerError)
		return
	}

	if result.MatchedCount == 0 {
		WriteJSONError(w, "Gig not found", http.StatusNotFound)
		return
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"message": "Gig updated successfully",
	})
}

// The rest of your handlers (GetSingleGigHandler, GetAllGigsHandler, etc.) remain the same...

// Helper function to validate a numeric price (no currency symbols, no /hour)
func isValidNumericPrice(price string) bool {
	// Matches an integer or decimal (e.g., "25", "25.50")
	matched, _ := regexp.MatchString(`^\d+(\.\d{1,2})?$`, price)
	return matched
}

// DeleteGigHandler handles the deletion of a gig by its ID
func DeleteGigHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodDelete {
		WriteJSONError(w, "Invalid request method", http.StatusMethodNotAllowed)
		return
	}

	// Retrieve authenticated user details from context
	userID, ok := r.Context().Value(userIDKey).(string)
	if !ok || userID == "" {
		WriteJSONError(w, "User not authenticated", http.StatusUnauthorized)
		return
	}

	userObjID, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		WriteJSONError(w, "Invalid user ID", http.StatusBadRequest)
		return
	}

	vars := mux.Vars(r)
	id := vars["id"]

	gigID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		WriteJSONError(w, "Invalid gig ID format", http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	collection := db.GetCollection("gridlyapp", "gigs")
	var existingGig models.Gig
	err = collection.FindOne(ctx, bson.M{"_id": gigID, "status": "active"}).Decode(&existingGig)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			WriteJSONError(w, "Gig not found", http.StatusNotFound)
			return
		}
		log.Printf("Error fetching gig: %v", err)
		WriteJSONError(w, "Error fetching gig", http.StatusInternalServerError)
		return
	}

	if existingGig.UserID != userObjID {
		WriteJSONError(w, "Unauthorized to delete this gig", http.StatusUnauthorized)
		return
	}

	deleteResult, err := collection.DeleteOne(ctx, bson.M{"_id": gigID})
	if err != nil {
		log.Printf("Error deleting gig: %v", err)
		WriteJSONError(w, "Error deleting gig", http.StatusInternalServerError)
		return
	}

	if deleteResult.DeletedCount == 0 {
		WriteJSONError(w, "Gig not found or already deleted", http.StatusNotFound)
		return
	}

	// Optionally, handle removal from other collections or cleanup tasks

	json.NewEncoder(w).Encode(map[string]interface{}{
		"message": "Gig deleted successfully",
	})
}

// GetUserGigsHandler handles fetching all gigs posted by the authenticated user with optional pagination
func GetUserGigsHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodGet {
		WriteJSONError(w, "Invalid request method", http.StatusMethodNotAllowed)
		return
	}

	// Retrieve authenticated user details from context
	userID, ok := r.Context().Value(userIDKey).(string)
	if !ok || userID == "" {
		WriteJSONError(w, "User not authenticated", http.StatusUnauthorized)
		return
	}

	userObjID, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		WriteJSONError(w, "Invalid user ID format", http.StatusBadRequest)
		return
	}

	// Implement pagination
	pageStr := r.URL.Query().Get("page")
	limitStr := r.URL.Query().Get("limit")

	// Parse 'page' query parameter
	page, err := strconv.Atoi(pageStr)
	if err != nil || page < 1 {
		page = 1 // Default to page 1 if invalid
	}

	// Parse 'limit' query parameter
	limit, err := strconv.Atoi(limitStr)
	if err != nil || limit < 1 || limit > 100 {
		limit = 10 // Default to 10 items per page if invalid or out of range
	}

	// Calculate 'skip' based on current page and limit
	skip := int64((page - 1) * limit) // Convert to int64
	limit64 := int64(limit)           // Convert to int64

	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	collection := db.GetCollection("gridlyapp", "gigs")

	// Filter to fetch gigs posted by the authenticated user
	filter := bson.M{
		"status": "active",
		"userId": userObjID,
	}

	// Create FindOptions with proper *int64 types
	findOptions := options.Find()
	findOptions.SetSkip(skip)
	findOptions.SetLimit(limit64)
	findOptions.SetSort(bson.D{
		{Key: "postedDate", Value: -1}, // Sort by newest first
	})

	cursor, err := collection.Find(ctx, filter, findOptions)
	if err != nil {
		log.Printf("Error fetching user gigs: %v", err)
		WriteJSONError(w, "Error fetching gigs", http.StatusInternalServerError)
		return
	}
	defer cursor.Close(ctx)

	var gigs []models.Gig
	if err = cursor.All(ctx, &gigs); err != nil {
		log.Printf("Error decoding user gigs: %v", err)
		WriteJSONError(w, "Error decoding gigs", http.StatusInternalServerError)
		return
	}

	// Get total count for pagination
	totalCount, err := collection.CountDocuments(ctx, filter)
	if err != nil {
		log.Printf("Error counting user gigs: %v", err)
		WriteJSONError(w, "Error counting gigs", http.StatusInternalServerError)
		return
	}

	totalPages := int((totalCount + int64(limit) - 1) / int64(limit)) // Ceiling division

	// Response structure with pagination metadata
	response := map[string]interface{}{
		"page":       page,
		"limit":      limit,
		"totalPages": totalPages,
		"totalCount": totalCount,
		"gigs":       gigs,
		"count":      len(gigs),
	}

	json.NewEncoder(w).Encode(response)
}
