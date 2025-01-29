// handlers/chat.go

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
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type EnrichedChat struct {
	ChatID          string `json:"chatID"`                    // Fixed syntax
	ProductID       string `json:"productID"`                 // Fixed syntax
	ProductTitle    string `json:"productTitle"`              // Fixed syntax
	User            User   `json:"user"`                      // Fixed syntax
	LatestMessage   string `json:"latestMessage,omitempty"`   // Fixed syntax
	LatestTimestamp string `json:"latestTimestamp,omitempty"` // Fixed syntax
}
type User struct {
	FirstName string `json:"firstName"` // Fixed syntax
	LastName  string `json:"lastName"`  // Fixed syntax
}

// AppError defines a custom application error with a message and HTTP status code
type AppError struct {
	Message    string
	StatusCode int
}

func (e *AppError) Error() string {
	return e.Message
}

// GetChatHandler fetches chat details by product ID (string-based)
func GetChatHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	productIDStr, ok := vars["productId"]
	if !ok || productIDStr == "" {
		WriteJSONError(w, "Product ID is required", http.StatusBadRequest)
		return
	}

	// No need to convert productIDStr to ObjectID here
	// Fetch chat by productID string
	chat, err := db.GetChatByProductID(productIDStr)
	if err != nil {
		WriteJSONError(w, "Chat not found", http.StatusNotFound)
		return
	}

	WriteJSON(w, chat, http.StatusOK)
}

// GetChatsByUserHandler fetches all chats for a specific user (string-based)
func GetChatsByUserHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	userIDStr := vars["userId"]
	if userIDStr == "" {
		WriteJSONError(w, "User ID is required", http.StatusBadRequest)
		return
	}

	// No need to convert userIDStr to ObjectID here
	// Fetch chats by userID string
	chats, err := db.FindChatsByUser(userIDStr)
	if err != nil {
		WriteJSONError(w, "Failed to fetch chats", http.StatusInternalServerError)
		return
	}

	// Enrich chat details with product name and other user details
	var enrichedChats []EnrichedChat
	for _, c := range chats {
		// Fetch product details
		product, err := db.GetProductByID(c.ProductID.Hex())
		if err != nil {
			log.Printf("Failed to fetch product details for productID %s: %v", c.ProductID.Hex(), err)
			continue
		}

		// Determine the other user ID
		var otherUserID primitive.ObjectID
		if c.BuyerID.Hex() == userIDStr {
			otherUserID = c.SellerID
		} else {
			otherUserID = c.BuyerID
		}

		// Fetch the other user's details
		otherUser, err := db.GetUserByID(otherUserID.Hex())
		if err != nil {
			log.Printf("Failed to fetch user details for userID %s: %v", otherUserID.Hex(), err)
			continue
		}

		// Get the latest message and timestamp
		latestMessage, latestTimestamp := getLatestMessageAndTimestamp(c.Messages)

		// Build enriched chat data
		enrichedChat := EnrichedChat{
			ChatID:          c.ID.Hex(),
			ProductID:       c.ProductID.Hex(),
			ProductTitle:    product.Title,
			User:            User{FirstName: otherUser.FirstName, LastName: otherUser.LastName},
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
	chatIDStr, ok := vars["chatId"]
	if !ok || chatIDStr == "" {
		WriteJSONError(w, "Chat ID is required", http.StatusBadRequest)
		return
	}

	// No need to convert chatIDStr to ObjectID here
	// Use chatIDStr directly
	// Fetch chat to ensure it exists
	_, err := db.GetChatByID(chatIDStr)
	if err != nil {
		WriteJSONError(w, "Chat not found", http.StatusNotFound)
		return
	}

	var message models.Message
	if err := json.NewDecoder(r.Body).Decode(&message); err != nil {
		WriteJSONError(w, "Invalid request payload", http.StatusBadRequest)
		return
	}

	// Adjust the comparison since message.SenderID is a string
	if message.SenderID == "" || message.Content == "" {
		WriteJSONError(w, "Sender ID and content are required", http.StatusBadRequest)
		return
	}

	message.Timestamp = time.Now()

	// Add message to chat
	err = db.AddMessageToChat(chatIDStr, message)
	if err != nil {
		WriteJSONError(w, "Failed to add message to chat", http.StatusInternalServerError)
		return
	}

	WriteJSON(w, map[string]string{"message": "Message added successfully"}, http.StatusOK)
}

// GetMessagesHandler fetches all messages for a specific chat
func GetMessagesHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	chatIDStr, ok := vars["chatId"]
	if !ok || chatIDStr == "" {
		WriteJSONError(w, "Chat ID is required", http.StatusBadRequest)
		return
	}

	// Fetch chat by ID using string
	chat, err := db.GetChatByID(chatIDStr)
	if err != nil {
		WriteJSONError(w, "Chat not found", http.StatusNotFound)
		return
	}

	WriteJSON(w, chat.Messages, http.StatusOK)
}

