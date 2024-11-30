package handlers

import (
	"net/http"

	"Thegridproduct/backend/db"

	"github.com/gorilla/mux"
)

// GetChatHandler fetches chat details by product ID
func GetChatHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	productID := vars["productId"]

	chat, err := db.GetChatByProductID(productID)
	if err != nil {
		WriteJSONError(w, "Chat not found", http.StatusNotFound)
		return
	}

	WriteJSON(w, chat, http.StatusOK)
}
