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
  useNavigation,
  CommonActions,
  RouteProp,
} from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import Ionicons from "react-native-vector-icons/Ionicons";
import BottomNavBar from "./components/BottomNavbar";
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

const Dashboard: React.FC<DashboardProps> = () => {
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);

  // Product details modals
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isDetailsModalVisible, setIsDetailsModalVisible] = useState(false);

  // Description modal
  const [isDescriptionModalVisible, setIsDescriptionModalVisible] = useState(false);
  const [selectedProductDescription, setSelectedProductDescription] = useState<string>("");

  // Campus & search
  const [campusMode, setCampusMode] = useState<"In Campus" | "Both">("In Campus");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { userId, token, institution, clearUser } = useContext(UserContext);

  const categories = ["#Everything", "#FemaleClothing", "#MensClothing", "#Other"];
  const campusOptions: Array<{ label: string; value: "In Campus" | "Both" }> = [
    { label: "In Campus", value: "In Campus" },
    { label: "Both In and Out of Campus", value: "Both" },
  ];

  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("#Everything");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Cart state
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [cartUpdated, setCartUpdated] = useState(false);

  // Current product index
  const [currentIndex, setCurrentIndex] = useState(0);

  // --- Fetch Cart ---
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
        Alert.alert("Session Expired", "Your session has expired. Please log in again.", [
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
        ]);
        return;
      }

      if (!response.ok) {
        const responseText = await response.text();
        console.error("Error response text:", responseText);
        throw new Error("Failed to fetch cart.");
      }

      const data = await response.json();
      if (data && Array.isArray(data.items)) {
        setCartItems(data.items);
      } else {
        console.error("Invalid cart data:", data);
        throw new Error("Invalid cart data from server.");
      }
    } catch (err) {
      console.error("Fetch Cart Error:", err);
      Alert.alert("Error", "Could not fetch cart data.");
    }
  };

  // --- Add to Cart ---
  const addToCart = async (product: Product) => {
    if (!userId || !token) {
      Alert.alert("Error", "User not authenticated.");
      return;
    }

    const isAlreadyInCart = cartItems.some((item) => item.productId === product.id);
    if (isAlreadyInCart) {
      Alert.alert("Item in Cart", "This product is already in your cart.");
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
        Alert.alert("Session Expired", "Please log in again.", [
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
        ]);
        return;
      }

      if (response.status === 409) {
        Alert.alert("Item in Cart", "This product is already in your cart.");
        return;
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to add item to cart.");
      }

      Alert.alert("Success", "Product added to cart!");
      setCartUpdated(true);
    } catch (err) {
      console.error("Add to Cart Error:", err);
      Alert.alert("Error", "Could not add item to cart.");
    }
  };

  // --- Cart Updated Effect ---
  useEffect(() => {
    if (cartUpdated) {
      fetchCart();
      const timer = setTimeout(() => {
        setCartUpdated(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [cartUpdated]);

  // --- Fetch Products ---
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
        Alert.alert("Session Expired", "Please log in again.", [
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
        ]);
        return;
      }

      if (!response.ok) {
        const responseText = await response.text();
        console.error("Error response:", responseText);
        throw new Error("Failed to fetch products.");
      }

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const responseText = await response.text();
        console.error("Unexpected content-type:", contentType, responseText);
        throw new Error("Expected JSON.");
      }

      const data: Product[] = await response.json();
      if (!data || data.length === 0) {
        setAllProducts([]);
        setFilteredProducts([]);
        setError(null);
        setLoading(false);
        return;
      }

      let filtered = data;
      if (campusMode === "In Campus") {
        filtered = data.filter(
          (product) => product.ownerId !== userId && product.university === institution
        );
      }

      // Filter by category & search
      let finalFiltered = filtered;
      if (selectedCategory !== "#Everything") {
        finalFiltered = finalFiltered.filter((p) => p.category === selectedCategory);
      }
      if (searchQuery.trim() !== "") {
        const query = searchQuery.trim().toLowerCase();
        finalFiltered = finalFiltered.filter((p) =>
          p.title.toLowerCase().includes(query)
        );
      }

      setAllProducts(filtered);
      setFilteredProducts(finalFiltered);
      setError(null);
    } catch (err) {
      console.error("Fetch Products Error:", err);
      setError(err instanceof Error ? err.message : "Error fetching products.");
    } finally {
      setLoading(false);
    }
  };

  // --- Re-filter on category/search changes ---
  useEffect(() => {
    if (allProducts.length > 0) {
      let finalFiltered = allProducts;
      if (selectedCategory !== "#Everything") {
        finalFiltered = finalFiltered.filter((p) => p.category === selectedCategory);
      }
      if (searchQuery.trim() !== "") {
        const query = searchQuery.trim().toLowerCase();
        finalFiltered = finalFiltered.filter((p) =>
          p.title.toLowerCase().includes(query)
        );
      }
      setFilteredProducts(finalFiltered);
      setCurrentIndex(0);
    }
  }, [allProducts, selectedCategory, searchQuery]);

  // --- Initial fetch on mount/campusMode change ---
  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchProducts();
    fetchCart();
    setCurrentIndex(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campusMode]);

  // --- Modal Toggles ---
  const toggleAddModal = () => setIsAddModalVisible(!isAddModalVisible);
  const toggleFilterModal = () => setIsFilterModalVisible(!isFilterModalVisible);

  // --- Add Options ---
  const handleAddOption = (option: "Product" | "Gig") => {
    toggleAddModal();
    if (option === "Product") navigation.navigate("AddProduct");
    else navigation.navigate("AddGig");
  };

  // --- Logout ---
  const handleLogout = async () => {
    try {
      await clearUser();
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
      Alert.alert("Logout Error", "Failed to log out.");
    }
  };

  // --- Handle Swipe (Products) ---
  const handleSwipe = (direction: "left" | "right" | "up") => {
    const product = filteredProducts[currentIndex];
    if (!product) return;

    if (direction === "up") {
      setSelectedProductDescription(product.description);
      setIsDescriptionModalVisible(true);
      return;
    }

    if (direction === "right") {
      addToCart(product);
      return;
    }

    if (direction === "left") {
      // Move to next product
      if (currentIndex < filteredProducts.length - 1) {
        setCurrentIndex(currentIndex + 1);
      } else {
        Alert.alert("End of List", "No more products available.");
        setCurrentIndex(0);
      }
    }
  };

  // --- ProductItem Component ---
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
    const [isAdding, setIsAdding] = useState(false);

    const handleImageTap = ({ nativeEvent }: any) => {
      if (nativeEvent.state === State.ACTIVE) {
        // On tap, go to next image
        setCurrentImageIndex((prev) =>
          prev < product.images.length - 1 ? prev + 1 : 0
        );
      }
    };

    const handleGestureStateChange = ({ nativeEvent }: any) => {
      if (!isTop) return;

      if (nativeEvent.state === State.END) {
        const { translationY, translationX, velocityY, velocityX } = nativeEvent;

        if (translationY < -50 && velocityY < -0.5) {
          // Swipe up: show description
          onSwipeUp();
        } else if (translationX > 50 && velocityX > 0.5) {
          // Swipe right: add to cart
          if (!isAdding) {
            setIsAdding(true);
            onSwipeRight();
            setTimeout(() => setIsAdding(false), 1000);
          }
        } else if (translationX < -50 && velocityX < -0.5) {
          // Swipe left: next product
          onSwipeLeft();
        }
      }
    };

    // Image indicators
    const renderImageIndicators = () => (
      <View style={styles.imageIndicatorsContainer}>
        {product.images.map((_, idx) => (
          <View
            key={idx}
            style={[
              styles.imageIndicatorDot,
              idx === currentImageIndex && styles.imageIndicatorDotActive,
            ]}
          />
        ))}
      </View>
    );

    return (
      <PanGestureHandler onHandlerStateChange={handleGestureStateChange}>
        <View style={[styles.stackedProduct, style]}>
          {isTop && (
            <TouchableOpacity
              style={styles.shareButton}
              onPress={() => Alert.alert("Shared", "You shared this product!")}
              accessibilityLabel="Share Product"
            >
              <Ionicons name="share-social" size={16} color="#FFFFFF" />
            </TouchableOpacity>
          )}

          {/* TapGestureHandler for image tap */}
          <TapGestureHandler onActivated={handleImageTap}>
            <View style={styles.imageContainer}>
              <Image
                source={{
                  uri:
                    product.images && product.images.length > 0
                      ? product.images[currentImageIndex]
                      : "https://via.placeholder.com/150",
                }}
                style={styles.productImage}
                resizeMode="cover"
              />
              {isTop && renderImageIndicators()}

              {isTop && (
                <View style={styles.productInfoBubble}>
                  <View style={styles.productInfoTextContainer}>
                    <Text style={styles.productInfoTitle}>{product.title}</Text>
                    <Text style={styles.productInfoPrice}>${product.price.toFixed(2)}</Text>
                  </View>
                  <View style={styles.productInfoActions}>
                    {/* Reject (X) */}
                    <TouchableOpacity
                      style={styles.iconButton}
                      onPress={() => handleSwipe("left")}
                      accessibilityLabel="Reject Product"
                    >
                      <Ionicons name="close" size={20} color="#FF3B30" />
                    </TouchableOpacity>
                    {/* Accept (Check) */}
                    <TouchableOpacity
                      style={styles.iconButton}
                      onPress={() => handleSwipe("right")}
                      accessibilityLabel="Like Product"
                    >
                      <Ionicons name="checkmark" size={20} color="#34C759" />
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          </TapGestureHandler>
        </View>
      </PanGestureHandler>
    );
  };

  return (
    <GestureHandlerRootView style={styles.rootContainer}>
      <View style={styles.container}>
        {/* Search & Filter */}
        <View style={styles.searchFilterContainer}>
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
                    onPress={() => setSelectedCategory(item)}
                    accessibilityLabel={`Filter by ${item}`}
                  >
                    <Text
                      style={[
                        styles.categoryText,
                        selectedCategory === item && styles.categoryTextSelected,
                      ]}
                    >
                      {item}
                    </Text>
                  </TouchableOpacity>
                )}
              />

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
                    onPress={() => setCampusMode(item.value)}
                    accessibilityLabel={`Filter by ${item.label}`}
                  >
                    <Text
                      style={[
                        styles.categoryText,
                        campusMode === item.value && styles.categoryTextSelected,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                )}
              />

              <TouchableOpacity
                style={styles.applyButton}
                onPress={toggleFilterModal}
                accessibilityLabel="Apply Filters"
              >
                <Text style={styles.applyButtonText}>Apply Filters</Text>
              </TouchableOpacity>

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
                  <Text style={styles.detailsTitle}>{selectedProduct.title}</Text>
                  <Text style={styles.detailsPrice}>Price: ${selectedProduct.price.toFixed(2)}</Text>
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
                <Text style={styles.descriptionText}>{selectedProductDescription}</Text>
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

        <BottomNavBar />
      </View>
    </GestureHandlerRootView>
  );
};

