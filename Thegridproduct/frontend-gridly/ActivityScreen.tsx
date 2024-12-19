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
  ScrollView,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import BottomNavBar from "./components/BottomNavbar";
import { NGROK_URL } from "@env";
import { useNavigation, useIsFocused } from "@react-navigation/native";
import { UserContext } from "./UserContext";

// Define types for Product and Gig (Service)
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

type Gig = {
  id: string; // mapped from _id
  userId: string;
  university: string;
  studentType: string;
  title: string;
  category: string;
  description: string;
  coverImage: string;
  price: string; // can be "Open to Communication" or something like "$25/hour"
  availability: string;
  additionalLinks: string[];
  additionalDocuments: string[];
  postedDate: string;
  expired: boolean;
  status: string;
  likeCount: number;
};

const ActivityScreen: React.FC = () => {
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const { userId, token } = useContext(UserContext);

  const [activeSegment, setActiveSegment] = useState<"Products" | "Gigs">("Products");
  const [products, setProducts] = useState<Product[]>([]);
  const [gigs, setGigs] = useState<Gig[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [filteredGigs, setFilteredGigs] = useState<Gig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");

  const inputRef = useRef<TextInput>(null);

  // Fetch user products
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
      } else {
        setProducts(data);
        setFilteredProducts(
          data.filter((product) =>
            product.title.toLowerCase().includes(searchQuery.toLowerCase())
          )
        );
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

  // Fetch all gigs, then filter by userId
  const fetchUserGigs = async () => {
    if (!userId || !token) {
      setError("User not logged in.");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${NGROK_URL}/services`, {
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
        throw new Error("Failed to fetch gigs. Server error.");
      } else if (!contentType || !contentType.includes("application/json")) {
        const errorText = await response.text();
        console.error("Unexpected content-type:", contentType, errorText);
        throw new Error("Unexpected response format.");
      }

      const data = await response.json();

      // The GetAllGigsHandler might return a pagination structure like:
      // {
      //   "page": number,
      //   "limit": number,
      //   "totalPages": number,
      //   "totalCount": number,
      //   "gigs": [...],
      //   "count": number
      // }
      //
      // Or it might return just an array of gigs.
      // We'll handle both scenarios.
      const allGigs = Array.isArray(data) ? data : data.gigs || data;

      const mappedGigs: Gig[] = allGigs.map((gig: any) => ({
        id: gig._id,
        userId: gig.userId,
        university: gig.university,
        studentType: gig.studentType,
        title: gig.title,
        category: gig.category,
        description: gig.description,
        coverImage: gig.coverImage,
        price: gig.price,
        availability: gig.availability,
        additionalLinks: gig.additionalLinks || [],
        additionalDocuments: gig.additionalDocuments || [],
        postedDate: gig.postedDate,
        expired: gig.expired,
        status: gig.status,
        likeCount: gig.likeCount,
      }));

      // Filter gigs by the current user's ID
      const userGigs = mappedGigs.filter((gig) => gig.userId === userId);

      if (userGigs.length === 0) {
        setGigs([]);
        setFilteredGigs([]);
      } else {
        setGigs(userGigs);
        setFilteredGigs(
          userGigs.filter((gig) =>
            gig.title.toLowerCase().includes(searchQuery.toLowerCase())
          )
        );
      }
    } catch (err) {
      console.error("Error fetching gigs:", err);
      setError(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred while fetching gigs."
      );
    } finally {
      setLoading(false);
    }
  };

  // Fetch data based on active segment
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    if (activeSegment === "Products") {
      await fetchUserProducts();
    } else {
      await fetchUserGigs();
    }
  };

  // Handle deletion of a product
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

  // Handle deletion of a gig
  const handleDeleteGig = (gigId: string) => {
    Alert.alert(
      "Confirm Deletion",
      "Are you sure you want to delete this gig?",
      [
        { text: "No", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => deleteGig(gigId) },
      ],
      { cancelable: true }
    );
  };

  // Delete a product
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

  // Delete a gig
  const deleteGig = async (gigId: string) => {
    if (!token) {
      Alert.alert("Error", "You are not authenticated.");
      return;
    }

    try {
      const response = await fetch(`${NGROK_URL}/services/${gigId}`, {
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
        setGigs((prev) => prev.filter((g) => g.id !== gigId));
        setFilteredGigs((prev) => prev.filter((g) => g.id !== gigId));
        Alert.alert("Success", "Gig deleted successfully.");
      } else {
        const errorMessage = data.error || "Failed to delete the gig.";
        Alert.alert("Error", errorMessage);
      }
    } catch (error) {
      console.error("Error deleting gig:", error);
      Alert.alert(
        "Error",
        error instanceof Error ? error.message : "An unexpected error occurred."
      );
    }
  };

  // Calculate days active
  const calculateDaysActive = (postedDate: string): number => {
    const posted = new Date(postedDate);
    const now = new Date();
    const differenceInTime = now.getTime() - posted.getTime();
    return Math.floor(differenceInTime / (1000 * 3600 * 24));
  };

  // Navigate to edit product screen
  const navigateToEditProduct = (productId: string) => {
    navigation.navigate("EditProduct", { productId });
  };

  // Navigate to edit gig screen
  const navigateToEditGig = (gigId: string) => {
    navigation.navigate("EditGig", { gigId });
  };

  // Fetch data when screen is focused or active segment changes
  useEffect(() => {
    if (isFocused) {
      fetchData();
    }
  }, [isFocused, activeSegment]);

  // Filter data based on search query
  useEffect(() => {
    if (activeSegment === "Products") {
      const filtered = products.filter((product) =>
        product.title.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredProducts(filtered);
    } else {
      const filtered = gigs.filter((gig) =>
        gig.title.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredGigs(filtered);
    }
  }, [searchQuery, products, gigs, activeSegment]);

  // Handle pull-to-refresh
  const handleRefresh = () => {
    fetchData();
  };

  // Render a single product item
  const renderProduct = ({ item }: { item: Product }) => {
    const daysActive = calculateDaysActive(item.postedDate);
    const status = daysActive > 30 ? "Expired" : `Active for ${daysActive} days`;

    return (
      <View style={styles.itemContainer}>
        <TouchableOpacity
          onPress={() => navigateToEditProduct(item.id)}
          style={styles.itemTouchArea}
          activeOpacity={0.7}
        >
          <Text style={styles.itemTitle}>{item.title || "No Title"}</Text>
          <Text style={styles.itemPrice}>${item.price.toFixed(2)}</Text>
          <Text style={styles.itemDate}>
            Posted: {new Date(item.postedDate).toDateString()}
          </Text>
          <Text
            style={[
              styles.itemStatus,
              status.includes("Expired") && { color: "#FF3B30" },
            ]}
          >
            {status}
          </Text>
          {item.selectedTags?.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginTop: 4 }}
            >
              {item.selectedTags.map((tag, index) => (
                <View key={index} style={styles.tagBadge}>
                  <Text style={styles.tagBadgeText}>{tag}</Text>
                </View>
              ))}
            </ScrollView>
          )}
        </TouchableOpacity>

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

  // Render a single gig item
  const renderGig = ({ item }: { item: Gig }) => {
    const daysActive = calculateDaysActive(item.postedDate);
    const status = daysActive > 30 ? "Expired" : `Active for ${daysActive} days`;

    return (
      <View style={styles.itemContainer}>
        <TouchableOpacity
          onPress={() => navigateToEditGig(item.id)}
          style={styles.itemTouchArea}
          activeOpacity={0.7}
        >
          <Text style={styles.itemTitle}>{item.title || "No Title"}</Text>
          <Text style={styles.itemPrice}>
            {item.price === "Open to Communication" ? item.price : `$${item.price}`}
          </Text>
          <Text style={styles.itemDate}>
            Posted: {new Date(item.postedDate).toDateString()}
          </Text>
          <Text style={styles.itemCategory}>Category: {item.category}</Text>
          <Text style={styles.itemDescription}>{item.description}</Text>
          <Text
            style={[
              styles.itemStatus,
              status.includes("Expired") && { color: "#FF3B30" },
            ]}
          >
            {status}
          </Text>
        </TouchableOpacity>

        <View style={styles.iconRow}>
          <TouchableOpacity
            onPress={() => navigateToEditGig(item.id)}
            style={styles.iconTouchable}
            hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
            activeOpacity={0.7}
          >
            <Ionicons name="pencil-outline" size={18} color="#BB86FC" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleDeleteGig(item.id)}
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

  const renderFooter = () =>
    activeSegment === "Products" ? <View style={styles.separator} /> : null;

  const renderList = () => {
    if (activeSegment === "Products") {
      return (
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
      );
    } else {
      return (
        <FlatList
          data={filteredGigs}
          keyExtractor={(item) => item.id}
          renderItem={renderGig}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={<Text style={styles.emptyText}>You have no gigs.</Text>}
          showsVerticalScrollIndicator={false}
          onRefresh={handleRefresh}
          refreshing={loading}
          ItemSeparatorComponent={renderSeparator}
          ListFooterComponent={null}
        />
      );
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <View style={styles.segmentedControlContainer}>
          <TouchableOpacity
            style={[
              styles.segment,
              activeSegment === "Products" && styles.activeSegment,
            ]}
            onPress={() => setActiveSegment("Products")}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.segmentText,
                activeSegment === "Products" && styles.activeSegmentText,
              ]}
            >
              Products
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.segment,
              activeSegment === "Gigs" && styles.activeSegment,
            ]}
            onPress={() => setActiveSegment("Gigs")}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.segmentText,
                activeSegment === "Gigs" && styles.activeSegmentText,
              ]}
            >
              Gigs
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#fff" style={styles.searchIcon} />
          <View style={styles.searchLineContainer}>
            <TextInput
              ref={inputRef}
              style={styles.searchInput}
              placeholder={
                activeSegment === "Products"
                  ? "Search your products..."
                  : "Search your gigs..."
              }
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
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#BB86FC" />
          <Text style={styles.loadingText}>
            Loading your {activeSegment.toLowerCase()}...
          </Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        renderList()
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
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  segmentedControlContainer: {
    flexDirection: "row",
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "#333",
    marginBottom: 15,
  },
  segment: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  activeSegment: {
    backgroundColor: "#FFFFFF",
  },
  segmentText: {
    color: "#fff",
    fontSize: 14,
  },
  activeSegmentText: {
    color: "#000",
    fontWeight: "600",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  searchIcon: {
    marginRight: 8,
  },
  searchLineContainer: {
    borderBottomWidth: 1,
    borderBottomColor: "#fff",
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: 2,
  },
  searchInput: {
    color: "#fff",
    fontSize: 14,
    paddingVertical: 5,
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
    paddingTop: 10,
  },
  itemContainer: {
    position: "relative",
    paddingVertical: 15,
  },
  itemTouchArea: {},
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
  itemTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  itemPrice: {
    fontSize: 14,
    color: "#03DAC6",
    marginBottom: 4,
  },
  itemDate: {
    fontSize: 12,
    color: "#AAAAAA",
    marginBottom: 4,
  },
  itemCategory: {
    fontSize: 12,
    color: "#FFB74D",
    marginBottom: 4,
  },
  itemDescription: {
    fontSize: 12,
    color: "#CCCCCC",
    marginBottom: 4,
  },
  itemStatus: {
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
  listFooter: {
    height: 20,
  },
});
