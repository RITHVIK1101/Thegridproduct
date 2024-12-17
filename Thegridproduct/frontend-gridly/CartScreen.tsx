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
  Modal,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { UserContext } from "./UserContext";
import { CommonActions, useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "./navigationTypes";
import { NGROK_URL } from "@env";
import { LinearGradient } from "expo-linear-gradient";

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
  userId: string; // Represents the seller's user ID
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
  sellerId: string; // Renamed from ownerId to sellerId
  postedDate?: string;
  rating?: number;
  quality?: string;
};

const { width } = Dimensions.get("window");

const CartScreen: React.FC = () => {
  const [cartProducts, setCartProducts] = useState<CartProduct[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const fadeAnim = useState(new Animated.Value(0))[0];
  
  // State for delete confirmation
  const [itemToDelete, setItemToDelete] = useState<CartProduct | null>(null);
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState<boolean>(false);

  const { userId, token, clearUser } = useContext(UserContext);
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();

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
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to fetch cart.");
      }

      const cartData: Cart = await response.json();

      if (cartData.items.length === 0) {
        setCartProducts([]);
        setLoading(false);
        return;
      }

      const productIds = cartData.items.map((item) => item.productId);

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
            sellerId: product.userId, // Mapped from product.userId
            postedDate: product.postedDate,
            rating: product.rating,
            quality: product.quality,
          };
        } else {
          return {
            id: item.productId,
            title: "Unknown Product",
            price: 0,
            images: [],
            quantity: item.quantity,
            sellerId: "unknown-seller", // Handle missing sellerId
            postedDate: "",
            rating: 0,
            quality: "",
          };
        }
      });

      // Filter out products with unknown sellerId if necessary
      const validCartProducts = combinedCartProducts.filter(
        (product) => product.sellerId !== "unknown-seller"
      );

      setCartProducts(validCartProducts);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start();
    } catch (err) {
      console.error("Fetch Cart Error:", err);
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  // Function to initiate delete confirmation
  const confirmRemoveFromCart = (product: CartProduct) => {
    setItemToDelete(product);
    setIsDeleteModalVisible(true);
  };

  // Function to handle actual deletion after confirmation
  const handleDelete = async () => {
    if (!itemToDelete) return;

    try {
      const response = await fetch(`${NGROK_URL}/cart/remove`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ productId: itemToDelete.id }),
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
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to remove item.");
      }

      setCartProducts((prevItems) =>
        prevItems.filter((item) => item.id !== itemToDelete.id)
      );
      // Removed the Alert after deletion for a smoother UX
    } catch (err) {
      console.error("Remove from Cart Error:", err);
      Alert.alert(
        "Error",
        "An unexpected error occurred while removing the item."
      );
    } finally {
      setIsDeleteModalVisible(false);
      setItemToDelete(null);
    }
  };

  const buyProduct = (product: CartProduct) => {
    if (!userId) {
      Alert.alert("Error", "User not authenticated.");
      return;
    }
    if (!product.sellerId || product.sellerId === "unknown-seller") {
      Alert.alert("Error", "Seller information is missing.");
      return;
    }

    // Directly navigate to Payment without confirmation
    navigation.navigate("Payment", {
      product,
      buyerId: userId,
      sellerId: product.sellerId,
    });
  };

  const proceedToCheckout = () => {
    if (cartProducts.length === 0) {
      Alert.alert("Empty Cart", "Your cart is empty.");
      return;
    }
    navigation.navigate("Checkout", { cartProducts });
  };

  useEffect(() => {
    fetchCart();
  }, []);

  const calculateTotal = () => {
    return cartProducts.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );
  };

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
        <Text style={styles.cartTitle}>
          {item.title}
        </Text>
        <Text style={styles.cartPrice}>${item.price.toFixed(2)}</Text>
      </View>
      <View style={styles.actionButtons}>
        <LinearGradient
          colors={["rgb(168, 237, 234)", "rgb(254, 214, 227)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.buyButtonGradient}
        >
          <TouchableOpacity
            onPress={() => buyProduct(item)}
            style={styles.buyButton}
            accessibilityLabel={`Buy ${item.title}`}
          >
            <Ionicons name="cart-outline" size={16} color="black" />
            <Text style={styles.buyButtonText}>Buy</Text>
          </TouchableOpacity>
        </LinearGradient>
        <TouchableOpacity
          onPress={() => confirmRemoveFromCart(item)}
          style={styles.removeButton}
          accessibilityLabel={`Remove ${item.title} from Cart`}
        >
          <Ionicons name="trash-outline" size={22} color="#FF3B30" />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );

  return (
    <View style={styles.container}>
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#BB86FC" />
          <Text style={styles.loadingText}>Loading your cart...</Text>
        </View>
      ) : error ? (
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
      ) : cartProducts.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="cart-outline" size={100} color="#bbb" />
          <Text style={styles.emptyText}>Your cart is empty.</Text>
        </View>
      ) : (
        <>
          <FlatList
            data={cartProducts}
            keyExtractor={(item) => item.id}
            renderItem={renderCartItem}
            ItemSeparatorComponent={renderSeparator}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
          />
          <View style={styles.footer}>
            <View style={styles.totalContainer}>
              <Text style={styles.totalText}>Total</Text>
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
        </>
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        transparent={true}
        animationType="fade"
        visible={isDeleteModalVisible}
        onRequestClose={() => {
          setIsDeleteModalVisible(false);
          setItemToDelete(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Ionicons name="trash-outline" size={40} color="#FF3B30" />
            <Text style={styles.modalTitle}>Remove Item</Text>
            <Text style={styles.modalMessage}>
              Remove "{itemToDelete?.title}" from your cart?
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalButtonYes}
                onPress={handleDelete}
                accessibilityLabel="Confirm Delete"
              >
                <Text style={styles.modalButtonText}>Yes</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalButtonNo}
                onPress={() => {
                  setIsDeleteModalVisible(false);
                  setItemToDelete(null);
                }}
                accessibilityLabel="Cancel Delete"
              >
                <Text style={styles.modalButtonText}>No</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default CartScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "black",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 40,
  },
  cartItem: {
    flexDirection: "row",
    alignItems: "flex-start", // Changed from 'center' to 'flex-start'
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 16,
  },
  cartImage: {
    width: width * 0.18, // Reduced from 0.2 to 0.18
    height: width * 0.18,
    borderRadius: 12,
    marginRight: 15,
    backgroundColor: "#2C2C2C",
  },
  cartDetails: {
    flex: 1,
    justifyContent: "flex-start",
    paddingRight: 10, // Added padding to prevent text from overlapping buttons
  },
  cartTitle: {
    color: "#fff",
    fontSize: 14, // Reduced font size
    fontWeight: "700",
    marginBottom: 4,
    flexWrap: "wrap",
  },
  cartPrice: {
    color: "#BB86FC",
    fontSize: 14,
    fontWeight: "600",
  },
  actionButtons: {
    flexDirection: "row",
    alignItems: "flex-start", // Changed from 'center' to 'flex-start'
  },
  buyButtonGradient: {
    borderRadius: 8,
    marginRight: 10,
    shadowColor: "#888",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 3,
    elevation: 5,
  },
  buyButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6, // Reduced padding
    paddingHorizontal: 10, // Reduced padding
  },
  buyButtonText: {
    color: "black",
    fontSize: 12, // Reduced font size
    fontWeight: "700",
    marginLeft: 4,
  },
  removeButton: {
    padding: 6,
  },
  separator: {
    height: 1,
    backgroundColor: "#2C2C2C",
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
    paddingBottom: 150,
  },
  footer: {
    position: "absolute",
    bottom: 20,
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
  // Styles for Delete Confirmation Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    width: width * 0.7,
    backgroundColor: "#1E1E1E",
    borderRadius: 15,
    padding: 15,
    alignItems: "center",
  },
  modalTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
    marginTop: 10,
    marginBottom: 5,
  },
  modalMessage: {
    color: "#bbb",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 15,
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
  },
  modalButtonYes: {
    flex: 1,
    backgroundColor: "#BB86FC",
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 5,
    alignItems: "center",
  },
  modalButtonNo: {
    flex: 1,
    backgroundColor: "#FF3B30",
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 5,
    alignItems: "center",
  },
  modalButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
});
