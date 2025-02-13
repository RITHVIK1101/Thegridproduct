// App.tsx
import React, { useState, useContext } from "react";
import {
  TouchableOpacity,
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Dimensions,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialIcons";
import Ionicons from "react-native-vector-icons/Ionicons";
import { NavigationContainer } from "@react-navigation/native";
import { Image } from "react-native";
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
import JobDetails from "./JobDetails";
import RequestProduct from "./RequestProduct";
import RequestedProductsPage from "./requestedProductsPage";
import DemoScreen from "./DemoScreen"; // New demo screen
import { RootStackParamList } from "./navigationTypes";
import TermsOfServiceContent from "./TermsOfServiceContent";
import VerificationScreen from "./VerificationScreen";

const TermsOfServiceScreen: React.FC = () => <TermsOfServiceContent />;

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

const UserMenuScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { clearUser, firstName, lastName, institution, studentType } =
    useContext(UserContext);

  const handleLogout = async () => {
    try {
      await clearUser();
      // When logging out, we replace the current screen with "Login"
      navigation.replace("Login");
    } catch (error) {
      console.error("Logout Error:", error);
    }
  };

  return (
    <View style={styles.fullScreenMenuContainer}>
      <View style={styles.fullScreenMenuHeader}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          accessibilityLabel="Close User Menu"
        >
          <Ionicons name="close" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <View style={styles.fullScreenMenuContent}>
        <View style={styles.bottomSheetUserInfo}>
          <View style={styles.bottomSheetAvatar}>
            <Text style={styles.bottomSheetAvatarText}>
              {firstName && firstName.length > 0
                ? firstName.charAt(0).toUpperCase()
                : "?"}
              {lastName && lastName.length > 0
                ? lastName.charAt(0).toUpperCase()
                : "?"}
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
          <TouchableOpacity
            style={styles.bottomSheetOption}
            onPress={handleLogout}
          >
            <Ionicons
              name="log-out-outline"
              size={20}
              color="#FFFFFF"
              style={{ marginRight: 10 }}
            />
            <Text style={styles.bottomSheetOptionText}>Logout</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.bottomSheetOption}
            onPress={() => navigation.navigate("TermsOfService")}
          >
            <Ionicons
              name="document-text-outline"
              size={20}
              color="#FFFFFF"
              style={{ marginRight: 10 }}
            />
            <Text style={styles.bottomSheetOptionText}>View Terms of Use</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.bottomSheetOption}
            onPress={() => navigation.navigate("Account")}
          >
            <Ionicons
              name="person-circle-outline"
              size={20}
              color="#FFFFFF"
              style={{ marginRight: 10 }}
            />
            <Text style={styles.bottomSheetOptionText}>My Account</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.bottomSheetOption}
            onPress={() => navigation.navigate("LikedItems")}
          >
            <Ionicons
              name="heart-outline"
              size={20}
              color="#FFFFFF"
              style={{ marginRight: 10 }}
            />
            <Text style={styles.bottomSheetOptionText}>Liked Items</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

export const navigationRef = React.createRef();

const Stack = createStackNavigator<RootStackParamList>();

const HeaderTitleWithLogo: React.FC<{ title: string }> = ({ title }) => (
  <View style={styles.headerTitleContainer}>
    <Image
      source={require("./assets/logo'no bg.png")} // Logo file
      style={{ width: 40, height: 40, marginRight: 8 }} // Logo size
      resizeMode="contain"
    />
    <Text style={styles.headerTitleText}>{title}</Text>
  </View>
);

const UserAvatar: React.FC<{
  firstName?: string;
  lastName?: string;
  onPress: () => void;
}> = ({ firstName, lastName, onPress }) => {
  const initials = `${firstName?.charAt(0).toUpperCase() || "?"}${
    lastName?.charAt(0).toUpperCase() || "?"
  }`;
  return (
    <TouchableOpacity
      onPress={onPress}
      style={styles.userAvatar}
      accessibilityLabel="Open User Menu"
    >
      <Text style={styles.userAvatarText}>{initials}</Text>
    </TouchableOpacity>
  );
};

