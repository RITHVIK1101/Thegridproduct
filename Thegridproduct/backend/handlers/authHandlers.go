// handlers/authHandlers.go

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
	StudentType string `json:"studentType"` // "highschool" or "university"
	Institution string `json:"institution"` // Name of high school or university
}

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

// Generate a random token for email verification
func generateVerificationToken(userID primitive.ObjectID) string {
	expirationTime := time.Now().Add(24 * time.Hour).Unix()
	claims := jwt.MapClaims{
		"userID": userID.Hex(),
		"exp":    expirationTime,
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	jwtKey := []byte(os.Getenv("JWT_SECRET_KEY"))
	tokenString, _ := token.SignedString(jwtKey)
	return tokenString
}

// Send verification email
func sendVerificationEmail(email string, token string) error {
	verificationLink := fmt.Sprintf("https://yourdomain.com/verify-email?token=%s", token)

	// SMTP server credentials
	smtpServer := "smtp.gmail.com"
	smtpPort := "587"
	senderEmail := os.Getenv("SMTP_EMAIL")
	senderPassword := os.Getenv("SMTP_PASSWORD")

	auth := smtp.PlainAuth("", senderEmail, senderPassword, smtpServer)

	msg := []byte(
		"Subject: Verify Your Email\n" +
			"From: " + senderEmail + "\n" +
			"To: " + email + "\n" +
			"Content-Type: text/html; charset=UTF-8\n\n" +
			"<h2>Welcome to Gridly!</h2>" +
			"<p>Please verify your email by clicking the link below:</p>" +
			"<a href='" + verificationLink + "'>Verify Email</a>",
	)

	// Send the email
	err := smtp.SendMail(smtpServer+":"+smtpPort, auth, senderEmail, []string{email}, msg)
	if err != nil {
		log.Printf("Error sending verification email: %v", err)
		return err
	}
	return nil
}

// Update SignupHandler to Send Verification Email
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

	if req.StudentType != StudentTypeHighSchool && req.StudentType != StudentTypeUniversity {
		WriteJSONError(w, "Invalid student type", http.StatusBadRequest)
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

	newUser := models.User{
		ID:          primitive.NewObjectID(),
		Email:       req.Email,
		Password:    string(hashedPassword),
		FirstName:   req.FirstName,
		LastName:    req.LastName,
		StudentType: req.StudentType,
		Institution: req.Institution,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	collectionName := "highschool_users"
	if req.StudentType == StudentTypeUniversity {
		collectionName = "university_users"
	}

	collection := db.GetCollection("gridlyapp", collectionName)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	count, err := collection.CountDocuments(ctx, bson.M{"email": req.Email})
	if err != nil {
		WriteJSONError(w, "Error checking existing user", http.StatusInternalServerError)
		return
	}
	if count > 0 {
		WriteJSONError(w, "User already exists", http.StatusConflict)
		return
	}

	_, err = collection.InsertOne(ctx, newUser)
	if err != nil {
		WriteJSONError(w, "Error creating user", http.StatusInternalServerError)
		return
	}

	// Generate and send verification email
	verificationToken := generateVerificationToken(newUser.ID)
	go sendVerificationEmail(req.Email, verificationToken) // Asynchronous email sending

	// Generate JWT Token
	tokenString, err := generateToken(newUser.ID, newUser.Institution, newUser.StudentType)
	if err != nil {
		WriteJSONError(w, "Could not generate token", http.StatusInternalServerError)
		return
	}

	response := map[string]interface{}{
		"token":       tokenString,
		"userId":      newUser.ID.Hex(),
		"institution": newUser.Institution,
		"studentType": newUser.StudentType,
		"message":     "Signup successful! A verification email has been sent.",
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(response)
}
