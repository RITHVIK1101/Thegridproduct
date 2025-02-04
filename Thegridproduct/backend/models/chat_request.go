package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// ChatRequest represents a request initiated when a user wants to chat about a product or gig.
type ChatRequest struct {
	ID            primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	ReferenceID   primitive.ObjectID `bson:"referenceId" json:"referenceId"`     // Can be ProductID or GigID
	ReferenceType string             `bson:"referenceType" json:"referenceType"` // "product" or "gig"
	BuyerID       primitive.ObjectID `bson:"buyerId" json:"buyerId"`
	SellerID      primitive.ObjectID `bson:"sellerId" json:"sellerId"`
	Status        string             `bson:"status" json:"status"` // pending, accepted, rejected
	CreatedAt     time.Time          `bson:"createdAt" json:"createdAt"`
}

// Chat request status constants
const (
	ChatRequestStatusPending  = "pending"
	ChatRequestStatusAccepted = "accepted"
	ChatRequestStatusRejected = "rejected"
)

// NewChatRequest creates a new chat request with default values
func NewChatRequest(referenceID primitive.ObjectID, referenceType string, buyerID, sellerID primitive.ObjectID) ChatRequest {
	return ChatRequest{
		ID:            primitive.NewObjectID(),
		ReferenceID:   referenceID,
		ReferenceType: referenceType,
		BuyerID:       buyerID,
		SellerID:      sellerID,
		Status:        ChatRequestStatusPending,
		CreatedAt:     time.Now(),
	}
}
