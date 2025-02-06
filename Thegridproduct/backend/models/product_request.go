package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// ProductRequest represents a request made by a user for a product.
type ProductRequest struct {
	ID          primitive.ObjectID   `json:"id,omitempty" bson:"_id,omitempty"`
	UserID      primitive.ObjectID   `json:"userId" bson:"userId"` // The user who made the request
	ProductName string               `json:"productName" bson:"productName"`
	Description string               `json:"description" bson:"description"`
	Institution string               `json:"institution" bson:"institution"`
	CreatedAt   time.Time            `json:"createdAt" bson:"createdAt"`
	RequestedBy []primitive.ObjectID `json:"requestedBy,omitempty" bson:"requestedBy,omitempty"` // ✅ NEW FIELD
}
