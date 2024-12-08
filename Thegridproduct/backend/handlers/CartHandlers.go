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

// UpdateCartStatusRequest represents the payload for updating cart status.
type UpdateCartStatusRequest struct {
	ProductID  primitive.ObjectID `json:"productId" bson:"productId"`
	CartStatus string             `json:"cartStatus" bson:"cartStatus"` // "current" or "bought"
}

// GetCartHandler retrieves all items in the authenticated user's cart with detailed product information.
func GetCartHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

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
			w.WriteHeader(http.StatusOK)
			json.NewEncoder(w).Encode(map[string]interface{}{
				"userId":    userIDStr,
				"items":     []interface{}{},
				"createdAt": time.Now(),
				"updatedAt": time.Now(),
			})
			return
		}
		log.Printf("Error fetching cart: %v", err)
		WriteJSONError(w, "Error fetching cart", http.StatusInternalServerError)
		return
	}

	if len(cart.Items) == 0 {
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"userId":    userIDStr,
			"items":     []interface{}{},
			"createdAt": cart.CreatedAt,
			"updatedAt": cart.UpdatedAt,
		})
		return
	}

	productIDs := make([]primitive.ObjectID, len(cart.Items))
	for i, item := range cart.Items {
		productIDs[i] = item.ProductID
	}

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

	productMap := make(map[primitive.ObjectID]models.Product)
	for _, product := range products {
		productMap[product.ID] = product
	}

	combinedCartProducts := []map[string]interface{}{}

	for _, item := range cart.Items {
		product, exists := productMap[item.ProductID]
		detailedItem := map[string]interface{}{
			"productId":     item.ProductID.Hex(),
			"quantity":      item.Quantity,
			"title":         "Product Not Found",
			"price":         0,
			"description":   "This product is no longer available.",
			"images":        []string{},
			"cartStatus":    item.CartStatus, // "current" or "bought"
			"productStatus": "shop",          // Default, or from product
		}

		if exists {
			detailedItem["title"] = product.Title
			detailedItem["price"] = product.Price
			detailedItem["description"] = product.Description
			detailedItem["images"] = product.Images
			detailedItem["productStatus"] = product.Status
		}

		combinedCartProducts = append(combinedCartProducts, detailedItem)
	}

	// Debugging: Log statuses using a standard for loop
	for _, item := range combinedCartProducts {
		productID, ok1 := item["productId"].(string)
		cartStatus, ok2 := item["cartStatus"].(string)
		productStatus, ok3 := item["productStatus"].(string)
		if ok1 && ok2 && ok3 {
			log.Printf("Product ID: %s, Cart Status: %s, Product Status: %s",
				productID,
				cartStatus,
				productStatus)
		} else {
			log.Printf("Invalid item structure: %+v", item)
		}
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"userId":    userIDStr,
		"items":     combinedCartProducts, // single list
		"createdAt": cart.CreatedAt,
		"updatedAt": cart.UpdatedAt,
	})
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

	// Default quantity to 1 if not provided or invalid
	if req.Quantity <= 0 {
		req.Quantity = 1
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	cartCollection := db.GetCollection("gridlyapp", "carts")

	// Check if the product already exists in the cart
	var existingCart models.Cart
	err = cartCollection.FindOne(ctx, bson.M{"userId": userID, "items.productId": req.ProductID}).Decode(&existingCart)
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
		"$push": bson.M{"items": bson.M{
			"productId":  req.ProductID,
			"quantity":   req.Quantity,
			"cartStatus": models.CartItemStatusCurrent, // Set cartStatus to "current" when adding
		}},
		"$set": bson.M{"updatedAt": time.Now()},
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

// UpdateCartStatusHandler updates the cartStatus of a product in the authenticated user's cart.
func UpdateCartStatusHandler(w http.ResponseWriter, r *http.Request) {
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
	var req UpdateCartStatusRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Printf("Error decoding UpdateCartStatusRequest: %v", err)
		WriteJSONError(w, "Invalid input", http.StatusBadRequest)
		return
	}

	// Validate request
	if req.ProductID.IsZero() {
		WriteJSONError(w, "ProductID is required", http.StatusBadRequest)
		return
	}

	if req.CartStatus != models.CartItemStatusCurrent && req.CartStatus != models.CartItemStatusBought {
		WriteJSONError(w, "Invalid cartStatus value", http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	cartCollection := db.GetCollection("gridlyapp", "carts")

	// Update the cartStatus of the specified product
	filter := bson.M{
		"userId":          userID,
		"items.productId": req.ProductID,
	}
	update := bson.M{
		"$set": bson.M{
			"items.$.cartStatus": req.CartStatus,
			"updatedAt":          time.Now(),
		},
	}

	result, err := cartCollection.UpdateOne(ctx, filter, update)
	if err != nil {
		log.Printf("Error updating cart status: %v", err)
		WriteJSONError(w, "Error updating cart status", http.StatusInternalServerError)
		return
	}

	if result.MatchedCount == 0 {
		WriteJSONError(w, "Product not found in cart", http.StatusNotFound)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{
		"message": "Cart status updated successfully",
	})
}
