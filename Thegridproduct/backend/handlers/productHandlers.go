// handlers/productHandlers.go

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
)

func AddProductHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodPost {
		WriteJSONError(w, "Invalid request method", http.StatusMethodNotAllowed)
		return
	}

	// Retrieve authenticated user details from context
	userId, ok := r.Context().Value(userIDKey).(string)
	if !ok || userId == "" {
		WriteJSONError(w, "User not authenticated", http.StatusUnauthorized)
		return
	}

	university, ok := r.Context().Value(userInstitution).(string)
	if !ok || university == "" {
		WriteJSONError(w, "User university information missing", http.StatusUnauthorized)
		return
	}

	studentType, ok := r.Context().Value(userStudentType).(string)
	if !ok || studentType == "" {
		WriteJSONError(w, "User student type information missing", http.StatusUnauthorized)
		return
	}

	userObjID, err := primitive.ObjectIDFromHex(userId)
	if err != nil {
		WriteJSONError(w, "Invalid user ID", http.StatusBadRequest)
		return
	}

	var product models.Product
	if err := json.NewDecoder(r.Body).Decode(&product); err != nil {
		log.Printf("Error decoding request body: %v", err)
		WriteJSONError(w, "Invalid input", http.StatusBadRequest)
		return
	}

	// Populate product fields
	product.UserID = userObjID
	product.University = university
	product.StudentType = studentType
	product.PostedDate = time.Now()
	product.Expired = false

	// Validate required fields
	if product.Title == "" || product.Price == 0 || product.Description == "" ||
		len(product.SelectedTags) == 0 || len(product.Images) == 0 || product.Rating < 1 || product.Rating > 5 {
		WriteJSONError(w, "Missing required fields or invalid input", http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	collection := db.GetCollection("gridlyapp", "products")
	result, err := collection.InsertOne(ctx, product)
	if err != nil {
		log.Printf("Error inserting product: %v", err)
		WriteJSONError(w, "Error saving product", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message": "Product added successfully",
		"id":      result.InsertedID,
	})
}

// GetSingleProductHandler handles fetching a single product by its ID
func GetSingleProductHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodGet {
		WriteJSONError(w, "Invalid request method", http.StatusMethodNotAllowed)
		return
	}

	vars := mux.Vars(r)
	id := vars["id"]

	productID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		WriteJSONError(w, "Invalid product ID format", http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	collection := db.GetCollection("gridlyapp", "products")
	var product models.Product
	err = collection.FindOne(ctx, bson.M{"_id": productID}).Decode(&product)
	if err != nil {
		log.Printf("Error fetching product: %v", err)
		WriteJSONError(w, "Product not found", http.StatusNotFound)
		return
	}

	json.NewEncoder(w).Encode(product)
}

func GetAllProductsHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	// Validate the request method
	if r.Method != http.MethodGet {
		WriteJSONError(w, "Invalid request method", http.StatusMethodNotAllowed)
		return
	}

	// Retrieve authenticated user details from context
	userId, ok := r.Context().Value(userIDKey).(string)
	if !ok || userId == "" {
		WriteJSONError(w, "User not authenticated", http.StatusUnauthorized)
		return
	}

	university, ok := r.Context().Value(userInstitution).(string)
	if !ok || university == "" {
		WriteJSONError(w, "User university information missing", http.StatusUnauthorized)
		return
	}

	userObjID, err := primitive.ObjectIDFromHex(userId)
	if err != nil {
		WriteJSONError(w, "Invalid user ID", http.StatusBadRequest)
		return
	}

	// Parse the 'mode' query parameter to determine if the user is in 'out of campus' mode
	mode := r.URL.Query().Get("mode")
	log.Println("Mode:", mode)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	collection := db.GetCollection("gridlyapp", "products")

	var filter bson.M

	if mode == "outofcampus" || mode == "out" {
		// Out-of-campus mode: Fetch all products except user's own
		filter = bson.M{
			"userId": bson.M{"$ne": userObjID},
		}
	} else {
		// In-campus mode (default): Fetch products from the same university, excluding user's own
		filter = bson.M{
			"university": university,
			"userId":     bson.M{"$ne": userObjID},
		}
	}

	log.Println("Filter Criteria:", filter)

	cursor, err := collection.Find(ctx, filter)
	if err != nil {
		log.Println("Error fetching products:", err)
		WriteJSONError(w, "Error fetching products", http.StatusInternalServerError)
		return
	}
	defer cursor.Close(ctx)

	var products []models.Product
	if err := cursor.All(ctx, &products); err != nil {
		log.Println("Error decoding products:", err)
		WriteJSONError(w, "Error decoding products", http.StatusInternalServerError)
		return
	}

	log.Println("Retrieved Products:", products)

	// Respond with the list of products
	w.WriteHeader(http.StatusOK)
	if err := json.NewEncoder(w).Encode(products); err != nil {
		log.Printf("Error encoding products to JSON: %v", err)
		WriteJSONError(w, "Error encoding response", http.StatusInternalServerError)
		return
	}
}

