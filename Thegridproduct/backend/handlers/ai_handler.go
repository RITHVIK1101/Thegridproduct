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
	Response string   `json:"response"`
	Keywords []string `json:"keywords"` // Ensure AI service returns this
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

type HandlerResponse struct {
	Reply string `json:"reply"`
	Gigs  []Gig  `json:"gigs,omitempty"`
}

func ProcessAIInput(w http.ResponseWriter, r *http.Request) {
	var req AIRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	aiURL := "https://b862-2603-3023-11c-4900-35fa-fcbe-18bf-3661.ngrok-free.app/process"
	payload, _ := json.Marshal(req)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Post(aiURL, "application/json", bytes.NewBuffer(payload))
	if err != nil {
		log.Printf("Error calling AI service: %v", err)
		http.Error(w, "Error processing input", http.StatusInternalServerError)
		return
	}
	defer resp.Body.Close()

	var aiResp AIResponse
	if err := json.NewDecoder(resp.Body).Decode(&aiResp); err != nil {
		log.Printf("Error decoding AI response: %v", err)
		http.Error(w, "Error processing AI response", http.StatusInternalServerError)
		return
	}

	handlerResp := HandlerResponse{Reply: aiResp.Response}

	if len(aiResp.Keywords) > 0 {
		collection := db.GetCollection("gridlyapp", "gigs")
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orFilters := []bson.M{}
		for _, keyword := range aiResp.Keywords {
			orFilters = append(orFilters, bson.M{"category": bson.M{"$regex": keyword, "$options": "i"}})
			orFilters = append(orFilters, bson.M{"title": bson.M{"$regex": keyword, "$options": "i"}})
			orFilters = append(orFilters, bson.M{"description": bson.M{"$regex": keyword, "$options": "i"}})
		}

		filter := bson.M{"status": "active", "$or": orFilters}
		cursor, err := collection.Find(ctx, filter)
		if err != nil {
			log.Printf("Database query error: %v", err)
			http.Error(w, "Error querying database", http.StatusInternalServerError)
			return
		}
		defer cursor.Close(ctx)

		var gigs []Gig
		for cursor.Next(ctx) {
			var gig Gig
			if err := cursor.Decode(&gig); err != nil {
				log.Printf("Error decoding gig: %v", err)
				continue
			}
			gigs = append(gigs, gig)
		}

		if err := cursor.Err(); err != nil {
			log.Printf("Cursor error: %v", err)
			http.Error(w, "Error iterating over gigs", http.StatusInternalServerError)
			return
		}

		handlerResp.Gigs = gigs
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(handlerResp)
}
