// models/chat.go

package models

import "time"

// Chat represents a chat document in the database
type Chat struct {
	ID        string    `bson:"_id,omitempty" json:"chatID"`
	ProductID string    `bson:"productId" json:"productID"`
	BuyerID   string    `bson:"buyerId" json:"buyerID"`
	SellerID  string    `bson:"sellerId" json:"sellerID"`
	Messages  []Message `bson:"messages,omitempty" json:"messages"`
	CreatedAt time.Time `bson:"createdAt" json:"createdAt"`
}
