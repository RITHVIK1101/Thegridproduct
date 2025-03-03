// CartScreen.js

import React, { useEffect, useState, useContext } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  Alert,
  Dimensions,
  Modal,
  TouchableWithoutFeedback,
  ActivityIndicator,
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
  items: CartItem[] | null;
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
  userId: string;
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
  sellerId: string;
  postedDate?: string;
  rating?: number;
  quality?: string;
};

const { width } = Dimensions.get("window");

// Initialize cartProducts as an empty array to avoid undefined
const CartScreen: React.FC = () => {
  const [cartProducts, setCartProducts] = useState<CartProduct[]>([]);
  const [error, setError] = useState<string | null>(null);

  // State for delete confirmation
  const [itemToDelete, setItemToDelete] = useState<CartProduct | null>(null);
  const [isTransitioning, setIsTransitioning] = useState<boolean>(false);

  const [isDeleteModalVisible, setIsDeleteModalVisible] =
    useState<boolean>(false);

  // State for message popup
  const [messagePopupVisible, setMessagePopupVisible] =
    useState<boolean>(false);

  // State for loading indicators
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isMessaging, setIsMessaging] = useState<boolean>(false);

  const { userId, token, clearUser } = useContext(UserContext);
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();

  const fetchCart = async () => {
    if (!userId || !token) {
      setError("User not logged in.");
      setCartProducts([]); // Ensure cartProducts is an empty array
      return;
    }

    setIsLoading(true);
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
        setCartProducts([]);
        return;
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to fetch cart.");
      }

      const cartData: Cart = await response.json();

      if (
        !cartData ||
        !Array.isArray(cartData.items) ||
        cartData.items.length === 0
      ) {
        setCartProducts([]); // Set to empty array if no items
        return;
      }

      // Gather product IDs
      const productIds = cartData.items
        .map((item) => item.productId)
        .filter(Boolean);
      if (productIds.length === 0) {
        setCartProducts([]);
        return;
      }

      // Fetch product details
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

      let productsData: Product[] = [];
      try {
        productsData = await productsResponse.json();
        if (!Array.isArray(productsData)) {
          if (productsData && Array.isArray((productsData as any).products)) {
            productsData = (productsData as any).products;
          } else {
            console.warn("Unexpected products format:", productsData);
            setCartProducts([]);
            return;
          }
        }
      } catch (parseErr) {
        console.error("Error parsing products data:", parseErr);
        setError("Could not parse products data.");
        setCartProducts([]);
        return;
      }

      // Merge cart items with product details
      const combinedCartProducts: CartProduct[] = cartData.items.map((item) => {
        if (!item || !item.productId) {
          return {
            id: "unknown-product",
            title: "Unknown Product",
            price: 0,
            images: [],
            quantity: item?.quantity || 1,
            sellerId: "unknown-seller",
            postedDate: "",
            rating: 0,
            quality: "",
          };
        }

        const product = productsData.find((p) => p.id === item.productId);
        if (!product) {
          return {
            id: item.productId,
            title: "Unknown Product",
            price: 0,
            images: [],
            quantity: item.quantity,
            sellerId: "unknown-seller",
            postedDate: "",
            rating: 0,
            quality: "",
          };
        }

        return {
          id: product.id,
          title: product.title,
          price: product.price,
          images: product.images,
          quantity: item.quantity,
          description: product.description,
          category: product.category,
          university: product.university,
          sellerId: product.userId,
          postedDate: product.postedDate,
          rating: product.rating,
          quality: product.quality,
        };
      });

      // Remove items with unknown sellers
      const validCartProducts = combinedCartProducts.filter(
        (cp) => cp.sellerId !== "unknown-seller"
      );

      setCartProducts(validCartProducts);
    } catch (err: any) {
      console.error("Fetch Cart Error:", err);
      setError(err.message || "An unexpected error occurred.");
      setCartProducts([]); // Set to empty array on error
    } finally {
      setIsLoading(false);
    }
  };

  // Confirm removal (trigger modal)
  const confirmRemoveFromCart = (product: CartProduct) => {
    setItemToDelete(product);
    setIsDeleteModalVisible(true);
  };

  // Actually remove item
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

      // Remove locally
      setCartProducts((prev) => prev.filter((p) => p.id !== itemToDelete.id));
    } catch (err: any) {
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

  const messageProduct = async (product: CartProduct) => {
    if (!userId) {
      Alert.alert("Error", "User not authenticated.");
      return;
    }
    if (!product.sellerId || product.sellerId === "unknown-seller") {
      Alert.alert("Error", "Seller information is missing.");
      return;
    }

    setIsMessaging(true);
    setIsTransitioning(true); // Set transitioning state

    const payload = {
      referenceId: product.id,
      referenceType: "product",
      buyerId: userId,
      sellerId: product.sellerId,
    };

    try {
      const response = await fetch(`${NGROK_URL}/chat/request`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok) {
        // Show popup first
        setMessagePopupVisible(true);

        // Remove product after a short delay
        setTimeout(() => {
          setCartProducts((prev) => prev.filter((p) => p.id !== product.id));
        }, 100);

        // Hide popup after showing for 2 seconds
        setTimeout(() => {
          setMessagePopupVisible(false);
          setIsTransitioning(false); // Reset transitioning state
        }, 2000);
      } else {
        throw new Error(data.message || "Failed to send chat request.");
      }
    } catch (error: any) {
      console.error("🚨 Error sending chat request:", error);
      Alert.alert("Error", error.message || "Failed to send request.");
      setIsTransitioning(false); // Reset transitioning state on error
    } finally {
      setIsMessaging(false);
    }
  };

  // Handle Message All
  const messageAllProducts = async () => {
    if (!userId) {
      Alert.alert("Error", "User not authenticated.");
      return;
    }
    if (cartProducts.length === 0) {
      Alert.alert("Error", "No products to message.");
      return;
    }

    setIsMessaging(true);
    try {
      // Prepare chat requests with buyerId and sellerId
      const chatRequests = cartProducts.map((product) =>
        fetch(`${NGROK_URL}/chat/request`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            productId: product.id, // Send only productId
            buyerId: userId, // Included buyerId
            sellerId: product.sellerId, // Included sellerId
          }),
        })
      );

      const responses = await Promise.all(chatRequests);

      const failedRequests: string[] = []; // Explicitly define as string[]
      const successfullyMessagedProducts: string[] = [];

      for (let i = 0; i < responses.length; i++) {
        if (!responses[i].ok) {
          let errorMessage = "Failed to send chat request.";
          try {
            const errorData = await responses[i].json();
            errorMessage = errorData.message || errorMessage;
            console.error(
              `Chat Request Error Data for "${cartProducts[i].title}":`,
              errorData
            );
          } catch (parseError) {
            console.error(
              "Error parsing chat request error response:",
              parseError
            );
          }
          failedRequests.push(
            `Failed to message "${cartProducts[i].title}": ${errorMessage}`
          );
        } else {
          const product = cartProducts[i];
          successfullyMessagedProducts.push(product.id);
        }
      }

      if (failedRequests.length > 0) {
        Alert.alert("Partial Success", failedRequests.join("\n"));
      }

      if (successfullyMessagedProducts.length > 0) {
        // Remove successfully messaged products from the local cart state
        setCartProducts(
          (prev) =>
            prev.filter((p) => !successfullyMessagedProducts.includes(p.id)) ||
            []
        );

        // Show quick confirmation popup
        setMessagePopupVisible(true);
        setTimeout(() => {
          setMessagePopupVisible(false);
        }, 2000);
      }
    } catch (err: any) {
      console.error("Chat Request Error:", err);
      Alert.alert("Error", err.message || "Failed to send chat requests.");
    } finally {
      setIsMessaging(false);
    }
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
      </View>
      <View style={styles.actionButtons}>
        <LinearGradient
          colors={["rgb(168, 237, 234)", "rgb(254, 214, 227)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.messageButtonGradient}
        >
          <TouchableOpacity
            onPress={() => messageProduct(item)}
            style={styles.messageButton}
            accessibilityLabel={`Message about ${item.title}`}
            disabled={isMessaging} // Disable while sending request
          >
            {isMessaging ? (
              <ActivityIndicator size="small" color="black" />
            ) : (
              <>
                <Ionicons
                  name="chatbubble-ellipses-outline"
                  size={16}
                  color="black"
                />
                <Text style={styles.messageButtonText}>Message</Text>
              </>
            )}
          </TouchableOpacity>
        </LinearGradient>

        <TouchableOpacity
          onPress={() => confirmRemoveFromCart(item)}
          style={styles.removeButton}
          accessibilityLabel={`Remove ${item.title} from Cart`}
          disabled={isMessaging} // Optionally disable during messaging
        >
          <Ionicons name="trash-outline" size={22} color="#FF3B30" />
        </TouchableOpacity>
      </View>
    </View>
  );

  /**
   * RENDER
   * - If `isLoading`, show loading indicator.
   * - If `error`, show error UI.
   * - If `cartProducts` is an empty array, show empty cart.
   * - Else, show cart items.
   */
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="refresh-circle-outline" size={50} color="#BB86FC" />
        <Text style={styles.loadingText}>Loading your cart...</Text>
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
            setError(null);
            setCartProducts([]);
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

  // Otherwise, we have cart items
  return (
    <View style={styles.container}>
      {/* Show cart content or empty state */}
      {cartProducts.length > 0 ? (
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
              <Text style={styles.totalAmount}>
                ${calculateTotal().toFixed(2)}
              </Text>
            </View>
          </View>
        </>
      ) : !isTransitioning ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="bag-outline" size={100} color="#bbb" />
          <Text style={styles.emptyText}>Your shopping bag is empty.</Text>
        </View>
      ) : null}

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
        <TouchableWithoutFeedback
          onPress={() => {
            setIsDeleteModalVisible(false);
            setItemToDelete(null);
          }}
        >
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
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
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Message Confirmation Popup (no animation, just appear/disappear) */}
      <Modal
        transparent={true}
        animationType="none"
        visible={messagePopupVisible}
        onRequestClose={() => setMessagePopupVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setMessagePopupVisible(false)}>
          <View style={styles.buyPopupOverlay}>
            <View style={styles.buyPopupContainer}>
              <Ionicons
                name="checkmark-circle-outline"
                size={30}
                color="#4CD964"
              />
              <Text style={styles.buyPopupText}>Request sent!</Text>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
};