// RequestChatHandler - Creates a pending chat request when user clicks "Buy"
func RequestChatHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	var req struct {
		ProductID string `json:"productId"` // Fixed syntax
		BuyerID   string `json:"buyerId"`   // Fixed syntax
		SellerID  string `json:"sellerId"`  // Fixed syntax
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		WriteJSONError(w, "Invalid request payload", http.StatusBadRequest)
		return
	}

	if req.ProductID == "" || req.BuyerID == "" || req.SellerID == "" {
		WriteJSONError(w, "All fields are required", http.StatusBadRequest)
		return
	}

	// Convert IDs from string to ObjectID
	productObjectID, err := primitive.ObjectIDFromHex(req.ProductID)
	if err != nil {
		WriteJSONError(w, "Invalid Product ID format", http.StatusBadRequest)
		return
	}

	buyerObjectID, err := primitive.ObjectIDFromHex(req.BuyerID)
	if err != nil {
		WriteJSONError(w, "Invalid Buyer ID format", http.StatusBadRequest)
		return
	}

	sellerObjectID, err := primitive.ObjectIDFromHex(req.SellerID)
	if err != nil {
		WriteJSONError(w, "Invalid Seller ID format", http.StatusBadRequest)
		return
	}

	session, err := db.MongoDBClient.StartSession()
	if err != nil {
		log.Printf("Failed to start MongoDB session: %v", err)
		WriteJSONError(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	defer session.EndSession(context.Background())

	callback := func(sessCtx mongo.SessionContext) (interface{}, error) {
		chatRequests := db.GetCollection("gridlyapp", "chat_requests")
		productsCol := db.GetCollection("gridlyapp", "products")

		// 1) Check if product is "inshop"
		var product models.Product
		err := productsCol.FindOne(sessCtx, bson.M{"_id": productObjectID}).Decode(&product)
		if err != nil {
			if err == mongo.ErrNoDocuments {
				return nil, &AppError{Message: "Product not found", StatusCode: http.StatusNotFound}
			}
			return nil, err
		}
		if product.Status != "inshop" {
			return nil, &AppError{Message: "Product is not available for purchase", StatusCode: http.StatusBadRequest}
		}

		// 2) Check if a pending request already exists
		existingRequest := models.ChatRequest{}
		findErr := chatRequests.FindOne(sessCtx, bson.M{
			"productId": productObjectID,
			"buyerId":   buyerObjectID,
			"status":    models.ChatRequestStatusPending,
		}).Decode(&existingRequest)
		if findErr == nil {
			return nil, &AppError{Message: "Chat request already pending", StatusCode: http.StatusConflict}
		} else if findErr != mongo.ErrNoDocuments {
			return nil, findErr
		}

		// 3) Create new chat request
		chatRequest := models.NewChatRequest(productObjectID, buyerObjectID, sellerObjectID)

		_, err = chatRequests.InsertOne(sessCtx, chatRequest)
		if err != nil {
			return nil, err
		}

		// 4) Increment product's chatCount
		update := bson.M{"$inc": bson.M{"chatCount": 1}}
		var updatedProduct models.Product
		err = productsCol.FindOneAndUpdate(
			sessCtx,
			bson.M{"_id": productObjectID},
			update,
			options.FindOneAndUpdate().SetReturnDocument(options.After),
		).Decode(&updatedProduct)
		if err != nil {
			return nil, err
		}

		// 5) If chatCount >= 3, set product status to "talks"
		if updatedProduct.ChatCount >= 3 && updatedProduct.Status != "talks" {
			_, err = productsCol.UpdateOne(
				sessCtx,
				bson.M{"_id": productObjectID},
				bson.M{"$set": bson.M{"status": "talks"}},
			)
			if err != nil {
				return nil, err
			}
		}

		return nil, nil
	}

	_, err = session.WithTransaction(context.Background(), callback)
	if err != nil {
		if appErr, ok := err.(*AppError); ok {
			WriteJSONError(w, appErr.Message, appErr.StatusCode)
			return
		}
		log.Printf("Transaction error in RequestChatHandler: %v", err)
		WriteJSONError(w, "Internal server error", http.StatusInternalServerError)
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
		RequestID string `json:"requestId"` // Fixed syntax
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		WriteJSONError(w, "Invalid request payload", http.StatusBadRequest)
		return
	}

	if req.RequestID == "" {
		WriteJSONError(w, "Request ID is required", http.StatusBadRequest)
		return
	}

	session, err := db.MongoDBClient.StartSession()
	if err != nil {
		log.Printf("Failed to start MongoDB session: %v", err)
		WriteJSONError(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	defer session.EndSession(context.Background())

	callback := func(sessCtx mongo.SessionContext) (interface{}, error) {
		chatRequests := db.GetCollection("gridlyapp", "chat_requests")
		chatsCol := db.GetCollection("gridlyapp", "chats")

		// Convert RequestID to ObjectID
		requestObjID, err := primitive.ObjectIDFromHex(req.RequestID)
		if err != nil {
			return nil, &AppError{Message: "Invalid Request ID format", StatusCode: http.StatusBadRequest}
		}

		// Find the chat request
		var chatReq models.ChatRequest
		err = chatRequests.FindOne(sessCtx, bson.M{"_id": requestObjID}).Decode(&chatReq)
		if err != nil {
			if err == mongo.ErrNoDocuments {
				return nil, &AppError{Message: "Chat request not found", StatusCode: http.StatusNotFound}
			}
			return nil, err
		}

		if chatReq.Status != models.ChatRequestStatusPending {
			return nil, &AppError{Message: "Chat request is not pending", StatusCode: http.StatusBadRequest}
		}

		// Update chat request status to "accepted"
		update := bson.M{"$set": bson.M{"status": models.ChatRequestStatusAccepted}}
		_, err = chatRequests.UpdateOne(sessCtx, bson.M{"_id": requestObjID}, update)
		if err != nil {
			return nil, err
		}

		// Check if a chat already exists for this request
		existingChat := models.Chat{}
		err = chatsCol.FindOne(sessCtx, bson.M{
			"productId": chatReq.ProductID,
			"buyerId":   chatReq.BuyerID,
			"sellerId":  chatReq.SellerID,
		}).Decode(&existingChat)
		if err == nil {
			return nil, &AppError{Message: "Chat already exists for this request", StatusCode: http.StatusConflict}
		} else if err != mongo.ErrNoDocuments {
			return nil, err
		}

		// Create a new chat
		newChat := models.NewChat(chatReq.ProductID, chatReq.BuyerID, chatReq.SellerID)

		_, err = chatsCol.InsertOne(sessCtx, newChat)
		if err != nil {
			return nil, err
		}

		// Optionally, notify the buyer that their request was accepted
		// Implement notification logic here (e.g., via Ably, email, push notification)

		return nil, nil
	}

	_, err = session.WithTransaction(context.Background(), callback)
	if err != nil {
		if appErr, ok := err.(*AppError); ok {
			WriteJSONError(w, appErr.Message, appErr.StatusCode)
			return
		}
		log.Printf("Transaction error in AcceptChatRequestHandler: %v", err)
		WriteJSONError(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{
		"message": "Chat request accepted and chat room created successfully",
	})
}

// RejectChatRequestHandler - seller rejects chat request
func RejectChatRequestHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	var req struct {
		RequestID string `json:"requestId"` // Fixed syntax
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		WriteJSONError(w, "Invalid request payload", http.StatusBadRequest)
		return
	}

	if req.RequestID == "" {
		WriteJSONError(w, "Request ID is required", http.StatusBadRequest)
		return
	}

	session, err := db.MongoDBClient.StartSession()
	if err != nil {
		log.Printf("Failed to start MongoDB session: %v", err)
		WriteJSONError(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	defer session.EndSession(context.Background())

	callback := func(sessCtx mongo.SessionContext) (interface{}, error) {
		chatRequests := db.GetCollection("gridlyapp", "chat_requests")
		productsCol := db.GetCollection("gridlyapp", "products")

		// Convert RequestID to ObjectID
		requestObjID, err := primitive.ObjectIDFromHex(req.RequestID)
		if err != nil {
			return nil, &AppError{Message: "Invalid Request ID format", StatusCode: http.StatusBadRequest}
		}

		// Find the chat request
		var chatReq models.ChatRequest
		err = chatRequests.FindOne(sessCtx, bson.M{"_id": requestObjID}).Decode(&chatReq)
		if err != nil {
			if err == mongo.ErrNoDocuments {
				return nil, &AppError{Message: "Chat request not found", StatusCode: http.StatusNotFound}
			}
			return nil, err
		}

		if chatReq.Status != models.ChatRequestStatusPending {
			return nil, &AppError{Message: "Chat request is not pending", StatusCode: http.StatusBadRequest}
		}

		// Update chat request status to "rejected"
		update := bson.M{"$set": bson.M{"status": models.ChatRequestStatusRejected}}
		_, err = chatRequests.UpdateOne(sessCtx, bson.M{"_id": requestObjID}, update)
		if err != nil {
			return nil, err
		}

		// Decrement product's chatCount
		_, err = productsCol.UpdateOne(
			sessCtx,
			bson.M{"_id": chatReq.ProductID},
			bson.M{"$inc": bson.M{"chatCount": -1}},
		)
		if err != nil {
			return nil, err
		}

		// Optionally, notify the buyer that their request was rejected
		// Implement notification logic here (e.g., via Ably, email, push notification)

		return nil, nil
	}

	_, err = session.WithTransaction(context.Background(), callback)
	if err != nil {
		if appErr, ok := err.(*AppError); ok {
			WriteJSONError(w, appErr.Message, appErr.StatusCode)
			return
		}
		log.Printf("Transaction error in RejectChatRequestHandler: %v", err)
		WriteJSONError(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{
		"message": "Chat request rejected successfully",
	})
}

// getLatestMessageAndTimestamp returns the last message + timestamp in the chat
func getLatestMessageAndTimestamp(messages []models.Message) (string, string) {
	if len(messages) == 0 {
		return "", ""
	}
	latestMsg := messages[len(messages)-1].Content
	latestTime := messages[len(messages)-1].Timestamp.Format(time.RFC3339)
	return latestMsg, latestTime
}
func GetChatRequestsHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	// Extract userID from the request context
	userID, ok := r.Context().Value(userIDKey).(string)
	if !ok || userID == "" {
		WriteJSONError(w, "Unauthorized: UserID not found in token", http.StatusUnauthorized)
		return
	}

	// Convert userID to ObjectID
	userObjID, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		WriteJSONError(w, "Invalid user ID format", http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	chatRequestsCol := db.GetCollection("gridlyapp", "chat_requests")

	// Find chat requests where the user is either the buyer or seller
	filter := bson.M{
		"$or": []bson.M{
			{"buyerId": userObjID},
			{"sellerId": userObjID},
		},
	}

	cursor, err := chatRequestsCol.Find(ctx, filter)
	if err != nil {
		log.Printf("Error fetching chat requests for user %s: %v", userID, err)
		WriteJSONError(w, "Error fetching chat requests", http.StatusInternalServerError)
		return
	}
	defer cursor.Close(ctx)

	var chatRequests []models.ChatRequest
	if err := cursor.All(ctx, &chatRequests); err != nil {
		WriteJSONError(w, "Failed to parse chat requests", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"chatRequests": chatRequests,
	})
}
