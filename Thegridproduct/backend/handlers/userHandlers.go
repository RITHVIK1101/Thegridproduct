// handlers/userHandlers.go

package handlers

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"time"

	"Thegridproduct/backend/db"
	"Thegridproduct/backend/models"

	"github.com/gorilla/mux"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// GetUserHandler handles fetching a user's details by ID
func GetUserHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	// Ensure the request method is GET
	if r.Method != http.MethodGet {
		WriteJSONError(w, "Invalid request method", http.StatusMethodNotAllowed)
		return
	}

	// Extract user ID from URL parameters
	vars := mux.Vars(r)
	id := vars["id"]

	userID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		WriteJSONError(w, "Invalid user ID format", http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Define projection to include only required fields
	projection := bson.M{
		"firstName":   1,
		"lastName":    1,
		"email":       1,
		"institution": 1,
	}

	findOptions := options.FindOne().SetProjection(projection)

	var user models.User

	// Try to find the user in the "university_users" collection
	universityUsersCollection := db.GetCollection("gridlyapp", "university_users")
	err = universityUsersCollection.FindOne(ctx, bson.M{"_id": userID}, findOptions).Decode(&user)
	if err == nil {
		// User found in "university_users" collection
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(user)
		return
	} else if err != mongo.ErrNoDocuments {
		log.Printf("Error fetching user from university_users: %v", err)
		WriteJSONError(w, "Error fetching user data", http.StatusInternalServerError)
		return
	}

	// If not found, try to find the user in the "high_school_users" collection
	highSchoolUsersCollection := db.GetCollection("gridlyapp", "high_school_users")
	err = highSchoolUsersCollection.FindOne(ctx, bson.M{"_id": userID}, findOptions).Decode(&user)
	if err == nil {
		// User found in "high_school_users" collection
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(user)
		return
	} else if err != mongo.ErrNoDocuments {
		log.Printf("Error fetching user from high_school_users: %v", err)
		WriteJSONError(w, "Error fetching user data", http.StatusInternalServerError)
		return
	}

	// User not found in either collection
	WriteJSONError(w, "User not found", http.StatusNotFound)
}
