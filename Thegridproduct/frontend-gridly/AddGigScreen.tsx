// AddGig.tsx

import React, { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  TextInput,
  ScrollView,
  Modal,
  Animated,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  Alert,
  Easing,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import * as ImagePicker from "expo-image-picker";
import { useNavigation } from "@react-navigation/native";
import { NGROK_URL } from "@env"; // Ensure your .env is set up correctly
import DateTimePickerModal from "react-native-modal-datetime-picker"; // Make sure you have installed this package

/** Available categories to choose from. */
const AVAILABLE_CATEGORIES = ["Tutoring", "Design", "Delivering", "Other"] as const;

/** Define the multi-step flow with a union type for convenience. 
 *  We have 6 steps total.
 */
type Step = 1 | 2 | 3 | 4 | 5 | 6;

/** Shape of our gig form data. */
interface FormData {
  title: string;
  category: string;
  price: string; // numeric or empty
  isPriceOpenToComm: boolean;
  deliveryTime: string; // optional
  description: string;
  images: string[]; // up to 5
  /** Expiration date field (optional).
   *  The gig will become inactive by this time if set.
   *  If unset (empty), the gig defaults to 30 days. 
   */
  expirationDate: string;
}

const AddGig: React.FC = () => {
  const navigation = useNavigation();

  // ---------------------------
  // Multi-step management
  // ---------------------------
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [slideAnim] = useState(new Animated.Value(0));

  // Categories modal visibility
  const [showCategoriesModal, setShowCategoriesModal] = useState(false);

  // Form state
  const [formData, setFormData] = useState<FormData>({
    title: "",
    category: "",
    price: "",
    isPriceOpenToComm: false,
    deliveryTime: "",
    description: "",
    images: [],
    expirationDate: "",
  });

  // Delivery time toggle
  const [noDeliveryRequired, setNoDeliveryRequired] = useState(false);

  // ** New toggle for expiration date **
  const [noExpiration, setNoExpiration] = useState<boolean>(false);

  // Loading and success states
  const [isLoading, setIsLoading] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isSuccessModalVisible, setIsSuccessModalVisible] = useState(false);

  // Info modal states (for additional explanations)
  const [infoModalVisible, setInfoModalVisible] = useState(false);
  const [infoModalText, setInfoModalText] = useState("");

  // Error toast states
  const [errorMessage, setErrorMessage] = useState("");
  const errorOpacity = useRef(new Animated.Value(0)).current;

  // DateTime Picker states
  const [isDatePickerVisible, setDatePickerVisibility] = useState(false);

  // ------------------------------------------------------------------------------
  // Helper functions for error handling
  // ------------------------------------------------------------------------------
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

  // ------------------------------------------------------------------------------
  // Animation for sliding transitions between steps
  // ------------------------------------------------------------------------------
  const animateSlide = (direction: "forward" | "backward") => {
    Animated.sequence([
      Animated.timing(slideAnim, {
        toValue: direction === "forward" ? 1 : -1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 0,
        useNativeDriver: true,
      }),
    ]).start();
  };

  // ------------------------------------------------------------------------------
  // Step navigation functions
  // ------------------------------------------------------------------------------
  const handleNext = () => {
    if (!validateCurrentStep()) return;
    if (currentStep < 6) {
      animateSlide("forward");
      setCurrentStep((prev) => (prev + 1) as Step);
    } else {
      handleSubmit();
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      animateSlide("backward");
      setCurrentStep((prev) => (prev - 1) as Step);
    }
  };

  // ------------------------------------------------------------------------------
  // Step validation function
  // ------------------------------------------------------------------------------
  const validateCurrentStep = (): boolean => {
    switch (currentStep) {
      case 1:
        if (!formData.title.trim()) {
          showError("Please enter a Title.");
          return false;
        }
        if (!formData.category) {
          showError("Please select a Category.");
          return false;
        }
        return true;
      case 2:
        if (!formData.isPriceOpenToComm && !formData.price.trim()) {
          showError("Please specify a price or choose 'Open to Communication'.");
          return false;
        }
        return true;
      case 3:
        // Delivery time is optional, so no strict requirement if blank
        return true;
      case 4:
        if (!formData.description.trim()) {
          showError("Please provide a Description.");
          return false;
        }
        return true;
      case 5:
        // Expiration date is now optional, so no strict validation
        return true;
      case 6:
        // Image uploading is optional, so no validation required
        return true;
      default:
        return false;
    }
  };

  // ------------------------------------------------------------------------------
  // Final submission to backend
  // ------------------------------------------------------------------------------
  const handleSubmit = async () => {
    setIsLoading(true);

    // Construct the payload
    const payload: any = {
      title: formData.title.trim(),
      category: formData.category,
      price: formData.isPriceOpenToComm
        ? "Open to Communication"
        : formData.price.trim(),
      deliveryTime: noDeliveryRequired
        ? "Not Required"
        : formData.deliveryTime.trim(),
      description: formData.description.trim(),
      images: formData.images,
    };

    // If user has chosen noExpiration or has no date set, we skip or set it as empty 
    // (thus defaulting to 30 days on backend or logic).
    if (!noExpiration && formData.expirationDate) {
      payload.expirationDate = formData.expirationDate.trim();
    }

    try {
      const response = await fetch(`${NGROK_URL}/gigs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Include Authorization if needed
          // Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.message || `HTTP error! status: ${response.status}`
        );
      }

      setIsSuccessModalVisible(true);

      // Reset the form after success
      setFormData({
        title: "",
        category: "",
        price: "",
        isPriceOpenToComm: false,
        deliveryTime: "",
        description: "",
        images: [],
        expirationDate: "",
      });
      setNoDeliveryRequired(false);
      setNoExpiration(false);
      setCurrentStep(1);

      setTimeout(() => {
        setIsSuccessModalVisible(false);
        navigation.navigate("Dashboard"); // Adjust as needed
      }, 2000);
    } catch (error: unknown) {
      console.error("Error:", error);
      showError(
        error instanceof Error
          ? error.message
          : "Failed to post the gig. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  // ------------------------------------------------------------------------------
  // Image upload handling
  // ------------------------------------------------------------------------------
  const handleImageUpload = async () => {
    if (formData.images.length >= 5) {
      Alert.alert("Limit Reached", "You can upload up to 5 images.");
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.7,
        selectionLimit: 5 - formData.images.length,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setIsUploadingImage(true);

        const selectedAssets = result.assets.slice(
          0,
          5 - formData.images.length
        );

        for (const asset of selectedAssets) {
          const uri = asset.uri;
          setFormData((prev) => ({
            ...prev,
            images: [...prev.images, uri],
          }));
        }

        setIsUploadingImage(false);
      }
    } catch (error) {
      console.error("Image Picker Error:", error);
      showError("Error selecting or uploading images. Please try again.");
      setIsUploadingImage(false);
    }
  };

  const removeImage = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));
  };

  // ------------------------------------------------------------------------------
  // Info modal
  // ------------------------------------------------------------------------------
  const openInfoModal = (text: string) => {
    setInfoModalText(text);
    setInfoModalVisible(true);
  };

  const closeInfoModal = () => {
    setInfoModalVisible(false);
    setInfoModalText("");
  };

  // ------------------------------------------------------------------------------
  // DateTime Picker handlers
  // ------------------------------------------------------------------------------
  const showDatePicker = () => {
    setDatePickerVisibility(true);
  };

  const hideDatePicker = () => {
    setDatePickerVisibility(false);
  };

  const handleConfirm = (date: Date) => {
    const formattedDate = date.toLocaleString(); // Format as desired
    setFormData((prev) => ({
      ...prev,
      expirationDate: formattedDate,
    }));
    hideDatePicker();
  };

  // ------------------------------------------------------------------------------
  // Define multi-step slides
  // ------------------------------------------------------------------------------
  const slides: Record<number, { title: string; content: JSX.Element }> = {
    1: {
      title: "Basic Information",
      content: (
        <>
          <Text style={styles.label}>Gig Title</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter gig title (e.g., Math Tutor)"
            placeholderTextColor="#888"
            value={formData.title}
            onChangeText={(text) =>
              setFormData({ ...formData, title: text })
            }
          />

          <Text style={styles.label}>Category</Text>
          <TouchableOpacity
            style={styles.dropdown}
            onPress={() => setShowCategoriesModal(true)}
          >
            <Text style={styles.dropdownText}>
              {formData.category ? formData.category : "Select Category"}
            </Text>
            <Ionicons name="chevron-down-outline" size={20} color="#ccc" />
          </TouchableOpacity>
        </>
      ),
    },
    2: {
      title: "Pricing",
      content: (
        <>
          <Text style={styles.label}>Price per Hour</Text>
          <View style={styles.priceContainer}>
            <TextInput
              style={[
                styles.input,
                { flex: 1, opacity: formData.isPriceOpenToComm ? 0.5 : 1 },
              ]}
              placeholder="e.g., 25"
              placeholderTextColor="#888"
              keyboardType="numeric"
              value={formData.price}
              onChangeText={(text) =>
                setFormData({ ...formData, price: text })
              }
              editable={!formData.isPriceOpenToComm}
            />
            <Text style={styles.perHourText}>/hour</Text>
          </View>

          <TouchableOpacity
            style={styles.toggleButton}
            onPress={() =>
              setFormData((prev) => ({
                ...prev,
                isPriceOpenToComm: !prev.isPriceOpenToComm,
                price: prev.isPriceOpenToComm ? "" : prev.price,
              }))
            }
          >
            <Ionicons
              name={
                formData.isPriceOpenToComm
                  ? "checkmark-circle"
                  : "ellipse-outline"
              }
              size={24}
              color={formData.isPriceOpenToComm ? "#BB86FC" : "#ccc"}
            />
            <Text style={styles.toggleText}>
              {formData.isPriceOpenToComm
                ? "Open to Communication"
                : "I am open to discussing the price"}
            </Text>
          </TouchableOpacity>
        </>
      ),
    },
    3: {
      title: "Delivery Time",
      content: (
        <>
          <Text style={styles.label}>Delivery Time</Text>
          <TextInput
            style={[styles.input, { opacity: noDeliveryRequired ? 0.5 : 1 }]}
            placeholder="e.g., 2 days"
            placeholderTextColor="#888"
            value={formData.deliveryTime}
            onChangeText={(text) =>
              setFormData({ ...formData, deliveryTime: text })
            }
            editable={!noDeliveryRequired}
          />

          <TouchableOpacity
            style={styles.toggleButton}
            onPress={() => {
              setNoDeliveryRequired(!noDeliveryRequired);
              if (!noDeliveryRequired) {
                // Just toggled it on, so clear the field
                setFormData((prev) => ({ ...prev, deliveryTime: "" }));
              }
            }}
          >
            <Ionicons
              name={
                noDeliveryRequired ? "checkmark-circle" : "ellipse-outline"
              }
              size={24}
              color={noDeliveryRequired ? "#BB86FC" : "#ccc"}
            />
            <Text style={styles.toggleText}>
              My gig does not require a delivery time
            </Text>
          </TouchableOpacity>
        </>
      ),
    },
    4: {
      title: "Description",
      content: (
        <>
          <Text style={styles.label}>Description *</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Provide a detailed description of your gig."
            placeholderTextColor="#888"
            multiline
            numberOfLines={6}
            value={formData.description}
            onChangeText={(text) =>
              setFormData({ ...formData, description: text })
            }
          />
        </>
      ),
    },
    5: {
      title: "Gig Expiration Date",
      content: (
        <>
          <View style={styles.infoLabelContainer}>
            <Text style={styles.label}>Expiration Date (Optional)</Text>
            <TouchableOpacity
              onPress={() =>
                openInfoModal(
                  "If you do NOT set an expiration date, your gig will become inactive after a default 30 days by default."
                )
              }
            >
              <Ionicons
                name="information-circle-outline"
                size={20}
                color="#BB86FC"
              />
            </TouchableOpacity>
          </View>

          {/* Toggle between no expiration and setting an expiration date */}
          <TouchableOpacity
            style={styles.toggleButton}
            onPress={() => {
              setNoExpiration((prev) => !prev);
              // If we just toggled noExpiration ON, clear the date
              if (!noExpiration === true) {
                setFormData((prev) => ({ ...prev, expirationDate: "" }));
              }
            }}
          >
            <Ionicons
              name={noExpiration ? "checkmark-circle" : "ellipse-outline"}
              size={24}
              color={noExpiration ? "#BB86FC" : "#ccc"}
            />
            <Text style={styles.toggleText}>
              {noExpiration
                ? "No Expiration (30-day default)"
                : "Use No Expiration Date"}
            </Text>
          </TouchableOpacity>

          {/* If noExpiration is false, user can pick a date */}
          {!noExpiration && (
            <>
              <TouchableOpacity
                style={styles.datePickerButton}
                onPress={showDatePicker}
              >
                <Text style={styles.datePickerText}>
                  {formData.expirationDate
                    ? formData.expirationDate
                    : "Select an expiration date & time"}
                </Text>
                <Ionicons name="calendar-outline" size={20} color="#BB86FC" />
              </TouchableOpacity>

              {/* If a date is set, allow clearing it */}
              {formData.expirationDate ? (
                <TouchableOpacity
                  style={styles.clearDateButton}
                  onPress={() =>
                    setFormData((prev) => ({ ...prev, expirationDate: "" }))
                  }
                >
                  <Ionicons name="trash-outline" size={20} color="#BB86FC" />
                  <Text style={styles.clearDateButtonText}>Clear Date</Text>
                </TouchableOpacity>
              ) : null}
            </>
          )}

          <Text style={styles.optionalText}>
            If no expiration date is set, your gig will be inactive after 30 days.
          </Text>

          <DateTimePickerModal
            isVisible={isDatePickerVisible}
            mode="datetime"
            onConfirm={handleConfirm}
            onCancel={hideDatePicker}
            minimumDate={new Date()}
          />
        </>
      ),
    },
    6: {
      title: "Images (Optional)",
      content: (
        <>
          <TouchableOpacity
            style={styles.uploadButton}
            onPress={handleImageUpload}
            disabled={isUploadingImage || formData.images.length >= 5}
          >
            {isUploadingImage ? (
              <ActivityIndicator size="small" color="#BB86FC" />
            ) : (
              <>
                <Ionicons
                  name="cloud-upload-outline"
                  size={24}
                  color="#BB86FC"
                />
                <Text style={styles.uploadButtonText}>
                  {formData.images.length > 0
                    ? "Add More Images"
                    : "Upload Images"}
                </Text>
              </>
            )}
          </TouchableOpacity>

          <View style={styles.imagesContainer}>
            {formData.images.map((image, index) => (
              <View key={index} style={styles.imageContainer}>
                <Image source={{ uri: image }} style={styles.image} />
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => removeImage(index)}
                >
                  <Ionicons
                    name="close-circle-outline"
                    size={24}
                    color="#BB86FC"
                  />
                </TouchableOpacity>
              </View>
            ))}
          </View>

          <Text style={styles.optionalText}>
            You can upload up to 5 images.
          </Text>
        </>
      ),
    },
  };

  // ------------------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------------------
  return (
    <KeyboardAvoidingView
      style={styles.outerContainer}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Error Toast */}
      {errorMessage ? (
        <Animated.View
          style={[
            styles.errorToast,
            {
              opacity: errorOpacity,
              transform: [
                {
                  translateY: errorOpacity.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-50, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <Text style={styles.errorToastText}>{errorMessage}</Text>
        </Animated.View>
      ) : null}

      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView
          style={styles.container}
          contentContainerStyle={{ paddingBottom: 40 }}
        >
          {/* Progress Indicators */}
          <View style={styles.progressContainer}>
            {[1, 2, 3, 4, 5, 6].map((stepNumber) => (
              <View
                key={stepNumber}
                style={[
                  styles.progressDot,
                  stepNumber <= currentStep ? styles.progressDotActive : null,
                ]}
              />
            ))}
          </View>

          {/* Slide Content */}
          <Animated.View
            style={[
              styles.slideContainer,
              {
                transform: [
                  {
                    translateX: slideAnim.interpolate({
                      inputRange: [-1, 0, 1],
                      outputRange: [-50, 0, 50],
                    }),
                  },
                ],
              },
            ]}
          >
            <Text style={styles.stepTitle}>
              {slides[currentStep].title}
            </Text>
            {slides[currentStep].content}
          </Animated.View>

          {/* Navigation Buttons */}
          <View
            style={[
              styles.buttonContainer,
              { justifyContent: currentStep > 1 ? "space-between" : "flex-end" },
            ]}
          >
            {currentStep > 1 && (
              <TouchableOpacity style={styles.backButton} onPress={handleBack}>
                <Ionicons name="arrow-back" size={24} color="#aaa" />
                <Text style={styles.backButtonText}>Back</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[
                styles.nextButton,
                isLoading && currentStep === 6 && styles.buttonDisabled,
              ]}
              onPress={handleNext}
              disabled={isLoading && currentStep === 6}
            >
              {isLoading && currentStep === 6 ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Text style={styles.nextButtonText}>
                    {currentStep === 6 ? "Post Gig" : "Next"}
                  </Text>
                  {currentStep < 6 && (
                    <Ionicons name="arrow-forward" size={24} color="#fff" />
                  )}
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Success Modal */}
          <Modal
            transparent
            visible={isSuccessModalVisible}
            animationType="fade"
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <Ionicons
                  name="checkmark-circle"
                  size={60}
                  color="#9C27B0"
                />
                <Text style={styles.modalText}>Gig Posted Successfully!</Text>
              </View>
            </View>
          </Modal>

          {/* Info Modal (used for help or additional explanations) */}
          <Modal
            transparent
            visible={infoModalVisible}
            animationType="fade"
          >
            <TouchableOpacity
              style={styles.modalOverlay}
              activeOpacity={1}
              onPressOut={closeInfoModal}
            >
              <View style={styles.infoModalContent}>
                <Text style={styles.infoModalText}>{infoModalText}</Text>
                <TouchableOpacity
                  style={styles.closeInfoButton}
                  onPress={closeInfoModal}
                >
                  <Text style={styles.closeInfoButtonText}>Close</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </Modal>

          {/* Categories Modal */}
          <Modal
            transparent
            visible={showCategoriesModal}
            animationType="fade"
            onRequestClose={() => setShowCategoriesModal(false)}
          >
            <TouchableOpacity
              style={styles.modalOverlay}
              activeOpacity={1}
              onPressOut={() => setShowCategoriesModal(false)}
            >
              <View style={styles.modalPickerContent}>
                <Text style={styles.modalTitle}>Select a Category</Text>
                {AVAILABLE_CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={styles.modalOption}
                    onPress={() => {
                      setFormData((prev) => ({ ...prev, category: cat }));
                      setShowCategoriesModal(false);
                    }}
                  >
                    <Text style={styles.modalOptionText}>{cat}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </TouchableOpacity>
          </Modal>
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
};

export default AddGig;

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: "#000000", // Dark background
  },
  container: {
    flex: 1,
    padding: 20,
  },
  errorToast: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingVertical: 15,
    backgroundColor: "#FF6B6B",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
  },
  errorToastText: {
    color: "#fff",
    fontWeight: "700",
    textAlign: "center",
  },
  progressContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 30,
  },
  progressDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#424242",
    marginHorizontal: 5,
  },
  progressDotActive: {
    backgroundColor: "#BB86FC",
    transform: [{ scale: 1.2 }],
  },
  slideContainer: {
    marginBottom: 30,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#BB86FC",
    marginBottom: 20,
    textAlign: "center",
  },
  label: {
    fontSize: 16,
    color: "#BB86FC",
    marginBottom: 5,
  },
  infoLabelContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  input: {
    backgroundColor: "#1E1E1E",
    padding: 15,
    borderRadius: 12,
    fontSize: 16,
    color: "#fff",
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "#424242",
  },
  textArea: {
    height: 120,
    textAlignVertical: "top",
  },
  dropdown: {
    backgroundColor: "#1E1E1E",
    padding: 15,
    borderRadius: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#424242",
    marginBottom: 20,
  },
  dropdownText: {
    fontSize: 16,
    color: "#fff",
  },
  priceContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 15,
  },
  perHourText: {
    color: "#fff",
    fontSize: 16,
    marginLeft: 10,
  },
  toggleButton: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 15,
  },
  toggleText: {
    color: "#fff",
    fontSize: 16,
    marginLeft: 10,
  },
  uploadButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1E1E1E",
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
  },
  uploadButtonText: {
    color: "#BB86FC",
    fontSize: 16,
    marginLeft: 10,
  },
  imagesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 10,
  },
  imageContainer: {
    position: "relative",
    margin: 5,
  },
  image: {
    width: 80,
    height: 80,
    borderRadius: 10,
  },
  removeButton: {
    position: "absolute",
    top: -5,
    right: -5,
    backgroundColor: "#1E1E1E",
    borderRadius: 12,
    padding: 2,
  },
  optionalText: {
    color: "#888",
    fontSize: 12,
    marginTop: 5,
    textAlign: "center",
  },
  datePickerButton: {
    backgroundColor: "#1E1E1E",
    padding: 15,
    borderRadius: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#424242",
    marginBottom: 10,
  },
  datePickerText: {
    fontSize: 16,
    color: "#fff",
    flex: 1,
  },
  clearDateButton: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 15,
    marginTop: 5,
  },
  clearDateButtonText: {
    color: "#BB86FC",
    fontSize: 16,
    marginLeft: 8,
  },
  buttonContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 20,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  backButtonText: {
    color: "#aaa",
    fontSize: 16,
    fontWeight: "500",
  },
  nextButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#BB86FC",
    padding: 15,
    paddingHorizontal: 30,
    borderRadius: 12,
    gap: 10,
  },
  buttonDisabled: {
    backgroundColor: "#3A3A3A",
  },
  nextButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#1E1E1E",
    padding: 30,
    borderRadius: 15,
    alignItems: "center",
    gap: 15,
  },
  modalText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
  },
  infoModalContent: {
    backgroundColor: "#1E1E1E",
    padding: 20,
    borderRadius: 15,
    alignItems: "center",
    width: "80%",
  },
  infoModalText: {
    fontSize: 16,
    color: "#fff",
    marginBottom: 20,
    textAlign: "center",
  },
  closeInfoButton: {
    backgroundColor: "#BB86FC",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  closeInfoButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  modalPickerContent: {
    backgroundColor: "#1E1E1E",
    padding: 20,
    borderRadius: 15,
    width: "80%",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 20,
    textAlign: "center",
  },
  modalOption: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#424242",
  },
  modalOptionText: {
    fontSize: 16,
    color: "#fff",
  },
});
