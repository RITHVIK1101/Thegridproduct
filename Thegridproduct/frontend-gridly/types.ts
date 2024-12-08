export interface User {
  firstName: string;
  lastName: string;
}

export interface Message {
  _id?: string; // Optional for real-time messages that may not have an `_id` yet
  sender: "user" | "other"; // Determines whether the message is from the logged-in user or another participant
  senderID: string; // The ID of the sender
  content: string; // The actual message content
  timestamp: string; // ISO string for timestamp consistency
  chatID?: string; // Optional, depending on whether the backend attaches chatID to messages
}

export interface Conversation {
  chatID: string; 
  productID: string; 
  productTitle: string; 
  user: User; // The other participant's user information
  latestMessage?: string; // Optional: preview of the latest message
  latestTimestamp?: string; // Optional: timestamp of the latest message
  messages?: Message[]; // Optional: array of messages in the conversation
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
