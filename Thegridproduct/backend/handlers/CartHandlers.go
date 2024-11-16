// handlers/cartHandlers.go

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
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// AddToCartRequest represents the payload for adding a product to the cart.
type AddToCartRequest struct {
	ProductID primitive.ObjectID `json:"productId" bson:"productId"`
	Quantity  int                `json:"quantity" bson:"quantity"` // Optional: Default to 1 if not provided
}

// RemoveFromCartRequest represents the payload for removing a product from the cart.
type RemoveFromCartRequest struct {
	ProductID primitive.ObjectID `json:"productId" bson:"productId"`
}

// GetCartHandler retrieves all items in the authenticated user's cart with detailed product information.
func GetCartHandler(w http.ResponseWriter, r *http.Request) {
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

	cartCollection := db.GetCollection("gridlyapp", "carts")
	productCollection := db.GetCollection("gridlyapp", "products")

	var cart models.Cart
	err = cartCollection.FindOne(ctx, bson.M{"userId": userID}).Decode(&cart)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			// Cart doesn't exist; return empty cart
			emptyCartResponse := map[string]interface{}{
				"userId":    userIDStr,
				"items":     []interface{}{},
				"createdAt": time.Now(),
				"updatedAt": time.Now(),
			}
			w.WriteHeader(http.StatusOK)
			json.NewEncoder(w).Encode(emptyCartResponse)
			return
		}
		log.Printf("Error fetching cart: %v", err)
		WriteJSONError(w, "Error fetching cart", http.StatusInternalServerError)
		return
	}

	if len(cart.Items) == 0 {
		// Cart exists but has no items
		emptyCartResponse := map[string]interface{}{
			"userId":    userIDStr,
			"items":     []interface{}{},
			"createdAt": cart.CreatedAt,
			"updatedAt": cart.UpdatedAt,
		}
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(emptyCartResponse)
		return
	}

	// Extract product IDs from cart items
	productIDs := make([]primitive.ObjectID, len(cart.Items))
	for i, item := range cart.Items {
		productIDs[i] = item.ProductID
	}

	// Fetch product details for the products in the cart
	cursor, err := productCollection.Find(ctx, bson.M{"_id": bson.M{"$in": productIDs}})
	if err != nil {
		log.Printf("Error fetching products for cart: %v", err)
		WriteJSONError(w, "Error fetching products for cart", http.StatusInternalServerError)
		return
	}
	defer cursor.Close(ctx)

	var products []models.Product
	if err := cursor.All(ctx, &products); err != nil {
		log.Printf("Error decoding product details: %v", err)
		WriteJSONError(w, "Error decoding product details", http.StatusInternalServerError)
		return
	}

	// Map products by their ID for quick lookup
	productMap := make(map[primitive.ObjectID]models.Product)
	for _, product := range products {
		productMap[product.ID] = product
	}

	// Combine cart items with their corresponding product details
	detailedCartItems := []map[string]interface{}{}
	for _, item := range cart.Items {
		product, exists := productMap[item.ProductID]
		if exists {
			detailedItem := map[string]interface{}{
				"productId":   item.ProductID.Hex(),
				"quantity":    item.Quantity,
				"title":       product.Title,
				"price":       product.Price,
				"description": product.Description,
				"images":      product.Images,
				// Add other product fields as needed
			}
			detailedCartItems = append(detailedCartItems, detailedItem)
		} else {
			// Handle case where product no longer exists
			detailedItem := map[string]interface{}{
				"productId":   item.ProductID.Hex(),
				"quantity":    item.Quantity,
				"title":       "Product Not Found",
				"price":       0,
				"description": "This product is no longer available.",
				"images":      []string{},
			}
			detailedCartItems = append(detailedCartItems, detailedItem)
		}
	}

	// Prepare the final response
	cartResponse := map[string]interface{}{
		"userId":    userIDStr,
		"items":     detailedCartItems,
		"createdAt": cart.CreatedAt,
		"updatedAt": cart.UpdatedAt,
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(cartResponse)
}

