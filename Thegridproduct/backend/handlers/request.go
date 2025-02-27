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

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// 🔥 Fetch the user's institution before saving the request
	userCollection := db.GetCollection("gridlyapp", "university_users")
	var user models.User
	err = userCollection.FindOne(ctx, bson.M{"_id": userObjID}).Decode(&user)

	if err == mongo.ErrNoDocuments {
		userCollection = db.GetCollection("gridlyapp", "highschool_users")
		err = userCollection.FindOne(ctx, bson.M{"_id": userObjID}).Decode(&user)
	}

	// 🚨 If user not found in both collections, return error
	if err != nil {
		log.Printf("Error fetching user details: %v", err)
		WriteJSONError(w, "Error fetching user details", http.StatusInternalServerError)
		return
	}

	// 🚀 Ensure institution is available
	if user.Institution == "" {
		WriteJSONError(w, "User institution information missing", http.StatusBadRequest)
		return
	}

	// Decode incoming product request
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

	// ✅ Assign necessary fields
	productRequest.UserID = userObjID
	productRequest.Institution = user.Institution // Store institution for filtering later
	productRequest.CreatedAt = time.Now()

	// Insert into product_requests collection
	collection := db.GetCollection("gridlyapp", "product_requests")
	result, err := collection.InsertOne(ctx, productRequest)
	if err != nil {
		log.Printf("Error inserting product request: %v", err)
		WriteJSONError(w, "Error creating product request", http.StatusInternalServerError)
		return
	}

	// ✅ Respond with success message
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

	userCollection := db.GetCollection("gridlyapp", "university_users")
	var user models.User
	err = userCollection.FindOne(ctx, bson.M{"_id": userObjID}).Decode(&user)

	if err == mongo.ErrNoDocuments {
		userCollection = db.GetCollection("gridlyapp", "highschool_users")
		err = userCollection.FindOne(ctx, bson.M{"_id": userObjID}).Decode(&user)
	}

	// 🚨 If user not found in both collections, return error
	if err != nil {
		log.Printf("Error fetching user details: %v", err)
		WriteJSONError(w, "Error fetching user details", http.StatusInternalServerError)
		return
	}

	// 🚀 Ensure institution is available
	if user.Institution == "" {
		WriteJSONError(w, "User institution information missing", http.StatusBadRequest)
		return
	}

	// 🔥 Fetch product requests from users in the same institution (excluding the current user and already requested ones)
	productRequestCollection := db.GetCollection("gridlyapp", "product_requests")
	filter := bson.M{
		"userId":      bson.M{"$ne": userObjID}, // Exclude current user
		"institution": user.Institution,         // Match institution
		"requestedBy": bson.M{"$ne": userObjID}, // Exclude if user already requested
	}

	cursor, err := productRequestCollection.Find(ctx, filter)
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

	// ✅ Return only filtered product requests
	WriteJSON(w, productRequests, http.StatusOK)
}

// DeleteProductRequestHandler deletes a product request by ID
func DeleteProductRequestHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodDelete {
		WriteJSONError(w, "Invalid request method", http.StatusMethodNotAllowed)
		return
	}

	// Retrieve authenticated user ID from context
	userID, ok := r.Context().Value(userIDKey).(string)
	if !ok || userID == "" {
		WriteJSONError(w, "User not authenticated", http.StatusUnauthorized)
		return
	}

	userObjID, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		WriteJSONError(w, "Invalid user ID", http.StatusBadRequest)
		return
	}

	// Extract request ID from URL parameters
	vars := mux.Vars(r)
	requestID, exists := vars["id"]
	if !exists || requestID == "" {
		WriteJSONError(w, "Request ID is required", http.StatusBadRequest)
		return
	}

	requestObjID, err := primitive.ObjectIDFromHex(requestID)
	if err != nil {
		WriteJSONError(w, "Invalid request ID format", http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	collection := db.GetCollection("gridlyapp", "product_requests")

	// Check if the product request exists and belongs to the user
	var existingRequest models.ProductRequest
	err = collection.FindOne(ctx, bson.M{"_id": requestObjID}).Decode(&existingRequest)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			WriteJSONError(w, "Product request not found", http.StatusNotFound)
			return
		}
		log.Printf("Error fetching product request: %v", err)
		WriteJSONError(w, "Error fetching product request", http.StatusInternalServerError)
		return
	}

	// Ensure the authenticated user is the owner of the request
	if existingRequest.UserID != userObjID {
		WriteJSONError(w, "Unauthorized to delete this product request", http.StatusUnauthorized)
		return
	}

	// Delete the product request
	deleteResult, err := collection.DeleteOne(ctx, bson.M{"_id": requestObjID})
	if err != nil {
		log.Printf("Error deleting product request: %v", err)
		WriteJSONError(w, "Error deleting product request", http.StatusInternalServerError)
		return
	}

	if deleteResult.DeletedCount == 0 {
		WriteJSONError(w, "Product request not found or already deleted", http.StatusNotFound)
		return
	}

	// Respond with success message
	json.NewEncoder(w).Encode(map[string]string{
		"message": "Product request deleted successfully",
	})
}
