// handlers/productHandlers.go

package handlers

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"strings"
	"time"

	"Thegridproduct/backend/db"
	"Thegridproduct/backend/models"

	"github.com/gorilla/mux"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

// AddProductHandler adds a new product to the database.
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
	product.Status = models.StatusShop // Use constant for status
	product.Expired = false

	// Validate required fields
	if product.Title == "" || product.Description == "" || len(product.SelectedTags) == 0 ||
		len(product.Images) == 0 || (product.ListingType != models.ListingTypeRenting && (product.Rating < 1 || product.Rating > 5)) ||
		(product.ListingType != models.ListingTypeRenting && product.Price == 0) {
		WriteJSONError(w, "Missing required fields or invalid input", http.StatusBadRequest)
		return
	}

	// Additional Validation based on ListingType
	switch product.ListingType {
	case models.ListingTypeSelling:
		// No additional fields required
	case models.ListingTypeRenting:
		log.Printf("Validating Renting Product: %+v", product)

		if product.Condition == nil || *product.Condition == "" {
			log.Println("Condition is missing")
			WriteJSONError(w, "Condition is required for Renting listing type", http.StatusBadRequest)
			return
		}
		if product.Availability != models.AvailabilityInCampusOnly {
			log.Printf("Invalid Availability: %s", product.Availability)
			WriteJSONError(w, "Availability must be 'In Campus Only' for Renting listing type", http.StatusBadRequest)
			return
		}
		if product.RentDuration == nil || *product.RentDuration == "" {
			log.Println("Rent Duration is missing")
			WriteJSONError(w, "Rent Duration is required for Renting listing type", http.StatusBadRequest)
			return
		}

	case models.ListingTypeBoth:
		if product.Condition == nil || *product.Condition == "" {
			WriteJSONError(w, "Condition is required for Both listing type", http.StatusBadRequest)
			return
		}
		if product.Availability != models.AvailabilityOnAndOffCampus {
			WriteJSONError(w, "Availability must be 'On and Off Campus' for Both listing type", http.StatusBadRequest)
			return
		}
		if product.RentDuration == nil || *product.RentDuration == "" {
			WriteJSONError(w, "Rent Duration is required for Both listing type", http.StatusBadRequest)
			return
		}
	default:
		WriteJSONError(w, "Invalid Listing Type", http.StatusBadRequest)
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

// GetSingleProductHandler fetches a single product by its ID.
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

	// Convert to APIProduct
	apiProduct := models.APIProduct{
		ID:            product.ID.Hex(),
		Title:         product.Title,
		Price:         product.Price,
		UserID:        product.UserID.Hex(),
		Description:   product.Description,
		Category:      getFirstTag(product.SelectedTags),
		Images:        product.Images,
		University:    product.University,
		PostedDate:    product.PostedDate.Format(time.RFC3339),
		ProductStatus: product.Status,
	}

	// Handle optional fields
	if product.RentDuration != nil && *product.RentDuration != "" {
		// If you have logic to include RentDuration in APIProduct, add here
	}
	if product.Rating != 0 {
		apiProduct.Rating = &product.Rating
	}

	json.NewEncoder(w).Encode(apiProduct)
}

// getFirstTag returns the first tag from the slice or "Miscellaneous" if empty.
func getFirstTag(tags []string) string {
	if len(tags) > 0 {
		return tags[0]
	}
	return "Miscellaneous"
}

