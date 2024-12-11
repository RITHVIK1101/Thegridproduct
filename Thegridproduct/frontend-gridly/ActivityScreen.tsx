// ActivityScreen.tsx

import React, { useEffect, useState, useContext, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  TextInput,
  ScrollView
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import BottomNavBar from "./components/BottomNavbar";
import { NGROK_URL } from "@env";
import { useNavigation, useIsFocused } from "@react-navigation/native";
import { UserContext } from "./UserContext";

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
  const isFocused = useIsFocused();
  const { userId, token } = useContext(UserContext);

  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");

  const inputRef = useRef<TextInput>(null);

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

      const contentType = response.headers.get("content-type");
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Error response text:", errorText);
        throw new Error("Failed to fetch your products. Server error.");
      } else if (!contentType || !contentType.includes("application/json")) {
        const errorText = await response.text();
        console.error("Unexpected content-type:", contentType, errorText);
        throw new Error("Unexpected response format.");
      }

      const data: Product[] = await response.json();
      if (!data || data.length === 0) {
        setProducts([]);
        setFilteredProducts([]);
        setError("No products posted.");
      } else {
        setProducts(data);
        setFilteredProducts(data);
      }
    } catch (err) {
      console.error("Error fetching products:", err);
      setError(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred while fetching products."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProduct = (productId: string) => {
    Alert.alert(
      "Confirm Deletion",
      "Are you sure you want to delete this product?",
      [
        { text: "No", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => deleteProduct(productId) },
      ],
      { cancelable: true }
    );
  };

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
        throw new Error(`Unexpected response: ${response.status} ${text}`);
      }

      const data = await response.json();

      if (response.ok) {
        setProducts((prev) => prev.filter((p) => p.id !== productId));
        setFilteredProducts((prev) => prev.filter((p) => p.id !== productId));
        Alert.alert("Success", "Product deleted successfully.");
      } else {
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

  const calculateDaysActive = (postedDate: string): number => {
    const posted = new Date(postedDate);
    const now = new Date();
    const differenceInTime = now.getTime() - posted.getTime();
    return Math.floor(differenceInTime / (1000 * 3600 * 24));
  };

  const navigateToEditProduct = (productId: string) => {
    navigation.navigate("EditProduct", { productId });
  };

  useEffect(() => {
    if (isFocused) {
      setLoading(true);
      setError(null);
      setSearchQuery("");
      fetchUserProducts();
    }
  }, [isFocused]);

  useEffect(() => {
    const filtered = products.filter((product) =>
      product.title.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredProducts(filtered);
  }, [searchQuery, products]);

  const handleRefresh = () => {
    setLoading(true);
    setError(null);
    fetchUserProducts();
  };

  const renderProduct = ({ item }: { item: Product }) => {
    const daysActive = calculateDaysActive(item.postedDate);
    const status = daysActive > 30 ? "Expired" : `Active for ${daysActive} days`;

    return (
      <View style={styles.productContainer}>
        {/* Touchable area for navigating to edit */}
        <TouchableOpacity
          onPress={() => navigateToEditProduct(item.id)}
          style={styles.productTouchArea}
          activeOpacity={0.7}
        >
          <Text style={styles.productTitle}>{item.title || "No Title"}</Text>
          <Text style={styles.productPrice}>${item.price.toFixed(2)}</Text>
          <Text style={styles.productDate}>
            Posted: {new Date(item.postedDate).toDateString()}
          </Text>
          <Text
            style={[
              styles.productStatus,
              status.includes("Expired") && { color: "#FF3B30" },
            ]}
          >
            {status}
          </Text>
          {item.selectedTags.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginTop: 4}}>
              {item.selectedTags.map((tag, index) => (
                <View key={index} style={styles.tagBadge}>
                  <Text style={styles.tagBadgeText}>{tag}</Text>
                </View>
              ))}
            </ScrollView>
          )}
        </TouchableOpacity>

        {/* Icons on top */}
        <View style={styles.iconRow}>
          <TouchableOpacity
            onPress={() => navigateToEditProduct(item.id)}
            style={styles.iconTouchable}
            hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
            activeOpacity={0.7}
          >
            <Ionicons name="pencil-outline" size={18} color="#BB86FC" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleDeleteProduct(item.id)}
            style={styles.iconTouchable}
            hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
            activeOpacity={0.7}
          >
            <Ionicons name="trash-outline" size={18} color="#FF3B30" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderSeparator = () => <View style={styles.separator} />;
  const renderFooter = () => (products.length > 0 ? <View style={styles.separator} /> : null);

  return (
    <View style={styles.container}>
      {/* Top Bar with always-visible search */}
      <View style={styles.topBar}>
        <Ionicons name="search" size={20} color="#fff" style={styles.searchIcon} />
        <View style={styles.searchLineContainer}>
          <TextInput
            ref={inputRef}
            style={styles.searchInput}
            placeholder="Search your products..."
            placeholderTextColor="#bbb"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCorrect={false}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")} activeOpacity={0.7}>
              <Ionicons name="close-circle" size={20} color="#fff" style={styles.clearIcon} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#BB86FC" />
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
          ListEmptyComponent={<Text style={styles.emptyText}>You have no products.</Text>}
          showsVerticalScrollIndicator={false}
          onRefresh={handleRefresh}
          refreshing={loading}
          ItemSeparatorComponent={renderSeparator}
          ListFooterComponent={renderFooter}
        />
      )}

      <BottomNavBar />
    </View>
  );
};

export default ActivityScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  topBar: {
    backgroundColor: "#000",
    paddingTop: 20,
    paddingBottom: 10,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchLineContainer: {
    borderBottomWidth: 1,
    borderBottomColor: "#fff",
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 2,
  },
  searchInput: {
    color: "#fff",
    fontSize: 14,
    paddingVertical: 3,
    paddingHorizontal: 2,
    flex: 1,
  },
  clearIcon: {
    marginLeft: 5,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 5,
    color: "#BB86FC",
    fontSize: 14,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  errorText: {
    color: "#FF3B30",
    fontSize: 14,
    textAlign: "center",
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  productContainer: {
    position: "relative",
    paddingVertical: 15,
  },
  productTouchArea: {
    // The entire product details area is clickable for editing
  },
  iconRow: {
    position: "absolute",
    top: 15,
    right: 0,
    flexDirection: "row",
    zIndex: 1,
  },
  iconTouchable: {
    marginLeft: 15,
    padding: 5,
  },
  productTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  productPrice: {
    fontSize: 14,
    color: "#03DAC6",
    marginBottom: 4,
  },
  productDate: {
    fontSize: 12,
    color: "#AAAAAA",
    marginBottom: 4,
  },
  productStatus: {
    fontSize: 12,
    color: "#BB86FC",
    marginBottom: 4,
  },
  tagBadge: {
    backgroundColor: "#333",
    borderRadius: 10,
    paddingVertical: 3,
    paddingHorizontal: 8,
    marginRight: 5,
  },
  tagBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
  },
  separator: {
    height: 1,
    backgroundColor: "#222",
  },
  emptyText: {
    textAlign: "center",
    color: "#888",
    fontSize: 14,
    marginTop: 50,
  },
});
