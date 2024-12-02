// models/Message.go

package models

import "time"

// Message represents a single message in a chat
type Message struct {
	SenderID  string    `bson:"senderId" json:"senderId"`
	Content   string    `bson:"content" json:"content"`
	Timestamp time.Time `bson:"timestamp" json:"timestamp"`
}
