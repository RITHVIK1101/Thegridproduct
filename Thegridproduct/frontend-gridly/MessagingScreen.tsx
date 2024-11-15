import React, { useState } from "react";
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
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import BottomNavBar from "./components/BottomNavbar";

type TabType = "marketplace" | "gigs";

type Message = {
  _id: string;
  sender: "user" | "other";
  content: string;
  createdAt: string;
};

type Conversation = {
  _id: string;
  participant: string;
  lastMessage: string;
  updatedAt: string;
  messages: Message[];
};

const mockConversations: Record<TabType, Conversation[]> = {
  marketplace: [
    {
      _id: "m1",
      participant: "Alice Johnson",
      lastMessage: "Looking forward to your response.",
      updatedAt: "2024-04-20T10:30:00Z",
      messages: [
        {
          _id: "m1-1",
          sender: "other",
          content: "Hi! I'm interested in your services.",
          createdAt: "2024-04-20T10:30:00Z",
        },
        {
          _id: "m1-2",
          sender: "user",
          content: "Hello Alice! How can I assist you today?",
          createdAt: "2024-04-20T10:32:00Z",
        },
      ],
    },
    {
      _id: "m2",
      participant: "Bob Smith",
      lastMessage: "Can we discuss the project details?",
      updatedAt: "2024-04-19T14:15:00Z",
      messages: [
        {
          _id: "m2-1",
          sender: "other",
          content: "Can we discuss the project details?",
          createdAt: "2024-04-19T14:15:00Z",
        },
        {
          _id: "m2-2",
          sender: "user",
          content: "Sure, Bob! Let's schedule a meeting.",
          createdAt: "2024-04-19T14:20:00Z",
        },
      ],
    },
  ],
  gigs: [
    {
      _id: "g1",
      participant: "Charlie Davis",
      lastMessage: "Thank you!",
      updatedAt: "2024-04-18T09:00:00Z",
      messages: [
        {
          _id: "g1-1",
          sender: "user",
          content: "Hi Charlie, how can I help you with your gig?",
          createdAt: "2024-04-18T09:00:00Z",
        },
        {
          _id: "g1-2",
          sender: "other",
          content: "I need assistance with my project. Thank you!",
          createdAt: "2024-04-18T09:05:00Z",
        },
      ],
    },
    {
      _id: "g2",
      participant: "Diana Evans",
      lastMessage: "Let me know your thoughts.",
      updatedAt: "2024-04-17T16:45:00Z",
      messages: [
        {
          _id: "g2-1",
          sender: "other",
          content: "Let me know your thoughts on the proposal.",
          createdAt: "2024-04-17T16:45:00Z",
        },
        {
          _id: "g2-2",
          sender: "user",
          content: "I'll review it and get back to you shortly.",
          createdAt: "2024-04-17T16:50:00Z",
        },
      ],
    },
  ],
};

