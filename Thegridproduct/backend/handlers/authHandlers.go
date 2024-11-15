// handlers/authHandlers.go

package handlers

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strings"
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

// generateToken creates a JWT token for the authenticated user, including studentType.
func generateToken(userID primitive.ObjectID, institution string, studentType string) (string, error) {
	expirationTime := time.Now().Add(24 * time.Hour)
	claims := &Claims{
		UserID:      userID.Hex(), // Ensure UserID is set as hex string
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

// SignupHandler handles user registration.
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

	// Validate StudentType
	if req.StudentType != StudentTypeHighSchool && req.StudentType != StudentTypeUniversity {
		WriteJSONError(w, "Invalid student type", http.StatusBadRequest)
		return
	}

	// Validate required fields
	if req.Email == "" || req.Password == "" || req.FirstName == "" || req.LastName == "" || req.Institution == "" {
		WriteJSONError(w, "All fields are required", http.StatusBadRequest)
		return
	}

	// Hash the password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		WriteJSONError(w, "Error processing password", http.StatusInternalServerError)
		return
	}

	// Create a new User instance
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
		// Initialize other fields as necessary
	}

	// Determine the collection based on StudentType
	var collectionName string
	if req.StudentType == StudentTypeUniversity {
		collectionName = "university_users"
	} else {
		collectionName = "highschool_users"
	}

	collection := db.GetCollection("gridlyapp", collectionName)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Check if the user already exists
	count, err := collection.CountDocuments(ctx, bson.M{"email": req.Email})
	if err != nil {
		log.Printf("Error checking existing user: %v", err)
		WriteJSONError(w, "Error processing request", http.StatusInternalServerError)
		return
	}
	if count > 0 {
		WriteJSONError(w, "User already exists", http.StatusConflict)
		return
	}

	// Insert the new user into the appropriate collection
	_, err = collection.InsertOne(ctx, newUser)
	if err != nil {
		log.Printf("Error inserting user: %v", err)
		WriteJSONError(w, "Error creating user", http.StatusInternalServerError)
		return
	}

	// Generate JWT Token, now including studentType
	tokenString, err := generateToken(newUser.ID, newUser.Institution, newUser.StudentType)
	if err != nil {
		log.Printf("Error generating token: %v", err)
		WriteJSONError(w, "Could not generate token", http.StatusInternalServerError)
		return
	}

	// Respond with the token and user information
	response := map[string]interface{}{
		"token":       tokenString,
		"userId":      newUser.ID.Hex(),
		"institution": newUser.Institution,
		"studentType": newUser.StudentType,
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(response)
}

// AuthMiddleware validates JWT tokens and sets userID, institution, and studentType in the context.
func authMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			WriteJSONError(w, "Authorization header missing", http.StatusUnauthorized)
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
			WriteJSONError(w, "Invalid Authorization header format. Expected 'Bearer <token>'", http.StatusUnauthorized)
			return
		}

		tokenString := parts[1]
		jwtSecret := []byte(os.Getenv("JWT_SECRET_KEY"))
		if len(jwtSecret) == 0 {
			log.Println("JWT_SECRET_KEY is not set in environment variables")
			WriteJSONError(w, "Internal server error", http.StatusInternalServerError)
			return
		}

		claims := &Claims{}

		token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, http.ErrAbortHandler
			}
			return jwtSecret, nil
		})

		if err != nil || !token.Valid {
			WriteJSONError(w, "Invalid or expired token", http.StatusUnauthorized)
			return
		}

		// Ensure all required claims are present
		if strings.TrimSpace(claims.UserID) == "" || strings.TrimSpace(claims.Institution) == "" || strings.TrimSpace(claims.StudentType) == "" {
			WriteJSONError(w, "Invalid or missing claims in token", http.StatusUnauthorized)
			return
		}

		log.Printf("Authenticated UserID: %s, Institution: %s, StudentType: %s", claims.UserID, claims.Institution, claims.StudentType)

		// Set userID, institution, and studentType in the context
		ctx := context.WithValue(r.Context(), userIDKey, claims.UserID)
		ctx = context.WithValue(ctx, userInstitution, claims.Institution)
		ctx = context.WithValue(ctx, userStudentType, claims.StudentType)

		next.ServeHTTP(w, r.WithContext(ctx))
	})
}
