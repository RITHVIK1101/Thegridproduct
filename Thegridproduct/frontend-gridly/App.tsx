// App.tsx
import React, { useState, useEffect, useContext, useRef } from "react";
import {
  AppState,
  TouchableOpacity,
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Dimensions,
  Animated,
  Easing,
  Alert,
  Platform,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialIcons";
import UserProfileScreen from "./UserProfileScreen";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "react-native-vector-icons/Ionicons";

import ProductDetailScreen from "./ProductDetailScreen";
import { NavigationContainer } from "@react-navigation/native";
import { Image } from "react-native";
import * as Device from "expo-device";
import UserAvatar from "./UserAvatar";
import UserMenuScreen from "./UserMenu";

import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createStackNavigator,
  StackNavigationOptions,
} from "@react-navigation/stack";
import useChatListener from "./useChatListener";
import { StripeProvider } from "@stripe/stripe-react-native";
import { UserProvider, UserContext } from "./UserContext";
import PaymentScreen from "./PaymentScreen";
import SplashScreen from "./SplashScreen";
import LoginScreen from "./LoginScreen";
import Dashboard from "./Dashboard";
import AddProductScreen from "./AddProductScreen";
import AddGigScreen from "./AddGigScreen";
import JobsScreen from "./JobsScreen";
import ActivityScreen from "./ActivityScreen";
import EditProduct from "./EditProductScreen";
import MessagingScreen from "./MessagingScreen";
import CartScreen from "./CartScreen";
import GetInTouch from "./getintouch";
import AccountScreen from "./AccountScreen";
import JobDetails from "./JobDetails";
import RequestProduct from "./RequestProduct";
import RequestedProductsPage from "./requestedProductsPage";
import DemoScreen from "./DemoScreen"; // New demo screen
import { RootStackParamList } from "./navigationTypes";
import TermsOfServiceContent from "./TermsOfServiceContent";
import VerificationScreen from "./VerificationScreen";

// New In-App Notification Component (make sure this file exists with the provided code)
import InAppNotification from "./InAppNotification";

// -------------------
// Push Notification Setup (Expo)
// -------------------
Notifications.setNotificationHandler({
  handleNotification: async () => {
    const appState = await AsyncStorage.getItem("appState");
    const isAppInForeground = appState === "active";
    return {
      shouldShowAlert: !isAppInForeground,
      shouldPlaySound: !isAppInForeground,
      shouldSetBadge: !isAppInForeground,
    };
  },
});

/**
 * Requests notification permission, retrieves the Expo push token,
 * saves it locally, and sends it to the backend.
 */
async function requestPermissionAndGetToken(
  userId: string,
  userType: string,
  token: string
): Promise<void> {
  if (!Device.isDevice) {
    console.log("Push notifications require a physical device.");
    return;
  }

  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== "granted") {
    Alert.alert("Permission required", "Please enable notifications.");
    return;
  }

  try {
    const expoPushTokenResponse = await Notifications.getExpoPushTokenAsync();
    console.log("Expo Push Token:", expoPushTokenResponse.data);

    // Save the token locally
    await AsyncStorage.setItem("expoPushToken", expoPushTokenResponse.data);

    // Send token to backend
    await fetch(
      "https://thegridproduct-production.up.railway.app/user/push-token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "X-User-Type": userType,
        },
        body: JSON.stringify({
          userId,
          expoPushToken: expoPushTokenResponse.data,
        }),
      }
    );
    console.log("Push token sent to backend.");
  } catch (error) {
    console.error("Error getting or sending Expo push token:", error);
  }
}

/**
 * Component to set up push notifications using the UserContext.
 */
const PushNotificationSetup: React.FC = () => {
  const { userId, token, studentType } = useContext(UserContext);

  useEffect(() => {
    if (userId && token && studentType) {
      requestPermissionAndGetToken(userId, studentType, token);
    }
  }, [userId, token, studentType]);

  return null;
};

