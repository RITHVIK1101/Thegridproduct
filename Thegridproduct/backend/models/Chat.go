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

// Message represents a single message in a chat
type Message struct {
	SenderID  string    `bson:"senderId"`
	Content   string    `bson:"content"`
	Timestamp time.Time `bson:"timestamp"`
}
