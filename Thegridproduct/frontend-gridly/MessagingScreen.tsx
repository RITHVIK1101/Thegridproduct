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
import { NGROK_URL } from "@env"; // Ensure NGROK_URL is defined in your .env file
import { Conversation, Message } from "./types";
import { UserContext } from "./UserContext";

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
  const webSocketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (userId && token) {
      fetchUserConversations();
    }
  }, [userId, token]);

  useEffect(() => {
    if (selectedConversation) {
      connectToWebSocket(selectedConversation.chatID);
    }

    return () => {
      if (webSocketRef.current) {
        webSocketRef.current.close();
      }
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

  const connectToWebSocket = (chatId: string) => {
    if (!userId || !token) {
      console.warn("No userId or token available for WebSocket connection");
      return;
    }

    // Make sure we use wss:// if the URL is https://
    let wsUrl = NGROK_URL;
    if (wsUrl.startsWith("https://")) {
      wsUrl = wsUrl.replace("https://", "wss://");
    } else if (wsUrl.startsWith("http://")) {
      wsUrl = wsUrl.replace("http://", "ws://");
    }

    // Double-check that userId and token are correct (for debugging)
    console.log("Connecting to WebSocket with:", {
      wsUrl,
      chatId,
      userId,
      token,
    });

    const ws = new WebSocket(`${wsUrl}/ws/${chatId}/${userId}?token=${token}`);
    webSocketRef.current = ws;

    ws.onopen = () => {
      console.log("WebSocket connection established");
    };

    ws.onmessage = (event) => {
      try {
        const message: Message = JSON.parse(event.data);
        console.log("Received message via WebSocket:", message);
        setSelectedConversation((prev) => {
          if (!prev) return prev;
          return { ...prev, messages: [...(prev.messages || []), message] };
        });
      } catch (err) {
        console.error("Error parsing WebSocket message:", err);
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      Alert.alert(
        "WebSocket Error",
        "An error occurred with the WebSocket connection."
      );
    };

    ws.onclose = (event) => {
      if (event.code !== 1000) {
        console.log(
          `WebSocket closed with code: ${event.code}, reason: ${event.reason}`
        );
        Alert.alert(
          "WebSocket Closed",
          "The WebSocket connection was closed unexpectedly."
        );
      }
      console.log("WebSocket connection closed");
    };
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
      // In sendMessage function:
      await postMessage(
        selectedConversation.chatID,
        messageContent,
        token,
        userId
      );

      // The message will be added via WebSocket when the server broadcasts it
    } catch (error) {
      console.error("sendMessage error:", error);
      Alert.alert("Error", "Failed to send message.");
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
          if (webSocketRef.current) {
            webSocketRef.current.close();
          }
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
                  if (webSocketRef.current) {
                    webSocketRef.current.close();
                  }
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
