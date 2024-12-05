// handlers/hub.go

package handlers

import (
	"Thegridproduct/backend/models"
	"sync"

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
		case unreg := <-h.unregister:
			h.mu.Lock()
			if clients, ok := h.clients[unreg.chatID]; ok {
				if _, ok := clients[unreg.client]; ok {
					delete(clients, unreg.client)
					close(unreg.client.send)
					if len(clients) == 0 {
						delete(h.clients, unreg.chatID)
					}
				}
			}
			h.mu.Unlock()
		case message := <-h.broadcast:
			h.mu.Lock()
			// Broadcast to all clients in the specific chat room
			if clients, ok := h.clients[message.ChatID]; ok { // Assuming Message struct has ChatID
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
