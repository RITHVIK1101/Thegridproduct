package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// Gig represents a service gig posted by a user
type Gig struct {
	ID             primitive.ObjectID `bson:"_id,omitempty" json:"id,omitempty"`
	UserID         primitive.ObjectID `bson:"userId" json:"userId"`
	University     string             `bson:"university" json:"university"`
	StudentType    string             `bson:"studentType" json:"studentType"`
	Title          string             `bson:"title" json:"title"`
	Category       string             `bson:"category" json:"category"`
	Price          string             `bson:"price" json:"price"` // Either a numeric string or "Open to Communication"
	DeliveryTime   string             `bson:"deliveryTime" json:"deliveryTime"`
	Description    string             `bson:"description" json:"description"`
	Images         []string           `bson:"images" json:"images"`
	ExpirationDate time.Time          `bson:"expirationDate,omitempty" json:"expirationDate,omitempty"`
	PostedDate     time.Time          `bson:"postedDate" json:"postedDate"`
	Expired        bool               `bson:"expired" json:"expired,omitempty" default:"false"`

	Status         string               `bson:"status" json:"status"` // e.g., "active", "completed"
	LikeCount      int                  `bson:"likeCount" json:"likeCount"`
	CampusPresence string               `bson:"campusPresence" json:"campusPresence"` // "inCampus" or "flexible"
	Embeddings     []float32            `bson:"embeddings,omitempty" json:"embeddings,omitempty"`
	RequestedBy    []primitive.ObjectID `bson:"requestedBy,omitempty"`
}
