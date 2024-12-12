import React, { useState, useContext } from "react";
import {
  TouchableOpacity,
  View,
  Text,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  Dimensions
} from "react-native";
import Icon from "react-native-vector-icons/MaterialIcons";
import Ionicons from "react-native-vector-icons/Ionicons";
import { NavigationContainer, CommonActions } from "@react-navigation/native";
import {
  createStackNavigator,
  StackNavigationOptions,
} from "@react-navigation/stack";
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
import AccountScreen from "./AccountScreen";

// Placeholder for AllOrdersScreen
const AllOrdersScreen: React.FC = () => (
  <View style={[styles.screenContainer, { justifyContent: 'center', alignItems: 'center' }]}>
    <Text style={{ color: "#fff", fontSize: 18 }}>All Orders coming soon!</Text>
  </View>
);

// Terms of Service Screen
const TermsOfServiceScreen: React.FC = () => (
  <View style={styles.termsScreenContainer}>
    <Text style={styles.termsHeading}>Terms of Service</Text>
    <ScrollView style={styles.termsScroll}>
      <Text style={styles.termsText}>
        Welcome to Gridly. By using our platform, you agree to the following terms...
        {"\n\n"}
        Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nulla facilisi.
        Phasellus non urna nec sapien dictum luctus.
      </Text>
    </ScrollView>
  </View>
);

// User Menu Screen
const UserMenuScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { clearUser, firstName, lastName, institution, studentType } = useContext(UserContext);

  const handleLogout = async () => {
    try {
      await clearUser();
      Alert.alert("Logout Successful", "You have been logged out.");
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: "Login" }],
        })
      );
    } catch (error) {
      console.error("Logout Error:", error);
      Alert.alert("Logout Error", "Failed to log out. Please try again.");
    }
  };

  return (
    <View style={styles.bottomSheetOverlay}>
      <View style={styles.bottomSheetContainer}>
        <View style={styles.bottomSheetHeader}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            accessibilityLabel="Close User Menu"
          >
            <Ionicons name="close" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.bottomSheetContent}>
          {/* User Info Section */}
          <View style={styles.bottomSheetUserInfo}>
            <View style={styles.bottomSheetAvatar}>
              <Text style={styles.bottomSheetAvatarText}>
                {firstName && firstName.length > 0 ? firstName.charAt(0).toUpperCase() : "?"}
              </Text>
            </View>
            <Text style={styles.bottomSheetUserName}>
              {firstName} {lastName}
            </Text>
            {institution && (
              <Text style={styles.bottomSheetUserInstitution}>{institution}</Text>
            )}
            {studentType && (
              <Text style={styles.bottomSheetUserInstitution}>
                {studentType.charAt(0).toUpperCase() + studentType.slice(1)}
              </Text>
            )}
          </View>

          <View style={styles.bottomSheetOptions}>
            <TouchableOpacity style={styles.bottomSheetOption} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={20} color="#FFFFFF" style={{ marginRight: 10 }} />
              <Text style={styles.bottomSheetOptionText}>Logout</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.bottomSheetOption}
              onPress={() => navigation.navigate("TermsOfService")}
            >
              <Ionicons name="document-text-outline" size={20} color="#FFFFFF" style={{ marginRight: 10 }} />
              <Text style={styles.bottomSheetOptionText}>View Terms of Service</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.bottomSheetOption}
              onPress={() => navigation.navigate("Account")}
            >
              <Ionicons name="person-circle-outline" size={20} color="#FFFFFF" style={{ marginRight: 10 }} />
              <Text style={styles.bottomSheetOptionText}>My Account</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.bottomSheetOption}
              onPress={() => navigation.navigate("AllOrders")}
            >
              <Ionicons name="reader-outline" size={20} color="#FFFFFF" style={{ marginRight: 10 }} />
              <Text style={styles.bottomSheetOptionText}>All Orders</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
};

export const navigationRef = React.createRef();

type RootStackParamList = {
  Dashboard: undefined;
  Jobs: undefined;
  AddProduct: undefined;
  AddGig: undefined;
  Activity: undefined;
  EditProduct: undefined;
  Messaging: { chatId?: string } | undefined;
  Cart: undefined;
  Payment: undefined;
  Account: undefined;
  Login: undefined;
  UserMenu: undefined;
  TermsOfService: undefined;
  AllOrders: undefined;
};

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
 * Custom Avatar Component showing the first letter of user's first name
 */
const UserAvatar: React.FC<{
  firstName?: string;
  onPress: () => void;
}> = ({ firstName, onPress }) => {
  const initial = firstName && firstName.length > 0 ? firstName.charAt(0).toUpperCase() : "?";
  return (
    <TouchableOpacity
      onPress={onPress}
      style={styles.userAvatar}
      accessibilityLabel="Open User Menu"
    >
      <Text style={styles.userAvatarText}>{initial}</Text>
    </TouchableOpacity>
  );
};

