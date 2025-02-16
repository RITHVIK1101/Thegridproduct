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

  const switchScreen = (
    targetRoute: keyof RootStackParamList,
    params?: object
  ) => {
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: targetRoute, params }],
      })
    );
  };

  const fetchUnreadMessagesCount = async () => {
    try {
      const response = await fetch(
        `${NGROK_URL}/messages/unread-count/${userId}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok)
        throw new Error("Failed to fetch unread messages count");

      const data = await response.json();
      setTotalUnread(data.unreadCount || 0);
    } catch (error) {
      console.error("Error fetching unread messages count:", error);
    }
  };

  useEffect(() => {
    const fetchUnreadMessagesCount = async () => {
      try {
        const response = await fetch(
          `${NGROK_URL}/messages/unread-count/${userId}`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          }
        );
        if (!response.ok)
          throw new Error("Failed to fetch unread messages count");
        const data = await response.json();
        setTotalUnread(data.unreadCount || 0);
      } catch (error) {
        console.error("Error fetching unread messages count:", error);
      }
    };

    fetchUnreadMessagesCount();
    const intervalId = setInterval(fetchUnreadMessagesCount, 10000); // Refresh every 10 seconds
    return () => clearInterval(intervalId);
  }, [userId, token]);

  return (
    <View style={styles.container}>
      {/* Home Tab */}
      <TouchableOpacity
        style={styles.navItem}
        onPress={() => !isActive("Dashboard") && switchScreen("Dashboard")}
        accessibilityLabel="Navigate to Home"
      >
        <Ionicons
          name={isActive("Dashboard") ? "home" : "home-outline"}
          size={24}
          color="#FFFFFF"
        />
        <Text
          style={[
            styles.navText,
            isActive("Dashboard") && styles.navTextActive,
          ]}
        >
          Home
        </Text>
      </TouchableOpacity>

      {/* Jobs Tab */}
      <TouchableOpacity
        style={styles.navItem}
        onPress={() => !isActive("Jobs") && switchScreen("Jobs")}
        accessibilityLabel="Navigate to Jobs"
      >
        <Ionicons
          name={isActive("Jobs") ? "briefcase" : "briefcase-outline"}
          size={24}
          color="#FFFFFF"
        />
        <Text
          style={[styles.navText, isActive("Jobs") && styles.navTextActive]}
        >
          Jobs
        </Text>
      </TouchableOpacity>

      {/* Add Button */}
      <TouchableOpacity
        style={styles.navItem}
        onPress={toggleModal}
        accessibilityLabel="Add or Request Product"
      >
        <Animated.View
          style={[styles.addButton, { transform: [{ rotate: spin }] }]}
        >
          <Ionicons name="add-outline" size={30} color="#FFFFFF" />
        </Animated.View>
      </TouchableOpacity>

      {/* Messaging Tab with Unread Badge */}
      <TouchableOpacity
        style={styles.navItem}
        onPress={() => !isActive("Messaging") && switchScreen("Messaging")}
        accessibilityLabel="Navigate to Messaging"
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
        <Text
          style={[
            styles.navText,
            isActive("Messaging") && styles.navTextActive,
          ]}
        >
          Messages
        </Text>
      </TouchableOpacity>

      {/* Activity Tab */}
      <TouchableOpacity
        style={styles.navItem}
        onPress={() => !isActive("Activity") && switchScreen("Activity")}
        accessibilityLabel="Navigate to Activity"
      >
        <Ionicons
          name={isActive("Activity") ? "stats-chart" : "stats-chart-outline"}
          size={24}
          color="#FFFFFF"
        />
        <Text
          style={[styles.navText, isActive("Activity") && styles.navTextActive]}
        >
          Activity
        </Text>
      </TouchableOpacity>
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
    flex: 1,
    paddingBottom: 6,
  },
  navText: {
    fontSize: 10,
    color: "#CCCCCC",
    marginTop: 2,
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
  },
  unreadBadge: {
    position: "absolute",
    top: -5,
    right: -8,
    backgroundColor: "red",
    borderRadius: 12,
    paddingHorizontal: 5,
    paddingVertical: 2,
    minWidth: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  unreadBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "bold",
  },
});
