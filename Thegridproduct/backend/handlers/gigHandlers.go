// handlers/gig_handlers.go

package handlers

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"Thegridproduct/backend/db"
	"Thegridproduct/backend/models"

	"github.com/gorilla/mux"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// CreateGigRequest defines the expected payload for creating a gig
type CreateGigRequest struct {
	Title               string   `json:"title"`
	Description         string   `json:"description"`
	Category            string   `json:"category"`
	Price               string   `json:"price"`
	Availability        string   `json:"availability"`
	AdditionalLinks     []string `json:"additionalLinks"`
	AdditionalDocuments []string `json:"additionalDocuments"`
	CoverImage          string   `json:"coverImage"`
	Images              []string `json:"images"` // Assuming additionalDocuments are images/documents
}

// UpdateGigRequest defines the expected payload for updating a gig
type UpdateGigRequest struct {
	Title               *string   `json:"title,omitempty"`
	Description         *string   `json:"description,omitempty"`
	Category            *string   `json:"category,omitempty"`
	Price               *string   `json:"price,omitempty"`
	Availability        *string   `json:"availability,omitempty"`
	AdditionalLinks     *[]string `json:"additionalLinks,omitempty"`
	AdditionalDocuments *[]string `json:"additionalDocuments,omitempty"`
	CoverImage          *string   `json:"coverImage,omitempty"`
	Images              *[]string `json:"images,omitempty"`
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
	if strings.TrimSpace(gigReq.CoverImage) == "" {
		WriteJSONError(w, "Cover image is required", http.StatusBadRequest)
		return
	}
	if strings.TrimSpace(gigReq.Description) == "" {
		WriteJSONError(w, "Description is required", http.StatusBadRequest)
		return
	}

	// Validate price format if not "Open to Communication"
	if gigReq.Price != "Open to Communication" {
		if !isValidPriceFormat(gigReq.Price) {
			WriteJSONError(w, "Invalid price format. Use formats like '$25/hour'.", http.StatusBadRequest)
			return
		}
	}

	// Validate availability
	finalAvailability := "Open to Communication"
	if gigReq.Availability != "Open to Communication" && gigReq.Availability != "" {
		validDays := map[string]bool{
			"Monday":    true,
			"Tuesday":   true,
			"Wednesday": true,
			"Thursday":  true,
			"Friday":    true,
			"Saturday":  true,
			"Sunday":    true,
		}
		days := strings.Split(gigReq.Availability, ",")
		var trimmedDays []string
		for _, day := range days {
			day = strings.TrimSpace(day)
			if day != "" {
				if !validDays[day] {
					WriteJSONError(w, "Invalid availability day: "+day, http.StatusBadRequest)
					return
				}
				trimmedDays = append(trimmedDays, day)
			}
		}
		finalAvailability = strings.Join(trimmedDays, ", ")
	}

	// Prepare Gig model
	gig := models.Gig{
		UserID:              userObjID,
		University:          university,
		StudentType:         studentType,
		Title:               gigReq.Title,
		Category:            gigReq.Category,
		Description:         gigReq.Description,
		CoverImage:          gigReq.CoverImage,
		Price:               gigReq.Price,
		Availability:        finalAvailability,
		AdditionalLinks:     gigReq.AdditionalLinks,
		AdditionalDocuments: gigReq.AdditionalDocuments,
		PostedDate:          time.Now(),
		Expired:             false,
		Status:              "active",
		LikeCount:           0,
	}

	// Insert into MongoDB
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	collection := db.GetCollection("gridlyapp", "gigs")
	result, err := collection.InsertOne(ctx, gig)
	if err != nil {
		log.Printf("Error inserting gig: %v", err)
		WriteJSONError(w, "Error saving gig", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message": "Gig added successfully",
		"id":      result.InsertedID,
	})
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

// GetAllGigsHandler handles fetching all gigs with optional pagination and filtering
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

// UpdateGigHandler handles updating an existing gig by ID
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
	if gigReq.CoverImage != nil && strings.TrimSpace(*gigReq.CoverImage) != "" {
		updateFields["coverImage"] = strings.TrimSpace(*gigReq.CoverImage)
	}
	if gigReq.Price != nil && strings.TrimSpace(*gigReq.Price) != "" {
		// Validate price format if not "Open to Communication"
		if *gigReq.Price != "Open to Communication" && !isValidPriceFormat(*gigReq.Price) {
			WriteJSONError(w, "Invalid price format. Use formats like '$25/hour'.", http.StatusBadRequest)
			return
		}
		updateFields["price"] = strings.TrimSpace(*gigReq.Price)
	}
	if gigReq.Availability != nil && strings.TrimSpace(*gigReq.Availability) != "" {
		// Validate and map availability
		if *gigReq.Availability == "Whenever/Open to Communicate" {
			updateFields["availability"] = "Open to Communication"
		} else {
			validDays := map[string]bool{
				"Monday":    true,
				"Tuesday":   true,
				"Wednesday": true,
				"Thursday":  true,
				"Friday":    true,
				"Saturday":  true,
				"Sunday":    true,
			}
			days := strings.Split(*gigReq.Availability, ",")
			var trimmedDays []string
			for _, day := range days {
				day = strings.TrimSpace(day)
				if day != "" {
					if !validDays[day] {
						WriteJSONError(w, "Invalid availability day: "+day, http.StatusBadRequest)
						return
					}
					trimmedDays = append(trimmedDays, day)
				}
			}
			updateFields["availability"] = strings.Join(trimmedDays, ", ")
		}
	}
	if gigReq.AdditionalLinks != nil {
		updateFields["additionalLinks"] = *gigReq.AdditionalLinks
	}
	if gigReq.AdditionalDocuments != nil {
		updateFields["additionalDocuments"] = *gigReq.AdditionalDocuments
	}
	if gigReq.Description != nil && strings.TrimSpace(*gigReq.Description) != "" {
		updateFields["description"] = strings.TrimSpace(*gigReq.Description)
	}
	if gigReq.Images != nil && len(*gigReq.Images) > 0 {
		updateFields["images"] = *gigReq.Images
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

// Helper function to validate price format
func isValidPriceFormat(price string) bool {
	// Simple regex to match formats like '$25/hour'
	matched, _ := regexp.MatchString(`^\$\d+(\.\d{1,2})?\/hour$`, price)
	return matched
}
