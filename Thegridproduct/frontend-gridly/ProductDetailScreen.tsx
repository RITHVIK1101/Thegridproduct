import React, { useEffect, useState, useContext } from "react";
import {
  View,
  Text,
  Image,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  Dimensions,
  Modal,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "./navigationTypes";
import { UserContext } from "./UserContext";
import { NGROK_URL } from "@env";
import Ionicons from "react-native-vector-icons/Ionicons";
import SwiperFlatList from "react-native-swiper-flatlist";
import { LinearGradient } from "expo-linear-gradient";

type ProductDetailRouteParams = {
  productId: string;
};

const { width } = Dimensions.get("window");
const SWIPER_HEIGHT = 250;
const DESCRIPTION_LIMIT = 200; // character limit for description truncation

const ProductDetailScreen: React.FC = () => {
  const route = useRoute();
  const navigation = useNavigation<StackNavigationProp<RootStackParamList, "ProductDetail">>();
  const { productId } = route.params as ProductDetailRouteParams;
  const { token, userId } = useContext(UserContext);

  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [posterProfile, setPosterProfile] = useState<any>(null);
  const [isModalVisible, setIsModalVisible] = useState<boolean>(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [autoplay, setAutoplay] = useState<boolean>(true);
  const [descriptionExpanded, setDescriptionExpanded] = useState<boolean>(false);
  const [isRequesting, setIsRequesting] = useState<boolean>(false);

  // Fetch product details
  useEffect(() => {
    const fetchProductDetails = async () => {
      try {
        if (!productId) {
          throw new Error("Invalid product ID.");
        }
        const response = await fetch(`${NGROK_URL}/products/${productId}`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });
        if (!response.ok) {
          const errorText = await response.text();
          console.error("Error response:", errorText);
          throw new Error("Failed to fetch product details.");
        }
        const data = await response.json();
        setProduct(data);
      } catch (error) {
        console.error("Error fetching product detail:", error);
        Alert.alert("Error", "Failed to load product details.");
      } finally {
        setLoading(false);
      }
    };

    fetchProductDetails();
  }, [productId, token]);

  // Fetch poster profile
  useEffect(() => {
    if (product && product.userId) {
      const fetchUserProfile = async () => {
        try {
          const response = await fetch(`${NGROK_URL}/users/${product.userId}`, {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          });
          if (!response.ok) {
            throw new Error("Failed to fetch user profile.");
          }
          const data = await response.json();
          setPosterProfile(data);
        } catch (error) {
          console.error("Error fetching user profile:", error);
        }
      };

      fetchUserProfile();
    }
  }, [product, token]);

  // Add-to-Cart function
  const addToCart = async () => {
    try {
      const response = await fetch(`${NGROK_URL}/cart/add`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ productId: product.id, quantity: 1 }),
      });
      if (!response.ok) {
        throw new Error("Failed to add product to cart.");
      }
      Alert.alert("Success", "Product added to cart!");
    } catch (error) {
      console.error("Error adding to cart:", error);
      Alert.alert("Error", "Could not add product to cart.");
    }
  };

  // Request product function (sends a chat request)
  const requestProduct = async () => {
    if (!userId) {
      Alert.alert("Error", "User not authenticated.");
      return;
    }
    if (!product.userId) {
      Alert.alert("Error", "Seller information is missing.");
      return;
    }
    setIsRequesting(true);
    const payload = {
      referenceId: product.id,
      referenceType: "product",
      buyerId: userId,
      sellerId: product.userId,
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
        Alert.alert("Success", "Request sent!");
      } else {
        throw new Error(data.message || "Failed to send request.");
      }
    } catch (error: any) {
      console.error("Error sending request:", error);
      Alert.alert("Error", error.message || "Failed to send request.");
    } finally {
      setIsRequesting(false);
    }
  };

  const openImageModal = (imageUrl: string) => {
    setSelectedImage(imageUrl);
    setIsModalVisible(true);
    setAutoplay(false);
  };

  const closeImageModal = () => {
    setIsModalVisible(false);
    setSelectedImage(null);
    setAutoplay(true);
  };

  const renderImageItem = ({ item }: { item: string }) => (
    <TouchableOpacity activeOpacity={0.8} onPress={() => openImageModal(item)}>
      <Image source={{ uri: item }} style={styles.swiperImage} resizeMode="cover" />
      <View style={styles.imageOverlay}>
        <Ionicons name="expand-outline" size={30} color="#FFFFFF80" />
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#BB86FC" />
      </View>
    );
  }

  if (!product) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Product not found.</Text>
      </View>
    );
  }

  const images =
    product.images && product.images.length > 0
      ? product.images
      : ["https://via.placeholder.com/150"];

  // Truncated description logic
  const displayDescription =
    product.description &&
    product.description.length > DESCRIPTION_LIMIT &&
    !descriptionExpanded
      ? product.description.slice(0, DESCRIPTION_LIMIT) + "..."
      : product.description;

  return (
    <ScrollView style={styles.container}>
      {/* Image Swiper with floating profile icon */}
      <View style={styles.swiperContainer}>
        <SwiperFlatList
          autoplay={autoplay}
          autoplayDelay={2}
          autoplayLoop
          index={0}
          showPagination
          paginationStyle={styles.paginationStyle}
          paginationDefaultColor="#555555"
          paginationActiveColor="#BB86FC"
          data={images}
          renderItem={renderImageItem}
          keyExtractor={(_, index) => `${product.id}_image_${index}`}
        />
        {posterProfile && (
          <TouchableOpacity
            style={styles.floatingProfileIcon}
            onPress={() =>
              navigation.push("UserProfile", { userId: product.userId })
            }
          >
            {posterProfile.profilePic ? (
              <Image
                source={{ uri: posterProfile.profilePic }}
                style={styles.profileIconImage}
              />
            ) : (
              <View style={styles.profileIconPlaceholder}>
                <Text style={styles.profileIconInitials}>
                  {posterProfile.firstName?.charAt(0)}
                  {posterProfile.lastName?.charAt(0)}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Fullscreen Image Modal */}
      <Modal
        visible={isModalVisible}
        transparent
        onRequestClose={closeImageModal}
        animationType="fade"
      >
        <TouchableOpacity style={styles.modalBackground} onPress={closeImageModal}>
          {selectedImage && (
            <Image
              source={{ uri: selectedImage }}
              style={styles.fullscreenImage}
              resizeMode="contain"
            />
          )}
        </TouchableOpacity>
      </Modal>

      {/* Product Details */}
      <View style={styles.detailsContainer}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>{product.title}</Text>
          <View style={styles.actionButtonsContainer}>
            <TouchableOpacity style={styles.addToCartButton} onPress={addToCart}>
              <Ionicons name="cart" size={20} color="#FFFFFF" />
            </TouchableOpacity>
            <LinearGradient
              colors={["rgb(168, 237, 234)", "rgb(254, 214, 227)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.requestButtonGradient}
            >
              <TouchableOpacity
                style={styles.requestButton}
                onPress={requestProduct}
                disabled={isRequesting}
              >
                <Text style={styles.requestButtonText}>
                  {isRequesting ? "Requesting..." : "Request"}
                </Text>
              </TouchableOpacity>
            </LinearGradient>
          </View>
        </View>
        <Text style={styles.price}>
          ${product.price ? product.price.toFixed(2) : "N/A"}
        </Text>
        <View style={styles.additionalDetails}>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Campus</Text>
            <Text style={styles.detailValue}>{product.university || "N/A"}</Text>
          </View>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Condition</Text>
            <Text style={styles.detailValue}>{product.quality || "N/A"}</Text>
          </View>
          {product.rentPrice && product.rentPrice > 0 ? (
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Renting Price</Text>
              <Text style={styles.detailValue}>
                ${product.rentPrice.toFixed(2)} {product.rentDuration || ""}
              </Text>
            </View>
          ) : (
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Renting</Text>
              <Text style={styles.detailValue}>Unavailable</Text>
            </View>
          )}
        </View>
        <Text style={styles.sectionHeader}>Description</Text>
        <Text style={styles.description}>{displayDescription}</Text>
        {product.description.length > DESCRIPTION_LIMIT && (
          <TouchableOpacity onPress={() => setDescriptionExpanded(!descriptionExpanded)}>
            <Text style={styles.readMoreText}>
              {descriptionExpanded ? "Show less" : "Read more"}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
};

export default ProductDetailScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000000",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000000",
  },
  errorText: {
    fontSize: 16,
    color: "red",
  },
  swiperContainer: {
    height: SWIPER_HEIGHT,
    marginTop: 10,
  },
  swiperImage: {
    width,
    height: SWIPER_HEIGHT,
    borderRadius: 15,
  },
  imageOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    width,
    height: SWIPER_HEIGHT,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 15,
  },
  paginationStyle: {
    marginTop: 10,
  },
  modalBackground: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.95)",
    justifyContent: "center",
    alignItems: "center",
  },
  fullscreenImage: {
    width: "90%",
    height: "70%",
    borderRadius: 10,
  },
  detailsContainer: {
    padding: 20,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "800",
    flex: 1,
    marginRight: 10,
  },
  price: {
    color: "#BB86FC",
    fontSize: 18,
    fontWeight: "700",
    marginVertical: 10,
    textAlign: "center",
  },
  additionalDetails: {
    marginBottom: 25,
  },
  detailItem: {
    flexDirection: "row",
    marginBottom: 12,
  },
  detailLabel: {
    color: "#BB86FC",
    fontSize: 16,
    fontWeight: "600",
    width: 160,
  },
  detailValue: {
    color: "#FFFFFF",
    fontSize: 16,
    flex: 1,
    flexWrap: "wrap",
  },
  sectionHeader: {
    color: "#F2F2F7",
    fontSize: 18,
    fontWeight: "600",
    marginTop: 15,
    marginBottom: 5,
  },
  description: {
    color: "#E0E0E0",
    fontSize: 20,
    lineHeight: 28,
    marginBottom: 5,
  },
  readMoreText: {
    color: "#BB86FC",
    fontSize: 16,
    marginBottom: 10,
  },
  actionButtonsContainer: {
    flexDirection: "row",
  },
  addToCartButton: {
    backgroundColor: "#388E3C",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  requestButtonGradient: {
    borderRadius: 50,
    marginLeft: 8,
  },
  requestButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  requestButtonText: {
    color: "black",
    fontSize: 16,
    fontWeight: "600",
  },
  floatingProfileIcon: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: "#BB86FC",
    overflow: "hidden",
    backgroundColor: "#1E1E1E",
  },
  profileIconImage: {
    width: "100%",
    height: "100%",
  },
  profileIconPlaceholder: {
    flex: 1,
    backgroundColor: "#555555",
    justifyContent: "center",
    alignItems: "center",
  },
  profileIconInitials: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "bold",
  },
});
