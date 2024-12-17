// LikedProductScreen.tsx

import React, { useEffect, useState, useContext } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  Image,
  TouchableOpacity,
  Alert,
} from "react-native";
import { UserContext } from "./UserContext"; // Adjust the path as necessary
import axios from "axios";
import { useNavigation } from "@react-navigation/native";
import Ionicons from "react-native-vector-icons/Ionicons";

// Define the structure of a product based on the backend response
interface Product {
  _id: string;
  userId: string;
  title: string;
  price: number;
  description: string;
  selectedTags: string[];
  images: string[];
  postedDate: string; // ISO string
  isAvailableOutOfCampus: boolean;
  rating: number;
  listingType: string;
  availability: string;
  university: string;
  studentType: string;
  condition?: string;
  status: string;
  likeCount: number;
}

const LikedProductScreen: React.FC = () => {
  const { token } = useContext(UserContext);
  const [likedProducts, setLikedProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const navigation = useNavigation();

  // Define the API endpoint
  const API_ENDPOINT = "http://localhost:8080/products/liked"; // Replace with your actual backend URL

  useEffect(() => {
    const fetchLikedProducts = async () => {
      if (!token) {
        setError("User not authenticated.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await axios.get(API_ENDPOINT, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        if (response.status === 200) {
          setLikedProducts(response.data);
        } else {
          setError("Failed to fetch liked products.");
          Alert.alert("Error", "Failed to fetch liked products.");
        }
      } catch (err: any) {
        console.error("Error fetching liked products:", err);
        setError(err.response?.data?.error || "An unexpected error occurred.");
        Alert.alert(
          "Error",
          err.response?.data?.error || "An unexpected error occurred."
        );
      } finally {
        setLoading(false);
      }
    };

    fetchLikedProducts();
  }, [token]);

  // Render a single product item
  const renderProductItem = ({ item }: { item: Product }) => {
    return (
      <TouchableOpacity
        style={styles.productItem}
        onPress={() => {
          // Navigate to Product Details or another screen if needed
          // For example: navigation.navigate("ProductDetails", { productId: item._id });
        }}
        accessibilityLabel={`View details for ${item.title}`}
      >
        {item.images && item.images.length > 0 ? (
          <Image
            source={{ uri: item.images[0] }}
            style={styles.productImage}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.productImage, styles.imagePlaceholder]}>
            <Text style={styles.imagePlaceholderText}>No Image</Text>
          </View>
        )}
        <View style={styles.productInfo}>
          <Text style={styles.productTitle}>{item.title}</Text>
          <Text style={styles.productPrice}>${item.price.toFixed(2)}</Text>
          <Text style={styles.productStatus}>
            Status:{" "}
            <Text
              style={{
                color: item.status === "sold" ? "green" : "orange",
                fontWeight: "bold",
              }}
            >
              {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
            </Text>
          </Text>
          <Text numberOfLines={2} style={styles.productDescription}>
            {item.description}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={24} color="#FFFFFF" />
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#FFFFFF" />
        <Text style={styles.loadingText}>Loading your liked products...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => {
            // Retry fetching liked products
            setLoading(true);
            setError(null);
            // Re-trigger the useEffect by updating state or implement a separate fetch function
            // For simplicity, you can call fetchLikedProducts directly if it's defined outside useEffect
          }}
          accessibilityLabel="Retry fetching liked products"
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (likedProducts.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>You have no liked products yet.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={likedProducts}
        keyExtractor={(item) => item._id}
        renderItem={renderProductItem}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
};

export default LikedProductScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
    padding: 10,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: "#555",
  },
  errorText: {
    color: "#FF6347",
    fontSize: 16,
    marginBottom: 10,
    textAlign: "center",
  },
  retryButton: {
    backgroundColor: "#6f42c1",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
  },
  retryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
  },
  emptyText: {
    fontSize: 18,
    color: "#CCCCCC",
    textAlign: "center",
  },
  listContent: {
    paddingBottom: 20,
  },
  productItem: {
    flexDirection: "row",
    backgroundColor: "#1c1c1c",
    borderRadius: 8,
    marginBottom: 10,
    overflow: "hidden",
    elevation: 2, // For Android
    shadowColor: "#000", // For iOS
    shadowOffset: { width: 0, height: 2 }, // For iOS
    shadowOpacity: 0.1, // For iOS
    shadowRadius: 4, // For iOS
    padding: 10,
    alignItems: "center",
  },
  productImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  imagePlaceholder: {
    backgroundColor: "#555555",
    justifyContent: "center",
    alignItems: "center",
  },
  imagePlaceholderText: {
    color: "#CCCCCC",
    fontSize: 14,
  },
  productInfo: {
    flex: 1,
    marginLeft: 10,
    justifyContent: "space-between",
  },
  productTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  productPrice: {
    color: "#CCCCCC",
    fontSize: 14,
  },
  productStatus: {
    color: "#CCCCCC",
    fontSize: 14,
  },
  productDescription: {
    color: "#999999",
    fontSize: 12,
  },
});
