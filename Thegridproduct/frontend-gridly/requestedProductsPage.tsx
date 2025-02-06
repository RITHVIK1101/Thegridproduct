import React, { useState, useEffect, useContext } from "react";
import {
  SafeAreaView,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Modal,
  Dimensions,
  TextInput,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
  Alert,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { NGROK_URL } from "@env";
import { UserContext } from "./UserContext";

const { width, height } = Dimensions.get("window");

// Update your type to include an id and sellerId
type RequestedProduct = {
  id: string;
  productName: string;
  description: string;
  sellerId: string;
};

const RequestedProductsPage: React.FC = () => {
  const { token, userId } = useContext(UserContext);
  const [requestedProducts, setRequestedProducts] = useState<
    RequestedProduct[]
  >([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isSearchActive, setIsSearchActive] = useState<boolean>(false);
  const [selectedProduct, setSelectedProduct] =
    useState<RequestedProduct | null>(null);
  const [modalVisible, setModalVisible] = useState<boolean>(false);

  // States for chat request modals
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [showSuccessModal, setShowSuccessModal] = useState<boolean>(false);
  const [requestError, setRequestError] = useState<string | null>(null);

  // Helper function to randomize array order
  const shuffleArray = (array: RequestedProduct[]) => {
    return array.sort(() => Math.random() - 0.5);
  };

  useEffect(() => {
    fetchRequestedProducts();
  }, [token]);

  const fetchRequestedProducts = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const response = await fetch(`${NGROK_URL}/requests/all`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        throw new Error("Failed to fetch requested products.");
      }
      const data = await response.json();

      // ✅ Ensure sellerId is set from userId
      const processedData = data.map((product) => ({
        ...product,
        sellerId: product.userId, // ✅ Fixing the missing sellerId
      }));

      setRequestedProducts(shuffleArray(processedData));
      setError(null);
    } catch (err: any) {
      console.error("Error fetching requested products:", err);
      setError(err.message || "Error fetching products.");
    } finally {
      setLoading(false);
    }
  };

  // Filter products based on search query (case-insensitive)
  const filteredProducts = requestedProducts.filter((product) =>
    product.productName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleSearch = () => {
    setIsSearchActive((prev) => !prev);
    // When closing search mode, clear the query
    if (isSearchActive) setSearchQuery("");
  };

  const openModal = (product: RequestedProduct) => {
    setSelectedProduct(product);
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setSelectedProduct(null);
  };

  // Simple helper to truncate text
  const truncate = (text: string, limit: number) => {
    return text.length > limit ? text.slice(0, limit) + "..." : text;
  };

  const renderProductItem = ({ item }: { item: RequestedProduct }) => (
    <TouchableOpacity
      style={styles.productItem}
      onPress={() => openModal(item)}
    >
      <View style={styles.productInfo}>
        <Text style={styles.productName}>{item.productName}</Text>
        <Text style={styles.productDescription}>
          {truncate(item.description, 60)}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#BB86FC" />
    </TouchableOpacity>
  );

  const onMessageButtonPress = () => {
    console.log(
      "Message button pressed, closing product modal and opening confirmation"
    );
    setModalVisible(false); // dismiss product details
    setShowConfirmModal(true); // then show confirmation
  };

  const confirmSendChatRequest = async () => {
    setShowConfirmModal(false);
    if (!selectedProduct || !userId || !token) {
      setRequestError("Missing required data. Please try again.");
      return;
    }

    const payload = {
      referenceId: selectedProduct.id, // ✅ Should be non-empty
      referenceType: "product_request", // ✅ Must match backend
      buyerId: userId, // ✅ Should be non-empty
      sellerId: selectedProduct.sellerId, // ✅ Should be non-empty
    };

    console.log("📤 Sending Product Request Chat:", payload);

    // Ensure no empty values before proceeding
    if (
      !payload.referenceId ||
      !payload.referenceType ||
      !payload.buyerId ||
      !payload.sellerId
    ) {
      console.error("🚨 Missing fields in request payload:", payload);
      setRequestError("Some required fields are missing.");
      return;
    }

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
      console.log("🚀 Chat Request Response:", data);

      if (response.ok) {
        setShowSuccessModal(true);
      } else {
        throw new Error(data.error || "Failed to send chat request.");
      }
    } catch (error: any) {
      console.error("🚨 Error sending chat request:", error);
      setRequestError(
        error.message || "Failed to send request. Please try again."
      );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Compact Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Requested</Text>
        <TouchableOpacity onPress={toggleSearch}>
          <Ionicons name="search" size={24} color="#BB86FC" />
        </TouchableOpacity>
      </View>

      {/* Toggleable Search Bar */}
      {isSearchActive && (
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search products..."
            placeholderTextColor="#888"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery("")}
              style={styles.clearButton}
            >
              <Ionicons name="close" size={20} color="#888" />
            </TouchableOpacity>
          )}
        </View>
      )}

      {loading ? (
        <ActivityIndicator size="large" color="#BB86FC" style={styles.loader} />
      ) : error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : (
        <FlatList
          data={filteredProducts}
          keyExtractor={(_, index) => index.toString()}
          renderItem={renderProductItem}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}

      {/* Modal for Product Details */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <LinearGradient
            colors={["#000000", "#1F0033"]}
            style={styles.modalContainer}
          >
            <ScrollView contentContainerStyle={styles.modalContent}>
              {selectedProduct && (
                <>
                  <Text style={styles.modalTitle}>
                    {selectedProduct.productName}
                  </Text>
                  <Text style={styles.modalText}>
                    {selectedProduct.description}
                  </Text>
                  <TouchableOpacity
                    style={styles.modalButton}
                    onPress={() => {
                      console.log("Message button pressed");
                      onMessageButtonPress();
                    }}
                  >
                    <Ionicons
                      name="chatbubble-ellipses-outline"
                      size={20}
                      color="#000"
                    />
                    <Text style={styles.modalButtonText}>Message</Text>
                  </TouchableOpacity>
                </>
              )}
              <TouchableOpacity style={styles.modalClose} onPress={closeModal}>
                <Ionicons name="close-circle" size={28} color="#BB86FC" />
              </TouchableOpacity>
            </ScrollView>
          </LinearGradient>
        </View>
      </Modal>

      {/* Confirmation Modal */}
      <Modal
        visible={showConfirmModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowConfirmModal(false)}
      >
        <View style={styles.popupContainer}>
          <View style={styles.popupContent}>
            <Text style={styles.popupTitle}>Confirm Chat Request</Text>
            <Text style={styles.popupMessage}>
              Are you sure you want to send a chat request? Once sent, please
              wait until the other person accepts it.
            </Text>
            <View style={styles.popupButtons}>
              <TouchableOpacity
                style={[styles.popupButton, styles.cancelButton]}
                onPress={() => setShowConfirmModal(false)}
              >
                <Text style={styles.popupButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.popupButton, styles.confirmButton]}
                onPress={confirmSendChatRequest}
              >
                <Text style={styles.popupButtonText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Success Modal */}
      <Modal
        visible={showSuccessModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSuccessModal(false)}
      >
        <View style={styles.popupContainer}>
          <View style={styles.popupContent}>
            <Text style={styles.popupTitle}>Chat Request Sent</Text>
            <Text style={styles.popupMessage}>
              Your chat request has been sent. Please wait until the other
              person accepts it.
            </Text>
            <TouchableOpacity
              style={styles.bubbleButton}
              onPress={() => setShowSuccessModal(false)}
            >
              <Text style={styles.bubbleButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Error Modal */}
      <Modal
        visible={requestError !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setRequestError(null)}
      >
        <View style={styles.popupContainer}>
          <View style={styles.popupContent}>
            <Text style={styles.popupTitle}>Error</Text>
            <Text style={styles.popupMessage}>{requestError}</Text>
            <TouchableOpacity
              style={styles.bubbleButton}
              onPress={() => setRequestError(null)}
            >
              <Text style={styles.bubbleButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default RequestedProductsPage;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: "#0B0B0B",
    borderBottomWidth: 1,
    borderBottomColor: "#222",
  },
  headerTitle: {
    fontSize: 18,
    color: "#BB86FC",
    fontWeight: "600",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1A1A1A",
    paddingHorizontal: 15,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    backgroundColor: "#0B0B0B",
    color: "#fff",
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 40,
  },
  clearButton: {
    paddingHorizontal: 8,
  },
  loader: {
    marginTop: 50,
  },
  errorText: {
    color: "#FF3B30",
    textAlign: "center",
    marginTop: 50,
  },
  listContent: {
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  separator: {
    height: 10,
  },
  productItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1A1A1A",
    padding: 12,
    borderRadius: 8,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 16,
    color: "#BB86FC",
    fontWeight: "500",
  },
  productDescription: {
    fontSize: 13,
    color: "#ccc",
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.95)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    width: width * 0.9,
    maxHeight: height * 0.8,
    borderRadius: 16,
    padding: 20,
  },
  modalContent: {
    alignItems: "center",
    paddingBottom: 20,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#BB86FC",
    marginBottom: 15,
    textAlign: "center",
  },
  modalText: {
    fontSize: 16,
    color: "#fff",
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 25,
  },
  modalButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#BB86FC",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 25,
    marginBottom: 20,
  },
  modalButtonText: {
    color: "#000",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  modalClose: {
    marginTop: 10,
  },
  popupContainer: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  popupContent: {
    backgroundColor: "#1E1E1E",
    borderRadius: 10,
    padding: 20,
    width: "100%",
    maxWidth: 400,
    alignItems: "center",
  },
  popupTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 10,
    textAlign: "center",
  },
  popupMessage: {
    color: "#E0E0E0",
    fontSize: 16,
    textAlign: "center",
    marginBottom: 20,
  },
  popupButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
  },
  popupButton: {
    flex: 1,
    paddingVertical: 12,
    marginHorizontal: 5,
    borderRadius: 5,
    alignItems: "center",
  },
  confirmButton: {
    backgroundColor: "#4A00E0",
  },
  cancelButton: {
    backgroundColor: "#555555",
  },
  popupButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  bubbleButton: {
    backgroundColor: "#4A00E0",
    borderRadius: 30,
    paddingVertical: 12,
    paddingHorizontal: 25,
    alignSelf: "center",
  },
  bubbleButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});
