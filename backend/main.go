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
	Name        string   `json:"name"`
	Price       string   `json:"price"`
	Description string   `json:"description"`
	Tags        []string `json:"tags"`
	Images      []string `json:"images"`
}

var client *mongo.Client
var productCollection *mongo.Collection

func main() {
	// Replace with your MongoDB connection string
	clientOptions := options.Client().ApplyURI("mongodb+srv://rithviksaba:BFoIjfRj3rN6zfd4@db.hzf98.mongodb.net/?retryWrites=true&w=majority&appName=DB")

	var err error
	client, err = mongo.Connect(context.TODO(), clientOptions)
	if err != nil {
		log.Fatal(err)
	}

	defer func() {
		if err := client.Disconnect(context.TODO()); err != nil {
			log.Fatal(err)
		}
	}()

	err = client.Ping(context.TODO(), nil)
	if err != nil {
		log.Fatal("Could not connect to MongoDB:", err)
	}

	fmt.Println("Connected to MongoDB successfully")

	productCollection = client.Database("gridlyapp").Collection("products")

	http.HandleFunc("/products", addProductHandler)
	http.HandleFunc("/products/all", getProductsHandler)

	fmt.Println("Server is running on port 8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}

func addProductHandler(w http.ResponseWriter, r *http.Request) {
	// Set CORS headers
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

	// Handle preflight OPTIONS request

	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method != http.MethodPost {
		http.Error(w, "Invalid request method", http.StatusMethodNotAllowed)
		return
	}

	// Set response content type
	w.Header().Set("Content-Type", "application/json")

	var product Product
	if err := json.NewDecoder(r.Body).Decode(&product); err != nil {
		log.Printf("Error decoding request body: %v", err)
		http.Error(w, "Invalid input", http.StatusBadRequest)
		return
	}

	// Validate required fields
	if product.Name == "" || product.Price == "" || product.Description == "" {
		http.Error(w, "Missing required fields", http.StatusBadRequest)
		return
	}
	if len(product.Tags) == 0 || len(product.Images) == 0 {
		http.Error(w, "Tags and images cannot be empty", http.StatusBadRequest)
		return
	}

	// Insert the product
	result, err := productCollection.InsertOne(context.TODO(), product)
	if err != nil {
		log.Printf("Error inserting product: %v", err)
		http.Error(w, "Error saving product", http.StatusInternalServerError)
		return
	}

	// Return success response
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message": "Product added successfully",
		"id":      result.InsertedID,
	})
}
func getProductsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Invalid request method", http.StatusMethodNotAllowed)
		return
	}

	w.Header().Set("Content-Type", "application/json")

	cursor, err := productCollection.Find(context.TODO(), bson.M{})
	if err != nil {
		log.Println("Error fetching products:", err)
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "Error fetching products"})
		return
	}
	defer cursor.Close(context.TODO())

	var products []Product
	if err := cursor.All(context.TODO(), &products); err != nil {
		log.Println("Error decoding products:", err)
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "Error decoding products"})
		return
	}

	log.Printf("Fetched products: %+v\n", products) // Debugging log
	json.NewEncoder(w).Encode(products)
}
