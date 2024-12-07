// api.ts

import { NGROK_URL, ABLY_API_KEY } from "@env"; // Ensure NGROK_URL and ABLY_API_KEY are defined in your .env file
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
  token: string,
  userId: string
): Promise<string> => {
  try {
    const response = await fetch(`${NGROK_URL}/messages`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chatId: chatId,
        senderId: userId, // Make sure `senderId` matches backend expectations
        content: message,
      }),
    });

    if (!response.ok) {
      const errorResponse = await response.json();
      console.error("Backend response error:", errorResponse);
      throw new Error(errorResponse?.message || "Failed to send message");
    }

    const data = await response.json();
    return data.status; // Ensure backend response has `status` field
  } catch (error) {
    console.error("postMessage error:", error);
    throw new Error(error.message || "Unknown error while sending message");
  }
};


// Get messages for a specific chat from MongoDB
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
    // Check if it's an array
    if (!Array.isArray(data)) {
      throw new Error('Invalid response structure');
    }

    return data; // data is already an array of messages
  } catch (error) {
    console.error("getMessages error:", error);
    throw error;
  }
};
