package models

// APIProduct represents the structure of a product sent to the frontend.
type APIProduct struct {
	ID            string   `json:"id"` // Converted from ObjectID to string
	Title         string   `json:"title"`
	Price         float64  `json:"price"`
	UserID        string   `json:"userId"`
	Description   string   `json:"description"`
	Category      string   `json:"category"`
	Images        []string `json:"images"`
	University    string   `json:"university"`
	PostedDate    string   `json:"postedDate"`       // ISO8601 string
	Rating        *int     `json:"rating,omitempty"` // Optional Rating
	ProductStatus string   `json:"productStatus"`    // 'shop' | 'talks' | 'sold'
}

// APICartProduct represents the structure of a cart product sent to the frontend.
type APICartProduct struct {
	ID            string   `json:"id"`
	Title         string   `json:"title"`
	Price         float64  `json:"price"`
	Images        []string `json:"images"`
	Quantity      int      `json:"quantity"`
	Description   string   `json:"description"`
	Category      string   `json:"category"`
	University    string   `json:"university"`
	PostedDate    string   `json:"postedDate"`
	Rating        *int     `json:"rating,omitempty"` // Optional Rating
	CartStatus    string   `json:"cartStatus"`       // 'current' | 'bought'
	ProductStatus string   `json:"productStatus"`    // 'shop' | 'talks' | 'sold'
}
