// models/Product.go

package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// Product represents the structure of a product in MongoDB
type Product struct {
	ID                     primitive.ObjectID `json:"id,omitempty" bson:"_id,omitempty"`
	UserID                 primitive.ObjectID `json:"userId" bson:"userId"`
	Title                  string             `json:"title" bson:"title"`
	Price                  float64            `json:"price" bson:"price"`
	OutOfCampusPrice       float64            `json:"outOfCampusPrice,omitempty" bson:"outOfCampusPrice,omitempty"` // Off-Campus Selling Price (if applicable)
	RentPrice              float64            `json:"rentPrice,omitempty" bson:"rentPrice,omitempty"`               // Renting Price
	RentDuration           string             `json:"rentDuration,omitempty" bson:"rentDuration,omitempty"`         // Duration for Rent
	Description            string             `json:"description" bson:"description"`                               // Product Description
	SelectedTags           []string           `json:"selectedTags" bson:"selectedTags"`                             // Tags associated with the product
	Images                 []string           `json:"images" bson:"images"`                                         // Image URLs
	PostedDate             time.Time          `json:"postedDate,omitempty" bson:"postedDate,omitempty"`             // Date when the product was posted
	Expired                bool               `json:"expired,omitempty" bson:"expired,omitempty"`                   // Expiration status
	IsAvailableOutOfCampus bool               `json:"isAvailableOutOfCampus" bson:"isAvailableOutOfCampus"`         // Availability outside campus
	Rating                 int                `json:"rating" bson:"rating"`                                         // Product Rating
	ListingType            string             `json:"listingType" bson:"listingType"`                               // "Selling", "Renting", or "Both"
	Availability           string             `json:"availability" bson:"availability"`                             // "In Campus Only" or "On and Off Campus"
	University             string             `json:"university" bson:"university"`                                 // University associated with the product
	StudentType            string             `json:"studentType" bson:"studentType"`                               // "highschool" or "university"
	Condition              string             `json:"condition,omitempty" bson:"condition,omitempty"`               // "New" or "Used"
}
