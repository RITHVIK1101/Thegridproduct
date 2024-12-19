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
import { UserContext } from "./UserContext"; // Adjust path as necessary
import { NGROK_URL } from "@env"; // Load backend URL from environment variables
import { useNavigation } from "@react-navigation/native";
import Ionicons from "react-native-vector-icons/Ionicons";

// Define the structure of a product
interface Product {
  _id: string;
  title: string;
  price: number;
  description: string;
  images: string[];
  status: string;
}

const LikedProductScreen: React.FC = () => {
  const { token } = useContext(UserContext); // Get token from UserContext
  const [likedProducts, setLikedProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const navigation = useNavigation();

  // Fetch liked products from backend
  useEffect(() => {
    const fetchLikedProducts = async () => {
      try {
        const response = await fetch(`${NGROK_URL}/products/liked`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(
            errorData.message || "Failed to fetch liked products"
          );
        }

        const data: Product[] = await response.json();
        setLikedProducts(data);
      } catch (err: any) {
        console.error("Error fetching liked products:", err);
        setError(err.message || "An unexpected error occurred");
        Alert.alert("Error", err.message || "An unexpected error occurred");
      } finally {
        setLoading(false);
      }
    };

    fetchLikedProducts();
  }, [token]);

  // Render each liked product item
  const renderProductItem = ({ item }: { item: Product }) => (
    <TouchableOpacity
      style={styles.productItem}
      onPress={() =>
        navigation.navigate("ProductDetails", { productId: item._id })
      }
    >
      {item.images?.length > 0 ? (
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
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.price}>${item.price.toFixed(2)}</Text>
        <Text style={styles.status}>
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
        <Text numberOfLines={2} style={styles.description}>
          {item.description}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={24} color="#000" />
    </TouchableOpacity>
  );

  // Loading state
  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text style={styles.loadingText}>Loading liked products...</Text>
      </View>
    );
  }

  // Error state
  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  // Empty state
  if (likedProducts.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>You have no liked products yet.</Text>
      </View>
    );
  }

  // Main content
  return (
    <View style={styles.container}>
      <FlatList
        data={likedProducts}
        keyExtractor={(item, index) =>
          item._id || `item-${index}-${Math.random()}`
        }
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
    backgroundColor: "#fff",
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
    color: "red",
    fontSize: 16,
  },
  emptyText: {
    fontSize: 18,
    color: "#555",
  },
  listContent: {
    paddingBottom: 20,
  },
  productItem: {
    flexDirection: "row",
    backgroundColor: "#f9f9f9",
    borderRadius: 8,
    marginBottom: 10,
    overflow: "hidden",
    elevation: 2,
    padding: 10,
    alignItems: "center",
  },
  productImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  imagePlaceholder: {
    backgroundColor: "#ccc",
    justifyContent: "center",
    alignItems: "center",
  },
  imagePlaceholderText: {
    color: "#666",
    fontSize: 14,
  },
  productInfo: {
    flex: 1,
    marginLeft: 10,
    justifyContent: "space-between",
  },
  title: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
  },
  price: {
    fontSize: 14,
    color: "#666",
  },
  status: {
    fontSize: 14,
    color: "#666",
  },
  description: {
    fontSize: 12,
    color: "#999",
  },
});