// Define LikedItemsScreen if not already defined elsewhere
const LikedItemsScreen: React.FC = () => {
  const { favorites, allProducts } = useContext<any>(UserContext);
  const likedProducts =
    allProducts?.filter((p: any) => favorites?.includes(p.id)) || [];

  return (
    <View style={styles.screenContainer}>
      <Text style={styles.likedTitle}>Liked Items</Text>
      {likedProducts.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No liked items yet.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.likedScroll}>
          {likedProducts.map((product: any) => (
            <View key={product.id} style={styles.likedItem}>
              <Text style={styles.likedItemTitle}>{product.title}</Text>
              <Text style={styles.likedItemPrice}>
                ${product.price.toFixed(2)}
              </Text>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
};

export const navigationRef = React.createRef();
const Stack = createStackNavigator<RootStackParamList>();

const HeaderTitleWithLogo: React.FC<{ title: string }> = ({ title }) => {
  const bounceAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(bounceAnim, {
          toValue: 1.1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(bounceAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [bounceAnim]);

  return (
    <View style={styles.headerTitleContainer}>
      <Animated.Image
        source={require("./assets/logonobg.png")}
        style={[
          {
            width: 35,
            height: 35,
            marginRight: 8,
            transform: [{ scale: bounceAnim }],
          },
        ]}
        resizeMode="contain"
      />
      <Text style={styles.headerTitleText}>{title}</Text>
    </View>
  );
};

const HeaderRightComponent = (
  navigation: any,
  firstName?: string,
  lastName?: string,
  profilePic?: string
) => (
  <View style={styles.headerRightContainer}>
    <TouchableOpacity
      onPress={() => navigation.navigate("Cart")}
      style={styles.headerIcon}
      accessibilityLabel="Go to Cart"
    >
      <Ionicons name="bag" size={26} color="#FFFFFF" />
    </TouchableOpacity>
    <UserAvatar
      firstName={firstName}
      lastName={lastName}
      profilePic={profilePic}
      onPress={() => navigation.navigate("UserMenu")}
    />
  </View>
);

const getHeaderOptions = (
  navigation: any,
  firstName?: string,
  lastName?: string,
  profilePic?: string,
  showBackButton: boolean = false,
  enableAnimation: boolean = false
): StackNavigationOptions => ({
  headerTitle: () => <HeaderTitleWithLogo title="Gridly" />,
  headerRight: () =>
    HeaderRightComponent(navigation, firstName, lastName, profilePic),
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

interface AppNavigatorProps {
  firstRender: boolean;
}

const AppNavigator: React.FC<AppNavigatorProps> = ({ firstRender }) => {
  // Include profilePic from UserContext
  const { token, firstName, lastName, profilePic, isLoading } =
    useContext(UserContext);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FFFFFF" />
      </View>
    );
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: "#000000",
          shadowOpacity: 0,
          elevation: 0,
        },
        headerTintColor: "#FFFFFF",
        headerTitleStyle: { fontWeight: "700", color: "#FFFFFF" },
        animationEnabled: false,
      }}
    >
      {token ? (
        <>
          <Stack.Screen
            name="Dashboard"
            component={Dashboard}
            options={({ navigation }) => ({
              headerTransparent: true,
              headerTitle: () => <HeaderTitleWithLogo title="Gridly" />,
              headerRight: () =>
                HeaderRightComponent(
                  navigation,
                  firstName,
                  lastName,
                  profilePic ?? undefined
                ),
            })}
          />
          <Stack.Screen
            name="Jobs"
            component={JobsScreen}
            options={({ navigation }) =>
              getHeaderOptions(
                navigation,
                firstName,
                lastName,
                profilePic ?? undefined
              )
            }
          />
          <Stack.Screen
            name="AddProduct"
            component={AddProductScreen}
            options={({ navigation }) =>
              getHeaderOptions(
                navigation,
                firstName,
                lastName,
                profilePic ?? undefined,
                true,
                true
              )
            }
          />
          <Stack.Screen
            name="UserProfile"
            component={UserProfileScreen}
            options={({ navigation }) =>
              getHeaderOptions(
                navigation,
                firstName,
                lastName,
                profilePic ?? undefined,
                true, // show back button
                true // enable animation
              )
            }
          />

          <Stack.Screen
            name="AddGig"
            component={AddGigScreen}
            options={({ navigation }) =>
              getHeaderOptions(
                navigation,
                firstName,
                lastName,
                profilePic ?? undefined,
                true,
                true
              )
            }
          />
          <Stack.Screen
            name="Activity"
            component={ActivityScreen}
            options={({ navigation }) =>
              getHeaderOptions(
                navigation,
                firstName,
                lastName,
                profilePic ?? undefined
              )
            }
          />
          <Stack.Screen
            name="EditProduct"
            component={EditProduct}
            options={({ navigation }) =>
              getHeaderOptions(
                navigation,
                firstName,
                lastName,
                profilePic ?? undefined,
                true,
                true
              )
            }
          />
          <Stack.Screen
            name="Messaging"
            component={MessagingScreen}
            options={({ navigation }) =>
              getHeaderOptions(
                navigation,
                firstName,
                lastName,
                profilePic ?? undefined
              )
            }
          />
          <Stack.Screen
            name="ProductDetail"
            component={ProductDetailScreen}
            options={({ navigation }) =>
              getHeaderOptions(
                navigation,
                firstName,
                lastName,
                profilePic ?? undefined,
                true,
                true
              )
            }
          />

          <Stack.Screen
            name="Cart"
            component={CartScreen}
            options={({ navigation }) =>
              getHeaderOptions(
                navigation,
                firstName,
                lastName,
                profilePic ?? undefined,
                true,
                true
              )
            }
          />
          <Stack.Screen
            name="GetInTouch"
            component={GetInTouch}
            options={({ navigation }) =>
              getHeaderOptions(
                navigation,
                firstName,
                lastName,
                profilePic ?? undefined,
                true,
                true
              )
            }
          />
          <Stack.Screen
            name="Account"
            component={AccountScreen}
            options={({ navigation }) =>
              getHeaderOptions(
                navigation,
                firstName,
                lastName,
                profilePic ?? undefined,
                true,
                true
              )
            }
          />
          <Stack.Screen
            name="UserMenu"
            component={UserMenuScreen}
            options={{
              headerShown: false,
              presentation: "transparentModal",
              animationEnabled: false,
            }}
          />
          <Stack.Screen
            name="TermsOfService"
            component={TermsOfServiceContent}
            options={({ navigation }) =>
              getHeaderOptions(
                navigation,
                firstName,
                lastName,
                profilePic ?? undefined,
                true,
                true
              )
            }
          />
          <Stack.Screen
            name="LikedItems"
            component={LikedItemsScreen}
            options={({ navigation }) =>
              getHeaderOptions(
                navigation,
                firstName,
                lastName,
                profilePic ?? undefined,
                true,
                true
              )
            }
          />
          <Stack.Screen
            name="JobDetail"
            component={JobDetails}
            options={({ navigation }) =>
              getHeaderOptions(
                navigation,
                firstName,
                lastName,
                profilePic ?? undefined,
                true,
                true
              )
            }
          />
          <Stack.Screen
            name="RequestProduct"
            component={RequestProduct}
            options={({ navigation }) =>
              getHeaderOptions(
                navigation,
                firstName,
                lastName,
                profilePic ?? undefined,
                true,
                true
              )
            }
          />
          <Stack.Screen
            name="RequestedProductsPage"
            component={RequestedProductsPage}
            options={({ navigation }) =>
              getHeaderOptions(
                navigation,
                firstName,
                lastName,
                profilePic ?? undefined,
                true,
                true
              )
            }
          />
        </>
      ) : (
        <>
          {!firstRender ? (
            <>
              <Stack.Screen
                name="Login"
                component={LoginScreen}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="Verification"
                component={VerificationScreen}
                options={{ headerShown: false }}
              />
            </>
          ) : (
            <>
              <Stack.Screen
                name="Demo"
                component={DemoScreen}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="Login"
                component={LoginScreen}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="Verification"
                component={VerificationScreen}
                options={{ headerShown: false }}
              />
            </>
          )}
        </>
      )}
    </Stack.Navigator>
  );
};

const App: React.FC = () => {
  useChatListener();
  const [showSplash, setShowSplash] = useState(true);
  const [firstRender, setFirstRender] = useState(true);

  const handleSplashEnd = () => {
    setShowSplash(false);
  };

  // Track app state and store it in AsyncStorage
  useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      AsyncStorage.setItem("appState", nextAppState);
    };

    const appStateListener = AppState.addEventListener(
      "change",
      handleAppStateChange
    );

    return () => {
      appStateListener.remove();
    };
  }, []);

  return (
    <UserProvider>
      {/* Setup push notifications */}
      <PushNotificationSetup />
      {/* In-App Notification component */}
      <InAppNotification />
      {showSplash ? (
        <SplashScreen onAnimationEnd={handleSplashEnd} />
      ) : (
        <StripeProvider
          publishableKey="pk_test_51QQZb9Fg2PIykDNlba9E7bVR9EFKxmaS9F1mjlOXFb0meJuXTG5nWy1vYHBIIlWPwiheNa37T1snKDN2Urzs2Jwx00ywvbvMGE"
          merchantIdentifier="merchant.com.yourapp"
        >
          <NavigationContainer
            ref={navigationRef as any}
            onStateChange={() => {
              if (firstRender) {
                setFirstRender(false);
              }
            }}
          >
            <AppNavigator firstRender={firstRender} />
          </NavigationContainer>
        </StripeProvider>
      )}
    </UserProvider>
  );
};

