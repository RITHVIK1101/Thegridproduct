// handlers/reportHandlers.go
package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/smtp"
	"os"
	"time"

	"Thegridproduct/backend/db"
	"Thegridproduct/backend/models"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// ReportRequest represents the incoming JSON payload for a report.
type ReportRequest struct {
	ChatID      string `json:"chatId"`
	Reason      string `json:"reason"`      // e.g., "Inappropriate Behavior", "Fraudulent Activity", "Spam", "Other"
	Description string `json:"description"` // Required detailed description
}

// ReportChatHandler handles reporting a user in a chat.
func ReportChatHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	// Only allow POST requests
	if r.Method != http.MethodPost {
		WriteJSONError(w, "Invalid request method", http.StatusMethodNotAllowed)
		return
	}

	// Decode the report request payload
	var reportReq ReportRequest
	if err := json.NewDecoder(r.Body).Decode(&reportReq); err != nil {
		WriteJSONError(w, "Invalid request payload", http.StatusBadRequest)
		return
	}
	// Ensure all required fields are provided
	if reportReq.ChatID == "" || reportReq.Reason == "" || reportReq.Description == "" {
		WriteJSONError(w, "ChatID, Reason, and Description are required", http.StatusBadRequest)
		return
	}

	// Get the reporter's userID from the request context (set by AuthMiddleware)
	reporterIDStr, ok := r.Context().Value(userIDKey).(string)
	if !ok || reporterIDStr == "" {
		WriteJSONError(w, "User not authenticated", http.StatusUnauthorized)
		return
	}
	reporterObjID, err := primitive.ObjectIDFromHex(reporterIDStr)
	if err != nil {
		WriteJSONError(w, "Invalid reporter user ID", http.StatusBadRequest)
		return
	}

	// Convert the provided ChatID to an ObjectID
	chatObjID, err := primitive.ObjectIDFromHex(reportReq.ChatID)
	if err != nil {
		WriteJSONError(w, "Invalid chat ID format", http.StatusBadRequest)
		return
	}

	// Retrieve the chat document from the database
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	chatCollection := db.GetCollection("gridlyapp", "chats")
	var chat models.Chat
	if err := chatCollection.FindOne(ctx, bson.M{"_id": chatObjID}).Decode(&chat); err != nil {
		WriteJSONError(w, "Chat not found", http.StatusNotFound)
		return
	}

	// Determine the reported user:
	// If the reporter is the buyer, then the reported user is the seller, and vice versa.
	var reportedUserID primitive.ObjectID
	if chat.BuyerID == reporterObjID {
		reportedUserID = chat.SellerID
	} else if chat.SellerID == reporterObjID {
		reportedUserID = chat.BuyerID
	} else {
		WriteJSONError(w, "User not part of this chat", http.StatusUnauthorized)
		return
	}

	// Retrieve both users' details.
	// (Assume db.GetUserByID looks in both "university_users" and "high_school_users")
	reporter, err := db.GetUserByID(reporterIDStr)
	if err != nil {
		WriteJSONError(w, "Error fetching reporter details", http.StatusInternalServerError)
		return
	}
	reported, err := db.GetUserByID(reportedUserID.Hex())
	if err != nil {
		WriteJSONError(w, "Error fetching reported user details", http.StatusInternalServerError)
		return
	}

	// Compose the email body with all necessary details
	emailBody := fmt.Sprintf(`User Report:

Report Reason: %s
Description: %s

Chat ID: %s

Reporter:
    Name: %s %s
    Email: %s
    UserID: %s

Reported User:
    Name: %s %s
    Email: %s
    UserID: %s
`, reportReq.Reason, reportReq.Description, reportReq.ChatID,
		reporter.FirstName, reporter.LastName, reporter.Email, reporterIDStr,
		reported.FirstName, reported.LastName, reported.Email, reportedUserID.Hex())

	// Specify the email subject and recipients
	subject := "User Report Notification"
	recipients := []string{"thegridly@gmail.com", "rithviksaba@gmail.com"}
	message := fmt.Sprintf("Subject: %s\n\n%s", subject, emailBody)

	// SMTP configuration (ensure these are set in your environment variables)
	smtpHost := "smtp.gmail.com"
	smtpPort := "587"
	smtpUser := os.Getenv("SMTP_USER") // e.g., the sender's email address
	smtpPass := os.Getenv("SMTP_PASS") // the corresponding password or app password
	if smtpUser == "" || smtpPass == "" {
		WriteJSONError(w, "SMTP credentials not configured", http.StatusInternalServerError)
		return
	}

	auth := smtp.PlainAuth("", smtpUser, smtpPass, smtpHost)
	if err := smtp.SendMail(smtpHost+":"+smtpPort, auth, smtpUser, recipients, []byte(message)); err != nil {
		log.Printf("Error sending email: %v", err)
		WriteJSONError(w, "Error sending report email", http.StatusInternalServerError)
		return
	}

	// Optionally, you can store the report in a "reports" collection here.

	// Respond with a success message
	WriteJSON(w, map[string]string{"message": "Report submitted successfully"}, http.StatusOK)
}
