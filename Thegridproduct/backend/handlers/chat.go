// handlers/chat.go
package handlers

import (
	"context"
	"encoding/json"
	"fmt"
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
	"google.golang.org/api/option"

	"cloud.google.com/go/firestore"
)

// EnrichedChat represents a chat with additional product and user details.
type EnrichedChat struct {
	ChatID          string `json:"chatID"`
	ProductID       string `json:"productID"`
	ProductTitle    string `json:"productTitle"`
	User            User   `json:"user"`
	LatestMessage   string `json:"latestMessage,omitempty"`
	LatestTimestamp string `json:"latestTimestamp,omitempty"`
}

// EnrichedChatRequest represents a chat request with product name included.
type EnrichedChatRequest struct {
	RequestID       string `json:"requestId"`
	ProductID       string `json:"productId"`
	ProductTitle    string `json:"productTitle"`
	BuyerID         string `json:"buyerId"`
	SellerID        string `json:"sellerId"`
	Status          string `json:"status"`
	CreatedAt       string `json:"createdAt"`
	BuyerFirstName  string `json:"buyerFirstName"`
	BuyerLastName   string `json:"buyerLastName"`
	SellerFirstName string `json:"sellerFirstName"`
	SellerLastName  string `json:"sellerLastName"`
}

// User represents basic user information.
type User struct {
	FirstName string `json:"firstName"`
	LastName  string `json:"lastName"`
}

// AppError defines a custom application error with a message and HTTP status code.
type AppError struct {
	Message    string
	StatusCode int
}

func (e *AppError) Error() string {
	return e.Message
}

