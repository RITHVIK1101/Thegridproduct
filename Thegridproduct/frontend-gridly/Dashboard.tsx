// Dashboard.tsx

import React, { useState, useEffect, useContext, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Modal,
  ActivityIndicator,
  Alert,
  Dimensions,
  TextInput,
  FlatList,
  ScrollView,
  Animated,
  Easing,
  TouchableWithoutFeedback,
  Keyboard,
  Platform,
} from "react-native";
import {
  useNavigation,
  CommonActions,
  RouteProp,
} from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import Ionicons from "react-native-vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
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
  // Default to "All" and "Both" on login
  const [campusMode, setCampusMode] = useState<"In Campus" | "Both">("Both");
  const [selectedCategory, setSelectedCategory] =
    useState<string>("#Everything");

  const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isDetailsModalVisible, setIsDetailsModalVisible] = useState(false);
  const [isDescriptionModalVisible, setIsDescriptionModalVisible] =
    useState(false);
  const [selectedProductDescription, setSelectedProductDescription] =
    useState<string>("");

  const [searchQuery, setSearchQuery] = useState<string>("");

  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { userId, token, institution, clearUser } = useContext(UserContext);

  const categories = [
    "#Everything",
    "#FemaleClothing",
    "#MensClothing",
    "#Other",
  ];
  const campusOptions: Array<{ label: string; value: "In Campus" | "Both" }> = [
    { label: "In and Out of Campus", value: "Both" },
    { label: "In Campus", value: "In Campus" },
  ];

  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [cartUpdated, setCartUpdated] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  const [favorites, setFavorites] = useState<string[]>([]);

  // Toast Animations
  const [errorMessage, setErrorMessage] = useState("");
  const errorOpacity = useRef(new Animated.Value(0)).current;

  const [successMessage, setSuccessMessage] = useState("");
  const successOpacity = useRef(new Animated.Value(0)).current;

  const showError = (msg: string) => {
    setErrorMessage(msg);
    Animated.timing(errorOpacity, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
      easing: Easing.out(Easing.ease),
    }).start(() => {
      setTimeout(() => {
        Animated.timing(errorOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
          easing: Easing.in(Easing.ease),
        }).start(() => {
          setErrorMessage("");
        });
      }, 2500);
    });
  };

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    Animated.timing(successOpacity, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
      easing: Easing.out(Easing.ease),
    }).start(() => {
      setTimeout(() => {
        Animated.timing(successOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
          easing: Easing.in(Easing.ease),
        }).start(() => {
          setSuccessMessage("");
        });
      }, 2500);
    });
  };

  const toggleFavorite = (productId: string) => {
    setFavorites((prev) =>
      prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId]
    );
  };

  // Fetch cart
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
        console.error("Error response text:", responseText);
        throw new Error("Failed to fetch cart.");
      }

      const data = await response.json();
      if (data && Array.isArray(data.items)) {
        setCartItems(data.items);
      } else {
        throw new Error("Invalid cart data.");
      }
    } catch (err) {
      console.error("Fetch Cart Error:", err);
      // We'll not show an alert here since user might be offline or something
    }
  };

  // Add to cart
  const addToCart = async (product: Product) => {
    if (!userId || !token) {
      showError("Log in first.");
      return;
    }

    // Always fetch cart before add to ensure we have updated cart
    await fetchCart();

    if (cartItems.some((item) => item.productId === product.id)) {
      showError("Already in cart.");
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
        showError("Already in cart.");
        return;
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to add item.");
      }

      // Re-fetch cart after successful add
      await fetchCart();
      showSuccess("Added to cart!");
      setCartUpdated(true);
    } catch (err) {
      console.error("Add to Cart Error:", err);
      showError("Could not add.");
    }
  };

  useEffect(() => {
    if (cartUpdated) {
      fetchCart();
      const timer = setTimeout(() => {
        setCartUpdated(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [cartUpdated]);

  // Fetch products
  const fetchProducts = async () => {
    if (!userId || !token || !institution) {
      setLoading(false);
      showError("Complete your profile.");
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
        Alert.alert("Session Expired", "Log in again.", [
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
        throw new Error("Invalid response.");
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
          (product) =>
            product.ownerId !== userId && product.university === institution
        );
      }

      let finalFiltered = filtered;
      if (selectedCategory !== "#Everything") {
        finalFiltered = finalFiltered.filter(
          (p) => p.category === selectedCategory
        );
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
      console.error("Fetch Error:", err);
      setError(err instanceof Error ? err.message : "Error fetching.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (allProducts.length > 0) {
      let finalFiltered = allProducts;
      if (selectedCategory !== "#Everything") {
        finalFiltered = finalFiltered.filter(
          (p) => p.category === selectedCategory
        );
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

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchProducts();
    fetchCart();
    setCurrentIndex(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campusMode]);

  const toggleFilterModal = () => setIsFilterModalVisible(!isFilterModalVisible);

  // Swipe handler
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
      if (currentIndex < filteredProducts.length - 1) {
        setCurrentIndex(currentIndex + 1);
      } else {
        showError("No more products.");
        setCurrentIndex(0);
      }
    }
  };

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
        setCurrentImageIndex((prev) =>
          prev < product.images.length - 1 ? prev + 1 : 0
        );
      }
    };

    const handleGestureStateChange = ({ nativeEvent }: any) => {
      if (!isTop) return;

      if (nativeEvent.state === State.END) {
        const { translationY, translationX, velocityY, velocityX } =
          nativeEvent;

        if (translationY < -50 && velocityY < -0.5) {
          onSwipeUp();
        } else if (translationX > 50 && velocityX > 0.5) {
          if (!isAdding) {
            setIsAdding(true);
            onSwipeRight();
            setTimeout(() => setIsAdding(false), 1000);
          }
        } else if (translationX < -50 && velocityX < -0.5) {
          onSwipeLeft();
        }
      }
    };

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

    const isFavorite = favorites.includes(product.id);

    return (
      <PanGestureHandler onHandlerStateChange={handleGestureStateChange}>
        <View style={[styles.stackedProduct, style]}>
          {isTop && (
            <View style={styles.topIconsContainer}>
              <TouchableOpacity
                style={[styles.iconContainer]}
                onPress={() => toggleFavorite(product.id)}
                accessibilityLabel="Toggle Favorite"
              >
                <Ionicons
                  name={isFavorite ? "heart" : "heart-outline"}
                  size={22}
                  color={isFavorite ? "#FF3B30" : "#FFFFFF"}
                />
              </TouchableOpacity>
            </View>
          )}

          <TapGestureHandler onActivated={handleImageTap}>
            <View style={styles.imageContainer}>
              <LinearGradient
                colors={["rgba(0,0,0,0.5)", "transparent"]}
                style={styles.topGradientOverlay}
              />
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
              <LinearGradient
                colors={["transparent", "rgba(0,0,0,0.6)"]}
                style={styles.bottomGradientOverlay}
              />

              {isTop && (
                <View style={styles.productInfoBubble}>
                  <View style={styles.productInfoTextContainer}>
                    <Text style={styles.productInfoTitle}>{product.title}</Text>
                    <Text style={styles.productInfoPrice}>
                      ${product.price.toFixed(2)}
                    </Text>
                  </View>
                  <View style={styles.productInfoActions}>
                    <TouchableOpacity
                      style={styles.iconButton}
                      onPress={() => handleSwipe("left")}
                      accessibilityLabel="Next"
                    >
                      <Ionicons name="close" size={20} color="#FF3B30" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.iconButton}
                      onPress={() => handleSwipe("right")}
                      accessibilityLabel="Add to Cart"
                    >
                      <Ionicons name="cart" size={20} color="#34C759" />
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

  const renderActiveFilters = () => {
    const categoryDisplay =
      selectedCategory === "#Everything"
        ? "All"
        : selectedCategory.replace("#", "");
    const modeDisplay = campusMode === "Both" ? "In&Out of Campus" : "In Campus";

    return (
      <View style={styles.filterTagsContainer}>
        <View style={styles.filterTag}>
          <Text style={styles.filterTagText}>{categoryDisplay}</Text>
        </View>
        <View style={styles.filterTag}>
          <Text style={styles.filterTagText}>{modeDisplay}</Text>
        </View>
      </View>
    );
  };

  return (
    <GestureHandlerRootView style={styles.rootContainer}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <LinearGradient colors={["#000000", "#000000"]} style={styles.gradientBackground}>
          {/* Error Toast */}
          {errorMessage ? (
            <Animated.View
              style={[
                styles.toastContainer,
                { backgroundColor: "#FF6B6B", opacity: errorOpacity },
                {
                  transform: [
                    {
                      translateY: errorOpacity.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-50, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              <Text style={styles.toastText}>{errorMessage}</Text>
            </Animated.View>
          ) : null}

          {/* Success Toast */}
          {successMessage ? (
            <Animated.View
              style={[
                styles.toastContainer,
                { backgroundColor: "#81C784", opacity: successOpacity },
                {
                  transform: [
                    {
                      translateY: successOpacity.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-50, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              <Text style={styles.toastText}>{successMessage}</Text>
            </Animated.View>
          ) : null}

          {/* Top Bar with search and filter */}
          <View style={styles.topBar}>
            <View style={styles.searchBarContainer}>
              <Ionicons
                name="search-outline"
                size={16}
                color="#CCCCCC"
                style={{ marginLeft: 10, marginRight: 5 }}
              />
              <TextInput
                style={styles.searchInput}
                placeholder="Search..."
                placeholderTextColor="#AAAAAA"
                value={searchQuery}
                onChangeText={(text) => setSearchQuery(text)}
                returnKeyType="search"
              />
            </View>
            <TouchableOpacity
              style={styles.topBarIconContainer}
              onPress={toggleFilterModal}
              accessibilityLabel="Filter"
            >
              <Ionicons name="options-outline" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {renderActiveFilters()}

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
                accessibilityLabel="Retry"
              >
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : filteredProducts.length === 0 ? (
            <View style={styles.noProductsContainer}>
              <Text style={styles.noProductsText}>No products.</Text>
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
                <Text style={styles.modalTitle}>Filters</Text>

                <View style={styles.divider} />
                <Text style={styles.sectionTitle}>Category</Text>
                <FlatList
                  data={categories}
                  keyExtractor={(item) => item}
                  style={{ width: "100%", marginBottom: 10 }}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[
                        styles.filterOptionButton,
                        selectedCategory === item && styles.filterOptionSelected,
                      ]}
                      onPress={() => setSelectedCategory(item)}
                      accessibilityLabel={`Filter by ${item}`}
                    >
                      <Text
                        style={[
                          styles.filterOptionText,
                          selectedCategory === item &&
                            styles.filterOptionTextSelected,
                        ]}
                      >
                        {item === "#Everything" ? "All" : item.replace("#", "")}
                      </Text>
                    </TouchableOpacity>
                  )}
                />

                <View style={styles.divider} />
                <Text style={styles.sectionTitle}>Mode</Text>
                <FlatList
                  data={campusOptions}
                  keyExtractor={(item) => item.value}
                  style={{ width: "100%", marginBottom: 10 }}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[
                        styles.filterOptionButton,
                        campusMode === item.value && styles.filterOptionSelected,
                      ]}
                      onPress={() => setCampusMode(item.value)}
                      accessibilityLabel={`Filter by ${item.label}`}
                    >
                      <Text
                        style={[
                          styles.filterOptionText,
                          campusMode === item.value &&
                            styles.filterOptionTextSelected,
                        ]}
                      >
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  )}
                />

                <TouchableOpacity
                  style={styles.applyButton}
                  onPress={() => {
                    toggleFilterModal();
                    fetchProducts();
                  }}
                  accessibilityLabel="Apply"
                >
                  <Text style={styles.applyButtonText}>Apply</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={toggleFilterModal}
                  style={styles.modalClose}
                  accessibilityLabel="Close"
                >
                  <Ionicons name="close-outline" size={24} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </Modal>

          {/* Details Modal */}
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
                      ${selectedProduct.price.toFixed(2)}
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
                      accessibilityLabel="Close"
                    >
                      <Ionicons
                        name="close-outline"
                        size={24}
                        color="#FFFFFF"
                      />
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
                <Text style={styles.modalTitle}>Description</Text>
                <ScrollView>
                  <Text style={styles.descriptionText}>
                    {selectedProductDescription}
                  </Text>
                </ScrollView>
                <TouchableOpacity
                  onPress={() => setIsDescriptionModalVisible(false)}
                  style={styles.modalClose}
                  accessibilityLabel="Close"
                >
                  <Ionicons name="close-outline" size={24} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </Modal>

          <BottomNavBar />
        </LinearGradient>
      </TouchableWithoutFeedback>
    </GestureHandlerRootView>
  );
};

export default Dashboard;

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: "#000000",
  },
  gradientBackground: {
    flex: 1,
    paddingBottom: 60,
    backgroundColor: "#000000",
  },
  toastContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    width: SCREEN_WIDTH,
    paddingVertical: 15,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
  },
  toastText: {
    color: "#fff",
    fontWeight: "700",
    textAlign: "center",
  },
  topBar: {
    height: 60,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingTop: Platform.OS === "ios" ? 15 : 10,
    marginBottom: 5,
  },
  searchBarContainer: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "#2C2C2C",
    borderRadius: 8,
    alignItems: "center",
    height: 36,
  },
  searchInput: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 13,
    height: 36,
    paddingRight: 10,
  },
  topBarIconContainer: {
    padding: 6,
    marginLeft: 10,
    backgroundColor: "#2C2C2C",
    borderRadius: 8,
  },
  filterTagsContainer: {
    flexDirection: "row",
    paddingHorizontal: 15,
    paddingVertical: 5,
  },
  filterTag: {
    backgroundColor: "#262626",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginRight: 5,
  },
  filterTagText: {
    color: "#FFFFFF",
    fontSize: 12,
  },
  productStack: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  stackedProduct: {
    position: "absolute",
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.67,
    justifyContent: "flex-start",
    backgroundColor: "transparent",
    overflow: "hidden",
    zIndex: 1,
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
    width: "100%",
    height: "100%",
    justifyContent: "center",
    overflow: "hidden",
    position: "relative",
  },
  productImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
    marginTop: -30,
  },
  topGradientOverlay: {
    position: "absolute",
    top: 0,
    width: "100%",
    height: 150,
    zIndex: 2,
  },
  bottomGradientOverlay: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    height: 200,
    zIndex: 2,
  },
  topIconsContainer: {
    position: "absolute",
    top: 15,
    right: 15,
    flexDirection: "row",
    zIndex: 10,
  },
  iconContainer: {
    marginLeft: 10,
    padding: 7,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 20,
  },
  imageIndicatorsContainer: {
    position: "absolute",
    top: 20,
    flexDirection: "row",
    alignSelf: "center",
    zIndex: 3,
  },
  imageIndicatorDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#AAAAAA",
    marginHorizontal: 2,
  },
  imageIndicatorDotActive: {
    backgroundColor: "#FFFFFF",
  },
  productInfoBubble: {
    position: "absolute",
    bottom: 20,
    left: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 3,
  },
  productInfoTextContainer: {
    flex: 1,
    marginRight: 10,
    justifyContent: "center",
  },
  productInfoTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 2,
  },
  productInfoPrice: {
    color: "#A1A1A1",
    fontSize: 16,
    fontWeight: "600",
  },
  productInfoActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    marginLeft: 12,
  },
  iconButton: {
    backgroundColor: "#333",
    padding: 8,
    borderRadius: 50,
    marginLeft: 10,
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
    paddingHorizontal: 20,
  },
  filterModalContent: {
    width: "100%",
    backgroundColor: "#1F1F1F",
    padding: 20,
    borderRadius: 15,
    alignItems: "center",
    maxHeight: "80%",
    position: "relative",
  },
  descriptionModalContent: {
    width: "85%",
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
    textAlign: "center",
  },
  divider: {
    backgroundColor: "#444",
    height: 1,
    width: "100%",
    marginVertical: 10,
  },
  filterOptionButton: {
    width: "100%",
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
    backgroundColor: "#3A3A3A",
    marginVertical: 5,
  },
  filterOptionSelected: {
    backgroundColor: "#6A4C93", // subtle purple
  },
  filterOptionText: {
    color: "#FFFFFF",
    fontSize: 15,
  },
  filterOptionTextSelected: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  sectionTitle: {
    fontSize: 16,
    color: "#FFFFFF",
    alignSelf: "flex-start",
    marginBottom: 5,
    fontWeight: "600",
  },
  applyButton: {
    backgroundColor: "#6A4C93", // subtle purple
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
    maxHeight: 150,
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
