// BottomNavBar.tsx

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Animated,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import {
  useNavigation,
  useRoute,
  NavigationProp,
} from "@react-navigation/native";
import { RootStackParamList } from "../navigationTypes";

type BottomNavBarProps = {
  firstName: string;
};

const BottomNavBar: React.FC<BottomNavBarProps> = ({ firstName }) => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const route = useRoute();
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [spinValue] = useState(new Animated.Value(0));
  const [scaleValue] = useState(new Animated.Value(1));

  const spinAnimation = Animated.loop(
    Animated.timing(spinValue, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: true,
    })
  );

  useEffect(() => {
    // Start the spin animation when the modal is visible
    if (isModalVisible) {
      spinAnimation.start();
    } else {
      spinAnimation.stop();
      spinValue.setValue(0); // Reset the spin animation
    }

    // Cleanup animation on unmount
    return () => {
      spinAnimation.stop();
    };
  }, [isModalVisible, spinAnimation, spinValue]);

  const toggleModal = () => {
    setIsModalVisible(!isModalVisible);
  };

  const handlePressIn = () => {
    Animated.spring(scaleValue, {
      toValue: 1.2,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleValue, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  // Determine the current route name
  const currentRouteName = route.name;

  // Helper function to check if a tab is active
  const isActive = (routeName: keyof RootStackParamList) => {
    return currentRouteName === routeName;
  };

  return (
    <View style={styles.container}>
      {/* Home Tab */}
      <TouchableOpacity
        style={styles.navItem}
        onPress={() => navigation.navigate("Dashboard")}
        accessibilityLabel="Navigate to Home"
      >
        <Ionicons
          name="home-outline"
          size={28} // Increased size for better visibility
          color={isActive("Dashboard") ? "#FFFFFF" : "#CCCCCC"}
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

      {/* Gigs Tab */}
      <TouchableOpacity
        style={styles.navItem}
        onPress={() => navigation.navigate("Gigs")}
        accessibilityLabel="Navigate to Gigs"
      >
        <Ionicons
          name="briefcase-outline"
          size={28} // Increased size
          color={isActive("Gigs") ? "#FFFFFF" : "#CCCCCC"}
        />
        <Text
          style={[styles.navText, isActive("Gigs") && styles.navTextActive]}
        >
          Gigs
        </Text>
      </TouchableOpacity>

      {/* Add Button */}
      <TouchableOpacity
        style={styles.navItem}
        onPress={toggleModal}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        accessibilityLabel="Add Product or Gig"
      >
        <Animated.View
          style={[
            styles.addButton,
            { transform: [{ scale: scaleValue }, { rotate: spin }] },
          ]}
        >
          <Ionicons name="arrow-up-outline" size={40} color="#FFFFFF" /> {/* Increased size */}
        </Animated.View>
      </TouchableOpacity>

      {/* Messaging Tab */}
      <TouchableOpacity
        style={styles.navItem}
        onPress={() => navigation.navigate("Messaging")}
        accessibilityLabel="Navigate to Messaging"
      >
        <Ionicons
          name="chatbubble-outline"
          size={28} // Increased size
          color={isActive("Messaging") ? "#FFFFFF" : "#CCCCCC"}
        />
        <Text
          style={[
            styles.navText,
            isActive("Messaging") && styles.navTextActive,
          ]}
        >
          Messaging
        </Text>
      </TouchableOpacity>

      {/* Activity Tab */}
      <TouchableOpacity
        style={styles.navItem}
        onPress={() => navigation.navigate("Activity", { firstName })}
        accessibilityLabel="Navigate to Activity"
      >
        <Ionicons
          name="stats-chart-outline"
          size={28} // Increased size
          color={isActive("Activity") ? "#FFFFFF" : "#CCCCCC"}
        />
        <Text
          style={[
            styles.navText,
            isActive("Activity") && styles.navTextActive,
          ]}
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
                accessibilityLabel="Add Gig"
              >
                <Text style={styles.modalButtonText}>Add Gig</Text>
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
    paddingVertical: 10, // Increased from 6 to make navbar taller
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
    justifyContent: "center",
    flex: 1,
  },
  navText: {
    fontSize: 12, // Increased from 10 for better readability
    color: "#CCCCCC",
    marginTop: 4, // Slightly increased for balance
    fontFamily: "System",
  },
  navTextActive: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  addButton: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#000000",
    borderRadius: 35, // Maintained to keep it circular
    padding: 6, // Increased from 4 to accommodate larger icon
    shadowColor: "#FFFFFF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 10,
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
    paddingVertical: 12, // Slightly increased for better touch targets
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
