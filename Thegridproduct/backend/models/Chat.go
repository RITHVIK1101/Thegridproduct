// models/chat.go

package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// Chat represents a chat document in the database
type Chat struct {
	ID          primitive.ObjectID `bson:"_id,omitempty" json:"chatID"`
	ProductID   primitive.ObjectID `bson:"productId" json:"productID"`
	BuyerID     primitive.ObjectID `bson:"buyerId" json:"buyerID"`
	SellerID    primitive.ObjectID `bson:"sellerId" json:"sellerID"`
	Messages    []Message          `bson:"messages,omitempty" json:"messages"`
	Status      string             `bson:"status" json:"status"` // pending, active, closed
	CreatedAt   time.Time          `bson:"createdAt" json:"createdAt"`
	LastUpdated time.Time          `bson:"lastUpdated" json:"lastUpdated"`
}

// ChatStatus constants to avoid hardcoded strings
const (
	ChatStatusPending = "pending"
	ChatStatusActive  = "active"
	ChatStatusClosed  = "closed"
)

// Change this function signature
func NewChat(productID, buyerID, sellerID primitive.ObjectID) *Chat {
	return &Chat{ // Return a pointer instead of a value
		ID:        primitive.NewObjectID(),
		ProductID: productID,
		BuyerID:   buyerID,
		SellerID:  sellerID,
		Messages:  []Message{}, // Assuming you have a messages field
		CreatedAt: time.Now(),
	}
}
