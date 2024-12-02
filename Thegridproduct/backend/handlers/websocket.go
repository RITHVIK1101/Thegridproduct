// handlers/websocket.go

package handlers

import (
	"Thegridproduct/backend/db"
	"Thegridproduct/backend/models"
	"log"
	"net/http"
	"time"

	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"
)

// WebSocket Upgrader with sensible defaults
var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	// Allow all origins for simplicity. In production, restrict this.
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

// ServeWS handles WebSocket requests from the client.
func (h *Hub) ServeWS(w http.ResponseWriter, r *http.Request) {
	// Extract chatId and userId from URL parameters
	vars := mux.Vars(r)
	chatID, ok := vars["chatId"]
	if !ok || chatID == "" {
		http.Error(w, "Chat ID is required", http.StatusBadRequest)
		return
	}

	userID, ok := vars["userId"]
	if !ok || userID == "" {
		http.Error(w, "User ID is required", http.StatusBadRequest)
		return
	}

	// Upgrade the HTTP connection to a WebSocket connection
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket Upgrade error: %v", err)
		return
	}

	// Create a new client
	client := &Client{
		hub:    h,
		chatID: chatID,
		conn:   conn,
		send:   make(chan models.Message),
		userID: userID,
	}

	// Register the client with the hub
	h.register <- Registration{chatID: chatID, client: client}

	// Start the client's read and write pumps
	go client.writePump()
	go client.readPump()
}

// readPump pumps messages from the WebSocket connection to the hub.
func (c *Client) readPump() {
	defer func() {
		c.hub.unregister <- Unregistration{chatID: c.chatID, client: c}
		c.conn.Close()
	}()
	c.conn.SetReadLimit(512)
	c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	for {
		var msg models.Message
		err := c.conn.ReadJSON(&msg)
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WebSocket ReadJSON error: %v", err)
			}
			break
		}
		// Set the timestamp
		msg.Timestamp = time.Now()
		// Broadcast the message to the hub
		c.hub.broadcast <- msg
		// Optionally, save the message to the database
		err = db.AddMessageToChat(c.chatID, msg)
		if err != nil {
			log.Printf("Error saving message to DB: %v", err)
		}
	}
}

// writePump pumps messages from the hub to the WebSocket connection.
func (c *Client) writePump() {
	ticker := time.NewTicker(54 * time.Second) // Ping period less than read deadline
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()
	for {
		select {
		case message, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				// The hub closed the channel
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			// Write the message as JSON
			if err := c.conn.WriteJSON(message); err != nil {
				log.Printf("WebSocket WriteJSON error: %v", err)
				return
			}
		case <-ticker.C:
			// Send a ping to the client
			c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}
