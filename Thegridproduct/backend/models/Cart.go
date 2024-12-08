// models/cart.go

package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// Constants for CartItem statuses
const (
	CartItemStatusCurrent = "current"
	CartItemStatusBought  = "bought"
)

// CartItem represents an item in the shopping cart.
type CartItem struct {
	ProductID  primitive.ObjectID `json:"productId" bson:"productId"`
	Quantity   int                `json:"quantity" bson:"quantity"`
	CartStatus string             `json:"cartStatus" bson:"cartStatus"` // "current" or "bought"
}

// Cart represents a user's shopping cart.
type Cart struct {
	ID        primitive.ObjectID `json:"id,omitempty" bson:"_id,omitempty"`
	UserID    primitive.ObjectID `json:"userId" bson:"userId"`
	Items     []CartItem         `json:"items" bson:"items"`
	CreatedAt time.Time          `json:"createdAt" bson:"createdAt"`
	UpdatedAt time.Time          `json:"updatedAt" bson:"updatedAt"`
}

// Helper Functions

// NewCartItem creates a new CartItem with default status.
func NewCartItem(productID primitive.ObjectID, quantity int) CartItem {
	if quantity <= 0 {
		quantity = 1 // Default quantity to 1 if invalid
	}
	return CartItem{
		ProductID:  productID,
		Quantity:   quantity,
		CartStatus: CartItemStatusCurrent, // Default status to "current"
	}
}

// UpdateCartItemStatus updates the status of a CartItem.
func UpdateCartItemStatus(item *CartItem, status string) {
	if status == CartItemStatusCurrent || status == CartItemStatusBought {
		item.CartStatus = status
	}
}
