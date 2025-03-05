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
  Animated,
  Easing,
  TouchableWithoutFeedback,
  Keyboard,
  Platform,
  ScrollView as RNScrollView,
  TextInput,
} from "react-native";
import {
  ScrollView,
  PanGestureHandler,
  TapGestureHandler,
  State as GestureState,
} from "react-native-gesture-handler";
import {
  useNavigation,
  CommonActions,
  RouteProp,
  useFocusEffect,
} from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import Ionicons from "react-native-vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import BottomNavBar from "./components/BottomNavbar";
import { NGROK_URL } from "@env";
import { UserContext } from "./UserContext";
import { RootStackParamList } from "./navigationTypes";
import AsyncStorage from "@react-native-async-storage/async-storage";

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get("window");
const PRODUCT_HEIGHT = SCREEN_HEIGHT - 80; // minus nav bar height
const NAV_BAR_HEIGHT = 90;
const SWIPE_THRESHOLD = 20; // for pan gesture

/* ---------- Helper: Fisher–Yates Shuffle ---------- */
function shuffleArray<T>(array: T[]): T[] {
  const copy = array.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

type DashboardProps = {
  route: RouteProp<RootStackParamList, "Dashboard">;
};

type Product = {
  id: string;
  title: string;
  price: number;
  outOfCampusPrice?: number;
  description: string;
  category?: string;
  images: string[];
  university: string;
  userId: string;
  postedDate: string;
  rating?: number;
  quality?: string;
  availability: string;
  selectedTags?: string[];
  rentPrice?: number;
  rentDuration?: string;
};

type User = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  institution: string;
  profilePicture: string;
};

type CartItem = {
  productId: string;
  quantity: number;
};

type RequestedProduct = {
  productName: string;
  description: string;
};

