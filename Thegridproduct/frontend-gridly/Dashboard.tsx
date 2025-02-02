// Dashboard.tsx

import React, { useState, useEffect, useContext, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Modal,
  Alert,
  Dimensions,
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
  useFocusEffect,
} from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import Ionicons from "react-native-vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import BottomNavBar from "./components/BottomNavbar";
import { NGROK_URL } from "@env";
import { UserContext } from "./UserContext";
import { RootStackParamList } from "./navigationTypes";
// Using react-native-gesture-handler for pan & tap gestures:
import {
  PanGestureHandler,
  TapGestureHandler,
  State as GestureState,
} from "react-native-gesture-handler";

type DashboardProps = {
  route: RouteProp<RootStackParamList, "Dashboard">;
};

type Product = {
  id: string;
  title: string;
  price: number;
  description: string;
  category?: string;
  images: string[];
  university: string;
  userId: string;
  postedDate: string;
  rating?: number;
  quality?: string;
  availability: string;
};

type User = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  institution: string;
};

type CartItem = {
  productId: string;
  quantity: number;
};

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get("window");

// -------------------------------------------------------------------
// PRODUCT_HEIGHT controls how tall the product image container is.
// -------------------------------------------------------------------
const PRODUCT_HEIGHT = SCREEN_HEIGHT - 80; // 60 is the nav bar height
const NAV_BAR_HEIGHT = 90;

