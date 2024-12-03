// MessagingScreen.tsx

import React, { useState, useEffect, useRef, useMemo, useContext } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { NGROK_URL } from "@env";
import BottomNavBar from "./components/BottomNavbar";
import { fetchConversations, postMessage } from "./api"; // Import API functions
import { Conversation, Message } from "./types";
import { UserContext } from "./UserContext"; // Import UserContext

// Define TabType outside the component for better type management
type TabType = "marketplace" | "gigs";

const MessagingScreen: React.FC = () => {
  // State Variables
  const [selectedTab, setSelectedTab] = useState<TabType>("marketplace");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isChatModalVisible, setChatModalVisible] = useState<boolean>(false);
  const [selectedConversation, setSelectedConversation] =
    useState<Conversation | null>(null);
  const [newMessage, setNewMessage] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingMessages, setLoadingMessages] = useState<boolean>(false);

  // Access UserContext
  const {
    userId,
    token,
    institution,
    studentType,
    isLoading: isUserLoading,
  } = useContext(UserContext);

  // WebSocket Reference
  const ws = useRef<WebSocket | null>(null);

  // Reconnection Attempts Counter
  const reconnectAttempts = useRef<number>(0);

  // Ref for Messages FlatList to auto-scroll
  const messagesEndRef = useRef<FlatList>(null);

  // Memoized Sorted Conversations to optimize performance
  const sortedConversations = useMemo(() => {
    return [...conversations].sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }, [conversations]);

  // Effect to fetch conversations and initialize WebSocket on selectedTab change
  useEffect(() => {
    fetchUserConversations();
    initializeWebSocket();

    // Cleanup on unmount
    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTab]);

  // Function to fetch user conversations from backend
  const fetchUserConversations = async () => {
    if (!userId || !token) return;

    setLoading(true);
    try {
      const fetchedConversations = await fetchConversations(userId, token);
      // Filter conversations based on selectedTab
      const filteredConversations = fetchedConversations.filter((conv) => {
        // Adjust the filtering logic based on your actual data structure
        // For example, if Conversation has a 'type' field:
        // return conv.type === selectedTab;
        // Here, we'll assume all conversations are relevant to both tabs
        return true;
      });
      setConversations(filteredConversations);
    } catch (error) {
      console.error("fetchUserConversations error:", error);
      Alert.alert("Error", "Failed to load conversations.");
    } finally {
      setLoading(false);
    }
  };

  // Function to initialize WebSocket connection
  const initializeWebSocket = () => {
    if (!userId || !token) return;

    try {
      ws.current = new WebSocket(
        `${NGROK_URL.replace("https", "ws")}/ws?token=${token}`
      );
    } catch (error) {
      console.error("WebSocket initialization error:", error);
      Alert.alert("Connection Error", "Failed to initialize WebSocket.");
      return;
    }

    ws.current.onopen = () => {
      console.log("WebSocket connected.");
      reconnectAttempts.current = 0;
      // Optionally, send a message to join specific chats
      // Example: ws.current?.send(JSON.stringify({ type: "join_chat", chatId: "..." }));
    };

    ws.current.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        handleWebSocketMessage(data);
      } catch (error) {
        console.error("WebSocket message parsing error:", error);
      }
    };

    ws.current.onerror = (e) => {
      console.error("WebSocket error:", e.message);
    };

    ws.current.onclose = (e) => {
      console.log("WebSocket closed:", e.code, e.reason);
      // Attempt to reconnect with exponential backoff
      if (reconnectAttempts.current < 5) {
        const timeout = Math.pow(2, reconnectAttempts.current) * 1000; // Exponential backoff
        setTimeout(() => {
          reconnectAttempts.current += 1;
          initializeWebSocket();
        }, timeout);
      } else {
        Alert.alert(
          "Connection Error",
          "Unable to reconnect to the chat server."
        );
      }
    };
  };

  // Function to handle incoming WebSocket messages
  const handleWebSocketMessage = (data: any) => {
    if (data.type === "new_message") {
      const { chatId, message } = data;
      handleIncomingMessage(chatId, message);
    }
    // Handle other message types as needed
  };

  // Function to update state with incoming message
  const handleIncomingMessage = (chatId: string, message: Message) => {
    setConversations((prevConversations) =>
      prevConversations.map((conv) => {
        if (conv._id === chatId) {
          return {
            ...conv,
            lastMessage: message.content,
            updatedAt: message.createdAt,
            messages: [...conv.messages, message],
          };
        }
        return conv;
      })
    );

    if (selectedConversation && selectedConversation._id === chatId) {
      setSelectedConversation((prevConv) => {
        if (!prevConv) return prevConv;
        return {
          ...prevConv,
          lastMessage: message.content,
          updatedAt: message.createdAt,
          messages: [...prevConv.messages, message],
        };
      });
    }
  };

  // Function to handle tab changes
  const handleTabChange = (tab: TabType) => {
    setSelectedTab(tab);
    setSelectedConversation(null);
    setChatModalVisible(false);
    setNewMessage("");
  };

  // Function to open chat modal
  const openChat = (conversation: Conversation) => {
    setSelectedConversation(conversation);
    setChatModalVisible(true);
    setNewMessage("");
    // Optionally, set loadingMessages to true if fetching messages
    // setLoadingMessages(true);
    // Simulate loading delay or fetch additional data if needed
    // setTimeout(() => setLoadingMessages(false), 1000);
  };

  // Function to send a message
  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation) {
      Alert.alert("Error", "Please enter a message.");
      return;
    }

    const messageContent = newMessage.trim();

    const message: Omit<Message, "_id" | "createdAt"> = {
      sender: "user",
      content: messageContent,
    };

    try {
      if (ws.current && ws.current.readyState === WebSocket.OPEN) {
        ws.current.send(
          JSON.stringify({
            type: "send_message",
            chatId: selectedConversation._id,
            message: message,
          })
        );
      } else {
        Alert.alert(
          "Connection Error",
          "Unable to send message. WebSocket is not connected."
        );
        return;
      }

      setNewMessage("");
    } catch (error) {
      console.error("sendMessage error:", error);
      Alert.alert("Error", "Failed to send message.");
    }
  };

  // Function to render each tab
  const renderTab = (tab: TabType, label: string) => (
    <TouchableOpacity
      key={tab}
      style={[styles.tabButton, selectedTab === tab && styles.selectedTab]}
      onPress={() => handleTabChange(tab)}
    >
      <Text
        style={[styles.tabText, selectedTab === tab && styles.selectedTabText]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  // Function to render each conversation item
  const renderConversation = ({ item }: { item: Conversation }) => (
    <TouchableOpacity
      style={styles.conversationItem}
      onPress={() => openChat(item)}
    >
      <View style={styles.conversationHeader}>
        <Text style={styles.participantName}>{item.participant}</Text>
        <Text style={styles.updatedAt}>
          {new Date(item.updatedAt).toLocaleDateString()}
        </Text>
      </View>
      <Text style={styles.lastMessage} numberOfLines={1}>
        {item.lastMessage}
      </Text>
    </TouchableOpacity>
  );

  // Function to render each message in chat
  const renderMessage = ({ item }: { item: Message }) => (
    <View
      style={[
        styles.messageBubble,
        item.sender === "user" ? styles.myMessage : styles.theirMessage,
      ]}
    >
      <Text style={styles.messageText}>{item.content}</Text>
      <Text style={styles.messageTime}>
        {new Date(item.createdAt).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Tabs */}
      <View style={styles.tabContainer}>
        {renderTab("marketplace", "Marketplace")}
        {renderTab("gigs", "Gigs")}
      </View>

      {/* Conversations List */}
      {loading ? (
        <ActivityIndicator
          size="large"
          color="#BB86FC"
          style={{ marginTop: 20 }}
        />
      ) : (
        <FlatList
          data={sortedConversations}
          keyExtractor={(item) => item._id}
          renderItem={renderConversation}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No conversations found.</Text>
            </View>
          }
        />
      )}

      {/* Chat Modal */}
      <Modal
        visible={isChatModalVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setChatModalVisible(false)}
      >
        <SafeAreaView style={styles.modalSafeArea}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.modalContainer}
          >
            {/* Chat Header */}
            <View style={styles.chatHeader}>
              <TouchableOpacity
                onPress={() => setChatModalVisible(false)}
                style={styles.backButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="arrow-back" size={24} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.chatTitle} numberOfLines={1}>
                {selectedConversation?.participant}
              </Text>
              <View style={styles.headerSpacer} />
            </View>

            {/* Messages List */}
            {selectedConversation ? (
              <>
                <FlatList
                  data={selectedConversation.messages.slice().reverse()}
                  keyExtractor={(item) => item._id}
                  renderItem={renderMessage}
                  contentContainerStyle={styles.messagesList}
                  inverted
                  onContentSizeChange={() =>
                    messagesEndRef.current?.scrollToEnd({ animated: true })
                  }
                  ref={messagesEndRef}
                />

                {/* Input Container */}
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.messageInput}
                    placeholder="Type a message..."
                    value={newMessage}
                    onChangeText={setNewMessage}
                    multiline
                    placeholderTextColor="#666"
                  />
                  <TouchableOpacity
                    style={styles.sendButton}
                    onPress={sendMessage}
                  >
                    <Ionicons name="send" size={20} color="#fff" />
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>
                  Select a conversation to start chatting.
                </Text>
              </View>
            )}
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* Bottom Navigation Bar */}
      <BottomNavBar />
    </View>
  );
};

