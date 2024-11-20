// Dashboard.tsx

import React, { useState, useEffect, useContext, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Modal,
  FlatList,
  ActivityIndicator,
  Alert,
  ScrollView,
  Animated,
  Dimensions,
} from "react-native";
import {
  RouteProp,
  useNavigation,
  CommonActions,
} from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import Ionicons from "react-native-vector-icons/Ionicons"; // For Ionicons
import BottomNavBar from "./components/BottomNavbar";
import { NGROK_URL } from "@env";
import { UserContext } from "./UserContext";
import { RootStackParamList } from "./navigationTypes"; // Import RootStackParamList
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
  university: string; // Assuming backend uses 'university'
  ownerId: string;
  postedDate: string;
  rating?: number; // Added rating
  quality?: string; // Added quality
};

type CartItem = {
  productId: string;
  quantity: number;
};

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get("window");

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

  // States for Description Modal
  const [isDescriptionModalVisible, setIsDescriptionModalVisible] =
    useState(false);
  const [selectedProductDescription, setSelectedProductDescription] =
    useState<string>("");

  // FlatList Ref for Navigating to Next Product
  const flatListRef = useRef<FlatList>(null);
  const currentIndex = useRef<number>(0);

  // State for Cart Update Indicator
  const [cartUpdated, setCartUpdated] = useState(false);

  // State for Cart Items
  const [cartItems, setCartItems] = useState<CartItem[]>([]);

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

      // Further filter based on selected category
      const finalFiltered =
        selectedCategory === "#Everything"
          ? filtered
          : filtered.filter((product) => product.category === selectedCategory);

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

  // Re-filter products whenever selectedCategory changes
  useEffect(() => {
    if (allProducts.length > 0) {
      const finalFiltered =
        selectedCategory === "#Everything"
          ? allProducts
          : allProducts.filter(
              (product) => product.category === selectedCategory
            );

      setFilteredProducts(finalFiltered);
    }
  }, [allProducts, selectedCategory]);

  // Fetch products and cart on component mount and when campusMode changes
  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchProducts();
    fetchCart();
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

  // Show description modal
  const showDescription = (description: string) => {
    setSelectedProductDescription(description);
    setIsDescriptionModalVisible(true);
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

  // Render each product item with gesture handling
  const renderProduct = ({ item, index }: { item: Product; index: number }) => {
    return (
      <ProductItem
        product={item}
        onSwipeUp={() => {
          setSelectedProduct(item);
          setIsDetailsModalVisible(true);
        }}
        onSwipeLeft={() => {
          if (index < filteredProducts.length - 1) {
            flatListRef.current?.scrollToIndex({
              index: index + 1,
              animated: true,
            });
            currentIndex.current = index + 1;
          } else {
            Alert.alert("End of List", "No more products available.");
          }
        }}
        onSwipeRight={() => {
          addToCart(item);
          // Optionally navigate to next product after adding to cart
          if (index < filteredProducts.length - 1) {
            flatListRef.current?.scrollToIndex({
              index: index + 1,
              animated: true,
            });
            currentIndex.current = index + 1;
          } else {
            Alert.alert("End of List", "No more products available.");
          }
        }}
      />
    );
  };

  // ProductItem Component
  const ProductItem: React.FC<{
    product: Product;
    onSwipeUp: () => void;
    onSwipeLeft: () => void;
    onSwipeRight: () => void;
  }> = ({ product, onSwipeUp, onSwipeLeft, onSwipeRight }) => {
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

    // Handle swipe actions only once
    const handleStateChange = ({ nativeEvent }: any) => {
      if (nativeEvent.state === State.END) {
        const { translationY, translationX, velocityY, velocityX } =
          nativeEvent;

        // Swipe Up
        if (translationY < -50 && velocityY < -0.5) {
          onSwipeUp();
        }

        // Swipe Left
        if (translationX < -50 && velocityX < -0.5) {
          onSwipeLeft();
        }

        // Swipe Right
        if (translationX > 50 && velocityX > 0.5) {
          if (!isAdding) {
            setIsAdding(true);
            onSwipeRight();
            // Reset the adding flag after a short delay
            setTimeout(() => setIsAdding(false), 1000);
          }
        }
      }
    };

    return (
      <GestureHandlerRootView style={styles.productItemContainer}>
        <PanGestureHandler onHandlerStateChange={handleStateChange}>
          <Animated.View style={styles.productContainer}>
            <TapGestureHandler onActivated={handleImageTap}>
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
            </TapGestureHandler>

            {/* Like and Share Icons */}
            <TouchableOpacity
              style={styles.likeIcon}
              onPress={() => {
                // Handle like action
                Alert.alert("Liked", "You liked this product!");
              }}
              accessibilityLabel="Like Product"
            >
              <Ionicons name="heart-outline" size={30} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.shareIcon}
              onPress={() => {
                // Handle share action
                Alert.alert("Shared", "You shared this product!");
              }}
              accessibilityLabel="Share Product"
            >
              <Ionicons name="share-social-outline" size={30} color="#fff" />
            </TouchableOpacity>
          </Animated.View>
        </PanGestureHandler>
      </GestureHandlerRootView>
    );
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.container}>
        {/* Filter and Toggle Buttons Container */}
        <View style={styles.filterToggleContainer}>
          {/* Filter Button */}
          <TouchableOpacity
            style={styles.filterButton}
            onPress={toggleFilterModal}
            accessibilityLabel="Filter Products"
          >
            <Ionicons name="filter-outline" size={20} color="#fff" />
            <Text style={styles.filterButtonText}>Filter</Text>
          </TouchableOpacity>
        </View>

        {/* Product List */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#BB86FC" />
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
                fetchCart(); // Also refetch cart
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
          <FlatList
            ref={flatListRef}
            data={filteredProducts}
            keyExtractor={(item) => item.id}
            renderItem={renderProduct}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
            pagingEnabled
            snapToAlignment="start"
            decelerationRate="fast"
            snapToInterval={SCREEN_HEIGHT}
            getItemLayout={(data, index) => ({
              length: SCREEN_HEIGHT,
              offset: SCREEN_HEIGHT * index,
              index,
            })}
          />
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
                <Ionicons name="close-outline" size={24} color="#fff" />
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
                <Ionicons name="close-outline" size={24} color="#fff" />
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
                  <Image
                    source={{
                      uri:
                        selectedProduct.images &&
                        selectedProduct.images.length > 0
                          ? selectedProduct.images[0]
                          : "https://via.placeholder.com/150",
                    }}
                    style={styles.detailsImage}
                    resizeMode="cover"
                  />
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
                    <Ionicons name="close-outline" size={24} color="#fff" />
                  </TouchableOpacity>
                </>
              )}
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Description Modal (Existing) */}
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
            <View style={styles.modalContent}>
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
                <Ionicons name="close-outline" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      </View>
      {/* Bottom Navigation Bar */}
      <BottomNavBar />
    </GestureHandlerRootView>
  );
};

