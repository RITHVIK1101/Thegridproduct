// handlers/authHandlers.go

package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"net/smtp"
	"os"
	"time"

	"Thegridproduct/backend/db"
	"Thegridproduct/backend/models"

	"github.com/golang-jwt/jwt/v4"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"golang.org/x/crypto/bcrypt"
)

// Constants for Student Types
const (
	StudentTypeHighSchool = "highschool"
	StudentTypeUniversity = "university"
)

// LoginRequest represents the expected login payload.
type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// SignupRequest represents the expected signup payload.
type SignupRequest struct {
	Email       string `json:"email"`
	Password    string `json:"password"`
	FirstName   string `json:"firstName"`
	LastName    string `json:"lastName"`
	StudentType string `json:"studentType"`          // "highschool" or "university"
	Institution string `json:"institution"`          // Name of high school or university
	ProfilePic  string `json:"profilePic,omitempty"` // Optional profile picture URL
}

// generateToken creates a JWT token for the authenticated user.
func generateToken(userID primitive.ObjectID, institution string, studentType string) (string, error) {
	expirationTime := time.Now().Add(24 * time.Hour)
	claims := &Claims{
		UserID:      userID.Hex(),
		Institution: institution,
		StudentType: studentType,
		StandardClaims: jwt.StandardClaims{
			ExpiresAt: expirationTime.Unix(),
			IssuedAt:  time.Now().Unix(),
			Issuer:    "TheGridlyApp",
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	jwtKey := []byte(os.Getenv("JWT_SECRET_KEY"))
	if len(jwtKey) == 0 {
		log.Println("JWT_SECRET_KEY is not set in environment variables")
		return "", http.ErrAbortHandler
	}

	tokenString, err := token.SignedString(jwtKey)
	if err != nil {
		return "", err
	}

	return tokenString, nil
}

// LoginHandler handles user authentication and token generation.
func LoginHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodPost {
		WriteJSONError(w, "Invalid request method", http.StatusMethodNotAllowed)
		return
	}

	var creds LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&creds); err != nil {
		WriteJSONError(w, "Invalid input", http.StatusBadRequest)
		return
	}

	// Validate Email and Password presence
	if creds.Email == "" || creds.Password == "" {
		WriteJSONError(w, "Email and password are required", http.StatusBadRequest)
		return
	}

	// Attempt to find user in highschool_users collection
	highSchoolCollection := db.GetCollection("gridlyapp", "highschool_users")
	universityCollection := db.GetCollection("gridlyapp", "university_users")

	var user models.User
	var studentType string

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	err := highSchoolCollection.FindOne(ctx, bson.M{"email": creds.Email}).Decode(&user)
	if err == nil {
		studentType = StudentTypeHighSchool
	} else if err != mongo.ErrNoDocuments {
		log.Printf("Error finding user in highschool_users: %v", err)
		WriteJSONError(w, "Internal server error", http.StatusInternalServerError)
		return
	} else {
		// Attempt to find user in university_users collection
		err = universityCollection.FindOne(ctx, bson.M{"email": creds.Email}).Decode(&user)
		if err == nil {
			studentType = StudentTypeUniversity
		} else if err != mongo.ErrNoDocuments {
			log.Printf("Error finding user in university_users: %v", err)
			WriteJSONError(w, "Internal server error", http.StatusInternalServerError)
			return
		} else {
			// User not found in either collection
			WriteJSONError(w, "Invalid email or password", http.StatusUnauthorized)
			return
		}
	}

	// Compare the hashed password
	err = bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(creds.Password))
	if err != nil {
		WriteJSONError(w, "Invalid email or password", http.StatusUnauthorized)
		return
	}

	// Generate JWT Token, now including studentType
	tokenString, err := generateToken(user.ID, user.Institution, studentType)
	if err != nil {
		log.Printf("Error generating token: %v", err)
		WriteJSONError(w, "Could not generate token", http.StatusInternalServerError)
		return
	}

	// Respond with the token and user information including studentType
	response := map[string]interface{}{
		"token":       tokenString,
		"userId":      user.ID.Hex(),
		"institution": user.Institution,
		"studentType": studentType,
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(response)
}

// generateVerificationCode creates a random 6-digit code.
func generateVerificationCode() string {
	rand.Seed(time.Now().UnixNano())
	return fmt.Sprintf("%06d", rand.Intn(1000000))
}