// AddToCartHandler adds a product to the authenticated user's cart.
func AddToCartHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodPost {
		WriteJSONError(w, "Invalid request method", http.StatusMethodNotAllowed)
		return
	}

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

	var req AddToCartRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Printf("Error decoding AddToCartRequest: %v", err)
		WriteJSONError(w, "Invalid input", http.StatusBadRequest)
		return
	}

	if req.ProductID.IsZero() {
		WriteJSONError(w, "ProductID is required", http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	cartCollection := db.GetCollection("gridlyapp", "carts")

	// Check if the product already exists in the cart
	var cart models.Cart
	err = cartCollection.FindOne(ctx, bson.M{"userId": userID, "items.productId": req.ProductID}).Decode(&cart)
	if err == nil {
		WriteJSONError(w, "Product already in cart", http.StatusConflict)
		return
	} else if err != mongo.ErrNoDocuments {
		log.Printf("Error checking cart: %v", err)
		WriteJSONError(w, "Error checking cart", http.StatusInternalServerError)
		return
	}

	// Add the product if it doesn't already exist
	filter := bson.M{"userId": userID}
	update := bson.M{
		"$push": bson.M{"items": bson.M{"productId": req.ProductID, "quantity": req.Quantity}},
		"$set":  bson.M{"updatedAt": time.Now()},
	}

	_, err = cartCollection.UpdateOne(ctx, filter, update, options.Update().SetUpsert(true))
	if err != nil {
		log.Printf("Error adding product to cart: %v", err)
		WriteJSONError(w, "Error adding product to cart", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{
		"message": "Product added to cart successfully",
	})
}

// RemoveFromCartHandler removes a product from the authenticated user's cart.
func RemoveFromCartHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	// Ensure the request method is POST
	if r.Method != http.MethodPost {
		WriteJSONError(w, "Invalid request method", http.StatusMethodNotAllowed)
		return
	}

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

	// Decode request body
	var req RemoveFromCartRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Printf("Error decoding RemoveFromCartRequest: %v", err)
		WriteJSONError(w, "Invalid input", http.StatusBadRequest)
		return
	}

	// Validate request
	if req.ProductID.IsZero() {
		WriteJSONError(w, "ProductID is required", http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	cartCollection := db.GetCollection("gridlyapp", "carts")

	// Pull the product from the cart items
	filter := bson.M{"userId": userID}
	update := bson.M{
		"$pull": bson.M{"items": bson.M{"productId": req.ProductID}},
		"$set":  bson.M{"updatedAt": time.Now()},
	}

	result, err := cartCollection.UpdateOne(ctx, filter, update)
	if err != nil {
		log.Printf("Error removing product from cart: %v", err)
		WriteJSONError(w, "Error removing product from cart", http.StatusInternalServerError)
		return
	}

	if result.MatchedCount == 0 {
		WriteJSONError(w, "Cart not found", http.StatusNotFound)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{
		"message": "Product removed from cart successfully",
	})
}

// ClearCartHandler clears all items from the authenticated user's cart.
func ClearCartHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	// Ensure the request method is POST
	if r.Method != http.MethodPost {
		WriteJSONError(w, "Invalid request method", http.StatusMethodNotAllowed)
		return
	}

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

	cartCollection := db.GetCollection("gridlyapp", "carts")

	// Set the items array to empty
	filter := bson.M{"userId": userID}
	update := bson.M{
		"$set": bson.M{
			"items":     []models.CartItem{},
			"updatedAt": time.Now(),
		},
	}

	result, err := cartCollection.UpdateOne(ctx, filter, update)
	if err != nil {
		log.Printf("Error clearing cart: %v", err)
		WriteJSONError(w, "Error clearing cart", http.StatusInternalServerError)
		return
	}

	if result.MatchedCount == 0 {
		WriteJSONError(w, "Cart not found", http.StatusNotFound)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{
		"message": "Cart cleared successfully",
	})
}