const MessagingScreen: React.FC = () => {
  const [selectedTab, setSelectedTab] = useState<TabType>("marketplace");
  const [conversations, setConversations] = useState<Conversation[]>(mockConversations[selectedTab]);
  const [isChatModalVisible, setChatModalVisible] = useState<boolean>(false);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [newMessage, setNewMessage] = useState<string>("");

  const handleTabChange = (tab: TabType) => {
    setSelectedTab(tab);
    setConversations(mockConversations[tab]);
    setSelectedConversation(null);
    setChatModalVisible(false);
    setNewMessage("");
  };

  const openChat = (conversation: Conversation) => {
    setSelectedConversation(conversation);
    setChatModalVisible(true);
    setNewMessage("");
  };

  const sendMessage = () => {
    if (!newMessage.trim() || !selectedConversation) {
      Alert.alert("Error", "Please enter a message.");
      return;
    }

    const message: Message = {
      _id: `${selectedConversation._id}-${selectedConversation.messages.length + 1}`,
      sender: "user",
      content: newMessage.trim(),
      createdAt: new Date().toISOString(),
    };

    const updatedConversations = conversations.map((conv) => {
      if (conv._id === selectedConversation._id) {
        return {
          ...conv,
          lastMessage: message.content,
          updatedAt: message.createdAt,
          messages: [...conv.messages, message],
        };
      }
      return conv;
    });

    setConversations(updatedConversations);
    setSelectedConversation({
      ...selectedConversation,
      lastMessage: message.content,
      updatedAt: message.createdAt,
      messages: [...selectedConversation.messages, message],
    });
    setNewMessage("");
  };

  const renderTab = (tab: TabType, label: string) => (
    <TouchableOpacity
      style={[styles.tabButton, selectedTab === tab && styles.selectedTab]}
      onPress={() => handleTabChange(tab)}
    >
      <Text style={[styles.tabText, selectedTab === tab && styles.selectedTabText]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  const renderConversation = ({ item }: { item: Conversation }) => (
    <TouchableOpacity style={styles.conversationItem} onPress={() => openChat(item)}>
      <View style={styles.conversationHeader}>
        <Text style={styles.participantName}>{item.participant}</Text>
        <Text style={styles.updatedAt}>{new Date(item.updatedAt).toLocaleDateString()}</Text>
      </View>
      <Text style={styles.lastMessage} numberOfLines={1}>
        {item.lastMessage}
      </Text>
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
      <Text style={styles.messageTime}>
        {new Date(item.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.tabContainer}>
        {renderTab("marketplace", "Marketplace")}
        {renderTab("gigs", "Gigs")}
      </View>

      <FlatList
        data={conversations.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())}
        keyExtractor={(item) => item._id}
        renderItem={renderConversation}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No conversations found.</Text>
          </View>
        }
      />

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
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="arrow-back" size={24} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.chatTitle} numberOfLines={1}>
                {selectedConversation?.participant}
              </Text>
              <View style={styles.headerSpacer} />
            </View>

            <FlatList
              data={selectedConversation?.messages.slice().reverse()}
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
                placeholderTextColor="#666"
              />
              <TouchableOpacity style={styles.sendButton} onPress={sendMessage}>
                <Ionicons name="send" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* Copying the exact same navbar formatting from ActivityScreen */}
      <BottomNavBar />
    </View>
  );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#000",
        paddingBottom: 80, // Keep padding at the bottom for BottomNavBar
        paddingTop: 30, // Reduced padding to raise content closer to the top
      },
  modalSafeArea: {
    flex: 1,
    backgroundColor: "#000",
  },
  tabContainer: {
    flexDirection: "row",
    marginHorizontal: 20,
    marginVertical: 5, // Reduced vertical margin to bring tabs closer to the top
    borderRadius: 25,
    overflow: "hidden",
    backgroundColor: "#222",
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: "#222",
  },
  selectedTab: {
    backgroundColor: "#8A2BE2",
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
    backgroundColor: "#222",
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
    color: "#fff",
    flex: 1,
  },
  updatedAt: {
    fontSize: 12,
    color: "#888",
    marginLeft: 10,
  },
  lastMessage: {
    fontSize: 14,
    color: "#888",
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
    backgroundColor: "#000",
  },
  chatHeader: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#8A2BE2",
    padding: 15,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 15,
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
    textAlign: 'center',
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
    backgroundColor: "#8A2BE2",
    alignSelf: "flex-end",
  },
  theirMessage: {
    backgroundColor: "#222",
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
    borderColor: "#222",
    alignItems: "center",
    backgroundColor: "#000",
  },
  messageInput: {
    flex: 1,
    backgroundColor: "#222",
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    fontSize: 16,
    marginRight: 10,
    maxHeight: 100,
    color: "#fff",
  },
  sendButton: {
    backgroundColor: "#8A2BE2",
    borderRadius: 20,
    padding: 10,
    justifyContent: "center",
    alignItems: "center",
  },
});

export default MessagingScreen;