// sendVerificationEmail sends an email with the verification code.
func sendVerificationEmail(email string, code string) error {
	smtpHost := os.Getenv("SMTP_HOST")
	smtpPort := os.Getenv("SMTP_PORT")
	senderEmail := os.Getenv("SMTP_USER")
	senderPassword := os.Getenv("SMTP_PASS")

	auth := smtp.PlainAuth("", senderEmail, senderPassword, smtpHost)

	// Email content
	subject := "Your Gridly Verification Code"
	body := fmt.Sprintf("Your verification code is: %s", code)
	message := []byte("Subject: " + subject + "\r\n" +
		"From: " + senderEmail + "\r\n" +
		"To: " + email + "\r\n" +
		"Content-Type: text/plain; charset=UTF-8\r\n\r\n" +
		body)

	// Send email
	err := smtp.SendMail(smtpHost+":"+smtpPort, auth, senderEmail, []string{email}, message)
	if err != nil {
		log.Printf("Error sending email: %v", err)
		return err
	}

	log.Println("Verification email sent to:", email)
	return nil
}

// ----- New Types for Pending Signup and Verification -----

// PendingUser holds the signup data until the email is verified.
// PendingUser holds the signup data until the email is verified.
type PendingUser struct {
	ID               primitive.ObjectID `bson:"_id"`
	Email            string             `bson:"email"`
	Password         string             `bson:"password"`
	FirstName        string             `bson:"firstName"`
	LastName         string             `bson:"lastName"`
	StudentType      string             `bson:"studentType"`
	Institution      string             `bson:"institution"`
	ProfilePic       string             `bson:"profilePic,omitempty"`
	VerificationCode string             `bson:"verificationCode"`
	ExpiresAt        time.Time          `bson:"expiresAt"`
	Grids            int                `bson:"grids"`
	CreatedAt        time.Time          `bson:"createdAt"`
}

// VerifyRequest represents the payload for email verification.
type VerifyRequest struct {
	Email string `json:"email"`
	Code  string `json:"code"`
}

// ----- Modified SignupHandler -----

// SignupHandler now creates a pending user record and sends a verification email.
// The actual user record is not created until the email is verified.
func SignupHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodPost {
		WriteJSONError(w, "Invalid request method", http.StatusMethodNotAllowed)
		return
	}

	var req SignupRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		WriteJSONError(w, "Invalid input", http.StatusBadRequest)
		return
	}

	if req.Email == "" || req.Password == "" || req.FirstName == "" || req.LastName == "" || req.Institution == "" {
		WriteJSONError(w, "All fields are required", http.StatusBadRequest)
		return
	}

	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		WriteJSONError(w, "Error processing password", http.StatusInternalServerError)
		return
	}

	// Check if the user already exists in the actual user collections.
	highSchoolCollection := db.GetCollection("gridlyapp", "highschool_users")
	universityCollection := db.GetCollection("gridlyapp", "university_users")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	countHS, err := highSchoolCollection.CountDocuments(ctx, bson.M{"email": req.Email})
	if err != nil {
		WriteJSONError(w, "Error checking existing user", http.StatusInternalServerError)
		return
	}
	countUni, err := universityCollection.CountDocuments(ctx, bson.M{"email": req.Email})
	if err != nil {
		WriteJSONError(w, "Error checking existing user", http.StatusInternalServerError)
		return
	}
	if countHS > 0 || countUni > 0 {
		WriteJSONError(w, "User already exists", http.StatusConflict)
		return
	}

	// Generate a verification code and create a pending user record.
	verificationCode := generateVerificationCode()
	// Set the verification code to expire in 15 minutes.
	expiresAt := time.Now().Add(15 * time.Minute)

	pendingUser := PendingUser{
		ID:               primitive.NewObjectID(),
		Email:            req.Email,
		Password:         string(hashedPassword),
		FirstName:        req.FirstName,
		LastName:         req.LastName,
		StudentType:      req.StudentType,
		Institution:      req.Institution,
		ProfilePic:       req.ProfilePic, // Store profile picture
		VerificationCode: verificationCode,
		ExpiresAt:        expiresAt,
		Grids:            0,
		CreatedAt:        time.Now(),
	}

	pendingCollection := db.GetCollection("gridlyapp", "pending_users")

	// Remove any existing pending record for this email (optional).
	_, _ = pendingCollection.DeleteOne(ctx, bson.M{"email": req.Email})

	_, err = pendingCollection.InsertOne(ctx, pendingUser)
	if err != nil {
		WriteJSONError(w, "Error creating pending user", http.StatusInternalServerError)
		return
	}

	// Send the verification email asynchronously.
	go sendVerificationEmail(req.Email, verificationCode)

	// Respond to the client.
	response := map[string]interface{}{
		"message": "Signup initiated! A verification email has been sent. Please verify your email to activate your account.",
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(response)
}

