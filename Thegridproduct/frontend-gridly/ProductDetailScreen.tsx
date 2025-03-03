// ProductDetailScreen.tsx
import React, { useEffect, useState, useContext } from "react";
import {
  View,
  Text,
  Image,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { UserContext } from "./UserContext"; // Ensure correct path
import { useNavigationState } from "@react-navigation/native";

import { NGROK_URL } from "@env";

type ProductDetailRouteParams = {
  productId: string;
};

const ProductDetailScreen: React.FC = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { productId } = route.params as ProductDetailRouteParams;
  const { token } = useContext(UserContext);

  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const navigationState = useNavigationState((state) => state);
  const isFirstProductDetail = navigationState?.routes?.length === 2; // Adjust this if needed

  const [posterProfile, setPosterProfile] = useState<any>(null);

  // Fetch product details
  useEffect(() => {
    console.log(
      "ProductDetailScreen rendered with productId:",
      productId,
      "and token:",
      token
    );
    const fetchProductDetails = async () => {
      try {
        if (!productId) {
          throw new Error("Invalid product ID.");
        }

        const response = await fetch(`${NGROK_URL}/products/${productId}`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error("Error response:", errorText);
          throw new Error("Failed to fetch product details.");
        }

        const data = await response.json();
        setProduct(data);
      } catch (error) {
        console.error("Error fetching product detail:", error);
        Alert.alert("Error", "Failed to load product details.");
      } finally {
        setLoading(false);
      }
    };

    fetchProductDetails();
  }, [productId, token]);

  // Fetch the poster's profile using product.userId
  useEffect(() => {
    if (product && product.userId) {
      const fetchUserProfile = async () => {
        try {
          const response = await fetch(`${NGROK_URL}/users/${product.userId}`, {
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
          setPosterProfile(data);
        } catch (error) {
          console.error("Error fetching user profile:", error);
        }
      };

      fetchUserProfile();
    }
  }, [product, token]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#BB86FC" />
      </View>
    );
  }

  if (!product) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Product not found.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Profile Section */}
      {posterProfile && (
        <TouchableOpacity
          style={styles.profileContainer}
          onPress={() =>
            navigation.navigate("UserProfile", { userId: product.userId })
          }
        >
          {posterProfile.profilePic ? (
            <Image
              source={{ uri: posterProfile.profilePic }}
              style={styles.profileImage}
            />
          ) : (
            <View style={styles.profilePlaceholder}>
              <Text style={styles.profileInitials}>
                {posterProfile.firstName?.charAt(0)}
                {posterProfile.lastName?.charAt(0)}
              </Text>
            </View>
          )}
          <Text style={styles.profileName}>
            {posterProfile.firstName} {posterProfile.lastName}
          </Text>
        </TouchableOpacity>
      )}

      {/* Product Image and Details */}
      <Image
        source={{
          uri: product.images?.[0] || "https://via.placeholder.com/150",
        }}
        style={styles.image}
      />
      <Text style={styles.title}>{product.title}</Text>
      <Text style={styles.price}>${product.price?.toFixed(2)}</Text>
      <Text style={styles.description}>{product.description}</Text>
    </ScrollView>
  );
};

export default ProductDetailScreen;

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  errorContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  errorText: { fontSize: 16, color: "red" },
  container: {
    flexGrow: 1,
    padding: 20,
    alignItems: "center",
    backgroundColor: "#000",
  },
  profileContainer: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    marginBottom: 20,
  },
  profileImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 10,
  },
  profilePlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#555",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  profileInitials: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  profileName: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
  image: { width: 300, height: 300, borderRadius: 10, marginBottom: 20 },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    color: "#fff",
  },
  price: { fontSize: 20, color: "#BB86FC", marginBottom: 10 },
  description: { fontSize: 16, color: "#ccc", textAlign: "center" },
});
