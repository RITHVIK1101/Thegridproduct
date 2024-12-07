// handlers/types.go

package handlers

import (
	"github.com/golang-jwt/jwt/v4"
)

type contextKey string

const (
	userIDKey contextKey = "userID"

	// userInstitution is the context key for the authenticated user's institution.
	userInstitution contextKey = "institution"

	// userStudentType is the context key for the authenticated user's student type.
	userStudentType contextKey = "studentType"
)

// Claims defines the structure of JWT claims.
type Claims struct {
	UserID      string `json:"userId"`
	Institution string `json:"institution"`
	StudentType string `json:"studentType"` // "highschool" or "university"
	jwt.StandardClaims
}

// ErrorResponse represents the structure of error responses.
type ErrorResponse struct {
	Message string `json:"error"`
}
