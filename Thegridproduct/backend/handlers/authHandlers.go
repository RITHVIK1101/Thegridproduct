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

// Generates a random 6-digit code
func generateVerificationCode() string {
	rand.Seed(time.Now().UnixNano())
	return fmt.Sprintf("%06d", rand.Intn(1000000))
}

// Send email with a verification code
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

	// Determine the collection based on StudentType
	collectionName := "highschool_users"
	if req.StudentType == StudentTypeUniversity {
		collectionName = "university_users"
	}

	collection := db.GetCollection("gridlyapp", collectionName)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Check if the user already exists
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

	// Generate and send verification code
	verificationCode := generateVerificationCode()
	go sendVerificationEmail(req.Email, verificationCode) // Send email asynchronously

	// Respond with success message
	response := map[string]interface{}{
		"message": "Signup successful! A verification email has been sent.",
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(response)
}
