// handlers/protected.go

package handlers

import (
	"net/http"
)

// ProtectedHandler is an example of a protected endpoint
func ProtectedHandler(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(userIDKey).(string)
	institution := r.Context().Value(userInstitution).(string)
	studentType := r.Context().Value(userStudentType).(string)

	response := map[string]interface{}{
		"message":     "You have accessed a protected endpoint!",
		"userID":      userID,
		"institution": institution,
		"studentType": studentType,
	}

	WriteJSON(w, response, http.StatusOK)
}
