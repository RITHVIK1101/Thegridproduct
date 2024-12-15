package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"Thegridproduct/backend/db"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// AddLikedProductHandler adds a product to the user's liked products
func AddLikedProductHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	// Authenticate user
	userId, ok := r.Context().Value(userIDKey).(string)
	if !ok || userId == "" {
		http.Error(w, "Unauthorized: User not authenticated", http.StatusUnauthorized)
		return
	}

	// Parse product ID from request body
	var body struct {
		ProductID string `json:"productId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	productID, err := primitive.ObjectIDFromHex(body.ProductID)
	if err != nil {
		http.Error(w, "Invalid Product ID format", http.StatusBadRequest)
		return
	}

	userObjID, err := primitive.ObjectIDFromHex(userId)
	if err != nil {
		http.Error(w, "Invalid User ID", http.StatusBadRequest)
		return
	}

	// Connect to MongoDB and update the user's liked products
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	collection := db.GetCollection("gridlyapp", "users")

	update := bson.M{
		"$addToSet": bson.M{
			"likedProducts": productID,
		},
	}

	_, err = collection.UpdateOne(ctx, bson.M{"_id": userObjID}, update)
	if err != nil {
		http.Error(w, "Failed to update liked products", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "Product added to liked products"})
}

// RemoveLikedProductHandler removes a product from the user's liked products
func RemoveLikedProductHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	// Authenticate user
	userId, ok := r.Context().Value(userIDKey).(string)
	if !ok || userId == "" {
		http.Error(w, "Unauthorized: User not authenticated", http.StatusUnauthorized)
		return
	}

	// Parse product ID from request body
	var body struct {
		ProductID string `json:"productId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	productID, err := primitive.ObjectIDFromHex(body.ProductID)
	if err != nil {
		http.Error(w, "Invalid Product ID format", http.StatusBadRequest)
		return
	}

	userObjID, err := primitive.ObjectIDFromHex(userId)
	if err != nil {
		http.Error(w, "Invalid User ID", http.StatusBadRequest)
		return
	}

	// Connect to MongoDB and update the user's liked products
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	collection := db.GetCollection("gridlyapp", "users")

	update := bson.M{
		"$pull": bson.M{
			"likedProducts": productID,
		},
	}

	_, err = collection.UpdateOne(ctx, bson.M{"_id": userObjID}, update)
	if err != nil {
		http.Error(w, "Failed to update liked products", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "Product removed from liked products"})
}
