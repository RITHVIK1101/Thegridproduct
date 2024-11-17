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

	"github.com/gorilla/mux"
	"github.com/joho/godotenv"
)

func main() {
	// Load environment variables from .env file
	err := godotenv.Load()
	if err != nil {
		log.Println("Error loading .env file, proceeding with system environment variables")
	}

	// Connect to MongoDB
	db.ConnectDB()
	defer db.DisconnectDB() // Ensure MongoDB disconnects when main exits

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
	protected.Use(handlers.AuthMiddleware)

	// Product Routes
	protected.HandleFunc("/products", handlers.AddProductHandler).Methods("POST")
	protected.HandleFunc("/products/user", handlers.GetUserProductsHandler).Methods("GET")
	protected.HandleFunc("/products/all", handlers.GetAllProductsHandler).Methods("GET")
	protected.HandleFunc("/products/by-ids", handlers.GetProductsByIDsHandler).Methods("GET")
	protected.HandleFunc("/products/{id}", handlers.GetSingleProductHandler).Methods("GET")
	protected.HandleFunc("/products/{id}", handlers.DeleteProductHandler).Methods("DELETE")
	protected.HandleFunc("/products/{id}", handlers.UpdateProductHandler).Methods("PUT")
	protected.HandleFunc("/products/bulk", handlers.AddMultipleProductsHandler).Methods("POST")

	// Gig Routes
	protected.HandleFunc("/gigs", handlers.AddGigHandler).Methods("POST")
	protected.HandleFunc("/gigs/all", handlers.GetGigsHandler).Methods("GET")
	protected.HandleFunc("/gigs/{id}", handlers.GetGigByIDHandler).Methods("GET")

	// Cart Routes
	protected.HandleFunc("/cart", handlers.GetCartHandler).Methods("GET")
	protected.HandleFunc("/cart/add", handlers.AddToCartHandler).Methods("POST")
	protected.HandleFunc("/cart/remove", handlers.RemoveFromCartHandler).Methods("POST")
	protected.HandleFunc("/cart/clear", handlers.ClearCartHandler).Methods("POST") // Optional

	// **User Routes**
	protected.HandleFunc("/users/{id}", handlers.GetUserHandler).Methods("GET")

	// Handle undefined routes
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
