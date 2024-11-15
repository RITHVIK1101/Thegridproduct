// App.tsx

import React, { useState, createRef, useContext, useEffect } from "react";
import {
  NavigationContainer,
  NavigationContainerRef,
} from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import {
  TouchableOpacity,
  View,
  Text,
  Modal,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialIcons";
import SplashScreen from "./SplashScreen";
import Ionicons from "react-native-vector-icons/Ionicons";

import LoginScreen from "./LoginScreen";
import Dashboard from "./Dashboard";
import AddProductScreen from "./AddProductScreen";
import AddGigScreen from "./AddGigScreen";
import ActivityScreen from "./ActivityScreen";
import EditProduct from "./EditProductScreen";
import MessagingScreen from "./MessagingScreen";
// import CartScreen from "./CartScreen"; // No routing needed for Cart Icon
import { RootStackParamList } from "./navigationTypes";
import { UserProvider, UserContext } from "./UserContext"; // Import UserContext

export const navigationRef =
  createRef<NavigationContainerRef<RootStackParamList>>();

const Stack = createStackNavigator<RootStackParamList>();

const AppNavigator: React.FC = () => {
  const [modalVisible, setModalVisible] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  const { userId, token, clearUser, isLoading } = useContext(UserContext); // Access UserContext including isLoading

  /**
   * Handles user logout by clearing context and SecureStore,
   * then navigating to the Login screen.
   */
  const handleLogout = async () => {
    setModalVisible(false);
    try {
      await clearUser(); // Clear user data from context and storage
      Alert.alert("Logout Successful", "You have been logged out.");
      navigationRef.current?.reset({
        index: 0,
        routes: [{ name: "Login" }],
      });
    } catch (error) {
      console.error("Logout Error:", error);
      Alert.alert("Logout Error", "Failed to log out. Please try again.");
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#BB86FC" />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator
        screenOptions={{
          headerStyle: {
            backgroundColor: "#1E1E1E", // Dark header background
            shadowOpacity: 0, // Remove shadow on iOS
            elevation: 0, // Remove shadow on Android
          },
          headerTintColor: "#fff", // Header text color
          headerTitleStyle: {
            fontWeight: "700",
            color: "#BB86FC", // Purple title
          },
        }}
      >
        {token ? (
          // Authenticated screens
          <>
            <Stack.Screen
              name="Dashboard"
              component={Dashboard}
              options={{
                headerLeft: () => (
                  <TouchableOpacity
                    onPress={() => setModalVisible(true)}
                    style={{ marginLeft: 10 }}
                    accessibilityLabel="Open Options Modal"
                  >
                    <Icon name="person" size={30} color="#fff" />
                  </TouchableOpacity>
                ),
                headerRight: () => (
                  <Ionicons
                    name="cart-outline"
                    size={28}
                    color="#fff"
                    style={{ marginRight: 15 }}
                    accessibilityLabel="Cart Icon"
                  />
                ),
                headerTitle: "The Gridly",
                gestureEnabled: false,
              }}
            />
            <Stack.Screen
              name="AddProduct"
              component={AddProductScreen}
              options={({ navigation }) => ({
                headerLeft: () => (
                  <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={{ paddingLeft: 15 }}
                    accessibilityLabel="Go Back"
                  >
                    <Icon name="arrow-back" size={24} color="#fff" />
                  </TouchableOpacity>
                ),
                headerTitle: "Add Product",
                headerRight: () => (
                  <Ionicons
                    name="cart-outline"
                    size={28}
                    color="#fff"
                    style={{ marginRight: 15 }}
                    accessibilityLabel="Cart Icon"
                  />
                ),
              })}
            />
            <Stack.Screen
              name="AddGig"
              component={AddGigScreen}
              options={({ navigation }) => ({
                headerLeft: () => (
                  <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={{ paddingLeft: 15 }}
                    accessibilityLabel="Go Back"
                  >
                    <Icon name="arrow-back" size={24} color="#fff" />
                  </TouchableOpacity>
                ),
                headerTitle: "Add Gig",
                headerRight: () => (
                  <Ionicons
                    name="cart-outline"
                    size={28}
                    color="#fff"
                    style={{ marginRight: 15 }}
                    accessibilityLabel="Cart Icon"
                  />
                ),
              })}
            />
            <Stack.Screen
              name="Activity"
              component={ActivityScreen}
              options={{
                headerLeft: () => (
                  <TouchableOpacity
                    onPress={() => setModalVisible(true)}
                    style={{ marginLeft: 10 }}
                    accessibilityLabel="Open Options Modal"
                  >
                    <Icon name="person" size={30} color="#fff" />
                  </TouchableOpacity>
                ),
                headerRight: () => (
                  <Ionicons
                    name="cart-outline"
                    size={28}
                    color="#fff"
                    style={{ marginRight: 15 }}
                    accessibilityLabel="Cart Icon"
                  />
                ),
                headerTitle: "The Gridly",
                headerStyle: {
                  backgroundColor: "#1E1E1E", // Dark header background
                  shadowOpacity: 0, // Remove shadow on iOS
                  elevation: 0, // Remove shadow on Android
                },
                headerTintColor: "#fff", // Header text color
                headerTitleStyle: {
                  fontWeight: "700",
                  color: "#BB86FC", // Purple title
                },
              }}
            />
            {/* Add EditProduct Screen */}
            <Stack.Screen
              name="EditProduct"
              component={EditProduct}
              options={({ navigation }) => ({
                headerLeft: () => (
                  <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={{ paddingLeft: 15 }}
                    accessibilityLabel="Go Back"
                  >
                    <Icon name="arrow-back" size={24} color="#fff" />
                  </TouchableOpacity>
                ),
                headerTitle: "Edit Product",
                headerRight: () => (
                  <Ionicons
                    name="cart-outline"
                    size={28}
                    color="#fff"
                    style={{ marginRight: 15 }}
                    accessibilityLabel="Cart Icon"
                  />
                ),
                headerStyle: {
                  backgroundColor: "#1E1E1E", // Consistent header style
                  shadowOpacity: 0,
                  elevation: 0,
                },
                headerTintColor: "#fff",
                headerTitleStyle: {
                  fontWeight: "700",
                  color: "#BB86FC",
                },
              })}
            />
            {/* Add the Messaging Screen */}
            <Stack.Screen
              name="Messaging"
              component={MessagingScreen}
              options={{
                headerLeft: () => (
                  <TouchableOpacity
                    onPress={() => setModalVisible(true)}
                    style={{ marginLeft: 10 }}
                    accessibilityLabel="Open Options Modal"
                  >
                    <Icon name="person" size={30} color="#fff" />
                  </TouchableOpacity>
                ),
                headerRight: () => (
                  <Ionicons
                    name="cart-outline"
                    size={28}
                    color="#fff"
                    style={{ marginRight: 15 }}
                    accessibilityLabel="Cart Icon"
                  />
                ),
                headerTitle: "Messaging",
                gestureEnabled: false,
              }}
            />
          </>
        ) : (
          // Unauthenticated screens
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{ headerShown: false }}
          />
        )}
      </Stack.Navigator>

      {/* Modal for options */}
      <Modal
        transparent={true}
        visible={modalVisible}
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <TouchableOpacity
              onPress={() => setModalVisible(false)}
              style={styles.closeButton}
              accessibilityLabel="Close Options Modal"
            >
              <Icon name="close" size={24} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleLogout}
              style={styles.option}
              accessibilityLabel="Logout"
            >
              <Text style={styles.optionText}>Logout</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setShowTerms(true);
                setModalVisible(false);
              }}
              style={styles.option}
              accessibilityLabel="View Terms of Service"
            >
              <Text style={styles.optionText}>View Terms of Service</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal for Terms of Service */}
      <Modal
        transparent={true}
        visible={showTerms}
        animationType="slide"
        onRequestClose={() => setShowTerms(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.termsContent}>
            <TouchableOpacity
              onPress={() => setShowTerms(false)}
              style={styles.closeButton}
              accessibilityLabel="Close Terms Modal"
            >
              <Icon name="close" size={24} color="#fff" />
            </TouchableOpacity>
            <ScrollView>
              <Text style={styles.termsText}>
                Terms of Service: {"\n\n"}Welcome to The Gridly. By using our
                platform, you agree to the following terms... [Add more terms
                here as needed for your service.]
              </Text>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </NavigationContainer>
  );
};

const App: React.FC = () => {
  const [showSplash, setShowSplash] = useState(true);

  /**
   * Handles the end of the splash screen animation.
   */
  const handleSplashEnd = () => {
    setShowSplash(false);
  };

  return (
    <UserProvider>
      {showSplash ? (
        <SplashScreen onAnimationEnd={handleSplashEnd} />
      ) : (
        <AppNavigator />
      )}
    </UserProvider>
  );
};

export default App;

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#121212",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)", // Darker overlay
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#1E1E1E", // Dark modal background
    padding: 20,
    borderRadius: 10,
    width: "80%",
    position: "relative",
  },
  closeButton: {
    position: "absolute",
    top: 10,
    right: 10,
  },
  option: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#424242", // Dark grey border
  },
  optionText: {
    fontSize: 16,
    color: "#fff", // White text
  },
  termsContent: {
    backgroundColor: "#1E1E1E", // Dark modal background
    padding: 20,
    borderRadius: 10,
    width: "90%",
    height: "80%",
    position: "relative",
  },
  termsText: {
    fontSize: 14,
    color: "#ccc", // Light grey text
  },
});
