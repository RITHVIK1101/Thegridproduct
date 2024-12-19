// LikedProductScreen.tsx

import React, { useEffect, useState, useContext } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  Image,
  TouchableOpacity,
  Alert,
  Dimensions,
  Animated,
  Modal,
} from "react-native";
import { UserContext } from "./UserContext"; // Adjust path as necessary
import { NGROK_URL } from "@env"; // Load backend URL from environment variables
import { useNavigation } from "@react-navigation/native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { StackNavigationProp } from "./navigationTypes";

interface Product {
  _id: string;
  title: string;
  price: number;
  description: string;
  images: string[];
}

const { width } = Dimensions.get("window");

const LikedProductScreen: React.FC = () => {
  const { token } = useContext(UserContext);
  const [likedProducts, setLikedProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [fadeAnim] = useState(new Animated.Value(0));

  // State for remove confirmation
  const [productToRemove, setProductToRemove] = useState<Product | null>(null);
  const [isRemoveModalVisible, setIsRemoveModalVisible] = useState<boolean>(false);

  const navigation = useNavigation<StackNavigationProp<any>>();

  // Fetch liked products from backend
  useEffect(() => {
    const fetchLikedProducts = async () => {
      try {
        const response = await fetch(`${NGROK_URL}/products/liked`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || "Failed to fetch liked products");
        }

        const data: Product[] = await response.json();
        setLikedProducts(data);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }).start();
      } catch (err: any) {
        console.error("Error fetching liked products:", err);
        setError(err.message || "An unexpected error occurred");
        Alert.alert("Error", err.message || "An unexpected error occurred");
      } finally {
        setLoading(false);
      }
    };

    fetchLikedProducts();
  }, [token]);

  // Function to initiate removal confirmation
  const confirmRemoveProduct = (product: Product) => {
    setProductToRemove(product);
    setIsRemoveModalVisible(true);
  };

  // Function to handle actual removal
  const handleRemoveProduct = async () => {
    if (!productToRemove) return;

    try {
      const response = await fetch(`${NGROK_URL}/products/${productToRemove._id}/unlike`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (response.status === 401) {
        Alert.alert("Session Expired", "Please log in again.", [
          {
            text: "OK",
            onPress: () => {
              // Handle logout or navigation if needed
            },
          },
        ]);
        return;
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to remove liked product");
      }

      setLikedProducts((prevProducts) =>
        prevProducts.filter((product) => product._id !== productToRemove._id)
      );
      Alert.alert("Success", "Product removed from your liked list.");
    } catch (err: any) {
      console.error("Error removing liked product:", err);
      Alert.alert("Error", err.message || "An unexpected error occurred");
    } finally {
      setIsRemoveModalVisible(false);
      setProductToRemove(null);
    }
  };

  const renderSeparator = () => (
    <View style={styles.separator} />
  );

  // Render each liked product item
  const renderProductItem = ({ item }: { item: Product }) => (
    <Animated.View style={{ opacity: fadeAnim }}>
      <View style={styles.itemContainer}>
        <TouchableOpacity
          style={styles.productContent}
          onPress={() => navigation.navigate("ProductDetails", { productId: item._id })}
        >
          {item.images?.length > 0 ? (
            <Image
              source={{ uri: item.images[0] }}
              style={styles.productImage}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.productImage, styles.imagePlaceholder]}>
              <Text style={styles.imagePlaceholderText}>No Image</Text>
            </View>
          )}
          <View style={styles.productInfo}>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.price}>${item.price.toFixed(2)}</Text>
            <Text numberOfLines={2} style={styles.description}>
              {item.description}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => confirmRemoveProduct(item)}
          style={styles.removeButton}
          accessibilityLabel={`Remove ${item.title} from Liked`}
        >
          {/* Filled red heart icon to indicate 'liked', used for unlike action */}
          <Ionicons name="heart" size={24} color="#FF3B30" />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );

  // Loading state
  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#BB86FC" />
        <Text style={styles.loadingText}>Loading your liked products...</Text>
      </View>
    );
  }

  // Error state
  if (error) {
    return (
      <View style={styles.centered}>
        <Ionicons name="alert-circle-outline" size={60} color="#FF3B30" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => {
            setLoading(true);
            setError(null);
            // Re-fetch liked products
            const fetchLikedProducts = async () => {
              try {
                const response = await fetch(`${NGROK_URL}/products/liked`, {
                  method: "GET",
                  headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                  },
                });

                if (!response.ok) {
                  const errorData = await response.json();
                  throw new Error(errorData.message || "Failed to fetch liked products");
                }

                const data: Product[] = await response.json();
                setLikedProducts(data);
                Animated.timing(fadeAnim, {
                  toValue: 1,
                  duration: 500,
                  useNativeDriver: true,
                }).start();
              } catch (err: any) {
                console.error("Error fetching liked products:", err);
                setError(err.message || "An unexpected error occurred");
                Alert.alert("Error", err.message || "An unexpected error occurred");
              } finally {
                setLoading(false);
              }
            };

            fetchLikedProducts();
          }}
          accessibilityLabel="Retry Fetching Liked Products"
        >
          <Ionicons name="refresh-outline" size={20} color="#fff" />
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Empty state
  if (likedProducts.length === 0) {
    return (
      <View style={styles.centered}>
        <Ionicons name="heart-outline" size={100} color="#bbb" />
        <Text style={styles.emptyText}>You have no liked products yet.</Text>
      </View>
    );
  }

  // Main content
  return (
    <View style={styles.container}>
      <FlatList
        data={likedProducts}
        keyExtractor={(item) => item._id}
        renderItem={renderProductItem}
        ItemSeparatorComponent={renderSeparator}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />

      {/* Remove Confirmation Modal */}
      <Modal
        transparent={true}
        animationType="fade"
        visible={isRemoveModalVisible}
        onRequestClose={() => {
          setIsRemoveModalVisible(false);
          setProductToRemove(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Ionicons name="heart" size={40} color="#FF3B30" />
            <Text style={styles.modalTitle}>Remove from Liked</Text>
            <Text style={styles.modalMessage}>
              Are you sure you want to remove "{productToRemove?.title}" from your liked products?
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalButtonYes}
                onPress={handleRemoveProduct}
                accessibilityLabel="Confirm Removal"
              >
                <Text style={styles.modalButtonText}>Yes</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalButtonNo}
                onPress={() => {
                  setIsRemoveModalVisible(false);
                  setProductToRemove(null);
                }}
                accessibilityLabel="Cancel Removal"
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

export default LikedProductScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#000000",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: "#bbb",
  },
  errorText: {
    color: "#FF3B30",
    fontSize: 16,
    textAlign: "center",
    marginVertical: 10,
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
  emptyText: {
    color: "#bbb",
    fontSize: 22,
    marginTop: 20,
    fontWeight: "500",
    textAlign: "center",
  },
  listContent: {
    paddingBottom: 20,
  },
  separator: {
    height: 1,
    backgroundColor: "#2C2C2C",
    marginVertical: 8,
  },
  itemContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 12,
  },
  productContent: {
    flexDirection: "row",
    flex: 1,
    alignItems: "flex-start",
  },
  productImage: {
    width: width * 0.18,
    height: width * 0.18,
    borderRadius: 12,
    backgroundColor: "#2C2C2C",
    marginRight: 15,
  },
  imagePlaceholder: {
    justifyContent: "center",
    alignItems: "center",
  },
  imagePlaceholderText: {
    color: "#666",
    fontSize: 14,
  },
  productInfo: {
    flex: 1,
    justifyContent: "flex-start",
    paddingRight: 10,
  },
  title: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 4,
    flexWrap: "wrap",
  },
  price: {
    fontSize: 14,
    color: "#BB86FC",
    fontWeight: "600",
  },
  description: {
    fontSize: 12,
    color: "#999",
    marginTop: 4,
  },
  removeButton: {
    padding: 6,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    width: width * 0.8,
    backgroundColor: "#1E1E1E",
    borderRadius: 15,
    padding: 20,
    alignItems: "center",
  },
  modalTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
    marginTop: 10,
    marginBottom: 5,
    textAlign: "center",
  },
  modalMessage: {
    color: "#bbb",
    fontSize: 14,
    textAlign: "center",
    marginVertical: 15,
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
  },
  modalButtonYes: {
    flex: 1,
    backgroundColor: "#BB86FC",
    paddingVertical: 10,
    borderRadius: 8,
    marginRight: 5,
    alignItems: "center",
  },
  modalButtonNo: {
    flex: 1,
    backgroundColor: "#FF3B30",
    paddingVertical: 10,
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