export default CartScreen;

/** STYLES **/
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
    alignItems: "flex-start",
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 16,
  },
  cartImage: {
    width: width * 0.18,
    height: width * 0.18,
    borderRadius: 12,
    marginRight: 15,
    backgroundColor: "#2C2C2C",
  },
  cartDetails: {
    flex: 1,
    justifyContent: "flex-start",
    paddingRight: 10,
  },
  cartTitle: {
    color: "#fff",
    fontSize: 14,
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
    alignItems: "flex-start",
  },
  messageButtonGradient: {
    borderRadius: 8,
    marginRight: 10,
    marginTop: 4, // Move the button lower
    shadowColor: "#888",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 3,
    elevation: 5,
  },
  messageButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  messageButtonText: {
    color: "black",
    fontSize: 12,
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
  /** Error State **/
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
    backgroundColor: "#000",
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
  /** Empty Cart **/
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
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
  /** Footer/Message All **/
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
  messageAllButton: {
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
  messageAllButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    marginRight: 6,
  },
  /** Modal Styles **/
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
  /** Message Popup **/
  buyPopupOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0)",
    justifyContent: "center",
    alignItems: "center",
  },
  buyPopupContainer: {
    backgroundColor: "#1E1E1E",
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    elevation: 10,
  },
  buyPopupText: {
    color: "#fff",
    fontSize: 14,
    marginLeft: 10,
    fontWeight: "500",
  },
  /** Loading Indicators **/
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
  },
  loadingText: {
    color: "#BB86FC",
    fontSize: 18,
    marginTop: 10,
    fontWeight: "600",
  },
});
