// App.tsx

import React, { useState, useContext } from "react";
import {
  NavigationContainer,
  NavigationContainerRef,
  CommonActions,
} from "@react-navigation/native";
import { createStackNavigator, StackNavigationOptions } from "@react-navigation/stack";
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
import PaymentScreen from "./PaymentScreen";
import SplashScreen from "./SplashScreen";
import LoginScreen from "./LoginScreen";
import Dashboard from "./Dashboard";
import AddProductScreen from "./AddProductScreen";
import AddGigScreen from "./AddGigScreen";
import ActivityScreen from "./ActivityScreen";
import EditProduct from "./EditProductScreen";
import MessagingScreen from "./MessagingScreen";
import CartScreen from "./CartScreen";
import AccountScreen from "./AccountScreen";
import { RootStackParamList } from "./navigationTypes";
import { UserProvider, UserContext } from "./UserContext";
import { StripeProvider } from "@stripe/stripe-react-native";

export const navigationRef =
  React.createRef<NavigationContainerRef<RootStackParamList>>();

const Stack = createStackNavigator<RootStackParamList>();

/**
 * Custom Header Title Component with Logo and Text
 */
const HeaderTitleWithLogo: React.FC<{ title: string }> = ({ title }) => (
  <View style={styles.headerTitleContainer}>
    <Ionicons name="grid-outline" size={20} color="#FFFFFF" />
    <Text style={styles.headerTitleText}>{title}</Text>
  </View>
);

/**
 * Common header right component
 */
const HeaderRightComponent = (
  modalVisibleSetter: React.Dispatch<React.SetStateAction<boolean>>
) => (
  <View style={styles.headerRightContainer}>
    <TouchableOpacity
      onPress={() => navigationRef.current?.navigate("Cart")}
      style={styles.headerIcon}
      accessibilityLabel="Go to Cart"
    >
      <Ionicons name="cart-outline" size={28} color="#FFFFFF" />
    </TouchableOpacity>
    <TouchableOpacity
      onPress={() => modalVisibleSetter(true)}
      style={styles.headerIcon}
      accessibilityLabel="Open Options Modal"
    >
      <Icon name="more-vert" size={24} color="#FFFFFF" />
    </TouchableOpacity>
  </View>
);

/**
 * Helper function to generate common header options
 * @param navigation The navigation prop provided by React Navigation
 * @param setModalVisible Function to toggle the options modal
 * @param showBackButton Boolean to determine if a back button should be displayed
 * @param enableAnimation Boolean to determine if screen animations should be enabled
 */
const getHeaderOptions = (
  navigation: any,
  setModalVisible: React.Dispatch<React.SetStateAction<boolean>>,
  showBackButton: boolean = false,
  enableAnimation: boolean = false
): StackNavigationOptions => ({
  headerTitle: () => <HeaderTitleWithLogo title="The Gridly" />,
  headerRight: () => HeaderRightComponent(setModalVisible),
  headerLeft: showBackButton
    ? () => (
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.headerLeftButton}
          accessibilityLabel="Go Back"
        >
          <Icon name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      )
    : undefined,
  animationEnabled: enableAnimation,
});

const AppNavigator: React.FC = () => {
  const [modalVisible, setModalVisible] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  const { userId, token, clearUser, isLoading } = useContext(UserContext);

  /**
   * Handles user logout
   */
  const handleLogout = async () => {
    setModalVisible(false);
    try {
      await clearUser();
      Alert.alert("Logout Successful", "You have been logged out.");
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
        <ActivityIndicator size="large" color="#FFFFFF" />
      </View>
    );
  }

  return (
    <StripeProvider
      publishableKey="pk_live_51QQZb9Fg2PIykDNlxiX04AYjLnow7r1p0WCLBBFn2Q8eafoY1GJmzkBqcDL8KYUj3yEu2nw5oNUj7X8mfyOm8MOa009Sq3WAX3"
      merchantIdentifier="merchant.com.yourapp"
    >
      <NavigationContainer ref={navigationRef}>
        <Stack.Navigator
          screenOptions={{
            headerStyle: {
              backgroundColor: "#000000",
              shadowOpacity: 0,
              elevation: 0,
            },
            headerTintColor: "#FFFFFF",
            headerTitleStyle: {
              fontWeight: "700",
              color: "#FFFFFF",
            },
            // Disable animations globally for instant navigation
            animationEnabled: false,
          }}
        >
          {token ? (
            <>
              <Stack.Screen
                name="Dashboard"
                component={Dashboard}
                options={({ navigation }) =>
                  getHeaderOptions(navigation, setModalVisible)
                }
              />
              <Stack.Screen
                name="AddProduct"
                component={AddProductScreen}
                options={({ navigation }) =>
                  getHeaderOptions(navigation, setModalVisible, true, true)
                }
              />
              <Stack.Screen
                name="AddGig"
                component={AddGigScreen}
                options={({ navigation }) =>
                  getHeaderOptions(navigation, setModalVisible, true, true)
                }
              />
              <Stack.Screen
                name="Activity"
                component={ActivityScreen}
                options={({ navigation }) =>
                  getHeaderOptions(navigation, setModalVisible)
                }
              />
              <Stack.Screen
                name="EditProduct"
                component={EditProduct}
                options={({ navigation }) =>
                  getHeaderOptions(navigation, setModalVisible, true, true)
                }
              />
              <Stack.Screen
                name="Messaging"
                component={MessagingScreen}
                options={({ navigation }) =>
                  getHeaderOptions(navigation, setModalVisible)
                }
              />
              <Stack.Screen
                name="Cart"
                component={CartScreen}
                options={({ navigation }) =>
                  getHeaderOptions(navigation, setModalVisible, true, true)
                }
              />
              <Stack.Screen
                name="Payment"
                component={PaymentScreen}
                options={({ navigation }) =>
                  getHeaderOptions(navigation, setModalVisible, true, true)
                }
              />
              <Stack.Screen
                name="Account"
                component={AccountScreen}
                options={({ navigation }) =>
                  getHeaderOptions(navigation, setModalVisible, true, true)
                }
              />
            </>
          ) : (
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
                <Icon name="close" size={24} color="#FFFFFF" />
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
                <Icon name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>
              <ScrollView>
                <Text style={styles.termsText}>
                  Terms of Service: {"\n\n"}Welcome to The Gridly. By using our
                  platform, you agree to the following terms...
                  {"\n\n"}
                  {/* Add more detailed terms as needed */}
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nulla
                  facilisi. Phasellus non urna nec sapien dictum luctus.
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
    backgroundColor: "#000000",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#000000",
    padding: 20,
    borderRadius: 10,
    width: "80%",
    position: "relative",
  },
  termsContent: {
    backgroundColor: "#000000",
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
    borderBottomColor: "#424242",
  },
  optionText: {
    fontSize: 16,
    color: "#FFFFFF",
  },
  termsText: {
    fontSize: 14,
    color: "#FFFFFF",
  },
  headerTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerTitleText: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
    marginLeft: 5,
  },
  headerRightContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerIcon: {
    marginLeft: 15,
  },
  headerLeftButton: {
    paddingLeft: 15,
  },
});
