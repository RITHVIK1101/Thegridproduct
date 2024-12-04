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
import { fetchConversations, postMessage } from "./api";
import { Conversation, Message } from "./types";
import { UserContext } from "./UserContext";

// Define TabType outside the component for better type management
type TabType = "marketplace" | "gigs";

const MessagingScreen: React.FC = () => {
  const [selectedTab, setSelectedTab] = useState<TabType>("marketplace");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isChatModalVisible, setChatModalVisible] = useState<boolean>(false);
  const [selectedConversation, setSelectedConversation] =
    useState<Conversation | null>(null);
  const [newMessage, setNewMessage] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  // Access UserContext
  const { userId, token } = useContext(UserContext);

  // Fetch conversations when the screen loads
  useEffect(() => {
    fetchUserConversations();
  }, [userId, token]);

  const fetchUserConversations = async () => {
    if (!userId || !token) return;

    setLoading(true);
    try {
      const fetchedConversations = await fetchConversations(userId, token);
      setConversations(fetchedConversations);
    } catch (error) {
      console.error("Error fetching conversations:", error);
      Alert.alert("Error", "Failed to load conversations.");
    } finally {
      setLoading(false);
    }
  };

  const openChat = (conversation: Conversation) => {
    setSelectedConversation(conversation);
    setChatModalVisible(true);
    setNewMessage("");
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation) {
      Alert.alert("Error", "Please enter a message.");
      return;
    }

    try {
      await postMessage(
        selectedConversation.chatID,
        newMessage.trim(),
        token || ""
      );
      setNewMessage("");
    } catch (error) {
      console.error("sendMessage error:", error);
      Alert.alert("Error", "Failed to send message.");
    }
  };

  const renderConversation = ({ item }: { item: Conversation }) => (
    <TouchableOpacity
      style={styles.conversationItem}
      onPress={() => openChat(item)}
    >
      <View>
        <Text style={styles.participantName}>
          {item.user.firstName} {item.user.lastName}
        </Text>
        <Text style={styles.productName}>{item.productTitle}</Text>
      </View>
    </TouchableOpacity>
  );

  const renderMessage = ({ item }: { item: Message }) => (
    <View
      style={[
        styles.messageBubble,
        item.sender === "user" ? styles.myMessage : styles.theirMessage,
      ]}
    >
      <Text style={styles.messageText}>{item.content}</Text>
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
        onRequestClose={() => setChatModalVisible(false)}
      >
        <SafeAreaView style={styles.modalSafeArea}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.modalContainer}
          >
            <View style={styles.chatHeader}>
              <TouchableOpacity
                onPress={() => setChatModalVisible(false)}
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
              data={selectedConversation?.messages || []}
              keyExtractor={(item) => item._id}
              renderItem={renderMessage}
              contentContainerStyle={styles.messagesList}
              inverted
            />

            <View style={styles.inputContainer}>
              <TextInput
                style={styles.messageInput}
                placeholder="Type a message..."
                value={newMessage}
                onChangeText={setNewMessage}
                multiline
              />
              <TouchableOpacity style={styles.sendButton} onPress={sendMessage}>
                <Ionicons name="send" size={20} color="#fff" />
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
  participantName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#BB86FC",
  },
  productName: {
    fontSize: 14,
    color: "#ccc",
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
  },
  backButton: {
    marginRight: 10,
  },
  chatTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
  },
  messagesList: {
    padding: 10,
  },
  messageBubble: {
    padding: 10,
    borderRadius: 10,
    marginBottom: 5,
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
  },
  sendButton: {
    backgroundColor: "#BB86FC",
    borderRadius: 20,
    padding: 10,
  },
});
