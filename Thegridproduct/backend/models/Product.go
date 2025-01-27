package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type Product struct {
	ID                     primitive.ObjectID  `json:"id,omitempty" bson:"_id,omitempty"`
	UserID                 primitive.ObjectID  `json:"userId" bson:"userId"`                                         // Seller ID (Required)
	BuyerID                *primitive.ObjectID `json:"buyerId,omitempty" bson:"buyerId,omitempty"`                   // Optional Buyer ID (nullable)
	Title                  string              `json:"title" bson:"title"`                                           // Required
	Price                  float64             `json:"price" bson:"price"`                                           // Required for Selling
	OutOfCampusPrice       *float64            `json:"outOfCampusPrice,omitempty" bson:"outOfCampusPrice,omitempty"` // Optional for off-campus listing
	RentPrice              *float64            `json:"rentPrice,omitempty" bson:"rentPrice,omitempty"`               // Optional for Renting
	RentDuration           string              `json:"rentDuration,omitempty" bson:"rentDuration,omitempty"`         // Required for Renting
	Description            string              `json:"description" bson:"description"`                               // Required
	SelectedTags           []string            `json:"selectedTags" bson:"selectedTags"`                             // Required (must have at least one tag)
	Images                 []string            `json:"images" bson:"images"`                                         // Required (must have at least one image)
	PostedDate             time.Time           `json:"postedDate,omitempty" bson:"postedDate,omitempty"`             // Auto-generated timestamp
	Expired                bool                `json:"expired,omitempty" bson:"expired,omitempty"`                   // Default to false
	IsAvailableOutOfCampus bool                `json:"isAvailableOutOfCampus" bson:"isAvailableOutOfCampus"`
	Rating                 int                 `json:"rating" bson:"rating"`                           // Must be between 1-5
	ListingType            string              `json:"listingType" bson:"listingType"`                 // Selling, Renting, Both
	Availability           string              `json:"availability" bson:"availability"`               // In Campus, Out of Campus, Both
	University             string              `json:"university" bson:"university"`                   // Required for campus listings
	StudentType            string              `json:"studentType" bson:"studentType"`                 // High School, University
	Condition              string              `json:"condition,omitempty" bson:"condition,omitempty"` // Required for Renting/Both
	Status                 string              `json:"status" bson:"status"`                           // Default: inshop
	LikeCount              int                 `json:"likeCount" bson:"likeCount"`                     // Default to 0
	ChatCount              int                 `json:"chatCount,omitempty" bson:"chatCount,omitempty"` // Default to 0, tracks the number of chats
}
