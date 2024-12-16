// handlers/stripe_handler.go
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
	"github.com/stripe/stripe-go/v74/customer"
	"github.com/stripe/stripe-go/v74/paymentintent"
	"github.com/stripe/stripe-go/v74/paymentmethod"
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
	if err := db.UpdateProductStatusAndBuyer(request.ProductID, request.BuyerID, "talks"); err != nil {
		log.Printf("Failed to update product status/buyer: %v", err)
		// You may decide what to do if updating the status fails
		// For now, we just log it.
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

// SavePaymentMethodHandler allows users to save their card for future use
func SavePaymentMethodHandler(w http.ResponseWriter, r *http.Request) {
	stripe.Key = os.Getenv("STRIPE_SECRET_KEY")

	var req struct {
		PaymentMethodID string `json:"paymentMethodId"`
		UserID          string `json:"userId"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request payload", http.StatusBadRequest)
		return
	}

	if req.PaymentMethodID == "" || req.UserID == "" {
		http.Error(w, "PaymentMethodID and UserID are required", http.StatusBadRequest)
		return
	}

	// Retrieve or create the Stripe customer
	user, err := db.GetUserByID(req.UserID)
	if err != nil {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}

	var customerID string
	if user.StripeCustomerID == "" {
		params := &stripe.CustomerParams{
			Email: stripe.String(user.Email),
		}
		customer, err := customer.New(params)
		if err != nil {
			log.Printf("Error creating Stripe customer: %v", err)
			http.Error(w, "Failed to create customer", http.StatusInternalServerError)
			return
		}
		customerID = customer.ID
		// Save the customer ID to the database
		user.StripeCustomerID = customerID
	} else {
		customerID = user.StripeCustomerID
	}

	// Attach the PaymentMethod to the Customer
	attachParams := &stripe.PaymentMethodAttachParams{
		Customer: stripe.String(customerID),
	}
	_, err = paymentmethod.Attach(req.PaymentMethodID, attachParams)
	if err != nil {
		log.Printf("Error attaching payment method: %v", err)
		http.Error(w, "Failed to attach payment method", http.StatusInternalServerError)
		return
	}

	// Respond with success
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{
		"message": "Payment method saved successfully",
	})
}

// GetSavedPaymentMethodsHandler retrieves all saved payment methods for a user
func GetSavedPaymentMethodsHandler(w http.ResponseWriter, r *http.Request) {
	stripe.Key = os.Getenv("STRIPE_SECRET_KEY")

	userID := r.URL.Query().Get("userId")
	if userID == "" {
		http.Error(w, "UserID is required", http.StatusBadRequest)
		return
	}

	user, err := db.GetUserByID(userID)
	if err != nil || user.StripeCustomerID == "" {
		http.Error(w, "User not found or Stripe customer not created", http.StatusNotFound)
		return
	}

	params := &stripe.PaymentMethodListParams{
		Customer: stripe.String(user.StripeCustomerID),
		Type:     stripe.String("card"),
	}
	i := paymentmethod.List(params)

	var paymentMethods []map[string]interface{}
	for i.Next() {
		pm := i.PaymentMethod()
		paymentMethods = append(paymentMethods, map[string]interface{}{
			"id":       pm.ID,
			"brand":    pm.Card.Brand,
			"last4":    pm.Card.Last4,
			"expMonth": pm.Card.ExpMonth,
			"expYear":  pm.Card.ExpYear,
		})
	}

	if err := i.Err(); err != nil {
		log.Printf("Error retrieving payment methods: %v", err)
		http.Error(w, "Failed to retrieve payment methods", http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(paymentMethods)
}

// ChargeSavedPaymentMethodHandler charges a user using a saved payment method
func ChargeSavedPaymentMethodHandler(w http.ResponseWriter, r *http.Request) {
	stripe.Key = os.Getenv("STRIPE_SECRET_KEY")

	var req struct {
		UserID          string `json:"userId"`
		PaymentMethodID string `json:"paymentMethodId"`
		Amount          int64  `json:"amount"`   // Amount in cents
		Currency        string `json:"currency"` // e.g., "usd"
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request payload", http.StatusBadRequest)
		return
	}

	if req.UserID == "" || req.PaymentMethodID == "" || req.Amount <= 0 || req.Currency == "" {
		http.Error(w, "Invalid request data", http.StatusBadRequest)
		return
	}

	user, err := db.GetUserByID(req.UserID)
	if err != nil || user.StripeCustomerID == "" {
		http.Error(w, "User not found or Stripe customer not created", http.StatusNotFound)
		return
	}

	params := &stripe.PaymentIntentParams{
		Amount:        stripe.Int64(req.Amount),
		Currency:      stripe.String(req.Currency),
		Customer:      stripe.String(user.StripeCustomerID),
		PaymentMethod: stripe.String(req.PaymentMethodID),
		Confirm:       stripe.Bool(true),
		OffSession:    stripe.Bool(true),
	}
	pi, err := paymentintent.New(params)
	if err != nil {
		log.Printf("Error creating PaymentIntent: %v", err)
		http.Error(w, "Failed to process payment", http.StatusInternalServerError)
		return
	}

	response := map[string]string{
		"clientSecret": pi.ClientSecret,
		"status":       string(pi.Status), // Explicit conversion
		"message":      "Chat created between %s and %s.",
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)

}
