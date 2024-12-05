// types.ts

export interface User {
  firstName: string;
  lastName: string;
}

export interface Message {
  _id: string;
  sender: "user" | "other"; // Adjust based on backend implementation
  senderID: string;
  content: string;
  timestamp: string; // ISO string
  chatID?: string; // Optional, depending on backend
}

export interface Conversation {
  chatID: string;
  productID: string;
  productTitle: string;
  user: User;
  latestMessage?: string;
  latestTimestamp?: string;
  messages?: Message[]; // Make messages optional
}
