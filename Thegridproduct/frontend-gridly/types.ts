// types.ts

export interface User {
  firstName: string;
  lastName: string;
}

export interface Message {
  _id: string;
  sender: "user" | "other"; // Adjust based on your backend
  senderID: string;
  content: string;
  timestamp: string; // ISO string
}

export interface Conversation {
  chatID: string;
  productID: string;
  productTitle: string;
  user: User;
  messages: Message[];
}
