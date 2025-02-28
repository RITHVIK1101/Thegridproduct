// MessagingScreen.tsx
import React, {
  useState,
  useEffect,
  useContext,
  useRef,
  useCallback,
} from "react";
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
  Keyboard,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Ionicons from "react-native-vector-icons/Ionicons";
import BottomNavBar from "./components/BottomNavbar";
import { fetchConversations, getMessages, postMessage } from "./api";
import {
  getFirestore,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  arrayUnion,
  collection,
  query,
  where,
  documentId,
} from "firebase/firestore";
import { NGROK_URL } from "@env";
import { Conversation, Message } from "./types";
import { UserContext } from "./UserContext";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import axios from "axios";
import {
  RouteProp,
  useNavigation,
  useFocusEffect,
} from "@react-navigation/native";
import { RootStackParamList } from "./navigationTypes";
import MessageReplyHandler from "./MessageReplyHandler";
import AnimatedBackButton from "./AnimatedBackButton";
import GestureRecognizer from "react-native-swipe-gestures"; // Import swipe gesture

type Chat = Conversation & { latestSenderId?: string; sold?: boolean };
type Request = {
  requestId: string;
  productId: string;
  productTitle: string;
  buyerId: string;
  sellerId: string;
  status: string;
  createdAt: string;
  buyerFirstName: string;
  buyerLastName: string;
  sellerFirstName: string;
  sellerLastName: string;
  referenceType?: string;
  referenceTitle?: string;
};
type MessagingScreenRouteProp = RouteProp<RootStackParamList, "Messaging">;
type MessagingScreenProps = { route: MessagingScreenRouteProp };