export default MessagingScreen;

// Stylesheet
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
    paddingBottom: 80, // Keep padding at the bottom for BottomNavBar
    paddingTop: 30, // Reduced padding to raise content closer to the top
  },
  modalSafeArea: {
    flex: 1,
    backgroundColor: "#121212",
  },
  tabContainer: {
    flexDirection: "row",
    marginHorizontal: 20,
    marginVertical: 5, // Reduced vertical margin to bring tabs closer to the top
    borderRadius: 25,
    overflow: "hidden",
    backgroundColor: "#1F1F1F",
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: "#1F1F1F",
  },
  selectedTab: {
    backgroundColor: "#BB86FC",
  },
  tabText: {
    color: "#888",
    fontSize: 16,
    fontWeight: "600",
  },
  selectedTabText: {
    color: "#fff",
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingBottom: 80, // Adjust padding to prevent content from hiding behind the navbar
    marginTop: 15, // Adds space between tabs and conversation list
  },
  conversationItem: {
    backgroundColor: "#1F1F1F",
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
  },
  conversationHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 5,
  },
  participantName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#BB86FC",
    flex: 1,
  },
  updatedAt: {
    fontSize: 12,
    color: "#888",
    marginLeft: 10,
  },
  lastMessage: {
    fontSize: 14,
    color: "#ccc",
  },
  emptyContainer: {
    alignItems: "center",
    marginTop: 50,
  },
  emptyText: {
    fontSize: 16,
    color: "#888",
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "#121212",
  },
  chatHeader: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#BB86FC",
    padding: 15,
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight || 0 : 15,
  },
  backButton: {
    padding: 5,
  },
  headerSpacer: {
    width: 24,
  },
  chatTitle: {
    flex: 1,
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
    marginHorizontal: 10,
  },
  messagesList: {
    flexGrow: 1,
    padding: 10,
  },
  messageBubble: {
    maxWidth: "70%",
    padding: 10,
    borderRadius: 15,
    marginVertical: 5,
  },
  myMessage: {
    backgroundColor: "#BB86FC",
    alignSelf: "flex-end",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 2,
  },
  theirMessage: {
    backgroundColor: "#1F1F1F",
    alignSelf: "flex-start",
  },
  messageText: {
    color: "#fff",
    fontSize: 14,
  },
  messageTime: {
    fontSize: 10,
    color: "#888",
    alignSelf: "flex-end",
    marginTop: 5,
  },
  inputContainer: {
    flexDirection: "row",
    padding: 10,
    borderTopWidth: 1,
    borderColor: "#333",
    alignItems: "center",
    backgroundColor: "#1F1F1F",
  },
  messageInput: {
    flex: 1,
    backgroundColor: "#333",
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    fontSize: 16,
    marginRight: 10,
    maxHeight: 100,
    color: "#fff",
  },
  sendButton: {
    backgroundColor: "#BB86FC",
    borderRadius: 20,
    padding: 10,
    justifyContent: "center",
    alignItems: "center",
  },
});
