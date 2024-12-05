import { NGROK_URL } from "@env";

// api.ts

// api.ts

export const fetchConversations = async (userId: string, token: string): Promise<Conversation[]> => {
  try {
    const response = await fetch(`https://thegridproduct-production.up.railway.app/chats/user/${userId}`, {
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
    // Ensure that 'conversations' exists in the response
    if (!data.conversations) {
      throw new Error('Invalid response structure');
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
  token: string
) => {
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
