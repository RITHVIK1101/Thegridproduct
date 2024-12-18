// models/gig.go

package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// Gig represents a service gig posted by a user
type Gig struct {
	ID                  primitive.ObjectID `bson:"_id,omitempty" json:"id,omitempty"`
	UserID              primitive.ObjectID `bson:"userId" json:"userId"`
	University          string             `bson:"university" json:"university"`
	StudentType         string             `bson:"studentType" json:"studentType"`
	Title               string             `bson:"title" json:"title"`
	Category            string             `bson:"category" json:"category"`
	CoverImage          string             `bson:"coverImage" json:"coverImage"`
	Price               string             `bson:"price" json:"price"`               // Can be a price string or "Open to Communication"
	Availability        string             `bson:"availability" json:"availability"` // Mapped to "In Campus Only", etc.
	AdditionalLinks     []string           `bson:"additionalLinks" json:"additionalLinks"`
	AdditionalDocuments []string           `bson:"additionalDocuments" json:"additionalDocuments"`
	Description         string             `bson:"description" json:"description"`
	PostedDate          time.Time          `bson:"postedDate" json:"postedDate"`
	Expired             bool               `bson:"expired" json:"expired"`
	Status              string             `bson:"status" json:"status"` // e.g., "active", "completed"
	LikeCount           int                `bson:"likeCount" json:"likeCount"`
}
