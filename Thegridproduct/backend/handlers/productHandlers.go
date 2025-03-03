// handlers/productshandlers.go

package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"Thegridproduct/backend/db"
	"Thegridproduct/backend/models"

	"github.com/gorilla/mux"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
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
	product.LikeCount = 0

	// **Initialize Workflow-Related Fields**
	product.Status = "inshop"
	product.ChatCount = 0

	// Map frontend availability to stored field
	switch product.Availability {
	case "In Campus":
		product.Availability = "In Campus Only"
	case "Out of Campus":
		product.Availability = "Off Campus Only"
	case "Both":
		product.Availability = "On and Off Campus"
	}

	// Validate required fields
	if product.Title == "" || product.Description == "" || len(product.SelectedTags) == 0 ||
		len(product.Images) == 0 || (product.ListingType != "Renting" && product.Price == 0) {
		WriteJSONError(w, "Missing required fields or invalid input", http.StatusBadRequest)
		return
	}

	// Validate optional rating
	if product.Rating != 0 && (product.Rating < 1 || product.Rating > 5) {
		WriteJSONError(w, "Rating must be between 1 and 5 if provided", http.StatusBadRequest)
		return
	}

	// Additional validation based on ListingType
	switch product.ListingType {
	case "Selling":
	case "Renting":
		if product.Condition == "" {
			WriteJSONError(w, "Condition is required for Renting", http.StatusBadRequest)
			return
		}
		if product.Availability != "In Campus Only" {
			WriteJSONError(w, "Availability must be 'In Campus Only' for Renting", http.StatusBadRequest)
			return
		}
		if product.RentDuration == "" {
			WriteJSONError(w, "Rent Duration is required for Renting", http.StatusBadRequest)
			return
		}
	case "Both":
		if product.Condition == "" {
			WriteJSONError(w, "Condition is required for Both", http.StatusBadRequest)
			return
		}
		if product.Availability != "On and Off Campus" {
			WriteJSONError(w, "Availability must be 'On and Off Campus' for Both", http.StatusBadRequest)
			return
		}
		if product.RentDuration == "" {
			WriteJSONError(w, "Rent Duration is required for Both", http.StatusBadRequest)
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

	// ✅ Increment the user's grids count
	err = IncrementUserGrids(userObjID, studentType)
	if err != nil {
		log.Printf("Failed to increment grids: %v", err)
	}

	// ✅ Fetch the updated user data after incrementing grids
	apiURL := fmt.Sprintf("%s/users/%s", os.Getenv("API_BASE_URL"), userId) // ✅ Use environment variable for API base URL
	req, _ := http.NewRequest("GET", apiURL, nil)
	client := &http.Client{}
	resp, err := client.Do(req)

	var updatedGrids int
	if err != nil {
		log.Printf("Error calling GetUserHandler: %v", err)
	} else {
		defer resp.Body.Close()

		if resp.StatusCode == http.StatusOK {
			var updatedUser models.User
			if err := json.NewDecoder(resp.Body).Decode(&updatedUser); err == nil {
				updatedGrids = updatedUser.Grids
			} else {
				log.Printf("Error decoding GetUserHandler response: %v", err)
			}
		} else if resp.StatusCode == http.StatusNotFound {
			log.Printf("User not found when fetching updated grids")
		} else {
			log.Printf("Unexpected response from GetUserHandler: %d", resp.StatusCode)
		}
	}

	// ✅ Return response with updated grids (if available)
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message": "Product added successfully",
		"id":      result.InsertedID,
		"grids":   updatedGrids, // ✅ If grids update fails, default is 0
	})
}

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

	// Check if the product is expired
	if time.Since(product.PostedDate).Hours() > 90*24 {
		_, err := collection.UpdateOne(ctx, bson.M{"_id": productID}, bson.M{"$set": bson.M{"expired": true}})
		if err != nil {
			log.Printf("Error updating product expiration: %v", err)
		}
		product.Expired = true // Ensure the response reflects the change
	}

	json.NewEncoder(w).Encode(product)
}
func GetAllProductsHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

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

	mode := r.URL.Query().Get("mode")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	collection := db.GetCollection("gridlyapp", "products")

	// ✅ Base filter to fetch products that are not expired and available in shop
	baseFilter := bson.M{
		"status":  bson.M{"$in": []string{"inshop"}},
		"expired": false, // Exclude expired products
		"requestedBy": bson.M{
			"$ne": userObjID, // ✅ Exclude products where the user has already requested
		},
	}

	var filter bson.M
	if mode == "outofcampus" {
		filter = bson.M{
			"$and": []bson.M{
				baseFilter,
				{"userId": bson.M{"$ne": userObjID}},
				{"availability": bson.M{"$in": []string{"Off Campus Only", "On and Off Campus", "In Campus Only"}}},
			},
		}
	} else {
		filter = bson.M{
			"$and": []bson.M{
				baseFilter,
				{"userId": bson.M{"$ne": userObjID}},
				{"university": university},
				{"availability": "In Campus Only"},
			},
		}
	}

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

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(products)
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

	type ProductUpdate struct {
		Title                  string   `json:"title,omitempty"`
		Price                  *float64 `json:"price,omitempty"`
		OutOfCampusPrice       *float64 `json:"outOfCampusPrice,omitempty"`
		RentPrice              *float64 `json:"rentPrice,omitempty"`
		RentDuration           string   `json:"rentDuration,omitempty"`
		Description            string   `json:"description,omitempty"`
		SelectedTags           []string `json:"selectedTags,omitempty"`
		Images                 []string `json:"images,omitempty"`
		IsAvailableOutOfCampus *bool    `json:"isAvailableOutOfCampus,omitempty"`
		Availability           string   `json:"availability,omitempty"`
	}

	var updatedData ProductUpdate
	if err := json.NewDecoder(r.Body).Decode(&updatedData); err != nil {
		log.Printf("Error decoding request body: %v", err)
		WriteJSONError(w, "Invalid input", http.StatusBadRequest)
		return
	}

	//----------------------------------------------------
	// If the request body includes "Availability" in
	// "In Campus", "Out of Campus", or "Both," let's
	// map them to final stored values:
	//----------------------------------------------------
	var mappedAvailability string
	if updatedData.Availability != "" {
		switch updatedData.Availability {
		case "In Campus":
			mappedAvailability = "In Campus Only"
		case "Out of Campus":
			mappedAvailability = "Off Campus Only"
		case "Both":
			mappedAvailability = "On and Off Campus"
		default:
			mappedAvailability = updatedData.Availability // fallback
		}
	}
	//----------------------------------------------------

	// Validate updated fields based on existing ListingType
	switch existingProduct.ListingType {
	case "Selling":
		// No additional fields required
	case "Renting":
		// If they provided a new rentDuration or new rentPrice, check them
		if updatedData.RentDuration == "" && existingProduct.RentDuration == "" {
			WriteJSONError(w, "Rent Duration is required for Renting listing type", http.StatusBadRequest)
			return
		}
		if updatedData.RentPrice == nil && (existingProduct.RentPrice == nil || *existingProduct.RentPrice == 0) {
			WriteJSONError(w, "Rent Price is required for Renting listing type", http.StatusBadRequest)
			return
		}

		// Availability must remain "In Campus Only"
		if mappedAvailability != "" && mappedAvailability != "In Campus Only" {
			WriteJSONError(w, "Availability must be 'In Campus Only' for Renting listing type", http.StatusBadRequest)
			return
		}
	case "Both":
		if updatedData.RentDuration == "" && existingProduct.RentDuration == "" {
			WriteJSONError(w, "Rent Duration is required for Both listing type", http.StatusBadRequest)
			return
		}
		if updatedData.RentPrice == nil && (existingProduct.RentPrice == nil || *existingProduct.RentPrice == 0) {
			WriteJSONError(w, "Rent Price is required for Renting listing type", http.StatusBadRequest)
			return
		}

		// Availability must remain "On and Off Campus"
		if mappedAvailability != "" && mappedAvailability != "On and Off Campus" {
			WriteJSONError(w, "Availability must be 'On and Off Campus' for Both listing type", http.StatusBadRequest)
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
	if updatedData.RentDuration != "" {
		updateFields["rentDuration"] = updatedData.RentDuration
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
	if mappedAvailability != "" {
		updateFields["availability"] = mappedAvailability
	}

	// **Ensure Workflow-Related Fields Cannot Be Updated Here**
	// Prevent updating 'status' and 'chatCount' via this handler
	// They are managed through the chat request workflow

	// Check if there's any field to update
	if len(updateFields) == 0 {
		WriteJSONError(w, "No valid fields to update", http.StatusBadRequest)
		return
	}

	// Perform the update
	update := bson.M{
		"$set": updateFields,
	}

	ctxUpdate, cancelUpdate := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancelUpdate()

	result, err := collection.UpdateOne(ctxUpdate, bson.M{"_id": productID}, update)
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
// Endpoint: GET /products/by-ids?ids=id1,id2,id3
func GetProductsByIDsHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodGet {
		WriteJSONError(w, "Invalid request method", http.StatusMethodNotAllowed)
		return
	}

	idsParam := r.URL.Query().Get("ids")
	if idsParam == "" {
		WriteJSONError(w, "No product IDs provided", http.StatusBadRequest)
		return
	}

	// Split the IDs by comma
	idStrings := strings.Split(idsParam, ",")

	// Convert string IDs to ObjectID
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

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(products)
}

// AddMultipleProductsHandler handles adding multiple products at once
func AddMultipleProductsHandler(w http.ResponseWriter, r *http.Request) {
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

	var products []models.Product
	if err := json.NewDecoder(r.Body).Decode(&products); err != nil {
		log.Printf("Error decoding request body: %v", err)
		WriteJSONError(w, "Invalid input", http.StatusBadRequest)
		return
	}

	// Optional: Limit the batch size
	const MaxBatchSize = 50
	if len(products) > MaxBatchSize {
		WriteJSONError(w, fmt.Sprintf("Cannot add more than %d products at once", MaxBatchSize), http.StatusBadRequest)
		return
	}

	var insertDocs []interface{}
	for i, p := range products {
		// Populate product fields
		p.UserID = userObjID
		p.University = university
		p.StudentType = studentType
		p.PostedDate = time.Now()
		p.Expired = false
		p.Status = "inshop" // Set default status to "inshop"
		p.ChatCount = 0     // Initialize chatCount to 0
		p.LikeCount = 0     // Initialize LikeCount to 0

		// Map availability from "In Campus"/"Out of Campus"/"Both" to final
		switch p.Availability {
		case "In Campus":
			p.Availability = "In Campus Only"
		case "Out of Campus":
			p.Availability = "Off Campus Only"
		case "Both":
			p.Availability = "On and Off Campus"
		}

		// Validate required fields
		if p.Title == "" || p.Price == 0 || p.Description == "" ||
			len(p.SelectedTags) == 0 || len(p.Images) == 0 ||
			p.Rating < 1 || p.Rating > 5 {
			WriteJSONError(w, fmt.Sprintf("Missing required fields or invalid input in product at index %d", i), http.StatusBadRequest)
			return
		}

		// Additional Validation based on ListingType
		switch p.ListingType {
		case "Selling":
			// No additional fields required
		case "Renting":
			if p.Condition == "" {
				WriteJSONError(w, fmt.Sprintf("Condition is required for Renting listing type in product at index %d", i), http.StatusBadRequest)
				return
			}
			if p.Availability != "In Campus Only" {
				WriteJSONError(w, fmt.Sprintf("Availability must be 'In Campus Only' for Renting listing type in product at index %d", i), http.StatusBadRequest)
				return
			}
			if p.RentDuration == "" {
				WriteJSONError(w, fmt.Sprintf("Rent Duration is required for Renting listing type in product at index %d", i), http.StatusBadRequest)
				return
			}
		case "Both":
			if p.Condition == "" {
				WriteJSONError(w, fmt.Sprintf("Condition is required for Both listing type in product at index %d", i), http.StatusBadRequest)
				return
			}
			if p.Availability != "On and Off Campus" {
				WriteJSONError(w, fmt.Sprintf("Availability must be 'On and Off Campus' for Both listing type in product at index %d", i), http.StatusBadRequest)
				return
			}
			if p.RentDuration == "" {
				WriteJSONError(w, fmt.Sprintf("Rent Duration is required for Both listing type in product at index %d", i), http.StatusBadRequest)
				return
			}
		default:
			WriteJSONError(w, fmt.Sprintf("Invalid Listing Type in product at index %d", i), http.StatusBadRequest)
			return
		}

		insertDocs = append(insertDocs, p)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	collection := db.GetCollection("gridlyapp", "products")
	result, err := collection.InsertMany(ctx, insertDocs)
	if err != nil {
		log.Printf("Error inserting products: %v", err)
		WriteJSONError(w, "Error saving products", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message":  "Products added successfully",
		"inserted": result.InsertedIDs,
	})
}

// DeleteProductHandler handles the deletion of a product by its ID
func DeleteProductHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

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

	// Optionally, remove the product from all users' likedProducts arrays
	// to maintain consistency. This can be done using an UpdateMany operation.

	userCollection := db.GetCollection("gridlyapp", "users")
	_, err = userCollection.UpdateMany(
		ctx,
		bson.M{"likedProducts": productID},
		bson.M{"$pull": bson.M{"likedProducts": productID}},
	)
	if err != nil {
		log.Printf("Error removing product from users' likedProducts: %v", err)
		// Not critical, so you might choose not to return an error
	}

	// Respond with a success message
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message": "Product deleted successfully",
		"deleted": deleteResult.DeletedCount,
	})
}

