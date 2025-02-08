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
	"google.golang.org/api/option"

	"cloud.google.com/go/firestore"
)

type EnrichedChat struct {
	ChatID          string `json:"chatID"`
	ReferenceID     string `json:"referenceId"`
	ReferenceTitle  string `json:"referenceTitle"` // ✅ Correct field for both products & gigs
	ReferenceType   string `json:"referenceType"`
	User            User   `json:"user"`
	LatestMessage   string `json:"latestMessage,omitempty"`
	LatestTimestamp string `json:"latestTimestamp,omitempty"`
}

// EnrichedChatRequest represents a chat request with product/gig title included.
type EnrichedChatRequest struct {
	RequestID       string `json:"requestId"`
	ReferenceID     string `json:"referenceId"`
	ReferenceTitle  string `json:"referenceTitle"` // ✅ Add this field
	ReferenceType   string `json:"referenceType"`  // ✅ Ensure this field exists
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

// GetChatHandler fetches chat details by reference ID (product or gig).
func GetChatHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	referenceIDStr, ok := vars["referenceId"] // Can be either ProductID or GigID
	if !ok || referenceIDStr == "" {
		WriteJSONError(w, "Reference ID is required", http.StatusBadRequest)
		return
	}

	referenceType, ok := vars["referenceType"]
	if !ok || (referenceType != "product" && referenceType != "gig" && referenceType != "product_request") {
		WriteJSONError(w, "Valid referenceType (product, gig, or product_request) is required", http.StatusBadRequest)
		return
	}

	// Fetch chat from MongoDB
	chat, err := db.GetChatByReferenceID(referenceIDStr, referenceType)
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
		"chatID":        chat.ID.Hex(),
		"referenceID":   chat.ReferenceID.Hex(),
		"referenceType": chat.ReferenceType,
		"buyerID":       chat.BuyerID.Hex(),
		"sellerID":      chat.SellerID.Hex(),
		"messages":      messages,
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

	// Fetch all chats (both product and gig based) from MongoDB
	chats, err := db.FindChatsByUser(userIDStr)
	if err != nil {
		WriteJSONError(w, "Failed to fetch chats", http.StatusInternalServerError)
		return
	}

	ctx := context.Background()
	client, err := firestore.NewClient(ctx, "gridlychat", option.WithCredentialsJSON(serviceAccountJSON))
	if err != nil {
		log.Printf("Failed to create Firestore client: %v", err)
		WriteJSONError(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	defer client.Close()

	var enrichedChats []EnrichedChat
	for _, c := range chats {
		var referenceTitle string
		var referenceType string
		var otherUserID primitive.ObjectID
		var isAnonymous bool = false // Default false

		if c.ReferenceType == "product" {
			product, err := db.GetProductByID(c.ReferenceID.Hex())
			if err != nil {
				log.Printf("❌ Failed to fetch product details for productID %s: %v", c.ReferenceID.Hex(), err)
				continue
			}
			referenceTitle = product.Title
			referenceType = "product"
		} else if c.ReferenceType == "gig" {
			gig, err := db.GetGigByID(c.ReferenceID.Hex())
			if err != nil {
				log.Printf("❌ Failed to fetch gig details for gigID %s: %v", c.ReferenceID.Hex(), err)
				continue
			}
			referenceTitle = gig.Title
			referenceType = "gig"
			isAnonymous = gig.IsAnonymous // Check if gig is anonymous
		} else if c.ReferenceType == "product_request" {
			productRequest, err := db.GetProductRequestByID(c.ReferenceID.Hex())
			if err != nil {
				log.Printf("❌ Failed to fetch product request details for requestID %s: %v", c.ReferenceID.Hex(), err)
				continue
			}
			referenceTitle = productRequest.ProductName
			referenceType = "product_request"
		}

		// Identify the other user in the chat
		if c.BuyerID.Hex() == userIDStr {
			otherUserID = c.SellerID
		} else {
			otherUserID = c.BuyerID
		}

		var otherUser User
		if isAnonymous {
			// ✅ If gig is anonymous, set name to "Anonymous User"
			otherUser = User{FirstName: "Anonymous", LastName: "User"}
		} else {
			// Fetch actual user details
			userData, err := db.GetUserByID(otherUserID.Hex())
			if err != nil {
				log.Printf("❌ Failed to fetch user details for userID %s: %v", otherUserID.Hex(), err)
				continue
			}
			otherUser = User{FirstName: userData.FirstName, LastName: userData.LastName}
		}

		// Fetch messages from Firestore
		chatDocRef := client.Collection("chatRooms").Doc(c.ID.Hex())
		docSnap, err := chatDocRef.Get(ctx)
		if err != nil {
			log.Printf("⚠️ No Firestore chat found for chatID %s: %v", c.ID.Hex(), err)
			continue
		}

		// Parse Firestore messages
		var messages []models.Message
		messagesData, exists := docSnap.Data()["messages"]
		if !exists {
			log.Printf("ℹ️ No messages found for chatID %s", c.ID.Hex())
			continue
		}

		messageSlice, ok := messagesData.([]interface{})
		if !ok {
			log.Printf("❌ Failed to parse messages for chatID %s (Type Assertion Failed)", c.ID.Hex())
			continue
		}

		// Iterate over messages properly
		for _, msg := range messageSlice {
			msgMap, ok := msg.(map[string]interface{})
			if !ok {
				log.Printf("⚠️ Skipping message due to type mismatch in chatID %s", c.ID.Hex())
				continue
			}

			// Parse the timestamp
			timestampStr, ok := msgMap["timestamp"].(string)
			if !ok {
				log.Printf("⚠️ Skipping message due to missing timestamp in chatID %s", c.ID.Hex())
				continue
			}

			parsedTime, err := time.Parse(time.RFC3339, timestampStr)
			if err != nil {
				log.Printf("⚠️ Skipping message due to timestamp parsing error in chatID %s: %v", c.ID.Hex(), err)
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

		// Append enriched chat details
		enrichedChat := EnrichedChat{
			ChatID:          c.ID.Hex(),
			ReferenceID:     c.ReferenceID.Hex(),
			ReferenceTitle:  referenceTitle,
			ReferenceType:   referenceType,
			User:            otherUser, // ✅ Now handles anonymous case
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
func RequestChatHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	// Decode request body
	var req struct {
		ReferenceID   string `json:"referenceId"`   // Can be ProductID, GigID, or ProductRequestID
		ReferenceType string `json:"referenceType"` // "product", "gig", or "product_request"
		BuyerID       string `json:"buyerId"`
		SellerID      string `json:"sellerId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		WriteJSONError(w, "Invalid request payload", http.StatusBadRequest)
		return
	}

	// Validate input
	if req.ReferenceID == "" || req.ReferenceType == "" || req.BuyerID == "" || req.SellerID == "" {
		WriteJSONError(w, "All fields are required", http.StatusBadRequest)
		return
	}

	// Ensure the reference type is valid
	if req.ReferenceType != "product" && req.ReferenceType != "gig" && req.ReferenceType != "product_request" {
		WriteJSONError(w, "Invalid referenceType, must be 'product', 'gig', or 'product_request'", http.StatusBadRequest)
		return
	}

	// Convert IDs to ObjectID
	referenceObjectID, err := primitive.ObjectIDFromHex(req.ReferenceID)
	if err != nil {
		WriteJSONError(w, "Invalid Reference ID format", http.StatusBadRequest)
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
		var referenceTitle string
		isAnonymous := false

		// Fetch the reference title from the correct collection
		switch req.ReferenceType {
		case "gig":
			gigsCol := db.GetCollection("gridlyapp", "gigs")
			var gig models.Gig
			err := gigsCol.FindOne(sessCtx, bson.M{"_id": referenceObjectID}).Decode(&gig)
			if err != nil {
				return nil, &AppError{Message: "Gig not found", StatusCode: http.StatusNotFound}
			}
			referenceTitle = gig.Title
			isAnonymous = gig.IsAnonymous // Check if the gig is anonymous

		case "product":
			productsCol := db.GetCollection("gridlyapp", "products")
			var product models.Product
			err := productsCol.FindOne(sessCtx, bson.M{"_id": referenceObjectID}).Decode(&product)
			if err != nil {
				return nil, &AppError{Message: "Product not found", StatusCode: http.StatusNotFound}
			}
			referenceTitle = product.Title

		case "product_request":
			requestsCol := db.GetCollection("gridlyapp", "product_requests")
			var productRequest models.ProductRequest
			err := requestsCol.FindOne(sessCtx, bson.M{"_id": referenceObjectID}).Decode(&productRequest)
			if err != nil {
				return nil, &AppError{Message: "Product request not found", StatusCode: http.StatusNotFound}
			}
			referenceTitle = productRequest.ProductName
		}

		// Check if there's already a pending chat request for this reference by the buyer
		existingRequest := models.ChatRequest{}
		findErr := chatRequests.FindOne(sessCtx, bson.M{
			"referenceId":   referenceObjectID,
			"referenceType": req.ReferenceType,
			"buyerId":       buyerObjectID,
			"status":        models.ChatRequestStatusPending,
		}).Decode(&existingRequest)
		if findErr == nil {
			return nil, &AppError{Message: "Chat request already pending", StatusCode: http.StatusConflict}
		} else if findErr != mongo.ErrNoDocuments {
			return nil, findErr
		}

		var buyerFirstName, buyerLastName, sellerFirstName, sellerLastName string

		if isAnonymous {
			buyerFirstName, buyerLastName = "Anonymous", "User"
			sellerFirstName, sellerLastName = "Anonymous", "User"
		} else {
			// ✅ Otherwise, fetch real names
			buyer, err := db.GetUserByID(req.BuyerID)
			if err != nil {
				return nil, &AppError{Message: "Buyer not found", StatusCode: http.StatusNotFound}
			}
			buyerFirstName, buyerLastName = buyer.FirstName, buyer.LastName

			seller, err := db.GetUserByID(req.SellerID)
			if err != nil {
				return nil, &AppError{Message: "Seller not found", StatusCode: http.StatusNotFound}
			}
			sellerFirstName, sellerLastName = seller.FirstName, seller.LastName
		}

		// Create the chat request with the reference title
		chatRequest := models.NewChatRequest(
			referenceObjectID, req.ReferenceType, referenceTitle,
			buyerObjectID, sellerObjectID,
		)

		_, err = chatRequests.InsertOne(sessCtx, chatRequest)
		if err != nil {
			return nil, err
		}

		// ✅ Update "requestedBy" field for all types
		switch req.ReferenceType {
		case "gig":
			gigsCol := db.GetCollection("gridlyapp", "gigs")
			_, err = gigsCol.UpdateOne(
				sessCtx,
				bson.M{"_id": referenceObjectID},
				bson.M{"$addToSet": bson.M{"requestedBy": buyerObjectID}},
			)
			if err != nil {
				return nil, err
			}

		case "product":
			productsCol := db.GetCollection("gridlyapp", "products")
			_, err = productsCol.UpdateOne(
				sessCtx,
				bson.M{"_id": referenceObjectID},
				bson.M{"$addToSet": bson.M{"requestedBy": buyerObjectID}},
			)
			if err != nil {
				return nil, err
			}

		case "product_request":
			requestsCol := db.GetCollection("gridlyapp", "product_requests")
			_, err = requestsCol.UpdateOne(
				sessCtx,
				bson.M{"_id": referenceObjectID},
				bson.M{"$addToSet": bson.M{"requestedBy": buyerObjectID}},
			)
			if err != nil {
				return nil, err
			}
		}

		return map[string]interface{}{
			"message":         "Chat request sent successfully",
			"buyerFirstName":  buyerFirstName,
			"buyerLastName":   buyerLastName,
			"sellerFirstName": sellerFirstName,
			"sellerLastName":  sellerLastName,
		}, nil
	}

	res, err := session.WithTransaction(context.Background(), callback)
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
	json.NewEncoder(w).Encode(res)
}

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
			"referenceId":   chatReq.ReferenceID,
			"buyerId":       chatReq.BuyerID,
			"sellerId":      chatReq.SellerID,
			"referenceType": chatReq.ReferenceType,
		}).Decode(&existingChat)
		if err == nil {
			return nil, &AppError{Message: "Chat already exists for this request", StatusCode: http.StatusConflict}
		} else if err != mongo.ErrNoDocuments {
			return nil, err
		}

		// ✅ Create the new chat
		newChat = models.NewChat(chatReq.ReferenceID, chatReq.ReferenceType, chatReq.BuyerID, chatReq.SellerID)
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

	// ✅ Create Firestore chat room asynchronously
	go func() {
		log.Printf("Attempting to create Firestore chat room for chat: %s", newChat.ID.Hex())
		err := createFirestoreChatRoom(newChat.ID.Hex(), newChat.BuyerID.Hex(), newChat.SellerID.Hex(), newChat.ReferenceID.Hex(), newChat.ReferenceType)
		if err != nil {
			log.Printf("🔥 Firestore chat room creation failed for chat %s: %v", newChat.ID.Hex(), err)
		} else {
			log.Printf("✅ Firestore chat room successfully created for chat: %s", newChat.ID.Hex())
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
		gigsCol := db.GetCollection("gridlyapp", "gigs")

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

		// Update chat request status to "rejected"
		update := bson.M{"$set": bson.M{"status": models.ChatRequestStatusRejected}}
		_, err = chatRequests.UpdateOne(sessCtx, bson.M{"_id": requestObjID}, update)
		if err != nil {
			return nil, err
		}

		var collection *mongo.Collection
		if chatReq.ReferenceType == "product" {
			collection = productsCol
		} else if chatReq.ReferenceType == "gig" {
			collection = gigsCol
		} else if chatReq.ReferenceType == "product_request" {
			collection = db.GetCollection("gridlyapp", "product_requests")
		} else {
			return nil, &AppError{Message: "Invalid reference type", StatusCode: http.StatusInternalServerError}
		}

		// Decrease chat count for the referenced item (product or gig)
		_, err = collection.UpdateOne(
			sessCtx,
			bson.M{"_id": chatReq.ReferenceID},
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

func GetChatRequestsHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	// Assumes middleware set userID in context
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

	// Only include pending requests
	filter := bson.M{
		"$and": []bson.M{
			{"$or": []bson.M{
				{"buyerId": userObjID},
				{"sellerId": userObjID},
			}},
			{"status": models.ChatRequestStatusPending},
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
		var referenceTitle string
		var referenceType string
		var isAnonymous bool = false

		// ✅ Fetch the correct reference title based on type (product or gig)
		if req.ReferenceType == "product" {
			product, err := db.GetProductByID(req.ReferenceID.Hex())
			if err != nil {
				log.Printf("Failed to fetch product details for referenceID %s: %v", req.ReferenceID.Hex(), err)
				continue
			}
			referenceTitle = product.Title
			referenceType = "product"
		} else if req.ReferenceType == "gig" {
			gig, err := db.GetGigByID(req.ReferenceID.Hex())
			if err != nil {
				log.Printf("Failed to fetch gig details for referenceID %s: %v", req.ReferenceID.Hex(), err)
				continue
			}
			referenceTitle = gig.Title
			referenceType = "gig"
			isAnonymous = gig.IsAnonymous // ✅ Check if gig is anonymous
		} else if req.ReferenceType == "product_request" {
			productRequest, err := db.GetProductRequestByID(req.ReferenceID.Hex())
			if err != nil {
				log.Printf("Failed to fetch product request details for requestID %s: %v", req.ReferenceID.Hex(), err)
				continue
			}
			referenceTitle = productRequest.ProductName
			referenceType = "product_request"
		}

		// ✅ Fetch buyer and seller details (or set to "Anonymous User" if the gig is anonymous)
		var buyerFirstName, buyerLastName, sellerFirstName, sellerLastName string
		if isAnonymous {
			buyerFirstName, buyerLastName = "Anonymous", "User"
			sellerFirstName, sellerLastName = "Anonymous", "User"
		} else {
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

			buyerFirstName, buyerLastName = buyer.FirstName, buyer.LastName
			sellerFirstName, sellerLastName = seller.FirstName, seller.LastName
		}

		// ✅ Create the enriched chat request object
		enrichedReq := EnrichedChatRequest{
			RequestID:       req.ID.Hex(),
			ReferenceID:     req.ReferenceID.Hex(),
			ReferenceTitle:  referenceTitle,
			ReferenceType:   referenceType,
			BuyerID:         req.BuyerID.Hex(),
			SellerID:        req.SellerID.Hex(),
			Status:          req.Status,
			CreatedAt:       req.CreatedAt.Format(time.RFC3339),
			BuyerFirstName:  buyerFirstName, // ✅ Correctly assigns Anonymous User if needed
			BuyerLastName:   buyerLastName,
			SellerFirstName: sellerFirstName, // ✅ Correctly assigns Anonymous User if needed
			SellerLastName:  sellerLastName,
		}

		// ✅ Separate into incoming or outgoing requests
		if req.BuyerID.Hex() == userID {
			outgoingRequests = append(outgoingRequests, enrichedReq)
		} else if req.SellerID.Hex() == userID {
			incomingRequests = append(incomingRequests, enrichedReq)
		}
	}

	// ✅ Send the final response
	WriteJSON(w, map[string]interface{}{
		"incomingRequests": incomingRequests,
		"outgoingRequests": outgoingRequests,
	}, http.StatusOK)
}

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

// createFirestoreChatRoom creates a new chat room in Firestore for both products and gigs.
func createFirestoreChatRoom(chatID, buyerID, sellerID, referenceID, referenceType string) error {
	ctx := context.Background()
	client, err := firestore.NewClient(ctx, "gridlychat", option.WithCredentialsJSON(serviceAccountJSON))
	if err != nil {
		return fmt.Errorf("failed to create Firestore client: %v", err)
	}
	defer client.Close()

	docRef := client.Collection("chatRooms").Doc(chatID)
	data := map[string]interface{}{
		"chatID":        chatID,
		"referenceID":   referenceID,   // ✅ Can be either a ProductID or a GigID
		"referenceType": referenceType, // ✅ "product", "gig", or "product_request"

		"buyerID":   buyerID,
		"sellerID":  sellerID,
		"createdAt": time.Now().Format(time.RFC3339),
		"messages":  []interface{}{},
	}

	_, err = docRef.Set(ctx, data)
	if err != nil {
		return fmt.Errorf("failed to create Firestore chat room: %v", err)
	}
	log.Printf("Firestore chat room created: %s (Type: %s)", chatID, referenceType)
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
