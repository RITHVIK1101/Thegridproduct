package handlers

import (
	"bytes"
	"encoding/json"
	"log"
	"net/http"
	"time"
)

// PushNotificationRequest defines the expected request body
type PushNotificationRequest struct {
	PushToken string `json:"pushToken"`
	Title     string `json:"title"`
	Message   string `json:"message"`
}

// ExpoPushMessage defines the payload format required by Expo's API
type ExpoPushMessage struct {
	To    string `json:"to"`
	Title string `json:"title"`
	Body  string `json:"body"`
	Sound string `json:"sound"`
}

// SendPushNotificationHandler handles push notification requests
func SendPushNotificationHandler(w http.ResponseWriter, r *http.Request) {
	// Parse the request body
	var req PushNotificationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request payload", http.StatusBadRequest)
		return
	}

	// Validate the push token format
	if len(req.PushToken) < 10 {
		http.Error(w, "Invalid Expo push token", http.StatusBadRequest)
		return
	}

	// Create the push message
	pushMessage := ExpoPushMessage{
		To:    req.PushToken,
		Title: req.Title,
		Body:  req.Message,
		Sound: "default",
	}

	// Convert to JSON
	jsonData, err := json.Marshal([]ExpoPushMessage{pushMessage})
	if err != nil {
		http.Error(w, "Failed to serialize push message", http.StatusInternalServerError)
		return
	}

	// Expo push API URL
	expoAPI := "https://exp.host/--/api/v2/push/send"

	// Wait 5 seconds before sending the notification
	go func() {
		time.Sleep(5 * time.Second)

		// Send the push notification request
		resp, err := http.Post(expoAPI, "application/json", bytes.NewBuffer(jsonData))
		if err != nil {
			log.Printf("Error sending push notification: %v\n", err)
			return
		}
		defer resp.Body.Close()

		// Log the response from Expo
		var responseMap map[string]interface{}
		json.NewDecoder(resp.Body).Decode(&responseMap)
		log.Printf("Expo Push Notification Response: %+v\n", responseMap)
	}()

	// Respond immediately
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"success": "Notification scheduled in 5 seconds!"})
}
