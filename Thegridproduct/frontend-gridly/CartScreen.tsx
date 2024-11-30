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
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { UserContext } from "./UserContext";
import { CommonActions } from "@react-navigation/native";
import { NGROK_URL } from "@env";
import { StackNavigationProp } from "@react-navigation/stack";
import { useNavigation } from "@react-navigation/native";
import { RootStackParamList } from "./navigationTypes";

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

const CartScreen: React.FC = () => {
  const [cartProducts, setCartProducts] = useState<CartProduct[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

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

  // Navigate to Checkout (Optional)
  const proceedToCheckout = () => {
    Alert.alert("Checkout", "Proceeding to checkout...", [
      {
        text: "OK",
        onPress: () => {
          // Implement navigation to Checkout screen if available
          // navigation.navigate("Checkout");
          Alert.alert("Info", "Checkout screen not implemented yet.");
        },
      },
    ]);
  };

  useEffect(() => {
    fetchCart();
    // Optionally, add a focus listener to refresh cart when screen is focused
    // const unsubscribe = navigation.addListener('focus', fetchCart);
    // return unsubscribe;
  }, []);

  const renderCartItem = ({ item }: { item: CartProduct }) => (
    <View style={styles.cartItem}>
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
        <Text style={styles.cartTitle}>{item.title}</Text>
        <Text style={styles.cartPrice}>${item.price.toFixed(2)}</Text>
        <Text style={styles.cartQuantity}>Quantity: {item.quantity}</Text>
        {item.description && (
          <Text style={styles.cartDescription} numberOfLines={2}>
            {item.description}
          </Text>
        )}
      </View>
      <TouchableOpacity
        onPress={() => removeFromCart(item.id)}
        style={styles.removeButton}
        accessibilityLabel="Remove from Cart"
      >
        <Ionicons name="trash-outline" size={24} color="#FF3B30" />
      </TouchableOpacity>
      {/* Buy Button */}
      <TouchableOpacity
        onPress={() => navigation.navigate("Payment", { product: item })}
        style={styles.buyButton}
        accessibilityLabel="Buy Now"
      >
        <Text style={styles.buyButtonText}>Buy</Text>
      </TouchableOpacity>
    </View>
  );

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
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
      />
      {/* Checkout Button */}
      <TouchableOpacity
        style={styles.checkoutButton}
        onPress={proceedToCheckout}
        accessibilityLabel="Proceed to Checkout"
      >
        <Text style={styles.checkoutButtonText}>Proceed to Checkout</Text>
      </TouchableOpacity>
    </View>
  );
};

export default CartScreen;

// Stylesheet
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
    padding: 20,
    paddingBottom: 80, // Space for Checkout Button
  },
  cartItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1E1E1E",
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
  },
  cartImage: {
    width: 60,
    height: 60,
    borderRadius: 10,
    marginRight: 15,
  },
  cartDetails: {
    flex: 1,
  },
  cartTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 5,
  },
  cartPrice: {
    color: "#BB86FC",
    fontSize: 14,
    fontWeight: "500",
  },
  cartQuantity: {
    color: "#fff",
    fontSize: 14,
    marginTop: 2,
  },
  cartDescription: {
    color: "#ccc",
    fontSize: 12,
    marginTop: 2,
  },
  removeButton: {
    padding: 5,
  },
  buyButton: {
    backgroundColor: "#34C759", // Green button
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginLeft: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  buyButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#121212",
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
    color: "#FF6B6B",
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
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    color: "#bbb",
    fontSize: 18,
    marginTop: 20,
  },
  listContainer: {
    paddingBottom: 20,
  },
  checkoutButton: {
    position: "absolute",
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: "#BB86FC",
    paddingVertical: 15,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  checkoutButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
