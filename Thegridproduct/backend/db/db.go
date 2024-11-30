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
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// MongoDBClient is the global MongoDB client
var MongoDBClient *mongo.Client

// ConnectDB initializes the MongoDB connection
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
func CreateChat(chat models.Chat) error {
	collection := GetCollection("TheGridlyDB", "chats") // Replace "TheGridlyDB" with your database name

	// Set the chat ID if not already set
	if chat.ID == "" {
		chat.ID = generateID() // Implement a unique ID generator, e.g., UUID or ObjectID
	}

	// Insert the chat document
	_, err := collection.InsertOne(context.Background(), chat)
	if err != nil {
		return fmt.Errorf("failed to create chat: %v", err)
	}
	return nil
}

// FindChatsByUser retrieves chats involving a specific user (either buyer or seller)
func FindChatsByUser(userID string) ([]models.Chat, error) {
	collection := GetCollection("TheGridlyDB", "chats") // Replace "TheGridlyDB" with your database name

	filter := bson.M{
		"$or": []bson.M{
			{"buyerId": userID},
			{"sellerId": userID},
		},
	}

	cursor, err := collection.Find(context.Background(), filter)
	if err != nil {
		return nil, fmt.Errorf("failed to find chats: %v", err)
	}
	defer cursor.Close(context.Background())

	var chats []models.Chat
	if err := cursor.All(context.Background(), &chats); err != nil {
		return nil, fmt.Errorf("failed to decode chats: %v", err)
	}

	return chats, nil
}

// AddMessageToChat adds a message to an existing chat
func AddMessageToChat(chatID string, message models.Message) error {
	collection := GetCollection("TheGridlyDB", "chats") // Replace "TheGridlyDB" with your database name

	filter := bson.M{"id": chatID}
	update := bson.M{
		"$push": bson.M{
			"messages": message,
		},
	}

	_, err := collection.UpdateOne(context.Background(), filter, update)
	if err != nil {
		return fmt.Errorf("failed to add message to chat: %v", err)
	}
	return nil
}
func GetChatByProductID(productID string) (*models.Chat, error) {
	collection := GetCollection("TheGridlyDB", "chats") // Replace with your DB and collection names

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	filter := bson.M{"productId": productID}
	var chat models.Chat
	err := collection.FindOne(ctx, filter).Decode(&chat)
	if err != nil {
		return nil, errors.New("chat not found")
	}

	return &chat, nil
}
