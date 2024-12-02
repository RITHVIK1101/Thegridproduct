package models

import "time"

// Chat represents a chat document in the database
type Chat struct {
	ID        string    `bson:"_id,omitempty"`
	ProductID string    `bson:"productId"`
	BuyerID   string    `bson:"buyerId"`
	SellerID  string    `bson:"sellerId"`
	Messages  []Message `bson:"messages,omitempty"`
	CreatedAt time.Time `bson:"createdAt"`
}