const HeaderRightComponent = (
  navigation: any,
  firstName?: string,
  lastName?: string
) => (
  <View style={styles.headerRightContainer}>
    <TouchableOpacity
      onPress={() => navigation.navigate("Cart")}
      style={styles.headerIcon}
      accessibilityLabel="Go to Cart"
    >
      <Ionicons name="cart-outline" size={26} color="#FFFFFF" />
    </TouchableOpacity>
    <UserAvatar
      firstName={firstName}
      lastName={lastName}
      onPress={() => navigation.navigate("UserMenu")}
    />
  </View>
);

const getHeaderOptions = (
  navigation: any,
  firstName?: string,
  lastName?: string,
  showBackButton: boolean = false,
  enableAnimation: boolean = false
): StackNavigationOptions => ({
  headerTitle: () => <HeaderTitleWithLogo title="Gridly" />,
  headerRight: () => HeaderRightComponent(navigation, firstName, lastName),
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
  const { token, firstName, lastName, isLoading } = useContext(UserContext);

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
            options={({ navigation }) => ({
              headerTransparent: true,
              headerTitle: () => <HeaderTitleWithLogo title="Gridly" />, // Logo here
              headerRight: () =>
                HeaderRightComponent(navigation, firstName, lastName),
            })}
          />
          <Stack.Screen
            name="Jobs"
            component={JobsScreen}
            options={({ navigation }) =>
              getHeaderOptions(navigation, firstName, lastName)
            }
          />
          <Stack.Screen
            name="AddProduct"
            component={AddProductScreen}
            options={({ navigation }) =>
              getHeaderOptions(navigation, firstName, lastName, true, true)
            }
          />
          <Stack.Screen
            name="AddGig"
            component={AddGigScreen}
            options={({ navigation }) =>
              getHeaderOptions(navigation, firstName, lastName, true, true)
            }
          />
          <Stack.Screen
            name="Activity"
            component={ActivityScreen}
            options={({ navigation }) =>
              getHeaderOptions(navigation, firstName, lastName)
            }
          />
          <Stack.Screen
            name="EditProduct"
            component={EditProduct}
            options={({ navigation }) =>
              getHeaderOptions(navigation, firstName, lastName, true, true)
            }
          />
          <Stack.Screen
            name="Messaging"
            component={MessagingScreen}
            options={({ navigation }) =>
              getHeaderOptions(navigation, firstName, lastName)
            }
          />
          <Stack.Screen
            name="Cart"
            component={CartScreen}
            options={({ navigation }) =>
              getHeaderOptions(navigation, firstName, lastName, true, true)
            }
          />
          <Stack.Screen
            name="Account"
            component={AccountScreen}
            options={({ navigation }) =>
              getHeaderOptions(navigation, firstName, lastName, true, true)
            }
          />
          <Stack.Screen
            name="UserMenu"
            component={UserMenuScreen}
            options={{
              headerShown: false,
              presentation: "transparentModal",
              animationEnabled: true,
            }}
          />
          <Stack.Screen
            name="TermsOfService"
            component={TermsOfServiceScreen}
            options={({ navigation }) =>
              getHeaderOptions(navigation, firstName, lastName, true, true)
            }
          />
          <Stack.Screen
            name="LikedItems"
            component={LikedItemsScreen}
            options={({ navigation }) =>
              getHeaderOptions(navigation, firstName, lastName, true, true)
            }
          />
          <Stack.Screen
            name="JobDetail"
            component={JobDetails}
            options={({ navigation }) =>
              getHeaderOptions(navigation, firstName, lastName, true, true)
            }
          />
          <Stack.Screen
            name="RequestProduct"
            component={RequestProduct}
            options={({ navigation }) =>
              getHeaderOptions(navigation, firstName, lastName, true, true)
            }
          />
          <Stack.Screen
            name="RequestedProductsPage"
            component={RequestedProductsPage}
            options={({ navigation }) =>
              getHeaderOptions(navigation, firstName, lastName, true, true)
            }
          />
        </>
      ) : (
        <>
          {/* When not authenticated, on first launch show Demo, then Login & Verification.
          Otherwise (after logout) show Login and Verification screens immediately. */}
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
  const [showSplash, setShowSplash] = useState(true);
  const [firstRender, setFirstRender] = useState(true);

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
