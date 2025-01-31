// handlers/ably.go
package handlers

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"time"

	"Thegridproduct/backend/db"
	"Thegridproduct/backend/models"

	"github.com/ably/ably-go/ably"
	"github.com/google/uuid"
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

func generateMessageID() string {
	return uuid.New().String()
}

func PublishMessageHandler(w http.ResponseWriter, r *http.Request) {
	var msgReq MessageRequest
	if err := json.NewDecoder(r.Body).Decode(&msgReq); err != nil {
		log.Printf("Error decoding request body: %v", err)
		WriteJSONError(w, "Invalid JSON payload", http.StatusBadRequest)
		return
	}

	// Validate required fields
	if msgReq.ChatID == "" || msgReq.SenderID == "" || msgReq.Content == "" {
		log.Println("Validation error: Missing ChatID, SenderID, or Content")
		WriteJSONError(w, "ChatID, SenderID, and Content fields are required", http.StatusBadRequest)
		return
	}

	// Generate unique message ID
	messageID := generateMessageID()
	timestamp := time.Now().UTC()

	// Publish the message to Ably
	channelName := "chat:" + msgReq.ChatID
	channel := ablyClient.Channels.Get(channelName)
	err := channel.Publish(context.Background(), "message", map[string]interface{}{
		"messageId": messageID,
		"chatId":    msgReq.ChatID,
		"senderId":  msgReq.SenderID,
		"content":   msgReq.Content,
		"timestamp": timestamp.Unix(),
	})
	if err != nil {
		log.Printf("Failed to publish message to Ably for chat %s: %v", msgReq.ChatID, err)
		WriteJSONError(w, "Failed to publish message to Ably", http.StatusInternalServerError)
		return
	}

	// Persist the message in MongoDB
	message := models.Message{
		ID:        messageID,
		SenderID:  msgReq.SenderID,
		Content:   msgReq.Content,
		Timestamp: timestamp,
	}

	if err := db.AddMessageToChat(msgReq.ChatID, message); err != nil {
		log.Printf("Failed to save message with ID %s in MongoDB for chat %s: %v", messageID, msgReq.ChatID, err)
		WriteJSONError(w, "Failed to save message in MongoDB", http.StatusInternalServerError)
		return
	}

	log.Printf("Message published and saved successfully: chatID=%s, senderID=%s, messageID=%s", msgReq.ChatID, msgReq.SenderID, messageID)
	WriteJSON(w, map[string]string{"status": "Message published and saved successfully"}, http.StatusOK)
}

// GetAblyClient returns the initialized Ably client
func GetAblyClient() *ably.Realtime {
	if ablyClient == nil {
		log.Fatal("Ably client is not initialized")
	}
	return ablyClient
}
