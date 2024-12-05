// handlers/authMiddleware.go

package handlers

import (
	"context"
	"errors"
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

		// Extract Authorization header
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			WriteJSONError(w, "Authorization header missing", http.StatusUnauthorized)
			return
		}

		// Check Authorization format
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

		// Parse and validate the JWT
		token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, errors.New("unexpected signing method")
			}
			return jwtSecret, nil
		})

		if err != nil || !token.Valid {
			WriteJSONError(w, "Invalid or expired token", http.StatusUnauthorized)
			return
		}

		// Check required claims
		if strings.TrimSpace(claims.UserID) == "" ||
			strings.TrimSpace(claims.Institution) == "" ||
			strings.TrimSpace(claims.StudentType) == "" {
			WriteJSONError(w, "Invalid or missing claims in token", http.StatusUnauthorized)
			return
		}

		// Debug logs for development (optional, remove in production)
		log.Printf("Authenticated UserID: %s, Institution: %s, StudentType: %s", claims.UserID, claims.Institution, claims.StudentType)

		// Set claims into the request context
		ctx := context.WithValue(r.Context(), userIDKey, claims.UserID)
		ctx = context.WithValue(ctx, userInstitution, claims.Institution)
		ctx = context.WithValue(ctx, userStudentType, claims.StudentType)

		// Proceed with the next handler
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}
