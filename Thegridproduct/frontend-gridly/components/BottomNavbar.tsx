import React, { useState, useRef, useEffect, useContext } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Animated,
  Easing,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import {
  useNavigation,
  useRoute,
  NavigationProp,
  CommonActions,
} from "@react-navigation/native";
import { RootStackParamList } from "../navigationTypes";
import { UserContext } from "../UserContext";
import { NGROK_URL } from "@env";
import { fetchConversations } from "../api";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  getFirestore,
  collection,
  query,
  where,
  documentId,
  onSnapshot,
} from "firebase/firestore";

interface Gig {
  id: string;
  title: string;
  description: string;
  category: string;
  price: string;
  userId: string;
}

const BottomNavBar: React.FC = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const route = useRoute();
  const { token, userId } = useContext(UserContext);
  const [isModalVisible, setIsModalVisible] = useState(false);
  
  // NEW: State for total unread messages across all chats
  const [totalUnread, setTotalUnread] = useState<number>(0);

  // Animation for spinning the add button
  const spinValue = useRef(new Animated.Value(0)).current;
  const spinAnimation = useRef(
    Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    )
  ).current;

  useEffect(() => {
    if (isModalVisible) {
      spinAnimation.start();
    } else {
      spinAnimation.stop();
      spinValue.setValue(0);
    }
    return () => {
      spinAnimation.stop();
    };
  }, [isModalVisible, spinAnimation, spinValue]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const toggleModal = () => {
    setIsModalVisible(!isModalVisible);
  };

  const currentRouteName = route.name as keyof RootStackParamList;

  const isActive = (routeName: keyof RootStackParamList) => {
    return currentRouteName === routeName;
  };

  const switchScreen = (targetRoute: keyof RootStackParamList, params?: object) => {
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: targetRoute, params }],
      })
    );
  };

  const hitSlopValue = { top: 10, bottom: 10, left: 10, right: 10 };

  // Prefetch chats for Messaging tab
  const prefetchChats = async (): Promise<any[]> => {
    try {
      const chats = await fetchConversations(userId, token);
      return chats;
    } catch (error) {
      console.error("Error prefetching chats:", error);
      return [];
    }
  };

  // --- Prefetch function for Jobs ---
  const prefetchJobs = async (): Promise<Gig[]> => {
    try {
      const response = await fetch(`${NGROK_URL}/services`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch gigs: ${response.status}`);
      }
      const data = await response.json();
      if (data && Array.isArray(data.gigs)) {
        return data.gigs;
      } else if (Array.isArray(data)) {
        return data;
      } else {
        console.error("Invalid gigs data format:", data);
        return [];
      }
    } catch (error) {
      console.error(error);
      return [];
    }
  };

  // --- NEW: Setup a realtime listener to calculate total unread messages ---
  const firestoreDB = getFirestore();
  useEffect(() => {
    let unsubscribeFunc: (() => void) | undefined;
    const subscribeToUnread = async () => {
      try {
        // Fetch user's chats first
        const chats = await fetchConversations(userId, token);
        const chatIDs = chats.map((chat: any) => chat.chatID);
        if (chatIDs.length === 0) {
          setTotalUnread(0);
          return;
        }
        // Create a query to get chatRooms with the matching document IDs
        const q = query(
          collection(firestoreDB, "chatRooms"),
          where(documentId(), "in", chatIDs)
        );
        unsubscribeFunc = onSnapshot(q, async (snapshot) => {
          let total = 0;
          // For each chat document, compute the unread messages
          await Promise.all(
            snapshot.docs.map(async (docSnap) => {
              const data = docSnap.data();
              const messages = data.messages || [];
              // Get last read timestamp from AsyncStorage (if any)
              const lastReadStr = await AsyncStorage.getItem(`last_read_${docSnap.id}`);
              const lastRead = lastReadStr ? new Date(lastReadStr) : new Date(0);
              const unread = messages.filter((msg: any) => {
                if (!msg.timestamp) return false;
                const msgTime = new Date(msg.timestamp);
                return msgTime > lastRead && msg.senderId !== userId;
              }).length;
              total += unread;
            })
          );
          setTotalUnread(total);
        });
      } catch (error) {
        console.error("Error setting up unread count listener:", error);
      }
    };

    if (userId && token) {
      subscribeToUnread();
    }

    return () => {
      if (unsubscribeFunc) unsubscribeFunc();
    };
  }, [userId, token, firestoreDB]);

  return (
    <View style={styles.container}>
      {/* Home Tab */}
      <TouchableOpacity
        style={styles.navItem}
        onPress={() => {
          if (!isActive("Dashboard")) {
            setTimeout(() => {
              switchScreen("Dashboard");
            }, 50);
          }
        }}
        accessibilityLabel="Navigate to Home"
        hitSlop={hitSlopValue}
      >
        <Ionicons name={isActive("Dashboard") ? "home" : "home-outline"} size={24} color="#FFFFFF" />
        <Text style={[styles.navText, isActive("Dashboard") && styles.navTextActive]}>Home</Text>
      </TouchableOpacity>

      {/* Jobs Tab */}
      <TouchableOpacity
        style={styles.navItem}
        onPress={async () => {
          if (!isActive("Jobs")) {
            const gigs = await prefetchJobs();
            setTimeout(() => {
              switchScreen("Jobs", { preFetchedGigs: gigs });
            }, 10);
          }
        }}
        accessibilityLabel="Navigate to Jobs"
        hitSlop={hitSlopValue}
      >
        <Ionicons name={isActive("Jobs") ? "briefcase" : "briefcase-outline"} size={24} color="#FFFFFF" />
        <Text style={[styles.navText, isActive("Jobs") && styles.navTextActive]}>Jobs</Text>
      </TouchableOpacity>

      {/* Add Button */}
      <TouchableOpacity
        style={styles.navItem}
        onPress={toggleModal}
        accessibilityLabel="Add or Request Product"
        hitSlop={hitSlopValue}
      >
        <Animated.View style={[styles.addButton, { transform: [{ rotate: spin }] }]}>
          <Ionicons name="arrow-up-outline" size={30} color="#FFFFFF" />
        </Animated.View>
      </TouchableOpacity>

      {/* Messaging Tab – prefetch chats before switching */}
      <TouchableOpacity
        style={styles.navItem}
        onPress={async () => {
          if (!isActive("Messaging")) {
            const preFetchedChats = await prefetchChats();
            setTimeout(() => {
              switchScreen("Messaging", { preFetchedChats });
            }, 10);
          }
        }}
        accessibilityLabel="Navigate to Messaging"
        hitSlop={hitSlopValue}
      >
        <View style={{ position: "relative" }}>
          <Ionicons
            name={isActive("Messaging") ? "chatbubble" : "chatbubble-outline"}
            size={24}
            color="#FFFFFF"
          />
          {totalUnread > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>{totalUnread}</Text>
            </View>
          )}
        </View>
        <Text style={[styles.navText, isActive("Messaging") && styles.navTextActive]}>
          Messages
        </Text>
      </TouchableOpacity>

      {/* Activity Tab */}
      <TouchableOpacity
        style={styles.navItem}
        onPress={() => {
          if (!isActive("Activity")) {
            setTimeout(() => {
              switchScreen("Activity");
            }, 50);
          }
        }}
        accessibilityLabel="Navigate to Activity"
        hitSlop={hitSlopValue}
      >
        <Ionicons name={isActive("Activity") ? "stats-chart" : "stats-chart-outline"} size={24} color="#FFFFFF" />
        <Text style={[styles.navText, isActive("Activity") && styles.navTextActive]}>Activity</Text>
      </TouchableOpacity>

      {/* Modal for Add Options */}
      <Modal visible={isModalVisible} transparent animationType="fade" onRequestClose={toggleModal}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPressOut={toggleModal}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Options</Text>
            <View style={styles.modalButtonsContainer}>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => {
                  toggleModal();
                  navigation.navigate("AddProduct");
                }}
                accessibilityLabel="Add Product"
              >
                <Text style={styles.modalButtonText}>Add Product</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => {
                  toggleModal();
                  navigation.navigate("AddGig");
                }}
                accessibilityLabel="Add Job"
              >
                <Text style={styles.modalButtonText}>Add Job</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => {
                  toggleModal();
                  navigation.navigate("RequestProduct");
                }}
                accessibilityLabel="Request Product"
              >
                <Text style={styles.modalButtonText}>Request Product</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={toggleModal} style={styles.modalClose} accessibilityLabel="Close Add Options Modal">
              <Ionicons name="close-outline" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

export default BottomNavBar;

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingVertical: 10,
    backgroundColor: "#000000",
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderColor: "#000000",
    shadowColor: "#FFFFFF",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 10,
  },
  navItem: {
    alignItems: "center",
    justifyContent: "flex-end",
    flex: 1,
    paddingBottom: 6,
  },
  navText: {
    fontSize: 10,
    color: "#CCCCCC",
    marginTop: 2,
    fontFamily: "System",
    marginBottom: 15,
  },
  navTextActive: {
    fontWeight: "600",
  },
  addButton: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#000000",
    borderRadius: 30,
    padding: 4,
    shadowColor: "#FFFFFF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 10,
    marginBottom: 18.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.8)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: "80%",
    backgroundColor: "#1A1A1A",
    padding: 25,
    borderRadius: 20,
    alignItems: "center",
    position: "relative",
    shadowColor: "#FFFFFF",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 20,
  },
  modalButtonsContainer: {
    width: "100%",
    flexDirection: "column",
    justifyContent: "space-between",
    marginTop: 10,
  },
  modalButton: {
    backgroundColor: "#FFFFFF",
    paddingVertical: 12,
    borderRadius: 12,
    marginVertical: 8,
    width: "100%",
    alignItems: "center",
    shadowColor: "#FFFFFF",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 5,
  },
  modalButtonText: {
    color: "#000000",
    fontSize: 15,
    fontWeight: "600",
  },
  modalClose: {
    position: "absolute",
    top: 15,
    right: 15,
  },
  // Badge styles for unread count on Messaging icon:
  unreadBadge: {
    position: "absolute",
    top: -4,
    right: -10,
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  unreadBadgeText: {
    color: "#000000",
    fontSize: 10,
    fontWeight: "bold",
    textAlign: "center",
  },
});
