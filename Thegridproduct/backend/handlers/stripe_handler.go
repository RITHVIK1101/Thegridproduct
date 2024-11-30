package handlers

import (
	"encoding/json"
	"fmt"
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
		Messages:  []models.Message{}, // Start with an empty chat
		CreatedAt: time.Now(),
	}

	if err := db.CreateChat(chat); err != nil {
		http.Error(w, fmt.Sprintf("Failed to create chat session: %v", err), http.StatusInternalServerError)
		return
	}

	// Respond with the client secret and chat ID
	response := map[string]string{
		"clientSecret": pi.ClientSecret,
		"chatId":       chat.ID, // Include chat ID for frontend reference
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}
