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

	universityUsersCollection := db.GetCollection("gridlyapp", "university_users")
	err = universityUsersCollection.FindOne(ctx, bson.M{"_id": userID}, findOptions).Decode(&user)
	if err == nil {
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(user)
		return
	} else if err != mongo.ErrNoDocuments {
		log.Printf("Error fetching user from university_users: %v", err)
		WriteJSONError(w, "Error fetching user data", http.StatusInternalServerError)
		return
	}

	// If not found, try to find the user in the "high_school_users" collection
	highSchoolUsersCollection := db.GetCollection("gridlyapp", "highschool_users")
	err = highSchoolUsersCollection.FindOne(ctx, bson.M{"_id": userID}, findOptions).Decode(&user)
	if err == nil {
		// User found in "high_school_users" collection
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(user)
		return
	} else if err != mongo.ErrNoDocuments {
		log.Printf("Error fetching user from highschool_users: %v", err)
		WriteJSONError(w, "Error fetching user data", http.StatusInternalServerError)
		return
	}

	// User not found in either collection
	WriteJSONError(w, "User not found", http.StatusNotFound)
}

func StorePushTokenHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	var req struct {
		UserID        string `json:"userId"`
		ExpoPushToken string `json:"expoPushToken"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request payload", http.StatusBadRequest)
		return
	}

	if req.UserID == "" || req.ExpoPushToken == "" {
		http.Error(w, "Missing userId or expoPushToken", http.StatusBadRequest)
		return
	}

	userID, err := primitive.ObjectIDFromHex(req.UserID)
	if err != nil {
		http.Error(w, "Invalid userId format", http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Define the update operation
	update := bson.M{"$set": bson.M{"expoPushToken": req.ExpoPushToken}}
	opts := options.Update().SetUpsert(true)

	universityUsersCollection := db.GetCollection("gridlyapp", "university_users")
	highSchoolUsersCollection := db.GetCollection("gridlyapp", "highschool_users")

	// Try updating in university_users
	filter := bson.M{"_id": userID}
	result, err := universityUsersCollection.UpdateOne(ctx, filter, update, opts)
	if err != nil {
		log.Printf("Error updating push token in university_users: %v", err)
		http.Error(w, "Failed to update push token", http.StatusInternalServerError)
		return
	}
	if result.MatchedCount == 0 {
		result, err = highSchoolUsersCollection.UpdateOne(ctx, filter, update, opts)
		if err != nil {
			log.Printf("Error updating push token in highschool_users: %v", err)
			http.Error(w, "Failed to update push token", http.StatusInternalServerError)
			return
		}

		// If user is not found in either collection, return an error
		if result.MatchedCount == 0 {
			http.Error(w, "User not found in any collection", http.StatusNotFound)
			return
		}
	}

	log.Printf("Push token updated successfully for user %s", req.UserID)
	json.NewEncoder(w).Encode(map[string]string{"message": "Push token stored successfully"})
}
