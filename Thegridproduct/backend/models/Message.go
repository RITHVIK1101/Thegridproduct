// models/Message.go

package models

import "time"

// Message represents a single message within a chat
type Message struct {
	ID        string    `bson:"_id,omitempty" json:"_id"`
	Sender    string    `bson:"sender" json:"sender"` // "user" or "other"
	SenderID  string    `bson:"senderId" json:"senderID"`
	Content   string    `bson:"content" json:"content"`
	Timestamp time.Time `bson:"timestamp" json:"timestamp"`
	ChatID    string    `bson:"chatId,omitempty" json:"chatID,omitempty"` // Optional, for WebSocket
}
