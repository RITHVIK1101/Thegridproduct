// handlers/utils.go

package handlers

import (
	"encoding/json"
	"net/http"
)

// writeJSONError writes a standardized JSON error response.
func WriteJSONError(w http.ResponseWriter, message string, statusCode int) {
	w.WriteHeader(statusCode)
	json.NewEncoder(w).Encode(ErrorResponse{Message: message})
}