const Dashboard: React.FC<DashboardProps> = () => {
  const {
    userId,
    token,
    institution,
    clearUser,
    likedProducts,
    setLikedProducts,
  } = useContext(UserContext);

  // Filters for the filter modal
  const [campusMode, setCampusMode] = useState<"In Campus" | "Both">("Both");
  const [selectedCategory, setSelectedCategory] = useState<string>("#Everything");
  const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);

  // For product details displayed in the description modal
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isDescriptionModalVisible, setIsDescriptionModalVisible] = useState(false);

  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();

  const categories = [
    "#Everything",
    "#FemaleClothing",
    "#MaleClothing",
    "#Other",
  ];

  const campusOptions: Array<{ label: string; value: "In Campus" | "Both" }> = [
    { label: "In and Out of Campus", value: "Both" },
    { label: "In Campus", value: "In Campus" },
  ];

  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [cartUpdated, setCartUpdated] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Toast Animations for errors and success (added-to-cart)
  const [errorMessage, setErrorMessage] = useState("");
  const errorOpacity = useState(new Animated.Value(0))[0];
  const [successMessage, setSuccessMessage] = useState("");
  const successOpacity = useState(new Animated.Value(0))[0];

  const [userInfo, setUserInfo] = useState<User | null>(null);

  const showError = (msg: string) => {
    setErrorMessage(msg);
    Animated.timing(errorOpacity, {
      toValue: 1,
      duration: 300,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start(() => {
      setTimeout(() => {
        Animated.timing(errorOpacity, {
          toValue: 0,
          duration: 300,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
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
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start(() => {
      setTimeout(() => {
        Animated.timing(successOpacity, {
          toValue: 0,
          duration: 300,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }).start(() => {
          setSuccessMessage("");
        });
      }, 2500);
    });
  };

  const toggleFavorite = (productId: string) => {
    if (likedProducts.includes(productId)) {
      unlikeProduct(productId);
    } else {
      likeProduct(productId);
    }
  };

  const fetchUserInfo = async () => {
    if (!userId || !token) return;
    try {
      const response = await fetch(`${NGROK_URL}/users/${userId}`, {
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
        throw new Error("Failed to fetch user info.");
      }
      const data: User = await response.json();
      setUserInfo(data);
    } catch (err) {
      console.error("Fetch User Info Error:", err);
      showError("Failed to fetch user information.");
    }
  };

  const likeProduct = async (productId: string) => {
    try {
      const response = await fetch(`${NGROK_URL}/products/${productId}/like`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        throw new Error("Failed to like product");
      }
      setLikedProducts((prev) => [...prev, productId]);
      showSuccess("Liked the product!");
    } catch (error) {
      console.error("Error liking product:", error);
      showError("Failed to like product.");
    }
  };

  const unlikeProduct = async (productId: string) => {
    try {
      const response = await fetch(
        `${NGROK_URL}/products/${productId}/unlike`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (!response.ok) {
        throw new Error("Failed to unlike product");
      }
      setLikedProducts((prev) => prev.filter((id) => id !== productId));
      showSuccess("Unliked the product!");
    } catch (error) {
      console.error("Error unliking product:", error);
      showError("Failed to unlike product.");
    }
  };

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
    }
  };

  const fetchLikedProducts = async () => {
    if (!userId || !token) return;
    try {
      const response = await fetch(`${NGROK_URL}/products/liked`, {
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
        throw new Error("Failed to fetch liked products");
      }
      const data = await response.json();
      if (!data) {
        setLikedProducts([]);
        console.log("No liked products found");
        return;
      }
      if (Array.isArray(data)) {
        const likedProductIds = data.map((product: Product) => product.id);
        setLikedProducts(likedProductIds);
        console.log("Fetched Liked Products IDs:", likedProductIds);
      } else {
        setLikedProducts([]);
        console.log("No liked products data available");
      }
    } catch (error) {
      console.error("Error fetching liked products:", error);
      showError("Failed to fetch liked products.");
    }
  };

  const addToCart = async (product: Product) => {
    if (!userId || !token) {
      showError("Log in first.");
      return;
    }
    await fetchCart();
    // If already in cart, still show success message but don't add again.
    if (cartItems.some((item) => item.productId === product.id)) {
      showSuccess("Added to cart!");
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
        showSuccess("Added to cart!");
        return;
      }
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to add item.");
      }
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

  const fetchProducts = async () => {
    if (!userId || !token || !institution) {
      showError("Complete your profile.");
      return;
    }
    try {
      let url = `${NGROK_URL}/products/all`;
      if (campusMode === "In Campus") {
        url += "?mode=in";
      } else if (campusMode === "Both") {
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
        throw new Error("Invalid response.");
      }
      const data: any[] = await response.json();
      if (!data || data.length === 0) {
        setAllProducts([]);
        setFilteredProducts([]);
        setError(null);
        return;
      }
      const mappedData: Product[] = data.map((product) => ({
        id: product._id || product.id || `product-${Math.random()}`,
        title: product.title,
        price: product.price,
        description: product.description,
        category: product.category,
        images: product.images,
        university: product.university,
        userId: product.userId,
        postedDate: product.postedDate,
        rating: product.rating,
        quality: product.quality,
        availability: product.availability,
      }));
      let filtered = mappedData;
      if (campusMode === "In Campus") {
        filtered = mappedData.filter(
          (product) =>
            product.userId !== userId &&
            product.university.toLowerCase() === institution.toLowerCase() &&
            product.availability === "In Campus Only"
        );
      }
      let finalFiltered = filtered;
      if (selectedCategory !== "#Everything") {
        const categoryFilter = selectedCategory.replace("#", "").toLowerCase();
        finalFiltered = finalFiltered.filter(
          (p) => p.category && p.category.toLowerCase() === categoryFilter
        );
      }
      setFilteredProducts(finalFiltered);
      setAllProducts(filtered);
      setError(null);
    } catch (err) {
      console.error("Fetch Products Error:", err);
      setError(err instanceof Error ? err.message : "Error fetching.");
    }
  };

  // Reset current product index when products or category changes.
  useEffect(() => {
    if (allProducts.length > 0) {
      let finalFiltered = allProducts;
      if (selectedCategory !== "#Everything") {
        const categoryFilter = selectedCategory.replace("#", "").toLowerCase();
        finalFiltered = finalFiltered.filter(
          (p) => p.category && p.category.toLowerCase() === categoryFilter
        );
      }
      setFilteredProducts(finalFiltered);
      setCurrentIndex(0);
      setCurrentImageIndex(0);
    }
  }, [allProducts, selectedCategory]);

  useEffect(() => {
    setError(null);
    fetchProducts();
    fetchCart();
    fetchUserInfo();
    setCurrentIndex(0);
    setCurrentImageIndex(0);
  }, [campusMode]);

  useFocusEffect(
    React.useCallback(() => {
      fetchLikedProducts();
    }, [token])
  );

  const toggleFilterModal = () => setIsFilterModalVisible(!isFilterModalVisible);

  // Simplified “next product” function.
  const goToNextProduct = () => {
    setIsDescriptionModalVisible(false);
    if (currentIndex < filteredProducts.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setCurrentImageIndex(0);
    } else {
      showError("No more products.");
      setCurrentIndex(0);
      setCurrentImageIndex(0);
    }
  };

  // ----------------------------------------------------------------
  // ProductItem component using react-native-gesture-handler.
  // Gestures:
  // • Pan (swipe):
  //    - Left: next image (if available)
  //    - Right: previous image (if available)
  //    - Up: next product
  //    - Down: show description (full details)
  // • Single tap: show description
  // • Double tap: toggle favorite
  // ----------------------------------------------------------------
  type ProductItemProps = {
    product: Product;
    nextProduct: Product | null;
    index: number;
    currentIndex: number;
    onAddToCart: (product: Product) => void;
    onToggleFavorite: (id: string) => void;
    onShowDescription: (product: Product) => void;
    onNextProduct: () => void;
    isFavorite: boolean;
    currentImageIndex: number;
    setCurrentImageIndex: (index: number) => void;
  };

  const ProductItem: React.FC<ProductItemProps> = ({
    product,
    nextProduct,
    index,
    currentIndex,
    onAddToCart,
    onToggleFavorite,
    onShowDescription,
    onNextProduct,
    isFavorite,
    currentImageIndex,
    setCurrentImageIndex,
  }) => {
    // Local state to control inline expansion of the title.
    const [titleExpanded, setTitleExpanded] = useState(false);

    // Reference for double-tap handler.
    const doubleTapRef = useRef<any>(null);
    // Reduced swipe threshold for more sensitive swipe actions.
    const SWIPE_THRESHOLD = 20;

    // Pan gesture handler.
    const onPanHandlerStateChange = (event: any) => {
      if (event.nativeEvent.state === GestureState.END) {
        const { translationX, translationY } = event.nativeEvent;
        if (Math.abs(translationX) > Math.abs(translationY)) {
          // Horizontal swipe:
          if (translationX < -SWIPE_THRESHOLD) {
            // Swipe left: go to next image only if not on the last image.
            if (currentImageIndex < product.images.length - 1) {
              setCurrentImageIndex(currentImageIndex + 1);
            }
          } else if (translationX > SWIPE_THRESHOLD) {
            // Swipe right: go back to the previous image if available.
            if (currentImageIndex > 0) {
              setCurrentImageIndex(currentImageIndex - 1);
            }
          }
        } else {
          // Vertical swipe:
          if (translationY < -SWIPE_THRESHOLD) {
            onNextProduct();
          } else if (translationY > SWIPE_THRESHOLD) {
            onShowDescription(product);
          }
        }
      }
    };

    // Tap handlers.
    const onSingleTap = () => {
      onShowDescription(product);
    };
    const onDoubleTap = () => {
      onToggleFavorite(product.id);
    };

    const currentImageURI =
      product.images && product.images.length > 0
        ? product.images[currentImageIndex]
        : "https://via.placeholder.com/150";
    const nextImageIndex =
      currentImageIndex < product.images.length - 1 ? currentImageIndex + 1 : currentImageIndex;
    const nextImageURI =
      product.images && product.images.length > 0
        ? product.images[nextImageIndex]
        : "https://via.placeholder.com/150";

    const actualNextProduct = nextProduct || product;
    const nextProductImage =
      actualNextProduct.images && actualNextProduct.images.length > 0
        ? actualNextProduct.images[0]
        : "https://via.placeholder.com/150";

    return (
      <View
        style={[
          styles.stackedProduct,
          index === currentIndex ? styles.topProduct : styles.bottomProduct,
        ]}
      >
        <PanGestureHandler onHandlerStateChange={onPanHandlerStateChange}>
          <TapGestureHandler
            onHandlerStateChange={(event) => {
              if (event.nativeEvent.state === GestureState.ACTIVE) {
                onSingleTap();
              }
            }}
            waitFor={doubleTapRef}
            numberOfTaps={1}
          >
            <TapGestureHandler
              ref={doubleTapRef}
              numberOfTaps={2}
              onHandlerStateChange={(event) => {
                if (event.nativeEvent.state === GestureState.ACTIVE) {
                  onDoubleTap();
                }
              }}
            >
              <View style={{ width: SCREEN_WIDTH, height: PRODUCT_HEIGHT, backgroundColor: "#000" }}>
                {/* Swipeable image container */}
                <View
                  style={{
                    flexDirection: "row",
                    width: SCREEN_WIDTH * 2,
                    height: "100%",
                    backgroundColor: "#000",
                  }}
                >
                  <View style={{ width: SCREEN_WIDTH, height: "100%" }}>
                    <LinearGradient
                      colors={["rgba(0,0,0,0.5)", "transparent"]}
                      style={styles.topGradientOverlay}
                    />
                    <Image
                      source={{ uri: currentImageURI }}
                      style={[styles.productImage, { backgroundColor: "#000" }]}
                      fadeDuration={0}
                      resizeMode="cover"
                    />
                    <LinearGradient
                      colors={["transparent", "rgba(0,0,0,0.3)"]}
                      style={styles.bottomGradientOverlay}
                    />
                  </View>
                  <View style={{ width: SCREEN_WIDTH, height: "100%" }}>
                    <LinearGradient
                      colors={["rgba(0,0,0,0.5)", "transparent"]}
                      style={styles.topGradientOverlay}
                    />
                    <Image
                      source={{ uri: nextImageURI }}
                      style={[styles.productImage, { backgroundColor: "#000" }]}
                      fadeDuration={0}
                      resizeMode="cover"
                    />
                    <LinearGradient
                      colors={["transparent", "rgba(0,0,0,0.3)"]}
                      style={styles.bottomGradientOverlay}
                    />
                  </View>
                </View>
                {/* Mid-screen image indicators */}
                <View style={styles.midImageIndicatorsContainer}>
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
              </View>
            </TapGestureHandler>
          </TapGestureHandler>
        </PanGestureHandler>
        {index === currentIndex && (
          <>
            <View style={styles.productInfoBubble}>
              <View style={styles.productInfoTextContainer}>
                <TouchableOpacity onPress={() => setTitleExpanded(!titleExpanded)}>
                  <Text
                    style={styles.productInfoTitle}
                    numberOfLines={titleExpanded ? undefined : 1}
                    ellipsizeMode="tail"
                  >
                    {product.title}
                  </Text>
                </TouchableOpacity>
                <Text style={styles.productInfoPrice}>
                  ${product.price.toFixed(2)}
                </Text>
              </View>
              <View style={styles.productInfoActions}>
                <TouchableOpacity
                  style={styles.iconButton}
                  onPress={() => onToggleFavorite(product.id)}
                  accessibilityLabel="Toggle Favorite"
                >
                  <Ionicons
                    name={isFavorite ? "heart" : "heart-outline"}
                    size={20}
                    color={isFavorite ? "#FF3B30" : "#FFFFFF"}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.iconButton}
                  onPress={() => {
                    if (currentImageIndex < product.images.length - 1) {
                      setCurrentImageIndex(currentImageIndex + 1);
                    }
                  }}
                  accessibilityLabel="Next Image"
                >
                  <Ionicons name="arrow-forward" size={20} color="#FF3B6F" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.iconButton}
                  onPress={() => onShowDescription(product)}
                  accessibilityLabel="Show Details"
                >
                  <Ionicons name="information-circle" size={20} color="#FFFFFF" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.iconButton}
                  onPress={() => onAddToCart(product)}
                  accessibilityLabel="Add to Cart"
                >
                  <Ionicons name="cart" size={20} color="#34C759" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.iconButton}
                  onPress={onNextProduct}
                  accessibilityLabel="Next Product"
                >
                  <Ionicons name="close" size={20} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>
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
          </>
        )}
      </View>
    );
  };

  return (
    <View style={styles.rootContainer}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <LinearGradient colors={["#000000", "#000000"]} style={styles.gradientBackground}>
          {error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity
                style={styles.retryButton}
                onPress={() => {
                  setError(null);
                  fetchProducts();
                  fetchCart();
                  setCurrentIndex(0);
                  setCurrentImageIndex(0);
                }}
                accessibilityLabel="Retry"
              >
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : filteredProducts.length === 0 ? (
            <View style={{ flex: 1, backgroundColor: "#000000" }} />
          ) : (
            <View style={styles.productStack}>
              {filteredProducts
                .slice(currentIndex, currentIndex + 1)
                .map((product, idx) => (
                  <ProductItem
                    key={product.id}
                    product={product}
                    nextProduct={filteredProducts[currentIndex + 1] || null}
                    index={currentIndex + idx}
                    currentIndex={currentIndex}
                    onAddToCart={addToCart}
                    onToggleFavorite={toggleFavorite}
                    onShowDescription={(prod) => {
                      setSelectedProduct(prod);
                      setIsDescriptionModalVisible(true);
                    }}
                    onNextProduct={goToNextProduct}
                    isFavorite={likedProducts.includes(product.id)}
                    currentImageIndex={currentImageIndex}
                    setCurrentImageIndex={setCurrentImageIndex}
                  />
                ))}
            </View>
          )}
          {/* Description Modal with full product details */}
          <Modal
            visible={isDescriptionModalVisible}
            animationType="slide"
            transparent={true}
            onRequestClose={() => setIsDescriptionModalVisible(false)}
          >
            <TouchableOpacity
              style={styles.centerModalOverlay}
              activeOpacity={1}
              onPressOut={() => setIsDescriptionModalVisible(false)}
            >
              <View style={styles.descriptionModalContent}>
                {selectedProduct && (
                  <ScrollView>
                    <Text style={styles.modalTitle}>{selectedProduct.title}</Text>
                    <Text style={styles.detailText}>
                      Price: ${selectedProduct.price.toFixed(2)}
                    </Text>
                    <Text style={styles.detailText}>
                      Condition: {selectedProduct.quality || "New"}
                    </Text>
                    <Text style={styles.detailText}>
                      Rating: {selectedProduct.rating ? selectedProduct.rating : "N/A"}
                    </Text>
                    <Text style={styles.detailText}>Description:</Text>
                    <Text style={styles.descriptionText}>
                      {selectedProduct.description}
                    </Text>
                  </ScrollView>
                )}
                <TouchableOpacity
                  onPress={() => setIsDescriptionModalVisible(false)}
                  style={styles.modalClose}
                  accessibilityLabel="Close Details Modal"
                >
                  <Ionicons name="close-outline" size={24} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </Modal>
          {/* Filter Modal */}
          <Modal
            visible={isFilterModalVisible}
            animationType="slide"
            transparent={true}
            onRequestClose={toggleFilterModal}
          >
            <TouchableOpacity
              style={styles.modalOverlay}
              activeOpacity={1}
              onPressOut={toggleFilterModal}
            >
              <View style={styles.filterModalContainer}>
                <Text style={styles.filterModalTitle}>Filters</Text>
                <View style={styles.divider} />
                <Text style={styles.sectionTitle}>Category</Text>
                <FlatList
                  data={categories}
                  keyExtractor={(item) => item}
                  style={{ width: "100%", marginBottom: 10 }}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[
                        styles.filterModalOption,
                        selectedCategory === item && styles.filterModalOptionSelected,
                      ]}
                      onPress={() => setSelectedCategory(item)}
                      accessibilityLabel={`Filter by ${item}`}
                    >
                      <Ionicons
                        name={selectedCategory === item ? "checkbox-outline" : "ellipse-outline"}
                        size={20}
                        color={selectedCategory === item ? "#BB86FC" : "#FFFFFF"}
                        style={{ marginRight: 10 }}
                      />
                      <Text
                        style={[
                          styles.filterModalOptionText,
                          selectedCategory === item && styles.filterModalOptionTextSelected,
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
                        styles.filterModalOption,
                        campusMode === item.value && styles.filterModalOptionSelected,
                      ]}
                      onPress={() => setCampusMode(item.value)}
                      accessibilityLabel={`Filter by ${item.label}`}
                    >
                      <Ionicons
                        name={campusMode === item.value ? "checkbox-outline" : "ellipse-outline"}
                        size={20}
                        color={campusMode === item.value ? "#BB86FC" : "#FFFFFF"}
                        style={{ marginRight: 10 }}
                      />
                      <Text
                        style={[
                          styles.filterModalOptionText,
                          campusMode === item.value && styles.filterModalOptionTextSelected,
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
                  accessibilityLabel="Apply Filters"
                >
                  <Text style={styles.applyButtonText}>Apply Filters</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={toggleFilterModal}
                  style={styles.modalClose}
                  accessibilityLabel="Close Filter Modal"
                >
                  <Ionicons name="close-circle" size={24} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </Modal>
          {/* Success Toast repositioned underneath the image indicators */}
          {successMessage !== "" && (
            <Animated.View style={[styles.successToastContainer, { opacity: successOpacity }]}>
              <Text style={styles.toastText}>{successMessage}</Text>
            </Animated.View>
          )}
          <BottomNavBar />
        </LinearGradient>
      </TouchableWithoutFeedback>
    </View>
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
    backgroundColor: "#000000",
    paddingBottom: NAV_BAR_HEIGHT,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "flex-end",
  },
  centerModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  smallToastContainer: {
    position: "absolute",
    top: 10,
    right: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
  },
  toastText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 12,
    textAlign: "center",
  },
  // Success Toast is now repositioned underneath the image indicators.
  successToastContainer: {
    position: "absolute",
    top: PRODUCT_HEIGHT / 2 - 230, // Adjusted to appear just underneath the mid-image indicators
    alignSelf: "center",
    backgroundColor: "#34C759",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    zIndex: 10000,
  },
  topBar: {
    position: "absolute",
    top: Platform.OS === "ios" ? 66 : 40,
    left: 20,
    zIndex: 10,
  },
  topBarIconContainer: {
    padding: 6,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 8,
  },
  productStack: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  stackedProduct: {
    position: "absolute",
    width: SCREEN_WIDTH,
    height: PRODUCT_HEIGHT,
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
    opacity: 0,
    transform: [{ scale: 0.95 }, { translateY: 20 }],
  },
  productImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
    backgroundColor: "#000",
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
    height: 100,
    zIndex: 2,
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
    backgroundColor: "rgba(0,0,0,0.3)",
    borderRadius: 10,
    padding: 10,
  },
  productInfoTextContainer: {
    flex: 1,
    marginRight: 10,
  },
  productInfoTitle: {
    color: "#FFFFFF",
    fontSize: 16,
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
    marginLeft: 12,
  },
  iconButton: {
    backgroundColor: "rgba(50,50,50,0.6)",
    padding: 8,
    borderRadius: 50,
    marginLeft: 10,
  },
  imageIndicatorsContainer: {
    position: "absolute",
    top: 20,
    flexDirection: "row",
    alignSelf: "center",
    zIndex: 3,
  },
  midImageIndicatorsContainer: {
    position: "absolute",
    top: PRODUCT_HEIGHT / 2 - 270, // Adjust this value to shift the indicators higher or lower
    flexDirection: "row",
    alignSelf: "center",
    zIndex: 4,
  },
  imageIndicatorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#AAAAAA",
    marginHorizontal: 3,
  },
  imageIndicatorDotActive: {
    backgroundColor: "#FFFFFF",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 15,
  },
  errorText: {
    color: "#FF3B30",
    fontSize: 16,
    textAlign: "center",
    marginBottom: 8,
  },
  retryButton: {
    backgroundColor: "#007AFF",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 25,
  },
  retryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "500",
  },
  noProductsContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  noProductsText: {
    color: "#FFFFFF",
    fontSize: 18,
  },
  filterModalContainer: {
    backgroundColor: "#1A1A1A",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    maxHeight: "80%",
  },
  filterModalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 12,
    textAlign: "center",
  },
  divider: {
    backgroundColor: "#444",
    height: 1,
    width: "100%",
    marginVertical: 10,
  },
  sectionTitle: {
    fontSize: 16,
    color: "#FFFFFF",
    marginBottom: 5,
    fontWeight: "600",
  },
  filterModalOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
  },
  filterModalOptionSelected: {
    backgroundColor: "#BB86FC20",
    borderRadius: 10,
  },
  filterModalOptionText: {
    fontSize: 14,
    color: "#FFFFFF",
  },
  filterModalOptionTextSelected: {
    color: "#BB86FC",
    fontWeight: "600",
  },
  applyButton: {
    backgroundColor: "#BB86FC",
    paddingVertical: 12,
    borderRadius: 25,
    marginTop: 15,
    alignItems: "center",
  },
  applyButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
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
  descriptionModalContent: {
    width: "85%",
    backgroundColor: "#1E1E1E",
    padding: 20,
    borderRadius: 15,
    alignItems: "center",
    maxHeight: "70%",
  },
  descriptionText: {
    color: "#FFFFFF",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  detailText: {
    color: "#FFFFFF",
    fontSize: 14,
    marginBottom: 4,
  },
});
