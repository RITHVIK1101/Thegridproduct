// ActivityScreen.tsx

import React, { useEffect, useState, useContext } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
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
      if (!data || data.length === 0) {
        console.log("No products available.");
        setProducts([]);
        setFilteredProducts([]); // Clear filtered products
        setError("No products posted."); // Optional: Use an error message for UI
      } else {
        setProducts(data);
        setFilteredProducts(data); // Initialize filtered products
      }
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

  // Function to handle deleting a product
  const handleDeleteProduct = (productId: string) => {
    Alert.alert(
      "Confirm Deletion",
      "Are you sure you want to delete this product?",
      [
        {
          text: "No",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteProduct(productId),
        },
      ],
      { cancelable: true }
    );
  };

  // Function to perform the DELETE request
  const deleteProduct = async (productId: string) => {
    if (!token) {
      Alert.alert("Error", "You are not authenticated.");
      return;
    }

    try {
      const response = await fetch(`${NGROK_URL}/products/${productId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        throw new Error(
          `Unexpected response format: ${response.status} ${text}`
        );
      }

      const data = await response.json();

      if (response.ok) {
        // Remove the deleted product from the local state
        setProducts((prevProducts) =>
          prevProducts.filter((product) => product.id !== productId)
        );
        setFilteredProducts((prevProducts) =>
          prevProducts.filter((product) => product.id !== productId)
        );
        Alert.alert("Success", "Product deleted successfully.");
      } else {
        // Handle errors returned from the backend
        const errorMessage = data.error || "Failed to delete the product.";
        Alert.alert("Error", errorMessage);
      }
    } catch (error) {
      console.error("Error deleting product:", error);
      Alert.alert(
        "Error",
        error instanceof Error ? error.message : "An unexpected error occurred."
      );
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
      <View style={styles.itemContainer}>
        {/* Icon Container */}
        <View style={styles.iconContainer}>
          {/* Functional Edit Button */}
          <TouchableOpacity
            style={styles.editIconTouchable}
            onPress={() => navigateToEditProduct(item.id)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            activeOpacity={0.7}
            accessibilityLabel="Edit Product"
          >
            <Ionicons name="pencil-outline" size={20} color="#4CAF50" />
          </TouchableOpacity>

          {/* Functional Delete Button */}
          <TouchableOpacity
            style={styles.deleteIconTouchable}
            onPress={() => handleDeleteProduct(item.id)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            activeOpacity={0.7}
            accessibilityLabel="Delete Product"
          >
            <Ionicons name="trash-outline" size={20} color="#FF3B30" />
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
      </View>
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
          size={18}
          color="#FFFFFF"
          style={styles.searchIcon}
        />
        <TextInput
          style={styles.searchInput}
          placeholder="Search your products..."
          placeholderTextColor="#AAAAAA"
          value={searchQuery}
          onChangeText={setSearchQuery}
          accessibilityLabel="Search Your Products"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity
            onPress={() => setSearchQuery("")}
            style={styles.clearIconTouchable}
            accessibilityLabel="Clear Search"
          >
            <Ionicons name="close-circle" size={18} color="#FF3B30" />
          </TouchableOpacity>
        )}
      </View>

      {/* Display Loading, Error, or List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#34C759" />
          <Text style={styles.loadingText}>Loading your products...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
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
    backgroundColor: "#000000", // Pure black background
    padding: 10, // Reduced padding for smaller layout
    paddingBottom: 60, // Adjust based on BottomNavBar height (e.g., 60)
    paddingTop: 15,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1E1E1E", // Darker background for better contrast
    borderRadius: 20, // Reduced border radius for compactness
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginHorizontal: 5,
    marginBottom: 10,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 14, // Smaller font size
  },
  clearIconTouchable: {
    marginLeft: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 5,
    color: "#34C759", // Green color for loading text
    fontSize: 12, // Smaller font size
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 10,
  },
  errorText: {
    color: "#FF3B30", // Red color for errors
    fontSize: 14,
    textAlign: "center",
    marginBottom: 5,
  },
  listContainer: {
    paddingHorizontal: 5,
  },
  itemContainer: {
    backgroundColor: "#1E1E1E", // Dark card background
    borderRadius: 8, // Reduced border radius
    padding: 10, // Reduced padding
    marginBottom: 10, // Reduced margin
    position: "relative",
    shadowColor: "#FFFFFF",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  iconContainer: {
    flexDirection: "row",
    position: "absolute",
    top: 8,
    right: 8,
  },
  editIconTouchable: {
    padding: 8, // Smaller padding for compactness
    borderRadius: 6,
    backgroundColor: "#2C2C2C", // Slightly lighter background for visibility
    marginRight: 6, // Space between edit and delete icons
  },
  deleteIconTouchable: {
    padding: 8, // Smaller padding for compactness
    borderRadius: 6,
    backgroundColor: "#2C2C2C", // Slightly lighter background for visibility
  },
  itemTitle: {
    fontSize: 16, // Smaller font size
    fontWeight: "600",
    color: "#FFFFFF", // White color for titles
    marginBottom: 3,
  },
  itemPrice: {
    fontSize: 14, // Smaller font size
    color: "#34C759", // Subtle green for price
    marginBottom: 3,
  },
  itemDate: {
    fontSize: 12, // Smaller font size
    color: "#AAAAAA", // Light grey for date
    marginBottom: 3,
  },
  itemStatus: {
    fontSize: 12, // Smaller font size
    color: "#FF3B30", // Subtle red for status (e.g., Expired)
    marginBottom: 6,
  },
  tagBadge: {
    backgroundColor: "#4A4A4A", // Dark grey for tags to replace orange
    borderRadius: 10,
    paddingVertical: 2,
    paddingHorizontal: 8,
    marginRight: 5,
    marginTop: 2,
  },
  tagBadgeText: {
    color: "#FFFFFF",
    fontSize: 10, // Smaller font size
  },
  emptyText: {
    textAlign: "center",
    color: "#AAAAAA",
    fontSize: 14, // Slightly larger for better visibility
    marginTop: 15,
  },
});
