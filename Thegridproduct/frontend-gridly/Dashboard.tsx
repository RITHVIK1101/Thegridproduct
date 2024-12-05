// Dashboard.tsx

import React, { useState, useEffect, useContext } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Modal,
  ActivityIndicator,
  Alert,
  ScrollView,
  Dimensions,
  TextInput,
  FlatList,
} from "react-native";
import {
  RouteProp,
  useNavigation,
  CommonActions,
} from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import Ionicons from "react-native-vector-icons/Ionicons";
import BottomNavBar from "./components/BottomNavbar"; // Ensure this path is correct
import { NGROK_URL } from "@env";
import { UserContext } from "./UserContext";
import { RootStackParamList } from "./navigationTypes";
import {
  PanGestureHandler,
  TapGestureHandler,
  GestureHandlerRootView,
  State,
} from "react-native-gesture-handler";

type DashboardProps = {
  route: RouteProp<RootStackParamList, "Dashboard">;
};

type Product = {
  id: string;
  title: string;
  price: number;
  description: string;
  category: string;
  images: string[];
  university: string;
  ownerId: string;
  postedDate: string;
  rating?: number;
  quality?: string;
};

type CartItem = {
  productId: string;
  quantity: number;
};

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get("window");

// Define constants for margins and heights
const SEARCH_BAR_HEIGHT = 50;
// Removed NAVBAR_HEIGHT and GAP_MARGIN as BottomNavBar is handled separately

