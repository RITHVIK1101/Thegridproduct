import React, { useState, useEffect, useContext, useRef } from "react";
import {
  SafeAreaView,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Modal,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  View,
  Dimensions,
  Image,
  ScrollView
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import BottomNavBar from "./components/BottomNavbar";
import { fetchConversations, postMessage, getMessages } from "./api";
import { ABLY_API_KEY } from "@env";
import { Conversation, Message } from "./types";
import { UserContext } from "./UserContext";
import Ably from "ably";
import { RouteProp, useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "./navigationTypes";
import { RootStackParamList } from "./navigationTypes";
import * as ImagePicker from "expo-image-picker";

type Chat = Conversation;

type MessagingScreenRouteProp = RouteProp<RootStackParamList, "Messaging">;
type MessagingScreenProps = { route: MessagingScreenRouteProp };
type NavigationProp = StackNavigationProp<RootStackParamList, "Messaging">;

const MessagingScreen: React.FC<MessagingScreenProps> = ({ route }) => {
  const [chats, setChats] = useState<Chat[]>([]);
  const [filteredChats, setFilteredChats] = useState<Chat[]>([]);
  const [filter, setFilter] = useState<"all" | "products" | "gigs">("all");
  const [isChatModalVisible, setChatModalVisible] = useState<boolean>(false);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [newMessage, setNewMessage] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [sending, setSending] = useState<boolean>(false);

  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [isImagePreviewModalVisible, setIsImagePreviewModalVisible] = useState<boolean>(false);

  const [filterMenuVisible, setFilterMenuVisible] = useState<boolean>(false);

  const { userId, token } = useContext(UserContext);
  const ablyRef = useRef<Ably.Realtime | null>(null);
  const channelRef = useRef<Ably.RealtimeChannel | null>(null);
  const flatListRef = useRef<FlatList<Message> | null>(null);

  const navigation = useNavigation<NavigationProp>();
  const { chatId: routeChatId } = route.params || {};

  const applyFilter = (chatsToFilter: Chat[], f: "all"|"products"|"gigs") => {
    if (f === "all") return chatsToFilter;
    if (f === "products") {
      return chatsToFilter.filter(c => c.productTitle && c.productTitle.trim() !== "");
    } else {
      return chatsToFilter.filter(c => !c.productTitle || c.productTitle.trim() === "");
    }
  };

  useEffect(() => {
    setFilteredChats(applyFilter(chats, filter));
  }, [chats, filter]);

  useEffect(() => {
    if (userId && token) {
      fetchUserChats();
    }
  }, [userId, token]);

  useEffect(() => {
    if (!ablyRef.current) {
      ablyRef.current = new Ably.Realtime({ key: ABLY_API_KEY });

      ablyRef.current.connection.on("connected", () => {
        console.log("Ably connected");
      });

      ablyRef.current.connection.on("failed", (stateChange) => {
        console.error("Ably connection failed:", stateChange.reason);
        Alert.alert(
          "Connection Error",
          "Failed to connect to the real-time messaging service."
        );
      });
    }

    return () => {
      if (ablyRef.current) {
        ablyRef.current.close();
        ablyRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (selectedChat) {
      subscribeToChannel(selectedChat.chatID);
    }
    return () => {
      unsubscribeFromChannel();
    };
  }, [selectedChat]);

  useEffect(() => {
    if (routeChatId && userId && token) {
      const chat = chats.find((c) => c.chatID === routeChatId);
      if (chat) {
        openChat(chat);
      } else {
        fetchSpecificChat(routeChatId);
      }
    }
  }, [routeChatId, chats]);

  const fetchSpecificChat = async (chatId: string) => {
    setLoading(true);
    try {
      const specificChat = await fetchConversations(userId, token, chatId);
      if (specificChat.length > 0) {
        setChats((prev) => [...prev, ...specificChat]);
        openChat(specificChat[0]);
      } else {
        Alert.alert("Error", "Chat not found.");
      }
    } catch (error) {
      console.error("Error fetching specific chat:", error);
      Alert.alert("Error", "Failed to load the chat.");
    } finally {
      setLoading(false);
    }
  };

  const fetchUserChats = async () => {
    if (!userId || !token) return;
    setLoading(true);
    try {
      const fetchedChats = await fetchConversations(userId, token);
      setChats(fetchedChats);
      if (routeChatId) {
        const chat = fetchedChats.find((c) => c.chatID === routeChatId);
        if (chat) {
          openChat(chat);
        }
      }
    } catch (error) {
      console.error("Error fetching chats:", error);
      Alert.alert("Error", "Failed to load chats.");
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

        setSelectedChat((prev) => {
          if (!prev) return prev;

          const isDuplicate = prev.messages?.some(
            (m) =>
              m.content === newMsg.content &&
              m.timestamp === newMsg.timestamp &&
              m.senderID === newMsg.senderID
          );

          if (isDuplicate) {
            return prev;
          }

          return {
            ...prev,
            messages: [...prev.messages, newMsg],
          };
        });
      } catch (err) {
        console.error("Error parsing Ably message data:", err);
      }
    });

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
          "Channel Error",
          `An error occurred with the channel: ${
            stateChange.reason?.message || "Unknown reason"
          }`
        );
      } else {
        console.log(`Channel state changed to: ${stateChange.current}`);
      }
    });

    channel.on("failed", () => {
      Alert.alert(
        "Messaging Service Error",
        "An error occurred with the real-time messaging service."
      );
    });
  };

  const unsubscribeFromChannel = () => {
    if (channelRef.current) {
      channelRef.current.unsubscribe("message");
      channelRef.current = null;
      console.log("Unsubscribed from Ably channel");
    }
  };

  const openChat = async (chat: Chat) => {
    setLoading(true);
    try {
      const messages = await getMessages(chat.chatID, token || "");
      const sortedMessages: Message[] = Array.isArray(messages)
        ? messages
            .map((msg, index) => ({
              _id: msg._id ? msg._id.toString() : Date.now().toString() + index,
              sender: msg.senderID === userId ? "user" : "other",
              senderID: msg.senderID,
              content: msg.content,
              timestamp: new Date(msg.timestamp).toISOString(),
            }))
            .sort(
              (a, b) =>
                new Date(a.timestamp).getTime() -
                new Date(b.timestamp).getTime()
            )
        : [];

      setSelectedChat({
        ...chat,
        messages: sortedMessages,
      });

      setChatModalVisible(true);
      setNewMessage("");

      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error("getMessages error:", error);
      setSelectedChat({
        ...chat,
        messages: [],
      });
      setChatModalVisible(true);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedChat) {
      Alert.alert("Error", "Please enter a message.");
      return;
    }

    setSending(true);
    const messageContent = newMessage.trim();
    setNewMessage("");

    try {
      await postMessage(selectedChat.chatID, messageContent, token, userId);
      console.log("Message sent successfully.");
    } catch (error: any) {
      console.error("sendMessage error:", error);
      Alert.alert("Error", error.message || "Failed to send message.");
    } finally {
      setSending(false);
    }
  };

  const handleImagePress = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission Required",
          "Permission to access the camera roll is required!"
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: false,
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setSelectedImageUri(asset.uri);
        setIsImagePreviewModalVisible(true);
      } else {
        console.log("User cancelled image picker");
      }
    } catch (error) {
      console.error("Error picking image:", error);
      Alert.alert("Error", "An error occurred while selecting the image.");
    }
  };

  const confirmAddImage = async () => {
    if (!selectedChat || !selectedImageUri) return;

    setSending(true);
    try {
      const imageMessage = `[Image] ${selectedImageUri}`;
      await postMessage(selectedChat.chatID, imageMessage, token, userId);
      console.log("Image message sent successfully.");
    } catch (error: any) {
      console.error("sendImageMessage error:", error);
      Alert.alert("Error", error.message || "Failed to send image.");
    } finally {
      setSelectedImageUri(null);
      setIsImagePreviewModalVisible(false);
      setSending(false);
    }
  };

  const renderChat = ({ item }: { item: Chat }) => {
    if (!item.user) {
      console.warn(`Chat with chatID ${item.chatID} is missing user data.`);
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
      ? new Date(latestMessage.timestamp).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "";

    const initials = `${item.user.firstName.charAt(0)}${item.user.lastName.charAt(0)}`.toUpperCase();
    const unread = item.unreadCount && item.unreadCount > 0;

    return (
      <Pressable
        style={styles.chatItemContainer}
        onPress={() => openChat(item)}
        accessibilityLabel={`Open chat with ${item.user.firstName} ${item.user.lastName}`}
      >
        <View style={styles.chatItem}>
          <View style={styles.profilePicWrapper}>
            <View style={styles.profilePicPlaceholder}>
              <Text style={styles.profilePicInitials}>{initials}</Text>
            </View>
          </View>

          <View style={styles.chatDetails}>
            <View style={styles.chatHeaderRow}>
              <Text style={styles.chatName} numberOfLines={1}>
                {item.user.firstName} {item.user.lastName}
              </Text>
              <Text style={styles.chatTime}>{formattedTimestamp}</Text>
            </View>
            <Text style={styles.chatProductName} numberOfLines={1}>
              {item.productTitle ? item.productTitle : "Job"}
            </Text>
            {latestMessage && (
              <View style={styles.lastMessageRow}>
                {unread && <View style={styles.unreadDot} />}
                <Text style={styles.lastMessage} numberOfLines={1}>
                  {latestMessage.content}
                </Text>
              </View>
            )}
          </View>
        </View>
      </Pressable>
    );
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isImageMessage = item.content.startsWith("[Image] ");
    const imageUri = isImageMessage ? item.content.replace("[Image] ", "") : null;
    const isUser = item.sender === "user";

    return (
      <View
        style={[
          styles.messageContainer,
          isUser ? styles.myMessageContainer : styles.theirMessageContainer,
        ]}
      >
        <View style={[styles.messageBubble, isUser ? styles.myMessage : styles.theirMessage]}>
          {isImageMessage ? (
            <Image
              source={{ uri: imageUri! }}
              style={styles.messageImage}
              resizeMode="cover"
            />
          ) : (
            <Text style={[styles.messageText, isUser ? styles.myMessageTextColor : styles.theirMessageTextColor]}>
              {item.content}
            </Text>
          )}
          <Text
            style={[
              styles.messageTimestamp,
              isUser ? styles.myTimestampColor : styles.theirTimestampColor,
            ]}
          >
            {new Date(item.timestamp).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
        </View>
      </View>
    );
  };

  const productsOrGigs = chats.map((c) => ({
    chatID: c.chatID,
    title: c.productTitle ? c.productTitle : "Job",
    type: c.productTitle ? "product" : "gig",
  }));

  const handleNavigateFromProductOrGig = (item: { chatID: string; title: string; type: string; }) => {
    const chat = chats.find((c) => c.chatID === item.chatID);
    if (chat) {
      openChat(chat);
    }
  };

  const currentHeaderTitle = filter === "all" ? "All Chats" : filter === "products" ? "Product Chats" : "Job Chats";
  const currentFilterLabel = filter === "all" ? "All ×" : filter === "products" ? "Products ×" : "Jobs ×";

  const handleFilterPillPress = () => {
    if (filter === "all") {
      setFilterMenuVisible(true);
    } else {
      setFilter("all");
    }
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* Header Row with Title and Filter */}
        <View style={styles.headerRow}>
          <Text style={styles.mainHeader}>{currentHeaderTitle}</Text>
          <Pressable
            style={styles.filterLabelButton}
            onPress={handleFilterPillPress}
            accessibilityLabel="Filter Options"
          >
            <Text style={styles.filterLabelText}>{currentFilterLabel}</Text>
          </Pressable>
        </View>

        {/* Filter Modal */}
        <Modal
          visible={filterMenuVisible}
          animationType="fade"
          transparent={true}
          onRequestClose={() => setFilterMenuVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.filterModalContainer}>
              <Pressable
                style={styles.filterModalOption}
                onPress={() => {
                  setFilter("products");
                  setFilterMenuVisible(false);
                }}
              >
                <Text style={styles.filterModalOptionText}>Products</Text>
              </Pressable>
              <Pressable
                style={styles.filterModalOption}
                onPress={() => {
                  setFilter("gigs");
                  setFilterMenuVisible(false);
                }}
              >
                <Text style={styles.filterModalOptionText}>Jobs</Text>
              </Pressable>
              <Pressable
                style={[styles.filterModalOption, styles.filterModalClose]}
                onPress={() => setFilterMenuVisible(false)}
              >
                <Text style={styles.filterModalOptionText}>Close</Text>
              </Pressable>
            </View>
          </View>
        </Modal>

        {/* Purchases Section (only in all or products) */}
        {(filter === "all" || filter === "products") && productsOrGigs.length > 0 && (
          <View style={styles.horizontalListContainer}>
            <Text style={styles.sectionTitle}>Your Purchases</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
              {productsOrGigs.map((item, index) => (
                <Pressable
                  key={item.chatID + index}
                  style={styles.productGigItem}
                  onPress={() => handleNavigateFromProductOrGig(item)}
                >
                  <Text style={styles.productGigItemText}>{item.title}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        <View style={styles.separatorAfterPurchases} />

        {loading ? (
          <ActivityIndicator size="large" color="#BB86FC" />
        ) : (
          <FlatList
            data={filteredChats}
            keyExtractor={(item, index) => item.chatID || index.toString()}
            renderItem={renderChat}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No chats found.</Text>
              </View>
            }
            contentContainerStyle={
              filteredChats.length === 0 && styles.flatListContainer
            }
            ItemSeparatorComponent={() => <View style={styles.separatorLine} />}
          />
        )}

        {/* Chat Modal */}
        <Modal
          visible={isChatModalVisible}
          animationType="slide"
          transparent={false}
          onRequestClose={() => {
            setChatModalVisible(false);
            setSelectedChat(null);
            unsubscribeFromChannel();
          }}
        >
          <View style={[styles.modalSafeArea, { backgroundColor: "#000" }]}>
            <SafeAreaView style={{ flex: 1 }}>
              <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : undefined}
                style={styles.modalContainer}
              >
                {selectedChat && (
                  <View style={styles.enhancedChatHeader}>
                    <Pressable
                      onPress={() => {
                        setChatModalVisible(false);
                        setSelectedChat(null);
                        unsubscribeFromChannel();
                      }}
                      style={styles.backButton}
                      accessibilityLabel="Go Back"
                    >
                      <Ionicons name="arrow-back" size={24} color="#BB86FC" />
                    </Pressable>
                    <View style={styles.chatHeaderInfo}>
                      <View style={styles.headerProfilePicPlaceholder}>
                        <Text style={styles.headerProfilePicInitials}>
                          {selectedChat.user.firstName.charAt(0).toUpperCase()}
                          {selectedChat.user.lastName.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.chatHeaderTextContainer}>
                        <Text style={styles.chatHeaderUserName}>
                          {selectedChat.user.firstName} {selectedChat.user.lastName}
                        </Text>
                        <Text style={styles.chatHeaderSubTitle}>
                          {selectedChat.productTitle ? selectedChat.productTitle : "Job"}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.chatHeaderBottomLine}/>
                  </View>
                )}

                <FlatList
                  ref={flatListRef}
                  data={selectedChat?.messages || []}
                  keyExtractor={(item, index) => item._id || index.toString()}
                  renderItem={renderMessage}
                  contentContainerStyle={styles.messagesList}
                  onContentSizeChange={() =>
                    flatListRef.current?.scrollToEnd({ animated: true })
                  }
                  onLayout={() =>
                    flatListRef.current?.scrollToEnd({ animated: true })
                  }
                  ListEmptyComponent={
                    <View style={styles.emptyMessagesContainer}>
                      <Text style={styles.emptyMessagesText}>
                        Start the conversation by sending a message!
                      </Text>
                    </View>
                  }
                />

                {/* Input Bar */}
                <View style={styles.inputBarContainer}>
                  <View style={styles.inputBarLine} />
                  <View style={styles.inputContainer}>
                    <Pressable
                      style={styles.iconButton}
                      onPress={handleImagePress}
                      accessibilityLabel="Upload Image"
                    >
                      <Ionicons name="image" size={20} color="#fff" />
                    </Pressable>

                    <Pressable
                      style={styles.iconButton}
                      onPress={() => {
                        Alert.alert("Voice Recording", "Voice recording functionality here.");
                      }}
                      accessibilityLabel="Record Voice"
                    >
                      <Ionicons name="mic" size={20} color="#fff" />
                    </Pressable>

                    <TextInput
                      style={styles.messageInput}
                      placeholder="Type a message..."
                      placeholderTextColor="#555"
                      value={newMessage}
                      onChangeText={setNewMessage}
                      multiline
                      accessibilityLabel="Message Input"
                    />

                    <Pressable
                      style={styles.sendButton}
                      onPress={sendMessage}
                      disabled={sending}
                      accessibilityLabel="Send Message"
                    >
                      {sending ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Ionicons name="send" size={18} color="#fff" />
                      )}
                    </Pressable>
                  </View>
                  <View style={styles.inputBarLine} />
                </View>
              </KeyboardAvoidingView>
            </SafeAreaView>
          </View>
        </Modal>

        {/* Image Preview Modal */}
        <Modal
          visible={isImagePreviewModalVisible}
          animationType="slide"
          transparent={false}
          onRequestClose={() => {
            setIsImagePreviewModalVisible(false);
            setSelectedImageUri(null);
          }}
        >
          <View style={[styles.modalSafeArea, { backgroundColor: "#000" }]}>
            <SafeAreaView style={{ flex: 1 }}>
              <View style={styles.enhancedChatHeader}>
                <Pressable
                  onPress={() => {
                    setIsImagePreviewModalVisible(false);
                    setSelectedImageUri(null);
                  }}
                  style={styles.backButton}
                  accessibilityLabel="Go Back"
                >
                  <Ionicons name="arrow-back" size={24} color="#BB86FC" />
                </Pressable>
                <View style={{flex:1}} />
                <Pressable
                  onPress={confirmAddImage}
                  style={styles.addImageButton}
                  accessibilityLabel="Add Image"
                  disabled={sending}
                >
                  {sending ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Ionicons name="checkmark" size={24} color="#BB86FC" />
                  )}
                </Pressable>
              </View>

              {selectedImageUri && (
                <View style={styles.imagePreviewContainer}>
                  <Image
                    source={{ uri: selectedImageUri }}
                    style={styles.previewImage}
                    resizeMode="contain"
                  />
                </View>
              )}
            </SafeAreaView>
          </View>
        </Modal>

        <BottomNavBar />
      </SafeAreaView>
    </View>
  );
};