// GetAllProductsHandler retrieves all products based on the user's mode.
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
		filter = bson.M{
			"userId": bson.M{"$ne": userObjID},
			"status": models.StatusShop, // Use constant for status
		}
	} else {
		filter = bson.M{
			"university": university,
			"userId":     bson.M{"$ne": userObjID},
			"status":     models.StatusShop, // Use constant for status
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

	// Convert to APIProduct
	var apiProducts []models.APIProduct
	for _, product := range products {
		apiProduct := models.APIProduct{
			ID:            product.ID.Hex(),
			Title:         product.Title,
			Price:         product.Price,
			UserID:        product.UserID.Hex(),
			Description:   product.Description,
			Category:      getFirstTag(product.SelectedTags),
			Images:        product.Images,
			University:    product.University,
			PostedDate:    product.PostedDate.Format(time.RFC3339),
			ProductStatus: product.Status,
		}

		// Handle optional fields
		if product.Rating != 0 {
			apiProduct.Rating = &product.Rating
		}

		apiProducts = append(apiProducts, apiProduct)
	}

	log.Println("API Products:", apiProducts)

	// Respond with the list of products
	w.WriteHeader(http.StatusOK)
	if err := json.NewEncoder(w).Encode(apiProducts); err != nil {
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

	// Convert to APIProduct
	var apiProducts []models.APIProduct
	for _, product := range products {
		apiProduct := models.APIProduct{
			ID:            product.ID.Hex(),
			Title:         product.Title,
			Price:         product.Price,
			UserID:        product.UserID.Hex(),
			Description:   product.Description,
			Category:      getFirstTag(product.SelectedTags),
			Images:        product.Images,
			University:    product.University,
			PostedDate:    product.PostedDate.Format(time.RFC3339),
			ProductStatus: product.Status,
		}

		// Handle optional fields
		if product.Rating != 0 {
			apiProduct.Rating = &product.Rating
		}

		apiProducts = append(apiProducts, apiProduct)
	}

	// Respond with the list of products
	w.WriteHeader(http.StatusOK)
	if err := json.NewEncoder(w).Encode(apiProducts); err != nil {
		log.Printf("Error encoding products to JSON: %v", err)
		WriteJSONError(w, "Error encoding response", http.StatusInternalServerError)
		return
	}
}

// UpdateProductHandler handles updating an existing product by ID with authentication.
func UpdateProductHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodPut {
		WriteJSONError(w, "Invalid request method", http.StatusMethodNotAllowed)
		return
	}

	// Authenticate user
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

	// Get product ID from URL
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

	// Fetch existing product
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	collection := db.GetCollection("gridlyapp", "products")
	var existingProduct models.Product
	err = collection.FindOne(ctx, bson.M{"_id": productID}).Decode(&existingProduct)
	if err != nil {
		WriteJSONError(w, "Product not found", http.StatusNotFound)
		return
	}

	// Ensure the authenticated user owns the product
	if existingProduct.UserID != userObjID {
		WriteJSONError(w, "Unauthorized to update this product", http.StatusUnauthorized)
		return
	}

	// Define fields for update
	type ProductUpdate struct {
		Title                  string   `json:"title,omitempty"`
		Price                  *float64 `json:"price,omitempty"`
		OutOfCampusPrice       *float64 `json:"outOfCampusPrice,omitempty"`
		RentPrice              *float64 `json:"rentPrice,omitempty"`
		RentDuration           *string  `json:"rentDuration,omitempty"`
		Description            string   `json:"description,omitempty"`
		SelectedTags           []string `json:"selectedTags,omitempty"`
		Images                 []string `json:"images,omitempty"`
		IsAvailableOutOfCampus *bool    `json:"isAvailableOutOfCampus,omitempty"`
		Status                 string   `json:"status,omitempty"` // New field
	}

	var updatedData ProductUpdate
	if err := json.NewDecoder(r.Body).Decode(&updatedData); err != nil {
		log.Printf("Error decoding request body: %v", err)
		WriteJSONError(w, "Invalid input", http.StatusBadRequest)
		return
	}

	// Validate updated fields based on existing ListingType
	switch existingProduct.ListingType {
	case models.ListingTypeSelling:
		// No additional fields required
	case models.ListingTypeRenting:
		if (updatedData.RentDuration == nil || *updatedData.RentDuration == "") && (existingProduct.RentDuration == nil || *existingProduct.RentDuration == "") {
			WriteJSONError(w, "Rent Duration is required for Renting listing type", http.StatusBadRequest)
			return
		}
		if updatedData.RentPrice == nil && (existingProduct.RentPrice == nil || *existingProduct.RentPrice == 0) {
			WriteJSONError(w, "Rent Price is required for Renting listing type", http.StatusBadRequest)
			return
		}
	case models.ListingTypeBoth:
		if (updatedData.RentDuration == nil || *updatedData.RentDuration == "") && (existingProduct.RentDuration == nil || *existingProduct.RentDuration == "") {
			WriteJSONError(w, "Rent Duration is required for Both listing type", http.StatusBadRequest)
			return
		}
		if updatedData.RentPrice == nil && (existingProduct.RentPrice == nil || *existingProduct.RentPrice == 0) {
			WriteJSONError(w, "Rent Price is required for Both listing type", http.StatusBadRequest)
			return
		}
	default:
		WriteJSONError(w, "Invalid Listing Type", http.StatusBadRequest)
		return
	}

	// Prepare update document with only allowed fields
	updateFields := bson.M{}

	if updatedData.Title != "" {
		updateFields["title"] = updatedData.Title
	}
	if updatedData.Price != nil {
		updateFields["price"] = *updatedData.Price
	}
	if updatedData.OutOfCampusPrice != nil {
		updateFields["outOfCampusPrice"] = *updatedData.OutOfCampusPrice
	}
	if updatedData.RentPrice != nil {
		updateFields["rentPrice"] = *updatedData.RentPrice
	}
	if updatedData.RentDuration != nil && *updatedData.RentDuration != "" {
		updateFields["rentDuration"] = *updatedData.RentDuration
	}
	if updatedData.Description != "" {
		updateFields["description"] = updatedData.Description
	}
	if updatedData.SelectedTags != nil {
		updateFields["selectedTags"] = updatedData.SelectedTags
	}
	if updatedData.Images != nil {
		updateFields["images"] = updatedData.Images
	}
	if updatedData.IsAvailableOutOfCampus != nil {
		updateFields["isAvailableOutOfCampus"] = *updatedData.IsAvailableOutOfCampus
	}
	if updatedData.Status != "" {
		updateFields["status"] = updatedData.Status
	}

	// Check if there's any field to update
	if len(updateFields) == 0 {
		WriteJSONError(w, "No valid fields to update", http.StatusBadRequest)
		return
	}

	// Perform the update
	update := bson.M{
		"$set": updateFields,
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

// GetProductsByIDsHandler retrieves multiple products by their IDs.
// Endpoint: GET /products?ids=id1,id2,id3
func GetProductsByIDsHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	// Ensure the request method is GET
	if r.Method != http.MethodGet {
		WriteJSONError(w, "Invalid request method", http.StatusMethodNotAllowed)
		return
	}

	// Retrieve 'ids' query parameter
	idsParam := r.URL.Query().Get("ids")
	if idsParam == "" {
		WriteJSONError(w, "No product IDs provided", http.StatusBadRequest)
		return
	}

	// Split the IDs by comma
	idStrings := strings.Split(idsParam, ",")

	// Convert string IDs to primitive.ObjectID
	var objectIDs []primitive.ObjectID
	for _, idStr := range idStrings {
		idStr = strings.TrimSpace(idStr)
		objID, err := primitive.ObjectIDFromHex(idStr)
		if err != nil {
			WriteJSONError(w, "Invalid product ID format: "+idStr, http.StatusBadRequest)
			return
		}
		objectIDs = append(objectIDs, objID)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	productCollection := db.GetCollection("gridlyapp", "products")

	// Find all products with _id in objectIDs
	filter := bson.M{"_id": bson.M{"$in": objectIDs}}

	cursor, err := productCollection.Find(ctx, filter)
	if err != nil {
		log.Printf("Error fetching products: %v", err)
		WriteJSONError(w, "Error fetching products", http.StatusInternalServerError)
		return
	}
	defer cursor.Close(ctx)

	var products []models.Product
	if err = cursor.All(ctx, &products); err != nil {
		log.Printf("Error decoding products: %v", err)
		WriteJSONError(w, "Error decoding products", http.StatusInternalServerError)
		return
	}

	// Convert to APIProduct
	var apiProducts []models.APIProduct
	for _, product := range products {
		apiProduct := models.APIProduct{
			ID:            product.ID.Hex(),
			Title:         product.Title,
			Price:         product.Price,
			UserID:        product.UserID.Hex(),
			Description:   product.Description,
			Category:      getFirstTag(product.SelectedTags),
			Images:        product.Images,
			University:    product.University,
			PostedDate:    product.PostedDate.Format(time.RFC3339),
			ProductStatus: product.Status,
		}

		// Handle optional fields
		if product.Rating != 0 {
			apiProduct.Rating = &product.Rating
		}

		apiProducts = append(apiProducts, apiProduct)
	}

	// Respond with the list of products
	w.WriteHeader(http.StatusOK)
	if err := json.NewEncoder(w).Encode(apiProducts); err != nil {
		log.Printf("Error encoding products to JSON: %v", err)
		WriteJSONError(w, "Error encoding response", http.StatusInternalServerError)
		return
	}
}

// DeleteProductHandler handles the deletion of a product by its ID.
func DeleteProductHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	// Ensure the request method is DELETE
	if r.Method != http.MethodDelete {
		WriteJSONError(w, "Invalid request method", http.StatusMethodNotAllowed)
		return
	}

	// Retrieve authenticated user details from context
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

	// Extract product ID from URL parameters
	vars := mux.Vars(r)
	id := vars["id"]

	productID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		WriteJSONError(w, "Invalid product ID format", http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	collection := db.GetCollection("gridlyapp", "products")

	// Fetch the product to verify ownership
	var existingProduct models.Product
	err = collection.FindOne(ctx, bson.M{"_id": productID}).Decode(&existingProduct)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			WriteJSONError(w, "Product not found", http.StatusNotFound)
			return
		}
		log.Printf("Error fetching product: %v", err)
		WriteJSONError(w, "Error fetching product data", http.StatusInternalServerError)
		return
	}

	// Check if the authenticated user is the owner of the product
	if existingProduct.UserID != userObjID {
		WriteJSONError(w, "Unauthorized to delete this product", http.StatusUnauthorized)
		return
	}

	// Proceed to delete the product
	deleteResult, err := collection.DeleteOne(ctx, bson.M{"_id": productID})
	if err != nil {
		log.Printf("Error deleting product: %v", err)
		WriteJSONError(w, "Error deleting product", http.StatusInternalServerError)
		return
	}

	if deleteResult.DeletedCount == 0 {
		WriteJSONError(w, "Product not found or already deleted", http.StatusNotFound)
		return
	}

	// Respond with a success message
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message": "Product deleted successfully",
		"deleted": deleteResult.DeletedCount,
	})
}
