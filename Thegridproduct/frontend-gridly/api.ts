// api.ts

import { NGROK_URL } from "@env"; // Ensure NGROK_URL is defined in your .env file
import { Conversation, Message } from "./types"; // Import necessary types

// Fetch user conversations
export const fetchConversations = async (userId: string, token: string): Promise<Conversation[]> => {
  try {
    const response = await fetch(`${NGROK_URL}/chats/user/${userId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch conversations');
    }

    const data = await response.json();
    if (!data.conversations) {
      throw new Error('Invalid response structure');
    }

    return data.conversations;
  } catch (error) {
    console.error("fetchConversations error:", error);
    throw error;
  }
};

// Post a new message
export const postMessage = async (
  chatId: string,
  message: string,
  token: string
): Promise<string> => {
  try {
    const response = await fetch(`${NGROK_URL}/chats/${chatId}/messages`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content: message }),
    });
    if (!response.ok) {
      throw new Error("Failed to send message");
    }
    const data = await response.json();
    return data.message;
  } catch (error) {
    console.error("Error sending message:", error);
    throw error;
  }
};

// Get messages for a specific chat
export const getMessages = async (chatId: string, token: string): Promise<Message[]> => {
  try {
    const response = await fetch(`${NGROK_URL}/chats/${chatId}/messages`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch messages');
    }

    const data = await response.json();
    if (!data.messages) {
      throw new Error('Invalid response structure');
    }

    return data.messages;
  } catch (error) {
    console.error("getMessages error:", error);
    throw error;
  }
};
