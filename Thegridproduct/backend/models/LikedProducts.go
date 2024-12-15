package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// LikedProduct represents a single liked product (optional struct for metadata like timestamps)
type LikedProduct struct {
	ProductID primitive.ObjectID `json:"productId" bson:"productId"`
	LikedAt   time.Time          `json:"likedAt" bson:"likedAt"`
}