const MessagingScreen: React.FC<MessagingScreenProps> = ({ route }) => {
  const [chats, setChats] = useState<Chat[]>([]);
  const [filteredChats, setFilteredChats] = useState<Chat[]>([]);
  const [filter, setFilter] = useState<
    "all" | "products" | "gigs" | "product_request"
  >("all");
  const [isChatModalVisible, setChatModalVisible] = useState<boolean>(false);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [newMessage, setNewMessage] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [sending, setSending] = useState<boolean>(false);
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [isImagePreviewModalVisible, setIsImagePreviewModalVisible] =
    useState<boolean>(false);
  const [isUploadingImage, setIsUploadingImage] = useState<boolean>(false);
  const [filterMenuVisible, setFilterMenuVisible] = useState<boolean>(false);
  const [isRequestsModalVisible, setRequestsModalVisible] =
    useState<boolean>(false);
  const [incomingRequests, setIncomingRequests] = useState<Request[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<Request[]>([]);
  const [loadingRequests, setLoadingRequests] = useState<boolean>(false);
  const [errorRequests, setErrorRequests] = useState<string | null>(null);
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(
    null
  );
  const [reportModalVisible, setReportModalVisible] = useState<boolean>(false);
  const [reportReason, setReportReason] = useState<string>("Select a Reason");
  const [customReason, setCustomReason] = useState<string>("");
  const [reportDescription, setReportDescription] = useState<string>("");
  const [isReasonDropdownVisible, setIsReasonDropdownVisible] =
    useState<boolean>(false);
  const [isIncompletePopupVisible, setIsIncompletePopupVisible] =
    useState<boolean>(false);
  const [isSubmittingReport, setIsSubmittingReport] = useState<boolean>(false);
  const [isReportSuccessModalVisible, setIsReportSuccessModalVisible] =
    useState<boolean>(false);
  const [selectedRequestsTab, setSelectedRequestsTab] = useState<
    "incoming" | "outgoing"
  >("incoming");
  const [requestPopupVisible, setRequestPopupVisible] =
    useState<boolean>(false);
  const [requestPopupMessage, setRequestPopupMessage] = useState<string>("");
  const [hasNewIncomingRequests, setHasNewIncomingRequests] =
    useState<boolean>(false);
  const [unreadCounts, setUnreadCounts] = useState<{ [key: string]: number }>(
    {}
  );
  const [replyToMessage, setReplyToMessage] = useState<{
    content: string;
    senderName: string;
  } | null>(null);

  const { userId, token } = useContext(UserContext);
  const firestoreDB = getFirestore();
  const flatListRef = useRef<FlatList<Message> | null>(null);
  const navigation = useNavigation();
  const { chatId: routeChatId } = route.params || {};
  const slideAnim = useRef(
    new Animated.Value(Dimensions.get("window").height)
  ).current;
  const reasons = [
    "Inappropriate Behavior",
    "Fraudulent Activity",
    "Harassment",
    "Scamming",
    "Other",
  ];
  const CLOUDINARY_URL =
    "https://api.cloudinary.com/v1_1/ds0zpfht9/image/upload";
  const UPLOAD_PRESET = "gridly_preset";

  const applyFilter = (
    chatsToFilter: Chat[],
    f: "all" | "products" | "gigs" | "product_request"
  ) => {
    if (f === "all") return chatsToFilter;
    if (f === "products")
      return chatsToFilter.filter((c) => c.referenceType === "product");
    if (f === "gigs")
      return chatsToFilter.filter((c) => c.referenceType === "gig");
    return chatsToFilter.filter((c) => c.referenceType === f);
  };

  useEffect(() => {
    const filtered = applyFilter(chats, filter);
    const sorted = [...filtered].sort((a, b) => {
      const aTime = a.latestTimestamp
        ? new Date(a.latestTimestamp).getTime()
        : 0;
      const bTime = b.latestTimestamp
        ? new Date(b.latestTimestamp).getTime()
        : 0;
      return bTime - aTime;
    });
    setFilteredChats(sorted);
  }, [chats, filter]);

  useEffect(() => {
    const loadCachedChats = async () => {
      try {
        const cached = await AsyncStorage.getItem("cachedChats");
        if (cached) {
          setChats(JSON.parse(cached));
        }
      } catch (error) {
        console.error("Error loading cached chats:", error);
      }
    };
    loadCachedChats();
    if (userId && token) {
      fetchUserChats();
    }
  }, [userId, token]);

  useFocusEffect(
    useCallback(() => {
      if (userId && token) {
        fetchUserChats();
      }
    }, [userId, token])
  );

  useEffect(() => {
    const intervalId = setInterval(() => {
      if (userId && token) {
        fetchUserRequests();
      }
    }, 20000);
    return () => clearInterval(intervalId);
  }, [userId, token]);

  const fetchUnreadCount = async (chatID: string): Promise<number> => {
    try {
      const response = await axios.get(
        `https://thegridproduct-production.up.railway.app/chats/${chatID}/${userId}/unread`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return response.data.unreadCount;
    } catch (error) {
      console.error(`Error fetching unread count for chat ${chatID}:`, error);
      return 0;
    }
  };

  useEffect(() => {
    const fetchAllUnreadCounts = async () => {
      const counts: { [key: string]: number } = {};
      await Promise.all(
        chats.map(async (chat) => {
          const count = await fetchUnreadCount(chat.chatID);
          counts[chat.chatID] = count;
        })
      );
      setUnreadCounts(counts);
    };
    if (chats.length > 0 && userId && token) {
      fetchAllUnreadCounts();
    }
  }, [chats, userId, token]);

  const fetchUserChats = async () => {
    if (!userId || !token) return;
    setLoading(true);
    try {
      const fetchedChats = await fetchConversations(userId, token);
      const mergedChats = await Promise.all(
        fetchedChats.map(async (chat: any) => {
          try {
            const saved = await AsyncStorage.getItem(
              `chat_last_message_${chat.chatID}`
            );
            const parsed = saved ? JSON.parse(saved) : {};
            return {
              ...chat,
              ...parsed,
              latestMessage: parsed.latestMessage || chat.latestMessage || "",
              referenceTitle: chat.referenceTitle || "Unnamed Item",
              sold: chat.sold || false,
            };
          } catch (e) {
            console.error("Error retrieving saved last message:", e);
            return { ...chat, sold: chat.sold || false };
          }
        })
      );
      setChats(mergedChats);
      await AsyncStorage.setItem("cachedChats", JSON.stringify(mergedChats));
      if (route?.params?.chatId) {
        const chat = mergedChats.find(
          (c: Chat) => c.chatID === route.params.chatId
        );
        if (chat) openChat(chat);
      }
    } catch (error) {
      console.error("Error fetching chats:", error);
      Alert.alert("Error", "Failed to load chats.");
    } finally {
      setLoading(false);
    }
  };

  const updateLastRead = async (chatId: string) => {
    const currentTime = new Date().toISOString();
    const chatDocRef = doc(firestoreDB, "chatRooms", chatId);
    try {
      await updateDoc(chatDocRef, { [`lastRead.${userId}`]: currentTime });
      console.log(`Updated lastRead for chat ${chatId}`);
    } catch (error) {
      console.error("Failed to update lastRead: ", error);
    }
  };

  // Function to handle swipe and set reply
  const handleReply = (message: Message) => {
    setReplyToMessage({
      content: message.content,
      senderName:
        message.senderId === userId
          ? "You"
          : selectedChat?.user.firstName || "User",
    });
  };

  // Function to clear reply
  const cancelReply = () => {
    setReplyToMessage(null);
  };

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    if (selectedChat) {
      const chatDocRef = doc(firestoreDB, "chatRooms", selectedChat.chatID);
      unsubscribe = onSnapshot(chatDocRef, (docSnap) => {
        if (!docSnap.exists()) {
          console.warn("🚨 Chat room doesn't exist in Firestore!");
        } else {
          const data = docSnap.data();
          if (data.messages) {
            setSelectedChat((prev) => {
              if (!prev)
                return {
                  ...selectedChat,
                  messages: data.messages,
                  sold: data.sold,
                };
              if (!prev.messages || !Array.isArray(data.messages)) return prev;
              // Remove auto scroll here so the user can scroll manually.
              return { ...prev, messages: data.messages, sold: data.sold };
            });
          } else if (data.sold !== undefined) {
            setSelectedChat((prev) =>
              prev ? { ...prev, sold: data.sold } : prev
            );
          }
        }
      });
    }
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [selectedChat, firestoreDB]);

  useEffect(() => {
    if (chats.length > 0) {
      const chatIDs = chats.map((chat) => chat.chatID);
      const q = query(
        collection(firestoreDB, "chatRooms"),
        where(documentId(), "in", chatIDs)
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          if (data.messages) {
            const lastMessage = data.messages[data.messages.length - 1];
            setChats((prevChats) => {
              const updated = prevChats.map((c) => {
                if (c.chatID === docSnap.id) {
                  return {
                    ...c,
                    latestMessage: lastMessage?.content || "",
                    latestTimestamp: lastMessage?.timestamp || "",
                    latestSenderId: lastMessage?.senderId || "",
                    sold: data.sold,
                  };
                }
                return c;
              });
              return [...updated].sort((a, b) => {
                const aTime = a.latestTimestamp
                  ? new Date(a.latestTimestamp).getTime()
                  : 0;
                const bTime = b.latestTimestamp
                  ? new Date(b.latestTimestamp).getTime()
                  : 0;
                return bTime - aTime;
              });
            });
          }
        });
      });
      return () => unsubscribe();
    }
  }, [chats.map((c) => c.chatID).join(","), firestoreDB]);

  const openChat = async (chat: Chat) => {
    setLoading(true);
    try {
      setSelectedChat((prev) =>
        prev && prev.chatID === chat.chatID ? prev : { ...chat, messages: [] }
      );

      const messages = await getMessages(chat.chatID, token);
      setSelectedChat({ ...chat, messages });

      await updateLastRead(chat.chatID);
      setChatModalVisible(true);
      setNewMessage("");

      // Scroll to bottom after a small delay to ensure content is rendered
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 300);
    } catch (error) {
      console.error("Error opening chat:", error);
      Alert.alert("Error", "Failed to load messages.");
    } finally {
      setLoading(false);
    }
  };

  const handleBackFromChat = async () => {
    if (selectedChat) {
      const messages = selectedChat.messages;
      const lastMsg = messages[messages.length - 1];
      const updatedChat: Chat = {
        ...selectedChat,
        latestMessage: lastMsg ? lastMsg.content : "",
        latestTimestamp: lastMsg ? lastMsg.timestamp : "",
        latestSenderId: lastMsg ? lastMsg.senderId : undefined,
      };
      try {
        await AsyncStorage.setItem(
          `chat_last_message_${selectedChat.chatID}`,
          JSON.stringify({
            latestMessage: updatedChat.latestMessage,
            latestTimestamp: updatedChat.latestTimestamp,
            latestSenderId: updatedChat.latestSenderId,
          })
        );
        if (lastMsg?.timestamp) {
          await AsyncStorage.setItem(
            `last_read_${selectedChat.chatID}`,
            lastMsg.timestamp
          );
        }
        await updateLastRead(selectedChat.chatID);
      } catch (e) {
        console.error("Error saving last message or read time:", e);
      }
      setChats((prevChats) =>
        [
          ...prevChats.map((c) =>
            c.chatID === updatedChat.chatID ? updatedChat : c
          ),
        ].sort((a, b) => {
          const aTime = a.latestTimestamp
            ? new Date(a.latestTimestamp).getTime()
            : 0;
          const bTime = b.latestTimestamp
            ? new Date(b.latestTimestamp).getTime()
            : 0;
          return bTime - aTime;
        })
      );
    }
    setChatModalVisible(false);
    setSelectedChat(null);
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedChat) {
      Alert.alert("Error", "Please enter a message.");
      return;
    }

    // Construct message object with optional reply reference
    const messageContent = newMessage.trim();
    const newMessageObject = {
      _id: Date.now().toString(),
      senderId: userId,
      content: messageContent,
      timestamp: new Date().toISOString(),
      replyTo: replyToMessage
        ? {
            content: replyToMessage.content,
            senderName: replyToMessage.senderName,
          }
        : null, // Include reply reference if replying
    };

    try {
      const chatDocRef = doc(firestoreDB, "chatRooms", selectedChat.chatID);
      await setDoc(
        chatDocRef,
        { messages: arrayUnion(newMessageObject) },
        { merge: true }
      );

      setNewMessage("");
      setReplyToMessage(null); // Clear reply after sending

      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error("Error sending message:", error);
      Alert.alert("Error", "Failed to send message.");
    }
  };

  const handleImagePress = async () => {
    try {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Required", "We need camera roll permission!");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: false,
        quality: 0.7,
      });
      if (!result.canceled && result.assets?.length) {
        const asset = result.assets[0];
        const uploadedImageUrl = await uploadImageToCloudinary(asset.uri);
        await sendImageMessage(uploadedImageUrl);
      }
    } catch (error) {
      console.error("Error picking image:", error);
      Alert.alert("Error", "An error occurred while selecting an image.");
    }
  };

  const sendImageMessage = async (imageUrl: string) => {
    if (!selectedChat) return;
    const msgData = {
      _id: Date.now().toString(),
      senderId: userId,
      content: `[Image] ${imageUrl}`,
      timestamp: new Date().toISOString(),
    };
    const chatDocRef = doc(firestoreDB, "chatRooms", selectedChat.chatID);
    await setDoc(
      chatDocRef,
      { messages: arrayUnion(msgData) },
      { merge: true }
    );
  };

  const uploadImageToCloudinary = async (uri: string): Promise<string> => {
    if (!uri) throw new Error("Cannot upload an empty URI");
    setIsUploadingImage(true);
    try {
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
        headers: { "Content-Type": "multipart/form-data" },
      });
      return response.data.secure_url;
    } catch (error) {
      console.error("Error uploading image to Cloudinary:", error);
      Alert.alert("Error", "Image upload failed. Please try again.");
      throw error;
    } finally {
      setIsUploadingImage(false);
    }
  };

  const confirmAddImage = async () => {
    if (!selectedChat || !selectedImageUri) return;
    setSending(true);
    try {
      const uploadedImageUrl = await uploadImageToCloudinary(selectedImageUri);
      const imageMessage = `[Image] ${uploadedImageUrl}`;
      const chatDocRef = doc(firestoreDB, "chatRooms", selectedChat.chatID);
      const messageData = {
        _id: Date.now().toString(),
        senderId: userId,
        content: imageMessage,
        timestamp: new Date().toISOString(),
      };
      await setDoc(
        chatDocRef,
        { messages: arrayUnion(messageData) },
        { merge: true }
      );
    } catch (error: any) {
      Alert.alert("Error", error?.message || "Failed to send image.");
    } finally {
      setSelectedImageUri(null);
      setIsImagePreviewModalVisible(false);
      setSending(false);
    }
  };

  // --- Fix for Request Fetching ---
  // Changed endpoint to plural "/chat/request" which matches the backend's GetChatRequestsHandler
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
        "https://thegridproduct-production.up.railway.app/chat/request",
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );
      console.log("Fetched Requests:", response.data);
      if (response.status === 200) {
        let { incomingRequests, outgoingRequests } = response.data;
        // Default to empty arrays if null:
        incomingRequests = incomingRequests || [];
        outgoingRequests = outgoingRequests || [];
        incomingRequests = incomingRequests.sort(
          (a: Request, b: Request) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        outgoingRequests = outgoingRequests.sort(
          (a: Request, b: Request) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        setIncomingRequests(incomingRequests);
        setOutgoingRequests(outgoingRequests);
        setHasNewIncomingRequests(incomingRequests.length > 0);
      } else {
        setErrorRequests("Failed to fetch chat requests.");
      }
    } catch (error: any) {
      console.error("Error fetching requests:", error);
      setErrorRequests(
        error.response?.data?.message ||
          "An error occurred while fetching chat requests."
      );
    } finally {
      setLoadingRequests(false);
    }
  };

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
        setRequestPopupMessage("Chat request accepted.");
        setRequestPopupVisible(true);
        setIncomingRequests((prev) =>
          prev.filter((req) => req.requestId !== requestId)
        );
        await fetchUserChats();
        if (response.data.chatID) {
          const newChat = chats.find((c) => c.chatID === response.data.chatID);
          if (newChat) {
            openChat(newChat);
          } else {
            openChat(chats[chats.length - 1]);
          }
        }
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
        setRequestPopupMessage("Chat request rejected.");
        setRequestPopupVisible(true);
        setIncomingRequests((prev) =>
          prev.filter((req) => req.requestId !== requestId)
        );
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

  const renderChat = ({ item }: { item: Chat }) => {
    if (!item.user) {
      console.warn(`Chat with chatID ${item.chatID} is missing user data.`);
      return null;
    }
    const latestMessage = item.latestMessage
      ? {
          content: item.latestMessage,
          timestamp: item.latestTimestamp,
          senderId: item.latestSenderId,
        }
      : null;
    const formattedTimestamp = latestMessage
      ? new Date(latestMessage.timestamp).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "";
    const unreadCount = unreadCounts[item.chatID] || 0;
    const chatTypeLabel =
      item.referenceType === "product"
        ? "Product Name: "
        : item.referenceType === "gig"
        ? "Gig Name: "
        : item.referenceType === "product_request"
        ? "Product Request Name: "
        : "Unnamed Item";
    return (
<Pressable
  style={styles.chatItemContainer}
  onPressIn={() => openChat(item)}
  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
  accessibilityLabel={`Open chat with ${item.user.firstName} ${item.user.lastName}`}
>

        <View style={styles.chatItem}>
          <View style={styles.profilePicWrapper}>
            <View style={styles.profilePicPlaceholder}>
              <Text style={styles.profilePicInitials}>
                {item.user.firstName.charAt(0).toUpperCase()}
                {item.user.lastName.charAt(0).toUpperCase()}
              </Text>
            </View>
          </View>
          <View style={styles.chatDetails}>
            <View style={styles.chatHeaderRow}>
              <Text style={styles.chatName} numberOfLines={1}>
                {item.user.firstName} {item.user.lastName}
              </Text>
              <View style={styles.timeContainer}>
                <Text style={styles.chatTime}>{formattedTimestamp}</Text>
                {unreadCount > 0 && (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
                  </View>
                )}
              </View>
            </View>
            <Text style={styles.chatProductName} numberOfLines={1}>
              {chatTypeLabel} {item.referenceTitle || "Unnamed Item"}
            </Text>
            {latestMessage && (
              <View style={styles.lastMessageRow}>
                <View
                  style={
                    latestMessage.senderId !== userId
                      ? styles.purpleDot
                      : styles.greyDot
                  }
                />
                <Text style={styles.lastMessage} numberOfLines={1}>
                  {latestMessage.content.startsWith("[Image] ")
                    ? "Image"
                    : latestMessage.content}
                </Text>
              </View>
            )}
          </View>
        </View>
      </Pressable>
    );
  };

  const [tapCount, setTapCount] = useState(0);

  const handleDoubleTap = (message: Message) => {
    if (tapCount === 1) {
      setTapCount(0); // Reset the tap count
      handleReply(message); // Reply to the message
    } else {
      setTapCount(1); // First tap
      setTimeout(() => {
        setTapCount(0); // Reset after a short delay
      }, 300); // 300ms delay for double-tap
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isImageMessage = item.content.startsWith("[Image] ");
    const imageUri = isImageMessage
      ? item.content.replace("[Image] ", "")
      : null;
    const isCurrentUser = item.senderId === userId;

    return (
      <TouchableOpacity onPress={() => handleDoubleTap(item)}>
        <View
          style={[
            styles.messageContainer,
            isCurrentUser
              ? styles.myMessageContainer
              : styles.theirMessageContainer,
          ]}
        >
          <View
            style={[
              styles.messageBubble,
              isCurrentUser ? styles.myMessage : styles.theirMessage,
            ]}
          >
            {/* Show reply message above if it exists */}
            {item.replyTo && (
              <View style={styles.replyContainer}>
                <Text style={styles.replySenderText}>
                  {item.replyTo.senderName}:
                </Text>
                <Text
                  style={[
                    styles.originalMessage,
                    isCurrentUser ? styles.myReplyText : styles.theirReplyText,
                  ]}
                >
                  {item.replyTo.content}
                </Text>

                <View style={styles.curvedArrow} />
              </View>
            )}

            {/* Show image or normal text */}
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
                  isCurrentUser
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
                isCurrentUser
                  ? styles.myTimestampColor
                  : styles.theirTimestampColor,
              ]}
            >
              {new Date(item.timestamp).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const handleDeleteChat = async () => {
    if (!selectedChat) return;
    Alert.alert(
      "Confirm Delete",
      "Are you sure you want to delete this chat?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const response = await axios.delete(
                `https://thegridproduct-production.up.railway.app/chats/${selectedChat.chatID}`,
                { headers: { Authorization: `Bearer ${token}` } }
              );
              if (response.status === 200) {
                setChats((prevChats) =>
                  prevChats.filter((c) => c.chatID !== selectedChat.chatID)
                );
                setChatModalVisible(false);
                setSelectedChat(null);
                Alert.alert("Success", "Chat deleted successfully.");
              }
            } catch (error: any) {
              console.error("Error deleting chat:", error);
              Alert.alert(
                "Error",
                error.response?.data?.message || "Failed to delete chat."
              );
            }
          },
        },
      ]
    );
  };

  const handleMarkAsSold = async () => {
    if (!selectedChat) return;
    Alert.alert(
      "Confirm",
      "Have you sold the product? It will be removed from the marketplace.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "OK",
          onPress: async () => {
            try {
              const response = await axios.put(
                `https://thegridproduct-production.up.railway.app/chats/${selectedChat.chatID}/complete`,
                {},
                {
                  headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                  },
                }
              );
              if (response.status === 200) {
                const chatDocRef = doc(
                  firestoreDB,
                  "chatRooms",
                  selectedChat.chatID
                );
                await updateDoc(chatDocRef, { sold: true });
                Alert.alert("Success", response.data.message);
              }
            } catch (error: any) {
              console.error("Error marking as sold/done:", error);
              Alert.alert(
                "Error",
                error.response?.data?.message ||
                  "Failed to update status of the item."
              );
            }
          },
        },
      ]
    );
  };

  const productsOrGigs = chats.map((c) => ({
    chatID: c.chatID,
    title: c.referenceTitle || "Unnamed Item",
    type: c.referenceType || "product",
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

  const currentHeaderTitle =
    filter === "all"
      ? "All Chats"
      : filter === "products"
      ? "Chats"
      : filter === "gigs"
      ? "Chats"
      : filter === "product_request"
      ? "Chats"
      : "All Chats";
  const currentFilterLabel =
    filter === "all"
      ? "All ×"
      : filter === "products"
      ? "Products ×"
      : filter === "gigs"
      ? "Jobs ×"
      : filter === "product_request"
      ? "Product Requests ×"
      : "All ×";
  const handleFilterPillPress = () => {
    setFilterMenuVisible(true);
  };
  const handleReportPress = () => {
    setReportModalVisible(true);
    setChatModalVisible(false);
  };

  useEffect(() => {
    if (reportModalVisible) {
      console.log("Report modal is visible");
    }
  }, [reportModalVisible]);

  const fetchChatDetails = async (chatId: string) => {
    if (!chatId) {
      console.error("Error: chatId is undefined!");
      return null;
    }
    try {
      const response = await axios.get(`${NGROK_URL}/chats/${chatId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.status === 200 && response.data) {
        return response.data;
      } else {
        console.error("Failed to fetch chat details:", response.status);
        return null;
      }
    } catch (error) {
      console.error(
        "Error fetching chat details:",
        error.response?.data || error
      );
      return null;
    }
  };

  const handleModifiedReportSubmit = async () => {
    if (
      reportReason === "Select a Reason" ||
      !reportDescription.trim() ||
      (reportReason === "Other" && !customReason.trim())
    ) {
      setIsIncompletePopupVisible(true);
      return;
    }
    setIsSubmittingReport(true);
    if (!selectedChat || !selectedChat.chatID) {
      console.error("Error: Missing chat ID.");
      Alert.alert("Error", "Cannot submit report without a chat ID.");
      setIsSubmittingReport(false);
      return;
    }
    try {
      const response = await axios.post(
        `${NGROK_URL}/report`,
        {
          chatId: selectedChat.chatID,
          reason: reportReason === "Other" ? customReason.trim() : reportReason,
          description: reportDescription.trim(),
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );
      if (response.status === 200) {
        setReportModalVisible(false);
        setTimeout(() => setChatModalVisible(true), 300);
        Alert.alert("Success", "Report submitted successfully.");
      } else {
        throw new Error("Failed to submit report");
      }
    } catch (error) {
      console.error("Error submitting report:", error);
      Alert.alert("Error", "Could not submit report.");
    } finally {
      setIsSubmittingReport(false);
    }
  };

  const renderRequestsModal = () => {
    Animated.timing(slideAnim, {
      toValue: isRequestsModalVisible ? 0 : Dimensions.get("window").height,
      duration: 250,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: true,
    }).start();

    const renderRequestItem = ({ item }: { item: Request }) => {
      const referenceTypeLabel =
        item.referenceType === "product"
          ? "Product Name: "
          : item.referenceType === "gig"
          ? "Gig Name: "
          : item.referenceType === "product_request"
          ? "Product Request Name: "
          : "Unnamed Item";
      return (
        <View style={styles.requestCard}>
          <View style={styles.requestInfo}>
            <Text style={styles.requestProductName}>
              {referenceTypeLabel} {item.referenceTitle || "Unnamed Item"}
            </Text>
            <Text style={styles.requestSender}>
              {selectedRequestsTab === "incoming"
                ? `From: ${item.buyerFirstName} ${item.buyerLastName}`
                : `To: ${item.sellerFirstName} ${item.sellerLastName}`}
            </Text>
            <Text style={styles.requestDate}>
              Created on: {new Date(item.createdAt).toLocaleDateString()}
            </Text>
          </View>
          {selectedRequestsTab === "incoming" ? (
            <View style={styles.requestActions}>
              <TouchableOpacity
                style={[
                  styles.acceptButton,
                  processingRequestId === item.requestId &&
                    styles.buttonDisabled,
                ]}
                onPress={() => acceptRequest(item.requestId)}
                disabled={processingRequestId === item.requestId}
                accessibilityLabel="Accept Request"
              >
                {processingRequestId === item.requestId ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Ionicons name="checkmark" size={20} color="#fff" />
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.rejectButton,
                  processingRequestId === item.requestId &&
                    styles.buttonDisabled,
                ]}
                onPress={() => rejectRequest(item.requestId)}
                disabled={processingRequestId === item.requestId}
                accessibilityLabel="Reject Request"
              >
                {processingRequestId === item.requestId ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Ionicons name="close" size={20} color="#fff" />
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.requestActions} />
          )}
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
            <View style={styles.requestsTabsRow}>
              <Pressable
                onPress={() => setSelectedRequestsTab("incoming")}
                style={[
                  styles.requestsTab,
                  selectedRequestsTab === "incoming" &&
                    styles.activeRequestsTab,
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
                  selectedRequestsTab === "outgoing" &&
                    styles.activeRequestsTab,
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
                  keyExtractor={(item) => item.requestId}
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
                  refreshing={loadingRequests}
                  onRefresh={fetchUserRequests}
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
        <View style={styles.headerRow}>
          <Text style={styles.mainHeader}>{currentHeaderTitle}</Text>
          <View style={styles.headerButtons}>
            <Pressable
              style={styles.requestsButton}
              onPress={() => {
                setRequestsModalVisible(true);
                setSelectedRequestsTab("incoming");
                fetchUserRequests();
              }}
              accessibilityLabel="View Requests"
            >
              <View style={{ position: "relative" }}>
                <Ionicons
                  name="list-circle-outline"
                  size={24}
                  color="#BB86FC"
                />
                {hasNewIncomingRequests && (
                  <View style={styles.exclamationBadge}>
                    <Ionicons name="alert" size={12} color="#fff" />
                  </View>
                )}
              </View>
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
                  setFilter("all");
                  setFilterMenuVisible(false);
                  setFilteredChats(applyFilter(chats, "all"));
                }}
              >
                <Text style={styles.filterModalOptionText}>All</Text>
              </Pressable>
              <Pressable
                style={styles.filterModalOption}
                onPress={() => {
                  setFilter("products");
                  setFilterMenuVisible(false);
                  setFilteredChats(applyFilter(chats, "products"));
                }}
              >
                <Text style={styles.filterModalOptionText}>Products</Text>
              </Pressable>
              <Pressable
                style={styles.filterModalOption}
                onPress={() => {
                  setFilter("gigs");
                  setFilterMenuVisible(false);
                  setFilteredChats(applyFilter(chats, "gigs"));
                }}
              >
                <Text style={styles.filterModalOptionText}>Jobs</Text>
              </Pressable>
              <Pressable
                style={styles.filterModalOption}
                onPress={() => {
                  setFilter("product_request");
                  setFilterMenuVisible(false);
                  setFilteredChats(applyFilter(chats, "product_request"));
                }}
              >
                <Text style={styles.filterModalOptionText}>
                  Product Requests
                </Text>
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
        {renderRequestsModal()}
        {chats.length > 0 && (
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
                  accessibilityLabel={`Navigate to ${item.type} titled ${item.title}`}
                >
                  <Text style={styles.productGigItemText}>
                    {item.type === "product" ? "Product: " : "Gig: "}{" "}
                    {item.title}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}
        <View style={styles.separatorAfterPurchases} />
        {loading && chats.length === 0 ? (
          <ActivityIndicator size="large" color="#BB86FC" />
        ) : chats.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No chats found.</Text>
          </View>
        ) : (
          <FlatList
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: 60 }}
            data={filteredChats}
            keyExtractor={(item, index) => item.chatID || index.toString()}
            renderItem={renderChat}
            ItemSeparatorComponent={() => <View style={styles.separatorLine} />}
          />
        )}
        <Modal
          visible={isChatModalVisible}
          animationType="slide"
          transparent={false}
          onRequestClose={handleBackFromChat}
        >
          <View style={[styles.modalSafeArea, { backgroundColor: "#000" }]}>
            <SafeAreaView style={{ flex: 1 }}>
              <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : undefined}
                style={styles.modalContainer}
              >
                {selectedChat && (
                  <View style={styles.enhancedChatHeader}>
<AnimatedBackButton onPress={handleBackFromChat} />

                    <View style={styles.chatHeaderInfo}>
                      <View style={styles.headerProfilePicPlaceholder}>
                        <Text style={styles.headerProfilePicInitials}>
                          {selectedChat.user.firstName.charAt(0).toUpperCase()}
                          {selectedChat.user.lastName.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.chatHeaderTextContainer}>
                        <Text style={styles.chatHeaderUserName}>
                          {selectedChat.user.firstName}{" "}
                          {selectedChat.user.lastName}
                        </Text>
                        <Text style={styles.chatHeaderSubTitle}>
                          {selectedChat?.referenceType
                            ? selectedChat.referenceType
                                .charAt(0)
                                .toUpperCase() +
                              selectedChat.referenceType.slice(1)
                            : ""}
                          {selectedChat?.referenceTitle
                            ? `: ${selectedChat.referenceTitle}`
                            : ""}
                        </Text>
                      </View>
                    </View>
                    <Pressable
                      onPress={handleReportPress}
                      style={styles.reportButton}
                      accessibilityLabel="Report User"
                    ></Pressable>
                    {selectedChat?.referenceType === "product" &&
                      (selectedChat.sold ? (
                        <View style={styles.productActionButtons}>
                          <Text style={styles.soldLabel}>Product Sold</Text>
                        </View>
                      ) : (
                        <View style={styles.productActionButtons}>
                          <Pressable
                            onPress={handleDeleteChat}
                            style={[
                              styles.smallActionButton,
                              styles.smallActionButtonClose,
                            ]}
                            accessibilityLabel="Close Chat"
                          >
                            <Ionicons name="close" size={16} color="#FFFFFF" />
                          </Pressable>
                          <Pressable
                            onPress={handleMarkAsSold}
                            style={[
                              styles.smallActionButton,
                              styles.smallActionButtonCheck,
                            ]}
                            accessibilityLabel="Mark as Sold"
                          >
                            <Ionicons
                              name="checkmark"
                              size={16}
                              color="#FFFFFF"
                            />
                          </Pressable>
                        </View>
                      ))}
                  </View>
                )}
                {/* Removed onContentSizeChange and onLayout auto scroll props to allow manual scrolling */}
                <FlatList
                  ref={flatListRef}
                  data={selectedChat?.messages || []}
                  keyExtractor={(item, index) => item._id || index.toString()}
                  renderItem={renderMessage}
                  contentContainerStyle={styles.messagesList}
                  inverted={false} // Ensure it is set to false
                  onContentSizeChange={() =>
                    flatListRef.current?.scrollToEnd({ animated: true })
                  }
                  onLayout={() =>
                    flatListRef.current?.scrollToEnd({ animated: true })
                  }
                />

                <View style={styles.inputBarContainer}>
                  <View style={styles.inputBarLine} />
                  <MessageReplyHandler
                    replyToMessage={replyToMessage}
                    onCancelReply={cancelReply}
                    setNewMessage={setNewMessage} // Now it's passed correctly
                  />

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
                      blurOnSubmit
                      onSubmitEditing={Keyboard.dismiss}
                    />
                    <Pressable
                      style={styles.sendButton}
                      onPress={sendMessage}
                      accessibilityLabel="Send Message"
                    >
                      <Ionicons name="send" size={18} color="#fff" />
                    </Pressable>
                  </View>
                  <View style={styles.inputBarLine} />
                </View>
              </KeyboardAvoidingView>
            </SafeAreaView>
          </View>
        </Modal>
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


<AnimatedBackButton onPress={handleBackFromChat} />

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
        <Modal
          visible={reportModalVisible}
          animationType="slide"
          transparent={false}
          onRequestClose={() => setReportModalVisible(false)}
        >
          <KeyboardAvoidingView
            style={{ flex: 1, backgroundColor: "#000" }}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <SafeAreaView style={{ flex: 1, padding: 20 }}>
              <View style={styles.enhancedChatHeader}>
                <Pressable
                  onPress={() => setReportModalVisible(false)}
                  style={styles.backButton}
                  accessibilityLabel="Go Back"
                >
                  <Ionicons name="arrow-back" size={24} color="#BB86FC" />
                </Pressable>
                <View style={styles.chatHeaderInfo}>
                  <Text style={styles.chatHeaderUserName}>Report User</Text>
                </View>
                <View style={{ width: 24 }} />
              </View>
              <View style={styles.reportContent}>
                <Text style={styles.reportLabel}>Select Reason:</Text>
                <Pressable
                  style={styles.dropdownContainer}
                  onPress={() => setIsReasonDropdownVisible(true)}
                >
                  <Text
                    style={
                      reportReason === "Select a Reason"
                        ? styles.dropdownPlaceholderText
                        : styles.dropdownSelectedText
                    }
                  >
                    {reportReason}
                  </Text>
                  <Ionicons
                    name="chevron-down"
                    size={16}
                    color="#FFFFFF"
                    style={styles.dropdownIcon}
                  />
                </Pressable>
                {isReasonDropdownVisible && (
                  <View style={styles.dropdownAbsoluteOverlay}>
                    <View style={styles.dropdownAbsoluteContainer}>
                      {reasons.map((reason) => (
                        <Pressable
                          key={reason}
                          style={styles.dropdownOption}
                          onPress={() => {
                            setReportReason(reason);
                            setIsReasonDropdownVisible(false);
                          }}
                        >
                          <Text style={styles.dropdownOptionText}>
                            {reason}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                )}
                {reportReason === "Other" && (
                  <TextInput
                    style={styles.otherReasonInput}
                    placeholder="Enter your reason..."
                    placeholderTextColor="#888"
                    value={customReason}
                    onChangeText={setCustomReason}
                    blurOnSubmit
                    onSubmitEditing={Keyboard.dismiss}
                  />
                )}
                <Text style={styles.reportLabel}>Description:</Text>
                <TextInput
                  style={styles.reportDescriptionInput}
                  placeholder="Describe the issue..."
                  placeholderTextColor="#888"
                  value={reportDescription}
                  onChangeText={setReportDescription}
                  multiline
                  blurOnSubmit
                  onSubmitEditing={Keyboard.dismiss}
                />
                <Text style={styles.reportInfoText}>
                  The Gridly team will reach out to you soon.
                </Text>
                <Pressable
                  style={styles.reportSubmitButton}
                  onPress={handleModifiedReportSubmit}
                  disabled={isSubmittingReport}
                >
                  {isSubmittingReport ? (
                    <ActivityIndicator color="#000" size="small" />
                  ) : (
                    <Text style={styles.reportSubmitButtonText}>Submit</Text>
                  )}
                </Pressable>
              </View>
            </SafeAreaView>
          </KeyboardAvoidingView>
        </Modal>
        <Modal
          transparent
          visible={isReportSuccessModalVisible}
          animationType="fade"
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Ionicons name="checkmark-circle" size={60} color="#9C27B0" />
              <Text style={styles.modalText}>
                Report Submitted Successfully!
              </Text>
            </View>
          </View>
        </Modal>
        <Modal
          transparent
          visible={isIncompletePopupVisible}
          animationType="fade"
          onRequestClose={() => setIsIncompletePopupVisible(false)}
        >
          <View style={styles.popupOverlay}>
            <View style={styles.popupContainer}>
              <Text style={styles.popupText}>Please fill in all details.</Text>
              <Pressable
                style={styles.popupButton}
                onPress={() => setIsIncompletePopupVisible(false)}
              >
                <Text style={styles.popupButtonText}>OK</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
        <Modal
          transparent
          visible={requestPopupVisible}
          animationType="fade"
          onRequestClose={() => setRequestPopupVisible(false)}
        >
          <View style={styles.popupOverlay}>
            <View style={styles.popupContainer}>
              <Text style={styles.popupText}>{requestPopupMessage}</Text>
              <Pressable
                style={styles.popupButton}
                onPress={() => setRequestPopupVisible(false)}
              >
                <Text style={styles.popupButtonText}>Close</Text>
              </Pressable>
            </View>
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
  container: { flex: 1, backgroundColor: "#000" },
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
  headerButtons: { flexDirection: "row", alignItems: "center" },
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
  filterModalOption: { paddingVertical: 10, alignItems: "center" },
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
  horizontalListContainer: { marginTop: 10, paddingHorizontal: 20 },
  sectionTitle: {
    color: "#BB86FC",
    fontSize: 16,
    fontFamily: "HelveticaNeue-Bold",
    marginBottom: 5,
  },
  horizontalScroll: { flexDirection: "row" },
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
  productGigItemText: { color: "#FFFFFF", fontFamily: "HelveticaNeue" },
  separatorAfterPurchases: {
    height: 1,
    backgroundColor: "#222",
    marginTop: 10,
    marginBottom: 10,
  },
  chatItemContainer: {
    backgroundColor: "transparent",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  chatItem: { flexDirection: "row", alignItems: "center" },
  profilePicWrapper: { marginRight: 12 },
  profilePicPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#BB86FC",
    justifyContent: "center",
    alignItems: "center",
  },
  sectionEmptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
  },
  sectionEmptyText: {
    fontSize: 16,
    color: "#888888",
    textAlign: "center",
    fontFamily: "HelveticaNeue",
  },
  requestActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    marginTop: 8,
  },
  profilePicInitials: {
    color: "#000",
    fontSize: 18,
    fontWeight: "700",
    fontFamily: "HelveticaNeue-Bold",
  },
  requestsSeparatorLine: {
    height: 1,
    backgroundColor: "#333333",
    marginVertical: 8,
  },
  reportLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 8,
    fontFamily: "HelveticaNeue-Medium",
  },
  chatDetails: { flex: 1, flexDirection: "column" },
  chatHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  chatName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
    fontFamily: "Helvetica",
  },
  timeContainer: { position: "relative", alignItems: "flex-end" },
  chatTime: { fontSize: 12, color: "#AAAAAA", fontFamily: "HelveticaNeue" },
  chatProductName: {
    fontSize: 13,
    color: "#FFFFFF",
    fontFamily: "HelveticaNeue",
    marginTop: 2,
    marginBottom: 3,
  },
  lastMessageRow: { flexDirection: "row", alignItems: "center", marginTop: 2 },
  purpleDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#9C27B0",
    marginRight: 5,
  },
  greyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#888888",
    marginRight: 5,
  },
  reportButton: {
    backgroundColor: "#222",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  exclamationBadge: {
    position: "absolute",
    top: -3,
    right: -3,
    backgroundColor: "#FF3B30",
    borderRadius: 7,
    paddingHorizontal: 6,
    paddingVertical: 2,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  lastMessage: {
    fontSize: 14,
    color: "#CCCCCC",
    fontFamily: "HelveticaNeue",
    flexShrink: 1,
  },
  separatorLine: { height: 0.5, backgroundColor: "#333333", marginLeft: 82 },
  emptyContainer: { marginTop: 50, alignItems: "center" },
  emptyText: { fontSize: 18, color: "#888888", fontFamily: "HelveticaNeue" },
  acceptButton: {
    backgroundColor: "#4CAF50",
    padding: 10,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 5,
  },
  rejectButton: {
    backgroundColor: "#F44336",
    padding: 10,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 5,
  },
  buttonDisabled: { backgroundColor: "#888888", opacity: 0.5 },
  modalSafeArea: { flex: 1 },
  modalContainer: { flex: 1 },
  enhancedChatHeader: {
    backgroundColor: "#1F1F1F",
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#333333",
    flexDirection: "row",
    alignItems: "center",
  },
  backButton: { marginRight: 10 },
  chatHeaderInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginLeft: 15, // Increase this to shift everything to the right
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
  chatHeaderTextContainer: { flexDirection: "column", flexShrink: 1 },
  chatHeaderUserName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
    fontFamily: "HelveticaNeue-Bold",
  },
  chatHeaderSubTitle: {
    fontSize: 13,
    color: "#FFFFFF",
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
  messagesList: { flexGrow: 1, paddingVertical: 10, paddingHorizontal: 10 },
  messageContainer: { marginBottom: 10, flexDirection: "row", maxWidth: "80%" },
  myMessageContainer: { alignSelf: "flex-end" },
  theirMessageContainer: { alignSelf: "flex-start" },
  messageBubble: {
    borderRadius: 14,
    padding: 8,
    maxWidth: "100%",
    flexDirection: "row",
    alignItems: "flex-end",
    flexWrap: "wrap",
    position: "relative",
  },
  myMessage: { backgroundColor: "#BB86FC", borderTopRightRadius: 0 },
  theirMessage: { backgroundColor: "#222", borderTopLeftRadius: 0 },
  myMessageTextColor: { color: "#000000" },
  theirMessageTextColor: { color: "#FFFFFF" },
  messageText: { fontSize: 16, fontFamily: "HelveticaNeue", flexShrink: 1 },
  messageTimestamp: {
    fontSize: 11,
    fontFamily: "HelveticaNeue",
    marginLeft: 5,
  },
  myTimestampColor: { color: "#333333" },
  theirTimestampColor: { color: "#999999" },

  messageImage: { width: 200, height: 200, borderRadius: 10, marginRight: 5 },
  inputBarContainer: { backgroundColor: "#000" },
  inputBarLine: { height: 1, backgroundColor: "#333333" },
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
  iconButton: { marginHorizontal: 5 },
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
  previewImage: { width, height: undefined, aspectRatio: 1 },
  addImageButton: { marginLeft: "auto" },
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
  unreadBadge: {
    position: "absolute",
    top: 22,
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: "center",
  },
  unreadBadgeText: {
    color: "#000000",
    fontSize: 10,
    fontWeight: "bold",
    textAlign: "center",
  },
  requestsSafeArea: { flex: 1 },
  requestsHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  closeButton: { padding: 5 },
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
  activeRequestsTab: { backgroundColor: "#BB86FC" },
  requestsTabText: {
    color: "#BBBBBB",
    fontSize: 14,
    fontFamily: "HelveticaNeue-Medium",
  },
  activeRequestsTabText: { color: "#000" },
  requestsContent: { flex: 1, paddingHorizontal: 20, paddingBottom: 20 },
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
  requestInfo: { marginBottom: 8 },
  requestProductName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#BB86FC",
    fontFamily: "HelveticaNeue-Bold",
    marginBottom: 3,
  },
  requestDate: { fontSize: 12, color: "#AAAAAA", fontFamily: "HelveticaNeue" },
  reportContent: { flex: 1, padding: 20, backgroundColor: "#000" },
  dropdownContainer: {
    backgroundColor: "#1E1E1E",
    borderWidth: 1,
    borderColor: "#555",
    borderRadius: 6,
    height: 40,
    justifyContent: "center",
    paddingHorizontal: 10,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  dropdownPlaceholderText: { color: "#888", fontSize: 14 },
  requestSender: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#FFFFFF",
    fontFamily: "HelveticaNeue",
    marginBottom: 5,
  },
  dropdownSelectedText: { color: "#FFFFFF", fontSize: 14, fontWeight: "bold" },
  dropdownIcon: { marginLeft: "auto" },
  dropdownAbsoluteOverlay: {
    position: "absolute",
    top: 60,
    left: 0,
    right: 0,
    backgroundColor: "transparent",
    zIndex: 10,
  },
  myReplyText: {
    color: "#000", // Dark text for outgoing messages (background: purple)
  },
  theirReplyText: {
    color: "#FFF", // Light text for incoming messages (background: dark)
  },

  dropdownAbsoluteContainer: {
    backgroundColor: "#1E1E1E",
    marginHorizontal: 20,
    borderRadius: 8,
  },
  dropdownOption: { paddingVertical: 12, paddingHorizontal: 15 },
  dropdownOptionText: { color: "#FFFFFF", fontWeight: "bold", fontSize: 16 },
  otherReasonInput: {
    backgroundColor: "#333",
    color: "#fff",
    borderRadius: 6,
    paddingHorizontal: 10,
    height: 40,
    marginBottom: 10,
    fontFamily: "HelveticaNeue",
    fontSize: 14,
  },

  reportDescriptionInput: {
    backgroundColor: "#333",
    color: "#fff",
    borderRadius: 6,
    padding: 15,
    minHeight: 80,
    textAlignVertical: "top",
    marginBottom: 15,
    fontFamily: "HelveticaNeue",
    fontSize: 16,
  },
  reportInfoText: {
    fontSize: 12,
    color: "#AAAAAA",
    marginBottom: 15,
    fontFamily: "HelveticaNeue",
  },
  reportSubmitButton: {
    backgroundColor: "#BB86FC",
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: "center",
    marginBottom: 10,
  },
  reportSubmitButtonText: {
    color: "#000",
    fontSize: 16,
    fontFamily: "HelveticaNeue-Bold",
  },
  replyContainer: {
    marginBottom: 5,
    paddingBottom: 3,
    borderLeftWidth: 3,
    borderLeftColor: "#BB86FC",
    paddingLeft: 8,
    position: "relative",
  },
  replySenderText: {
    color: "#BB86FC",
    fontSize: 14,
    fontWeight: "bold",
  },
  originalMessage: {
    color: "#FFFFFF", // Change reply message text color to black
    fontSize: 14,
    fontStyle: "italic",
    marginBottom: 2,
  },

  curvedArrow: {
    width: 10,
    height: 10,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    borderColor: "#BB86FC",
    borderRadius: 4,
    transform: [{ rotate: "-45deg" }],
    position: "absolute",
    left: -8,
    bottom: -5,
  },

  originalMessage: {
    color: "#AAAAAA",
    fontSize: 14,
    fontStyle: "italic",
    marginBottom: 2,
  },
  replyArrow: {
    color: "#BB86FC",
    fontSize: 18,
    marginTop: -5,
    fontWeight: "bold",
  },

  modalContent: {
    backgroundColor: "#1E1E1E",
    padding: 30,
    borderRadius: 15,
    alignItems: "center",
    gap: 15,
  },
  modalText: { fontSize: 18, fontWeight: "600", color: "#fff" },
  popupOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  popupContainer: {
    backgroundColor: "#1E1E1E",
    padding: 20,
    borderRadius: 8,
    alignItems: "center",
  },
  popupText: { color: "#FFFFFF", fontSize: 16, marginBottom: 10 },
  popupButton: {
    backgroundColor: "#BB86FC",
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 6,
  },
  popupButtonText: { color: "#000", fontSize: 16, fontWeight: "bold" },
  productActionButtons: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 10,
  },
  smallActionButton: {
    width: 32,
    height: 32,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 4,
  },
  smallActionButtonClose: { backgroundColor: "#E74C3C" },
  smallActionButtonCheck: { backgroundColor: "#27AE60" },
  soldLabel: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
    fontFamily: "HelveticaNeue",
    marginRight: 10,
  },
});