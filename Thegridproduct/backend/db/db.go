package db

import (
	"Thegridproduct/backend/models"
	"context"
	"errors"
	"fmt"
	"log"
	"os"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// MongoDBClient is the global MongoDB client
var MongoDBClient *mongo.Client

// ConnectDB initializes the MongoDB connection and sets up indexes
func ConnectDB() {
	mongoURI := os.Getenv("MONGODB_URI")
	if mongoURI == "" {
		log.Fatal("MONGODB_URI is not set in environment variables")
	}

	clientOptions := options.Client().ApplyURI(mongoURI)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	client, err := mongo.Connect(ctx, clientOptions)
	if err != nil {
		log.Fatalf("MongoDB connection error: %v", err)
	}

	// Verify the connection
	if err := client.Ping(ctx, nil); err != nil {
		log.Fatalf("MongoDB ping error: %v", err)
	}

	log.Println("Connected to MongoDB successfully")
	MongoDBClient = client

	// Create any needed indexes
	if err := setupIndexes(ctx); err != nil {
		log.Fatalf("Failed to set up indexes: %v", err)
	}
}

// setupIndexes creates necessary indexes for the chats collection
func setupIndexes(ctx context.Context) error {
	collection := GetCollection("gridlyapp", "chats")

	indexes := []mongo.IndexModel{
		{
			Keys:    bson.D{{Key: "buyerId", Value: 1}},
			Options: options.Index().SetName("buyerId_index"),
		},
		{
			Keys:    bson.D{{Key: "sellerId", Value: 1}},
			Options: options.Index().SetName("sellerId_index"),
		},
		{
			Keys:    bson.D{{Key: "productId", Value: 1}},
			Options: options.Index().SetName("productId_index"),
		},
	}

	_, err := collection.Indexes().CreateMany(ctx, indexes)
	if err != nil {
		return fmt.Errorf("error creating indexes: %v", err)
	}

	log.Println("Indexes created successfully")
	return nil
}

// DisconnectDB closes the MongoDB connection
func DisconnectDB() {
	if MongoDBClient != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		if err := MongoDBClient.Disconnect(ctx); err != nil {
			log.Printf("Error disconnecting from MongoDB: %v", err)
		} else {
			log.Println("Disconnected from MongoDB successfully.")
		}
	}
}

// GetCollection returns a MongoDB collection handle
func GetCollection(database, collection string) *mongo.Collection {
	if MongoDBClient == nil {
		log.Fatal("MongoDB client is not initialized. Call ConnectDB() first.")
	}
	return MongoDBClient.Database(database).Collection(collection)
}

// GetGigByID fetches a gig by its ObjectID.
func GetGigByID(gigIDStr string) (*models.Gig, error) {
	// Convert string ID to MongoDB ObjectID
	gigObjectID, err := primitive.ObjectIDFromHex(gigIDStr)
	if err != nil {
		return nil, fmt.Errorf("invalid Gig ID format")
	}

	// Get gigs collection
	collection := GetCollection("gridlyapp", "gigs")

	// Search for the gig
	var gig models.Gig
	err = collection.FindOne(context.TODO(), bson.M{"_id": gigObjectID}).Decode(&gig)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, fmt.Errorf("gig not found")
		}
		return nil, err
	}

	return &gig, nil
}

// CreateChat creates a new chat document (using a string ID or letting Mongo handle _id)
func CreateChat(chat *models.Chat) error {
	col := GetCollection("gridlyapp", "chats")

	// If CreatedAt not set, set it now
	if chat.CreatedAt.IsZero() {
		chat.CreatedAt = time.Now()
	}

	_, err := col.InsertOne(context.Background(), chat)
	if err != nil {
		log.Printf("Error inserting chat: %v", err)
		return fmt.Errorf("failed to create chat: %v", err)
	}
	return nil
}

