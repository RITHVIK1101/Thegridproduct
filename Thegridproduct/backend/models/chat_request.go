package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type ChatRequest struct {
	ID        primitive.ObjectID `bson:"_id,omitempty"`
	ProductID string             `bson:"productId"`
	BuyerID   string             `bson:"buyerId"`
	SellerID  string             `bson:"sellerId"`
	Status    string             `bson:"status"` // pending, accepted, rejected
	CreatedAt time.Time          `bson:"createdAt"`
}
