// api.ts

import { NGROK_URL, ABLY_API_KEY } from "@env"; // Ensure NGROK_URL and ABLY_API_KEY are defined in your .env file
import { Conversation, Message } from "./types"; // Import necessary types

// Fetch user conversations
export const fetchConversations = async (
  userId: string,
  token: string,
  chatId?: string // Optional parameter
): Promise<Conversation[]> => {
  try {
    // If chatId is provided, fetch a specific chat
    const url = chatId
      ? `${NGROK_URL}/chats/${chatId}`
      : `${NGROK_URL}/chats/user/${userId}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch conversations");
    }

    const data = await response.json();

    if (!Array.isArray(data.conversations)) {
      console.warn("Unexpected response format for conversations:", data);
      return [];
    }

    return data.conversations;
  } catch (error) {
    console.error("fetchConversations error:", error);
    throw error;
  }
};

export const postMessage = async (
  chatId: string,
  message: string,
  config: { token: string; userId: string }
): Promise<string> => {
  try{
  const { token, userId } = config;
    const response = await fetch(`${NGROK_URL}/chat/test-send-message`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chatId: chatId,       // This field is optional if your endpoint doesn't need it in the body
        senderId: userId,     // Make sure this field matches what your handler expects
        content: message,
      }),
    });

    if (!response.ok) {
      const errorResponse = await response.json();
      console.error("Backend response error:", errorResponse);
      throw new Error(errorResponse?.message || "Failed to send message");
    }

    const data = await response.json();
    return data.status; // Ensure your backend returns a 'status' field
  } catch (error) {
    console.error("postMessage error:", error);
    throw new Error(error.message || "Unknown error while sending message");
  }
};


// Get messages for a specific chat from MongoDB
export const getMessages = async (
  chatId: string,
  token: string
): Promise<Message[]> => {
  try {
    const response = await fetch(`${NGROK_URL}/chats/${chatId}/messages`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch messages");
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
      console.warn("Unexpected response format for messages:", data);
      return [];
    }

    return data; // data is validated as an array
  } catch (error) {
    console.error("getMessages error:", error);
    throw error;
  }
};
// Rename the function to sendChatMessage
export const sendChatMessage = async (
  chatId: string,
  message: string,
  config: { token: string; userId: string }
): Promise<string> => {
  const { token, userId } = config;
  try {
    const response = await fetch(`${NGROK_URL}/chat/test-send-message`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chatId: chatId,
        senderId: userId,
        content: message,
      }),
    });

    if (!response.ok) {
      const errorResponse = await response.json();
      console.error("Backend response error:", errorResponse);
      throw new Error(errorResponse?.message || "Failed to send message");
    }

    const data = await response.json();
    return data.status; // Ensure your backend returns a 'status' field
  } catch (error) {
    console.error("sendChatMessage error:", error);
    throw new Error(error.message || "Unknown error while sending message");
  }
};