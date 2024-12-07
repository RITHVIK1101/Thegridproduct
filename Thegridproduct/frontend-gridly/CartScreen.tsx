// CartScreen.tsx

import React, { useEffect, useState, useContext } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Dimensions,
  Animated,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { UserContext } from "./UserContext";
import { CommonActions, useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "./navigationTypes";
import { NGROK_URL } from "@env";

// Define Types
type CartItem = {
  productId: string;
  quantity: number;
};

type Cart = {
  userId: string;
  items: CartItem[];
  createdAt: string;
  updatedAt: string;
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

type CartProduct = {
  id: string;
  title: string;
  price: number;
  images: string[];
  quantity: number;
  description?: string;
  category?: string;
  university?: string;
  ownerId?: string;
  postedDate?: string;
  rating?: number;
  quality?: string;
};

const { width } = Dimensions.get("window");

const CartScreen: React.FC = () => {
  const [cartProducts, setCartProducts] = useState<CartProduct[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const fadeAnim = useState(new Animated.Value(0))[0]; // For fade-in animation

  const { userId, token, clearUser } = useContext(UserContext);
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();

  // Fetch cart items from backend
  const fetchCart = async () => {
    if (!userId || !token) {
      setError("User not logged in.");
      setLoading(false);
      return;
    }

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
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to fetch cart.");
      }

      const cartData: Cart = await response.json();

      if (cartData.items.length === 0) {
        setCartProducts([]);
        setLoading(false);
        return;
      }

      // Extract product IDs
      const productIds = cartData.items.map((item) => item.productId);

      // Fetch product details using the new /products/by-ids endpoint
      const productsResponse = await fetch(
        `${NGROK_URL}/products/by-ids?ids=${productIds.join(",")}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!productsResponse.ok) {
        const errorData = await productsResponse.json();
        throw new Error(errorData.message || "Failed to fetch products.");
      }

      const productsData: Product[] = await productsResponse.json();

      // Map products with quantities
      const combinedCartProducts: CartProduct[] = cartData.items.map((item) => {
        const product = productsData.find((prod) => prod.id === item.productId);
        if (product) {
          return {
            id: product.id,
            title: product.title,
            price: product.price,
            images: product.images,
            quantity: item.quantity,
            description: product.description,
            category: product.category,
            university: product.university,
            ownerId: product.ownerId,
            postedDate: product.postedDate,
            rating: product.rating,
            quality: product.quality,
          };
        } else {
          // If product not found, handle accordingly
          return {
            id: item.productId,
            title: "Unknown Product",
            price: 0,
            images: [],
            quantity: item.quantity,
          };
        }
      });

      setCartProducts(combinedCartProducts);
      // Start fade-in animation
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start();
    } catch (err) {
      console.error("Fetch Cart Error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred while fetching the cart."
      );
    } finally {
      setLoading(false);
    }
  };

  // Remove product from cart
  const removeFromCart = async (productId: string) => {
    try {
      const response = await fetch(`${NGROK_URL}/cart/remove`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ productId }),
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
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to remove item.");
      }

      // Update cart items locally
      setCartProducts((prevItems) =>
        prevItems.filter((item) => item.id !== productId)
      );
      Alert.alert("Removed", "Product removed from your cart.");
    } catch (err) {
      console.error("Remove from Cart Error:", err);
      Alert.alert(
        "Error",
        "An unexpected error occurred while removing the item."
      );
    }
  };

  // Buy individual product
  const buyProduct = (product: CartProduct) => {
    Alert.alert("Buy Product", `Proceeding to buy "${product.title}"`, [
      {
        text: "OK",
        onPress: () => {
          navigation.navigate("Payment", { product });
        },
      },
    ]);
  };

  // Navigate to Checkout
  const proceedToCheckout = () => {
    if (cartProducts.length === 0) {
      Alert.alert("Empty Cart", "Your cart is empty.");
      return;
    }
    navigation.navigate("Checkout", { cartItems: cartProducts });
  };

  useEffect(() => {
    fetchCart();
    // Optionally, add a focus listener to refresh cart when screen is focused
    // const unsubscribe = navigation.addListener('focus', fetchCart);
    // return unsubscribe;
  }, []);

  // Separator Component
  const renderSeparator = () => <View style={styles.separator} />;

  const renderCartItem = ({ item }: { item: CartProduct }) => (
    <Animated.View style={[styles.cartItem, { opacity: fadeAnim }]}>
      <Image
        source={{
          uri:
            item.images && item.images.length > 0
              ? item.images[0]
              : "https://via.placeholder.com/150",
        }}
        style={styles.cartImage}
        resizeMode="cover"
      />
      <View style={styles.cartDetails}>
        <Text style={styles.cartTitle} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={styles.cartPrice}>${item.price.toFixed(2)}</Text>
      </View>
      <View style={styles.actionButtons}>
        <TouchableOpacity
          onPress={() => buyProduct(item)}
          style={styles.buyButton}
          accessibilityLabel={`Buy ${item.title}`}
        >
          <Ionicons name="cart-outline" size={18} color="#fff" />
          <Text style={styles.buyButtonText}>Buy</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => removeFromCart(item.id)}
          style={styles.removeButton}
          accessibilityLabel={`Remove ${item.title} from Cart`}
        >
          <Ionicons name="trash-outline" size={22} color="#FF3B30" />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );

  const calculateTotal = () => {
    return cartProducts.reduce((sum, item) => sum + item.price * item.quantity, 0);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#BB86FC" />
        <Text style={styles.loadingText}>Loading Cart...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={60} color="#FF3B30" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => {
            setLoading(true);
            setError(null);
            fetchCart();
          }}
          accessibilityLabel="Retry Fetching Cart"
        >
          <Ionicons name="refresh-outline" size={20} color="#fff" />
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (cartProducts.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="cart-outline" size={100} color="#bbb" />
        <Text style={styles.emptyText}>Your cart is empty.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={cartProducts}
        keyExtractor={(item) => item.id}
        renderItem={renderCartItem}
        ItemSeparatorComponent={renderSeparator}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
      />
      {/* Total and Checkout Section */}
      <View style={styles.footer}>
        <View style={styles.totalContainer}>
          <Text style={styles.totalText}>Total:</Text>
          <Text style={styles.totalAmount}>${calculateTotal().toFixed(2)}</Text>
        </View>
        <TouchableOpacity
          style={styles.checkoutButton}
          onPress={proceedToCheckout}
          accessibilityLabel="Proceed to Checkout"
        >
          <Text style={styles.checkoutButtonText}>Checkout</Text>
          <Ionicons name="arrow-forward" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default CartScreen;

// Stylesheet
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 40, // Increased to raise the footer a bit
  },
  cartItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12, // Increased padding for larger listing
    paddingHorizontal: 15,
    borderRadius: 16,
    // Removed backgroundColor to eliminate grey container
    // Added padding for better spacing
  },
  cartImage: {
    width: width * 0.2, // Increased image size
    height: width * 0.2,
    borderRadius: 12,
    marginRight: 15,
    backgroundColor: "#2C2C2C",
  },
  cartDetails: {
    flex: 1,
    justifyContent: "center",
  },
  cartTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
  },
  cartPrice: {
    color: "#BB86FC",
    fontSize: 14,
    fontWeight: "600",
  },
  actionButtons: {
    flexDirection: "row",
    alignItems: "center",
  },
  buyButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#34C759", // Green button
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    justifyContent: "center",
    marginRight: 10,
    shadowColor: "#34C759",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  buyButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 4,
  },
  removeButton: {
    padding: 6,
  },
  separator: {
    height: 1,
    backgroundColor: "#fff", // White line for separation
    marginVertical: 5,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#121212",
  },
  loadingText: {
    marginTop: 10,
    color: "#bbb",
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
    backgroundColor: "#121212",
  },
  errorText: {
    color: "#FF3B30",
    fontSize: 16,
    textAlign: "center",
    marginTop: 15,
  },
  retryButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#BB86FC",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 25,
    marginTop: 20,
  },
  retryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#121212",
  },
  emptyText: {
    color: "#bbb",
    fontSize: 22,
    marginTop: 20,
    fontWeight: "500",
  },
  listContainer: {
    paddingBottom: 150, // Increased padding to accommodate footer
  },
  footer: {
    position: "absolute",
    bottom: 20, // Raised the footer slightly
    left: 20,
    right: 20,
    backgroundColor: "#1E1E1E",
    paddingVertical: 18,
    paddingHorizontal: 25,
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#BB86FC",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.7,
    shadowRadius: 6,
    elevation: 15,
  },
  totalContainer: {
    flexDirection: "column",
  },
  totalText: {
    color: "#bbb",
    fontSize: 16,
    fontWeight: "500",
  },
  totalAmount: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
    marginTop: 4,
  },
  checkoutButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#BB86FC",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 30,
    shadowColor: "#BB86FC",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 15,
  },
  checkoutButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    marginRight: 6,
  },
});