const Dashboard: React.FC<DashboardProps> = () => {
  const {
    userId,
    token,
    institution,
    clearUser,
    likedProducts,
    setLikedProducts,
  } = useContext(UserContext);

  // --- Filter Modal States ---
  const [campusMode, setCampusMode] = useState<"In Campus" | "Both">("Both");
  const categories = [
    "#Everything",
    "#FemaleClothing",
    "#MaleClothing",
    "#Tickets",
    "#Other",
  ];
  const [selectedCategory, setSelectedCategory] =
    useState<string>("#Everything");
  const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);

  // --- Description Modal ---
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isDescriptionModalVisible, setIsDescriptionModalVisible] =
    useState(false);
  const [cameFromSearch, setCameFromSearch] = useState(false);

  // --- Requested Products ---
  const [requestedProducts, setRequestedProducts] = useState<
    RequestedProduct[]
  >([]);

  // --- Search Modal States ---
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [selectedProductOwner, setSelectedProductOwner] = useState<User | null>(
    null
  );

  // For suggestion bubble
  const [suggestionCategory, setSuggestionCategory] = useState<string | null>(
    null
  );

  // For description expansion (Read More / Read Less)
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const DESCRIPTION_LIMIT = 150;

  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();

  const campusOptions: Array<{ label: string; value: "In Campus" | "Both" }> = [
    { label: "In and Out of Campus", value: "Both" },
    { label: "In Campus", value: "In Campus" },
  ];

  // --- Products & Cart States ---
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  // Stable ordered list (using shuffle)
  const [orderedProducts, setOrderedProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [cartUpdated, setCartUpdated] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [swipeUpCount, setSwipeUpCount] = useState(0);

  // --- Toast Animations ---
  const [errorMessage, setErrorMessage] = useState("");
  const errorOpacity = useState(new Animated.Value(0))[0];
  const [successMessage, setSuccessMessage] = useState("");
  const successOpacity = useState(new Animated.Value(0))[0];

  const [userInfo, setUserInfo] = useState<User | null>(null);

  // --- Seen Products (Persistent) ---
  const [seenProducts, setSeenProducts] = useState<string[]>([]);
  useEffect(() => {
    if (userId) {
      AsyncStorage.getItem(`seenProducts_${userId}`)
        .then((value) => {
          if (value) {
            try {
              const parsed = JSON.parse(value);
              if (Array.isArray(parsed)) {
                setSeenProducts(parsed);
              } else {
                setSeenProducts([]);
              }
            } catch (e) {
              setSeenProducts([]);
            }
          }
        })
        .catch((err) => console.error("Error loading seen products:", err));
    }
  }, [userId]);

  const markProductAsSeen = (productId: string) => {
    if (!seenProducts.includes(productId)) {
      const updated = [...seenProducts, productId];
      setSeenProducts(updated);
      if (userId) {
        AsyncStorage.setItem(
          `seenProducts_${userId}`,
          JSON.stringify(updated)
        ).catch((err) => console.error("Error saving seen products:", err));
      }
    }
  };

  // --- Visited History (Last 3 Products, Persistent) ---
  // This stores an array of product IDs
  const [visitedHistory, setVisitedHistory] = useState<string[]>([]);
  useEffect(() => {
    if (userId) {
      AsyncStorage.getItem(`visitedHistory_${userId}`)
        .then((value) => {
          if (value) {
            try {
              const parsed = JSON.parse(value);
              if (Array.isArray(parsed)) {
                setVisitedHistory(parsed);
              } else {
                setVisitedHistory([]);
              }
            } catch (e) {
              setVisitedHistory([]);
            }
          }
        })
        .catch((err) => console.error("Error loading visited history:", err));
    }
  }, [userId]);

  useEffect(() => {
    if (userId) {
      AsyncStorage.setItem(
        `visitedHistory_${userId}`,
        JSON.stringify(visitedHistory)
      ).catch((err) => console.error("Error saving visited history:", err));
    }
  }, [visitedHistory, userId]);

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

  // --- Always fetch product owner when showing description ---
  const onShowDescription = async (product: Product) => {
    setSelectedProductOwner(null);
    if (product.userId) {
      await fetchProductOwner(product.userId);
    }
    setSelectedProduct(product);
    setIsDescriptionModalVisible(true);
    setIsDescriptionExpanded(false);
  };

  const toggleFavorite = (productId: string) => {
    if (likedProducts.includes(productId)) {
      unlikeProduct(productId);
    } else {
      likeProduct(productId);
    }
  };

  const fetchProductOwner = async (ownerId: string) => {
    if (!ownerId || !token) {
      console.warn("No ownerId or token found!");
      return;
    }
    try {
      console.log("Fetching product owner for ID:", ownerId);
      const response = await fetch(`${NGROK_URL}/users/${ownerId}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        throw new Error(
          `Failed to fetch owner details. Status: ${response.status}`
        );
      }
      const ownerData: User = await response.json();
      console.log("Fetched Owner Data:", ownerData);
      setSelectedProductOwner(ownerData);
    } catch (error) {
      console.error("Error fetching product owner:", error);
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
                CommonActions.reset({ index: 0, routes: [{ name: "Login" }] })
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
                CommonActions.reset({ index: 0, routes: [{ name: "Login" }] })
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
                CommonActions.reset({ index: 0, routes: [{ name: "Login" }] })
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
    if (cartItems.some((item) => item.productId === product.id)) {
      showSuccess("Added to bag!");
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
                CommonActions.reset({ index: 0, routes: [{ name: "Login" }] })
              );
            },
          },
        ]);
        return;
      }
      if (response.status === 409) {
        showSuccess("Added to bag!");
        return;
      }
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to add item.");
      }
      await fetchCart();
      showSuccess("Added to bag!");
      setCartUpdated(true);
    } catch (err) {
      console.error("Add to Cart Error:", err);
      showError("Could not add.");
    }
  };

  // ----- Recalculate Product Ordering: Unseen Products Only & Create Stable Ordering -----
  useEffect(() => {
    let filtered = allProducts;
    if (selectedCategory !== "#Everything") {
      filtered = filtered.filter((p) =>
        p.selectedTags?.includes(selectedCategory)
      );
    }
    let unseen = filtered.filter((p) => !seenProducts.includes(p.id));
    if (filtered.length > 0 && unseen.length === 0) {
      setSeenProducts([]);
      AsyncStorage.setItem(`seenProducts_${userId}`, JSON.stringify([])).catch(
        (err) => console.error("Error resetting seen products:", err)
      );
      unseen = filtered;
    }
    // Create a stable ordering using shuffle
    const ordered = shuffleArray(unseen);
    setOrderedProducts(ordered);
    setFilteredProducts(ordered);
    const currentProductId = filteredProducts[currentIndex]?.id;
    const newIndex = ordered.findIndex((p) => p.id === currentProductId);
    setCurrentIndex(newIndex >= 0 ? newIndex : 0);
    setCurrentImageIndex(0);
  }, [allProducts, seenProducts, selectedCategory]);

  // ----- Next Product (Swipe Up) -----
  const goToNextProduct = () => {
    if (orderedProducts.length > 0 && currentIndex < orderedProducts.length) {
      const currentProduct = orderedProducts[currentIndex];
      // Add current product ID to visitedHistory (limit 3)
      let newHistory = [...visitedHistory, currentProduct.id];
      if (newHistory.length > 3) {
        newHistory = newHistory.slice(newHistory.length - 3);
      }
      setVisitedHistory(newHistory);
    }
    setIsDescriptionModalVisible(false);
    setSwipeUpCount((prev) => {
      const newCount = prev + 1;
      if (newCount === 3) {
        fetchRequestedProducts();
        return 0;
      }
      return newCount;
    });
    if (currentIndex < orderedProducts.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setCurrentImageIndex(0);
    } else {
      showError("No more products.");
      setCurrentIndex(0);
      setCurrentImageIndex(0);
    }
  };

  // ----- Previous Product (Triggered by Back Button or Swipe Down) -----
  const goToPreviousProduct = () => {
    if (visitedHistory.length > 0) {
      const lastProductId = visitedHistory[visitedHistory.length - 1];
      const newHistory = visitedHistory.slice(0, visitedHistory.length - 1);
      setVisitedHistory(newHistory);
      const newIndex = orderedProducts.findIndex((p) => p.id === lastProductId);
      if (newIndex >= 0) {
        setCurrentIndex(newIndex);
        setCurrentImageIndex(0);
      } else {
        showError("Previous product not found.");
      }
    } else {
      showError("No previous products.");
    }
  };

  // ----- Fetch Products (Campus Mode Filtering) -----
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
                CommonActions.reset({ index: 0, routes: [{ name: "Login" }] })
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
        setError(null);
        return;
      }
      const mappedData: Product[] = data.map((product) => {
        console.log(
          "Fetched product:",
          product.title,
          "in-campus price:",
          product.price,
          "outOfCampusPrice:",
          product.outOfCampusPrice,
          "rentPrice:",
          product.rentPrice,
          "rentDuration:",
          product.rentDuration
        );
        return {
          id: product._id || product.id || `product-${Math.random()}`,
          title: product.title,
          price: product.price,
          outOfCampusPrice: product.outOfCampusPrice,
          description: product.description,
          category: product.category,
          images: product.images,
          university: product.university,
          userId: product.userId,
          postedDate: product.postedDate,
          rating: product.rating,
          quality: product.condition,
          availability: product.availability,
          selectedTags: product.selectedTags || [],
          rentPrice: product.rentPrice,
          rentDuration: product.rentDuration,
        };
      });
      let filteredByCampus = mappedData;
      if (campusMode === "In Campus") {
        filteredByCampus = mappedData.filter(
          (product) =>
            product.userId !== userId &&
            product.university.toLowerCase() === institution.toLowerCase() &&
            product.availability === "In Campus Only"
        );
      }
      setAllProducts(filteredByCampus);
      setError(null);
    } catch (err) {
      console.error("Fetch Products Error:", err);
      setError(err instanceof Error ? err.message : "Error fetching.");
    }
  };

  // ----- Requested Products -----
  const fetchRequestedProducts = async () => {
    if (!token) return;
    try {
      const response = await fetch(`${NGROK_URL}/requests/all`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        console.error("Error fetching requested products");
        return;
      }
      const data: RequestedProduct[] = await response.json();
      if (data && data.length > 0) {
        const shuffled = data.sort(() => 0.5 - Math.random());
        const selected = shuffled.slice(0, 10);
        setRequestedProducts(selected);
      }
    } catch (error) {
      console.error("Error in fetchRequestedProducts:", error);
    }
  };

  useEffect(() => {
    setError(null);
    fetchProducts();
    fetchCart();
    fetchUserInfo();
    setCurrentIndex(0);
    setCurrentImageIndex(0);
    fetchRequestedProducts();
  }, [campusMode]);

  useFocusEffect(
    React.useCallback(() => {
      fetchProducts();
      fetchLikedProducts();
    }, [token])
  );
  useFocusEffect(
    React.useCallback(() => {
      if (cameFromSearch) {
        setIsSearchActive(true);
        setCameFromSearch(false);
      }
    }, [cameFromSearch])
  );

  useEffect(() => {
    fetchProducts();
    fetchCart();
    fetchUserInfo();
    fetchLikedProducts();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      fetchUserInfo();
    }, [token])
  );
  

  // --- Search Handling ---
  useEffect(() => {
    if (searchQuery !== "") {
      setSuggestionCategory(null);
      const results = allProducts.filter((product) =>
        product.title.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setSearchResults(results);
    }
  }, [searchQuery, allProducts]);

  useEffect(() => {
    if (suggestionCategory) {
      const results = allProducts.filter(
        (product) =>
          product.selectedTags?.includes(suggestionCategory) &&
          product.userId !== userId
      );
      setSearchResults(results);
    }
  }, [suggestionCategory, allProducts, userId]);

  const openSearch = () => {
    setIsSearchActive(true);
    setSearchQuery("");
    setSearchResults([]);
    setSuggestionCategory(null);
  };

  const closeSearch = () => {
    setIsSearchActive(false);
    setSearchQuery("");
    setSearchResults([]);
    setSuggestionCategory(null);
  };

  const toggleFilterModal = () =>
    setIsFilterModalVisible(!isFilterModalVisible);

  // ----- ProductItem Component -----
  type ProductItemProps = {
    product: Product;
    nextProduct: Product | null;
    index: number;
    currentIndex: number;
    onAddToCart: (product: Product) => void;
    onToggleFavorite: (id: string) => void;
    onShowDescription: (product: Product) => void;
    onNextProduct: () => void;
    onPreviousProduct: () => void;
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
    onPreviousProduct,
    isFavorite,
    currentImageIndex,
    setCurrentImageIndex,
  }) => {
    const [titleExpanded, setTitleExpanded] = useState(false);
    const doubleTapRef = useRef<any>(null);
    useEffect(() => {
      if (nextProduct && nextProduct.images.length > 0) {
        Image.prefetch(nextProduct.images[0]).catch((err) =>
          console.warn("Image prefetch error:", err)
        );
      }
    }, [nextProduct]);

    const onPanHandlerStateChange = (event: any) => {
      if (event.nativeEvent.state === GestureState.END) {
        const { translationX, translationY } = event.nativeEvent;
        if (Math.abs(translationX) > Math.abs(translationY)) {
          if (translationX < -SWIPE_THRESHOLD) {
            if (currentImageIndex < product.images.length - 1) {
              setCurrentImageIndex(currentImageIndex + 1);
            }
          } else if (translationX > SWIPE_THRESHOLD) {
            if (currentImageIndex > 0) {
              setCurrentImageIndex(currentImageIndex - 1);
            }
          }
        } else {
          if (translationY < -SWIPE_THRESHOLD) {
            onNextProduct();
          } else if (translationY > SWIPE_THRESHOLD) {
            onPreviousProduct();
          }
        }
      }
    };

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
      currentImageIndex < product.images.length - 1
        ? currentImageIndex + 1
        : currentImageIndex;
    const nextImageURI =
      product.images && product.images.length > 0
        ? product.images[nextImageIndex]
        : "https://via.placeholder.com/150";

    const displayPrice =
      institution.toLowerCase() === product.university.toLowerCase()
        ? product.price
        : product.outOfCampusPrice ?? product.price;

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
              <View
                style={{
                  width: SCREEN_WIDTH,
                  height: PRODUCT_HEIGHT,
                  backgroundColor: "#000",
                }}
              >
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
                <View style={styles.midImageIndicatorsContainer}>
                  {product.images.map((_, idx) => (
                    <View
                      key={idx}
                      style={[
                        styles.imageIndicatorDot,
                        idx === currentImageIndex &&
                          styles.imageIndicatorDotActive,
                      ]}
                    />
                  ))}
                </View>
              </View>
            </TapGestureHandler>
          </TapGestureHandler>
        </PanGestureHandler>
        {index === currentIndex && (
          <View style={styles.productInfoBubble}>
            <View style={styles.productInfoTextContainer}>
              <TouchableOpacity
                onPress={() => setTitleExpanded(!titleExpanded)}
              >
                <Text
                  style={styles.productInfoTitle}
                  numberOfLines={titleExpanded ? undefined : 1}
                  ellipsizeMode="tail"
                >
                  {product.title}
                </Text>
              </TouchableOpacity>
              <Text style={styles.productInfoPrice}>
                ${displayPrice.toFixed(2)} /{" "}
                {product.rentPrice && product.rentPrice > 0
                  ? `Renting Price: $${product.rentPrice.toFixed(2)} (${
                      product.rentDuration || "N/A"
                    })`
                  : "Renting Unavailable"}
              </Text>
            </View>
            <View style={styles.productInfoActions}>
              {/* Back button (swipe down or press button) */}
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => onToggleFavorite(product.id)}
                accessibilityLabel="Toggle Favorite"
              >
                <Ionicons
                  name={isFavorite ? "heart" : "heart-outline"}
                  size={25}
                  color={isFavorite ? "#FF3B30" : "#FFFFFF"}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => onShowDescription(product)}
                accessibilityLabel="Show Details"
              >
                <Ionicons name="information-circle" size={25} color="#FFFFFF" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => onAddToCart(product)}
                accessibilityLabel="Add to Cart"
              >
                <Ionicons name="bag" size={25} color="#34C759" />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.rootContainer}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <LinearGradient
          colors={["#000000", "#000000"]}
          style={styles.gradientBackground}
        >
          <View style={styles.topBar}>
            <View style={styles.topBarIconsContainer}>
              <TouchableOpacity
                style={styles.topBarIconContainer}
                onPress={toggleFilterModal}
                accessibilityLabel="Filter"
              >
                <Ionicons name="options-outline" size={22} color="#FFFFFF" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.topBarIconContainer}
                onPress={openSearch}
                accessibilityLabel="Search"
              >
                <Ionicons name="search-outline" size={22} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>

          {requestedProducts.length > 0 && (
            <View style={styles.requestedStoriesContainer}>
              <View style={styles.requestedHeader}>
                <Text style={styles.requestedLabel}>Requested Products</Text>
                <TouchableOpacity
                  style={styles.viewAllButton}
                  onPress={() => navigation.navigate("RequestedProductsPage")}
                  accessibilityLabel="View All Requested Products"
                >
                  <Text style={styles.viewAllText}>View All</Text>
                </TouchableOpacity>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.requestedScrollView}
                contentContainerStyle={styles.requestedScrollContent}
              >
                {requestedProducts.map((req, idx) => (
                  <View key={idx} style={styles.storyItem}>
                    <Text style={styles.storyText}>{req.productName}</Text>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

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
                    onShowDescription={onShowDescription}
                    onNextProduct={goToNextProduct}
                    onPreviousProduct={goToPreviousProduct}
                    isFavorite={likedProducts.includes(product.id)}
                    currentImageIndex={currentImageIndex}
                    setCurrentImageIndex={setCurrentImageIndex}
                  />
                ))}
            </View>
          )}

          {/* Description Modal */}
          <Modal
            visible={isDescriptionModalVisible}
            animationType="fade"
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
                  <RNScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.modalScrollContent}
                  >
                    {/* Product Owner Profile Section */}
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => {
                        console.log(
                          "Profile tapped! Owner ID:",
                          selectedProductOwner?.id
                        );
                        if (selectedProductOwner?.id) {
                          setIsDescriptionModalVisible(false);
                          setTimeout(() => {
                            navigation.navigate("UserProfile", {
                              userId: selectedProductOwner.id,
                            });
                          }, 300);
                        } else {
                          console.warn(
                            "User profile ID is undefined, trying to fetch again..."
                          );
                          if (selectedProduct?.userId) {
                            fetchProductOwner(selectedProduct.userId);
                          }
                        }
                      }}
                      style={styles.profileContainer}
                    >
                      {selectedProductOwner?.profilePicture ? (
                        <Image
                          source={{ uri: selectedProductOwner.profilePicture }}
                          style={styles.profilePicture}
                        />
                      ) : (
                        <Ionicons name="person-circle" size={50} color="#777" />
                      )}
                      <View style={styles.nameContainer}>
                        <Text style={styles.sellerName}>
                          {selectedProductOwner?.firstName}{" "}
                          {selectedProductOwner?.lastName}
                        </Text>
                        <Text style={styles.sellerInstitution}>
                          {selectedProductOwner?.institution}
                        </Text>
                      </View>
                    </TouchableOpacity>
                    {/* Product Title */}
                    <Text style={styles.modalTitle}>
                      {selectedProduct.title}
                    </Text>
                    {/* Product Details Section */}
                    <View style={styles.detailsContainer}>
                      <Text style={styles.detailText}>
                        Condition: {selectedProduct.quality}
                      </Text>
                      {selectedProduct.quality !== "New" &&
                        selectedProduct.rating &&
                        selectedProduct.rating > 0 && (
                          <View style={styles.ratingContainer}>
                            <Text style={styles.detailText}>Rating: </Text>
                            {[...Array(selectedProduct.rating)].map((_, i) => (
                              <Ionicons
                                key={i}
                                name="star"
                                size={16}
                                color="#FFD700"
                              />
                            ))}
                          </View>
                        )}
                      <Text style={styles.detailText}>
                        Price: $
                        {institution.toLowerCase() ===
                        selectedProduct.university.toLowerCase()
                          ? selectedProduct.price.toFixed(2)
                          : (
                              selectedProduct.outOfCampusPrice ??
                              selectedProduct.price
                            ).toFixed(2)}
                      </Text>
                    </View>
                    {/* Description Section with Read More / Read Less */}
                    <Text style={styles.sectionHeader}>Description</Text>
                    {selectedProduct.description &&
                    selectedProduct.description.length > DESCRIPTION_LIMIT &&
                    !isDescriptionExpanded ? (
                      <View>
                        <Text style={styles.descriptionText}>
                          {selectedProduct.description.substring(
                            0,
                            DESCRIPTION_LIMIT
                          )}
                          ...
                        </Text>
                        <TouchableOpacity
                          onPress={() => setIsDescriptionExpanded(true)}
                        >
                          <Text style={styles.readMoreText}>Read More</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View>
                        <Text style={styles.descriptionText}>
                          {selectedProduct.description}
                        </Text>
                        {selectedProduct.description &&
                          selectedProduct.description.length >
                            DESCRIPTION_LIMIT && (
                            <TouchableOpacity
                              onPress={() => setIsDescriptionExpanded(false)}
                            >
                              <Text style={styles.readMoreText}>Read Less</Text>
                            </TouchableOpacity>
                          )}
                      </View>
                    )}
                  </RNScrollView>
                )}
                <TouchableOpacity
                  onPress={() => setIsDescriptionModalVisible(false)}
                  style={styles.modalClose}
                  accessibilityLabel="Close Details Modal"
                >
                  <Ionicons name="close-outline" size={20} color="#FFFFFF" />
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
                        selectedCategory === item &&
                          styles.filterModalOptionSelected,
                      ]}
                      onPress={() => setSelectedCategory(item)}
                      accessibilityLabel={`Filter by ${item}`}
                    >
                      <Ionicons
                        name={
                          selectedCategory === item
                            ? "checkbox-outline"
                            : "ellipse-outline"
                        }
                        size={20}
                        color={
                          selectedCategory === item ? "#BB86FC" : "#FFFFFF"
                        }
                        style={{ marginRight: 10 }}
                      />
                      <Text
                        style={[
                          styles.filterModalOptionText,
                          selectedCategory === item &&
                            styles.filterModalOptionTextSelected,
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
                        campusMode === item.value &&
                          styles.filterModalOptionSelected,
                      ]}
                      onPress={() => setCampusMode(item.value)}
                      accessibilityLabel={`Filter by ${item.label}`}
                    >
                      <Ionicons
                        name={
                          campusMode === item.value
                            ? "checkbox-outline"
                            : "ellipse-outline"
                        }
                        size={20}
                        color={
                          campusMode === item.value ? "#BB86FC" : "#FFFFFF"
                        }
                        style={{ marginRight: 10 }}
                      />
                      <Text
                        style={[
                          styles.filterModalOptionText,
                          campusMode === item.value &&
                            styles.filterModalOptionTextSelected,
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
          {/* Search Modal */}
          <Modal
            visible={isSearchActive}
            animationType="fade"
            transparent={true}
            onRequestClose={closeSearch}
          >
            <BlurView
              intensity={100}
              tint="light"
              style={styles.searchBlurContainer}
            >
              <View style={styles.advancedSearchContainer}>
                <View style={styles.searchHeader}>
                  <View style={styles.advancedSearchBar}>
                    <Ionicons
                      name="search"
                      size={20}
                      color="#888"
                      style={styles.searchIcon}
                    />
                    <TextInput
                      style={styles.advancedSearchInput}
                      placeholder="Search products..."
                      placeholderTextColor="#888"
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                      autoFocus
                    />
                    {searchQuery.length > 0 && (
                      <TouchableOpacity
                        onPress={() => setSearchQuery("")}
                        style={styles.clearButton}
                      >
                        <Ionicons name="close-circle" size={20} color="#888" />
                      </TouchableOpacity>
                    )}
                  </View>
                  <TouchableOpacity
                    onPress={closeSearch}
                    style={styles.closeSearchButton}
                  >
                    <Ionicons name="close" size={24} color="#000" />
                  </TouchableOpacity>
                </View>
                {searchQuery === "" && !suggestionCategory ? (
                  <RNScrollView
                    contentContainerStyle={styles.suggestionsContainer}
                    keyboardShouldPersistTaps="handled"
                  >
                    <View style={styles.staticSuggestions}>
                      <TouchableOpacity
                        style={styles.suggestionBox}
                        onPress={() => setSuggestionCategory("#MaleClothing")}
                      >
                        <Text style={styles.suggestionText}>Male Clothing</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.suggestionBox}
                        onPress={() => setSuggestionCategory("#FemaleClothing")}
                      >
                        <Text style={styles.suggestionText}>
                          Female Clothing
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.suggestionBox}
                        onPress={() => setSuggestionCategory("#Tickets")}
                      >
                        <Text style={styles.suggestionText}>Tickets</Text>
                      </TouchableOpacity>
                    </View>
                  </RNScrollView>
                ) : (
                  <FlatList
                    data={searchResults}
                    keyExtractor={(item) => item.id}
                    numColumns={3}
                    contentContainerStyle={styles.searchResultsContainer}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={styles.searchResultItem}
                        onPress={() => {
                          setCameFromSearch(true);
                          closeSearch();
                          navigation.push("ProductDetail", {
                            productId: item.id,
                          });
                        }}
                      >
                        <Image
                          source={{
                            uri:
                              item.images?.[0] ||
                              "https://via.placeholder.com/150",
                          }}
                          style={styles.searchResultImage}
                        />
                        <View style={styles.searchResultNameContainer}>
                          <Text
                            style={styles.searchResultName}
                            numberOfLines={1}
                          >
                            {item.title}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    )}
                  />
                )}
              </View>
            </BlurView>
          </Modal>
          {successMessage !== "" && (
            <Animated.View
              style={[
                styles.successToastContainer,
                { opacity: successOpacity },
              ]}
            >
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
  rootContainer: { flex: 1, backgroundColor: "#000" },
  gradientBackground: {
    flex: 1,
    backgroundColor: "#000",
    paddingBottom: NAV_BAR_HEIGHT,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "flex-end",
  },
  centerModalOverlay: {
    flex: 1,
    backgroundColor: "transparent",
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
  successToastContainer: {
    position: "absolute",
    top: PRODUCT_HEIGHT / 2 - 230,
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
  topBarIconsContainer: { flexDirection: "row" },
  topBarIconContainer: {
    padding: 6,
    backgroundColor: "transparent",
    borderRadius: 8,
    marginRight: 10,
  },
  productStack: { flex: 1, justifyContent: "center", alignItems: "center" },
  stackedProduct: {
    position: "absolute",
    width: SCREEN_WIDTH,
    height: PRODUCT_HEIGHT,
    backgroundColor: "transparent",
    overflow: "hidden",
    zIndex: 1,
  },
  topProduct: { zIndex: 2, transform: [{ scale: 1 }] },
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
  productInfoTextContainer: { flex: 1, marginRight: 10 },
  fixedSearchBar: {
    position: "absolute",
    top: 80,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
    zIndex: 10,
  },
  profileContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 15,
  },
  profilePicture: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: "#555",
  },
  nameContainer: { marginLeft: 12 },
  sellerName: { fontSize: 18, fontWeight: "bold", color: "#FFFFFF" },
  sellerInstitution: { fontSize: 14, color: "#AAAAAA" },
  advancedSearchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 30,
    paddingHorizontal: 15,
    paddingVertical: 8,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
    flex: 1,
  },
  searchHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 40,
  },
  searchIcon: { marginRight: 10 },
  advancedSearchInput: { flex: 1, height: 40, color: "#333", fontSize: 16 },
  clearButton: { marginLeft: 10 },
  closeSearchButton: {
    marginLeft: 10,
    padding: 6,
    backgroundColor: "#fff",
    borderRadius: 20,
  },
  fixedSearchInput: {
    flex: 1,
    height: 40,
    borderColor: "#ccc",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    color: "#000",
    backgroundColor: "#fff",
  },
  fixedCloseButton: { marginLeft: 10 },
  fullWidthResultsContainer: { marginTop: 20, paddingHorizontal: 20 },
  fullWidthResultItem: {
    backgroundColor: "transparent",
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    width: "100%",
  },
  fullWidthResultTitle: { color: "#333", fontSize: 18, fontWeight: "600" },
  fullWidthResultPrice: { color: "#777", fontSize: 16, marginTop: 5 },
  noSearchResultsText: {
    color: "#333",
    textAlign: "center",
    marginTop: 20,
    fontSize: 16,
  },
  productInfoTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 2,
  },
  productInfoPrice: { color: "#A1A1A1", fontSize: 16, fontWeight: "600" },
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
  ratingContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
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
    top: PRODUCT_HEIGHT / 2 - 270,
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
  imageIndicatorDotActive: { backgroundColor: "#FFFFFF" },
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
  retryButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "500" },
  noProductsContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  noProductsText: { color: "#FFFFFF", fontSize: 18 },
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
  modalTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 10,
    textAlign: "left",
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
  filterModalOptionSelected: { backgroundColor: "#BB86FC20", borderRadius: 10 },
  modalContentContainer: { alignItems: "flex-start", width: "100%" },
  filterModalOptionText: { fontSize: 14, color: "#FFFFFF" },
  filterModalOptionTextSelected: { color: "#BB86FC", fontWeight: "600" },
  applyButton: {
    backgroundColor: "#BB86FC",
    paddingVertical: 12,
    borderRadius: 25,
    marginTop: 15,
    alignItems: "center",
  },
  titleContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  newBadgeContainer: {
    backgroundColor: "#34C759",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 26,
    marginTop: -18,
  },
  newBadgeText: { color: "#FFFFFF", fontSize: 14, fontWeight: "bold" },
  applyButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "600" },
  modalClose: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 15,
    padding: 5,
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
  descriptionModalContent: {
    width: "90%",
    maxHeight: "80%",
    backgroundColor: "#1C1C1E",
    borderRadius: 15,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
    position: "relative",
  },
  detailsContainer: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#BB86FC",
    marginBottom: 12,
  },
  modalScrollContent: { paddingRight: 10 },
  sectionHeader: {
    fontSize: 18,
    fontWeight: "600",
    color: "#F2F2F7",
    marginTop: 15,
    marginBottom: 5,
  },
  detailText: { fontSize: 16, color: "#E5E5EA", marginBottom: 6 },
  descriptionText: { fontSize: 14, color: "#D1D1D6", lineHeight: 20 },
  readMoreText: { color: "#FF3B30", fontSize: 14, marginTop: 5 },
  requestedStoriesContainer: {
    position: "absolute",
    top: PRODUCT_HEIGHT / 2 - 280,
    left: 0,
    right: 0,
    paddingHorizontal: 10,
    zIndex: 11,
  },
  requestedHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  requestedLabel: { color: "#FFFFFF", fontSize: 10, fontWeight: "bold" },
  viewAllButton: { padding: 4 },
  viewAllText: { color: "#FFFFFF", fontSize: 10, fontWeight: "bold" },
  storyItem: {
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    marginRight: 8,
  },
  storyText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "bold",
    textAlign: "center",
  },
  requestedScrollContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  requestedScrollView: { height: 40 },
  searchBlurContainer: { flex: 1 },
  advancedSearchContainer: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.97)",
    paddingTop: 20,
  },
  suggestionsContainer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    marginTop: 30,
  },
  staticSuggestions: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: -20,
  },
  suggestionBox: {
    backgroundColor: "#F0F0F0",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 18,
    minWidth: (SCREEN_WIDTH - 80) / 7,
    alignItems: "center",
  },
  suggestionText: { color: "#555", fontWeight: "500", fontSize: 12 },
  searchResultsContainer: { paddingHorizontal: 10, paddingTop: 10 },
  searchResultItem: {
    width: SCREEN_WIDTH / 2 - 15,
    margin: 5,
    aspectRatio: 1,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#eee",
  },
  searchResultImage: { width: "100%", height: "100%", resizeMode: "cover" },
  searchResultNameContainer: {
    position: "absolute",
    top: 5,
    right: 5,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  searchResultName: { color: "#fff", fontSize: 12, fontWeight: "600" },
  noResultsText: {
    color: "#333",
    textAlign: "center",
    marginTop: 20,
    fontSize: 16,
  },
});
