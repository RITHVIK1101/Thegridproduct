// BottomNavBar.tsx

import React, { useState, useRef, useEffect } from "react";
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

const BottomNavBar: React.FC = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const route = useRoute();
  const [isModalVisible, setIsModalVisible] = useState(false);

  // Animation value for spinning the add button
  const spinValue = useRef(new Animated.Value(0)).current;

  // Define the spinning animation
  const spinAnimation = useRef(
    Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 1000, // 1 second for a full rotation
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
      spinValue.setValue(0); // Reset rotation
    }

    // Cleanup on unmount
    return () => {
      spinAnimation.stop();
    };
  }, [isModalVisible, spinAnimation, spinValue]);

  // Interpolate spinValue to rotate from 0deg to 360deg
  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const toggleModal = () => {
    setIsModalVisible(!isModalVisible);
  };

  // Determine the current route name
  const currentRouteName = route.name as keyof RootStackParamList;

  // Helper function to check if a tab is active
  const isActive = (routeName: keyof RootStackParamList) => {
    return currentRouteName === routeName;
  };

  // Use reset to instantly switch without stacking or transitions
  const switchScreen = (targetRoute: keyof RootStackParamList) => {
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: targetRoute }],
      })
    );
  };

  // Reduced hitSlop values for smaller touchable areas
  const hitSlopValue = { top: 10, bottom: 10, left: 10, right: 10 };

  return (
    <View style={styles.container}>
      {/* Home Tab */}
      <TouchableOpacity
        style={styles.navItem}
        onPress={() => switchScreen("Dashboard")}
        accessibilityLabel="Navigate to Home"
        hitSlop={hitSlopValue}
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
        onPress={() => switchScreen("Jobs")}
        accessibilityLabel="Navigate to Jobs"
        hitSlop={hitSlopValue}
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
        hitSlop={hitSlopValue}
      >
        <Animated.View style={[styles.addButton, { transform: [{ rotate: spin }] }]}>
          <Ionicons name="arrow-up-outline" size={30} color="#FFFFFF" />
        </Animated.View>
      </TouchableOpacity>

      {/* Messaging Tab */}
      <TouchableOpacity
        style={styles.navItem}
        onPress={() => switchScreen("Messaging")}
        accessibilityLabel="Navigate to Messaging"
        hitSlop={hitSlopValue}
      >
        <Ionicons
          name={isActive("Messaging") ? "chatbubble" : "chatbubble-outline"}
          size={24}
          color="#FFFFFF"
        />
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
        onPress={() => switchScreen("Activity")}
        accessibilityLabel="Navigate to Activity"
        hitSlop={hitSlopValue}
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
              {/* Instead of resetting the stack, we navigate so that the back button works */}
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
                accessibilityLabel="Add Gig"
              >
                <Text style={styles.modalButtonText}>Add Job</Text>
              </TouchableOpacity>
              {/* New Request Product Button */}
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
});
