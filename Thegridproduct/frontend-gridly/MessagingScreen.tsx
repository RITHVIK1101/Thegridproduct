// MessagingScreen.tsx

import React, { useState, useEffect, useContext, useRef } from "react";
import {
  SafeAreaView,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  View,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import BottomNavBar from "./components/BottomNavbar";
import { fetchConversations, postMessage, getMessages } from "./api";
import { NGROK_URL, ABLY_API_KEY } from "@env"; // Ensure ABLY_API_KEY is defined in your .env file
import { Conversation, Message } from "./types";
import { UserContext } from "./UserContext";
import Ably from "ably";

type TabType = "marketplace" | "gigs";

const MessagingScreen: React.FC = () => {
  const [selectedTab, setSelectedTab] = useState<TabType>("marketplace");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isChatModalVisible, setChatModalVisible] = useState<boolean>(false);
  const [selectedConversation, setSelectedConversation] =
    useState<Conversation | null>(null);
  const [newMessage, setNewMessage] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [sending, setSending] = useState<boolean>(false);

  const { userId, token } = useContext(UserContext);
  const ablyRef = useRef<Ably.Realtime | null>(null);
  const channelRef = useRef<Ably.RealtimeChannel | null>(null);

  useEffect(() => {
    if (userId && token) {
      fetchUserConversations();
    }
  }, [userId, token]);

  useEffect(() => {
    // Initialize Ably client once
    if (!ablyRef.current) {
      ablyRef.current = new Ably.Realtime({
        key: ABLY_API_KEY,
      });

      ablyRef.current.connection.on("connected", () => {
        console.log("Ably connected");
      });

      ablyRef.current.connection.on("failed", (stateChange) => {
        console.error("Ably connection failed:", stateChange.reason);
        Alert.alert(
          "Error",
          "Failed to connect to real-time messaging service."
        );
      });
    }

    return () => {
      // Clean up Ably connection on component unmount
      if (ablyRef.current) {
        ablyRef.current.close();
        ablyRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (selectedConversation) {
      subscribeToChannel(selectedConversation.chatID);
    }

    return () => {
      unsubscribeFromChannel();
    };
  }, [selectedConversation]);

  const fetchUserConversations = async () => {
    if (!userId || !token) return;

    setLoading(true);
    try {
      const fetchedConversations = await fetchConversations(userId, token);
      console.log("Fetched Conversations:", fetchedConversations);
      setConversations(fetchedConversations);
    } catch (error) {
      console.error("Error fetching conversations:", error);
      Alert.alert("Error", "Failed to load conversations.");
    } finally {
      setLoading(false);
    }
  };

  const subscribeToChannel = (chatId: string) => {
    if (!ablyRef.current) {
      console.warn("Ably client is not initialized");
      return;
    }

    const channel = ablyRef.current.channels.get(chatId);
    channelRef.current = channel;

    // Subscribe to messages
    channel.subscribe("message", (msg) => {
      try {
        const messageData = msg.data as {
          senderId: string;
          content: string;
          timestamp: number;
        };
        console.log("Received message via Ably:", messageData);

        const newMsg: Message = {
          _id: Date.now().toString(),
          sender: messageData.senderId === userId ? "user" : "other",
          senderID: messageData.senderId,
          content: messageData.content,
          timestamp: new Date(messageData.timestamp * 1000).toISOString(),
        };

        setSelectedConversation((prev) => {
          if (!prev) return prev;
          return { ...prev, messages: [...(prev.messages || []), newMsg] };
        });
      } catch (err) {
        console.error("Error parsing Ably message data:", err);
      }
    });

    // Handle channel state changes
    channel.on("attached", () => {
      console.log(`Subscribed to Ably channel: ${chatId}`);
    });

    channel.on("update", (stateChange) => {
      if (stateChange.current === "failed") {
        console.error(
          "Channel failed:",
          stateChange.reason?.message || "Unknown reason"
        );
        Alert.alert(
          "Error",
          `An error occurred with the channel: ${
            stateChange.reason?.message || "Unknown reason"
          }`
        );
      } else {
        console.log(`Channel state changed to: ${stateChange.current}`);
      }
    });

    channel.on("failed", (err) => {
      Alert.alert(
        "Error",
        "An error occurred with the real-time messaging service."
      );
    });
  };

  const unsubscribeFromChannel = () => {
    if (channelRef.current) {
      channelRef.current.unsubscribe("message");
      channelRef.current.unsubscribe("failed");
      channelRef.current = null;
      console.log("Unsubscribed from Ably channel");
    }
  };

  const openChat = async (conversation: Conversation) => {
    setLoading(true);
    try {
      const messages = await getMessages(conversation.chatID, token || "");
      setSelectedConversation({
        ...conversation,
        messages: messages,
      });
      setChatModalVisible(true);
      setNewMessage("");
    } catch (error) {
      console.error("Error fetching messages:", error);
      Alert.alert("Error", "Failed to load messages.");
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation) {
      Alert.alert("Error", "Please enter a message.");
      return;
    }

    setSending(true);
    const messageContent = newMessage.trim();
    setNewMessage("");

    try {
      const status = await postMessage(
        selectedConversation.chatID,
        messageContent,
        token,
        userId
      );
      console.log("Message sent successfully:", status);
      // The message will be added via Ably subscription
    } catch (error) {
      console.error("sendMessage error:", error);
      Alert.alert("Error", error.message || "Failed to send message.");
    } finally {
      setSending(false);
    }
  };

  const renderConversation = ({ item }: { item: Conversation }) => {
    if (!item.user) {
      console.warn(
        `Conversation with chatID ${item.chatID} is missing user data.`
      );
      return null;
    }

    const latestMessage =
      item.latestMessage && item.latestTimestamp
        ? {
            content: item.latestMessage,
            timestamp: item.latestTimestamp,
          }
        : null;

    const formattedTimestamp = latestMessage
      ? new Date(latestMessage.timestamp).toLocaleString()
      : "";

    return (
      <TouchableOpacity
        style={styles.conversationItem}
        onPress={() => openChat(item)}
      >
        <View style={styles.conversationDetails}>
          <View>
            <Text style={styles.participantName}>
              {item.user.firstName} {item.user.lastName}
            </Text>
            <Text style={styles.productName}>{item.productTitle}</Text>
            {latestMessage && (
              <View style={styles.messageInfo}>
                <Text style={styles.latestMessage} numberOfLines={1}>
                  {latestMessage.content}
                </Text>
                <Text style={styles.timestamp}>{formattedTimestamp}</Text>
              </View>
            )}
          </View>
          {/* Optionally, you can add an icon or avatar here */}
        </View>
      </TouchableOpacity>
    );
  };

  const renderMessage = ({ item }: { item: Message }) => (
    <View
      style={[
        styles.messageBubble,
        item.sender === "user" ? styles.myMessage : styles.theirMessage,
      ]}
    >
      <Text style={styles.messageText}>{item.content}</Text>
      <Text style={styles.messageTimestamp}>
        {new Date(item.timestamp).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>Conversations</Text>
      {loading ? (
        <ActivityIndicator size="large" color="#BB86FC" />
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.chatID}
          renderItem={renderConversation}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No conversations found.</Text>
            </View>
          }
        />
      )}

      <Modal
        visible={isChatModalVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => {
          setChatModalVisible(false);
          setSelectedConversation(null);
          unsubscribeFromChannel();
        }}
      >
        <SafeAreaView style={styles.modalSafeArea}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.modalContainer}
          >
            <View style={styles.chatHeader}>
              <TouchableOpacity
                onPress={() => {
                  setChatModalVisible(false);
                  setSelectedConversation(null);
                  unsubscribeFromChannel();
                }}
                style={styles.backButton}
              >
                <Ionicons name="arrow-back" size={24} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.chatTitle} numberOfLines={1}>
                {selectedConversation?.user.firstName}{" "}
                {selectedConversation?.user.lastName}
              </Text>
            </View>

            <FlatList
              data={selectedConversation?.messages || []} // Provide an empty array as fallback
              keyExtractor={(item, index) =>
                item._id ? item._id : index.toString()
              }
              renderItem={renderMessage}
              contentContainerStyle={styles.messagesList}
              inverted
            />

            <View style={styles.inputContainer}>
              <TextInput
                style={styles.messageInput}
                placeholder="Type a message..."
                placeholderTextColor="#888"
                value={newMessage}
                onChangeText={setNewMessage}
                multiline
              />
              <TouchableOpacity
                style={styles.sendButton}
                onPress={sendMessage}
                disabled={sending}
              >
                {sending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Ionicons name="send" size={20} color="#fff" />
                )}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      <BottomNavBar />
    </SafeAreaView>
  );
};

