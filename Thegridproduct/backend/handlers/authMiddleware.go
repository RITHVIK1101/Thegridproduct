// handlers/authMiddleware.go

package handlers

import (
	"context"
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/golang-jwt/jwt/v4"
)

// AuthMiddleware validates JWT tokens and sets userID, institution, and studentType in the context.
func AuthMiddleware(next http.Handler) http.Handler {
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

		// Parse the JWT token and validate it
		token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				log.Println("Unexpected signing method in JWT")
				return nil, http.ErrAbortHandler
			}
			return jwtSecret, nil
		})

		// Check if token is valid
		if err != nil || !token.Valid {
			log.Printf("Token parsing error: %v", err)
			WriteJSONError(w, "Invalid or expired token", http.StatusUnauthorized)
			return
		}

		// Ensure all required claims are present
		if strings.TrimSpace(claims.UserID) == "" || strings.TrimSpace(claims.Institution) == "" || strings.TrimSpace(claims.StudentType) == "" {
			WriteJSONError(w, "Invalid or missing claims in token", http.StatusUnauthorized)
			return
		}

		// Log parsed claims for debugging
		log.Printf("Authenticated UserID: %s, Institution: %s, StudentType: %s", claims.UserID, claims.Institution, claims.StudentType)

		// Set userID, institution, and studentType in the context
		ctx := context.WithValue(r.Context(), userIDKey, claims.UserID)
		ctx = context.WithValue(ctx, userInstitution, claims.Institution)
		ctx = context.WithValue(ctx, userStudentType, claims.StudentType)

		next.ServeHTTP(w, r.WithContext(ctx))
	})
}