// ----- New VerifyEmailHandler Endpoint -----

// VerifyEmailHandler accepts the email and verification code,
// and if the code is valid (and not expired), it creates the actual user record
// in the correct collection and removes the pending record.
func VerifyEmailHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodPost {
		WriteJSONError(w, "Invalid request method", http.StatusMethodNotAllowed)
		return
	}

	var req VerifyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		WriteJSONError(w, "Invalid input", http.StatusBadRequest)
		return
	}

	if req.Email == "" || req.Code == "" {
		WriteJSONError(w, "Email and verification code are required", http.StatusBadRequest)
		return
	}

	pendingCollection := db.GetCollection("gridlyapp", "pending_users")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var pendingUser PendingUser
	err := pendingCollection.FindOne(ctx, bson.M{"email": req.Email}).Decode(&pendingUser)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			WriteJSONError(w, "No pending signup found for this email", http.StatusNotFound)
		} else {
			log.Printf("Error finding pending user: %v", err)
			WriteJSONError(w, "Internal server error", http.StatusInternalServerError)
		}
		return
	}

	// Validate the verification code.
	if pendingUser.VerificationCode != req.Code {
		WriteJSONError(w, "Invalid verification code", http.StatusUnauthorized)
		return
	}

	// Check if the verification code has expired.
	if time.Now().After(pendingUser.ExpiresAt) {
		_, delErr := pendingCollection.DeleteOne(ctx, bson.M{"email": req.Email})
		if delErr != nil {
			log.Printf("Error deleting expired pending user: %v", delErr)
		}
		WriteJSONError(w, "Verification code expired. Please sign up again.", http.StatusUnauthorized)
		return
	}

	// Create a new user object
	newUser := models.User{
		ID:          pendingUser.ID,
		Email:       pendingUser.Email,
		Password:    pendingUser.Password,
		FirstName:   pendingUser.FirstName,
		LastName:    pendingUser.LastName,
		StudentType: pendingUser.StudentType,
		Institution: pendingUser.Institution,
		ProfilePic:  pendingUser.ProfilePic,
		CreatedAt:   time.Now(),
		Grids:       pendingUser.Grids,
		UpdatedAt:   time.Now(),
	}

	// Determine the correct collection
	var collectionName string
	if pendingUser.StudentType == StudentTypeUniversity {
		collectionName = "university_users"
	} else {
		collectionName = "highschool_users"
	}
	userCollection := db.GetCollection("gridlyapp", collectionName)

	_, err = userCollection.InsertOne(ctx, newUser)
	if err != nil {
		log.Printf("Error creating user: %v", err)
		WriteJSONError(w, "Error creating user account", http.StatusInternalServerError)
		return
	}

	// Delete the pending user record.
	_, delErr := pendingCollection.DeleteOne(ctx, bson.M{"email": req.Email})
	if delErr != nil {
		log.Printf("Error deleting pending user record: %v", delErr)
	}

	// 🔥 **Generate JWT Token**
	tokenString, err := generateToken(newUser.ID, newUser.Institution, newUser.StudentType)
	if err != nil {
		log.Printf("Error generating token: %v", err)
		WriteJSONError(w, "Could not generate token", http.StatusInternalServerError)
		return
	}

	// 🔥 **Send Token in Response**
	response := map[string]interface{}{
		"message":     "Email verified successfully. Your account is now active.",
		"userId":      newUser.ID.Hex(),
		"institution": newUser.Institution,
		"studentType": newUser.StudentType,
		"profilePic":  newUser.ProfilePic,
		"token":       tokenString, // ✅ Include the token
		"grids":       newUser.Grids,
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(response)
}

