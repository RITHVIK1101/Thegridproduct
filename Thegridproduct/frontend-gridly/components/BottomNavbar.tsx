// BottomNavBar.tsx
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
  const { token, userId, unreadCount } = useContext(UserContext);

  const [isModalVisible, setIsModalVisible] = useState(false);

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
          Gigs
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
          {unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
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

      {/* Modal for Add Options */}
      <Modal
        visible={isModalVisible}
        transparent
        animationType="fade"
        onRequestClose={toggleModal}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPressOut={toggleModal}
        >
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
            <TouchableOpacity
              onPress={toggleModal}
              style={styles.modalClose}
              accessibilityLabel="Close Add Options Modal"
            >
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
});
