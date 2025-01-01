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
			// If RFC3339 fails, try an alternate layout
			parsedDate, err = time.Parse("2006-01-02 15:04", gigReq.ExpirationDate)
			if err != nil {
				WriteJSONError(w, "Invalid expiration date format. Use RFC3339 or 'YYYY-MM-DD HH:MM' format.", http.StatusBadRequest)
				return
			}
		}
		expirationDate = parsedDate
	} else {
		expirationDate = time.Now().AddDate(0, 0, 30)
	}

	// Validate campusPresence
	campusPresence := "inCampus"
	if strings.TrimSpace(gigReq.CampusPresence) != "" {
		campusPresence = gigReq.CampusPresence
	}

	// Prepare Gig model
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
		Expired:        false,
		Status:         "active",
		LikeCount:      0,
		CampusPresence: campusPresence,
	}

	// 1. Generate embeddings for the gig
	//    Combine fields as needed (e.g., Title + Description + Category)
	textToEmbed := gigReq.Title + " " + gigReq.Description + " " + gigReq.Category

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	embeddingVector, err := embeddings.GetEmbeddingForText(ctx, textToEmbed)
	if err != nil {
		log.Printf("Error generating embeddings: %v", err)
		WriteJSONError(w, "Error generating embeddings", http.StatusInternalServerError)
		return
	}

	// 2. Assign the embeddings to the gig struct
	gig.Embeddings = embeddingVector

	// 3. Insert the gig into MongoDB
	collection := db.GetCollection("gridlyapp", "gigs")
	result, err := collection.InsertOne(ctx, gig)
	if err != nil {
		log.Printf("Error inserting gig: %v", err)
		WriteJSONError(w, "Error saving gig", http.StatusInternalServerError)
		return
	}

	// Return success
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message": "Gig added successfully",
		"id":      result.InsertedID,
	})
}
func SearchGigsHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodPost {
		WriteJSONError(w, "Invalid request method", http.StatusMethodNotAllowed)
		return
	}

	// Parse user query
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

	// --------------------------------------------------------------------------
	// 1) Refine the query using GPT
	// --------------------------------------------------------------------------
	refinedQuery, err := RefineQueryWithPrompt(cleanedQuery)
	if err != nil {
		log.Printf("Error refining query with GPT: %v", err)
		WriteJSONError(w, "Error processing query", http.StatusInternalServerError)
		return
	}

	log.Printf("Refined Query from GPT: %s", refinedQuery)

	// --------------------------------------------------------------------------
	// 2) Optional: Check for specific keywords to build a partial MongoDB filter
	//    e.g. if user says "open to communication" or "30 dollars an hour"
	//    or "non-academic" to exclude academic gigs
	// --------------------------------------------------------------------------
	filter := bson.M{"embeddings": bson.M{"$exists": true}}

	lowerRefined := strings.ToLower(refinedQuery)

	if strings.Contains(lowerRefined, "open to communication") ||
		strings.Contains(lowerRefined, "negotiable") ||
		strings.Contains(lowerRefined, "discuss price") {
		// Case-insensitive regex
		filter["price"] = bson.M{"$regex": "open to communication|negotiable", "$options": "i"}
	}

	if strings.Contains(lowerRefined, "30 dollars an hour") ||
		strings.Contains(lowerRefined, "$30/hour") {
		// If you want to specifically show gigs priced at "30 dollars an hour"
		// You can also handle numeric conversion if your DB stores numeric prices.
		// This is just an example of direct equality.
		filter["price"] = "30 dollars an hour"
	}

	// EXCLUDE "academic" gigs if user specifically said "non-academic"
	if strings.Contains(lowerRefined, "non academic") ||
		strings.Contains(lowerRefined, "non-academic") {
		// Example approach: exclude gigs whose category is "Academic" or "Tutoring"
		// Adjust to your actual DB fields
		filter["category"] = bson.M{"$ne": "Academic"}
	}

	// --------------------------------------------------------------------------
	// 3) Generate embedding for the refined query
	// --------------------------------------------------------------------------
	queryEmbedding, err := embeddings.GetEmbeddingForText(ctx, refinedQuery)
	if err != nil {
		log.Printf("Error generating query embedding: %v", err)
		WriteJSONError(w, "Error generating query embedding", http.StatusInternalServerError)
		return
	}

	// --------------------------------------------------------------------------
	// 4) Fetch relevant gigs from MongoDB with the partial filter
	// --------------------------------------------------------------------------
	collection := db.GetCollection("gridlyapp", "gigs")
	cursor, err := collection.Find(
		ctx,
		filter,
		options.Find().SetProjection(bson.M{
			"_id":         1,
			"title":       1,
			"description": 1,
			"embeddings":  1,
			"price":       1,
			"category":    1,
			// add any other fields you want to return
		}),
	)
	if err != nil {
		log.Printf("Error fetching gigs: %v", err)
		WriteJSONError(w, "Error fetching gigs", http.StatusInternalServerError)
		return
	}
	defer cursor.Close(ctx)

	type GigMinimal struct {
		ID          primitive.ObjectID `bson:"_id" json:"id"`
		Title       string             `bson:"title" json:"title"`
		Description string             `bson:"description" json:"description"`
		Embeddings  []float32          `bson:"embeddings"`
		Price       string             `bson:"price" json:"price"`
		Category    string             `bson:"category" json:"category"`
	}

	var gigs []GigMinimal
	if err := cursor.All(ctx, &gigs); err != nil {
		log.Printf("Error decoding gigs: %v", err)
		WriteJSONError(w, "Error decoding gigs", http.StatusInternalServerError)
		return
	}

	// --------------------------------------------------------------------------
	// 5) Calculate cosine similarity and match gigs
	// --------------------------------------------------------------------------
	type GigMatch struct {
		ID          primitive.ObjectID `json:"id"`
		Title       string             `json:"title"`
		Description string             `json:"description"`
		Price       string             `json:"price"`
		Category    string             `json:"category"`
		Similarity  float64            `json:"similarity"`
	}

	var matches []GigMatch
	for _, gig := range gigs {
		similarity := computeCosineSimilarity(queryEmbedding, gig.Embeddings)

		// Use a similarity threshold (adjust to your preference)
		if similarity >= 0.8 {
			matches = append(matches, GigMatch{
				ID:          gig.ID,
				Title:       gig.Title,
				Description: gig.Description,
				Price:       gig.Price,
				Category:    gig.Category,
				Similarity:  similarity,
			})
		}
	}

	// Sort by similarity descending
	sort.Slice(matches, func(i, j int) bool {
		return matches[i].Similarity > matches[j].Similarity
	})

	// Limit to top 5 results (adjust as needed)
	if len(matches) > 5 {
		matches = matches[:5]
	}

	// --------------------------------------------------------------------------
	// 6) Handle no matches scenario
	// --------------------------------------------------------------------------
	if len(matches) == 0 {
		// Instead of just returning a “no gigs found” message,
		// you could optionally use GPT again to ask the user clarifying questions.
		// For simplicity, we’re returning a prompt here:
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode([]map[string]interface{}{
			{
				"message": "No gigs matched your query. Could you clarify your preferred category, price range, or other details?",
			},
		})
		return
	}

	// --------------------------------------------------------------------------
	// 7) Return the matched gigs
	// --------------------------------------------------------------------------
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(matches)
}

// --------------------------------------------------------------------------
// RefineQueryWithPrompt refines the user query using GPT
// Adjust the system prompt and API usage as needed.
// --------------------------------------------------------------------------
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

// GetAllGigsHandler handles fetching all gigs with optional pagination and filtering,
// excluding gigs posted by the current authenticated user.
func GetAllGigsHandler(w http.ResponseWriter, r *http.Request) {
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

	// Convert userID string to ObjectID
	currentUserObjID, err := primitive.ObjectIDFromHex(userID)
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

	// Modify filter to exclude gigs posted by the current user
	filter := bson.M{
		"status": "active",
		"userId": bson.M{"$ne": currentUserObjID},
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

	// Get total count for pagination
	totalCount, err := collection.CountDocuments(ctx, filter)
	if err != nil {
		log.Printf("Error counting gigs: %v", err)
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
