package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"time"

	"Thegridproduct/backend/db"
	"Thegridproduct/backend/models"

	"github.com/gorilla/mux"
)

// EnrichedChat represents the enriched chat data sent to the frontend
type EnrichedChat struct {
	ChatID          string `json:"chatID"`
	ProductID       string `json:"productID"`
	ProductTitle    string `json:"productTitle"`
	User            User   `json:"user"`
	LatestMessage   string `json:"latestMessage,omitempty"`
	LatestTimestamp string `json:"latestTimestamp,omitempty"`
}

// User represents a user object in the enriched chat
type User struct {
	FirstName string `json:"firstName"`
	LastName  string `json:"lastName"`
}

// GetChatHandler fetches chat details by product ID
func GetChatHandler(w http.ResponseWriter, r *http.Request) {
	// Extract product ID from request parameters
	vars := mux.Vars(r)
	productID, ok := vars["productId"]
	if !ok || productID == "" {
		WriteJSONError(w, "Product ID is required", http.StatusBadRequest)
		return
	}

	// Fetch the chat from the database
	chat, err := db.GetChatByProductID(productID)
	if err != nil {
		WriteJSONError(w, "Chat not found", http.StatusNotFound)
		return
	}

	// Return the chat details in JSON format
	WriteJSON(w, chat, http.StatusOK)
}

// GetChatsByUserHandler fetches all chats for a specific user
func GetChatsByUserHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	userId := vars["userId"]

	if userId == "" {
		WriteJSONError(w, "User ID is required", http.StatusBadRequest)
		return
	}

	// Call the database function to fetch chats
	chats, err := db.FindChatsByUser(userId)
	if err != nil {
		WriteJSONError(w, "Failed to fetch chats", http.StatusInternalServerError)
		return
	}

	// Enrich chat details with product name and user details
	var enrichedChats []EnrichedChat
	for _, chat := range chats {
		// Fetch product details
		product, err := db.GetProductByID(chat.ProductID)
		if err != nil {
			log.Printf("Failed to fetch product details for productID %s: %v", chat.ProductID, err)
			continue // Skip this chat if product details are missing
		}

		// Determine the other user ID
		otherUserID := chat.BuyerID
		if chat.BuyerID == userId {
			otherUserID = chat.SellerID
		}

		// Fetch the other user's details
		otherUser, err := db.GetUserByID(otherUserID)
		if err != nil {
			log.Printf("Failed to fetch user details for userID %s: %v", otherUserID, err)
			continue // Skip this chat if user details are missing
		}

		// Get the latest message and timestamp
		latestMessage, latestTimestamp := getLatestMessageAndTimestamp(chat.Messages)

		// Prepare enriched chat data
		enrichedChat := EnrichedChat{
			ChatID:       chat.ID,
			ProductID:    product.ID.Hex(), // Convert ObjectID to hex string
			ProductTitle: product.Title,
			User: User{
				FirstName: otherUser.FirstName,
				LastName:  otherUser.LastName,
			},
			LatestMessage:   latestMessage,
			LatestTimestamp: latestTimestamp,
		}

		enrichedChats = append(enrichedChats, enrichedChat)
	}

	// Respond with the enriched chat details
	WriteJSON(w, map[string]interface{}{
		"conversations": enrichedChats,
	}, http.StatusOK)
}

// AddMessageHandler adds a new message to a chat
func AddMessageHandler(w http.ResponseWriter, r *http.Request) {
	// Extract chat ID from URL parameters
	vars := mux.Vars(r)
	chatID, ok := vars["chatId"]
	if !ok || chatID == "" {
		WriteJSONError(w, "Chat ID is required", http.StatusBadRequest)
		return
	}

	// Parse the request body
	var message models.Message
	if err := json.NewDecoder(r.Body).Decode(&message); err != nil {
		WriteJSONError(w, "Invalid request payload", http.StatusBadRequest)
		return
	}

	// Validate message content
	if message.SenderID == "" || message.Content == "" {
		WriteJSONError(w, "Sender ID and content are required", http.StatusBadRequest)
		return
	}

	// Set the timestamp for the message
	message.Timestamp = time.Now()

	// Add the message to the chat
	err := db.AddMessageToChat(chatID, message)
	if err != nil {
		WriteJSONError(w, "Failed to add message to chat", http.StatusInternalServerError)
		return
	}

	// Respond with success
	WriteJSON(w, map[string]string{"message": "Message added successfully"}, http.StatusOK)
}

// GetMessagesHandler fetches all messages for a specific chat
func GetMessagesHandler(w http.ResponseWriter, r *http.Request) {
	// Extract chat ID from URL parameters
	vars := mux.Vars(r)
	chatID, ok := vars["chatId"]
	if !ok || chatID == "" {
		WriteJSONError(w, "Chat ID is required", http.StatusBadRequest)
		return
	}

	// Retrieve chat from the database
	chat, err := db.GetChatByID(chatID)
	if err != nil {
		WriteJSONError(w, "Chat not found", http.StatusNotFound)
		return
	}

	// Respond with the chat messages
	WriteJSON(w, chat.Messages, http.StatusOK)
}

// Helper functions to get the latest message and timestamp
func getLatestMessageAndTimestamp(messages []models.Message) (string, string) {
	if len(messages) == 0 {
		return "", ""
	}
	latestMessage := messages[len(messages)-1].Content
	latestTimestamp := messages[len(messages)-1].Timestamp.Format(time.RFC3339)
	return latestMessage, latestTimestamp
}
