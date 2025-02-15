// MessagingScreen.tsx

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
  Keyboard,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Ionicons from "react-native-vector-icons/Ionicons";
import BottomNavBar from "./components/BottomNavbar";
import { fetchConversations, getMessages } from "./api";
import {
  getFirestore,
  doc,
  onSnapshot,
  setDoc,
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

type Chat = Conversation & {
  latestSenderId?: string;
  unreadCount?: number;
};

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
  const preFetchedChats: Chat[] = route.params?.preFetchedChats || [];
  const [chats, setChats] = useState<Chat[]>(preFetchedChats);
  const [filteredChats, setFilteredChats] = useState<Chat[]>([]);
  const [filter, setFilter] = useState<
    "all" | "products" | "gigs" | "product_request"
  >("all");
  const [isChatModalVisible, setChatModalVisible] = useState<boolean>(false);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [newMessage, setNewMessage] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [sending, setSending] = useState<boolean>(false);

  // Image Upload states
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [isImagePreviewModalVisible, setIsImagePreviewModalVisible] =
    useState<boolean>(false);
  const [isUploadingImage, setIsUploadingImage] = useState<boolean>(false);

  // Filter Modal
  const [filterMenuVisible, setFilterMenuVisible] = useState<boolean>(false);

  // Requests Modal State
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
  const [customReason, setCustomReason] = useState<string>(""); // For "Other"
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

  // New state for the custom popup on accept/reject
  const [requestPopupVisible, setRequestPopupVisible] =
    useState<boolean>(false);
  const [requestPopupMessage, setRequestPopupMessage] = useState<string>("");

  // User & Token from Context
  const { userId, token } = useContext(UserContext);

  // Firestore instance
  const firestoreDB = getFirestore();
  const flatListRef = useRef<FlatList<Message> | null>(null);

  // Navigation & Route
  const navigation = useNavigation();
  const { chatId: routeChatId } = route.params || {};

  // Animation for Requests Modal Slide-Up
  const slideAnim = useRef(
    new Animated.Value(Dimensions.get("window").height)
  ).current;

  // Dropdown reasons list
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
    if (f === "products") {
      return chatsToFilter.filter((c) => c.referenceType === "product");
    }
    if (f === "gigs") {
      return chatsToFilter.filter((c) => c.referenceType === "gig");
    }
    return chatsToFilter.filter((c) => c.referenceType === f);
  };

  useEffect(() => {
    const filtered = applyFilter(chats, filter);
    const sorted = filtered.sort((a, b) => {
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
    if (chats.length === 0 && userId && token) {
      fetchUserChats();
    }
  }, [userId, token]);

  useFocusEffect(
    React.useCallback(() => {
      if (userId && token) {
        fetchUserChats();
      }
    }, [userId, token])
  );

  const fetchUserChats = async () => {
    if (!userId || !token) return;
    setLoading(true);
    try {
      const fetchedChats = await fetchConversations(userId, token);
      const mergedChats = await Promise.all(
        fetchedChats.map(async (chat) => {
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
            };
          } catch (e) {
            console.error("Error retrieving saved last message:", e);
            return chat;
          }
        })
      );
      setChats(mergedChats);
      if (routeChatId) {
        const chat = mergedChats.find((c) => c.chatID === routeChatId);
        if (chat) openChat(chat);
      }
    } catch (error) {
      console.error("Error fetching chats:", error);
      Alert.alert("Error", "Failed to load chats.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    if (selectedChat) {
      const chatDocRef = doc(firestoreDB, "chatRooms", selectedChat.chatID);
      unsubscribe = onSnapshot(chatDocRef, (docSnap) => {
        if (!docSnap.exists()) {
          console.warn(
            "🚨 Chat room does not exist in Firestore! Check chatID."
          );
        } else {
          const data = docSnap.data();
          if (data.messages) {
            setSelectedChat((prev) => {
              if (!prev)
                return { ...selectedChat, messages: data.messages || [] };
              if (!prev.messages || !Array.isArray(data.messages)) {
                return prev;
              }
              if (data.messages.length < prev.messages.length) {
                return prev;
              }
              if (
                data.messages.length === prev.messages.length &&
                prev.messages.length > 0 &&
                data.messages[data.messages.length - 1]?._id ===
                  prev.messages[prev.messages.length - 1]?._id
              ) {
                return prev;
              }
              return { ...prev, messages: data.messages };
            });
            setTimeout(() => {
              flatListRef.current?.scrollToEnd({ animated: true });
            }, 100);
          }
        }
      });
    }
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [selectedChat, firestoreDB]);

  useEffect(() => {
    if (!isChatModalVisible && chats.length > 0) {
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
            setChats((prevChats) =>
              prevChats
                .map((chat) => {
                  if (chat.chatID === docSnap.id) {
                    return {
                      ...chat,
                      latestMessage: lastMessage?.content || "",
                      latestTimestamp: lastMessage?.timestamp || "",
                      latestSenderId: lastMessage?.senderId || "",
                    };
                  }
                  return chat;
                })
                .sort((a, b) => {
                  const aTime = a.latestTimestamp
                    ? new Date(a.latestTimestamp).getTime()
                    : 0;
                  const bTime = b.latestTimestamp
                    ? new Date(b.latestTimestamp).getTime()
                    : 0;
                  return bTime - aTime;
                })
            );
            (async () => {
              try {
                const lastReadStr = await AsyncStorage.getItem(
                  `last_read_${docSnap.id}`
                );
                const lastRead = lastReadStr
                  ? new Date(lastReadStr).getTime()
                  : 0;
                const unreadCount = data.messages.filter(
                  (msg: Message) => new Date(msg.timestamp).getTime() > lastRead
                ).length;
                setChats((prevChats) =>
                  prevChats.map((chat) =>
                    chat.chatID === docSnap.id ? { ...chat, unreadCount } : chat
                  )
                );
              } catch (e) {
                console.error(
                  "Error computing unread count for chat",
                  docSnap.id,
                  e
                );
              }
            })();
          }
        });
      });
      return () => unsubscribe();
    }
  }, [
    isChatModalVisible,
    firestoreDB,
    chats.map((chat) => chat.chatID).join(","),
  ]);

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

  const openChat = async (chat: Chat) => {
    setLoading(true);
    try {
      setSelectedChat((prev) =>
        prev && prev.chatID === chat.chatID ? prev : { ...chat, messages: [] }
      );
      const messages = await getMessages(chat.chatID, token);
      setSelectedChat({ ...chat, messages });
      setChatModalVisible(true);
      setNewMessage("");
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
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
        if (lastMsg && lastMsg.timestamp) {
          await AsyncStorage.setItem(
            `last_read_${selectedChat.chatID}`,
            lastMsg.timestamp
          );
        }
      } catch (e) {
        console.error("Error saving last message or read time:", e);
      }
      setChats((prevChats) =>
        prevChats
          .map((chat) =>
            chat.chatID === updatedChat.chatID ? updatedChat : chat
          )
          .sort((a, b) => {
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
    const messageContent = newMessage.trim();
    const newMessageObj: Message = {
      _id: Date.now().toString(),
      senderId: userId,
      content: messageContent,
      timestamp: new Date().toISOString(),
    };
    setSelectedChat((prev) =>
      prev
        ? { ...prev, messages: [...(prev.messages || []), newMessageObj] }
        : prev
    );
    setNewMessage("");
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
    try {
      const chatDocRef = doc(firestoreDB, "chatRooms", selectedChat.chatID);
      await setDoc(
        chatDocRef,
        { messages: arrayUnion(newMessageObj) },
        { merge: true }
      );
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
      console.log("ImagePicker result:", result);

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        // 1. Immediately upload to Cloudinary
        const uploadedImageUrl = await uploadImageToCloudinary(asset.uri);
        // 2. Immediately send to Firestore as a message
        await sendImageMessage(uploadedImageUrl);
      }
    } catch (error) {
      console.error("Error picking image:", error);
      Alert.alert("Error", "An error occurred while selecting an image.");
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: false,
      quality: 0.7,
    });

    // If user canceled or assets array is empty, just return
    if (result.canceled || !result.assets || result.assets.length < 1) {
      console.log("User canceled or no image selected.");
      return;
    }

    // Otherwise, we have a valid image
    const selectedUri = result.assets[0].uri;
    console.log("Selected image URI:", selectedUri);
    // ...
  };

  const sendImageMessage = async (imageUrl: string) => {
    if (!selectedChat) return;
    const messageData = {
      _id: Date.now().toString(),
      senderId: userId,
      content: `[Image] ${imageUrl}`,
      timestamp: new Date().toISOString(),
    };
    const chatDocRef = doc(firestoreDB, "chatRooms", selectedChat.chatID);
    await setDoc(
      chatDocRef,
      { messages: arrayUnion(messageData) },
      { merge: true }
    );
  };

  const uploadImageToCloudinary = async (uri: string): Promise<string> => {
    if (!uri) {
      // If no URI is passed, throw an error immediately
      throw new Error("Cannot upload an empty URL");
    }

    setIsUploadingImage(true);
    try {
      // Log the original URI for debugging
      console.log("Original image URI:", uri);

      // Manipulate the image (resize/compress)
      const manipulatedImage = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 800 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
      );
      console.log("Manipulated image URI:", manipulatedImage.uri);

      // Prepare the FormData for the upload
      const formDataImage = new FormData();
      formDataImage.append("file", {
        uri: manipulatedImage.uri,
        type: "image/jpeg",
        name: `upload_${Date.now()}.jpg`,
      } as any);
      formDataImage.append("upload_preset", UPLOAD_PRESET);

      // Upload to Cloudinary
      const response = await axios.post(CLOUDINARY_URL, formDataImage, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      console.log("Cloudinary upload response:", response.data);

      // Return the secure_url from Cloudinary
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
      console.log("Image message sent successfully to Firestore.");
    } catch (error: any) {
      console.error("sendImageMessage error:", error);
      Alert.alert("Error", error.message || "Failed to send image.");
    } finally {
      setSelectedImageUri(null);
      setIsImagePreviewModalVisible(false);
      setSending(false);
    }
  };

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
      if (response.status === 200) {
        const { incomingRequests, outgoingRequests } = response.data;
        setIncomingRequests(incomingRequests as Request[]);
        setOutgoingRequests(outgoingRequests as Request[]);
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
        // Instead of Alert, show a custom popup
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
        // Instead of Alert, show a custom popup
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
        onPress={() => openChat(item)}
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
                {item.unreadCount && item.unreadCount > 0 ? (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadBadgeText}>
                      {item.unreadCount}
                    </Text>
                  </View>
                ) : null}
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
                {/* Create a small helper that checks if it's an image */}
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

  const renderMessage = ({ item }: { item: Message }) => {
    const isImageMessage = item.content.startsWith("[Image] ");
    const imageUri = isImageMessage
      ? item.content.replace("[Image] ", "")
      : null;
    const isCurrentUser = item.senderId === userId;
    return (
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
    );
  };

  // Function to delete a chat (triggered by the "X" button)
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
              // Make a DELETE request to your backend endpoint
              const response = await axios.delete(
                `https://thegridproduct-production.up.railway.app/chats/${selectedChat.chatID}`,
                {
                  headers: {
                    Authorization: `Bearer ${token}`,
                  },
                }
              );
              if (response.status === 200) {
                // Remove the chat from the local state
                setChats((prevChats) =>
                  prevChats.filter(
                    (chat) => chat.chatID !== selectedChat.chatID
                  )
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

  // Function to mark a product as sold (or gig as done) when check is tapped
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
              // Make a PUT request to update the status
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
                Alert.alert("Success", response.data.message);
                // Optionally, refresh your chat list or update UI to reflect changes
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
    setChatModalVisible(false);
    setTimeout(() => {
      setReportModalVisible(true);
    }, 300);
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
    const reportedUserId = selectedChat?.messages?.find(
      (msg) => msg.senderId !== userId
    )?.senderId;
    if (!selectedChat || !reportedUserId) {
      setIsSubmittingReport(false);
      setIsIncompletePopupVisible(true);
      return;
    }
    const finalReason =
      reportReason === "Other" ? customReason.trim() : reportReason;
    try {
      const response = await axios.post(
        `${NGROK_URL}/report`,
        {
          chatId: selectedChat.chatID,
          reporterUserId: userId,
          reportedUserId,
          reason: finalReason,
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
        setIsReportSuccessModalVisible(true);
        setTimeout(() => {
          setIsReportSuccessModalVisible(false);
        }, 3500);
      } else {
        throw new Error("Failed to submit report");
      }
    } catch (error) {
      console.error("Error submitting report:", error);
      setIsIncompletePopupVisible(true);
    } finally {
      setIsSubmittingReport(false);
    }
  };

  const renderRequestsModal = () => {
    if (isRequestsModalVisible) {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 250,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: Dimensions.get("window").height,
        duration: 250,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }).start();
    }

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
            <View style={styles.requestActions}></View>
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
        {/* Header Row with Title and Filter */}
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

        {/* Requests Modal */}
        {renderRequestsModal()}

        {/* Listings Section */}
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

        {/* Main Chats List */}
        {loading ? (
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

        {/* Chat Modal */}
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
                    <Pressable
                      onPress={handleBackFromChat}
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

                    {/* Report Button */}
                    <Pressable
                      onPress={handleReportPress}
                      style={styles.reportButton}
                      accessibilityLabel="Report User"
                    >
                      <Ionicons name="flag" size={24} color="#F08080" />
                    </Pressable>

                    {/* Product Chat Action Buttons (only for product chat rooms) */}
                    {selectedChat?.referenceType === "product" && (
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
                    )}
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

        {/* Report Modal */}
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

        {/* Report Success Modal */}
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

        {/* Custom Incomplete Details Popup */}
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

        {/* Custom Popup for Accept/Reject Request */}
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
    fontFamily: "HelveticaNeue-Medium",
    flex: 1,
    marginRight: 10,
  },
  timeContainer: {
    position: "relative",
    alignItems: "flex-end",
  },
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
  chatHeaderInfo: { flexDirection: "row", alignItems: "center", flex: 1 },
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
  requestSender: {
    fontSize: 14,
    color: "#FFFFFF",
    fontFamily: "HelveticaNeue-Medium",
    marginBottom: 4,
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
  smallActionButtonClose: {
    backgroundColor: "#E74C3C", // red for X button
  },
  smallActionButtonCheck: {
    backgroundColor: "#27AE60", // green for check mark button
  },
});
