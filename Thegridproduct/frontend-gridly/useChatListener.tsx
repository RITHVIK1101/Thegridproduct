// useChatListener.tsx
import { useEffect, useState, useContext } from "react";
import {
  getFirestore,
  collection,
  query,
  where,
  onSnapshot,
  documentId,
} from "firebase/firestore";
import { UserContext } from "./UserContext";
import { fetchConversations } from "./api"; // or wherever your fetch logic is
import { Message } from "./types";

const useChatListener = () => {
  const firestoreDB = getFirestore();
  const { userId, token, setUnreadCount } = useContext(UserContext);
  const [chatIDs, setChatIDs] = useState<string[]>([]);

  // 1) Fetch all chat IDs from your server once user is logged in
  useEffect(() => {
    if (!userId || !token) return;

    const loadChats = async () => {
      try {
        // "fetchConversations" presumably returns an array like:
        // [{ chatID: string; user: {...}, latestMessage: ... }, ...]
        const allChats = await fetchConversations(userId, token);
        const ids = allChats.map((c) => c.chatID);
        setChatIDs(ids);
      } catch (error) {
        console.error("Failed to fetch user chats", error);
      }
    };

    loadChats();
  }, [userId, token]);

  // 2) As soon as we know the user's chatIDs, set up a Firestore listener
  useEffect(() => {
    if (!userId || chatIDs.length === 0) return;

    // If you store participants in Firestore, you could do:
    // query(collection(firestoreDB, "chatRooms"), where("participants", "array-contains", userId))
    // But here, we'll assume we already have the chatIDs from the server:
    const q = query(
      collection(firestoreDB, "chatRooms"),
      where(documentId(), "in", chatIDs)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let totalUnread = 0;

      snapshot.forEach((doc) => {
        const data = doc.data();
        // Suppose each doc looks like { messages: Message[] }
        const messages: Message[] = data?.messages || [];

        // If you only want to count unread from the last message:
        //   const last = messages[messages.length - 1];
        //   if (last && last.senderId !== userId) totalUnread += 1;
        // Otherwise if you want to count *all* messages from others, you can do:
        const unreadForThisChat = messages.filter(
          (m) => m.senderId !== userId
        ).length;

        totalUnread += unreadForThisChat;
      });

      // 3) Update the global unread count in context
      setUnreadCount(totalUnread);
    });

    return () => unsubscribe(); // Clean up listener on unmount
  }, [chatIDs, userId]);

  return null; // This hook doesn't render anything
};

export default useChatListener;