// GetProductByID loads a Product by its string-based ID (hex)
func GetProductByID(productID string) (*models.Product, error) {
	col := GetCollection("gridlyapp", "products")

	objectID, err := primitive.ObjectIDFromHex(productID)
	if err != nil {
		log.Printf("Invalid product ID format '%s': %v", productID, err)
		return nil, fmt.Errorf("invalid product ID format: %v", err)
	}

	var product models.Product
	if err := col.FindOne(context.TODO(), bson.M{"_id": objectID}).Decode(&product); err != nil {
		if err == mongo.ErrNoDocuments {
			log.Printf("Product with ID '%s' not found", productID)
			return nil, errors.New("product not found")
		}
		log.Printf("Error fetching product with ID '%s': %v", productID, err)
		return nil, fmt.Errorf("error fetching product: %v", err)
	}
	return &product, nil
}

// FindChatsByUser finds all chats matching buyerId or sellerId == userID (string)
// FindChatsByUser returns all chats where the user is either the buyer or the seller.
func FindChatsByUser(userID string) ([]models.Chat, error) {
	// Convert userID from string to ObjectID
	userObjID, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		log.Printf("Invalid userID [%s]: %v", userID, err)
		return nil, err
	}

	// Get the "chats" collection
	collection := GetCollection("gridlyapp", "chats")

	// Build a filter that checks if the user is the buyer or the seller
	filter := bson.M{
		"$or": []bson.M{
			{"buyerId": userObjID},
			{"sellerId": userObjID},
		},
	}

	// Query the collection
	cursor, err := collection.Find(context.TODO(), filter)
	if err != nil {
		log.Printf("Error fetching chats for user [%s]: %v", userID, err)
		return nil, err
	}
	defer cursor.Close(context.TODO())

	// Decode results into a slice of Chat
	var chats []models.Chat
	if err := cursor.All(context.TODO(), &chats); err != nil {
		log.Printf("Error decoding chat results for user [%s]: %v", userID, err)
		return nil, err
	}

	return chats, nil
}

// AddMessageToChat pushes a new message into the messages array of the chat, using a string chatID
func AddMessageToChat(chatID string, message models.Message) error {
	col := GetCollection("gridlyapp", "chats")

	// Make sure chat exists
	var chat models.Chat
	if err := col.FindOne(context.Background(), bson.M{"_id": chatID}).Decode(&chat); err != nil {
		if err == mongo.ErrNoDocuments {
			log.Printf("Chat with ID '%s' not found", chatID)
			return errors.New("chat not found")
		}
		log.Printf("Error finding chat '%s': %v", chatID, err)
		return fmt.Errorf("failed to find chat: %v", err)
	}

	// Push the message into the existing chat doc
	update := bson.M{"$push": bson.M{"messages": message}}
	if _, err := col.UpdateOne(context.Background(), bson.M{"_id": chatID}, update); err != nil {
		log.Printf("Error adding message to chat '%s': %v", chatID, err)
		return fmt.Errorf("failed to add message: %v", err)
	}
	return nil
}

// GetChatByProductID loads the chat that references a specific product ID (string)
func GetChatByProductID(productID string) (*models.Chat, error) {
	col := GetCollection("gridlyapp", "chats")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	filter := bson.M{"productId": productID}
	var chat models.Chat
	if err := col.FindOne(ctx, filter).Decode(&chat); err != nil {
		if err == mongo.ErrNoDocuments {
			log.Printf("Chat with productId '%s' not found", productID)
			return nil, errors.New("chat not found")
		}
		log.Printf("Error fetching chat by productId '%s': %v", productID, err)
		return nil, fmt.Errorf("error fetching chat: %v", err)
	}
	return &chat, nil
}

