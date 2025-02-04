export interface User {
  firstName: string;
  lastName: string;
  userId?: string;  // ✅ Optional
  email?: string;   // ✅ Optional
}


export interface Message {
  _id?: string; // Optional for real-time messages that may not have an `_id` yet
  sender: "user" | "other"; // Determines whether the message is from the logged-in user or another participant
  senderId: string; // The ID of the sender
  content: string; // The actual message content
  timestamp: string; // ISO string for timestamp consistency
  chatID?: string; // Optional, depending on whether the backend attaches chatID to messages
}

export interface Conversation {
  chatID: string;
  productID?: string;
  productTitle?: string;
  user: User;
  latestMessage?: string;
  latestTimestamp?: string;
  messages?: Message[];
  referenceType?: "products" | "gigs";
  referenceTitle?: string; // ✅ Added to store either a productTitle or a gigTitle
}


export type Cart = {
  userId: string;
  items: Array<{
    productId: string;
    quantity: number;
    cartStatus: 'current' | 'bought';
  }>;
  createdAt: string;
  updatedAt: string;
};

export type Product = {
  id: string;
  title: string;
  price: number;
  userId: string;
  description: string;
  category: string;
  images: string[];
  university: string;
  ownerId?: string;
  postedDate: string;
  rating?: number;
  quality?: string;
  productStatus: 'shop' | 'talks' | 'sold'; // Added productStatus as part of the definition
};
export type Gig = {
  id: string;
  userId: string;
  university: string;
  studentType: string;
  title: string;
  category: string;
  description: string;
  price: string;
  deliveryTime: string;
  images: string[];
  postedDate: string;
  expirationDate?: string; // ✅ Fix: Make sure this is defined
  expired?: boolean; // ✅ Fix: Add this too
  status: "active" | "completed";
  likeCount: number;
  campusPresence: "inCampus" | "flexible";
};

