package handlers

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"time"

	"Thegridproduct/backend/db"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

func AddLikedProductHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	// Authenticate user
	userId, ok := r.Context().Value(userIDKey).(string)
	if !ok || userId == "" {
		http.Error(w, "Unauthorized: User not authenticated", http.StatusUnauthorized)
		return
	}

	var body struct {
		ProductID string `json:"productId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Convert ProductID to ObjectID
	productID, err := primitive.ObjectIDFromHex(body.ProductID)
	if err != nil {
		http.Error(w, "Invalid Product ID format", http.StatusBadRequest)
		return
	}

	// Convert UserID to ObjectID
	userObjID, err := primitive.ObjectIDFromHex(userId)
	if err != nil {
		http.Error(w, "Invalid User ID format", http.StatusBadRequest)
		return
	}

	// Set a context with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Find user collection
	var userCollection *mongo.Collection
	collections := []string{"university_users", "highschool_users"}

	for _, colName := range collections {
		collection := db.GetCollection("gridlyapp", colName)
		if collection == nil {
			log.Printf("Collection %s not found", colName)
			continue
		}

		err := collection.FindOne(ctx, bson.M{"_id": userObjID}).Err()
		if err == nil {
			userCollection = collection
			log.Printf("User found in collection: %s", colName)
			break
		}
		if err != mongo.ErrNoDocuments {
			log.Printf("Error querying collection %s: %v", colName, err)
			http.Error(w, "Database error", http.StatusInternalServerError)
			return
		}
		log.Printf("User not found in collection: %s", colName)
	}

	if userCollection == nil {
		log.Printf("User with ID %s not found in any collection", userObjID.Hex())
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}

	// Update user's liked products
	updateUser := bson.M{
		"$addToSet": bson.M{
			"likedProducts": productID,
		},
	}
	_, err = userCollection.UpdateOne(ctx, bson.M{"_id": userObjID}, updateUser)
	if err != nil {
		http.Error(w, "Failed to update liked products", http.StatusInternalServerError)
		return
	}

	// Increment product's like count
	productCollection := db.GetCollection("gridlyapp", "products")
	updateProduct := bson.M{
		"$inc": bson.M{
			"likeCount": 1,
		},
	}
	_, err = productCollection.UpdateOne(ctx, bson.M{"_id": productID}, updateProduct)
	if err != nil {
		http.Error(w, "Failed to update product's like count", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "Product added to liked products"})
}

func RemoveLikedProductHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	// Authenticate user
	userId, ok := r.Context().Value(userIDKey).(string)
	if !ok || userId == "" {
		http.Error(w, "Unauthorized: User not authenticated", http.StatusUnauthorized)
		return
	}

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

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Resolve user collection dynamically
	var userCollectionName string
	universityUsers := db.GetCollection("gridlyapp", "university_users")
	highschoolUsers := db.GetCollection("gridlyapp", "highschool_users")

	// Check university_users first
	err = universityUsers.FindOne(ctx, bson.M{"_id": userObjID}).Err()
	if err == nil {
		userCollectionName = "university_users"
	} else if err == mongo.ErrNoDocuments {
		// If not found in university_users, check highschool_users
		err = highschoolUsers.FindOne(ctx, bson.M{"_id": userObjID}).Err()
		if err == nil {
			userCollectionName = "highschool_users"
		} else if err == mongo.ErrNoDocuments {
			http.Error(w, "User not found", http.StatusNotFound)
			return
		} else {
			http.Error(w, "Error querying user collections", http.StatusInternalServerError)
			return
		}
	} else {
		http.Error(w, "Error querying user collections", http.StatusInternalServerError)
		return
	}

	userCollection := db.GetCollection("gridlyapp", userCollectionName)
	productCollection := db.GetCollection("gridlyapp", "products")

	// Remove product from the user's likedProducts
	updateUser := bson.M{
		"$pull": bson.M{
			"likedProducts": productID,
		},
	}
	_, err = userCollection.UpdateOne(ctx, bson.M{"_id": userObjID}, updateUser)
	if err != nil {
		http.Error(w, "Failed to update liked products", http.StatusInternalServerError)
		return
	}

	// Decrement product's like count (ensure it doesn't go below 0)
	updateProduct := bson.M{
		"$inc": bson.M{
			"likeCount": -1,
		},
	}
	filterProduct := bson.M{
		"_id":       productID,
		"likeCount": bson.M{"$gt": 0}, // Only decrement if likeCount > 0
	}
	_, err = productCollection.UpdateOne(ctx, filterProduct, updateProduct)
	if err != nil {
		http.Error(w, "Failed to update product's like count", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "Product removed from liked products"})
}
