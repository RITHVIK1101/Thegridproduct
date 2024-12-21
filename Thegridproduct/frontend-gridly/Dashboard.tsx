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

const SWIPE_THRESHOLD = 80;
const DIRECTION_LOCK_THRESHOLD = 10;

const Dashboard: React.FC<DashboardProps> = () => {
  const [campusMode, setCampusMode] = useState<"In Campus" | "Both">("Both");
  const [selectedCategory, setSelectedCategory] =
    useState<string>("#Everything");
  const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isDetailsModalVisible, setIsDetailsModalVisible] = useState(false);
  const [likedProducts, setLikedProducts] = useState<string[]>([]);

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
    "#MaleClothing",
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

  // Manage currentImageIndex in Dashboard
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Toast Animations
  const [errorMessage, setErrorMessage] = useState("");
  const errorOpacity = useRef(new Animated.Value(0)).current;
  const [successMessage, setSuccessMessage] = useState("");
  const successOpacity = useRef(new Animated.Value(0)).current;

  const [userInfo, setUserInfo] = useState<User | null>(null);

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
      if (!response.ok) {
        throw new Error("Failed to fetch liked products");
      }
      const data = await response.json();
      setLikedProducts(data.map((product: Product) => product.id));
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
      setLoading(false);
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
        setLoading(false);
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

      if (searchQuery.trim() !== "") {
        const query = searchQuery.trim().toLowerCase();
        finalFiltered = finalFiltered.filter(
          (p) => p.title && p.title.toLowerCase().includes(query)
        );
      }

      setFilteredProducts(finalFiltered);
      setAllProducts(filtered);
      setError(null);
    } catch (err) {
      console.error("Fetch Products Error:", err);
      setError(err instanceof Error ? err.message : "Error fetching.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (allProducts.length > 0) {
      let finalFiltered = allProducts;
      if (selectedCategory !== "#Everything") {
        const categoryFilter = selectedCategory.replace("#", "").toLowerCase();
        finalFiltered = finalFiltered.filter(
          (p) => p.category && p.category.toLowerCase() === categoryFilter
        );
      }
      if (searchQuery.trim() !== "") {
        const query = searchQuery.trim().toLowerCase();
        finalFiltered = finalFiltered.filter(
          (p) => p.title && p.title.toLowerCase().includes(query)
        );
      }
      setFilteredProducts(finalFiltered);
      setCurrentIndex(0);
      setCurrentImageIndex(0); // Reset image index when products change
    }
  }, [allProducts, selectedCategory, searchQuery]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchProducts();
    fetchCart();
    fetchLikedProducts();
    fetchUserInfo();
    setCurrentIndex(0);
    setCurrentImageIndex(0); // Reset image index when campusMode changes
  }, [campusMode]);

  const toggleFilterModal = () =>
    setIsFilterModalVisible(!isFilterModalVisible);

  const goToNextProduct = () => {
    setIsDescriptionModalVisible(false); // Close description modal on swipe-up
    if (currentIndex < filteredProducts.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setCurrentImageIndex(0); // Reset image index when moving to next product
    } else {
      showError("No more products.");
      setCurrentIndex(0);
      setCurrentImageIndex(0);
    }
  };

  const nextProduct = filteredProducts[currentIndex + 1] || null;

  type ProductItemProps = {
    product: Product;
    nextProduct: Product | null;
    index: number;
    currentIndex: number;
    onAddToCart: (product: Product) => void;
    onToggleFavorite: (id: string) => void;
    onShowDescription: (desc: string) => void;
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
    const translateX = useRef(new Animated.Value(0)).current;
    const translateY = useRef(new Animated.Value(0)).current;

    const doubleTapRef = useRef(null);
    const singleTapRef = useRef(null);

    // Use a ref for direction locking so it resets after each gesture
    const directionLockedRef = useRef<"horizontal" | "vertical" | null>(null);
    const isLiked = likedProducts.includes(product.id);
    const onHandlerStateChange = ({ nativeEvent }: any) => {
      if (nativeEvent.state === State.END) {
        const { translationX, translationY } = nativeEvent;

        if (directionLockedRef.current === "horizontal") {
          if (translationX < -SWIPE_THRESHOLD) {
            // Swipe Left: Show next image
            Animated.timing(translateX, {
              toValue: -SCREEN_WIDTH,
              duration: 300,
              useNativeDriver: true,
            }).start(({ finished }) => {
              if (finished) {
                const nextIdx =
                  currentImageIndex < product.images.length - 1
                    ? currentImageIndex + 1
                    : 0;
                setCurrentImageIndex(nextIdx);
                // Prevent flicker by waiting for the new index to render
                requestAnimationFrame(() => {
                  translateX.setValue(0);
                });
              } else {
                translateX.setValue(0);
              }
            });
            directionLockedRef.current = null;
            return;
          }
          if (translationX > SWIPE_THRESHOLD) {
            // Swipe Right: Add to cart
            onAddToCart(product);
            directionLockedRef.current = null;
            return;
          }

          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        } else if (directionLockedRef.current === "vertical") {
          if (translationY < -SWIPE_THRESHOLD) {
            // Swipe Up: Navigate to next product
            Animated.timing(translateY, {
              toValue: -SCREEN_HEIGHT * 0.67, // Adjust to match product height
              duration: 300,
              useNativeDriver: true,
            }).start(({ finished }) => {
              if (finished) {
                // Call onNextProduct FIRST
                onNextProduct();
                // Then wait for a frame to reset translateY
                requestAnimationFrame(() => {
                  translateY.setValue(0);
                });
              } else {
                translateY.setValue(0);
              }
            });
            directionLockedRef.current = null;
            return;
          }

          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        } else {
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }

        // Reset direction lock at the end of gesture
        directionLockedRef.current = null;
      }
    };

    const onGestureEvent = ({ nativeEvent }: any) => {
      const { translationX, translationY } = nativeEvent;
      const absX = Math.abs(translationX);
      const absY = Math.abs(translationY);

      if (!directionLockedRef.current) {
        if (absX > absY && absX > DIRECTION_LOCK_THRESHOLD) {
          directionLockedRef.current = "horizontal";
        } else if (absY > absX && absY > DIRECTION_LOCK_THRESHOLD) {
          directionLockedRef.current = "vertical";
        }
      }

      if (directionLockedRef.current === "horizontal") {
        // Only allow left-swipe movement visually
        if (translationX < 0) {
          translateX.setValue(translationX);
        } else {
          translateX.setValue(0);
        }
        translateY.setValue(0);
      } else if (directionLockedRef.current === "vertical") {
        translateY.setValue(translationY);
        translateX.setValue(0);
      }
    };

    const onDoubleTap = () => {
      onToggleFavorite(product.id);
    };

    const onSingleTap = () => {
      onShowDescription(product.description);
    };

    const isTop = index === currentIndex;

    // If there's no next product, just reuse the same product image to avoid null references
    const actualNextProduct = nextProduct || product;
    const nextProductImage =
      actualNextProduct.images && actualNextProduct.images.length > 0
        ? actualNextProduct.images[0]
        : "https://via.placeholder.com/150";

    // Current image + next image horizontally
    const getNextImageIndex = () =>
      currentImageIndex < product.images.length - 1 ? currentImageIndex + 1 : 0;

    const nextImageIndex = getNextImageIndex();

    const currentImageURI =
      product.images && product.images.length > 0
        ? product.images[currentImageIndex]
        : "https://via.placeholder.com/150";

    const nextImageURI =
      product.images && product.images.length > 0
        ? product.images[nextImageIndex]
        : "https://via.placeholder.com/150";

    return (
      <View
        style={[
          styles.stackedProduct,
          isTop ? styles.topProduct : styles.bottomProduct,
        ]}
      >
        {isTop && (
          <View style={styles.topIconsContainer}>
            <TouchableOpacity
              style={[styles.iconContainer]}
              onPress={() => onToggleFavorite(product.id)}
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

        <PanGestureHandler
          onGestureEvent={onGestureEvent}
          onHandlerStateChange={onHandlerStateChange}
        >
          <Animated.View
            style={{
              width: SCREEN_WIDTH,
              height: SCREEN_HEIGHT * 0.67,
              transform: [
                { translateX: translateX },
                { translateY: translateY },
              ],
            }}
          >
            {/* Next product below current product (swipe up preview) */}
            <View
              style={{
                position: "absolute",
                top: SCREEN_HEIGHT * 0.67,
                width: SCREEN_WIDTH,
                height: SCREEN_HEIGHT * 0.67,
              }}
            >
              <Image
                source={{ uri: nextProductImage }}
                style={styles.productImage}
                resizeMode="cover"
              />
              <LinearGradient
                colors={["rgba(0,0,0,0.5)", "transparent"]}
                style={styles.topGradientOverlay}
              />
              <LinearGradient
                colors={["transparent", "rgba(0,0,0,0.6)"]}
                style={styles.bottomGradientOverlay}
              />
            </View>

            {/* TapGestureHandler for the current + next images horizontally */}
            <TapGestureHandler
              ref={doubleTapRef}
              numberOfTaps={2}
              onActivated={onDoubleTap}
            >
              <TapGestureHandler
                ref={singleTapRef}
                waitFor={doubleTapRef}
                numberOfTaps={1}
                onActivated={onSingleTap}
              >
                <View
                  style={{
                    width: SCREEN_WIDTH * 2,
                    height: "100%",
                    flexDirection: "row",
                  }}
                >
                  {/* Current image (left half) */}
                  <View style={{ width: SCREEN_WIDTH, height: "100%" }}>
                    <LinearGradient
                      colors={["rgba(0,0,0,0.5)", "transparent"]}
                      style={styles.topGradientOverlay}
                    />
                    <Image
                      source={{ uri: currentImageURI }}
                      style={styles.productImage}
                      resizeMode="cover"
                    />
                    <LinearGradient
                      colors={["transparent", "rgba(0,0,0,0.6)"]}
                      style={styles.bottomGradientOverlay}
                    />
                  </View>

                  {/* Next image horizontally (right half) */}
                  <View style={{ width: SCREEN_WIDTH, height: "100%" }}>
                    <LinearGradient
                      colors={["rgba(0,0,0,0.5)", "transparent"]}
                      style={styles.topGradientOverlay}
                    />
                    <Image
                      source={{ uri: nextImageURI }}
                      style={styles.productImage}
                      resizeMode="cover"
                    />
                    <LinearGradient
                      colors={["transparent", "rgba(0,0,0,0.6)"]}
                      style={styles.bottomGradientOverlay}
                    />
                  </View>
                </View>
              </TapGestureHandler>
            </TapGestureHandler>
          </Animated.View>
        </PanGestureHandler>

        {/* Keep the product info outside the Animated View 
            so it doesn't disappear and reappear on left swipe */}
        {isTop && (
          <>
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
                  onPress={() => {
                    const newIdx =
                      currentImageIndex < product.images.length - 1
                        ? currentImageIndex + 1
                        : 0;
                    setCurrentImageIndex(newIdx);
                  }}
                  accessibilityLabel="Next Image"
                >
                  <Ionicons name="close" size={20} color="#FF3B30" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.iconButton}
                  onPress={() => onShowDescription(product.description)}
                  accessibilityLabel="Info"
                >
                  <Ionicons
                    name="information-circle"
                    size={20}
                    color="#FFFFFF"
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.iconButton}
                  onPress={() => onAddToCart(product)}
                  accessibilityLabel="Add to Cart"
                >
                  <Ionicons name="cart" size={20} color="#34C759" />
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

  const renderActiveFilters = () => {
    const categoryDisplay =
      selectedCategory === "#Everything"
        ? "All"
        : selectedCategory.replace("#", "");
    const modeDisplay =
      campusMode === "Both" ? "In & Out of Campus" : "In Campus";

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
        <LinearGradient
          colors={["#000000", "#000000"]}
          style={styles.gradientBackground}
        >
          {errorMessage ? (
            <Animated.View
              style={[
                styles.smallToastContainer,
                { backgroundColor: "#FF6B6B", opacity: errorOpacity },
                {
                  transform: [
                    {
                      translateY: errorOpacity.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-20, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              <Text style={styles.toastText}>{errorMessage}</Text>
            </Animated.View>
          ) : null}

          {successMessage ? (
            <Animated.View
              style={[
                styles.smallToastContainer,
                { backgroundColor: "#81C784", opacity: successOpacity },
                {
                  transform: [
                    {
                      translateY: successOpacity.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-20, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              <Text style={styles.toastText}>{successMessage}</Text>
            </Animated.View>
          ) : null}

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
                  setCurrentImageIndex(0);
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
                    onShowDescription={(desc) => {
                      setSelectedProductDescription(desc);
                      setIsDescriptionModalVisible(true);
                    }}
                    onNextProduct={goToNextProduct}
                    isFavorite={likedProducts.includes(product.id)} // Updated here
                    currentImageIndex={currentImageIndex}
                    setCurrentImageIndex={setCurrentImageIndex}
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
                        selectedCategory === item &&
                          styles.filterOptionSelected,
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
                        campusMode === item.value &&
                          styles.filterOptionSelected,
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
    paddingVertical: 6,
  },
  filterTag: {
    backgroundColor: "#262626",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginRight: 5,
    marginTop: -9,
  },
  filterTagText: {
    color: "#FFFFFF",
    fontSize: 12,
  },
  productStack: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginTop: -24,
  },
  stackedProduct: {
    position: "absolute",
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.669,
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
    opacity: 0,
    transform: [{ scale: 0.95 }, { translateY: SCREEN_HEIGHT * 0.05 }],
  },
  productImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
    transform: [{ translateY: -1 }],
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
    backgroundColor: "#6A4C93",
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
    backgroundColor: "#6A4C93",
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
