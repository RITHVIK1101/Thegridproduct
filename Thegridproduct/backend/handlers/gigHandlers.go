// handlers/gigHandlers.go

package handlers

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"time"

	"Thegridproduct/backend/db"     // Replace with your actual module name
	"Thegridproduct/backend/models" // Replace with your actual module name

	"github.com/gorilla/mux"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// AddGigHandler handles adding a new gig
func AddGigHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodPost {
		http.Error(w, `{"message": "Invalid request method"}`, http.StatusMethodNotAllowed)
		return
	}

	var gig models.Gig
	if err := json.NewDecoder(r.Body).Decode(&gig); err != nil {
		log.Printf("Error decoding request body: %v", err)
		http.Error(w, `{"message": "Invalid input"}`, http.StatusBadRequest)
		return
	}

	// Validate required fields
	if gig.TaskName == "" || gig.Description == "" || gig.DueDate.IsZero() || gig.Budget == "" {
		http.Error(w, `{"message": "Missing required fields"}`, http.StatusBadRequest)
		return
	}

	// Optional: Validate images (e.g., limit number, format)
	if len(gig.Images) > 5 {
		http.Error(w, `{"message": "You can upload up to 5 images"}`, http.StatusBadRequest)
		return
	}

	// Set CreatedAt and UpdatedAt
	gig.CreatedAt = time.Now()
	gig.UpdatedAt = time.Now()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	collection := db.GetCollection("gridlyapp", "gigs")
	result, err := collection.InsertOne(ctx, gig)
	if err != nil {
		log.Printf("Error inserting gig: %v", err)
		http.Error(w, `{"message": "Error saving gig"}`, http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message": "Gig added successfully",
		"id":      result.InsertedID,
	})
}

// GetGigsHandler handles fetching all gigs
func GetGigsHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodGet {
		http.Error(w, `{"message": "Invalid request method"}`, http.StatusMethodNotAllowed)
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	collection := db.GetCollection("gridlyapp", "gigs")
	cursor, err := collection.Find(ctx, bson.M{})
	if err != nil {
		log.Println("Error fetching gigs:", err)
		http.Error(w, `{"message": "Error fetching gigs"}`, http.StatusInternalServerError)
		return
	}
	defer cursor.Close(ctx)

	var gigs []models.Gig
	if err := cursor.All(ctx, &gigs); err != nil {
		log.Println("Error decoding gigs:", err)
		http.Error(w, `{"message": "Error decoding gigs"}`, http.StatusInternalServerError)
		return
	}

	log.Printf("Fetched gigs: %+v\n", gigs)
	json.NewEncoder(w).Encode(gigs)
}
func GetGigByIDHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	vars := mux.Vars(r)
	id := vars["id"]

	gigID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		http.Error(w, `{"message": "Invalid gig ID format"}`, http.StatusBadRequest)
		return
	}

	var gig models.Gig
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	collection := db.GetCollection("gridlyapp", "gigs")
	err = collection.FindOne(ctx, bson.M{"_id": gigID}).Decode(&gig)
	if err != nil {
		http.Error(w, `{"message": "Gig not found"}`, http.StatusNotFound)
		return
	}

	json.NewEncoder(w).Encode(gig)
}
