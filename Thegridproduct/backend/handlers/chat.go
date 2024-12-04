// handlers/chat.go

package handlers

import (
	"encoding/json"
	"net/http"
	"time"

	"Thegridproduct/backend/db"
	"Thegridproduct/backend/models"

	"github.com/gorilla/mux"
)

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

	// Respond with the list of chats
	WriteJSON(w, map[string]interface{}{
		"conversations": chats,
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
