import { NGROK_URL } from "@env";

export const fetchConversations = async (userId: string, token: string) => {
  try {
    const response = await fetch(`${NGROK_URL}/chats?userId=${userId}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
      },
    });
    if (!response.ok) {
      throw new Error("Failed to fetch conversations");
    }
    const data = await response.json();
    return data.conversations;
  } catch (error) {
    console.error("Error fetching conversations:", error);
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