// GetChatByReferenceID fetches a chat based on reference ID (Product or Gig) and type.
func GetChatByReferenceID(referenceIDStr, referenceType string) (*models.Chat, error) {
	// Convert string ID to MongoDB ObjectID
	referenceObjectID, err := primitive.ObjectIDFromHex(referenceIDStr)
	if err != nil {
		return nil, fmt.Errorf("invalid Reference ID format")
	}

	// Get chats collection
	collection := GetCollection("gridlyapp", "chats")

	// Search for the chat where referenceID matches and the type is correct
	filter := bson.M{"referenceId": referenceObjectID, "referenceType": referenceType}
	var chat models.Chat

	err = collection.FindOne(context.TODO(), filter).Decode(&chat)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, fmt.Errorf("chat not found")
		}
		return nil, err
	}

	return &chat, nil
}

// GetUserByID attempts to find a user in both university_users and highschool_users by string userID
func GetUserByID(userID string) (*models.User, error) {
	// Attempt in 'university_users' first
	user, err := findUserInCollection("gridlyapp", "university_users", userID)
	if err == nil {
		return user, nil
	}

	// If not found, attempt in 'highschool_users'
	user, err = findUserInCollection("gridlyapp", "highschool_users", userID)
	if err == nil {
		return user, nil
	}

	log.Printf("User with ID '%s' not found in any user collection", userID)
	return nil, errors.New("user not found")
}

// findUserInCollection is a helper that queries a single collection by string userID
func findUserInCollection(dbName, collName, userID string) (*models.User, error) {
	col := GetCollection(dbName, collName)

	// Convert the hex string to objectID for the user doc
	objID, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		log.Printf("Invalid userID format '%s': %v", userID, err)
		return nil, fmt.Errorf("invalid user ID format: %v", err)
	}

	var usr models.User
	if err := col.FindOne(context.Background(), bson.M{"_id": objID}).Decode(&usr); err != nil {
		if err == mongo.ErrNoDocuments {
			// Not found in this particular collection
			return nil, errors.New("user not found")
		}
		return nil, fmt.Errorf("error fetching user: %v", err)
	}
	return &usr, nil
}

// UpdateProductStatusAndBuyer updates the product's 'status' and 'buyerId' fields, by string ID
func UpdateProductStatusAndBuyer(productID, buyerID, newStatus string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	productCol := GetCollection("gridlyapp", "products")

	// Convert strings to ObjectIDs
	productObjID, err := primitive.ObjectIDFromHex(productID)
	if err != nil {
		return fmt.Errorf("invalid product ID format: %v", err)
	}
	buyerObjID, err := primitive.ObjectIDFromHex(buyerID)
	if err != nil {
		return fmt.Errorf("invalid buyer ID format: %v", err)
	}

	filter := bson.M{"_id": productObjID}
	update := bson.M{"$set": bson.M{"status": newStatus, "buyerId": buyerObjID}}

	res, err := productCol.UpdateOne(ctx, filter, update)
	if err != nil {
		log.Printf("Error updating product status/buyer: %v", err)
		return err
	}
	if res.MatchedCount == 0 {
		return errors.New("product not found")
	}
	return nil
}

// GetProductsByStatus returns all products with given status, excluding those owned by userID (string)
func GetProductsByStatus(status, userID string) ([]models.Product, error) {
	col := GetCollection("gridlyapp", "products")

	// Convert userID from hex string to objectID
	objectID, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		log.Printf("Invalid user ID format '%s': %v", userID, err)
		return nil, fmt.Errorf("invalid user ID format: %v", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	filter := bson.M{
		"status": status,
		"userId": bson.M{"$ne": objectID},
	}

	cursor, err := col.Find(ctx, filter)
	if err != nil {
		log.Printf("Error fetching products with status '%s': %v", status, err)
		return nil, fmt.Errorf("error fetching products: %v", err)
	}
	defer cursor.Close(ctx)

	var products []models.Product
	if err := cursor.All(ctx, &products); err != nil {
		log.Printf("Error decoding products: %v", err)
		return nil, fmt.Errorf("error decoding products: %v", err)
	}

	return products, nil
}