// GetUserProductsHandler retrieves all products added by the authenticated user.
func GetUserProductsHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	// Retrieve authenticated user ID from context
	userId, ok := r.Context().Value(userIDKey).(string)
	if !ok || userId == "" {
		WriteJSONError(w, "User not authenticated", http.StatusUnauthorized)
		return
	}

	userObjID, err := primitive.ObjectIDFromHex(userId)
	if err != nil {
		WriteJSONError(w, "Invalid user ID", http.StatusBadRequest)
		return
	}

	// Set up context with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	collection := db.GetCollection("gridlyapp", "products")

	// Find products where UserID matches the authenticated user's ID
	cursor, err := collection.Find(ctx, bson.M{"userId": userObjID})
	if err != nil {
		log.Printf("Error retrieving products: %v", err)
		WriteJSONError(w, "Error retrieving products", http.StatusInternalServerError)
		return
	}
	defer cursor.Close(ctx)

	var products []models.Product
	if err = cursor.All(ctx, &products); err != nil {
		log.Printf("Error decoding products: %v", err)
		WriteJSONError(w, "Error decoding products", http.StatusInternalServerError)
		return
	}

	// Respond with the list of products
	w.WriteHeader(http.StatusOK)
	if err := json.NewEncoder(w).Encode(products); err != nil {
		log.Printf("Error encoding products to JSON: %v", err)
		WriteJSONError(w, "Error encoding response", http.StatusInternalServerError)
		return
	}
}

// UpdateProductHandler handles updating an existing product by ID with authentication
func UpdateProductHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodPut {
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

	vars := mux.Vars(r)
	id, exists := vars["id"]
	if !exists || id == "" {
		WriteJSONError(w, "Product ID is required", http.StatusBadRequest)
		return
	}

	productID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		WriteJSONError(w, "Invalid product ID format", http.StatusBadRequest)
		return
	}

	var updatedProduct models.Product
	if err := json.NewDecoder(r.Body).Decode(&updatedProduct); err != nil {
		log.Printf("Error decoding request body: %v", err)
		WriteJSONError(w, "Invalid input", http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	collection := db.GetCollection("gridlyapp", "products")
	var existingProduct models.Product
	err = collection.FindOne(ctx, bson.M{"_id": productID}).Decode(&existingProduct)
	if err != nil {
		WriteJSONError(w, "Product not found", http.StatusNotFound)
		return
	}

	if existingProduct.UserID != userObjID {
		WriteJSONError(w, "Unauthorized to update this product", http.StatusUnauthorized)
		return
	}

	update := bson.M{
		"$set": bson.M{
			"title":                  updatedProduct.Title,
			"price":                  updatedProduct.Price,
			"description":            updatedProduct.Description,
			"selectedTags":           updatedProduct.SelectedTags,
			"images":                 updatedProduct.Images,
			"isAvailableOutOfCampus": updatedProduct.IsAvailableOutOfCampus,
			"rating":                 updatedProduct.Rating,
			"listingType":            updatedProduct.ListingType,
			"availability":           updatedProduct.Availability,
			"rentDuration":           updatedProduct.RentDuration,
			"rentPrice":              updatedProduct.RentPrice,
			"outOfCampusPrice":       updatedProduct.OutOfCampusPrice,
		},
	}

	result, err := collection.UpdateOne(ctx, bson.M{"_id": productID}, update)
	if err != nil {
		log.Printf("Error updating product: %v", err)
		WriteJSONError(w, "Error updating product", http.StatusInternalServerError)
		return
	}

	if result.MatchedCount == 0 {
		WriteJSONError(w, "Product not found", http.StatusNotFound)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message": "Product updated successfully",
	})
}
