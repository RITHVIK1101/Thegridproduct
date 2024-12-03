// App.tsx

import React, { useState, useContext } from "react";
import {
  NavigationContainer,
  NavigationContainerRef,
  CommonActions,
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
import Ionicons from "react-native-vector-icons/Ionicons";
import PaymentScreen from "./PaymentScreen"; // Import PaymentScreen
import SplashScreen from "./SplashScreen";
import LoginScreen from "./LoginScreen";
import Dashboard from "./Dashboard";
import AddProductScreen from "./AddProductScreen";
import AddGigScreen from "./AddGigScreen";
import ActivityScreen from "./ActivityScreen";

import EditProduct from "./EditProductScreen";
import MessagingScreen from "./MessagingScreen";
import CartScreen from "./CartScreen"; // Import CartScreen
import AccountScreen from "./AccountScreen"; // If you have an edit account screen
import { StackNavigationOptions } from "@react-navigation/stack";

import { RootStackParamList } from "./navigationTypes";
import { UserProvider, UserContext } from "./UserContext"; // Import UserContext
import { StripeProvider } from "@stripe/stripe-react-native"; // Import StripeProvider

export const navigationRef =
  React.createRef<NavigationContainerRef<RootStackParamList>>();

const Stack = createStackNavigator<RootStackParamList>();

/**
 * Custom Header Title Component with Logo and Text
 * Aligned to the left side of the header.
 */
const HeaderTitleWithLogo: React.FC<{ title: string }> = ({ title }) => (
  <View style={styles.headerTitleContainer}>
    <Ionicons name="grid-outline" size={20} color="#FFFFFF" />{" "}
    {/* Changed color to white */}
    <Text style={styles.headerTitleText}>{title}</Text>
  </View>
);

// Common header options to reduce redundancy
const commonHeaderOptions: StackNavigationOptions = {
  headerStyle: {
    backgroundColor: "#1E1E1E", // Dark header background
    shadowOpacity: 0,
    elevation: 0,
  },
  headerTintColor: "#fff", // Header text color
  headerTitleStyle: {
    fontWeight: "700",
    color: "#BB86FC", // Purple title
  },
  headerRight: () => (
    <TouchableOpacity
      onPress={() => navigationRef.current?.navigate("Cart")}
      style={{ marginRight: 15 }}
      accessibilityLabel="Go to Cart"
    >
      <Ionicons name="cart-outline" size={28} color="#fff" />
      {/* Optional: Add a badge for cart items count */}
      {/* <View style={styles.cartBadge}>
        <Text style={styles.cartBadgeText}>{cartItemCount}</Text>
      </View> */}
    </TouchableOpacity>
  ),
};

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
      await clearUser();
      Alert.alert("Logout Successful", "You have been logged out.");

      // Use optional chaining safely
      if (navigationRef.current) {
        navigationRef.current.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [{ name: "Login" }],
          })
        );
      }
    } catch (error) {
      console.error("Logout Error:", error);
      Alert.alert("Logout Error", "Failed to log out. Please try again.");
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FFFFFF" />{" "}
        {/* Changed color to white */}
      </View>
    );
  }

  return (
    <StripeProvider
      publishableKey="pk_live_51QQZb9Fg2PIykDNlxiX04AYjLnow7r1p0WCLBBFn2Q8eafoY1GJmzkBqcDL8KYUj3yEu2nw5oNUj7X8mfyOm8MOa009Sq3WAX3" // Replace with your actual Stripe publishable key
      merchantIdentifier="merchant.com.yourapp" // Required for Apple Pay (replace with your merchant identifier)
    >
      <NavigationContainer ref={navigationRef}>
        <Stack.Navigator
          screenOptions={{
            headerStyle: {
              backgroundColor: "#000000", // Changed to pure black
              shadowOpacity: 0, // Remove shadow on iOS
              elevation: 0, // Remove shadow on Android
            },
            headerTintColor: "#FFFFFF", // Changed to white for header text and icons
            headerTitleStyle: {
              fontWeight: "700",
              color: "#FFFFFF", // Changed title color to white
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
                  headerTitle: () => <HeaderTitleWithLogo title="The Gridly" />, // Custom header title with logo aligned left
                  headerRight: () => (
                    <View style={styles.headerRightContainer}>
                      {/* Cart Icon */}
                      <TouchableOpacity
                        onPress={() => navigationRef.current?.navigate("Cart")}
                        style={styles.headerIcon}
                        accessibilityLabel="Go to Cart"
                      >
                        <Ionicons
                          name="cart-outline"
                          size={28}
                          color="#FFFFFF"
                        />
                        {/* Optional: Add a badge for cart items count */}
                        {/* <View style={styles.cartBadge}>
                          <Text style={styles.cartBadgeText}>{cartItemCount}</Text>
                        </View> */}
                      </TouchableOpacity>
                      {/* Three Dots Icon */}
                      <TouchableOpacity
                        onPress={() => setModalVisible(true)}
                        style={styles.headerIcon}
                        accessibilityLabel="Open Options Modal"
                      >
                        <Icon name="more-vert" size={24} color="#FFFFFF" />{" "}
                        {/* Replaced person icon with three dots */}
                      </TouchableOpacity>
                    </View>
                  ),
                  gestureEnabled: false,
                }}
              />
              <Stack.Screen
                name="AddProduct"
                component={AddProductScreen}
                options={({ navigation }) => ({
                  headerTitle: "Add Product",
                  headerTitleAlign: "left", // Ensure title is aligned left
                  headerRight: () => (
                    <View style={styles.headerRightContainer}>
                      {/* Cart Icon */}
                      <TouchableOpacity
                        onPress={() => navigationRef.current?.navigate("Cart")}
                        style={styles.headerIcon}
                        accessibilityLabel="Go to Cart"
                      >
                        <Ionicons
                          name="cart-outline"
                          size={28}
                          color="#FFFFFF"
                        />
                      </TouchableOpacity>
                      {/* Three Dots Icon */}
                      <TouchableOpacity
                        onPress={() => setModalVisible(true)}
                        style={styles.headerIcon}
                        accessibilityLabel="Open Options Modal"
                      >
                        <Icon name="more-vert" size={24} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                  ),
                  headerLeft: () => null, // Remove default back button
                  headerStyle: {
                    backgroundColor: "#000000", // Consistent header style
                  },
                  headerTintColor: "#FFFFFF",
                  headerTitleStyle: {
                    fontWeight: "700",
                    color: "#FFFFFF",
                  },
                })}
              />
              <Stack.Screen
                name="AddGig"
                component={AddGigScreen}
                options={({ navigation }) => ({
                  headerTitle: "Add Gig",
                  headerTitleAlign: "left",
                  headerRight: () => (
                    <View style={styles.headerRightContainer}>
                      {/* Cart Icon */}
                      <TouchableOpacity
                        onPress={() => navigationRef.current?.navigate("Cart")}
                        style={styles.headerIcon}
                        accessibilityLabel="Go to Cart"
                      >
                        <Ionicons
                          name="cart-outline"
                          size={28}
                          color="#FFFFFF"
                        />
                      </TouchableOpacity>
                      {/* Three Dots Icon */}
                      <TouchableOpacity
                        onPress={() => setModalVisible(true)}
                        style={styles.headerIcon}
                        accessibilityLabel="Open Options Modal"
                      >
                        <Icon name="more-vert" size={24} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                  ),
                  headerLeft: () => null, // Remove default back button
                  headerStyle: {
                    backgroundColor: "#000000",
                  },
                  headerTintColor: "#FFFFFF",
                  headerTitleStyle: {
                    fontWeight: "700",
                    color: "#FFFFFF",
                  },
                })}
              />
              <Stack.Screen
                name="Activity"
                component={ActivityScreen}
                options={{
                  headerTitle: "The Gridly", // You can customize as needed
                  headerTitleAlign: "left",
                  headerRight: () => (
                    <View style={styles.headerRightContainer}>
                      {/* Cart Icon */}
                      <TouchableOpacity
                        onPress={() => navigationRef.current?.navigate("Cart")}
                        style={styles.headerIcon}
                        accessibilityLabel="Go to Cart"
                      >
                        <Ionicons
                          name="cart-outline"
                          size={28}
                          color="#FFFFFF"
                        />
                      </TouchableOpacity>
                      {/* Three Dots Icon */}
                      <TouchableOpacity
                        onPress={() => setModalVisible(true)}
                        style={styles.headerIcon}
                        accessibilityLabel="Open Options Modal"
                      >
                        <Icon name="more-vert" size={24} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                  ),
                  headerStyle: {
                    backgroundColor: "#000000",
                  },
                  headerTintColor: "#FFFFFF",
                  headerTitleStyle: {
                    fontWeight: "700",
                    color: "#FFFFFF",
                  },
                  gestureEnabled: false,
                }}
              />
              {/* Add EditProduct Screen */}
              <Stack.Screen
                name="EditProduct"
                component={EditProduct}
                options={({ navigation }) => ({
                  headerTitle: "Edit Product",
                  headerTitleAlign: "left",
                  headerRight: () => (
                    <View style={styles.headerRightContainer}>
                      {/* Cart Icon */}
                      <TouchableOpacity
                        onPress={() => navigationRef.current?.navigate("Cart")}
                        style={styles.headerIcon}
                        accessibilityLabel="Go to Cart"
                      >
                        <Ionicons
                          name="cart-outline"
                          size={28}
                          color="#FFFFFF"
                        />
                      </TouchableOpacity>
                      {/* Three Dots Icon */}
                      <TouchableOpacity
                        onPress={() => setModalVisible(true)}
                        style={styles.headerIcon}
                        accessibilityLabel="Open Options Modal"
                      >
                        <Icon name="more-vert" size={24} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                  ),
                  headerLeft: () => null, // Remove default back button
                  headerStyle: {
                    backgroundColor: "#000000",
                  },
                  headerTintColor: "#FFFFFF",
                  headerTitleStyle: {
                    fontWeight: "700",
                    color: "#FFFFFF",
                  },
                })}
              />
              {/* Add the Messaging Screen */}
              <Stack.Screen
                name="Messaging"
                component={MessagingScreen}
                options={{
                  headerTitle: "Messaging",
                  headerTitleAlign: "left",
                  headerRight: () => (
                    <View style={styles.headerRightContainer}>
                      {/* Cart Icon */}
                      <TouchableOpacity
                        onPress={() => navigationRef.current?.navigate("Cart")}
                        style={styles.headerIcon}
                        accessibilityLabel="Go to Cart"
                      >
                        <Ionicons
                          name="cart-outline"
                          size={28}
                          color="#FFFFFF"
                        />
                      </TouchableOpacity>
                      {/* Three Dots Icon */}
                      <TouchableOpacity
                        onPress={() => setModalVisible(true)}
                        style={styles.headerIcon}
                        accessibilityLabel="Open Options Modal"
                      >
                        <Icon name="more-vert" size={24} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                  ),
                  headerStyle: {
                    backgroundColor: "#000000",
                  },
                  headerTintColor: "#FFFFFF",
                  headerTitleStyle: {
                    fontWeight: "700",
                    color: "#FFFFFF",
                  },
                  gestureEnabled: false,
                }}
              />
              {/* Add CartScreen to the Stack */}
              <Stack.Screen
                name="Cart"
                component={CartScreen}
                options={{
                  headerTitle: "Your Cart",
                  headerTitleAlign: "left",
                  headerRight: () => (
                    <View style={styles.headerRightContainer}>
                      {/* Three Dots Icon */}
                      <TouchableOpacity
                        onPress={() => setModalVisible(true)}
                        style={styles.headerIcon}
                        accessibilityLabel="Open Options Modal"
                      >
                        <Icon name="more-vert" size={24} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                  ),
                  headerLeft: () => (
                    <TouchableOpacity
                      onPress={() => navigationRef.current?.goBack()}
                      style={{ paddingLeft: 15 }}
                      accessibilityLabel="Go Back"
                    >
                      <Icon name="arrow-back" size={24} color="#FFFFFF" />
                    </TouchableOpacity>
                  ),
                  headerStyle: {
                    backgroundColor: "#000000",
                  },
                  headerTintColor: "#FFFFFF",
                  headerTitleStyle: {
                    fontWeight: "700",
                    color: "#FFFFFF",
                  },
                }}
              />
              {/* Add PaymentScreen to the Stack */}
              <Stack.Screen
                name="Payment"
                component={PaymentScreen}
                options={({ navigation }) => ({
                  headerTitle: "Payment",
                  headerTitleAlign: "left",
                  headerRight: () => (
                    <View style={styles.headerRightContainer}>
                      {/* Cart Icon */}
                      <TouchableOpacity
                        onPress={() => navigationRef.current?.navigate("Cart")}
                        style={styles.headerIcon}
                        accessibilityLabel="Go to Cart"
                      >
                        <Ionicons
                          name="cart-outline"
                          size={28}
                          color="#FFFFFF"
                        />
                      </TouchableOpacity>
                      {/* Three Dots Icon */}
                      <TouchableOpacity
                        onPress={() => setModalVisible(true)}
                        style={styles.headerIcon}
                        accessibilityLabel="Open Options Modal"
                      >
                        <Icon name="more-vert" size={24} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                  ),
                  headerLeft: () => (
                    <TouchableOpacity
                      onPress={() => navigation.goBack()}
                      style={{ paddingLeft: 15 }}
                      accessibilityLabel="Go Back"
                    >
                      <Icon name="arrow-back" size={24} color="#fff" />
                    </TouchableOpacity>
                  ),
                  headerTitle: "Payment",
                  // headerRight is already defined in commonHeaderOptions
                })}
              />
              {/* Add AccountScreen to the Stack */}
              <Stack.Screen
                name="Account"
                component={AccountScreen}
                options={{
                  headerTitle: "My Account",
                  headerTitleAlign: "left",
                  headerRight: () => (
                    <View style={styles.headerRightContainer}>
                      {/* Cart Icon */}
                      <TouchableOpacity
                        onPress={() => navigationRef.current?.navigate("Cart")}
                        style={styles.headerIcon}
                        accessibilityLabel="Go to Cart"
                      >
                        <Ionicons
                          name="cart-outline"
                          size={28}
                          color="#FFFFFF"
                        />
                      </TouchableOpacity>
                      {/* Three Dots Icon */}
                      <TouchableOpacity
                        onPress={() => setModalVisible(true)}
                        style={styles.headerIcon}
                        accessibilityLabel="Open Options Modal"
                      >
                        <Icon name="more-vert" size={24} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                  ),
                  headerLeft: () => (
                    <TouchableOpacity
                      onPress={() => navigationRef.current?.goBack()}
                      style={{ paddingLeft: 15 }}
                      accessibilityLabel="Go Back"
                    >
                      <Icon name="arrow-back" size={24} color="#FFFFFF" />
                    </TouchableOpacity>
                  ),
                  headerStyle: {
                    backgroundColor: "#000000",
                  },
                  headerTintColor: "#FFFFFF",
                  headerTitleStyle: {
                    fontWeight: "700",
                    color: "#FFFFFF",
                  },
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
                <Icon name="close" size={24} color="#FFFFFF" />{" "}
                {/* Changed color to white */}
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

              <TouchableOpacity
                onPress={() => {
                  setModalVisible(false);
                  navigationRef.current?.navigate("Account");
                }}
                style={styles.option}
                accessibilityLabel="Go to My Account"
              >
                <Text style={styles.optionText}>My Account</Text>
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
                <Icon name="close" size={24} color="#FFFFFF" />{" "}
                {/* Changed color to white */}
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
    </StripeProvider>
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
    backgroundColor: "#000000", // Changed to pure black
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)", // Darker overlay
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#000000", // Changed to pure black for modal background
    padding: 20,
    borderRadius: 10,
    width: "80%",
    position: "relative",
  },
  termsContent: {
    backgroundColor: "#000000", // Changed to pure black for terms modal background
    padding: 20,
    borderRadius: 10,
    width: "90%",
    height: "80%",
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
    borderBottomColor: "#424242", // Dark grey border remains for separation
  },
  optionText: {
    fontSize: 16,
    color: "#FFFFFF", // Changed to white text
  },
  termsText: {
    fontSize: 14,
    color: "#FFFFFF", // Changed to white text for better contrast
  },
  cartBadge: {
    position: "absolute",
    right: -6,
    top: -3,
    backgroundColor: "#FF3B30",
    borderRadius: 8,
    width: 16,
    height: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  cartBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "bold",
  },
  headerTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerTitleText: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF", // Changed to white
    marginLeft: 5, // Space between icon and text
  },
  headerRightContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerIcon: {
    marginLeft: 15, // Space between icons
  },
});