export default App;

const { width } = Dimensions.get("window");

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000000",
  },
  screenContainer: {
    flex: 1,
    backgroundColor: "#000",
  },
  termsScreenContainer: {
    flex: 1,
    backgroundColor: "#000",
    padding: 20,
  },
  termsHeading: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 20,
  },
  termsScroll: {
    flexGrow: 1,
  },
  termsText: {
    color: "#ccc",
    fontSize: 16,
    lineHeight: 24,
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
    marginRight: 20,
  },
  headerIcon: {
    marginRight: 15,
  },
  headerLeftButton: {
    paddingLeft: 15,
  },
  userAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#6f42c1",
    justifyContent: "center",
    alignItems: "center",
  },
  userAvatarText: {
    color: "#FFF",
    fontWeight: "700",
    fontSize: 14,
  },
  fullScreenMenuContainer: {
    flex: 1,
    backgroundColor: "#000000",
  },
  fullScreenMenuHeader: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
  },
  fullScreenMenuContent: {
    flex: 1,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  bottomSheetUserInfo: {
    alignItems: "center",
    marginBottom: 20,
  },
  bottomSheetAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#8a2be2",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  bottomSheetAvatarText: {
    color: "#FFF",
    fontWeight: "700",
    fontSize: 24,
  },
  bottomSheetUserName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  bottomSheetUserInstitution: {
    fontSize: 14,
    color: "#CCCCCC",
    marginTop: 5,
  },
  bottomSheetOptions: {
    marginTop: 20,
    width: "100%",
  },
  bottomSheetOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 15,
    borderBottomColor: "#333333",
    borderBottomWidth: 1,
  },
  bottomSheetOptionText: {
    color: "#FFFFFF",
    fontSize: 16,
  },
  likedTitle: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 20,
    textAlign: "center",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
  emptyText: {
    color: "#ccc",
    fontSize: 16,
  },
  likedScroll: {
    padding: 20,
  },
  likedItem: {
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
    paddingBottom: 10,
  },
  likedItemTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
  likedItemPrice: {
    color: "#fff",
    fontSize: 16,
  },
});