export default Dashboard;

// --- Styles ---
const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: "#000000",
  },
  container: {
    flex: 1,
    backgroundColor: "#000000",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 60,
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
    backgroundColor: "#1E1E1E",
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
    backgroundColor: "#000000",
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#FFFFFF",
  },
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
    zIndex: 2,
    transform: [{ scale: 1 }],
  },
  bottomProduct: {
    zIndex: 1,
    transform: [{ scale: 0.95 }, { translateY: SCREEN_HEIGHT * 0.05 }],
    opacity: 0,
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
    resizeMode: "cover",
    borderRadius: 10,
  },
  shareButton: {
    position: "absolute",
    top: 45,
    right: 10,
    backgroundColor: "#1E1E1E",
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#FFFFFF",
    zIndex: 2,
  },
  imageIndicatorsContainer: {
    position: "absolute",
    top: 20,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  imageIndicatorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#AAAAAA",
    marginHorizontal: 3,
  },
  imageIndicatorDotActive: {
    backgroundColor: "#FFFFFF",
  },
  productInfoBubble: {
    position: "absolute",
    bottom: 20,
    left: 12,
    right: 12,
    backgroundColor: "rgba(30, 30, 30, 0.85)",  // Slightly more opaque for a cleaner look
    borderRadius: 14,  // Slightly smaller radius for a more compact feel
    paddingVertical: 10,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 }, // Slightly softer shadow
    shadowOpacity: 0.3, // Reduced opacity for a cleaner effect
    shadowRadius: 5,
    elevation: 5,  // Slightly lighter elevation
    borderWidth: 1,  // Subtle border
    borderColor: "#444",  // Dark border for contrast
  },
  
  productInfoTextContainer: {
    flex: 1,
    marginRight: 10,
    justifyContent: "center", // Vertically centering content
    marginLeft: 8,  // Slightly smaller margin for a tighter design
  },
  
  productInfoTitle: {
    color: "#FFFFFF",
    fontSize: 18,  // Smaller title size
    fontWeight: "700",  // Bold weight for prominence but not overpowering
    letterSpacing: 1,  // Slightly tighter spacing for a more refined look
    marginBottom: 4,
    textShadowColor: "#000",  // Subtle shadow to enhance text readability
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,  // Lighter shadow for a more sophisticated feel
  },
  
  productInfoPrice: {
    color: "#A1A1A1",  // Subtle, muted price color
    fontSize: 16,  // Smaller font size
    fontWeight: "600",  // Slightly lighter weight for a less bold feel
    marginTop: 1,
    textShadowColor: "#000",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 1,  // Finer shadow for a more elegant look
  },
  
  productInfoActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",  // Aligning the buttons slightly to the left
    marginLeft: 12,
  },
  
  iconButton: {
    backgroundColor: "#333",  // Darker background for buttons
    padding: 8,  // Smaller padding for a tighter button
    borderRadius: 50,  // Circular buttons for a modern touch
    marginLeft: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,  // Softer shadow for a more minimal look
    shadowRadius: 3,
    elevation: 3,  // Reduced elevation for a flatter look
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
    color: "#FF3B30",
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
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: "80%",
    backgroundColor: "#1E1E1E",
    padding: 20,
    borderRadius: 15,
    alignItems: "center",
    maxHeight: "80%",
    position: "relative",
  },
  filterModalContent: {
    width: "80%",
    backgroundColor: "#1E1E1E",
    padding: 20,
    borderRadius: 15,
    alignItems: "center",
    maxHeight: "80%",
    position: "relative",
  },
  descriptionModalContent: {
    width: "80%",
    backgroundColor: "#1E1E1E",
    padding: 20,
    borderRadius: 15,
    alignItems: "center",
    maxHeight: "70%",
    position: "relative",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 15,
  },
  modalButton: {
    backgroundColor: "#007AFF",
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 12,
    marginVertical: 5,
    width: "100%",
    alignItems: "center",
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
    backgroundColor: "#1E1E1E",
    borderRadius: 15,
    padding: 20,
    alignItems: "center",
    position: "relative",
  },
  detailsTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 15,
    textAlign: "center",
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
    color: "#FFFFFF",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
});
