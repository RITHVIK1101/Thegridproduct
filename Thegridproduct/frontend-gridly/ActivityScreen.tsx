// ActivityScreen.tsx

import React, { useEffect, useState, useContext, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  TextInput,
  ScrollView,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import BottomNavBar from "./components/BottomNavbar";
import { NGROK_URL } from "@env";
import { useNavigation, useIsFocused } from "@react-navigation/native";
import { UserContext } from "./UserContext";

// Define types for Product, Gig (Service), and ProductRequest
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

type ProductRequest = {
  id: string;
  productId: string;
  productName: string;
  description: string;
  status: string;
  createdAt: string;
};

const ActivityScreen: React.FC = () => {
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const { userId, token } = useContext(UserContext);

  const [activeSegment, setActiveSegment] = useState<
    "Products" | "Gigs" | "Requested"
  >("Products");

  // Products State
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [errorProducts, setErrorProducts] = useState<string | null>(null);

  // Gigs State
  const [gigs, setGigs] = useState<Gig[]>([]);
  const [filteredGigs, setFilteredGigs] = useState<Gig[]>([]);
  const [errorGigs, setErrorGigs] = useState<string | null>(null);

  // Requested Products State
  const [requestedProducts, setRequestedProducts] = useState<ProductRequest[]>(
    []
  );
  const [filteredRequestedProducts, setFilteredRequestedProducts] = useState<
    ProductRequest[]
  >([]);
  const [errorRequested, setErrorRequested] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState<string>("");
  const inputRef = useRef<TextInput>(null);

  // Fetch user products
  const fetchUserProducts = async () => {
    if (!userId || !token) {
      setErrorProducts("User not logged in.");
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
            (product.title || "")
              .toLowerCase()
              .includes(searchQuery.toLowerCase())
          )
        );
      }
    } catch (err) {
      console.error("Error fetching products:", err);
      setErrorProducts(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred while fetching products."
      );
    }
  };

  // Fetch user gigs
  const fetchUserGigs = async () => {
    if (!userId || !token) {
      setErrorGigs("User not logged in.");
      return;
    }
    try {
      const response = await fetch(`${NGROK_URL}/services/user`, {
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
        throw new Error("Failed to fetch your gigs. Server error.");
      } else if (!contentType || !contentType.includes("application/json")) {
        const errorText = await response.text();
        console.error("Unexpected content-type:", contentType, errorText);
        throw new Error("Unexpected response format.");
      }
      const data = await response.json();
      const gigsData: Gig[] = data.gigs || [];
      if (!gigsData || gigsData.length === 0) {
        setGigs([]);
        setFilteredGigs([]);
      } else {
        setGigs(gigsData);
        setFilteredGigs(
          gigsData.filter((gig) =>
            (gig.title || "").toLowerCase().includes(searchQuery.toLowerCase())
          )
        );
      }
    } catch (err) {
      console.error("Error fetching gigs:", err);
      setErrorGigs(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred while fetching gigs."
      );
    }
  };

  // Fetch user requested products
  const fetchUserRequestedProducts = async () => {
    if (!userId || !token) {
      setErrorRequested("User not logged in.");
      return;
    }
    try {
      const response = await fetch(`${NGROK_URL}/requests/my`, {
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
        throw new Error(
          "Failed to fetch your requested products. Server error."
        );
      } else if (!contentType || !contentType.includes("application/json")) {
        const errorText = await response.text();
        console.error("Unexpected content-type:", contentType, errorText);
        throw new Error("Unexpected response format.");
      }
      const data: ProductRequest[] = await response.json();
      if (!data || data.length === 0) {
        setRequestedProducts([]);
        setFilteredRequestedProducts([]);
      } else {
        setRequestedProducts(data);
        setFilteredRequestedProducts(
          data.filter((req) =>
            req.productName
              ? req.productName
                  .toLowerCase()
                  .includes(searchQuery.toLowerCase())
              : false
          )
        );
      }
    } catch (err) {
      console.error("Error fetching requested products:", err);
      setErrorRequested(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred while fetching requested products."
      );
    }
  };

  // Fetch data based on active segment
  const fetchData = async () => {
    if (activeSegment === "Products") {
      setErrorProducts(null);
      await fetchUserProducts();
    } else if (activeSegment === "Gigs") {
      setErrorGigs(null);
      await fetchUserGigs();
    } else if (activeSegment === "Requested") {
      setErrorRequested(null);
      await fetchUserRequestedProducts();
    }
  };

  // Handle deletion of a product
  const handleDeleteProduct = (productId: string) => {
    Alert.alert(
      "Confirm Deletion",
      "Are you sure you want to delete this product?",
      [
        { text: "No", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteProduct(productId),
        },
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
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteGig(gigId),
        },
      ],
      { cancelable: true }
    );
  };

  const deleteRequestedProduct = async (requestId: string) => {
    if (!token) {
      Alert.alert("Error", "You are not authenticated.");
      return;
    }

    try {
      const response = await fetch(`${NGROK_URL}/requests/${requestId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      // Handle non-JSON responses gracefully
      const contentType = response.headers.get("content-type");
      let responseData;
      if (contentType && contentType.includes("application/json")) {
        responseData = await response.json();
      } else {
        responseData = { error: await response.text() };
      }

      if (!response.ok) {
        console.error("Delete request failed:", responseData);
        Alert.alert(
          "Error",
          responseData.error || "Failed to remove the requested product."
        );
        return;
      }

      // Remove the deleted request from state
      setRequestedProducts((prev) =>
        prev.filter((req) => req.id !== requestId)
      );
      setFilteredRequestedProducts((prev) =>
        prev.filter((req) => req.id !== requestId)
      );

      // ✅ Refetch the list after deletion
      fetchUserRequestedProducts();

      Alert.alert("Success", "Requested product removed successfully.");
    } catch (error) {
      console.error("Error removing requested product:", error);
      Alert.alert(
        "Error",
        error instanceof Error ? error.message : "An unexpected error occurred."
      );
    }
  };

  const handleDeleteRequestedProduct = (requestId: string) => {
    Alert.alert(
      "Confirm Deletion",
      "Are you sure you want to remove this requested product?",
      [
        { text: "No", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => deleteRequestedProduct(requestId),
        },
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
    navigation.navigate("JobDetail", { jobId: gigId });
  };

  // Navigate to view requested product details (placeholder)
  const navigateToViewRequestedProduct = (requestedProductId: string) => {
    Alert.alert("Info", "Requested Products feature coming soon!");
  };

  // ---------------------------
  // New Component: GigItem
  // ---------------------------
  const GigItem: React.FC<{ item: Gig }> = ({ item }) => {
    const [expanded, setExpanded] = useState(false);
    const maxDescriptionLength = 100;
    const description =
      item.description.length > maxDescriptionLength && !expanded
        ? item.description.substring(0, maxDescriptionLength) + "..."
        : item.description;
    const toggleExpanded = () => setExpanded(!expanded);
    const daysActive = calculateDaysActive(item.postedDate);
    const status =
      daysActive > 30 ? "Expired" : `Active for ${daysActive} days`;

    return (
      <View style={styles.itemContainer}>
        <TouchableOpacity
          onPress={() => navigation.navigate("JobDetail", { jobId: item.id })}
          style={styles.itemTouchArea}
          activeOpacity={0.7}
        >
          <Text style={styles.itemTitle}>{item.title || "No Title"}</Text>
          <Text style={styles.itemPrice}>
            {item.price === "Open to Communication"
              ? item.price
              : `$${item.price}`}
          </Text>
          <Text style={styles.itemDate}>
            Posted: {new Date(item.postedDate).toDateString()}
          </Text>
          <Text style={styles.itemCategory}>Category: {item.category}</Text>
          <Text style={styles.itemDescription}>{description}</Text>
          {item.description.length > maxDescriptionLength && (
            <TouchableOpacity onPress={toggleExpanded}>
              <Text style={styles.readMore}>
                {expanded ? "Show Less" : "Read More"}
              </Text>
            </TouchableOpacity>
          )}
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

  // Render a single product item
  const renderProduct = ({ item }: { item: Product }) => {
    const daysActive = calculateDaysActive(item.postedDate);
    const status =
      daysActive > 30 ? "Expired" : `Active for ${daysActive} days`;
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
          <Text style={styles.itemStatus}>{status}</Text>
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

  // Render a single requested product item
  const renderRequestedProduct = ({ item }: { item: ProductRequest }) => {
    const daysActive = calculateDaysActive(item.createdAt);
    const status =
      daysActive > 30 ? "Expired" : `Active for ${daysActive} days`;
    return (
      <View style={styles.itemContainer}>
        <TouchableOpacity
          onPress={() => navigateToViewRequestedProduct(item.id)}
          style={styles.itemTouchArea}
          activeOpacity={0.7}
        >
          <Text style={styles.itemTitle}>
            {item.productName || "No Product Name"}
          </Text>
          <Text style={styles.itemDescription}>
            {item.description || "No Description"}
          </Text>
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
            onPress={() => handleDeleteRequestedProduct(item.id)}
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

  // Render requested products using FlatList without a default empty message
  const renderRequested = () => (
    <FlatList
      data={filteredRequestedProducts}
      keyExtractor={(item) => item.id}
      renderItem={renderRequestedProduct}
      contentContainerStyle={styles.listContainer}
      showsVerticalScrollIndicator={false}
      onRefresh={handleRefresh}
      refreshing={false}
      ItemSeparatorComponent={renderSeparator}
    />
  );

  const renderSeparator = () => <View style={styles.separator} />;

  // Render list based on the active segment
  const renderList = () => {
    if (activeSegment === "Products") {
      return (
        <FlatList
          data={filteredProducts}
          keyExtractor={(item) => item.id}
          renderItem={renderProduct}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          onRefresh={handleRefresh}
          refreshing={false}
          ItemSeparatorComponent={renderSeparator}
        />
      );
    } else if (activeSegment === "Gigs") {
      return (
        <FlatList
          data={filteredGigs}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <GigItem item={item} />}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          onRefresh={handleRefresh}
          refreshing={false}
          ItemSeparatorComponent={renderSeparator}
        />
      );
    } else if (activeSegment === "Requested") {
      return renderRequested();
    }
  };

  // Handle pull-to-refresh
  const handleRefresh = () => {
    fetchData();
  };

  // Update filtered data when searchQuery or underlying data changes
  useEffect(() => {
    if (activeSegment === "Products") {
      const filtered = products.filter((product) =>
        (product.title || "").toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredProducts(filtered);
    } else if (activeSegment === "Gigs") {
      const filtered = gigs.filter((gig) =>
        (gig.title || "").toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredGigs(filtered);
    } else if (activeSegment === "Requested") {
      const filtered = requestedProducts.filter((req) =>
        req.productName
          ? req.productName.toLowerCase().includes(searchQuery.toLowerCase())
          : false
      );
      setFilteredRequestedProducts(filtered);
    }
  }, [searchQuery, products, gigs, requestedProducts, activeSegment]);

  // Fetch data when the screen is focused or the active segment changes
  useEffect(() => {
    if (isFocused) {
      fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFocused, activeSegment]);

  return (
    <View style={styles.mainContainer}>
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
          <TouchableOpacity
            style={[
              styles.segment,
              activeSegment === "Requested" && styles.activeSegment,
            ]}
            onPress={() => setActiveSegment("Requested")}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.segmentText,
                activeSegment === "Requested" && styles.activeSegmentText,
              ]}
            >
              Requested
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.searchContainer}>
          <Ionicons
            name="search"
            size={20}
            color="#fff"
            style={styles.searchIcon}
          />
          <View style={styles.searchLineContainer}>
            <TextInput
              ref={inputRef}
              style={styles.searchInput}
              placeholder={
                activeSegment === "Products"
                  ? "Search your products..."
                  : activeSegment === "Gigs"
                  ? "Search your gigs..."
                  : "Search requested products..."
              }
              placeholderTextColor="#bbb"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCorrect={false}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearchQuery("")}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="close-circle"
                  size={20}
                  color="#fff"
                  style={styles.clearIcon}
                />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {renderList()}

      <BottomNavBar />
    </View>
  );
};

export default ActivityScreen;

const styles = StyleSheet.create({
  mainContainer: {
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
    backgroundColor: "#BB86FC",
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
    paddingBottom: 100, // prevent content from being hidden behind BottomNavBar
    paddingTop: 10,
    flexGrow: 1,
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
  readMore: {
    fontSize: 12,
    color: "#BB86FC",
    fontWeight: "600",
    marginTop: 4,
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
});