export default MessagingScreen;

const { width } = Dimensions.get("window");

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 5,
    justifyContent: "space-between",
  },
  mainHeader: {
    fontSize: 20,
    fontWeight: "700",
    color: "#BB86FC",
    fontFamily: "HelveticaNeue-Bold",
  },
  filterLabelButton: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: "#1E1E1E",
    borderRadius: 20,
  },
  filterLabelText: {
    color: "#BB86FC",
    fontSize: 14,
    fontFamily: "HelveticaNeue-Medium",
  },
  modalOverlay: {
    flex:1,
    backgroundColor:'rgba(0,0,0,0.7)',
    justifyContent:'center',
    alignItems:'center'
  },
  filterModalContainer: {
    backgroundColor:"#1E1E1E",
    borderRadius:8,
    padding:20,
    width:200,
    alignItems:"stretch"
  },
  filterModalOption:{
    paddingVertical:10,
    alignItems:"center"
  },
  filterModalOptionText:{
    color:"#FFFFFF",
    fontSize:16,
    fontFamily:"HelveticaNeue-Medium"
  },
  filterModalClose:{
    marginTop:10,
    borderTopWidth:1,
    borderTopColor:"#333333"
  },
  horizontalListContainer: {
    marginTop: 10,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    color: "#BB86FC",
    fontSize: 16,
    fontFamily: "HelveticaNeue-Bold",
    marginBottom: 5,
  },
  horizontalScroll: {
    flexDirection: "row",
  },
  productGigItem: {
    backgroundColor: "#1E1E1E",
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 10,
  },
  productGigItemText: {
    color: "#FFFFFF",
    fontFamily: "HelveticaNeue",
  },
  separatorAfterPurchases: {
    height: 1,
    backgroundColor: "#222",
    marginTop: 10,
    marginBottom: 10,
  },
  flatListContainer: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  chatItemContainer: {
    backgroundColor: "transparent",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  chatItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  profilePicWrapper: {
    marginRight: 12,
  },
  profilePicPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#BB86FC",
    justifyContent: "center",
    alignItems: "center",
  },
  profilePicInitials: {
    color: "#000",
    fontSize: 18,
    fontWeight: "700",
    fontFamily: "HelveticaNeue-Bold",
  },
  chatDetails: {
    flex: 1,
    flexDirection: "column",
  },
  chatHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  chatName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
    fontFamily: "HelveticaNeue-Medium",
    flex: 1,
    marginRight: 10,
  },
  chatTime: {
    fontSize: 12,
    color: "#AAAAAA",
    fontFamily: "HelveticaNeue",
  },
  chatProductName: {
    fontSize: 13,
    color: "#BBBBBB",
    fontFamily: "HelveticaNeue",
    marginTop: 2,
    marginBottom: 3,
  },
  lastMessageRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#BB86FC",
    marginRight: 5,
  },
  lastMessage: {
    fontSize: 14,
    color: "#CCCCCC",
    fontFamily: "HelveticaNeue",
    flexShrink: 1,
  },
  separatorLine: {
    height: 0.5,
    backgroundColor: "#333333",
    marginLeft: 82,
  },
  emptyContainer: {
    marginTop: 50,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 18,
    color: "#888888",
    fontFamily: "HelveticaNeue",
  },
  modalSafeArea: {
    flex: 1,
  },
  modalContainer: {
    flex: 1,
  },
  enhancedChatHeader: {
    backgroundColor: "#1F1F1F",
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#333333",
    flexDirection: "row",
    alignItems: "center",
  },
  backButton: {
    marginRight: 10,
  },
  chatHeaderInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  headerProfilePicPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#BB86FC",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  headerProfilePicInitials: {
    fontSize: 16,
    fontWeight: "700",
    color: "#000",
    fontFamily: "HelveticaNeue-Bold",
  },
  chatHeaderTextContainer: {
    flexDirection: "column",
    flexShrink: 1,
  },
  chatHeaderUserName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
    fontFamily: "HelveticaNeue-Bold",
  },
  chatHeaderSubTitle: {
    fontSize: 13,
    color: "#BBBBBB",
    fontFamily: "HelveticaNeue",
    marginTop: 2,
  },
  chatHeaderBottomLine: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "#333333",
  },
  messagesList: {
    flexGrow: 1,
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  messageContainer: {
    marginBottom: 10,
    flexDirection: "row",
    maxWidth: "80%",
  },
  myMessageContainer: {
    alignSelf: "flex-end",
  },
  theirMessageContainer: {
    alignSelf: "flex-start",
  },
  messageBubble: {
    borderRadius: 14,
    padding: 8,
    maxWidth: "100%",
    flexDirection: "row",
    alignItems: "flex-end",
    flexWrap: "wrap",
    position: "relative",
  },
  myMessage: {
    backgroundColor: "#BB86FC",
    borderTopRightRadius: 0,
  },
  theirMessage: {
    backgroundColor: "#222",
    borderTopLeftRadius: 0,
  },
  myMessageTextColor: {
    color: "#000000",
  },
  theirMessageTextColor: {
    color: "#FFFFFF",
  },
  messageText: {
    fontSize: 16,
    fontFamily: "HelveticaNeue",
    flexShrink: 1,
  },
  messageTimestamp: {
    fontSize: 11,
    fontFamily: "HelveticaNeue",
    marginLeft: 5,
  },
  myTimestampColor: {
    color: "#333333",
  },
  theirTimestampColor: {
    color: "#999999",
  },
  messageImage: {
    width: 200,
    height: 200,
    borderRadius: 10,
    marginRight: 5,
  },
  inputBarContainer: {
    backgroundColor: "#000",
  },
  inputBarLine: {
    height: 1,
    backgroundColor: "#333333",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1E1E1E",
    paddingVertical: 8,
    paddingHorizontal: 5,
  },
  messageInput: {
    flex: 1,
    color: "#FFFFFF",
    paddingHorizontal: 10,
    fontSize: 16,
    fontFamily: "HelveticaNeue",
    maxHeight: 100,
  },
  iconButton: {
    marginHorizontal: 5,
  },
  sendButton: {
    backgroundColor: "#BB86FC",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 5,
  },
  emptyMessagesContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 20,
  },
  emptyMessagesText: {
    fontSize: 16,
    color: "#888888",
    textAlign: "center",
    fontFamily: "HelveticaNeue",
  },
  imagePreviewContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
  },
  previewImage: {
    width: width,
    height: undefined,
    aspectRatio: 1,
  },
  addImageButton: {
    marginLeft: "auto",
  },
});
