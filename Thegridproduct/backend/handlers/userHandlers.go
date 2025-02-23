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

// UpdateUserPushToken updates the user's push notification token
func UpdateUserPushToken(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodPost {
		WriteJSONError(w, "Invalid request method", http.StatusMethodNotAllowed)
		return
	}

	// Parse request body
	var requestBody struct {
		UserID        string `json:"userId"`
		ExpoPushToken string `json:"expoPushToken"`
	}

	err := json.NewDecoder(r.Body).Decode(&requestBody)
	if err != nil {
		WriteJSONError(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate UserID
	userID, err := primitive.ObjectIDFromHex(requestBody.UserID)
	if err != nil {
		WriteJSONError(w, "Invalid user ID format", http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Determine the user collection
	var userCollection *mongo.Collection
	if r.Header.Get("X-User-Type") == "university" {
		userCollection = db.GetCollection("gridlyapp", "university_users")
	} else {
		userCollection = db.GetCollection("gridlyapp", "high_school_users")
	}

	// Update user document with push token
	update := bson.M{"$set": bson.M{"expoPushToken": requestBody.ExpoPushToken, "updatedAt": time.Now()}}
	_, err = userCollection.UpdateOne(ctx, bson.M{"_id": userID}, update)
	if err != nil {
		log.Printf("Error updating user push token: %v", err)
		WriteJSONError(w, "Failed to update push token", http.StatusInternalServerError)
		return
	}

	// Send success response
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "Push token updated successfully"})
}
