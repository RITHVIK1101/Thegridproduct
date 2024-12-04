export interface Message {
    _id: string;
    sender: string;
    content: string;
    createdAt: string;
  }
  
  export interface Conversation {
    chatID: string;
    productID: string;
    productTitle: string;
    user: {
      firstName: string;
      lastName: string;
    };
  }
  