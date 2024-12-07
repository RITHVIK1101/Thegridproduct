package handlers

import (
	"log"
	"net/http"
	"os"
	"strings"

	"Thegridproduct/backend/models"

	"github.com/golang-jwt/jwt/v4"
	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"
)

// WebSocket Upgrader with sensible defaults
var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	// In production, restrict origins to your frontend domain
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

// ServeWS handles WebSocket requests from the client.
func (h *Hub) ServeWS(w http.ResponseWriter, r *http.Request) {
	// Extract chatId and userId from URL parameters
	vars := mux.Vars(r)
	chatID, ok := vars["chatId"]
	if !ok || chatID == "" {
		http.Error(w, "Chat ID is required", http.StatusBadRequest)
		return
	}

	userID, ok := vars["userId"]
	if !ok || userID == "" {
		http.Error(w, "User ID is required", http.StatusBadRequest)
		return
	}

	// Extract token from query parameters
	tokenString := r.URL.Query().Get("token")
	if tokenString == "" {
		http.Error(w, "Authorization token is required", http.StatusUnauthorized)
		return
	}
	// Validate the JWT token directly
	jwtSecret := []byte(os.Getenv("JWT_SECRET_KEY"))
	if len(jwtSecret) == 0 {
		log.Println("JWT_SECRET_KEY is not set in environment variables")
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	claims := &Claims{}

	// Parse and validate the JWT
	token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, jwt.ErrSignatureInvalid
		}
		return jwtSecret, nil
	})
	if err != nil || !token.Valid {
		log.Printf("JWT validation error: %v", err)
		http.Error(w, "Invalid or expired token", http.StatusUnauthorized)
		return
	}

	// Ensure the token's user ID matches the userId in the URL
	if strings.TrimSpace(claims.UserID) != userID {
		http.Error(w, "Token does not match user ID", http.StatusUnauthorized)
		return
	}

	// Upgrade the HTTP connection to a WebSocket connection
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket Upgrade error: %v", err)
		return
	}

	// Create a new client
	client := &Client{
		hub:    h,
		chatID: chatID,
		conn:   conn,
		send:   make(chan models.Message),
		userID: userID,
	}

	// Register the client with the hub
	h.register <- Registration{chatID: chatID, client: client}

	// Start the client's read and write pumps
	go client.writePump()
	go client.readPump()
}