// GetChatHandler fetches chat details by product ID.
func GetChatHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	productIDStr, ok := vars["productId"]
	if !ok || productIDStr == "" {
		WriteJSONError(w, "Product ID is required", http.StatusBadRequest)
		return
	}

	// Fetch chat from MongoDB
	chat, err := db.GetChatByProductID(productIDStr)
	if err != nil {
		WriteJSONError(w, "Chat not found", http.StatusNotFound)
		return
	}

	// Fetch messages from Firestore
	ctx := context.Background()
	client, err := firestore.NewClient(ctx, "gridlychat")
	if err != nil {
		log.Printf("Failed to create Firestore client: %v", err)
		WriteJSONError(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	defer client.Close()

	chatDocRef := client.Collection("chatRooms").Doc(chat.ID.Hex())
	docSnap, err := chatDocRef.Get(ctx)
	if err != nil {
		log.Printf("Firestore chat not found: %v", err)
		WriteJSONError(w, "Chat not found in Firestore", http.StatusNotFound)
		return
	}

	var firestoreData map[string]interface{}
	if err := docSnap.DataTo(&firestoreData); err != nil {
		log.Printf("Failed to parse Firestore chat: %v", err)
		WriteJSONError(w, "Error retrieving chat details", http.StatusInternalServerError)
		return
	}

	// Extract messages from Firestore
	messages, _ := firestoreData["messages"].([]interface{})

	// Construct response
	enrichedChat := map[string]interface{}{
		"chatID":    chat.ID.Hex(),
		"productID": chat.ProductID.Hex(),
		"buyerID":   chat.BuyerID.Hex(),
		"sellerID":  chat.SellerID.Hex(),
		"messages":  messages,
	}

	WriteJSON(w, enrichedChat, http.StatusOK)
}

func GetChatsByUserHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	userIDStr := vars["userId"]
	if userIDStr == "" {
		WriteJSONError(w, "User ID is required", http.StatusBadRequest)
		return
	}

	// Fetch chats from MongoDB
	chats, err := db.FindChatsByUser(userIDStr)
	if err != nil {
		WriteJSONError(w, "Failed to fetch chats", http.StatusInternalServerError)
		return
	}

	// Initialize Firestore client with credentials
	ctx := context.Background()
	client, err := firestore.NewClient(ctx, "gridlychat", option.WithCredentialsJSON(serviceAccountJSON)) // Add credentials here
	if err != nil {
		log.Printf("Failed to create Firestore client: %v", err)
		WriteJSONError(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	defer client.Close()

	var enrichedChats []EnrichedChat
	for _, c := range chats {
		product, err := db.GetProductByID(c.ProductID.Hex())
		if err != nil {
			log.Printf("Failed to fetch product details for productID %s: %v", c.ProductID.Hex(), err)
			continue
		}

		var otherUserID primitive.ObjectID
		if c.BuyerID.Hex() == userIDStr {
			otherUserID = c.SellerID
		} else {
			otherUserID = c.BuyerID
		}

		otherUser, err := db.GetUserByID(otherUserID.Hex())
		if err != nil {
			log.Printf("Failed to fetch user details for userID %s: %v", otherUserID.Hex(), err)
			continue
		}

		// Fetch messages from Firestore
		chatDocRef := client.Collection("chatRooms").Doc(c.ID.Hex())
		docSnap, err := chatDocRef.Get(ctx)
		if err != nil {
			log.Printf("No Firestore chat found for chatID %s: %v", c.ID.Hex(), err)
			continue
		}

		// Parse Firestore messages
		var messages []models.Message
		messagesData, ok := docSnap.Data()["messages"].([]interface{})
		if !ok {
			log.Printf("Failed to parse messages for chatID %s", c.ID.Hex())
			continue
		}

		for _, msg := range messagesData {
			msgMap, ok := msg.(map[string]interface{})
			if !ok {
				log.Println("Skipping message due to type mismatch")
				continue
			}

			// Parse the timestamp
			timestampStr, ok := msgMap["timestamp"].(string)
			if !ok {
				log.Println("Skipping message due to missing timestamp")
				continue
			}

			parsedTime, err := time.Parse(time.RFC3339, timestampStr)
			if err != nil {
				log.Println("Skipping message due to timestamp parsing error:", err)
				continue
			}

			// Create a Message struct
			message := models.Message{
				ID:        msgMap["_id"].(string),
				SenderID:  msgMap["senderId"].(string),
				Content:   msgMap["content"].(string),
				Timestamp: parsedTime,
			}
			messages = append(messages, message)
		}

		latestMessage, latestTimestamp := getLatestMessageAndTimestamp(messages)

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

// AddMessageHandler adds a new message to a chat.
func AddMessageHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	chatIDStr, ok := vars["chatId"]
	if !ok || chatIDStr == "" {
		WriteJSONError(w, "Chat ID is required", http.StatusBadRequest)
		return
	}

	// Decode request body
	var message models.Message
	if err := json.NewDecoder(r.Body).Decode(&message); err != nil {
		WriteJSONError(w, "Invalid request payload", http.StatusBadRequest)
		return
	}

	// Validate message fields
	if message.SenderID == "" || message.Content == "" {
		WriteJSONError(w, "Sender ID and content are required", http.StatusBadRequest)
		return
	}
	message.Timestamp = time.Now().UTC()

	// Firestore setup
	ctx := context.Background()
	client, err := firestore.NewClient(ctx, "gridlychat", option.WithCredentialsJSON(serviceAccountJSON))
	if err != nil {
		log.Printf("Failed to create Firestore client: %v", err)
		WriteJSONError(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	defer client.Close()

	chatDocRef := client.Collection("chatRooms").Doc(chatIDStr)
	_, err = chatDocRef.Get(ctx)
	if err != nil {
		log.Printf("Chat room not found in Firestore: %s", chatIDStr)
		http.Error(w, "Chat room does not exist", http.StatusNotFound)
		return
	}

	// Prepare message data
	messageData := map[string]interface{}{
		"_id":       primitive.NewObjectID().Hex(),
		"senderId":  message.SenderID,
		"content":   message.Content,
		"timestamp": message.Timestamp.Format(time.RFC3339),
	}

	// Append message to Firestore chat room
	_, err = chatDocRef.Update(ctx, []firestore.Update{
		{Path: "messages", Value: firestore.ArrayUnion(messageData)},
	})
	if err != nil {
		log.Printf("Failed to add message to Firestore: %v", err)
		WriteJSONError(w, "Failed to send message", http.StatusInternalServerError)
		return
	}

	WriteJSON(w, map[string]string{"message": "Message sent successfully"}, http.StatusOK)
}

func GetMessagesHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	chatIDStr, ok := vars["chatId"]
	if !ok || chatIDStr == "" {
		WriteJSONError(w, "Chat ID is required", http.StatusBadRequest)
		return
	}

	// Initialize Firestore client with credentials
	ctx := context.Background()
	client, err := firestore.NewClient(ctx, "gridlychat", option.WithCredentialsJSON(serviceAccountJSON)) // Add credentials here
	if err != nil {
		log.Printf("Failed to create Firestore client: %v", err)
		WriteJSONError(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	defer client.Close()

	// Fetch chat room document from Firestore
	chatDocRef := client.Collection("chatRooms").Doc(chatIDStr)
	docSnap, err := chatDocRef.Get(ctx)
	if err != nil {
		log.Printf("Chat room not found in Firestore: %v", err)
		WriteJSONError(w, "Chat room does not exist", http.StatusNotFound)
		return
	}

	// Parse messages from Firestore document
	chatData := docSnap.Data()
	messages, ok := chatData["messages"].([]interface{})
	if !ok {
		messages = []interface{}{}
	}

	// Return messages as JSON response
	WriteJSON(w, messages, http.StatusOK)
}

// RequestChatHandler creates a pending chat request when a user clicks "Buy".
func RequestChatHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	var req struct {
		ProductID string `json:"productId"`
		BuyerID   string `json:"buyerId"`
		SellerID  string `json:"sellerId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		WriteJSONError(w, "Invalid request payload", http.StatusBadRequest)
		return
	}
	if req.ProductID == "" || req.BuyerID == "" || req.SellerID == "" {
		WriteJSONError(w, "All fields are required", http.StatusBadRequest)
		return
	}

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
		cartCol := db.GetCollection("gridlyapp", "carts")

		// Validate product availability
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

		// Check if there's already a pending chat request for this product
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

		chatRequest := models.NewChatRequest(productObjectID, buyerObjectID, sellerObjectID)
		_, err = chatRequests.InsertOne(sessCtx, chatRequest)
		if err != nil {
			return nil, err
		}

		// Update product's chat count
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

		// If chat count reaches 3, mark the product as "talks"
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

		// Remove product from buyer's cart
		filter := bson.M{"userId": buyerObjectID}
		updateCart := bson.M{"$pull": bson.M{"items": bson.M{"productId": productObjectID}}}
		_, err = cartCol.UpdateOne(sessCtx, filter, updateCart)
		if err != nil {
			log.Printf("Failed to remove product from cart: %v", err)
			return nil, err
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
		"message": "Chat request sent successfully and product removed from cart",
	})
}

// AcceptChatRequestHandler accepts a pending chat request and creates a chat.
func AcceptChatRequestHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	var req struct {
		RequestID string `json:"requestId"`
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

	var newChat *models.Chat
	callback := func(sessCtx mongo.SessionContext) (interface{}, error) {
		chatRequests := db.GetCollection("gridlyapp", "chat_requests")
		chatsCol := db.GetCollection("gridlyapp", "chats")

		requestObjID, err := primitive.ObjectIDFromHex(req.RequestID)
		if err != nil {
			return nil, &AppError{Message: "Invalid Request ID format", StatusCode: http.StatusBadRequest}
		}

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

		// Update request status to accepted
		update := bson.M{"$set": bson.M{"status": models.ChatRequestStatusAccepted}}
		_, err = chatRequests.UpdateOne(sessCtx, bson.M{"_id": requestObjID}, update)
		if err != nil {
			return nil, err
		}

		// Check if a chat already exists
		var existingChat models.Chat
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

		newChat = models.NewChat(chatReq.ProductID, chatReq.BuyerID, chatReq.SellerID)
		_, err = chatsCol.InsertOne(sessCtx, newChat)
		if err != nil {
			return nil, err
		}

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

	// Create Firestore chat room asynchronously.
	// (Make sure the parameters are passed in the correct order:
	// newChatID, buyerID, sellerID, productID)
	go func() {
		if err := createFirestoreChatRoom(newChat.ID.Hex(), newChat.BuyerID.Hex(), newChat.SellerID.Hex(), newChat.ProductID.Hex()); err != nil {
			log.Printf("Failed to create Firestore chat room for chat %s: %v", newChat.ID.Hex(), err)
		}
	}()

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{
		"message": "Chat request accepted and chat room created successfully",
		"chatID":  newChat.ID.Hex(),
	})
}

// RejectChatRequestHandler rejects a pending chat request.
func RejectChatRequestHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	var req struct {
		RequestID string `json:"requestId"`
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

		requestObjID, err := primitive.ObjectIDFromHex(req.RequestID)
		if err != nil {
			return nil, &AppError{Message: "Invalid Request ID format", StatusCode: http.StatusBadRequest}
		}

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

		update := bson.M{"$set": bson.M{"status": models.ChatRequestStatusRejected}}
		_, err = chatRequests.UpdateOne(sessCtx, bson.M{"_id": requestObjID}, update)
		if err != nil {
			return nil, err
		}

		// Decrease chat count for the product.
		_, err = productsCol.UpdateOne(
			sessCtx,
			bson.M{"_id": chatReq.ProductID},
			bson.M{"$inc": bson.M{"chatCount": -1}},
		)
		if err != nil {
			return nil, err
		}

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

// getLatestMessageAndTimestamp returns the content and timestamp of the last message.
func getLatestMessageAndTimestamp(messages []models.Message) (string, string) {
	if len(messages) == 0 {
		return "", ""
	}
	latestMsg := messages[len(messages)-1].Content
	latestTime := messages[len(messages)-1].Timestamp.Format(time.RFC3339)
	return latestMsg, latestTime
}

// GetChatRequestsHandler retrieves all chat requests for a user.
func GetChatRequestsHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	// Assumes that the middleware has set a userID in the context using a key named userIDKey.
	userID, ok := r.Context().Value(userIDKey).(string)
	if !ok || userID == "" {
		WriteJSONError(w, "Unauthorized: UserID not found in token", http.StatusUnauthorized)
		return
	}

	userObjID, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		WriteJSONError(w, "Invalid user ID format", http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	chatRequestsCol := db.GetCollection("gridlyapp", "chat_requests")
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

	var incomingRequests []EnrichedChatRequest
	var outgoingRequests []EnrichedChatRequest
	for _, req := range chatRequests {
		product, err := db.GetProductByID(req.ProductID.Hex())
		if err != nil {
			log.Printf("Failed to fetch product details for productID %s: %v", req.ProductID.Hex(), err)
			continue
		}
		buyer, err := db.GetUserByID(req.BuyerID.Hex())
		if err != nil {
			log.Printf("Failed to fetch buyer details for buyerID %s: %v", req.BuyerID.Hex(), err)
			continue
		}
		seller, err := db.GetUserByID(req.SellerID.Hex())
		if err != nil {
			log.Printf("Failed to fetch seller details for sellerID %s: %v", req.SellerID.Hex(), err)
			continue
		}

		enrichedReq := EnrichedChatRequest{
			RequestID:       req.ID.Hex(),
			ProductID:       req.ProductID.Hex(),
			ProductTitle:    product.Title,
			BuyerID:         req.BuyerID.Hex(),
			SellerID:        req.SellerID.Hex(),
			Status:          req.Status,
			CreatedAt:       req.CreatedAt.Format(time.RFC3339),
			BuyerFirstName:  buyer.FirstName,
			BuyerLastName:   buyer.LastName,
			SellerFirstName: seller.FirstName,
			SellerLastName:  seller.LastName,
		}

		if req.BuyerID.Hex() == userID {
			outgoingRequests = append(outgoingRequests, enrichedReq)
		} else if req.SellerID.Hex() == userID {
			incomingRequests = append(incomingRequests, enrichedReq)
		}
	}

	WriteJSON(w, map[string]interface{}{
		"incomingRequests": incomingRequests,
		"outgoingRequests": outgoingRequests,
	}, http.StatusOK)
}

// serviceAccountJSON holds the Firebase service account credentials.
var serviceAccountJSON = []byte(`{
  "type": "service_account",
  "project_id": "gridlychat",
  "private_key_id": "7d46da6b5d504dd246f36983bdd8589bed782929",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDiBt5s7umX2Wo8\nbdJAa6qFO9RH8AXfFzcFNVf8HY7X243NV7oOjFBaQsmZMmP6wNflkU0MjdpzZ4aO\nUHTW5sebkPLUUdO1t0ngdSJvhslNg+EEVhLEN2v8YUICUaoVxsOdWxk0XXTXsWG2\nmCbLf4Jh/DgTXiZXp8LlFI5RG03TG3F3bna01GW0Zpu4jy0+qXzucWKGgu0/rsih\nKRVGOBGEsOqfUOfEHNMqMbjrqPknuMnGuPYFHlhAJK+PwU7q0Vz1oVaJCfiAuRtq\n47V9U8wjwHmsJT8ChdvE2hRREwyxzgVdJ+cD9uAa5F8HBwn8hH73Wpwcgs2Iiepb\n9sxtpJnHAgMBAAECggEAGCH48v3knadDsIVemCzmsqhbV1Lz+DMtAgwFWOXPBT0W\nkYDMXMFJKFn5LGI09Tuh0YuyA6Uhrdtf19IUp4f8cp+x+E7ES/fwlgaWUVIS1t6T\nJ+NeHZUinSUakc97rteKC0MEGJM3O9BfSR+gWhnt0d3GyZ/ueBgcDFl62INnISLu\n7cXwHYxy+7WwYIovzgGm9U7FbH/OX0hq2q4P78aHBqBJ4ZzFZu3AJeTvR4hVKDDS\nvRAAONPoi720hFJbDGIIRNKI7yzuDUVgAso0oEcKTe33zwg3/8XehAveRVWvMz8E\nhOh6Ze13vZHse9N6yKzGOWEXjp2rjQrwh6MKeB9gAQKBgQD2qRIjZCxGaTFItOZz\n5k4rS/Sl494bDEbapCt47lYzaSqcNgY5QONQTqB7Qo4sKL8uGYZm3K/oS+AhluKN\nWYVNKHuD7hkW9VoQud9mDT3MkUJy2tq7+ns9cpDu/udOdD9CkscWoVdQ11HzUPrG\nbiaFYM/J9pCr7IcosCZhthohvwKBgQDqlcrXeu3C5dFesFiEKtcKKRteXozQSG0F\nrgfCRquR60HMx+CrQVpsSQo46WlcZDg7jwxqJuoYKYCkiDp8imEo6pssTHuE4OeI\nDSGAnYNFDIf2iXw0sLRv6O4iWaLL9mdB3c4bkMZHcgwzA1FKVLmHBX5+c5u15oFI\ny+Ds2Fn5+QKBgQC/XUpaNNR4yBHZY6fLUWliA+rJbTEa8PpjlKy5hMdR2YyaZvuL\nHcF9w5KULn2Y2v//5wOz+BFterhntuULXuGhi//PykCi5DU89sfQKAPDGwtfilXb\nMyi78o9pLFAOOPf/UVquPvw8FuFYkYINwtWV8xcijG2PRNFTit4sPpilhwKBgGAk\nvFnMPB4g6sqQI/cnR7MWXe0zeyryRByL0wpAxJitfu5bDS2jP1gaJ2Jj55bCTHm8\niy4GfPMiL2M/ohjg7ilC3g4t2oH/W2VbXFvGMsLd++uDNbCyq4EiSlcxvZMyjedk\n7NBHabxmdbGCrpJ0XwWDrvBMmYjXzCz1wl3P3jChAoGBALMgxyjCza6TiY1xU+P2\nl+QwTSB7QARcXbbxAoGzbrYI5vbQWa6+HA80Q0Y5kqgOAx6+xUhSQ+ZUuNI1cGdY\n2Rm9h1K3Pa1kK+4dWzTnv23x0WKFVQ4T0VTCSabZhyg40ql6KSPFJsX/N8yJXBHc\nX3IiYWZ6Gq66ythJnqT+o3fE\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-fbsvc@gridlychat.iam.gserviceaccount.com",
  "client_id": "105010337009847546213",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40gridlychat.iam.gserviceaccount.com",
  "universe_domain": "googleapis.com"
}`)

// createFirestoreChatRoom creates a new chat room in Firestore.
func createFirestoreChatRoom(newChatID, buyerID, sellerID, productID string) error {
	ctx := context.Background()
	client, err := firestore.NewClient(ctx, "gridlychat", option.WithCredentialsJSON(serviceAccountJSON))
	if err != nil {
		return fmt.Errorf("failed to create Firestore client: %v", err)
	}
	defer client.Close()

	docRef := client.Collection("chatRooms").Doc(newChatID)
	data := map[string]interface{}{
		"chatID":    newChatID,
		"productID": productID,
		"buyerID":   buyerID,
		"sellerID":  sellerID,
		"createdAt": time.Now().Format(time.RFC3339),
		"messages":  []interface{}{},
	}

	_, err = docRef.Set(ctx, data)
	if err != nil {
		return fmt.Errorf("failed to create Firestore chat room: %v", err)
	}
	log.Printf("Firestore chat room created: %s", newChatID)
	return nil
}

// TestSendMessageHandler sends a test message to Firestore.
func TestSendMessageHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	var req struct {
		ChatID   string `json:"chatId"`
		SenderID string `json:"senderId"`
		Content  string `json:"content"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON payload", http.StatusBadRequest)
		return
	}

	if req.ChatID == "" || req.SenderID == "" || req.Content == "" {
		http.Error(w, "Missing chatId, senderId, or content", http.StatusBadRequest)
		return
	}

	ctx := context.Background()
	client, err := firestore.NewClient(ctx, "gridlychat", option.WithCredentialsJSON(serviceAccountJSON))
	if err != nil {
		http.Error(w, "Failed to create Firestore client", http.StatusInternalServerError)
		return
	}
	defer client.Close()

	docRef := client.Collection("chatRooms").Doc(req.ChatID)
	_, err = docRef.Get(ctx)
	if err != nil {
		log.Printf("Chat room not found in Firestore: %s", req.ChatID)
		http.Error(w, "Chat room does not exist", http.StatusNotFound)
		return
	}

	newMessage := map[string]interface{}{
		"_id":       fmt.Sprintf("%d", time.Now().UnixNano()),
		"senderId":  req.SenderID,
		"content":   req.Content,
		"timestamp": time.Now().UTC().Format(time.RFC3339),
	}

	_, err = docRef.Update(ctx, []firestore.Update{
		{Path: "messages", Value: firestore.ArrayUnion(newMessage)},
	})
	if err != nil {
		http.Error(w, "Failed to add message to Firestore", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{
		"status": "success",
	})

}
