// models/chatrequest.go

package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// ChatRequest represents a request initiated when a user wants to chat about a product.
type ChatRequest struct {
	ID        primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	ProductID primitive.ObjectID `bson:"productId" json:"productId"`
	BuyerID   primitive.ObjectID `bson:"buyerId" json:"buyerId"`
	SellerID  primitive.ObjectID `bson:"sellerId" json:"sellerId"`
	Status    string             `bson:"status" json:"status"` // pending, accepted, rejected
	CreatedAt time.Time          `bson:"createdAt" json:"createdAt"`
}

// Chat request status constants
const (
	ChatRequestStatusPending  = "pending"
	ChatRequestStatusAccepted = "accepted"
	ChatRequestStatusRejected = "rejected"
)

// NewChatRequest creates a new chat request with default values
func NewChatRequest(productID, buyerID, sellerID primitive.ObjectID) ChatRequest {
	return ChatRequest{
		ID:        primitive.NewObjectID(),
		ProductID: productID,
		BuyerID:   buyerID,
		SellerID:  sellerID,
		Status:    ChatRequestStatusPending,
		CreatedAt: time.Now(),
	}
}
