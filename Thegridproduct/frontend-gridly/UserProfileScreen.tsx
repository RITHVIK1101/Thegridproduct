import React, { useEffect, useState, useContext, useRef } from "react";
import {
  SafeAreaView,
  View,
  Text,
  Image,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Dimensions,
  Animated,
  StatusBar,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { UserContext } from "./UserContext";
import { NGROK_URL } from "@env";
import { LinearGradient } from "expo-linear-gradient";
import * as Animatable from "react-native-animatable";
import { Ionicons } from "@expo/vector-icons"; // Added import for Ionicons

const { width } = Dimensions.get("window");
const HEADER_MAX_HEIGHT = 200;
const HEADER_MIN_HEIGHT = 70;

const UserProfileScreen: React.FC = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { userId } = route.params as { userId: string };
  const { token } = useContext(UserContext);

  const [userProfile, setUserProfile] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const scrollY = useRef(new Animated.Value(0)).current;

  // Fetch user profile details
  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const response = await fetch(`${NGROK_URL}/users/${userId}`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });
        if (!response.ok) {
          throw new Error("Failed to fetch user profile.");
        }
        const data = await response.json();
        setUserProfile(data);
      } catch (error) {
        console.error("Error fetching user profile:", error);
        Alert.alert("Error", "Failed to load user profile.");
      }
    };
    fetchUserProfile();
  }, [userId, token]);

  // Fetch products listed by this user
  useEffect(() => {
    const fetchUserProducts = async () => {
      try {
        const response = await fetch(`${NGROK_URL}/products/user`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });
        if (!response.ok) {
          throw new Error("Failed to fetch user products.");
        }
        const data = await response.json();
        setProducts(data);
      } catch (error) {
        console.error("Error fetching user products:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchUserProducts();
  }, [userId, token]);

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#A18CD1" />
      </SafeAreaView>
    );
  }

  const headerHeight = scrollY.interpolate({
    inputRange: [0, HEADER_MAX_HEIGHT - HEADER_MIN_HEIGHT],
    outputRange: [HEADER_MAX_HEIGHT, HEADER_MIN_HEIGHT],
    extrapolate: "clamp",
  });

  const renderHeader = () => (
    <Animated.View style={[styles.header, { height: headerHeight }]}>
      <LinearGradient
        colors={["#1B0035", "#000000"]}
        style={styles.headerBackground}
      />
      <View style={styles.headerContent}>
        <View style={styles.profileImageContainer}>
          {userProfile?.profilePic ? (
            <Image
              source={{ uri: userProfile.profilePic }}
              style={styles.profileImage}
            />
          ) : (
            <View style={styles.profileImagePlaceholder}>
              <Text style={styles.profileInitials}>
                {userProfile?.firstName?.charAt(0)}
                {userProfile?.lastName?.charAt(0)}
              </Text>
            </View>
          )}
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>
            {userProfile?.firstName} {userProfile?.lastName}
          </Text>
          <Text style={styles.userInstitution}>
            {userProfile?.institution || "No Institution"}
          </Text>
          {/* Grid Score Badge (similar to UserMenu) */}
          <View style={styles.gridsBadge}>
            <Ionicons name="grid-outline" size={16} color="#FFF" />
            <Text style={styles.gridsText}>
              {userProfile?.gridScore || "N/A"} Grids
            </Text>
          </View>
        </View>
      </View>
    </Animated.View>
  );

  const renderProductItem = ({ item, index }: { item: any; index: number }) => (
    <Animatable.View
      animation="fadeInUp"
      delay={index * 100}
      style={styles.productCard}
    >
      <TouchableOpacity
        onPress={() =>
          navigation.push("ProductDetail", {
            productId: item.id,
            hideProfileIcon: true,
          })
        }
      >
        <Image
          source={{
            uri:
              item.images?.[0] ||
              "https://via.placeholder.com/150/FFFFFF/000000?text=No+Image",
          }}
          style={styles.productImage}
          resizeMode="cover"
        />
        <View style={styles.productInfo}>
          <Text style={styles.productTitle} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.productPrice}>${item.price.toFixed(2)}</Text>
        </View>
      </TouchableOpacity>
    </Animatable.View>
  );

  const ListHeader = () => (
    <View style={styles.listHeader}>
      {renderHeader()}
      <Text style={styles.listingsTitle}>Listings</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <Animated.FlatList
        data={products}
        keyExtractor={(item) => item.id}
        numColumns={2}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
        ListHeaderComponent={ListHeader}
        contentContainerStyle={[styles.productsContainer, { marginTop: -55 }]}
        columnWrapperStyle={styles.columnWrapper}
        renderItem={renderProductItem}
      />
    </SafeAreaView>
  );
};

export default UserProfileScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
    paddingTop: 28, // ✅ Pushes everything down slightly
  },
  listHeader: {
    marginTop: 29, // ✅ Moves just the header section down
    marginBottom: 8,
  },
  header: {
    width: "100%",
    overflow: "hidden",
    marginTop: 20, // ✅ Moves the animated header slightly lower
  },

  headerBackground: {
    ...StyleSheet.absoluteFillObject,
  },
  headerContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 16,
    paddingBottom: 10,
    justifyContent: "center",
  },
  profileImageContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: "#A18CD1",
    overflow: "hidden",
    backgroundColor: "#1C1C1E",
    marginRight: 16,
  },
  profileImage: {
    width: "100%",
    height: "100%",
  },
  profileImagePlaceholder: {
    width: "100%",
    height: "100%",
    backgroundColor: "#333333",
    justifyContent: "center",
    alignItems: "center",
  },
  profileInitials: {
    fontSize: 30,
    color: "#FFFFFF",
    fontWeight: "bold",
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 24,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  userInstitution: {
    fontSize: 16,
    color: "#A0A0A0",
    marginTop: 4,
  },
  userScore: {
    fontSize: 14,
    color: "#A18CD1",
    marginTop: 2,
  },
  // New styles for grid badge
  gridsBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#7B61FF",
    paddingHorizontal: 8, // ✅ Reduce horizontal padding to make it smaller
    paddingVertical: 4, // ✅ Reduce height slightly
    borderRadius: 15, // ✅ Keep it rounded
    alignSelf: "flex-start", // ✅ Ensures it only takes the space it needs
    marginTop: 10,
    shadowColor: "#7B61FF",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },

  gridsText: {
    fontSize: 14,
    color: "#FFFFFF",
    fontWeight: "600",
    marginLeft: 5,
  },
  listingsTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center",
    marginVertical: 16,
  },
  productsContainer: {
    paddingHorizontal: 16,
    paddingBottom: 20,
    backgroundColor: "#000000",
  },
  columnWrapper: {
    justifyContent: "space-between",
    marginBottom: 16,
  },
  productCard: {
    backgroundColor: "#121212",
    borderRadius: 12,
    overflow: "hidden",
    width: (width - 48) / 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
  productImage: {
    width: "100%",
    height: 140,
  },
  productInfo: {
    padding: 10,
    backgroundColor: "#1C1C1E",
  },
  productTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  productPrice: {
    fontSize: 14,
    fontWeight: "500",
    color: "#A18CD1",
    marginTop: 4,
  },
});
