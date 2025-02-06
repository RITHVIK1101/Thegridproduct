package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type Product struct {
	ID                     primitive.ObjectID   `json:"id,omitempty" bson:"_id,omitempty"`
	UserID                 primitive.ObjectID   `json:"userId" bson:"userId"`
	BuyerID                *primitive.ObjectID  `json:"buyerId,omitempty" bson:"buyerId,omitempty"`
	Title                  string               `json:"title" bson:"title"`
	Price                  float64              `json:"price" bson:"price"`
	OutOfCampusPrice       *float64             `json:"outOfCampusPrice,omitempty" bson:"outOfCampusPrice,omitempty"`
	RentPrice              *float64             `json:"rentPrice,omitempty" bson:"rentPrice,omitempty"`
	RentDuration           string               `json:"rentDuration,omitempty" bson:"rentDuration,omitempty"`
	Description            string               `json:"description" bson:"description"`
	SelectedTags           []string             `json:"selectedTags" bson:"selectedTags"`
	Images                 []string             `json:"images" bson:"images"`
	PostedDate             time.Time            `json:"postedDate,omitempty" bson:"postedDate,omitempty"`
	Expired                bool                 `json:"expired" bson:"expired"`
	IsAvailableOutOfCampus bool                 `json:"isAvailableOutOfCampus" bson:"isAvailableOutOfCampus"`
	Rating                 int                  `json:"rating" bson:"rating"`
	ListingType            string               `json:"listingType" bson:"listingType"`
	Availability           string               `json:"availability" bson:"availability"`
	University             string               `json:"university" bson:"university"`
	StudentType            string               `json:"studentType" bson:"studentType"`
	Condition              string               `json:"condition,omitempty" bson:"condition,omitempty"`
	Status                 string               `json:"status" bson:"status"`
	LikeCount              int                  `json:"likeCount" bson:"likeCount"`
	ChatCount              int                  `json:"chatCount,omitempty" bson:"chatCount,omitempty"`
	RequestedBy            []primitive.ObjectID `json:"requestedBy,omitempty" bson:"requestedBy,omitempty"` // ✅ New Field
}
