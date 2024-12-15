package handlers

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"time"

	"Thegridproduct/backend/db"
	"Thegridproduct/backend/models"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

func GetAllOrdersHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	// Retrieve authenticated user ID from context
	userIDStr, ok := r.Context().Value(userIDKey).(string)
	if !ok || userIDStr == "" {
		WriteJSONError(w, "User not authenticated", http.StatusUnauthorized)
		return
	}

	userID, err := primitive.ObjectIDFromHex(userIDStr)
	if err != nil {
		WriteJSONError(w, "Invalid user ID format", http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	productCollection := db.GetCollection("gridlyapp", "products")

	// Find all products that have status "talks" or "sold" AND belong to this user
	// This logic depends on how you store "buyer" in the product.
	// If you are storing "userID" as the SELLER, you need another field for the buyer.
	// If buyer is not stored, you might rely on the "status" + you being the "buyerId" field.
	// For now, let's assume the "buyerId" field is set once they pay.

	filter := bson.M{
		"buyerId": userID, // or whichever field identifies the buyer
		"status":  bson.M{"$in": []string{"talks", "sold"}},
	}

	cursor, err := productCollection.Find(ctx, filter)
	if err != nil {
		log.Printf("Error fetching orders: %v", err)
		WriteJSONError(w, "Error fetching orders", http.StatusInternalServerError)
		return
	}
	defer cursor.Close(ctx)

	var products []models.Product
	if err := cursor.All(ctx, &products); err != nil {
		log.Printf("Error decoding order products: %v", err)
		WriteJSONError(w, "Error decoding products", http.StatusInternalServerError)
		return
	}

	// If no products are found, we can return an empty array
	if len(products) == 0 {
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode([]interface{}{})
		return
	}

	// Build response
	// You might only need certain fields—customize as needed
	ordersResponse := []map[string]interface{}{}
	for _, product := range products {
		ordersResponse = append(ordersResponse, map[string]interface{}{
			"productId":   product.ID.Hex(),
			"title":       product.Title,
			"price":       product.Price,
			"description": product.Description,
			"status":      product.Status, // "talks" or "sold"
			"images":      product.Images,
		})
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(ordersResponse)
}
