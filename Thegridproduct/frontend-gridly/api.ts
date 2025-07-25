// api.ts

import { NGROK_URL, ABLY_API_KEY } from "@env"; 
import { Conversation, Message } from "./types";

export const fetchConversations = async (
  userId: string,
  token: string,
  chatId?: string
): Promise<Conversation[]> => {
  try {
    const url = chatId
      ? `${NGROK_URL}/chats/${chatId}`
      : `${NGROK_URL}/chats/user/${userId}`;

    console.log("Fetching chats from:", url);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch conversations: ${response.status}`);
    }

    const data = await response.json();
    console.log("Chat API response:", JSON.stringify(data, null, 2)); 
    if (chatId) {
      return [data]; 
    }

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
    console.error("postMessage error:", error);
    throw new Error(error.message || "Unknown error while sending message");
  }
};

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

    return data; 
  } catch (error) {
    console.error("getMessages error:", error);
    throw error;
  }
};
export const sendChatMessage = async (
  chatId: string,
  message: string,
  config: { token: string; userId: string }
): Promise<string> => {
  const { token, userId } = config;

  const requestBody = {
    chatId: chatId,
    senderId: userId,
    content: message,
  };

  console.log("Sending message to chat:", requestBody);

  try {
    const response = await fetch(`${NGROK_URL}/chat/test-send-message`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    console.log("Response status:", response.status);

    if (!response.ok) {
      const errorResponse = await response.json();
      console.error("Backend response error:", errorResponse);
      throw new Error(errorResponse?.message || "Failed to send message");
    }

    const data = await response.json();
    console.log("Response from backend:", data);

    return data.status;
  } catch (error) {
    console.error("sendChatMessage error:", error);
    throw new Error(error.message || "Unknown error while sending message");
  }
};

