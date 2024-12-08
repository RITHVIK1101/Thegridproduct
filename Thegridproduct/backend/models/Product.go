package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// Constants for Listing Types
const (
	ListingTypeSelling = "Selling"
	ListingTypeRenting = "Renting"
	ListingTypeBoth    = "Both"
)

// Constants for Availability
const (
	AvailabilityInCampusOnly   = "In Campus Only"
	AvailabilityOnAndOffCampus = "On and Off Campus"
)

// Constants for Student Types
const (
	StudentTypeHighSchool = "highschool"
	StudentTypeUniversity = "university"
)

// Constants for Condition
const (
	ConditionNew  = "New"
	ConditionUsed = "Used"
)

// Constants for Status
const (
	StatusShop  = "shop"
	StatusTalks = "talks"
	StatusSold  = "sold"
)

// Product represents the structure of a product in MongoDB
type Product struct {
	ID                     primitive.ObjectID `json:"id,omitempty" bson:"_id,omitempty"`                            // Unique Product ID
	UserID                 primitive.ObjectID `json:"userId" bson:"userId"`                                         // Owner's User ID
	Title                  string             `json:"title" bson:"title"`                                           // Product Title
	Price                  float64            `json:"price" bson:"price"`                                           // Base Price
	OutOfCampusPrice       *float64           `json:"outOfCampusPrice,omitempty" bson:"outOfCampusPrice,omitempty"` // Off-Campus Price (optional)
	RentPrice              *float64           `json:"rentPrice,omitempty" bson:"rentPrice,omitempty"`               // Renting Price (optional)
	RentDuration           *string            `json:"rentDuration,omitempty" bson:"rentDuration,omitempty"`         // Rent Duration (optional)
	Description            string             `json:"description" bson:"description"`                               // Product Description
	SelectedTags           []string           `json:"selectedTags" bson:"selectedTags"`                             // Tags for Categorization
	Images                 []string           `json:"images" bson:"images"`                                         // Image URLs
	PostedDate             time.Time          `json:"postedDate,omitempty" bson:"postedDate,omitempty"`             // Posted Date
	Expired                bool               `json:"expired" bson:"expired"`                                       // Expiration Status
	IsAvailableOutOfCampus bool               `json:"isAvailableOutOfCampus" bson:"isAvailableOutOfCampus"`         // Off-Campus Availability
	Rating                 int                `json:"rating" bson:"rating"`                                         // Product Rating (1–5)
	ListingType            string             `json:"listingType" bson:"listingType"`                               // Listing Type: Selling, Renting, Both
	Availability           string             `json:"availability" bson:"availability"`                             // Availability: In Campus Only, On and Off Campus
	University             string             `json:"university" bson:"university"`                                 // Associated University
	StudentType            string             `json:"studentType" bson:"studentType"`                               // Highschool or University
	Condition              *string            `json:"condition,omitempty" bson:"condition,omitempty"`               // Condition: New, Used (optional)
	Status                 string             `json:"status" bson:"status"`                                         // Product Status: shop, talks, etc.
}
