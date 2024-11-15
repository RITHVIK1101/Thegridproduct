// ActivityScreen.tsx

import React, { useEffect, useState, useContext } from "react";
import {
  View,
  Text,
  StyleSheet,
  Button,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  TextInput,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import BottomNavBar from "./components/BottomNavbar";
import { NGROK_URL } from "@env"; // Access BACKEND_URL from .env
import { useNavigation, useIsFocused } from "@react-navigation/native";
import { UserContext } from "./UserContext"; // Import UserContext

// Define the Product type matching the backend's Product model
type Product = {
  id: string;
  title: string;
  price: number;
  description: string;
  postedDate: string;
  images: string[];
  selectedTags: string[];
  isAvailableOutOfCampus: boolean;
  rating: number;
  listingType: "Selling" | "Renting" | "Both";
  availability: "In Campus Only" | "On and Off Campus";
  rentDuration?: string;
  rentPrice?: number;
  outOfCampusPrice?: number;
  expired?: boolean;
};

const ActivityScreen: React.FC = () => {
  const navigation = useNavigation();
  const isFocused = useIsFocused(); // To refetch data when screen is focused

  const { userId, token } = useContext(UserContext); // Get userId and token from context

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>(""); // State for search query
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]); // State for filtered products

  // Function to fetch the user's own products
  const fetchUserProducts = async () => {
    if (!userId || !token) {
      setError("User not logged in.");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${NGROK_URL}/products/user`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      // Check if the response is OK and if content-type is JSON
      const contentType = response.headers.get("content-type");
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Error response text:", errorText);
        throw new Error(
          "Failed to fetch your products. Server responded with an error."
        );
      } else if (!contentType || !contentType.includes("application/json")) {
        const errorText = await response.text();
        console.error("Unexpected response content-type:", contentType);
        console.error("Response text:", errorText);
        throw new Error("Received unexpected content-type. Expected JSON.");
      }

      const data: Product[] = await response.json();
      setProducts(data);
      setFilteredProducts(data); // Initialize filtered products
    } catch (err) {
      console.error("Error fetching your products:", err);
      setError(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred while fetching your products."
      );
    } finally {
      setLoading(false);
    }
  };

  // Fetch data when screen is focused
  useEffect(() => {
    if (isFocused) {
      setLoading(true);
      setError(null);
      setSearchQuery(""); // Reset search query when screen is focused
      fetchUserProducts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFocused]);

  // Update filtered products when search query or products change
  useEffect(() => {
    const filtered = products.filter((product) =>
      product.title.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredProducts(filtered);
  }, [searchQuery, products]);

  // Function to calculate days active
  const calculateDaysActive = (postedDate: string): number => {
    const posted = new Date(postedDate);
    const now = new Date();
    const differenceInTime = now.getTime() - posted.getTime();
    return Math.floor(differenceInTime / (1000 * 3600 * 24));
  };

  // Function to handle navigation to EditProduct screen
  const navigateToEditProduct = (productId: string) => {
    console.log("Navigating with Product ID:", productId); // Log for verification
    navigation.navigate("EditProduct", { productId });
  };

  // Function to render each product item
  const renderProduct = ({ item }: { item: Product }) => {
    const daysActive = calculateDaysActive(item.postedDate);
    const status =
      daysActive > 30 ? "Expired" : `Active for ${daysActive} days`;

    return (
      <TouchableOpacity
        style={styles.itemContainer}
        onPress={() => navigateToEditProduct(item.id)}
        activeOpacity={0.8}
      >
        {/* Icon Container */}
        <View style={styles.iconContainer}>
          {/* Functional Edit Button */}
          <TouchableOpacity
            style={styles.editIconTouchable}
            onPress={() => navigateToEditProduct(item.id)}
            activeOpacity={0.7}
          >
            <Ionicons name="pencil-outline" size={24} color="#4CAF50" />
          </TouchableOpacity>

          {/* Non-functional Delete Icon */}
          <TouchableOpacity style={styles.deleteIconTouchable}>
            <Ionicons name="trash-outline" size={24} color="#FF6B6B" />
          </TouchableOpacity>
        </View>

        {/* Product Details */}
        <Text style={styles.itemTitle}>{item.title || "No Title"}</Text>
        <Text style={styles.itemPrice}>${item.price.toFixed(2)}</Text>
        <Text style={styles.itemDate}>
          Posted: {new Date(item.postedDate).toDateString()}
        </Text>
        <Text style={styles.itemStatus}>{status}</Text>

        {/* Display Tags */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {item.selectedTags.map((tag, index) => (
            <View key={index} style={styles.tagBadge}>
              <Text style={styles.tagBadgeText}>{tag}</Text>
            </View>
          ))}
        </ScrollView>
      </TouchableOpacity>
    );
  };

  // Function to handle refreshing the data manually (optional)
  const handleRefresh = () => {
    setLoading(true);
    setError(null);
    fetchUserProducts();
  };

  return (
    <View style={styles.container}>
      {/* Search Bar for Products */}
      <View style={styles.searchContainer}>
        <Ionicons
          name="search"
          size={20}
          color="#888"
          style={styles.searchIcon}
        />
        <TextInput
          style={styles.searchInput}
          placeholder="Search your products..."
          placeholderTextColor="#888"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery("")}>
            <Ionicons
              name="close-circle"
              size={20}
              color="#888"
              style={styles.clearIcon}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Display Loading, Error, or List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#BB86FC" />
          <Text style={styles.loadingText}>Loading your products...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <Button title="Retry" onPress={handleRefresh} color="#BB86FC" />
        </View>
      ) : (
        <FlatList
          data={filteredProducts}
          keyExtractor={(item) => item.id}
          renderItem={renderProduct}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            <Text style={styles.emptyText}>You have no products.</Text>
          }
          showsVerticalScrollIndicator={false}
          onRefresh={handleRefresh}
          refreshing={loading}
        />
      )}

      {/* Bottom Navigation Bar */}
      <BottomNavBar />
    </View>
  );
};

export default ActivityScreen;

// Stylesheet
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212", // Dark background
    padding: 15, // Reduced padding for conciseness
    paddingBottom: 60, // Adjusted to remove extra space
    paddingTop: 20,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1E1E1E",
    borderRadius: 25,
    paddingHorizontal: 15,
    paddingVertical: 8,
    marginHorizontal: 10,
    marginBottom: 15,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    color: "#fff",
    fontSize: 14,
  },
  clearIcon: {
    marginLeft: 10,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 8,
    color: "#bbb",
    fontSize: 14,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 15,
  },
  errorText: {
    color: "#FF6B6B", // Red color for errors
    fontSize: 14,
    textAlign: "center",
    marginBottom: 8,
  },
  listContainer: {
    // You can add padding or other styles here if needed
  },
  itemContainer: {
    backgroundColor: "#1E1E1E", // Darker card background
    borderRadius: 8, // Reduced border radius for conciseness
    padding: 12, // Reduced padding
    marginBottom: 12, // Reduced margin
    elevation: 2,
    position: "relative",
  },
  iconContainer: {
    flexDirection: "column",
    position: "absolute",
    top: 8,
    right: 8,
  },
  editIconTouchable: {
    padding: 8, // Increased padding for larger hitbox
    borderRadius: 12,
    backgroundColor: "#2C2C2C", // Slightly lighter background for visibility
    marginBottom: 8, // Space between edit and delete icons
  },
  deleteIconTouchable: {
    padding: 8, // Increased padding for larger hitbox
    borderRadius: 12,
    backgroundColor: "#2C2C2C", // Slightly lighter background for visibility
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#BB86FC", // Primary color for titles
    marginBottom: 4,
  },
  itemPrice: {
    fontSize: 14,
    color: "#fff", // White color for price
    marginBottom: 4,
  },
  itemDate: {
    fontSize: 12,
    color: "#bbb", // Slightly darker grey for date
    marginBottom: 4,
  },
  itemStatus: {
    fontSize: 12,
    color: "#4CAF50", // Green color for active status
    marginBottom: 6,
  },
  tagBadge: {
    backgroundColor: "#BB86FC",
    borderRadius: 12,
    paddingVertical: 2,
    paddingHorizontal: 8,
    marginRight: 5,
    marginTop: 4,
  },
  tagBadgeText: {
    color: "#fff",
    fontSize: 10,
  },
  emptyText: {
    textAlign: "center",
    color: "#bbb",
    fontSize: 14,
    marginTop: 20,
  },
});
