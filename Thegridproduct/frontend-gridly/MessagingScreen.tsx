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
  ScrollView,
  TouchableOpacity,
  Animated,
  Easing,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import BottomNavBar from "./components/BottomNavbar";
import { fetchConversations, postMessage, getMessages } from "./api";
import { ABLY_API_KEY, CLOUDINARY_URL, UPLOAD_PRESET } from "@env";
import { Conversation, Message } from "./types";
import { UserContext } from "./UserContext";
import Ably from "ably";
import { RouteProp, useNavigation } from "@react-navigation/native";
import { RootStackParamList } from "./navigationTypes";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import axios from "axios";

/** Types & Props */
type Chat = Conversation;

type Request = {
  id: string;
  productId: string;
  buyerId: string;
  sellerId: string;
  createdAt: string;
  // ... other fields if needed
};

type MessagingScreenRouteProp = RouteProp<RootStackParamList, "Messaging">;
type MessagingScreenProps = { route: MessagingScreenRouteProp };

const MessagingScreen: React.FC<MessagingScreenProps> = ({ route }) => {
  /** Chats & Messages */
  const [chats, setChats] = useState<Chat[]>([]);
  const [filteredChats, setFilteredChats] = useState<Chat[]>([]);
  const [filter, setFilter] = useState<"all" | "products" | "gigs">("all");
  const [isChatModalVisible, setChatModalVisible] = useState<boolean>(false);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [newMessage, setNewMessage] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [sending, setSending] = useState<boolean>(false);

  /** Image Upload */
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [isImagePreviewModalVisible, setIsImagePreviewModalVisible] =
    useState<boolean>(false);
  const [isUploadingImage, setIsUploadingImage] = useState<boolean>(false);

  /** Filter Modal */
  const [filterMenuVisible, setFilterMenuVisible] = useState<boolean>(false);

  /** Requests Modal State */
  const [isRequestsModalVisible, setRequestsModalVisible] =
    useState<boolean>(false);
  const [incomingRequests, setIncomingRequests] = useState<Request[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<Request[]>([]); // Placeholder for future logic
  const [loadingRequests, setLoadingRequests] = useState<boolean>(false);
  const [errorRequests, setErrorRequests] = useState<string | null>(null);
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(
    null
  );

  /** Tabs for Requests Modal */
  const [selectedRequestsTab, setSelectedRequestsTab] = useState<
    "incoming" | "outgoing"
  >("incoming");

  /** User & Token from Context */
  const { userId, token } = useContext(UserContext);

  /** Ably & Refs */
  const ablyRef = useRef<Ably.Realtime | null>(null);
  const channelRef = useRef<Ably.RealtimeChannel | null>(null);
  const flatListRef = useRef<FlatList<Message> | null>(null);

  /** Navigation & Route */
  const navigation = useNavigation();
  const { chatId: routeChatId } = route.params || {};

  /** Animation for Requests Modal Slide-Up */
  const slideAnim = useRef(
    new Animated.Value(Dimensions.get("window").height)
  ).current;

  /** Chat Filtering Logic */
  const applyFilter = (
    chatsToFilter: Chat[],
    f: "all" | "products" | "gigs"
  ) => {
    if (f === "all") return chatsToFilter;
    if (f === "products") {
      return chatsToFilter.filter(
        (c) => c.productTitle && c.productTitle.trim() !== ""
      );
    } else {
      // filter === "gigs"
      return chatsToFilter.filter(
        (c) => !c.productTitle || c.productTitle.trim() === ""
      );
    }
  };

  useEffect(() => {
    setFilteredChats(applyFilter(chats, filter));
  }, [chats, filter]);

  /** Fetch Chats if user & token are available */
  useEffect(() => {
    if (userId && token) {
      fetchUserChats();
    }
  }, [userId, token]);

  /** Initialize Ably connection */
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

  /** Subscribe/unsubscribe to the selected channel */
  useEffect(() => {
    if (selectedChat) {
      subscribeToChannel(selectedChat.chatID);
    }
    return () => {
      unsubscribeFromChannel();
    };
  }, [selectedChat]);

  /** If a chatID is provided from route params, open that chat */
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

  /** Fetch a specific chat if not already in the list */
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

  /** Fetch the user's chats */
  const fetchUserChats = async () => {
    if (!userId || !token) return;
    setLoading(true);
    try {
      const fetchedChats = await fetchConversations(userId, token);
      setChats(fetchedChats);

      // If there's a route param for a specific chat, open that
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

  /** Subscribe to an Ably channel */
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
          if (isDuplicate) return prev;

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

  /** Unsubscribe from Ably channel */
  const unsubscribeFromChannel = () => {
    if (channelRef.current) {
      channelRef.current.unsubscribe("message");
      channelRef.current = null;
      console.log("Unsubscribed from Ably channel");
    }
  };

  /** Open a chat and fetch messages */
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

      // Scroll to the latest message
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error("getMessages error:", error);
      // Open the modal anyway (with an empty messages array if there's an error)
      setSelectedChat({
        ...chat,
        messages: [],
      });
      setChatModalVisible(true);
    } finally {
      setLoading(false);
    }
  };

  /** Send a text message */
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

  /** Handle picking an image */
  const handleImagePress = async () => {
    try {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
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
        quality: 0.7,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setSelectedImageUri(asset.uri);
        setIsImagePreviewModalVisible(true);
      }
    } catch (error) {
      console.error("Error picking image:", error);
      Alert.alert("Error", "An error occurred while selecting the image.");
    }
  };

  /** Upload image to Cloudinary */
  const uploadImageToCloudinary = async (uri: string): Promise<string> => {
    setIsUploadingImage(true);
    try {
      // Compress image before upload
      const manipulatedImage = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 800 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
      );

      const formDataImage = new FormData();
      formDataImage.append("file", {
        uri: manipulatedImage.uri,
        type: "image/jpeg",
        name: `upload_${Date.now()}.jpg`,
      } as any);
      formDataImage.append("upload_preset", UPLOAD_PRESET);

      const response = await axios.post(CLOUDINARY_URL, formDataImage, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      const imageUrl = response.data.secure_url;
      return imageUrl;
    } catch (error) {
      console.error("Error uploading image to Cloudinary:", error);
      Alert.alert("Error", "Image upload failed. Please try again.");
      throw error;
    } finally {
      setIsUploadingImage(false);
    }
  };

  /** Confirm and send an image message */
  const confirmAddImage = async () => {
    if (!selectedChat || !selectedImageUri) return;

    setSending(true);
    try {
      const uploadedImageUrl = await uploadImageToCloudinary(selectedImageUri);
      const imageMessage = `[Image] ${uploadedImageUrl}`;

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

  /** Fetch incoming requests */
  const fetchUserRequests = async () => {
    if (!userId || !token) {
      setErrorRequests("User not authenticated.");
      setLoadingRequests(false);
      return;
    }

    setLoadingRequests(true);
    setErrorRequests(null);

    try {
      const response = await axios.get(
        "https://thegridproduct-production.up.railway.app/chat/requests",
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );
      if (response.status === 200) {
        setIncomingRequests(response.data.chatRequests as Request[]);
      } else {
        setErrorRequests("Failed to fetch requests.");
      }
    } catch (error: any) {
      console.error("Error fetching requests:", error);
      setErrorRequests(
        error.response?.data?.message ||
          "An error occurred while fetching requests."
      );
    } finally {
      setLoadingRequests(false);
    }
  };

  /** Accept an incoming request */
  const acceptRequest = async (requestId: string) => {
    setProcessingRequestId(requestId);
    try {
      const response = await axios.post(
        "https://thegridproduct-production.up.railway.app/chat/accept",
        { requestId },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.status === 200) {
        Alert.alert("Success", "Chat request accepted.");
        setIncomingRequests((prev) => prev.filter((req) => req.id !== requestId));
        // Optionally refresh user chats:
        fetchUserChats();
      } else {
        Alert.alert("Error", "Failed to accept chat request.");
      }
    } catch (error: any) {
      console.error("Error accepting request:", error);
      Alert.alert(
        "Error",
        error.response?.data?.message || "Failed to accept chat request."
      );
    } finally {
      setProcessingRequestId(null);
    }
  };

  /** Reject an incoming request */
  const rejectRequest = async (requestId: string) => {
    setProcessingRequestId(requestId);
    try {
      const response = await axios.post(
        "https://thegridproduct-production.up.railway.app/chat/reject",
        { requestId },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.status === 200) {
        Alert.alert("Success", "Chat request rejected.");
        setIncomingRequests((prev) => prev.filter((req) => req.id !== requestId));
      } else {
        Alert.alert("Error", "Failed to reject chat request.");
      }
    } catch (error: any) {
      console.error("Error rejecting request:", error);
      Alert.alert(
        "Error",
        error.response?.data?.message || "Failed to reject chat request."
      );
    } finally {
      setProcessingRequestId(null);
    }
  };

  /** Render a single Chat item in the main list */
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

    const initials = `${item.user.firstName.charAt(0)}${item.user.lastName.charAt(
      0
    )}`.toUpperCase();
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

  /** Render a single message bubble */
  const renderMessage = ({ item }: { item: Message }) => {
    const isImageMessage = item.content.startsWith("[Image] ");
    const imageUri = isImageMessage
      ? item.content.replace("[Image] ", "")
      : null;
    const isUser = item.sender === "user";

    return (
      <View
        style={[
          styles.messageContainer,
          isUser ? styles.myMessageContainer : styles.theirMessageContainer,
        ]}
      >
        <View
          style={[
            styles.messageBubble,
            isUser ? styles.myMessage : styles.theirMessage,
          ]}
        >
          {isImageMessage ? (
            <Image
              source={{ uri: imageUri! }}
              style={styles.messageImage}
              resizeMode="cover"
            />
          ) : (
            <Text
              style={[
                styles.messageText,
                isUser
                  ? styles.myMessageTextColor
                  : styles.theirMessageTextColor,
              ]}
            >
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

  /** Data for "My Purchases" horizontal list */
  const productsOrGigs = chats.map((c) => ({
    chatID: c.chatID,
    title: c.productTitle ? c.productTitle : "Job",
    type: c.productTitle ? "product" : "gig",
  }));

  const handleNavigateFromProductOrGig = (item: {
    chatID: string;
    title: string;
    type: string;
  }) => {
    const chat = chats.find((c) => c.chatID === item.chatID);
    if (chat) {
      openChat(chat);
    }
  };

  /** Header label for the main chat list */
  const currentHeaderTitle =
    filter === "all"
      ? "All Chats"
      : filter === "products"
      ? "Product Chats"
      : "Job Chats";
  const currentFilterLabel =
    filter === "all"
      ? "All ×"
      : filter === "products"
      ? "Products ×"
      : "Jobs ×";

  const handleFilterPillPress = () => {
    if (filter === "all") {
      setFilterMenuVisible(true);
    } else {
      setFilter("all");
    }
  };

  /** Render the entire Requests Modal (with smoother animations) */
  const renderRequestsModal = () => {
    // Animate in
    if (isRequestsModalVisible) {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 250, // shortened for a slightly snappier feel
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }).start();
    } else {
      // Animate out
      Animated.timing(slideAnim, {
        toValue: Dimensions.get("window").height,
        duration: 250,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }).start();
    }

    /** Renders each request item */
    const renderRequestItem = ({ item }: { item: Request }) => {
      // If showing Incoming requests
      if (selectedRequestsTab === "incoming") {
        return (
          <View style={styles.requestCard}>
            <View style={styles.requestInfo}>
              <Text style={styles.requestProductName}>
                Product ID: {item.productId}
              </Text>
              <Text style={styles.requestDate}>
                Requested on: {new Date(item.createdAt).toLocaleDateString()}
              </Text>
            </View>
            <View style={styles.requestActions}>
              <TouchableOpacity
                style={[
                  styles.acceptButton,
                  processingRequestId === item.id && styles.buttonDisabled,
                ]}
                onPress={() => acceptRequest(item.id)}
                disabled={processingRequestId === item.id}
                accessibilityLabel="Accept Request"
              >
                {processingRequestId === item.id ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Ionicons name="checkmark" size={20} color="#fff" />
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.rejectButton,
                  processingRequestId === item.id && styles.buttonDisabled,
                ]}
                onPress={() => rejectRequest(item.id)}
                disabled={processingRequestId === item.id}
                accessibilityLabel="Reject Request"
              >
                {processingRequestId === item.id ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Ionicons name="close" size={20} color="#fff" />
                )}
              </TouchableOpacity>
            </View>
          </View>
        );
      }

      // If showing Outgoing requests
      return (
        <View style={styles.requestCard}>
          <View style={styles.requestInfo}>
            <Text style={styles.requestProductName}>
              Outgoing Request: {item.productId}
            </Text>
            <Text style={styles.requestDate}>
              Created on: {new Date(item.createdAt).toLocaleDateString()}
            </Text>
          </View>
          <View style={styles.requestActions}>
            <Text style={{ color: "#BBBBBB" }}>No actions for outgoing.</Text>
          </View>
        </View>
      );
    };

    const dataToShow =
      selectedRequestsTab === "incoming" ? incomingRequests : outgoingRequests;

    return (
      <Modal
        visible={isRequestsModalVisible}
        animationType="none"
        transparent={true}
        onRequestClose={() => setRequestsModalVisible(false)}
      >
        <Animated.View
          style={[
            styles.requestsModalContainer,
            { transform: [{ translateY: slideAnim }] },
          ]}
        >
          <SafeAreaView style={styles.requestsSafeArea}>
            <View style={styles.requestsHeader}>
              <Pressable
                onPress={() => setRequestsModalVisible(false)}
                style={styles.closeButton}
                accessibilityLabel="Close Requests"
              >
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </Pressable>
              <Text style={styles.requestsHeaderTitle}>Your Requests</Text>
            </View>

            {/* Tabs: Incoming / Outgoing */}
            <View style={styles.requestsTabsRow}>
              <Pressable
                onPress={() => setSelectedRequestsTab("incoming")}
                style={[
                  styles.requestsTab,
                  selectedRequestsTab === "incoming" && styles.activeRequestsTab,
                ]}
                accessibilityLabel="Incoming Requests Tab"
              >
                <Text
                  style={[
                    styles.requestsTabText,
                    selectedRequestsTab === "incoming" &&
                      styles.activeRequestsTabText,
                  ]}
                >
                  Incoming
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setSelectedRequestsTab("outgoing")}
                style={[
                  styles.requestsTab,
                  selectedRequestsTab === "outgoing" && styles.activeRequestsTab,
                ]}
                accessibilityLabel="Outgoing Requests Tab"
              >
                <Text
                  style={[
                    styles.requestsTabText,
                    selectedRequestsTab === "outgoing" &&
                      styles.activeRequestsTabText,
                  ]}
                >
                  Outgoing
                </Text>
              </Pressable>
            </View>

            {loadingRequests ? (
              <ActivityIndicator
                size="large"
                color="#BB86FC"
                style={{ marginTop: 20 }}
              />
            ) : errorRequests ? (
              <View style={styles.requestsErrorContainer}>
                <Text style={styles.requestsErrorText}>{errorRequests}</Text>
              </View>
            ) : (
              <View style={styles.requestsContent}>
                <FlatList
                  data={dataToShow}
                  keyExtractor={(item) => item.id}
                  renderItem={renderRequestItem}
                  ListEmptyComponent={
                    <View style={styles.sectionEmptyContainer}>
                      <Text style={styles.sectionEmptyText}>
                        {selectedRequestsTab === "incoming"
                          ? "No incoming requests."
                          : "No outgoing requests."}
                      </Text>
                    </View>
                  }
                  ItemSeparatorComponent={() => (
                    <View style={styles.requestsSeparatorLine} />
                  )}
                />
              </View>
            )}
          </SafeAreaView>
        </Animated.View>
      </Modal>
    );
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* Header Row with Title and Filter */}
        <View style={styles.headerRow}>
          <Text style={styles.mainHeader}>{currentHeaderTitle}</Text>
          <View style={styles.headerButtons}>
            <Pressable
              style={styles.requestsButton}
              onPress={() => {
                setRequestsModalVisible(true);
                // Default tab to 'incoming' each time we open
                setSelectedRequestsTab("incoming");
                fetchUserRequests();
              }}
              accessibilityLabel="View Requests"
            >
              <Ionicons name="list-circle-outline" size={24} color="#BB86FC" />
              <Text style={styles.requestsButtonText}>Requests</Text>
            </Pressable>
            <Pressable
              style={styles.filterLabelButton}
              onPress={handleFilterPillPress}
              accessibilityLabel="Filter Options"
            >
              <Text style={styles.filterLabelText}>{currentFilterLabel}</Text>
            </Pressable>
          </View>
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

        {/* Requests Modal */}
        {renderRequestsModal()}

        {/* Purchases Section (only visible in 'all' or 'products') */}
        {(filter === "all" || filter === "products") && productsOrGigs.length > 0 && (
          <View style={styles.horizontalListContainer}>
            <Text style={styles.sectionTitle}>Your Purchases</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.horizontalScroll}
            >
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

        {/* Main Chats List */}
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
                          {selectedChat.user.firstName
                            .charAt(0)
                            .toUpperCase()}
                          {selectedChat.user.lastName.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.chatHeaderTextContainer}>
                        <Text style={styles.chatHeaderUserName}>
                          {selectedChat.user.firstName}{" "}
                          {selectedChat.user.lastName}
                        </Text>
                        <Text style={styles.chatHeaderSubTitle}>
                          {selectedChat.productTitle
                            ? selectedChat.productTitle
                            : "Job"}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.chatHeaderBottomLine} />
                  </View>
                )}

                <FlatList
                  ref={flatListRef}
                  data={selectedChat?.messages || []}
                  keyExtractor={(item, index) =>
                    item._id || index.toString()
                  }
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
                <View style={{ flex: 1 }} />
                <Pressable
                  onPress={confirmAddImage}
                  style={styles.addImageButton}
                  accessibilityLabel="Add Image"
                  disabled={sending || isUploadingImage}
                >
                  {sending || isUploadingImage ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Ionicons name="checkmark" size={20} color="#BB86FC" />
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

        {/* Bottom Nav */}
        <BottomNavBar />
      </SafeAreaView>
    </View>
  );
};

