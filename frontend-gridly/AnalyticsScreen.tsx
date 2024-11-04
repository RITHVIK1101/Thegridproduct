import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import BottomNavBar from "./components/BottomNavbar";

type Product = {
  _id: string;
  name: string;
  price: string;
  description: string;
  images: string[];
};

const AnalyticsScreen: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await fetch(
          "https://a18c-2601-600-9000-50-8875-1b80-3f88-576a.ngrok-free.app/products/all"
        );

        if (!response.ok) {
          const errorText = await response.text();
          console.error("Error fetching products:", errorText);
          setError("Failed to fetch products. Please try again later.");
          return;
        }

        const data = await response.json();
        setProducts(data);
      } catch (error) {
        console.error("Error fetching products:", error);
        setError("An error occurred while fetching products.");
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#000" />
        <Text>Loading products...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  const renderProduct = ({ item }: { item: Product }) => (
    <View style={styles.productContainer}>
      <TouchableOpacity style={styles.editIcon}>
        <Ionicons name="pencil-outline" size={20} color="#555" />
      </TouchableOpacity>
      <Image
        source={{
          uri:
            item.images && item.images[0]
              ? item.images[0]
              : "https://via.placeholder.com/150",
        }}
        style={styles.productImage}
      />
      <Text style={styles.productName}>{item.name || "No Name"}</Text>
      <Text style={styles.productPrice}>${item.price || "No Price"}</Text>
      <Text style={styles.productDescription}>
        {item.description || "No Description"}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Your Products</Text>
      <FlatList
        data={products}
        keyExtractor={(item, index) => item._id || index.toString()}
        renderItem={renderProduct}
        contentContainerStyle={styles.productList}
      />
      <BottomNavBar />
    </View>
  );
};

export default AnalyticsScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    padding: 30,
    paddingBottom: 80,
    paddingTop: 70, // Ensures space at the bottom for the navbar
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#333",
    marginBottom: 20,
  },
  productList: {
    paddingBottom: 80, // Extra padding to avoid overlap with navbar
  },
  productContainer: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 3,
  },
  editIcon: {
    position: "absolute",
    top: 10,
    right: 10,
  },
  productImage: {
    width: "100%",
    height: 150,
    borderRadius: 10,
    marginBottom: 10,
  },
  productName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  productPrice: {
    fontSize: 16,
    color: "#666",
    marginBottom: 5,
  },
  productDescription: {
    fontSize: 14,
    color: "#666",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorText: {
    color: "red",
    fontSize: 16,
    textAlign: "center",
  },
});
