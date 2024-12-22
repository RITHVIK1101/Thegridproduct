package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"log"
	"net/http"
	"time"

	"Thegridproduct/backend/db"

	"go.mongodb.org/mongo-driver/bson"
)

type AIRequest struct {
	Text string `json:"text"`
}

type AIResponse struct {
	Response string `json:"response"`
}

type Gig struct {
	ID          string `json:"id"`
	Title       string `json:"title"`
	Category    string `json:"category"`
	Description string `json:"description"`
	Price       string `json:"price"`
	University  string `json:"university"`
	Status      string `json:"status"`
}

func ProcessAIInput(w http.ResponseWriter, r *http.Request) {
	// Decode the incoming request
	var req AIRequest
	err := json.NewDecoder(r.Body).Decode(&req)
	if err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	// Send input to the Python AI service
	aiURL := "https://968a-2601-600-9003-a940-adbc-b631-49f0-741d.ngrok-free.app/process"
	payload, _ := json.Marshal(req)

	resp, err := http.Post(aiURL, "application/json", bytes.NewBuffer(payload))
	if err != nil {
		log.Printf("Error calling AI service: %v", err)
		http.Error(w, "Error processing input", http.StatusInternalServerError)
		return
	}
	defer resp.Body.Close()

	// Parse AI response
	var aiResp AIResponse
	json.NewDecoder(resp.Body).Decode(&aiResp)

	// Example: Parse keywords from AI response (adjust based on the AI response format)
	keywords := []string{"Math", "Tutor", "High school"}
	log.Printf("Extracted keywords: %v", keywords)

	// Query MongoDB to find matching gigs
	collection := db.GetCollection("gridlyapp", "gigs") // Specify database and collection name
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var gigs []Gig
	filter := bson.M{
		"status": "active", // Only fetch active gigs
		"$or": []bson.M{
			{"category": bson.M{"$in": keywords}},
			{"title": bson.M{"$regex": ".*" + keywords[0] + ".*", "$options": "i"}},
			{"description": bson.M{"$regex": ".*" + keywords[1] + ".*", "$options": "i"}},
		},
	}

	cursor, err := collection.Find(ctx, filter)
	if err != nil {
		log.Printf("Database query error: %v", err)
		http.Error(w, "Error querying database", http.StatusInternalServerError)
		return
	}
	defer cursor.Close(ctx)

	for cursor.Next(ctx) {
		var gig Gig
		cursor.Decode(&gig)
		gigs = append(gigs, gig)
	}

	// Return gigs as JSON
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(gigs)

}
