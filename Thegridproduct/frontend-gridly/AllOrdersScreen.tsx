// AllOrdersScreen.tsx

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
import { UserContext } from "./UserContext";
import { NGROK_URL } from "@env";
import { useNavigation } from "@react-navigation/native";
interface Order {
  productId: string;
  title: string;
  price: number;
  description: string;
  status: "talks" | "sold";
  images: string[];
}

const AllOrdersScreen: React.FC = () => {
  const { token } = useContext(UserContext);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const navigation = useNavigation();

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const response = await fetch(`${NGROK_URL}/orders`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || "Failed to fetch orders");
        }

        const data: Order[] = await response.json();
        setOrders(data);
      } catch (err: any) {
        console.error("Error fetching orders:", err);
        setError(err.message || "An unexpected error occurred");
        Alert.alert("Error", err.message || "An unexpected error occurred");
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [token]);

  // Render a single order item
  const renderOrderItem = ({ item }: { item: Order }) => {
    return (
      <TouchableOpacity style={styles.orderItem}>
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
        <View style={styles.orderInfo}>
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
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text style={styles.loadingText}>Loading your orders...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (orders.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>You have no orders yet.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={orders}
        keyExtractor={(item) => item.productId}
        renderItem={renderOrderItem}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
};

export default AllOrdersScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff", // Adjust based on your theme
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
  orderItem: {
    flexDirection: "row",
    backgroundColor: "#f9f9f9",
    borderRadius: 8,
    marginBottom: 10,
    overflow: "hidden",
    elevation: 2, // For Android
    shadowColor: "#000", // For iOS
    shadowOffset: { width: 0, height: 2 }, // For iOS
    shadowOpacity: 0.1, // For iOS
    shadowRadius: 4, // For iOS
  },
  productImage: {
    width: 100,
    height: 100,
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
  orderInfo: {
    flex: 1,
    padding: 10,
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
