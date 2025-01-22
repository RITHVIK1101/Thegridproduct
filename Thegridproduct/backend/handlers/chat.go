package handlers

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"time"

	"Thegridproduct/backend/db"
	"Thegridproduct/backend/models"

	"github.com/gorilla/mux"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
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
	vars := mux.Vars(r)
	productID, ok := vars["productId"]
	if !ok || productID == "" {
		WriteJSONError(w, "Product ID is required", http.StatusBadRequest)
		return
	}

	chat, err := db.GetChatByProductID(productID)
	if err != nil {
		WriteJSONError(w, "Chat not found", http.StatusNotFound)
		return
	}

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
			continue
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
			continue
		}

		// Get the latest message/timestamp
		latestMessage, latestTimestamp := getLatestMessageAndTimestamp(chat.Messages)

		// Build enriched chat data
		enrichedChat := EnrichedChat{
			ChatID:       chat.ID,
			ProductID:    product.ID.Hex(),
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

	WriteJSON(w, map[string]interface{}{
		"conversations": enrichedChats,
	}, http.StatusOK)
}

// AddMessageHandler adds a new message to a chat
func AddMessageHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	chatID, ok := vars["chatId"]
	if !ok || chatID == "" {
		WriteJSONError(w, "Chat ID is required", http.StatusBadRequest)
		return
	}

	var message models.Message
	if err := json.NewDecoder(r.Body).Decode(&message); err != nil {
		WriteJSONError(w, "Invalid request payload", http.StatusBadRequest)
		return
	}

	if message.SenderID == "" || message.Content == "" {
		WriteJSONError(w, "Sender ID and content are required", http.StatusBadRequest)
		return
	}

	message.Timestamp = time.Now()

	err := db.AddMessageToChat(chatID, message)
	if err != nil {
		WriteJSONError(w, "Failed to add message to chat", http.StatusInternalServerError)
		return
	}

	WriteJSON(w, map[string]string{"message": "Message added successfully"}, http.StatusOK)
}

// GetMessagesHandler fetches all messages for a specific chat
func GetMessagesHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	chatID, ok := vars["chatId"]
	if !ok || chatID == "" {
		WriteJSONError(w, "Chat ID is required", http.StatusBadRequest)
		return
	}

	chat, err := db.GetChatByID(chatID)
	if err != nil {
		WriteJSONError(w, "Chat not found", http.StatusNotFound)
		return
	}

	WriteJSON(w, chat.Messages, http.StatusOK)
}

// RequestChatHandler - when user clicks "Buy" (no payment). Creates a pending chat request.
func RequestChatHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	var req struct {
		ProductID string `json:"productId"`
		BuyerID   string `json:"buyerId"`
		SellerID  string `json:"sellerId"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request payload", http.StatusBadRequest)
		return
	}

	// Validate request fields
	if req.ProductID == "" || req.BuyerID == "" || req.SellerID == "" {
		http.Error(w, "All fields are required", http.StatusBadRequest)
		return
	}

	collection := db.GetCollection("gridlyapp", "chat_requests")

	// Check if a pending request already exists
	existingRequest := models.ChatRequest{}
	err := collection.FindOne(context.TODO(), bson.M{
		"productId": req.ProductID,
		"buyerId":   req.BuyerID,
		"status":    "pending",
	}).Decode(&existingRequest)
	if err == nil {
		http.Error(w, "Chat request already pending", http.StatusConflict)
		return
	}

	// Create the new chat request with "pending" status
	chatRequest := models.ChatRequest{
		ID:        primitive.NewObjectID(),
		ProductID: req.ProductID,
		BuyerID:   req.BuyerID,
		SellerID:  req.SellerID,
		Status:    "pending",
		CreatedAt: time.Now(),
	}

	_, insertErr := collection.InsertOne(context.TODO(), chatRequest)
	if insertErr != nil {
		http.Error(w, "Failed to create chat request", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{
		"message": "Chat request sent successfully",
	})
}

// AcceptChatRequestHandler - seller accepts chat request
func AcceptChatRequestHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	var req struct {
		RequestID string `json:"requestId"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request payload", http.StatusBadRequest)
		return
	}

	collection := db.GetCollection("gridlyapp", "chat_requests")

	objectID, err := primitive.ObjectIDFromHex(req.RequestID)
	if err != nil {
		http.Error(w, "Invalid request ID format", http.StatusBadRequest)
		return
	}

	update := bson.M{"$set": bson.M{"status": "accepted"}}
	_, updateErr := collection.UpdateOne(context.TODO(), bson.M{"_id": objectID}, update)
	if updateErr != nil {
		http.Error(w, "Failed to accept chat request", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{
		"message": "Chat request accepted",
	})
}

// RejectChatRequestHandler - seller rejects chat request
func RejectChatRequestHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	var req struct {
		RequestID string `json:"requestId"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request payload", http.StatusBadRequest)
		return
	}

	collection := db.GetCollection("gridlyapp", "chat_requests")

	objectID, err := primitive.ObjectIDFromHex(req.RequestID)
	if err != nil {
		http.Error(w, "Invalid request ID format", http.StatusBadRequest)
		return
	}

	update := bson.M{"$set": bson.M{"status": "rejected"}}
	_, updateErr := collection.UpdateOne(context.TODO(), bson.M{"_id": objectID}, update)
	if updateErr != nil {
		http.Error(w, "Failed to reject chat request", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{
		"message": "Chat request rejected",
	})
}

// Helper function to retrieve the latest message in a chat
func getLatestMessageAndTimestamp(messages []models.Message) (string, string) {
	if len(messages) == 0 {
		return "", ""
	}
	latestMsg := messages[len(messages)-1].Content
	latestTime := messages[len(messages)-1].Timestamp.Format(time.RFC3339)
	return latestMsg, latestTime
}