export default Dashboard;

// Stylesheet
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212", // Dark background
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 60, // Space for BottomNavBar
  },
  filterToggleContainer: {
    marginBottom: 15,
    alignItems: "flex-end", // Move the filter button to the right
  },

  filterButton: {
    position: "absolute",
    flexDirection: "row",
    top: 10, // Adjust this value to position it correctly
    right: 10, // Adjust this value to position it correctly
    alignItems: "center",
    backgroundColor: "#BB86FC", // Purple button
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 20,
    zIndex: 10,
  },
  filterButtonText: {
    color: "#fff",
    fontSize: 14,
    marginLeft: 8,
    fontWeight: "500",
  },
  listContainer: {},
  productItemContainer: {
    height: SCREEN_HEIGHT,
  },

  productImage: {
    width: SCREEN_WIDTH, // Occupy the full screen width
    aspectRatio: 9 / 13.5, // Adjust this to match the original aspect ratio of your image
    alignSelf: "center", // Center the image horizontally
    borderRadius: 20, // Optional: Add rounded corners
    resizeMode: "contain", // Ensure the image content is fully visible
    backgroundColor: "#121212", // Optional: Add a background for better visibility
  },

  likeIcon: {
    position: "absolute",
    right: 20,
    top: SCREEN_HEIGHT * 0.45, // Slightly lower, closer to the share icon
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FF4D4D", // Subtle red for the heart icon
    borderRadius: 20, // Smaller circle
    borderWidth: 2,
    borderColor: "#FFF", // Thin white border for distinction
    shadowColor: "#000", // Light shadow for depth
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3, // For Android shadow
  },

  shareIcon: {
    position: "absolute",
    right: 20,
    top: SCREEN_HEIGHT * 0.52, // Positioned closer to the like icon
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#34C759", // Subtle green for the share icon
    borderRadius: 20, // Smaller circle
    borderWidth: 2,
    borderColor: "#FFF", // Thin white border for distinction
    shadowColor: "#000", // Light shadow for depth
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3, // For Android shadow
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
  retryButton: {
    backgroundColor: "#BB86FC",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  retryButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "500",
  },
  noProductsContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  noProductsText: {
    color: "#bbb",
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
  },
  filterModalContent: {
    width: "80%",
    backgroundColor: "#1E1E1E", // Dark modal background
    padding: 20,
    borderRadius: 15,
    alignItems: "center",
    maxHeight: "80%",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#BB86FC", // Purple text
    marginBottom: 15,
  },
  modalButton: {
    backgroundColor: "#BB86FC", // Purple button
    paddingVertical: 10,
    paddingHorizontal: 30,
    borderRadius: 20,
    marginVertical: 5,
    width: "100%",
    alignItems: "center",
  },
  modalButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "500",
  },
  applyButton: {
    backgroundColor: "#BB86FC",
    paddingVertical: 10,
    paddingHorizontal: 30,
    borderRadius: 20,
    marginTop: 15,
    width: "100%",
    alignItems: "center",
  },
  applyButtonText: {
    color: "#fff",
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
    backgroundColor: "#1E1E1E",
    marginVertical: 5,
  },
  categoryItemSelected: {
    backgroundColor: "#BB86FC",
  },
  categoryText: {
    color: "#fff",
    fontSize: 16,
  },
  categoryTextSelected: {
    color: "#121212",
    fontWeight: "600",
  },
  campusItem: {
    width: "100%",
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 10,
    backgroundColor: "#1E1E1E",
    marginVertical: 5,
  },
  campusItemSelected: {
    backgroundColor: "#BB86FC",
  },
  sectionTitle: {
    fontSize: 18,
    color: "#BB86FC",
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
  },
  detailsTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#BB86FC",
    marginBottom: 15,
  },
  detailsImage: {
    width: "100%",
    height: SCREEN_HEIGHT * 0.3,
    borderRadius: 15,
    marginBottom: 15,
  },
  detailsPrice: {
    fontSize: 20,
    color: "#fff",
    marginBottom: 10,
    fontWeight: "600",
  },
  detailsRating: {
    fontSize: 16,
    color: "#fff",
    marginBottom: 5,
  },
  detailsQuality: {
    fontSize: 16,
    color: "#fff",
    marginBottom: 15,
  },
  detailsDescriptionContainer: {
    maxHeight: 100,
    marginBottom: 15,
  },
  detailsDescription: {
    color: "#ccc",
    fontSize: 14,
    textAlign: "center",
  },
  cartButton: {
    position: "absolute",
    bottom: 80, // Adjust based on BottomNavBar height
    right: 20,
    backgroundColor: "#BB86FC",
    padding: 10,
    borderRadius: 30,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  descriptionText: {
    color: "#ccc", // Light gray text color
    fontSize: 14, // Adjust font size as needed
    lineHeight: 20, // Adjust line height for readability
    textAlign: "center", // Center align the text
  },
});
