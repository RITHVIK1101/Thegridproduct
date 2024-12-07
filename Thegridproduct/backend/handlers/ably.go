// handlers/ably.go
package handlers

import (
	"Thegridproduct/backend/db"
	"Thegridproduct/backend/models"
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/ably/ably-go/ably"
)

var ablyClient *ably.Realtime

func init() {
	apiKey := os.Getenv("ABLY_API_KEY")
	if apiKey == "" {
		log.Fatal("ABLY_API_KEY is not set in environment variables")
	}

	var err error
	ablyClient, err = ably.NewRealtime(ably.WithKey(apiKey))
	if err != nil {
		log.Fatalf("Failed to create Ably client: %v", err)
	}
	log.Println("Ably client initialized")
}

type MessageRequest struct {
	ChatID   string `json:"chatId"`
	SenderID string `json:"senderId"`
	Content  string `json:"content"`
}

// SetAblyClient sets the Ably client for the handlers package
func SetAblyClient(client *ably.Realtime) {
	ablyClient = client
	log.Println("Ably client set successfully")
}

// PublishMessageHandler publishes a message to a specific chat channel on Ably.
// PublishMessageHandler publishes a message to a specific chat channel on Ably and persists it in MongoDB.
func PublishMessageHandler(w http.ResponseWriter, r *http.Request) {
	var msgReq MessageRequest
	if err := json.NewDecoder(r.Body).Decode(&msgReq); err != nil {
		WriteJSONError(w, "Invalid request payload", http.StatusBadRequest)
		return
	}

	// Validate required fields
	if msgReq.ChatID == "" || msgReq.SenderID == "" || msgReq.Content == "" {
		WriteJSONError(w, "ChatID, SenderID, and Content are required", http.StatusBadRequest)
		return
	}

	// Publish the message to Ably
	channel := ablyClient.Channels.Get(msgReq.ChatID)
	err := channel.Publish(context.Background(), "message", map[string]interface{}{
		"senderId":  msgReq.SenderID,
		"content":   msgReq.Content,
		"timestamp": time.Now().Unix(),
	})
	if err != nil {
		log.Printf("Failed to publish message to chat %s: %v", msgReq.ChatID, err)
		WriteJSONError(w, "Failed to publish message", http.StatusInternalServerError)
		return
	}

	// Persist the message in MongoDB
	message := models.Message{
		SenderID:  msgReq.SenderID,
		Content:   msgReq.Content,
		Timestamp: time.Now(),
	}

	if err := db.AddMessageToChat(msgReq.ChatID, message); err != nil {
		log.Printf("Failed to save message in MongoDB for chat %s: %v", msgReq.ChatID, err)
		WriteJSONError(w, "Failed to save message in MongoDB", http.StatusInternalServerError)
		return
	}

	WriteJSON(w, map[string]string{"status": "Message published and saved successfully"}, http.StatusOK)
}

// GetAblyClient returns the initialized Ably client
func GetAblyClient() *ably.Realtime {
	if ablyClient == nil {
		log.Fatal("Ably client is not initialized")
	}
	return ablyClient
}