// ConfirmTransferHandler marks a product as "sold"
func ConfirmTransferHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodPost {
		WriteJSONError(w, "Invalid request method", http.StatusMethodNotAllowed)
		return
	}

	// Extract product ID from query
	productID := r.URL.Query().Get("productId")
	if productID == "" {
		WriteJSONError(w, "Product ID is required", http.StatusBadRequest)
		return
	}

	// Convert to ObjectID
	objID, err := primitive.ObjectIDFromHex(productID)
	if err != nil {
		WriteJSONError(w, "Invalid product ID format", http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	collection := db.GetCollection("gridlyapp", "products")

	// Update the product status to "sold"
	update := bson.M{
		"$set": bson.M{
			"status": "sold",
		},
	}
	result, err := collection.UpdateOne(ctx, bson.M{"_id": objID}, update)
	if err != nil {
		log.Printf("Error updating product status: %v", err)
		WriteJSONError(w, "Error updating product status", http.StatusInternalServerError)
		return
	}

	if result.MatchedCount == 0 {
		WriteJSONError(w, "Product not found", http.StatusNotFound)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{
		"message": "Product marked as sold successfully",
	})
}

// LikeProductHandler handles liking a product
func LikeProductHandler(w http.ResponseWriter, r *http.Request) {
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

	vars := mux.Vars(r)
	productID := vars["id"]
	if productID == "" {
		WriteJSONError(w, "Product ID is required", http.StatusBadRequest)
		return
	}

	productObjID, err := primitive.ObjectIDFromHex(productID)
	if err != nil {
		WriteJSONError(w, "Invalid product ID format", http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	session, err := db.MongoDBClient.StartSession()
	if err != nil {
		log.Printf("Error starting MongoDB session: %v", err)
		WriteJSONError(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	defer session.EndSession(ctx)

	callback := func(sc mongo.SessionContext) (interface{}, error) {
		collections := []string{"university_users", "highschool_users"}
		var user models.User
		var userCollection *mongo.Collection
		var foundUser bool

		for _, col := range collections {
			tempCollection := db.GetCollection("gridlyapp", col)
			err := tempCollection.FindOne(sc, bson.M{"_id": userObjID}).Decode(&user)
			if err == nil {
				foundUser = true
				userCollection = tempCollection
				break
			}
			if err != mongo.ErrNoDocuments {
				return nil, fmt.Errorf("error fetching user from %s: %v", col, err)
			}
		}

		if !foundUser {
			return nil, fmt.Errorf("user not found in any collection")
		}

		for _, pid := range user.LikedProducts {
			if pid == productObjID {
				return nil, fmt.Errorf("product already liked")
			}
		}

		updateUser := bson.M{
			"$addToSet": bson.M{
				"likedProducts": productObjID,
			},
		}
		_, err := userCollection.UpdateOne(sc, bson.M{"_id": userObjID}, updateUser)
		if err != nil {
			return nil, fmt.Errorf("error adding product to likedProducts: %v", err)
		}

		productCollection := db.GetCollection("gridlyapp", "products")
		updateProduct := bson.M{
			"$inc": bson.M{
				"likeCount": 1,
			},
		}
		result, err := productCollection.UpdateOne(
			sc,
			bson.M{"_id": productObjID, "status": "inshop"}, // Ensure only 'inshop' products can be liked
			updateProduct,
		)
		if err != nil {
			return nil, fmt.Errorf("error incrementing likeCount: %v", err)
		}
		if result.MatchedCount == 0 {
			return nil, fmt.Errorf("product not found or not in 'inshop' status")
		}

		return nil, nil
	}

	// Execute transaction
	_, err = session.WithTransaction(ctx, callback)
	if err != nil {
		log.Printf("Transaction error: %v", err)
		switch {
		case strings.Contains(err.Error(), "already liked"):
			WriteJSONError(w, "Product already liked", http.StatusBadRequest)
		case strings.Contains(err.Error(), "user not found"):
			WriteJSONError(w, "User not found", http.StatusNotFound)
		case strings.Contains(err.Error(), "product not found"):
			WriteJSONError(w, "Product not found or not in 'inshop' status", http.StatusNotFound)
		default:
			WriteJSONError(w, "Failed to like product", http.StatusInternalServerError)
		}
		return
	}

	json.NewEncoder(w).Encode(map[string]string{"message": "Product liked successfully"})
}

// UnlikeProductHandler handles unliking a product
func UnlikeProductHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	// Ensure the request method is POST
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

	userObjID, err := primitive.ObjectIDFromHex(userId)
	if err != nil {
		WriteJSONError(w, "Invalid user ID format", http.StatusBadRequest)
		return
	}

	// Get product ID from URL
	vars := mux.Vars(r)
	productID := vars["id"]
	if productID == "" {
		WriteJSONError(w, "Product ID is required", http.StatusBadRequest)
		return
	}

	productObjID, err := primitive.ObjectIDFromHex(productID)
	if err != nil {
		WriteJSONError(w, "Invalid product ID format", http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	session, err := db.MongoDBClient.StartSession()
	if err != nil {
		log.Printf("Error starting MongoDB session: %v", err)
		WriteJSONError(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	defer session.EndSession(ctx)

	callback := func(sc mongo.SessionContext) (interface{}, error) {
		collections := []string{"university_users", "highschool_users"}
		var user models.User
		var userCollection *mongo.Collection
		var foundUser bool

		for _, col := range collections {
			tempCollection := db.GetCollection("gridlyapp", col)
			err := tempCollection.FindOne(sc, bson.M{"_id": userObjID}).Decode(&user)
			if err == nil {
				foundUser = true
				userCollection = tempCollection
				break
			}
			if err != mongo.ErrNoDocuments {
				return nil, fmt.Errorf("error fetching user from %s: %v", col, err)
			}
		}

		if !foundUser {
			return nil, fmt.Errorf("user not found in any collection")
		}
		// Check if the product is actually liked
		found := false
		for _, pid := range user.LikedProducts {
			if pid == productObjID {
				found = true
				break
			}
		}
		if !found {
			return nil, fmt.Errorf("product not liked yet")
		}

		// Remove product from user's likedProducts
		updateUser := bson.M{
			"$pull": bson.M{
				"likedProducts": productObjID,
			},
		}
		_, err = userCollection.UpdateOne(sc, bson.M{"_id": userObjID}, updateUser)
		if err != nil {
			return nil, fmt.Errorf("error removing product from likedProducts: %v", err)
		}

		// Decrement product's LikeCount, ensuring it doesn't go below zero
		productCollection := db.GetCollection("gridlyapp", "products")
		updateProduct := bson.M{
			"$inc": bson.M{
				"likeCount": -1,
			},
		}
		// Optionally, ensure LikeCount doesn't go negative
		filter := bson.M{
			"_id":       productObjID,
			"likeCount": bson.M{"$gt": 0},
		}
		result, err := productCollection.UpdateOne(sc, filter, updateProduct)
		if err != nil {
			return nil, fmt.Errorf("error decrementing likeCount: %v", err)
		}
		if result.MatchedCount == 0 {
			return nil, fmt.Errorf("product not found or likeCount already zero")
		}

		return nil, nil
	}

	// Execute transaction
	_, err = session.WithTransaction(ctx, callback)
	if err != nil {
		log.Printf("Transaction error: %v", err)
		switch {
		case strings.Contains(err.Error(), "not liked yet"):
			WriteJSONError(w, "Product not liked yet", http.StatusBadRequest)
		case strings.Contains(err.Error(), "user not found"):
			WriteJSONError(w, "User not found", http.StatusNotFound)
		case strings.Contains(err.Error(), "product not found"):
			WriteJSONError(w, "Product not found or likeCount already zero", http.StatusNotFound)
		default:
			WriteJSONError(w, "Failed to unlike product", http.StatusInternalServerError)
		}
		return
	}

	json.NewEncoder(w).Encode(map[string]string{"message": "Product unliked successfully"})
}

// GetLikedProductsHandler retrieves all liked products for the authenticated user
func GetLikedProductsHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	// Validate request method
	if r.Method != http.MethodGet {
		WriteJSONError(w, "Invalid request method", http.StatusMethodNotAllowed)
		return
	}

	// Get authenticated user ID
	userId, ok := r.Context().Value(userIDKey).(string)
	if !ok || userId == "" {
		WriteJSONError(w, "User not authenticated", http.StatusUnauthorized)
		return
	}

	log.Printf("Authenticated User ID: %s", userId)

	// Convert user ID to ObjectID
	userObjID, err := primitive.ObjectIDFromHex(userId)
	if err != nil {
		log.Printf("Error converting user ID to ObjectID: %v", err)
		WriteJSONError(w, "Invalid user ID format", http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Fetch user document
	collections := []string{"university_users", "highschool_users"}
	var user models.User
	var found bool

	for _, col := range collections {
		collection := db.GetCollection("gridlyapp", col)
		err := collection.FindOne(ctx, bson.M{"_id": userObjID}).Decode(&user)
		if err == nil {
			found = true
			log.Printf("User found in collection: %s", col)
			break
		}
		if err != mongo.ErrNoDocuments {
			log.Printf("Error fetching user from %s: %v", col, err)
			WriteJSONError(w, "Internal server error", http.StatusInternalServerError)
			return
		}
	}

	if !found {
		log.Printf("User not found in any collection")
		WriteJSONError(w, "User not found", http.StatusNotFound)
		return
	}

	// Log the LikedProducts
	log.Printf("User LikedProducts: %+v", user.LikedProducts)

	if len(user.LikedProducts) == 0 {
		log.Println("No liked products to fetch.")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode([]models.Product{})
		return
	}

	// Ensure valid ObjectIDs in likedProducts
	var validLikedProducts []primitive.ObjectID
	for idx, pid := range user.LikedProducts {
		if !pid.IsZero() {
			validLikedProducts = append(validLikedProducts, pid)
			log.Printf("Valid likedProduct ID at index %d: %s", idx, pid.Hex())
		} else {
			log.Printf("Invalid (zero) likedProduct ID at index %d: %v", idx, pid)
		}
	}

	if len(validLikedProducts) == 0 {
		log.Printf("No valid product IDs in likedProducts")
		WriteJSONError(w, "Invalid product IDs in likedProducts", http.StatusInternalServerError)
		return
	}

	// Query products collection
	productCollection := db.GetCollection("gridlyapp", "products")
	filter := bson.M{"_id": bson.M{"$in": validLikedProducts}}

	cursor, err := productCollection.Find(ctx, filter)
	if err != nil {
		log.Printf("Error fetching liked products: %v", err)
		WriteJSONError(w, "Failed to fetch liked products", http.StatusInternalServerError)
		return
	}
	defer cursor.Close(ctx)

	var likedProducts []models.Product
	if err := cursor.All(ctx, &likedProducts); err != nil {
		log.Printf("Error decoding liked products: %v", err)
		WriteJSONError(w, "Failed to decode liked products", http.StatusInternalServerError)
		return
	}

	log.Printf("Retrieved Liked Products: %+v", likedProducts)

	// Respond with liked products
	w.WriteHeader(http.StatusOK)
	if err := json.NewEncoder(w).Encode(likedProducts); err != nil {
		log.Printf("Error encoding liked products to JSON: %v", err)
		WriteJSONError(w, "Error encoding response", http.StatusInternalServerError)
		return
	}
}
