// handlers/userHandlers.go

package handlers

import (
	"context"
	"encoding/json"
	"log"
	"math/rand"
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

// GetUserHandler handles fetching a user's details by ID, including profilePic and Grids
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

	// ✅ Include Grids in the projection
	projection := bson.M{
		"firstName":   1,
		"lastName":    1,
		"email":       1,
		"institution": 1,
		"profilePic":  1, // Include profile picture
		"studentType": 1,
		"grids":       1, // ✅ Now fetching Grids
	}

	findOptions := options.FindOne().SetProjection(projection)

	var user models.User

	// Try to fetch user from university_users collection
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

	// If not found, try to fetch user from highschool_users collection
	highSchoolUsersCollection := db.GetCollection("gridlyapp", "highschool_users")
	err = highSchoolUsersCollection.FindOne(ctx, bson.M{"_id": userID}, findOptions).Decode(&user)
	if err == nil {
		// User found in highschool_users collection
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

	universityUsersCollection := db.GetCollection("gridlyapp", "university_users")
	highSchoolUsersCollection := db.GetCollection("gridlyapp", "highschool_users")

	// Define the update operation
	update := bson.M{"$set": bson.M{"expoPushToken": req.ExpoPushToken}}
	opts := options.Update().SetUpsert(true)

	// First, check if the user exists in university_users
	var universityUser bson.M
	err = universityUsersCollection.FindOne(ctx, bson.M{"_id": userID}).Decode(&universityUser)
	if err == nil {
		// User exists in university_users, update them there
		_, err = universityUsersCollection.UpdateOne(ctx, bson.M{"_id": userID}, update, opts)
		if err != nil {
			log.Printf("Error updating push token in university_users: %v", err)
			http.Error(w, "Failed to update push token", http.StatusInternalServerError)
			return
		}
		log.Printf("Push token updated successfully in university_users for user %s", req.UserID)
		json.NewEncoder(w).Encode(map[string]string{"message": "Push token stored successfully"})
		return
	}

	// If not found in university_users, check highschool_users
	var highSchoolUser bson.M
	err = highSchoolUsersCollection.FindOne(ctx, bson.M{"_id": userID}).Decode(&highSchoolUser)
	if err == nil {
		// User exists in highschool_users, update them there
		_, err = highSchoolUsersCollection.UpdateOne(ctx, bson.M{"_id": userID}, update, opts)
		if err != nil {
			log.Printf("Error updating push token in highschool_users: %v", err)
			http.Error(w, "Failed to update push token", http.StatusInternalServerError)
			return
		}
		log.Printf("Push token updated successfully in highschool_users for user %s", req.UserID)
		json.NewEncoder(w).Encode(map[string]string{"message": "Push token stored successfully"})
		return
	}

	// If user is found in neither collection
	http.Error(w, "User not found in any collection", http.StatusNotFound)
}
func IncrementUserGrids(userID primitive.ObjectID, studentType string) error {
	// Determine the correct collection based on student type.
	var collectionName string
	if studentType == StudentTypeUniversity {
		collectionName = "university_users"
	} else {
		collectionName = "highschool_users"
	}
	userCollection := db.GetCollection("gridlyapp", collectionName)

	// Generate a random increment between 4 and 10 inclusive.
	// rand.Intn(n) returns a value in [0, n), so use rand.Intn(7) + 4.
	increment := rand.Intn(7) + 4

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Use the $inc operator to increment the grids field.
	update := bson.M{"$inc": bson.M{"grids": increment}}
	_, err := userCollection.UpdateOne(ctx, bson.M{"_id": userID}, update)
	if err != nil {
		log.Printf("Error incrementing grids for user %s: %v", userID.Hex(), err)
	}
	return err
}
