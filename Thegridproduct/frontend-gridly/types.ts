export interface Message {
    _id: string;
    sender: string;
    content: string;
    createdAt: string;
  }
  
  export interface Conversation {
    _id: string;
    participant: string;
    lastMessage: string;
    updatedAt: string;
    messages: Message[];
  }
  