/**
 * Common header right component
 */
const HeaderRightComponent = (
  navigation: any,
  firstName?: string
) => (
  <View style={styles.headerRightContainer}>
    <TouchableOpacity
      onPress={() => navigation.navigate("Cart")}
      style={styles.headerIcon}
      accessibilityLabel="Go to Cart"
    >
      <Ionicons name="cart-outline" size={26} color="#FFFFFF" />
    </TouchableOpacity>
    <UserAvatar firstName={firstName} onPress={() => navigation.navigate("UserMenu")} />
  </View>
);

/**
 * Helper function to generate common header options
 */
const getHeaderOptions = (
  navigation: any,
  firstName?: string,
  showBackButton: boolean = false,
  enableAnimation: boolean = false
): StackNavigationOptions => ({
  headerTitle: () => <HeaderTitleWithLogo title="Gridly" />,
  headerRight: () => HeaderRightComponent(navigation, firstName),
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

const Stack = createStackNavigator<RootStackParamList>();

const AppNavigator: React.FC = () => {
  const { token, isLoading, firstName } = useContext(UserContext);

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
        headerTitleStyle: {
          fontWeight: "700",
          color: "#FFFFFF",
        },
        animationEnabled: false,
      }}
    >
      {token ? (
        <>
          <Stack.Screen
            name="Dashboard"
            component={Dashboard}
            options={({ navigation }) => getHeaderOptions(navigation, firstName)}
          />
          <Stack.Screen
            name="Jobs"
            component={JobsScreen}
            options={({ navigation }) => getHeaderOptions(navigation, firstName)}
          />
          <Stack.Screen
            name="AddProduct"
            component={AddProductScreen}
            options={({ navigation }) =>
              getHeaderOptions(navigation, firstName, true, true)
            }
          />
          <Stack.Screen
            name="AddGig"
            component={AddGigScreen}
            options={({ navigation }) =>
              getHeaderOptions(navigation, firstName, true, true)
            }
          />
          <Stack.Screen
            name="Activity"
            component={ActivityScreen}
            options={({ navigation }) => getHeaderOptions(navigation, firstName)}
          />
          <Stack.Screen
            name="EditProduct"
            component={EditProduct}
            options={({ navigation }) =>
              getHeaderOptions(navigation, firstName, true, true)
            }
          />
          <Stack.Screen
            name="Messaging"
            component={MessagingScreen}
            options={({ navigation }) => getHeaderOptions(navigation, firstName)}
          />
          <Stack.Screen
            name="Cart"
            component={CartScreen}
            options={({ navigation }) =>
              getHeaderOptions(navigation, firstName, true, true)
            }
          />
          <Stack.Screen
            name="Payment"
            component={PaymentScreen}
            options={({ navigation }) =>
              getHeaderOptions(navigation, firstName, true, true)
            }
          />
          <Stack.Screen
            name="Account"
            component={AccountScreen}
            options={({ navigation }) =>
              getHeaderOptions(navigation, firstName, true, true)
            }
          />
          <Stack.Screen
            name="UserMenu"
            component={UserMenuScreen}
            options={{
              headerShown: false,
              presentation: 'transparentModal',
              animationEnabled: true
            }}
          />
          <Stack.Screen
            name="TermsOfService"
            component={TermsOfServiceScreen}
            options={({ navigation }) =>
              getHeaderOptions(navigation, firstName, true, true)
            }
          />
          <Stack.Screen
            name="AllOrders"
            component={AllOrdersScreen}
            options={({ navigation }) =>
              getHeaderOptions(navigation, firstName, true, true)
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
        <StripeProvider
          publishableKey="pk_test_51QQZb9Fg2PIykDNlba9E7bVR9EFKxmaS9F1mjlOXFb0meJuXTG5nWy1vYHBIIlWPwiheNa37T1snKDN2Urzs2Jwx00ywvbvMGE"
          merchantIdentifier="merchant.com.yourapp"
        >
          <NavigationContainer ref={navigationRef as any}>
            <AppNavigator />
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
    padding: 20
  },
  termsHeading: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 20
  },
  termsScroll: {
    flexGrow: 1
  },
  termsText: {
    color: "#ccc",
    fontSize: 16,
    lineHeight: 24
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
    marginRight: 20 // Shifted a bit to the left
  },
  headerIcon: {
    marginRight: 15, // Slightly more spacing to the left for the avatar
  },
  headerLeftButton: {
    paddingLeft: 15,
  },
  userAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#6f42c1", // Slightly more subtle purple
    justifyContent: "center",
    alignItems: "center",
  },
  userAvatarText: {
    color: "#FFF",
    fontWeight: "700",
    fontSize: 14,
  },
  bottomSheetOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  bottomSheetContainer: {
    backgroundColor: "#000000",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 30,
    paddingTop: 10,
  },
  bottomSheetHeader: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  bottomSheetContent: {
    paddingHorizontal: 20,
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
});
