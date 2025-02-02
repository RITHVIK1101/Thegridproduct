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
	// Load environment variables from .env file if available
	err := godotenv.Load()
	if err != nil {
		log.Println("Error loading .env file, proceeding with system environment variables")
	}
	// Load SMTP Credentials
	smtpUser := os.Getenv("SMTP_USER")
	smtpPass := os.Getenv("SMTP_PASS")
	smtpHost := os.Getenv("SMTP_HOST")
	smtpPort := os.Getenv("SMTP_PORT")

	if smtpUser == "" || smtpPass == "" || smtpHost == "" || smtpPort == "" {
		log.Fatal("SMTP credentials are missing. Check .env file or system environment variables.")
	} else {
		log.Println("SMTP credentials loaded successfully")
	}

	// Retrieve and validate JWT secret key
	jwtSecret := os.Getenv("JWT_SECRET_KEY")
	if jwtSecret == "" {
		log.Fatal("JWT_SECRET_KEY is not set in environment variables")
	} else {
		log.Println("JWT_SECRET_KEY loaded successfully")
	}

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
	protected.Use(handlers.AuthMiddleware)

	protected.HandleFunc("/products", handlers.AddProductHandler).Methods("POST")
	protected.HandleFunc("/products/user", handlers.GetUserProductsHandler).Methods("GET")
	protected.HandleFunc("/products/all", handlers.GetAllProductsHandler).Methods("GET")
	protected.HandleFunc("/products/by-ids", handlers.GetProductsByIDsHandler).Methods("GET")
	protected.HandleFunc("/products/liked", handlers.GetLikedProductsHandler).Methods("GET")
	protected.HandleFunc("/products/{id}", handlers.GetSingleProductHandler).Methods("GET")
	protected.HandleFunc("/products/{id}", handlers.DeleteProductHandler).Methods("DELETE")
	protected.HandleFunc("/products/{id}", handlers.UpdateProductHandler).Methods("PUT")

	// Liked Products
	protected.HandleFunc("/products/{id}/like", handlers.LikeProductHandler).Methods("POST")
	protected.HandleFunc("/products/{id}/unlike", handlers.UnlikeProductHandler).Methods("POST")

	// Cart & Orders
	protected.HandleFunc("/cart", handlers.GetCartHandler).Methods("GET")
	protected.HandleFunc("/cart/add", handlers.AddToCartHandler).Methods("POST")
	protected.HandleFunc("/cart/remove", handlers.RemoveFromCartHandler).Methods("POST")
	protected.HandleFunc("/orders", handlers.GetAllOrdersHandler).Methods("GET")

	// NEW Chat Request Routes
	protected.HandleFunc("/chat/request", handlers.RequestChatHandler).Methods("POST")
	protected.HandleFunc("/chat/accept", handlers.AcceptChatRequestHandler).Methods("POST")
	protected.HandleFunc("/chat/reject", handlers.RejectChatRequestHandler).Methods("POST")
	protected.HandleFunc("/chat/requests", handlers.GetChatRequestsHandler).Methods("GET")

	protected.HandleFunc("/chats/user/{userId}", handlers.GetChatsByUserHandler).Methods("GET")
	protected.HandleFunc("/chats/{chatId}", handlers.GetChatHandler).Methods("GET")
	protected.HandleFunc("/chats/{chatId}/messages", handlers.AddMessageHandler).Methods("POST")
	protected.HandleFunc("/chats/{chatId}/messages", handlers.GetMessagesHandler).Methods("GET")
	protected.HandleFunc("/chat/test-send-message", handlers.TestSendMessageHandler).Methods("POST")
	// User Routes
	protected.HandleFunc("/users/{id}", handlers.GetUserHandler).Methods("GET")

	protected.HandleFunc("/requests", handlers.CreateProductRequestHandler).Methods("POST")
	protected.HandleFunc("/requests/my", handlers.GetMyProductRequestsHandler).Methods("GET")
	protected.HandleFunc("/requests/all", handlers.GetAllOtherProductRequestsHandler).Methods("GET")
	protected.HandleFunc("/requests/{id}", handlers.DeleteProductRequestHandler).Methods("DELETE")

	// AI Processing
	protected.HandleFunc("/services", handlers.AddGigHandler).Methods("POST")
	protected.HandleFunc("/services", handlers.GetAllGigsHandler).Methods("GET")
	protected.HandleFunc("/services/user", handlers.GetUserGigsHandler).Methods("GET")
	protected.HandleFunc("/services/{id}", handlers.GetSingleGigHandler).Methods("GET")
	protected.HandleFunc("/services/{id}", handlers.UpdateGigHandler).Methods("PUT")
	protected.HandleFunc("/services/{id}", handlers.DeleteGigHandler).Methods("DELETE")
	protected.HandleFunc("/report", handlers.ReportChatHandler).Methods("POST")

	// AI Processing
	protected.HandleFunc("/ai/process", handlers.ProcessAIInput).Methods("POST")

	// Not Found Handler
	router.NotFoundHandler = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		handlers.WriteJSONError(w, "Endpoint not found", http.StatusNotFound)
	})

	// Start the server with graceful shutdown
	port := getEnv("PORT", "8080")
	server := &http.Server{
		Addr:    fmt.Sprintf(":%s", port),
		Handler: router,
	}

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt)

	go func() {
		log.Printf("Server is running on port %s", port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Failed to start server: %v", err)
		}
	}()

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
