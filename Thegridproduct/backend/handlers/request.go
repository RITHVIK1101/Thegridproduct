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

// CreateProductRequestHandler handles the creation of a new product request.
func CreateProductRequestHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodPost {
		WriteJSONError(w, "Invalid request method", http.StatusMethodNotAllowed)
		return
	}

	userId, ok := r.Context().Value(userIDKey).(string)
	if !ok || userId == "" {
		WriteJSONError(w, "User not authenticated", http.StatusUnauthorized)
		return
	}

	userObjID, err := primitive.ObjectIDFromHex(userId)
	if err != nil {
		WriteJSONError(w, "Invalid user ID format", http.StatusBadRequest)
		return
	}

	var productRequest models.ProductRequest
	if err := json.NewDecoder(r.Body).Decode(&productRequest); err != nil {
		log.Printf("Error decoding request body: %v", err)
		WriteJSONError(w, "Invalid input", http.StatusBadRequest)
		return
	}

	if productRequest.ProductName == "" || productRequest.Description == "" {
		WriteJSONError(w, "Product name and description are required", http.StatusBadRequest)
		return
	}

	productRequest.UserID = userObjID
	productRequest.CreatedAt = time.Now()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	collection := db.GetCollection("gridlyapp", "product_requests")
	result, err := collection.InsertOne(ctx, productRequest)
	if err != nil {
		log.Printf("Error inserting product request: %v", err)
		WriteJSONError(w, "Error creating product request", http.StatusInternalServerError)
		return
	}

	response := map[string]interface{}{
		"message": "Product request created successfully",
		"id":      result.InsertedID.(primitive.ObjectID).Hex(),
	}
	WriteJSON(w, response, http.StatusCreated)
}

// GetMyProductRequestsHandler retrieves all product requests made by the authenticated user.
func GetMyProductRequestsHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodGet {
		WriteJSONError(w, "Invalid request method", http.StatusMethodNotAllowed)
		return
	}

	userId, ok := r.Context().Value(userIDKey).(string)
	if !ok || userId == "" {
		WriteJSONError(w, "User not authenticated", http.StatusUnauthorized)
		return
	}

	userObjID, err := primitive.ObjectIDFromHex(userId)
	if err != nil {
		WriteJSONError(w, "Invalid user ID format", http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	collection := db.GetCollection("gridlyapp", "product_requests")
	filter := bson.M{"userId": userObjID}

	cursor, err := collection.Find(ctx, filter)
	if err != nil {
		log.Printf("Error fetching product requests: %v", err)
		WriteJSONError(w, "Error fetching product requests", http.StatusInternalServerError)
		return
	}
	defer cursor.Close(ctx)

	var productRequests []models.ProductRequest
	if err := cursor.All(ctx, &productRequests); err != nil {
		log.Printf("Error decoding product requests: %v", err)
		WriteJSONError(w, "Error decoding product requests", http.StatusInternalServerError)
		return
	}

	WriteJSON(w, productRequests, http.StatusOK)
}

// GetAllOtherProductRequestsHandler retrieves all product requests except those made by the authenticated user.
func GetAllOtherProductRequestsHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodGet {
		WriteJSONError(w, "Invalid request method", http.StatusMethodNotAllowed)
		return
	}

	userId, ok := r.Context().Value(userIDKey).(string)
	if !ok || userId == "" {
		WriteJSONError(w, "User not authenticated", http.StatusUnauthorized)
		return
	}

	userObjID, err := primitive.ObjectIDFromHex(userId)
	if err != nil {
		WriteJSONError(w, "Invalid user ID format", http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	collection := db.GetCollection("gridlyapp", "product_requests")
	filter := bson.M{"userId": bson.M{"$ne": userObjID}}

	cursor, err := collection.Find(ctx, filter)
	if err != nil {
		log.Printf("Error fetching product requests: %v", err)
		WriteJSONError(w, "Error fetching product requests", http.StatusInternalServerError)
		return
	}
	defer cursor.Close(ctx)

	var productRequests []models.ProductRequest
	if err := cursor.All(ctx, &productRequests); err != nil {
		log.Printf("Error decoding product requests: %v", err)
		WriteJSONError(w, "Error decoding product requests", http.StatusInternalServerError)
		return
	}

	WriteJSON(w, productRequests, http.StatusOK)
}

// DeleteProductRequestHandler deletes a product request by ID, ensuring only the owner can delete it.
func DeleteProductRequestHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodDelete {
		WriteJSONError(w, "Invalid request method", http.StatusMethodNotAllowed)
		return
	}

	userId, ok := r.Context().Value(userIDKey).(string)
	if !ok || userId == "" {
		WriteJSONError(w, "User not authenticated", http.StatusUnauthorized)
		return
	}

	userObjID, err := primitive.ObjectIDFromHex(userId)
	if err != nil {
		WriteJSONError(w, "Invalid user ID format", http.StatusBadRequest)
		return
	}

	var req struct {
		RequestID string `json:"requestId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		WriteJSONError(w, "Invalid request payload", http.StatusBadRequest)
		return
	}
	if req.RequestID == "" {
		WriteJSONError(w, "Request ID is required", http.StatusBadRequest)
		return
	}

	requestObjID, err := primitive.ObjectIDFromHex(req.RequestID)
	if err != nil {
		WriteJSONError(w, "Invalid request ID format", http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	collection := db.GetCollection("gridlyapp", "product_requests")

	// Check if the request exists and belongs to the user
	var existingRequest models.ProductRequest
	err = collection.FindOne(ctx, bson.M{"_id": requestObjID, "userId": userObjID}).Decode(&existingRequest)
	if err != nil {
		if err.Error() == "mongo: no documents in result" {
			WriteJSONError(w, "Product request not found or unauthorized", http.StatusNotFound)
			return
		}
		log.Printf("Error finding product request: %v", err)
		WriteJSONError(w, "Error finding product request", http.StatusInternalServerError)
		return
	}

	// Delete the request
	_, err = collection.DeleteOne(ctx, bson.M{"_id": requestObjID})
	if err != nil {
		log.Printf("Error deleting product request: %v", err)
		WriteJSONError(w, "Error deleting product request", http.StatusInternalServerError)
		return
	}

	WriteJSON(w, map[string]string{"message": "Product request deleted successfully"}, http.StatusOK)
}
