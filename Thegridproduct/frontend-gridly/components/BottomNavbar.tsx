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
      >
        <Ionicons
          name="home-outline"
          size={28}
          color={isActive("Dashboard") ? "#BB86FC" : "#fff"}
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
      >
        <Ionicons
          name="briefcase-outline"
          size={28}
          color={isActive("Gigs") ? "#BB86FC" : "#fff"}
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
      >
        <Animated.View
          style={[
            styles.addButton,
            { transform: [{ scale: scaleValue }, { rotate: spin }] },
          ]}
        >
          <Ionicons name="add-circle" size={56} color="#BB86FC" />
        </Animated.View>
      </TouchableOpacity>

      {/* Messaging Tab */}
      <TouchableOpacity
        style={styles.navItem}
        onPress={() => navigation.navigate("Messaging")}
      >
        <Ionicons
          name="chatbubble-outline"
          size={28}
          color={isActive("Messaging") ? "#BB86FC" : "#fff"}
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
      >
        <Ionicons
          name="stats-chart-outline"
          size={28}
          color={isActive("Activity") ? "#BB86FC" : "#fff"}
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
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Options</Text>
            <View style={styles.modalButtonsContainer}>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => {
                  toggleModal();
                  navigation.navigate("AddProduct");
                }}
              >
                <Text style={styles.modalButtonText}>Add Product</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => {
                  toggleModal();
                  navigation.navigate("AddGig");
                }}
              >
                <Text style={styles.modalButtonText}>Add Gig</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={toggleModal} style={styles.modalClose}>
              <Ionicons name="close-outline" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
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
    backgroundColor: "#121212",
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderColor: "#424242",
  },
  navItem: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
  navText: {
    fontSize: 10,
    color: "#fff",
    marginTop: 2,
  },
  navTextActive: {
    color: "#BB86FC",
    fontWeight: "600",
  },
  addButton: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1E1E1E",
    borderRadius: 50,
    padding: 5,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: "80%",
    backgroundColor: "#1E1E1E",
    padding: 20,
    borderRadius: 15,
    alignItems: "center",
    position: "relative",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#BB86FC",
    marginBottom: 15,
  },
  modalButtonsContainer: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },
  modalButton: {
    backgroundColor: "#BB86FC",
    paddingVertical: 10,
    borderRadius: 10,
    marginVertical: 5,
    flex: 1,
    marginHorizontal: 5,
    alignItems: "center",
  },
  modalButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "500",
  },
  modalClose: {
    position: "absolute",
    top: 10,
    right: 10,
  },
});
