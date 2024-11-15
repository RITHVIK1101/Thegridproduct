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
  PanResponder,
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
import Feather from "react-native-vector-icons/Feather"; // For Feather Icons
import BottomNavBar from "./components/BottomNavbar";
import { NGROK_URL } from "@env";
import { UserContext } from "./UserContext";
import { RootStackParamList } from "./navigationTypes"; // Import RootStackParamList

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
};

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

const Dashboard: React.FC<DashboardProps> = ({ route }) => {
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);

  // New State for Campus Selection
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

  // Logout Handler
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

      if (!data || !Array.isArray(data)) {
        console.error("Received invalid data:", data);
        throw new Error("Received invalid data from server.");
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

  // Fetch products on component mount and when campusMode changes
  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchProducts();
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

  // Render each product item with swipe up/down functionality
  const renderProduct = ({ item }: { item: Product }) => {
    return <ProductItem product={item} showDescription={showDescription} />;
  };

  // ProductItem Component
  const ProductItem: React.FC<{
    product: Product;
    showDescription: (description: string) => void;
  }> = ({ product, showDescription }) => {
    const [showDetails, setShowDetails] = useState(false);
    const animatedHeight = useRef(new Animated.Value(0)).current;

    const pan = useRef(new Animated.ValueXY()).current;

    const panResponder = useRef(
      PanResponder.create({
        onMoveShouldSetPanResponder: (evt, gestureState) => {
          const { dy } = gestureState;
          return Math.abs(dy) > 20;
        },
        onPanResponderMove: (evt, gestureState) => {
          const { dy } = gestureState;
          if (dy < 0 && !showDetails) {
            // Swiping Up
            pan.setValue({ x: 0, y: dy });
          } else if (dy > 0 && showDetails) {
            // Swiping Down
            pan.setValue({ x: 0, y: dy });
          }
        },
        onPanResponderRelease: (evt, gestureState) => {
          const { dy, vy } = gestureState;
          if (dy < -50 && vy < -0.5 && !showDetails) {
            // Swipe Up
            Animated.timing(animatedHeight, {
              toValue: 1,
              duration: 300,
              useNativeDriver: false,
            }).start(() => {
              setShowDetails(true);
              pan.setValue({ x: 0, y: 0 });
            });
          } else if (dy > 50 && vy > 0.5 && showDetails) {
            // Swipe Down
            Animated.timing(animatedHeight, {
              toValue: 0,
              duration: 300,
              useNativeDriver: false,
            }).start(() => {
              setShowDetails(false);
              pan.setValue({ x: 0, y: 0 });
            });
          } else {
            // Reset position
            Animated.spring(pan, {
              toValue: { x: 0, y: 0 },
              useNativeDriver: false,
            }).start();
          }
        },
      })
    ).current;

    const detailHeight = animatedHeight.interpolate({
      inputRange: [0, 1],
      outputRange: [0, SCREEN_HEIGHT * 0.3], // 30% of screen height
    });

    return (
      <View style={styles.itemContainer}>
        <View style={styles.imageContainer}>
          <TouchableOpacity
            onPress={() => showDescription(product.description)}
          >
            <Image
              source={{
                uri:
                  product.images && product.images.length > 0
                    ? product.images[0]
                    : "https://via.placeholder.com/150",
              }}
              style={styles.productImage}
              resizeMode="cover"
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              setShowDetails(!showDetails);
            }}
            style={styles.arrowContainer}
            accessibilityLabel="Toggle Product Details"
            {...panResponder.panHandlers} // Attach PanResponder to the arrow
          >
            <Feather
              name={showDetails ? "arrow-down" : "arrow-up"}
              size={24}
              color="#BB86FC"
            />
          </TouchableOpacity>
        </View>
        {/* Animated Details */}
        <Animated.View
          style={[styles.detailsContainer, { height: detailHeight }]}
        >
          <Text style={styles.itemPrice}>${product.price.toFixed(2)}</Text>
          <Text style={styles.categoryTag}>
            {product.category === "#FemaleClothing"
              ? "Selling"
              : product.category === "#MensClothing"
              ? "Renting"
              : "Both"}
          </Text>
          <ScrollView>
            <Text style={styles.itemDescription}>{product.description}</Text>
          </ScrollView>
        </Animated.View>
      </View>
    );
  };

  return (
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
          data={filteredProducts}
          keyExtractor={(item) => item.id}
          renderItem={renderProduct}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
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
                      selectedCategory === item && styles.categoryTextSelected,
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
                      campusMode === item.value && styles.categoryTextSelected,
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

      {/* Bottom Navigation Bar */}
      <BottomNavBar />
    </View>
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
  },
  filterButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#BB86FC", // Purple button
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 20,
    alignSelf: "flex-start",
  },
  filterButtonText: {
    color: "#fff",
    fontSize: 14,
    marginLeft: 8,
    fontWeight: "500",
  },
  listContainer: {
    paddingBottom: 80, // Ensure content is above BottomNavBar
  },
  itemContainer: {
    backgroundColor: "#1E1E1E", // Darker card background
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    elevation: 5,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    paddingBottom: 0,
  },
  imageContainer: {
    position: "relative",
  },
  arrowContainer: {
    position: "absolute",
    bottom: 10,
    left: "50%",
    transform: [{ translateX: -12 }], // Half of the icon size to center it
    backgroundColor: "rgba(30, 30, 30, 0.6)",
    padding: 6,
    borderRadius: 12,
  },
  productImage: {
    width: "100%",
    height: SCREEN_HEIGHT * 0.67, // 40% of screen height
    borderRadius: 10,
    marginBottom: 10,
  },
  detailsContainer: {
    overflow: "hidden",
    backgroundColor: "#2C2C2C",
    borderRadius: 10,
    padding: 10,
  },
  itemPrice: {
    fontSize: 16,
    color: "#fff", // White color
    marginBottom: 4,
    fontWeight: "600",
  },
  categoryTag: {
    backgroundColor: "#BB86FC",
    color: "#121212",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    alignSelf: "flex-start",
    marginBottom: 8,
    fontWeight: "600",
    fontSize: 12,
  },
  itemDescription: {
    color: "#ccc",
    fontSize: 14,
    textAlign: "left",
  },
  tagsContainer: {
    flexDirection: "row",
    marginTop: 5,
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
  descriptionText: {
    color: "#fff",
    fontSize: 14,
    marginBottom: 10,
    textAlign: "center",
  },
});
