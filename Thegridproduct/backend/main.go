// main.go

package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"time"

	"Thegridproduct/backend/db"
	"Thegridproduct/backend/handlers"

	"github.com/ably/ably-go/ably"
	"github.com/gorilla/mux"
	"github.com/joho/godotenv"
	"github.com/stripe/stripe-go/v72"
)

func main() {
	// Load environment variables from .env file if available
	err := godotenv.Load()
	if err != nil {
		log.Println("Error loading .env file, proceeding with system environment variables")
	}

	// Retrieve and validate JWT secret key
	jwtSecret := os.Getenv("JWT_SECRET_KEY")
	if jwtSecret == "" {
		log.Fatal("JWT_SECRET_KEY is not set in environment variables")
	} else {
		log.Println("JWT_SECRET_KEY loaded successfully")
	}

	// Retrieve and set Stripe secret key
	stripeKey := os.Getenv("STRIPE_SECRET_KEY")
	if stripeKey == "" {
		log.Fatal("STRIPE_SECRET_KEY is not set in environment variables")
	}
	stripe.Key = stripeKey

	// Retrieve and validate Ably API key
	ablyAPIKey := os.Getenv("ABLY_API_KEY")
	if ablyAPIKey == "" {
		log.Fatal("ABLY_API_KEY is not set in environment variables")
	}

	// Initialize the Ably client
	ablyClient, err := ably.NewRealtime(ably.WithKey(ablyAPIKey))
	if err != nil {
		log.Fatalf("Failed to initialize Ably client: %v", err)
	}
	log.Println("Ably client initialized successfully")

	// Pass the Ably client to handlers
	handlers.SetAblyClient(ablyClient)

	// Connect to MongoDB
	db.ConnectDB()
	log.Println("Connected to MongoDB successfully.")
	defer func() {
		log.Println("Disconnecting from MongoDB...")
		db.DisconnectDB()
		log.Println("MongoDB disconnected successfully.")
	}()

	// Initialize router
	router := mux.NewRouter()

	// Apply global CORS middleware
	router.Use(handlers.CORS)

	// Public Routes
	router.HandleFunc("/login", handlers.LoginHandler).Methods("POST")
	router.HandleFunc("/signup", handlers.SignupHandler).Methods("POST")
	router.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("Welcome to The Gridly API"))
	}).Methods("GET")

	// Protected Routes
	protected := router.PathPrefix("/").Subrouter()
	protected.Use(handlers.AuthMiddleware) // Ensure AuthMiddleware is implemented

	// Product Routes
	protected.HandleFunc("/products", handlers.AddProductHandler).Methods("POST")
	protected.HandleFunc("/products/user", handlers.GetUserProductsHandler).Methods("GET")
	protected.HandleFunc("/products/all", handlers.GetAllProductsHandler).Methods("GET")
	protected.HandleFunc("/products/by-ids", handlers.GetProductsByIDsHandler).Methods("GET")
	protected.HandleFunc("/products/liked", handlers.GetLikedProductsHandler).Methods("GET")
	protected.HandleFunc("/products/{id}", handlers.GetSingleProductHandler).Methods("GET")
	protected.HandleFunc("/products/{id}", handlers.DeleteProductHandler).Methods("DELETE")
	protected.HandleFunc("/products/{id}", handlers.UpdateProductHandler).Methods("PUT")

	// Liked Product Routes
	protected.HandleFunc("/products/{id}/like", handlers.LikeProductHandler).Methods("POST")
	protected.HandleFunc("/products/{id}/unlike", handlers.UnlikeProductHandler).Methods("POST")

	// Cart Routes
	protected.HandleFunc("/cart", handlers.GetCartHandler).Methods("GET")
	protected.HandleFunc("/cart/add", handlers.AddToCartHandler).Methods("POST")
	protected.HandleFunc("/cart/remove", handlers.RemoveFromCartHandler).Methods("POST")
	protected.HandleFunc("/orders", handlers.GetAllOrdersHandler).Methods("GET")

	// User Routes
	protected.HandleFunc("/users/{id}", handlers.GetUserHandler).Methods("GET")
	protected.HandleFunc("/chats/user/{userId}", handlers.GetChatsByUserHandler).Methods("GET")
	protected.HandleFunc("/chats/{chatId}", handlers.GetChatHandler).Methods("GET")
	protected.HandleFunc("/chats/{chatId}/messages", handlers.AddMessageHandler).Methods("POST")
	protected.HandleFunc("/chats/{chatId}/messages", handlers.GetMessagesHandler).Methods("GET")

	// Real-time Messaging Route using Ably
	protected.HandleFunc("/messages", handlers.PublishMessageHandler).Methods("POST")

	// Payment Routes
	protected.HandleFunc("/create-payment-intent", handlers.CreatePaymentIntentHandler).Methods("POST")
	protected.HandleFunc("/payment/save-method", handlers.SavePaymentMethodHandler).Methods("POST")
	protected.HandleFunc("/payment/saved-methods", handlers.GetSavedPaymentMethodsHandler).Methods("GET")
	protected.HandleFunc("/payment/charge-saved-method", handlers.ChargeSavedPaymentMethodHandler).Methods("POST")

	// === Gig (Service) Routes ===
	// Aligning endpoints with frontend's expectation of "/services"

	protected.HandleFunc("/services", handlers.AddGigHandler).Methods("POST")           // Create a new gig
	protected.HandleFunc("/services", handlers.GetAllGigsHandler).Methods("GET")        // Retrieve all gigs
	protected.HandleFunc("/services/user", handlers.GetUserGigsHandler).Methods("GET")  // Retrieve gigs for the authenticated user
	protected.HandleFunc("/services/{id}", handlers.GetSingleGigHandler).Methods("GET") // Retrieve a single gig by ID
	protected.HandleFunc("/services/{id}", handlers.UpdateGigHandler).Methods("PUT")    // Update a gig by ID
	protected.HandleFunc("/services/{id}", handlers.DeleteGigHandler).Methods("DELETE")

	router.NotFoundHandler = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		handlers.WriteJSONError(w, "Endpoint not found", http.StatusNotFound)
	})

	// Start the server with graceful shutdown handling
	port := getEnv("PORT", "8080")
	server := &http.Server{
		Addr:    fmt.Sprintf(":%s", port),
		Handler: router,
	}

	// Channel to listen for OS signals to gracefully shut down
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt)

	go func() {
		log.Printf("Server is running on port %s", port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Failed to start server: %v", err)
		}
	}()

	// Wait for an interrupt signal to gracefully shut down the server
	<-stop
	log.Println("Shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		log.Fatalf("Server shutdown failed: %v", err)
	}
	log.Println("Server gracefully stopped")
}

// getEnv retrieves environment variables or returns a default value.
func getEnv(key string, defaultVal string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return defaultVal
}
