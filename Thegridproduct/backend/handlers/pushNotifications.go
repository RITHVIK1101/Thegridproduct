package handlers

import (
	"bytes"
	"encoding/json"
	"errors"
	"log"
	"net/http"
)

// SendPushNotification sends a push notification to a specific user via Expo.
func SendPushNotification(pushToken, title, message string, data map[string]string) error {
	// Validate the push token format.
	if len(pushToken) < 10 {
		return errors.New("invalid Expo push token")
	}

	// Construct the push message payload.
	pushMessage := map[string]interface{}{
		"to":    pushToken,
		"title": title,
		"body":  message,
		"sound": "default",
		"data":  data, // Additional data for deep linking or other logic
	}

	// Convert message to JSON.
	jsonData, err := json.Marshal([]map[string]interface{}{pushMessage})
	if err != nil {
		return err
	}

	// Expo push API endpoint.
	expoAPI := "https://exp.host/--/api/v2/push/send"

	// Send the push notification request.
	resp, err := http.Post(expoAPI, "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	// Check if Expo API returned a non-OK response.
	if resp.StatusCode != http.StatusOK {
		log.Printf("Expo push API error: %v", resp.Status)
		return errors.New("failed to send push notification")
	}

	// Log the response from Expo.
	var responseMap map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&responseMap); err != nil {
		log.Printf("Error decoding Expo response: %v", err)
	} else {
		log.Printf("Expo Push Notification Response: %+v", responseMap)
	}

	return nil
}
