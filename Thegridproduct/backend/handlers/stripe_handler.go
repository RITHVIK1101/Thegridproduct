// hadlers/stripe_handler.go
package handlers

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"Thegridproduct/backend/db"
	"Thegridproduct/backend/models"

	"github.com/stripe/stripe-go/v74"
	"github.com/stripe/stripe-go/v74/paymentintent"
)

// PaymentIntentRequest represents the expected JSON payload for creating a PaymentIntent
type PaymentIntentRequest struct {
	Amount    int64  `json:"amount"`    // Amount in cents
	Currency  string `json:"currency"`  // Currency (e.g., "usd")
	ProductID string `json:"productId"` // Product ID for which payment is being made
	BuyerID   string `json:"buyerId"`   // ID of the buyer
	SellerID  string `json:"sellerId"`  // ID of the seller
}

// CreatePaymentIntentHandler handles the creation of Stripe PaymentIntents and a chat session
func CreatePaymentIntentHandler(w http.ResponseWriter, r *http.Request) {
	// Load Stripe secret key
	stripe.Key = os.Getenv("STRIPE_SECRET_KEY")
	if stripe.Key == "" {
		http.Error(w, "Stripe secret key is not configured", http.StatusInternalServerError)
		return
	}

	// Parse the request body
	var request PaymentIntentRequest
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		http.Error(w, "Invalid request payload", http.StatusBadRequest)
		return
	}

	// Validate request data
	if request.Amount <= 0 || request.Currency == "" || request.ProductID == "" || request.BuyerID == "" || request.SellerID == "" {
		http.Error(w, "Invalid amount, currency, product ID, buyer ID, or seller ID", http.StatusBadRequest)
		return
	}

	// Check if chat already exists
	existingChat, err := db.GetChatByProductID(request.ProductID)
	if err == nil && existingChat.BuyerID == request.BuyerID && existingChat.SellerID == request.SellerID {
		http.Error(w, "Chat for this product already exists", http.StatusConflict)
		return
	}

	// Fetch buyer details
	buyer, err := db.GetUserByID(request.BuyerID)
	if err != nil {
		http.Error(w, "Buyer not found", http.StatusNotFound)
		return
	}

	// Fetch seller details
	seller, err := db.GetUserByID(request.SellerID)
	if err != nil {
		http.Error(w, "Seller not found", http.StatusNotFound)
		return
	}

	// Create the PaymentIntent
	params := &stripe.PaymentIntentParams{
		Amount:   stripe.Int64(request.Amount),
		Currency: stripe.String(request.Currency),
	}
	pi, err := paymentintent.New(params)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to create PaymentIntent: %v", err), http.StatusInternalServerError)
		return
	}

	// Create a chat session after successful PaymentIntent creation
	chat := models.Chat{
		ProductID: request.ProductID,
		BuyerID:   request.BuyerID,
		SellerID:  request.SellerID,
		Messages:  []models.Message{},
		CreatedAt: time.Now(),
	}

	if err := db.CreateChat(&chat); err != nil {
		http.Error(w, fmt.Sprintf("Failed to create chat session: %v", err), http.StatusInternalServerError)
		return
	}

	// Log the successful creation
	log.Printf("PaymentIntent created: %s for ProductID: %s", pi.ID, request.ProductID)
	log.Printf("Chat created: %s between Buyer: %s and Seller: %s", chat.ID, request.BuyerID, request.SellerID)

	// Respond with the client secret, chat ID, and confirmation message
	response := map[string]string{
		"clientSecret": pi.ClientSecret,
		"chatId":       chat.ID,
		"message":      fmt.Sprintf("Chat created between %s and %s.", buyer.FirstName, seller.FirstName),
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}
