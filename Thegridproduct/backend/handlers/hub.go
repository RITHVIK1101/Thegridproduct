// handlers/hub.go

package handlers

import (
	"Thegridproduct/backend/db"
	"Thegridproduct/backend/models"
	"log"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

// Hub maintains the set of active clients and broadcasts messages to the clients.
type Hub struct {
	// Registered clients mapped by chat ID
	clients map[string]map[*Client]bool

	// Inbound messages from the clients
	broadcast chan models.Message

	// Register requests from the clients
	register chan Registration

	// Unregister requests from clients
	unregister chan Unregistration

	// Mutex for thread-safe operations
	mu sync.Mutex
}

// Client represents a single chatting user.
type Client struct {
	hub    *Hub
	chatID string
	conn   *websocket.Conn
	send   chan models.Message
	userID string
}

// Registration represents a new client registration.
type Registration struct {
	chatID string
	client *Client
}

// Unregistration represents a client unregistration.
type Unregistration struct {
	chatID string
	client *Client
}

// NewHub initializes a new Hub.
func NewHub() *Hub {
	return &Hub{
		clients:    make(map[string]map[*Client]bool),
		broadcast:  make(chan models.Message),
		register:   make(chan Registration),
		unregister: make(chan Unregistration),
	}
}

// Run starts the Hub's main loop.
func (h *Hub) Run() {
	for {
		select {
		case reg := <-h.register:
			h.mu.Lock()
			if _, ok := h.clients[reg.chatID]; !ok {
				h.clients[reg.chatID] = make(map[*Client]bool)
			}
			h.clients[reg.chatID][reg.client] = true
			h.mu.Unlock()
			log.Printf("Client %s connected to chat %s", reg.client.userID, reg.chatID)
		case unreg := <-h.unregister:
			h.mu.Lock()
			if clients, ok := h.clients[unreg.chatID]; ok {
				if _, ok := clients[unreg.client]; ok {
					delete(clients, unreg.client)
					close(unreg.client.send)
					log.Printf("Client %s disconnected from chat %s", unreg.client.userID, unreg.chatID)
					if len(clients) == 0 {
						delete(h.clients, unreg.chatID)
					}
				}
			}
			h.mu.Unlock()
		case message := <-h.broadcast:
			h.mu.Lock()
			// Broadcast to all clients in the specific chat room
			if clients, ok := h.clients[message.ChatID]; ok { // Ensure Message struct has ChatID
				for client := range clients {
					select {
					case client.send <- message:
					default:
						close(client.send)
						delete(clients, client)
						if len(clients) == 0 {
							delete(h.clients, client.chatID)
						}
					}
				}
			}
			h.mu.Unlock()
		}
	}
}

// readPump reads messages from the WebSocket connection.
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
		// Ensure ChatID is set correctly
		if msg.ChatID == "" {
			msg.ChatID = c.chatID
		}
		// Send the message to the hub's broadcast channel
		c.hub.broadcast <- msg

		// Save the message to the database
		err = db.AddMessageToChat(c.chatID, msg)
		if err != nil {
			log.Printf("Error saving message to DB: %v", err)
		}
	}
}

// writePump writes messages to the WebSocket connection.
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
			// Send a ping message to the client
			c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}