const Dashboard: React.FC<DashboardProps> = ({ route }) => {
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);

  // State for Product Details Modal
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isDetailsModalVisible, setIsDetailsModalVisible] = useState(false);

  // State for Campus Selection
  const [campusMode, setCampusMode] = useState<"In Campus" | "Both">(
    "In Campus"
  );

  // State for Search Query
  const [searchQuery, setSearchQuery] = useState<string>("");

  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();

  const { userId, token, institution, clearUser } = useContext(UserContext);

  // Available Filter Categories
  const categories = [
    "#Everything",
    "#FemaleClothing",
    "#MensClothing",
    "#Other",
  ];

  // Campus Options with Labels and Values
  const campusOptions: Array<{ label: string; value: "In Campus" | "Both" }> = [
    { label: "In Campus", value: "In Campus" },
    { label: "Both In and Out of Campus", value: "Both" },
  ];

  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] =
    useState<string>("#Everything");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // State for Description Modal
  const [isDescriptionModalVisible, setIsDescriptionModalVisible] =
    useState(false);
  const [selectedProductDescription, setSelectedProductDescription] =
    useState<string>("");

  // State for Cart Update Indicator
  const [cartUpdated, setCartUpdated] = useState(false);

  // State for Cart Items
  const [cartItems, setCartItems] = useState<CartItem[]>([]);

  // State to track the current product index
  const [currentIndex, setCurrentIndex] = useState(0);

  // Function to fetch cart items
  const fetchCart = async () => {
    if (!userId || !token) return;
    try {
      const response = await fetch(`${NGROK_URL}/cart`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 401) {
        // Unauthorized: Clear user data and navigate to Login
        Alert.alert(
          "Session Expired",
          "Your session has expired. Please log in again.",
          [
            {
              text: "OK",
              onPress: async () => {
                await clearUser();
                navigation.dispatch(
                  CommonActions.reset({
                    index: 0,
                    routes: [{ name: "Login" }],
                  })
                );
              },
            },
          ]
        );
        return;
      }

      if (!response.ok) {
        const responseText = await response.text();
        console.error("Error response text:", responseText);
        throw new Error(
          "Failed to fetch cart. Server responded with an error."
        );
      }

      const data = await response.json();

      // Assuming the cart data has an 'items' array with 'productId' and 'quantity'
      if (data && Array.isArray(data.items)) {
        setCartItems(data.items);
      } else {
        console.error("Invalid cart data structure:", data);
        throw new Error("Received invalid cart data from server.");
      }
    } catch (err) {
      console.error("Fetch Cart Error:", err);
      Alert.alert("Error", "Could not fetch cart data.");
    }
  };

  // Function to add product to cart
  const addToCart = async (product: Product) => {
    if (!userId || !token) {
      Alert.alert("Error", "User not authenticated.");
      return;
    }

    // Check if product is already in cart
    const isAlreadyInCart = cartItems.some(
      (item) => item.productId === product.id
    );

    if (isAlreadyInCart) {
      Alert.alert(
        "Item already in cart",
        "This product is already in your cart."
      );
      return;
    }

    try {
      const response = await fetch(`${NGROK_URL}/cart/add`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ productId: product.id, quantity: 1 }),
      });

      if (response.status === 401) {
        // Unauthorized: Clear user data and navigate to Login
        Alert.alert(
          "Session Expired",
          "Your session has expired. Please log in again.",
          [
            {
              text: "OK",
              onPress: async () => {
                await clearUser();
                navigation.dispatch(
                  CommonActions.reset({
                    index: 0,
                    routes: [{ name: "Login" }],
                  })
                );
              },
            },
          ]
        );
        return;
      }

      if (response.status === 409) {
        // Conflict: Product already in cart
        Alert.alert(
          "Item already in cart",
          "This product is already in your cart."
        );
        return;
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to add item to cart.");
      }

      Alert.alert("Success", "Product added to cart!");
      setCartUpdated(true); // Trigger cart update
    } catch (err) {
      console.error("Add to Cart Error:", err);
      Alert.alert("Error", "Could not add item to cart.");
    }
  };

  // Effect to reset cartUpdated state after 2 seconds
  useEffect(() => {
    if (cartUpdated) {
      fetchCart(); // Refresh cart data
      const timer = setTimeout(() => {
        setCartUpdated(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [cartUpdated]);

  // Fetch Products from Backend
  const fetchProducts = async () => {
    if (!userId || !token || !institution) {
      setError("User not logged in or incomplete profile.");
      setLoading(false);
      return;
    }

    try {
      let url = `${NGROK_URL}/products/all`;
      if (campusMode === "Both") {
        url += "?mode=outofcampus";
      }

      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 401) {
        Alert.alert(
          "Session Expired",
          "Your session has expired. Please log in again.",
          [
            {
              text: "OK",
              onPress: async () => {
                await clearUser();
                navigation.dispatch(
                  CommonActions.reset({
                    index: 0,
                    routes: [{ name: "Login" }],
                  })
                );
              },
            },
          ]
        );
        return;
      }

      if (!response.ok) {
        const responseText = await response.text();
        console.error("Error response text:", responseText);
        throw new Error(
          "Failed to fetch products. Server responded with an error."
        );
      }

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const responseText = await response.text();
        console.error("Unexpected content-type:", contentType);
        console.error("Response text:", responseText);
        throw new Error("Received unexpected content-type. Expected JSON.");
      }

      const data: Product[] = await response.json();

      if (!data || !Array.isArray(data) || data.length === 0) {
        // Handle empty product list
        setAllProducts([]);
        setFilteredProducts([]);
        setError(null); // Clear any previous error
        setLoading(false);
        return; // Stop further processing
      }

      // If Both mode, all products except user's own are already fetched
      // If In Campus mode, ensure that university matches and exclude user's own products
      let filtered: Product[] = data;

      if (campusMode === "In Campus") {
        filtered = data.filter(
          (product) =>
            product.ownerId !== userId && product.university === institution
        );
      }

      // Further filter based on selected category and search query
      let finalFiltered = filtered;

      if (selectedCategory !== "#Everything") {
        finalFiltered = finalFiltered.filter(
          (product) => product.category === selectedCategory
        );
      }

      if (searchQuery.trim() !== "") {
        const query = searchQuery.trim().toLowerCase();
        finalFiltered = finalFiltered.filter((product) =>
          product.title.toLowerCase().includes(query)
        );
      }

      setAllProducts(filtered);
      setFilteredProducts(finalFiltered);
      setError(null); // Clear any previous error
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

  // Handle swiping actions
  const handleSwipe = (direction: "left" | "right" | "up") => {
    const product = filteredProducts[currentIndex];

    if (direction === "up") {
      // Open description modal
      setSelectedProductDescription(product.description);
      setIsDescriptionModalVisible(true);
      return; // Do not move to next product
    }

    if (direction === "right") {
      // Add to cart
      addToCart(product);
      return; // Do not move to next product
    }

    if (direction === "left") {
      // Move to the next product
      if (currentIndex < filteredProducts.length - 1) {
        setCurrentIndex(currentIndex + 1);
      } else {
        Alert.alert("End of List", "No more products available.");
        // Optionally, reset to first product
        setCurrentIndex(0);
      }
    }
  };

  // Re-filter products whenever selectedCategory or searchQuery changes
  useEffect(() => {
    if (allProducts.length > 0) {
      let finalFiltered = allProducts;

      if (selectedCategory !== "#Everything") {
        finalFiltered = finalFiltered.filter(
          (product) => product.category === selectedCategory
        );
      }

      if (searchQuery.trim() !== "") {
        const query = searchQuery.trim().toLowerCase();
        finalFiltered = finalFiltered.filter((product) =>
          product.title.toLowerCase().includes(query)
        );
      }

      setFilteredProducts(finalFiltered);
      setCurrentIndex(0); // Reset to first product when filters change
    }
  }, [allProducts, selectedCategory, searchQuery]);

  // Fetch products and cart on component mount and when campusMode changes
  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchProducts();
    fetchCart();
    setCurrentIndex(0); // Reset to first product when campusMode changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campusMode]);

  // Toggle add modal
  const toggleAddModal = () => {
    setIsAddModalVisible(!isAddModalVisible);
  };

  // Toggle filter modal
  const toggleFilterModal = () => {
    setIsFilterModalVisible(!isFilterModalVisible);
  };

  // Handle adding a new product or gig
  const handleAddOption = (option: "Product" | "Gig") => {
    toggleAddModal();
    if (option === "Product") {
      navigation.navigate("AddProduct");
    } else {
      navigation.navigate("AddGig");
    }
  };

  // Handle Logout
  const handleLogout = async () => {
    try {
      await clearUser(); // Clear user data from context and storage
      Alert.alert("Logout Successful", "You have been logged out.", [
        {
          text: "OK",
          onPress: () => {
            navigation.dispatch(
              CommonActions.reset({
                index: 0,
                routes: [{ name: "Login" }],
              })
            );
          },
        },
      ]);
    } catch (error) {
      console.error("Logout Error:", error);
      Alert.alert("Logout Error", "Failed to log out. Please try again.");
    }
  };

  // ProductItem Component
  type ProductItemProps = {
    product: Product;
    onSwipeLeft: () => void;
    onSwipeRight: () => void;
    onSwipeUp: () => void;
    isTop: boolean;
    style?: any;
  };

  const ProductItem: React.FC<ProductItemProps> = ({
    product,
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    isTop,
    style,
  }) => {
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [isAdding, setIsAdding] = useState(false); // Prevent multiple adds

    // Handle image tap to cycle through images
    const handleImageTap = () => {
      if (currentImageIndex < product.images.length - 1) {
        setCurrentImageIndex(currentImageIndex + 1);
      } else {
        setCurrentImageIndex(0);
      }
    };

    // Handle gesture state changes
    const handleGestureStateChange = ({ nativeEvent }: any) => {
      if (!isTop) return;

      if (nativeEvent.state === State.END) {
        const { translationY, translationX, velocityY, velocityX } =
          nativeEvent;

        // Determine the swipe direction based on translation and velocity
        if (translationY < -50 && velocityY < -0.5) {
          // Swipe Up
          onSwipeUp();
        } else if (translationX > 50 && velocityX > 0.5) {
          // Swipe Right
          if (!isAdding) {
            setIsAdding(true);
            onSwipeRight();
            // Reset the adding flag after a short delay
            setTimeout(() => setIsAdding(false), 1000);
          }
        } else if (translationX < -50 && velocityX < -0.5) {
          // Swipe Left
          onSwipeLeft();
        }
      }
    };

    return (
      <PanGestureHandler onHandlerStateChange={handleGestureStateChange}>
        <View style={[styles.stackedProduct, style]}>
          {/* Share Button at Top Left */}
          {isTop && (
            <TouchableOpacity
              style={styles.shareButton}
              onPress={() => {
                Alert.alert("Shared", "You shared this product!");
              }}
              accessibilityLabel="Share Product"
            >
              <Ionicons name="share-social" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          )}

          <TapGestureHandler onActivated={handleImageTap}>
            <TouchableOpacity activeOpacity={0.9} style={styles.imageContainer}>
              <Image
                source={{
                  uri:
                    product.images && product.images.length > 0
                      ? product.images[currentImageIndex]
                      : "https://via.placeholder.com/150", // Fallback URL
                }}
                style={styles.productImage}
                resizeMode="cover" // Cover for better image scaling
              />

              {/* 'X' Button at Bottom Left */}
              {isTop && (
                <TouchableOpacity
                  style={styles.rejectButton}
                  onPress={() => handleSwipe("left")}
                  accessibilityLabel="Reject Product"
                >
                  <Ionicons name="close" size={24} color="#FF3B30" />
                </TouchableOpacity>
              )}

              {/* Check Mark Button at Bottom Right */}
              {isTop && (
                <TouchableOpacity
                  onPress={() => handleSwipe("right")}
                  accessibilityLabel="Like Product"
                >
                  <Ionicons name="checkmark" size={24} color="#34C759" />
                </TouchableOpacity>
              )}

              {/* Product Info Bubble at Bottom-Right */}
              {isTop && (
                <View style={styles.productInfoBubble}>
                  <View style={styles.productInfoTextContainer}>
                    <Text style={styles.productInfoTitle}>{product.title}</Text>
                    <Text style={styles.productInfoPrice}>
                      ${product.price.toFixed(2)}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.checkmarkButton}
                    onPress={() => handleSwipe("right")}
                    accessibilityLabel="Like Product"
                  >
                    <Ionicons name="checkmark" style={styles.checkmarkIcon} />
                  </TouchableOpacity>
                </View>
              )}
            </TouchableOpacity>
          </TapGestureHandler>

          {/* Five Action Buttons Removed from Bottom */}
          {/* Only Share Button is kept at Top Left */}
        </View>
      </PanGestureHandler>
    );
  };

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: "#000000" }}>
      <View style={styles.container}>
        {/* Search and Filter Container */}
        <View style={styles.searchFilterContainer}>
          {/* Simplified Search Bar */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#FFFFFF" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search products..."
              placeholderTextColor="#AAAAAA"
              value={searchQuery}
              onChangeText={(text) => setSearchQuery(text)}
              returnKeyType="search"
              accessibilityLabel="Search Products"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearchQuery("")}
                style={styles.clearIcon}
                accessibilityLabel="Clear Search"
              >
                <Ionicons name="close-circle" size={20} color="#FF3B30" />
              </TouchableOpacity>
            )}
          </View>

          {/* Filter Button with Black and White Colors */}
          <TouchableOpacity
            style={styles.filterButton}
            onPress={toggleFilterModal}
            accessibilityLabel="Filter Products"
          >
            <Ionicons name="filter" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Product Stack */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingText}>Loading...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => {
                setLoading(true);
                setError(null);
                fetchProducts();
                fetchCart();
                setCurrentIndex(0);
              }}
              accessibilityLabel="Retry Fetching Products"
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : filteredProducts.length === 0 ? (
          <View style={styles.noProductsContainer}>
            <Text style={styles.noProductsText}>No products available.</Text>
          </View>
        ) : (
          <View style={styles.productStack}>
            {filteredProducts
              .slice(currentIndex, currentIndex + 2)
              .reverse()
              .map((product, index) => (
                <ProductItem
                  key={product.id}
                  product={product}
                  onSwipeLeft={() => handleSwipe("left")}
                  onSwipeRight={() => handleSwipe("right")}
                  onSwipeUp={() => handleSwipe("up")}
                  isTop={index === 1}
                  style={[
                    { zIndex: index },
                    index === 1 ? styles.topProduct : styles.bottomProduct,
                  ]}
                />
              ))}
          </View>
        )}

        {/* Add Product/Gig Modal */}
        <Modal
          visible={isAddModalVisible}
          transparent
          animationType="fade"
          onRequestClose={toggleAddModal}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPressOut={toggleAddModal}
          >
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Add Options</Text>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => handleAddOption("Product")}
                accessibilityLabel="Add Product"
              >
                <Text style={styles.modalButtonText}>Add Product</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => handleAddOption("Gig")}
                accessibilityLabel="Add Gig"
              >
                <Text style={styles.modalButtonText}>Add Gig</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={toggleAddModal}
                style={styles.modalClose}
                accessibilityLabel="Close Add Options Modal"
              >
                <Ionicons name="close-outline" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Filter Modal */}
        <Modal
          visible={isFilterModalVisible}
          transparent
          animationType="slide"
          onRequestClose={toggleFilterModal}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPressOut={toggleFilterModal}
          >
            <View style={styles.filterModalContent}>
              <Text style={styles.modalTitle}>Filter Options</Text>

              {/* Category Selection */}
              <Text style={styles.sectionTitle}>Category</Text>
              <FlatList
                data={categories}
                keyExtractor={(item) => item}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.categoryItem,
                      selectedCategory === item && styles.categoryItemSelected,
                    ]}
                    onPress={() => {
                      setSelectedCategory(item);
                    }}
                    accessibilityLabel={`Filter by ${item}`}
                  >
                    <Text
                      style={[
                        styles.categoryText,
                        selectedCategory === item &&
                          styles.categoryTextSelected,
                      ]}
                    >
                      {item}
                    </Text>
                  </TouchableOpacity>
                )}
              />

              {/* Campus Mode Selection */}
              <Text style={styles.sectionTitle}>Campus Mode</Text>
              <FlatList
                data={campusOptions}
                keyExtractor={(item) => item.value}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.campusItem,
                      campusMode === item.value && styles.campusItemSelected,
                    ]}
                    onPress={() => {
                      setCampusMode(item.value);
                    }}
                    accessibilityLabel={`Filter by ${item.label}`}
                  >
                    <Text
                      style={[
                        styles.categoryText,
                        campusMode === item.value &&
                          styles.categoryTextSelected,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                )}
              />

              {/* Apply Filter Button */}
              <TouchableOpacity
                style={styles.applyButton}
                onPress={toggleFilterModal}
                accessibilityLabel="Apply Filters"
              >
                <Text style={styles.applyButtonText}>Apply Filters</Text>
              </TouchableOpacity>

              {/* Close Modal Button */}
              <TouchableOpacity
                onPress={toggleFilterModal}
                style={styles.modalClose}
                accessibilityLabel="Close Filter Modal"
              >
                <Ionicons name="close-outline" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Product Details Modal */}
        <Modal
          visible={isDetailsModalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setIsDetailsModalVisible(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPressOut={() => setIsDetailsModalVisible(false)}
          >
            <View style={styles.detailsModalContent}>
              {selectedProduct && (
                <>
                  <Text style={styles.detailsTitle}>
                    {selectedProduct.title}
                  </Text>
                  <Text style={styles.detailsPrice}>
                    Price: ${selectedProduct.price.toFixed(2)}
                  </Text>
                  <Text style={styles.detailsRating}>
                    Rating: {selectedProduct.rating || "N/A"}
                  </Text>
                  <Text style={styles.detailsQuality}>
                    Quality: {selectedProduct.quality || "N/A"}
                  </Text>
                  <ScrollView style={styles.detailsDescriptionContainer}>
                    <Text style={styles.detailsDescription}>
                      {selectedProduct.description}
                    </Text>
                  </ScrollView>
                  <TouchableOpacity
                    onPress={() => setIsDetailsModalVisible(false)}
                    style={styles.modalClose}
                    accessibilityLabel="Close Details Modal"
                  >
                    <Ionicons name="close-outline" size={24} color="#FFFFFF" />
                  </TouchableOpacity>
                </>
              )}
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Description Modal */}
        <Modal
          visible={isDescriptionModalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setIsDescriptionModalVisible(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPressOut={() => setIsDescriptionModalVisible(false)}
          >
            <View style={styles.descriptionModalContent}>
              <Text style={styles.modalTitle}>Product Description</Text>
              <ScrollView>
                <Text style={styles.descriptionText}>
                  {selectedProductDescription}
                </Text>
              </ScrollView>
              <TouchableOpacity
                onPress={() => setIsDescriptionModalVisible(false)}
                style={styles.modalClose}
                accessibilityLabel="Close Description Modal"
              >
                <Ionicons name="close-outline" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Integrate the BottomNavBar here */}
        <BottomNavBar />
      </View>
      {/* Removed BottomNavBar */}
    </GestureHandlerRootView>
  );
};

