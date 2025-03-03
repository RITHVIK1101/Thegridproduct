import React, { useEffect, useState, useContext } from "react";
import {
  View,
  Text,
  Image,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { UserContext } from "./UserContext";

import { NGROK_URL } from "@env";
import Ionicons from "react-native-vector-icons/Ionicons";

type UserProfileRouteParams = {
  userId: string;
};

const UserProfileScreen: React.FC = () => {
  const route = useRoute();
  const navigation = useNavigation(); // Navigation hook for navigation actions
  const { userId } = route.params as UserProfileRouteParams;
  const { token } = useContext(UserContext);

  const [userProfile, setUserProfile] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);

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
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#BB86FC" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Custom Back Button */}
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        style={styles.backButton}
      >
        <Ionicons name="chevron-back" size={28} color="white" />
      </TouchableOpacity>

      {/* Profile Section */}
      {userProfile && (
        <View style={styles.profileHeader}>
          {userProfile.profilePic ? (
            <Image
              source={{ uri: userProfile.profilePic }}
              style={styles.profileImage}
            />
          ) : (
            <View style={styles.profilePlaceholder}>
              <Text style={styles.profileInitials}>
                {userProfile.firstName?.charAt(0)}
                {userProfile.lastName?.charAt(0)}
              </Text>
            </View>
          )}
          <View>
            <Text style={styles.profileName}>
              {userProfile.firstName} {userProfile.lastName}
            </Text>
            <Text style={styles.institutionName}>
              {userProfile.institution}
            </Text>
            <Text style={styles.gridScore}>
              Grid Score: {userProfile.gridScore || "N/A"}
            </Text>
          </View>
        </View>
      )}

      {/* Product List */}
      <Text style={styles.sectionTitle}>
        Listings by {userProfile?.firstName}
      </Text>
      {products.length === 0 ? (
        <Text style={styles.noProductsText}>No products listed.</Text>
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={styles.productList}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.productCard}
              onPress={() =>
                navigation.navigate("ProductDetail", { productId: item.id })
              }
            >
              <Image
                source={{
                  uri: item.images?.[0] || "https://via.placeholder.com/150",
                }}
                style={styles.productImage}
              />
              <Text style={styles.productTitle} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={styles.productPrice}>${item.price.toFixed(2)}</Text>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
};

export default UserProfileScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  backButton: {
    position: "absolute",
    top: 50,
    left: 15,
    zIndex: 10,
  },
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    marginTop: 50, // Added margin for back button spacing
  },
  profileImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 10,
  },
  profilePlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#555",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  profileInitials: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "bold",
  },
  profileName: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "bold",
  },
  institutionName: {
    color: "#ccc",
    fontSize: 16,
  },
  gridScore: {
    color: "#BB86FC",
    fontSize: 16,
    fontWeight: "bold",
  },
  sectionTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
    marginTop: 20,
    marginBottom: 10,
  },
  productList: {
    paddingBottom: 20,
  },
  productCard: {
    backgroundColor: "#222",
    borderRadius: 10,
    margin: 5,
    padding: 10,
    alignItems: "center",
    width: "48%",
  },
  productImage: {
    width: "100%",
    height: 100,
    borderRadius: 10,
    marginBottom: 10,
  },
  productTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  productPrice: {
    color: "#BB86FC",
    fontSize: 14,
  },
  noProductsText: {
    color: "#ccc",
    textAlign: "center",
    marginTop: 20,
  },
});