export default MessagingScreen;

// Styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
    padding: 20,
  },
  header: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#BB86FC",
    marginBottom: 10,
  },
  conversationItem: {
    padding: 15,
    borderRadius: 10,
    backgroundColor: "#1F1F1F",
    marginBottom: 10,
  },
  conversationDetails: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  participantName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#BB86FC",
  },
  productName: {
    fontSize: 14,
    color: "#ccc",
  },
  messageInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 5,
  },
  latestMessage: {
    fontSize: 12,
    color: "#888",
    flex: 1,
    marginRight: 10,
  },
  timestamp: {
    fontSize: 10,
    color: "#888",
  },
  emptyContainer: {
    marginTop: 50,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 16,
    color: "#888",
  },
  modalSafeArea: {
    flex: 1,
    backgroundColor: "#121212",
  },
  modalContainer: {
    flex: 1,
    padding: 10,
  },
  chatHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    backgroundColor: "#BB86FC",
    borderRadius: 10,
    marginBottom: 10,
  },
  backButton: {
    marginRight: 10,
  },
  chatTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
    flexShrink: 1,
  },
  messagesList: {
    flexGrow: 1,
    justifyContent: "flex-end",
  },
  messageBubble: {
    padding: 10,
    borderRadius: 10,
    marginBottom: 5,
    maxWidth: "80%",
  },
  myMessage: {
    alignSelf: "flex-end",
    backgroundColor: "#BB86FC",
  },
  theirMessage: {
    alignSelf: "flex-start",
    backgroundColor: "#1F1F1F",
  },
  messageText: {
    color: "#fff",
    fontSize: 14,
  },
  messageTimestamp: {
    color: "#ddd",
    fontSize: 10,
    marginTop: 2,
    alignSelf: "flex-end",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 1,
    borderColor: "#333",
    padding: 10,
  },
  messageInput: {
    flex: 1,
    backgroundColor: "#333",
    borderRadius: 20,
    paddingHorizontal: 15,
    color: "#fff",
    marginRight: 10,
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: "#BB86FC",
    borderRadius: 20,
    padding: 10,
    justifyContent: "center",
    alignItems: "center",
  },
});