export default Dashboard;

// Stylesheet
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000", // Pure black background
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 60, // Adjust based on BottomNavBar height (e.g., 60)
  },
  searchFilterContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 15,
  },
  searchContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1E1E1E", // Darker background for better contrast
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 25,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    color: "#FFFFFF",
    fontSize: 16,
  },
  clearIcon: {
    marginLeft: 10,
  },
  filterButton: {
    marginLeft: 10,
    backgroundColor: "#000000", // Black background
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#FFFFFF", // White border
  },
  filterButtonIcon: {
    marginRight: 5,
  },
  listContainer: {},
  productStack: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  stackedProduct: {
    position: "absolute",
    width: SCREEN_WIDTH - 40, // Keep some padding for better layout
    height: SCREEN_HEIGHT * 0.75, // Increased height for larger image
    borderRadius: 10, // Rounded corners
    alignItems: "center", // Center content
    justifyContent: "flex-start", // Align items to the top
    backgroundColor: "transparent", // Transparent background
    overflow: "hidden", // Prevent content overflow
    zIndex: 1,
    paddingTop: 30, // **Added paddingTop to shift content downward**
  },
  topProduct: {
    zIndex: 2, // Ensure the top product is on top
    transform: [{ scale: 1 }], // No scaling for the top product
  },
  bottomProduct: {
    zIndex: 1, // Place below the top product
    transform: [{ scale: 0.95 }, { translateY: SCREEN_HEIGHT * 0.05 }], // Adjusted translateY
    opacity: 0, // Hide the bottom product completely
  },
  productContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  imageContainer: {
    width: "100%", // Expanded to fit the screen width
    height: "90%", // Make the image taller
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 10, // Match card radius
    overflow: "hidden", // Ensure image stays inside boundaries
    backgroundColor: "transparent",
    marginTop: 10, // **Optional: Add marginTop if needed to further shift image**
  },
  productImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover", // Ensure proper scaling
    borderRadius: 10, // Match border radius for consistency
  },
  // Added shareButton style
  shareButton: {
    position: "absolute",
    top: 45, // Adjust top margin to control distance from the top
    right: 10, // Adjust right margin to control distance from the right
    padding: 0, // Removed padding to make the button size consistent
    backgroundColor: "#1E1E1E", // Dark modal background
    borderRadius: 15, // Smaller rounded corners for a more compact button
    zIndex: 2, // Ensures the button appears above the image
    borderWidth: 1, // Thinner border
    borderColor: "#FFFFFF", // White border to outline the button
    width: 30, // Fixed width for a more compact size
    height: 30, // Fixed height for a more compact size
    justifyContent: "center", // Ensure icon is centered
    alignItems: "center", // Ensure icon is centered
  },

  shareButtonText: {
    color: "#FFFFFF", // White icon color for contrast
    fontSize: 10, // Smaller font size for the icon
  },

  // Added rejectButton style
  rejectButton: {
    position: "absolute",
    bottom: 20,
    left: 25,
    backgroundColor: "transparent", // Remove the circular background
    padding: 0, // Remove padding to keep it tight around the "X"
    borderRadius: 0, // No rounded corners
    zIndex: 3, // Ensure it's on top
    justifyContent: "center", // Center the "X" icon
    alignItems: "center", // Center the "X" icon
  },

  productInfoBubble: {
    position: "absolute",
    bottom: 20, // Adjust to position slightly above the bottom edge
    right: 10, // Adjust to align with the right edge
    backgroundColor: "rgba(255, 255, 255, 0.8)", // Semi-transparent white
    borderRadius: 20, // Rounded bubble
    paddingVertical: 8,
    paddingHorizontal: 15,
    flexDirection: "row", // Align text and checkmark horizontally
    alignItems: "center",
    justifyContent: "space-between",
    width: SCREEN_WIDTH * 0.6, // Make the bubble wider
    zIndex: 3, // Ensure it's above other elements
  },
  productInfoTextContainer: {
    flex: 1,
    flexDirection: "column",
  },
  productInfoTitle: {
    color: "#000000", // Black text for visibility on white background
    fontSize: 16, // Adjust font size
    fontWeight: "600",
    marginBottom: 2, // Space between title and price
  },
  productInfoPrice: {
    color: "#000000", // Black text for visibility on white background
    fontSize: 14, // Adjust font size
    fontWeight: "500",
  },
  checkmarkButton: {
    width: 24,
    height: 24,
    backgroundColor: "#34C759", // Bright green
    borderRadius: 12, // Circle shape
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2, // Add border for better visibility
    borderColor: "#FFFFFF", // White border for contrast
    marginLeft: 10, // Space between text and checkmark
  },
  checkmarkIcon: {
    color: "#FFFFFF", // White checkmark color
    fontSize: 16, // Adjust size of the checkmark
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 8,
    color: "#FFFFFF",
    fontSize: 14,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 15,
  },
  errorText: {
    color: "#FF3B30", // Red color for errors
    fontSize: 14,
    textAlign: "center",
    marginBottom: 8,
  },
  retryButton: {
    backgroundColor: "#007AFF",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  retryButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "500",
  },
  noProductsContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  noProductsText: {
    color: "#FFFFFF",
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)", // Dark overlay
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: "80%",
    backgroundColor: "#1E1E1E", // Dark modal background
    padding: 20,
    borderRadius: 15,
    alignItems: "center",
    maxHeight: "80%",
    position: "relative",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  filterModalContent: {
    width: "80%",
    backgroundColor: "#1E1E1E", // Dark modal background
    padding: 20,
    borderRadius: 15,
    alignItems: "center",
    maxHeight: "80%",
    position: "relative",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  descriptionModalContent: {
    width: "80%",
    backgroundColor: "#1E1E1E", // Dark modal background
    padding: 20,
    borderRadius: 15,
    alignItems: "center",
    maxHeight: "70%",
    position: "relative",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF", // White text
    marginBottom: 15,
  },
  modalButton: {
    backgroundColor: "#007AFF", // Blue button
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 12,
    marginVertical: 5,
    width: "100%",
    alignItems: "center",
    shadowColor: "#007AFF",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  modalButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  applyButton: {
    backgroundColor: "#007AFF",
    paddingVertical: 10,
    paddingHorizontal: 30,
    borderRadius: 20,
    marginTop: 15,
    width: "100%",
    alignItems: "center",
  },
  applyButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "500",
  },
  modalClose: {
    position: "absolute",
    top: 10,
    right: 10,
  },
  categoryItem: {
    width: "100%",
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 10,
    backgroundColor: "#2C2C2C",
    marginVertical: 5,
  },
  categoryItemSelected: {
    backgroundColor: "#007AFF",
  },
  categoryText: {
    color: "#FFFFFF",
    fontSize: 16,
  },
  categoryTextSelected: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  campusItem: {
    width: "100%",
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 10,
    backgroundColor: "#2C2C2C",
    marginVertical: 5,
  },
  campusItemSelected: {
    backgroundColor: "#007AFF",
  },
  sectionTitle: {
    fontSize: 18,
    color: "#FFFFFF",
    alignSelf: "flex-start",
    marginTop: 10,
    marginBottom: 5,
    fontWeight: "600",
  },
  detailsModalContent: {
    width: "90%",
    backgroundColor: "#1E1E1E", // Dark modal background
    borderRadius: 15,
    padding: 20,
    alignItems: "center",
    position: "relative",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  detailsTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#FFFFFF", // White text
    marginBottom: 15,
  },
  detailsPrice: {
    fontSize: 20,
    color: "#FFFFFF",
    marginBottom: 10,
    fontWeight: "600",
  },
  detailsRating: {
    fontSize: 16,
    color: "#FFFFFF",
    marginBottom: 5,
  },
  detailsQuality: {
    fontSize: 16,
    color: "#FFFFFF",
    marginBottom: 15,
  },
  detailsDescriptionContainer: {
    maxHeight: 100,
    marginBottom: 15,
  },
  detailsDescription: {
    color: "#AAAAAA",
    fontSize: 14,
    textAlign: "center",
  },
  descriptionText: {
    color: "#FFFFFF", // White text
    fontSize: 14, // Adjust font size as needed
    lineHeight: 20, // Adjust line height for readability
    textAlign: "center", // Center align the text
  },
});