// DeleteAccountHandler handles deletion of the user account along with all associated data.
func DeleteAccountHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodDelete {
		WriteJSONError(w, "Invalid request method", http.StatusMethodNotAllowed)
		return
	}

	// Extract token from header.
	authHeader := r.Header.Get("Authorization")
	if authHeader == "" {
		WriteJSONError(w, "Authorization token required", http.StatusUnauthorized)
		return
	}
	// Expecting "Bearer <token>"
	tokenString := authHeader[len("Bearer "):]
	jwtKey := []byte(os.Getenv("JWT_SECRET_KEY"))

	// Parse and validate JWT.
	claims := &Claims{}
	token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
		return jwtKey, nil
	})
	if err != nil || !token.Valid {
		WriteJSONError(w, "Invalid or expired token", http.StatusUnauthorized)
		return
	}

	// Convert user ID from the token.
	userID, err := primitive.ObjectIDFromHex(claims.UserID)
	if err != nil {
		WriteJSONError(w, "Invalid user ID", http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Determine the user's collection.
	var userCollectionName string
	if claims.StudentType == StudentTypeUniversity {
		userCollectionName = "university_users"
	} else {
		userCollectionName = "highschool_users"
	}
	userCollection := db.GetCollection("gridlyapp", userCollectionName)

	// Delete the user document.
	_, err = userCollection.DeleteOne(ctx, bson.M{"_id": userID})
	if err != nil {
		log.Printf("Error deleting user account: %v", err)
		WriteJSONError(w, "Error deleting account", http.StatusInternalServerError)
		return
	}

	// Delete all products associated with the user.
	productsCollection := db.GetCollection("gridlyapp", "products")
	_, err = productsCollection.DeleteMany(ctx, bson.M{"userId": userID})
	if err != nil {
		log.Printf("Error deleting user's products: %v", err)
		// Log error but proceed.
	}

	// Delete all gigs associated with the user.
	gigsCollection := db.GetCollection("gridlyapp", "gigs")
	_, err = gigsCollection.DeleteMany(ctx, bson.M{"userId": userID})
	if err != nil {
		log.Printf("Error deleting user's gigs: %v", err)
		// Log error but proceed.
	}

	// Delete all product requests associated with the user.
	// This uses the "product_requests" collection and deletes documents where "userId" matches.
	requestsCollection := db.GetCollection("gridlyapp", "product_requests")
	_, err = requestsCollection.DeleteMany(ctx, bson.M{"userId": userID})
	if err != nil {
		log.Printf("Error deleting user's product requests: %v", err)
		// Log error but proceed.
	}

	// Respond with success.
	response := map[string]interface{}{
		"message": "Account and all associated data deleted successfully.",
	}
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(response)
}

// UpdateProfilePicHandler allows users to update their profile picture.
func UpdateProfilePicHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodPut {
		WriteJSONError(w, "Invalid request method", http.StatusMethodNotAllowed)
		return
	}

	// Extract token from header.
	authHeader := r.Header.Get("Authorization")
	if authHeader == "" {
		WriteJSONError(w, "Authorization token required", http.StatusUnauthorized)
		return
	}

	// Expecting "Bearer <token>"
	tokenString := authHeader[len("Bearer "):]
	jwtKey := []byte(os.Getenv("JWT_SECRET_KEY"))

	// Parse and validate JWT.
	claims := &Claims{}
	token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
		return jwtKey, nil
	})
	if err != nil || !token.Valid {
		WriteJSONError(w, "Invalid or expired token", http.StatusUnauthorized)
		return
	}

	// Convert user ID from the token.
	userID, err := primitive.ObjectIDFromHex(claims.UserID)
	if err != nil {
		WriteJSONError(w, "Invalid user ID", http.StatusBadRequest)
		return
	}

	// Parse request body.
	var req struct {
		ProfilePic string `json:"profilePic"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		WriteJSONError(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Ensure profilePic URL is provided.
	if req.ProfilePic == "" {
		WriteJSONError(w, "Profile picture URL is required", http.StatusBadRequest)
		return
	}

	// Determine the correct collection.
	var userCollectionName string
	if claims.StudentType == StudentTypeUniversity {
		userCollectionName = "university_users"
	} else {
		userCollectionName = "highschool_users"
	}
	userCollection := db.GetCollection("gridlyapp", userCollectionName)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Update the user's profile picture.
	update := bson.M{"$set": bson.M{"profilePic": req.ProfilePic}}
	_, err = userCollection.UpdateOne(ctx, bson.M{"_id": userID}, update)
	if err != nil {
		log.Printf("Error updating profile picture: %v", err)
		WriteJSONError(w, "Failed to update profile picture", http.StatusInternalServerError)
		return
	}

	// Respond with success.
	response := map[string]interface{}{
		"message":    "Profile picture updated successfully.",
		"profilePic": req.ProfilePic,
	}
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(response)
}
