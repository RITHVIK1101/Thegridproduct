// models/Gig.go

package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// Gig represents the structure of a gig in MongoDB
type Gig struct {
	ID          primitive.ObjectID `json:"id,omitempty" bson:"_id,omitempty"`
	UserID      string             `json:"userId" bson:"userId"`
	IsAnonymous bool               `json:"isAnonymous" bson:"isAnonymous"`
	IsOnline    bool               `json:"isOnline" bson:"isOnline"`
	TaskName    string             `json:"taskName" bson:"taskName"`
	Description string             `json:"description" bson:"description"`
	DueDate     time.Time          `json:"dueDate" bson:"dueDate"`
	Budget      string             `json:"budget" bson:"budget"`
	Images      []string           `json:"images" bson:"images"`
	CreatedAt   time.Time          `json:"createdAt,omitempty" bson:"createdAt,omitempty"`
	UpdatedAt   time.Time          `json:"updatedAt,omitempty" bson:"updatedAt,omitempty"`
}
