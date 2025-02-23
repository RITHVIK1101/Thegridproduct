package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// User represents a user in the system.
type User struct {
	ID               primitive.ObjectID   `json:"id,omitempty" bson:"_id,omitempty"`
	Email            string               `json:"email" bson:"email"`
	Password         string               `json:"password" bson:"password"`
	FirstName        string               `json:"firstName" bson:"firstName"`
	LastName         string               `json:"lastName" bson:"lastName"`
	StudentType      string               `json:"studentType" bson:"studentType"` // "highschool" or "university"
	Institution      string               `json:"institution" bson:"institution"`
	CreatedAt        time.Time            `json:"createdAt" bson:"createdAt"`
	UpdatedAt        time.Time            `json:"updatedAt" bson:"updatedAt"`
	StripeCustomerID string               `json:"stripeCustomerId,omitempty" bson:"stripeCustomerId,omitempty"`
	LikedProducts    []primitive.ObjectID `json:"likedProducts,omitempty" bson:"likedProducts,omitempty"`
	ExpoPushToken    string               `json:"expoPushToken,omitempty" bson:"expoPushToken,omitempty"`
}
