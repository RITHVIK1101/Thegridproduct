package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type Product struct {
	Name  string `json:"name"`
	Price string `json:"price"`
	Tags  string `json:"tags"`
}

var client *mongo.Client
var productCollection *mongo.Collection

func main() {
	// Replace the following connection string with your MongoDB Atlas URI
	var err error
	clientOptions := options.Client().ApplyURI("mongodb+srv://rithviksaba:BFoIjfRj3rN6zfd4@db.hzf98.mongodb.net/?retryWrites=true&w=majority&appName=DB")

	client, err = mongo.Connect(context.TODO(), clientOptions)
	if err != nil {
		log.Fatal(err)
	}

	// Ping MongoDB to verify the connection
	err = client.Ping(context.TODO(), nil)
	if err != nil {
		log.Fatal("Could not connect to MongoDB:", err)
	}

	// Log a confirmation message on successful connection
	fmt.Println("Connected to MongoDB successfully")

	productCollection = client.Database("gridlyapp").Collection("products")

	// Routes
	http.HandleFunc("/products", addProductHandler)
	http.HandleFunc("/products/all", getProductsHandler)

	// Start server
	fmt.Println("Server is running on port 8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}

func addProductHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*") // Allow requests from any origin
	if r.Method != http.MethodPost {
		http.Error(w, "Invalid request method", http.StatusMethodNotAllowed)
		return
	}

	var product Product
	if err := json.NewDecoder(r.Body).Decode(&product); err != nil {
		http.Error(w, "Invalid input", http.StatusBadRequest)
		return
	}

	// Insert product into MongoDB
	_, err := productCollection.InsertOne(context.TODO(), product)
	if err != nil {
		http.Error(w, "Error saving product", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{"message": "Product added"})
}

func getProductsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Invalid request method", http.StatusMethodNotAllowed)
		return
	}

	// Retrieve all products
	cursor, err := productCollection.Find(context.TODO(), bson.M{})
	if err != nil {
		http.Error(w, "Error fetching products", http.StatusInternalServerError)
		return
	}
	defer cursor.Close(context.TODO())

	var products []Product
	if err := cursor.All(context.TODO(), &products); err != nil {
		http.Error(w, "Error decoding products", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(products)
}