export default MessagingScreen;

/** Styles */
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
  headerButtons: {
    flexDirection: "row",
    alignItems: "center",
  },
  requestsButton: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 15,
  },
  requestsButtonText: {
    color: "#BB86FC",
    fontSize: 14,
    fontFamily: "HelveticaNeue-Medium",
    marginLeft: 5,
  },
  filterLabelButton: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: "#1E1E1E",
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
  },
  filterLabelText: {
    color: "#BB86FC",
    fontSize: 14,
    fontFamily: "HelveticaNeue-Medium",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  filterModalContainer: {
    backgroundColor: "#1E1E1E",
    borderRadius: 8,
    padding: 20,
    width: 200,
    alignItems: "stretch",
  },
  filterModalOption: {
    paddingVertical: 10,
    alignItems: "center",
  },
  filterModalOptionText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontFamily: "HelveticaNeue-Medium",
  },
  filterModalClose: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#333333",
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
    paddingVertical: 6,
    borderRadius: 20,
    marginRight: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
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
    width,
    height: undefined,
    aspectRatio: 1,
  },
  addImageButton: {
    marginLeft: "auto",
  },

  // Requests Modal Styles
  requestsModalContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "80%",
    backgroundColor: "#1E1E1E",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 10,
  },
  requestsSafeArea: {
    flex: 1,
  },
  requestsHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  closeButton: {
    padding: 5,
  },
  requestsHeaderTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#BB86FC",
    fontFamily: "HelveticaNeue-Bold",
    marginLeft: 10,
  },
  requestsTabsRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 10,
  },
  requestsTab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    marginHorizontal: 10,
    borderRadius: 20,
    backgroundColor: "#2C2C2C",
  },
  activeRequestsTab: {
    backgroundColor: "#BB86FC",
  },
  requestsTabText: {
    color: "#BBBBBB",
    fontSize: 14,
    fontFamily: "HelveticaNeue-Medium",
  },
  activeRequestsTabText: {
    color: "#000",
  },
  requestsContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  requestsErrorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  requestsErrorText: {
    color: "#FF3B30",
    fontSize: 14,
    textAlign: "center",
    fontFamily: "HelveticaNeue",
  },
  requestCard: {
    backgroundColor: "#2C2C2C",
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 12,
    marginVertical: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  requestInfo: {
    marginBottom: 8,
  },
  requestProductName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#BB86FC",
    fontFamily: "HelveticaNeue-Bold",
    marginBottom: 3,
  },
  requestDate: {
    fontSize: 12,
    color: "#AAAAAA",
    fontFamily: "HelveticaNeue",
  },
  requestActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 5,
  },
  acceptButton: {
    backgroundColor: "#4CAF50",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginRight: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  rejectButton: {
    backgroundColor: "#F44336",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  requestsSeparatorLine: {
    height: 8,
    backgroundColor: "#1E1E1E",
  },
  sectionEmptyContainer: {
    alignItems: "center",
    paddingVertical: 10,
  },
  sectionEmptyText: {
    fontSize: 14,
    color: "#888888",
    fontFamily: "HelveticaNeue",
  },
});
