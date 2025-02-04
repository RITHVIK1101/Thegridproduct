// models/chat.go

package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// Chat represents a chat document in the database
type Chat struct {
	ID            primitive.ObjectID `bson:"_id,omitempty" json:"chatID"`
	ReferenceID   primitive.ObjectID `bson:"referenceId" json:"referenceID"`     // Can be ProductID or GigID
	ReferenceType string             `bson:"referenceType" json:"referenceType"` // "product" or "gig"
	BuyerID       primitive.ObjectID `bson:"buyerId" json:"buyerID"`
	SellerID      primitive.ObjectID `bson:"sellerId" json:"sellerID"`
	Messages      []Message          `bson:"messages,omitempty" json:"messages"`
	Status        string             `bson:"status" json:"status"` // pending, active, closed
	CreatedAt     time.Time          `bson:"createdAt" json:"createdAt"`
	LastUpdated   time.Time          `bson:"lastUpdated" json:"lastUpdated"`
}

// ChatStatus constants to avoid hardcoded strings
const (
	ChatStatusPending = "pending"
	ChatStatusActive  = "active"
	ChatStatusClosed  = "closed"
)

// NewChat creates a chat object for either a product or a gig
func NewChat(referenceID primitive.ObjectID, referenceType string, buyerID, sellerID primitive.ObjectID) *Chat {
	return &Chat{
		ID:            primitive.NewObjectID(),
		ReferenceID:   referenceID,
		ReferenceType: referenceType, // Either "product" or "gig"
		BuyerID:       buyerID,
		SellerID:      sellerID,
		Messages:      []Message{},
		Status:        ChatStatusPending,
		CreatedAt:     time.Now(),
		LastUpdated:   time.Now(),
	}
}
