// JobDetails.tsx

import React, { useEffect, useState, useContext, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Image,
  TouchableOpacity,
  Dimensions,
  Modal,
} from "react-native";
import { RouteProp, useRoute, useNavigation } from "@react-navigation/native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { UserContext } from "./UserContext";
import { NGROK_URL } from "@env";
import { LinearGradient } from "expo-linear-gradient";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "./navigationTypes";
import SwiperFlatList from "react-native-swiper-flatlist";

type JobDetailRouteProp = RouteProp<RootStackParamList, "JobDetail">;
type JobDetailNavigationProp = StackNavigationProp<
  RootStackParamList,
  "JobDetail"
>;

interface JobDetail {
  id: string;
  title: string;
  description: string;
  category: string;
  price: string;
  userId: string;
  images: string[]; // Array of image URLs
  deliveryTime: string;
  university: string;
  campusPresence: string; // New field for Campus Presence
  expirationDate: string; // New field for Expiration Date
  postedDate: string; // Date Posted
}

const { width } = Dimensions.get("window");
const DESCRIPTION_CHAR_LIMIT = 200;

const JobDetails: React.FC = () => {
  const route = useRoute<JobDetailRouteProp>();
  const navigation = useNavigation<JobDetailNavigationProp>();
  const { jobId } = route.params;
  const { token, userId } = useContext(UserContext);

  const [jobDetail, setJobDetail] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [isModalVisible, setIsModalVisible] = useState<boolean>(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [autoplay, setAutoplay] = useState<boolean>(true);
  const [isDescriptionExpanded, setIsDescriptionExpanded] =
    useState<boolean>(false);

  // States for custom modals (confirmation, success, error)
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [showSuccessModal, setShowSuccessModal] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Reference to the Swiper
  const swiperRef = useRef<SwiperFlatList>(null);

  // Autoplay timing configuration
  const autoplayDelaySeconds = 2;
  const autoplayIntervalSeconds = 3;
  const transitionPauseMs = autoplayIntervalSeconds * 1000;

  useEffect(() => {
    fetchJobDetails();
  }, []);

  const fetchJobDetails = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${NGROK_URL}/services/${jobId}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch job details: ${response.status}`);
      }

      const data = await response.json();
      if (!data) {
        throw new Error("Job detail not found.");
      }

      // Ensure `images` is always an array
      if (!Array.isArray(data.images)) {
        data.images = [];
      }

      // Format postedDate
      if (data.postedDate) {
        const date = new Date(data.postedDate);
        data.postedDate = date.toLocaleDateString(undefined, {
          year: "numeric",
          month: "long",
          day: "numeric",
        });
      } else {
        data.postedDate = "N/A";
      }

      // Format expirationDate
      if (data.expirationDate) {
        const date = new Date(data.expirationDate);
        data.expirationDate = date.toLocaleDateString(undefined, {
          year: "numeric",
          month: "long",
          day: "numeric",
        });
      } else {
        data.expirationDate = "N/A";
      }

      setJobDetail(data);
    } catch (error) {
      console.error("Error fetching job details:", error);
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  // Called when the "Message" button is pressed.
  // Instead of immediately sending a chat request, we show a confirmation modal.
  const onMessageButtonPress = () => {
    setShowConfirmModal(true);
  };

  // Called when user confirms sending the chat request.
  const confirmSendChatRequest = async () => {
    setShowConfirmModal(false);
    if (!jobDetail || !userId || !token) {
      setErrorMessage("Missing required data. Please try again.");
      return;
    }

    // Build payload
    const payload = {
      referenceId: jobDetail.id,
      referenceType: "gig",
      buyerId: userId,
      sellerId: jobDetail.userId,
    };

    console.log("📤 Sending Chat Request:", payload);

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
      console.log("🚀 API Response:", data);

      if (response.ok) {
        // Show success modal to notify the user.
        setShowSuccessModal(true);
      } else {
        console.error("⚠️ API Error:", data);
        throw new Error(data.error || "Failed to send chat request.");
      }
    } catch (error: any) {
      console.error("🚨 Error sending chat request:", error);
      setErrorMessage(error.message || "Failed to send request. Please try again.");
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

  // Reusable component to display label & value
  const DetailItem: React.FC<{ label: string; value: string }> = ({
    label,
    value,
  }) => (
    <View style={styles.detailItem}>
      <Text style={styles.detailLabel}>{label}:</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );

  // Swiper item for each image
  const renderSwiperItem = ({ item }: { item: string }) => {
    const imageUrl = item.startsWith("http") ? item : `${NGROK_URL}/${item}`;
    return (
      <TouchableOpacity
        onPress={() => openImageModal(imageUrl)}
        activeOpacity={0.8}
      >
        <Image
          source={{ uri: imageUrl }}
          style={styles.swiperImage}
          resizeMode="cover"
          onError={(e) => {
            console.log("Error loading image:", e.nativeEvent.error);
          }}
        />
        {/* Overlay Icon to indicate clickability */}
        <View style={styles.imageOverlay}>
          <Ionicons name="expand-outline" size={30} color="#FFFFFF80" />
        </View>
      </TouchableOpacity>
    );
  };

  if (loading || !jobDetail) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#BB86FC" />
      </View>
    );
  }

  const displayedImages = jobDetail.images.slice(0, 5);
  const lastImageIndex = displayedImages.length - 1;
  const { description = "" } = jobDetail;
  const isLongDescription = description.length > DESCRIPTION_CHAR_LIMIT;
  const truncatedDescription = isLongDescription
    ? description.slice(0, DESCRIPTION_CHAR_LIMIT) + "..."
    : description;
  const displayedDescription = isDescriptionExpanded
    ? description
    : truncatedDescription;

  return (
    <ScrollView style={styles.container}>
      {/* Image Swiper or "No Material" */}
      {displayedImages.length > 0 ? (
        <View style={styles.swiperContainer}>
          <SwiperFlatList
            ref={swiperRef}
            autoplay={autoplay}
            autoplayDelay={autoplayDelaySeconds}
            autoplayInterval={autoplayIntervalSeconds}
            autoplayLoop={false}
            index={0}
            showPagination
            paginationStyle={styles.paginationStyle}
            paginationDefaultColor="#555555"
            paginationActiveColor="#BB86FC"
            data={displayedImages}
            renderItem={renderSwiperItem}
            keyExtractor={(item, index) =>
              `${jobDetail.id}_image_${index}`
            }
            onChangeIndex={({ index }) => {
              if (index === lastImageIndex) {
                setTimeout(() => {
                  if (swiperRef.current) {
                    swiperRef.current.scrollToIndex({
                      index: 0,
                      animated: true,
                    });
                  }
                }, transitionPauseMs);
              }
            }}
          />
        </View>
      ) : (
        <View style={styles.noMaterialContainer}>
          <Text style={styles.noMaterialText}>No images provided.</Text>
        </View>
      )}

      {/* Fullscreen Image Modal */}
      <Modal
        visible={isModalVisible}
        transparent={true}
        onRequestClose={closeImageModal}
        animationType="fade"
      >
        <TouchableOpacity
          style={styles.modalBackground}
          onPress={closeImageModal}
        >
          {selectedImage && (
            <Image
              source={{ uri: selectedImage }}
              style={styles.fullscreenImage}
              resizeMode="contain"
            />
          )}
        </TouchableOpacity>
      </Modal>

      {/* Confirmation Modal */}
      <Modal
        visible={showConfirmModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowConfirmModal(false)}
      >
        <View style={styles.popupContainer}>
          <View style={styles.popupContent}>
            <Text style={styles.popupTitle}>Confirm Chat Request</Text>
            <Text style={styles.popupMessage}>
              Are you sure you want to send a chat request? Once sent, please wait until the other person accepts it.
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
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowSuccessModal(false)}
      >
        <View style={styles.popupContainer}>
          <View style={styles.popupContent}>
            <Text style={styles.popupTitle}>Chat Request Sent</Text>
            <Text style={styles.popupMessage}>
              Your chat request has been sent. Please wait until the other person accepts it.
            </Text>
            <TouchableOpacity
              style={[styles.bubbleButton]}
              onPress={() => setShowSuccessModal(false)}
            >
              <Text style={styles.bubbleButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Error Modal */}
      <Modal
        visible={errorMessage !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setErrorMessage(null)}
      >
        <View style={styles.popupContainer}>
          <View style={styles.popupContent}>
            <Text style={styles.popupTitle}>Error</Text>
            <Text style={styles.popupMessage}>{errorMessage}</Text>
            <TouchableOpacity
              style={[styles.bubbleButton]}
              onPress={() => setErrorMessage(null)}
            >
              <Text style={styles.bubbleButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Details Container */}
      <View style={styles.detailsContainer}>
        <Text style={styles.title}>{jobDetail.title}</Text>
        <Text style={styles.description}>{displayedDescription}</Text>
        {isLongDescription && (
          <TouchableOpacity
            onPress={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
          >
            <Text style={styles.readMoreText}>
              {isDescriptionExpanded ? "Read Less" : "Read More"}
            </Text>
          </TouchableOpacity>
        )}
        <View style={styles.categoryRow}>
          <Ionicons
            name={categoryIcons[jobDetail.category] || "grid-outline"}
            size={20}
            color="#BB86FC"
            style={{ marginRight: 5 }}
          />
          <Text style={styles.category}>{jobDetail.category}</Text>
        </View>
        <Text style={styles.price}>
          Price:{" "}
          {jobDetail.price.toLowerCase() === "open to communication"
            ? "Open to Communication"
            : `$${parseFloat(jobDetail.price).toFixed(2)}`}
        </Text>
        <Text style={styles.datePosted}>Posted on {jobDetail.postedDate}</Text>
        <View style={styles.additionalDetails}>
          <DetailItem label="Delivery Time" value={jobDetail.deliveryTime} />
          <DetailItem label="Campus Presence" value={jobDetail.campusPresence} />
          <DetailItem label="University" value={jobDetail.university} />
          <DetailItem label="Expiration Date" value={jobDetail.expirationDate} />
        </View>
        {/* Message Button */}
        <TouchableOpacity
          style={styles.messageButton}
          onPress={onMessageButtonPress}
        >
          <LinearGradient
            colors={["#8E2DE2", "#4A00E0"]} // Purplish gradient
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.messageButtonGradient}
          >
            <Ionicons
              name="chatbubble-ellipses-outline"
              size={20}
              color="#fff"
            />
            <Text style={styles.messageButtonText}>Message</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

/** Icon mapping for categories */
const categoryIcons: { [key: string]: string } = {
  Tutoring: "school-outline",
  Design: "color-palette-outline",
  Writing: "create-outline",
  Delivery: "bicycle-outline",
  Coding: "code-slash-outline",
  Other: "grid-outline",
};

export default JobDetails;

/* -------------------- STYLES -------------------- */

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
  swiperContainer: {
    height: 250,
    marginTop: 10,
  },
  swiperImage: {
    width,
    height: 250,
    borderRadius: 15,
  },
  noMaterialContainer: {
    marginTop: 10,
    marginBottom: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  noMaterialText: {
    color: "#AAAAAA",
    fontSize: 16,
    fontStyle: "italic",
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
  title: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "800",
    marginBottom: 10,
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
    fontWeight: "600",
    marginBottom: 15,
  },
  categoryRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  category: {
    color: "#BB86FC",
    fontSize: 18,
    fontWeight: "700",
  },
  price: {
    color: "#BB86FC",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 10,
  },
  datePosted: {
    color: "#AAAAAA",
    fontSize: 14,
    marginBottom: 15,
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
  messageButton: {
    alignSelf: "center",
    width: "90%",
    borderRadius: 30,
    overflow: "hidden",
    marginTop: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  messageButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
  },
  messageButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 10,
  },
  paginationStyle: {
    marginTop: 10,
  },
  imageOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    width,
    height: 250,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 15,
  },
  /* Popup Modal Styles */
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
    backgroundColor: "#4A00E0", // Purplish button style
  },
  cancelButton: {
    backgroundColor: "#555555",
  },
  popupButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  // Bubble style for the "Close" and error OK button
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
