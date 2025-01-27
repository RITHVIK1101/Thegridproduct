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
	// Set response content type to JSON
	w.Header().Set("Content-Type", "application/json")

	// Ensure the request method is POST
	if r.Method != http.MethodPost {
		WriteJSONError(w, "Invalid request method", http.StatusMethodNotAllowed)
		return
	}

	// Retrieve authenticated user ID from context
	userId, ok := r.Context().Value(userIDKey).(string)
	if !ok || userId == "" {
		WriteJSONError(w, "User not authenticated", http.StatusUnauthorized)
		return
	}

	// Convert userId string to primitive.ObjectID
	userObjID, err := primitive.ObjectIDFromHex(userId)
	if err != nil {
		WriteJSONError(w, "Invalid user ID format", http.StatusBadRequest)
		return
	}

	// Decode the request body into ProductRequest
	var productRequest models.ProductRequest
	if err := json.NewDecoder(r.Body).Decode(&productRequest); err != nil {
		log.Printf("Error decoding request body: %v", err)
		WriteJSONError(w, "Invalid input", http.StatusBadRequest)
		return
	}

	// Validate required fields
	if productRequest.ProductName == "" || productRequest.Description == "" {
		WriteJSONError(w, "Product name and description are required", http.StatusBadRequest)
		return
	}

	// Populate additional fields
	productRequest.UserID = userObjID
	productRequest.CreatedAt = time.Now()

	// Insert the product request into MongoDB
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	collection := db.GetCollection("gridlyapp", "product_requests") // Ensure this collection exists
	result, err := collection.InsertOne(ctx, productRequest)
	if err != nil {
		log.Printf("Error inserting product request: %v", err)
		WriteJSONError(w, "Error creating product request", http.StatusInternalServerError)
		return
	}

	// Respond with success message and the inserted ID
	response := map[string]interface{}{
		"message": "Product request created successfully",
		"id":      result.InsertedID.(primitive.ObjectID).Hex(),
	}
	WriteJSON(w, response, http.StatusCreated)
}

// GetMyProductRequestsHandler retrieves all product requests made by the authenticated user.
func GetMyProductRequestsHandler(w http.ResponseWriter, r *http.Request) {
	// Set response content type to JSON
	w.Header().Set("Content-Type", "application/json")

	// Ensure the request method is GET
	if r.Method != http.MethodGet {
		WriteJSONError(w, "Invalid request method", http.StatusMethodNotAllowed)
		return
	}

	// Retrieve authenticated user ID from context
	userId, ok := r.Context().Value(userIDKey).(string)
	if !ok || userId == "" {
		WriteJSONError(w, "User not authenticated", http.StatusUnauthorized)
		return
	}

	// Convert userId string to primitive.ObjectID
	userObjID, err := primitive.ObjectIDFromHex(userId)
	if err != nil {
		WriteJSONError(w, "Invalid user ID format", http.StatusBadRequest)
		return
	}

	// Query MongoDB for product requests made by the user
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
	// Set response content type to JSON
	w.Header().Set("Content-Type", "application/json")

	// Ensure the request method is GET
	if r.Method != http.MethodGet {
		WriteJSONError(w, "Invalid request method", http.StatusMethodNotAllowed)
		return
	}

	// Retrieve authenticated user ID from context
	userId, ok := r.Context().Value(userIDKey).(string)
	if !ok || userId == "" {
		WriteJSONError(w, "User not authenticated", http.StatusUnauthorized)
		return
	}

	// Convert userId string to primitive.ObjectID
	userObjID, err := primitive.ObjectIDFromHex(userId)
	if err != nil {
		WriteJSONError(w, "Invalid user ID format", http.StatusBadRequest)
		return
	}

	// Query MongoDB for product requests not made by the user
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
