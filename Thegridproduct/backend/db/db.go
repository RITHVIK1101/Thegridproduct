// db/db.go

package db

import (
	"Thegridproduct/backend/models"
	"context"
	"errors"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/google/uuid"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// MongoDBClient is the global MongoDB client
var MongoDBClient *mongo.Client

// ConnectDB initializes the MongoDB connection and sets up indexes
func ConnectDB() {
	// Get MongoDB URI from environment variables
	mongoURI := os.Getenv("MONGODB_URI")
	if mongoURI == "" {
		log.Fatal("MONGODB_URI is not set in the environment variables")
	}

	// Set client options
	clientOptions := options.Client().ApplyURI(mongoURI)

	// Connect to MongoDB with a timeout context
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	client, err := mongo.Connect(ctx, clientOptions)
	if err != nil {
		log.Fatalf("MongoDB connection error: %v", err)
	}

	// Ping the database to verify connection
	err = client.Ping(ctx, nil)
	if err != nil {
		log.Fatalf("MongoDB ping error: %v", err)
	}

	fmt.Println("Connected to MongoDB successfully")
	MongoDBClient = client

	// Set up indexes
	if err := setupIndexes(ctx); err != nil {
		log.Fatalf("Failed to set up indexes: %v", err)
	}
}

// setupIndexes creates necessary indexes for the chats collection
func setupIndexes(ctx context.Context) error {
	collection := GetCollection("gridlyapp", "chats")

	// Define indexes
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

	// Create indexes
	_, err := collection.Indexes().CreateMany(ctx, indexes)
	if err != nil {
		return fmt.Errorf("error creating indexes: %v", err)
	}

	fmt.Println("Indexes created successfully")
	return nil
}

func generateID() string {
	return uuid.New().String()
}

// DisconnectDB disconnects from MongoDB
func DisconnectDB() {
	if MongoDBClient != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		err := MongoDBClient.Disconnect(ctx)
		if err != nil {
			log.Printf("Error disconnecting from MongoDB: %v", err)
		} else {
			fmt.Println("Disconnected from MongoDB successfully")
		}
	}
}

// GetCollection returns a MongoDB collection
func GetCollection(database string, collection string) *mongo.Collection {
	if MongoDBClient == nil {
		log.Fatal("MongoDB client is not initialized. Call ConnectDB() before using this function.")
	}
	return MongoDBClient.Database(database).Collection(collection)
}

// CreateChat creates a new chat entry in the database
func CreateChat(chat *models.Chat) error {
	collection := GetCollection("gridlyapp", "chats") // Ensure "gridlyapp" is your correct database name

	// Set the chat ID if not already set
	if chat.ID == "" {
		chat.ID = generateID() // Implement a unique ID generator, e.g., UUID or ObjectID
	}

	// Insert the chat document
	_, err := collection.InsertOne(context.Background(), chat)
	if err != nil {
		log.Printf("Error inserting chat: %v", err)
		return fmt.Errorf("failed to create chat: %v", err)
	}
	return nil
}

// FindChatsByUser retrieves chats involving a specific user (either buyer or seller)
func FindChatsByUser(userID string) ([]models.Chat, error) {
	collection := GetCollection("gridlyapp", "chats") // Ensure "gridlyapp" is your correct database name

	filter := bson.M{
		"$or": []bson.M{
			{"buyerId": userID},
			{"sellerId": userID},
		},
	}

	cursor, err := collection.Find(context.Background(), filter)
	if err != nil {
		log.Printf("Error finding chats for user %s: %v", userID, err)
		return nil, fmt.Errorf("failed to find chats: %v", err)
	}
	defer cursor.Close(context.Background())

	var chats []models.Chat
	if err := cursor.All(context.Background(), &chats); err != nil {
		log.Printf("Error decoding chats for user %s: %v", userID, err)
		return nil, fmt.Errorf("failed to decode chats: %v", err)
	}

	return chats, nil
}

// AddMessageToChat adds a new message to an existing chat
func AddMessageToChat(chatID string, message models.Message) error {
	collection := GetCollection("gridlyapp", "chats") // Ensure "gridlyapp" is your correct database name

	filter := bson.M{"_id": chatID} // Use "_id" to match the chat document
	update := bson.M{
		"$push": bson.M{
			"messages": message,
		},
	}

	_, err := collection.UpdateOne(context.Background(), filter, update)
	if err != nil {
		log.Printf("Error adding message to chat %s: %v", chatID, err)
		return fmt.Errorf("failed to add message to chat: %v", err)
	}
	return nil
}

// GetChatByProductID retrieves a chat by its associated product ID
func GetChatByProductID(productID string) (*models.Chat, error) {
	collection := GetCollection("gridlyapp", "chats") // Ensure "gridlyapp" is your correct database name

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	filter := bson.M{"productId": productID}
	var chat models.Chat
	err := collection.FindOne(ctx, filter).Decode(&chat)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			log.Printf("Chat with productId %s not found", productID)
			return nil, errors.New("chat not found")
		}
		log.Printf("Error fetching chat by productId %s: %v", productID, err)
		return nil, fmt.Errorf("error fetching chat: %v", err)
	}

	return &chat, nil
}

// GetChatByID retrieves a chat by its unique ID
func GetChatByID(chatID string) (*models.Chat, error) {
	collection := GetCollection("gridlyapp", "chats") // Ensure "gridlyapp" is your correct database name

	var chat models.Chat
	err := collection.FindOne(context.TODO(), bson.M{"_id": chatID}).Decode(&chat)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			log.Printf("Chat with ID %s not found", chatID)
			return nil, errors.New("chat not found")
		}
		log.Printf("Error fetching chat by ID %s: %v", chatID, err)
		return nil, fmt.Errorf("error fetching chat: %v", err)
	}
	return &chat, nil
}

// GetUserByID retrieves a user by their ID from university_users or highschool_users
func GetUserByID(userID string) (*models.User, error) {
	// Attempt to find the user in university_users collection
	user, err := findUserInCollection("gridlyapp", "university_users", userID)
	if err == nil {
		return user, nil
	}

	// If not found, attempt to find the user in highschool_users collection
	user, err = findUserInCollection("gridlyapp", "highschool_users", userID)
	if err == nil {
		return user, nil
	}

	// If not found in both collections, return an error
	log.Printf("User with ID %s not found in any collection", userID)
	return nil, errors.New("user not found in any collection")
}

// findUserInCollection searches for a user in a specific collection
func findUserInCollection(database string, collectionName string, userID string) (*models.User, error) {
	collection := GetCollection(database, collectionName)

	// Convert string ID to ObjectID
	objectID, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		log.Printf("Invalid user ID format %s: %v", userID, err)
		return nil, fmt.Errorf("invalid user ID format: %v", err)
	}

	var user models.User
	err = collection.FindOne(context.TODO(), bson.M{"_id": objectID}).Decode(&user)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			log.Printf("User with ID %s not found in %s collection", userID, collectionName)
			return nil, errors.New("user not found")
		}
		log.Printf("Error fetching user with ID %s from %s collection: %v", userID, collectionName, err)
		return nil, fmt.Errorf("error fetching user: %v", err)
	}
	return &user, nil
}
