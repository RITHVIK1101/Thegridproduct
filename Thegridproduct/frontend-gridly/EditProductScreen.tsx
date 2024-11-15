// EditProduct.tsx

import React, { useEffect, useState, useContext } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  TextInput,
  ScrollView,
  Alert,
  Modal,
  Animated,
  ActivityIndicator,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import * as ImagePicker from "expo-image-picker";
import { StackNavigationProp } from "@react-navigation/stack";
import { RouteProp } from "@react-navigation/native";
import { RootStackParamList } from "./navigationTypes";
import { NGROK_URL } from "@env";
import { UserContext } from "./UserContext"; // Import UserContext
import { storage } from "./firebaseConfig"; // Firebase storage
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import * as ImageManipulator from "expo-image-manipulator";

interface FormData {
  images: string[];
  title: string;
  price: string;
  outOfCampusPrice: string;
  rentPrice: string;
  description: string;
  selectedTags: string[];
  availability: "In Campus Only" | "On and Off Campus";
  rating: number;
  listingType: "Selling" | "Renting" | "Both";
  isAvailableOutOfCampus: boolean;
}

type EditProductScreenRouteProp = RouteProp<RootStackParamList, "EditProduct">;

type EditProductScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  "EditProduct"
>;

type Props = {
  route: EditProductScreenRouteProp;
  navigation: EditProductScreenNavigationProp;
};

const EditProduct: React.FC<Props> = ({ route, navigation }) => {
  const { productId } = route.params;

  const { userId, token } = useContext(UserContext); // Get userId and token from context

  const [formData, setFormData] = useState<FormData>({
    images: [],
    title: "",
    price: "",
    outOfCampusPrice: "",
    rentPrice: "",
    description: "",
    selectedTags: [],
    availability: "In Campus Only",
    rating: 0,
    listingType: "Selling",
    isAvailableOutOfCampus: false,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState(1);
  const [slideAnim] = useState(new Animated.Value(0));
  const [isSuccessModalVisible, setIsSuccessModalVisible] = useState(false);
  const [isInfoModalVisible, setIsInfoModalVisible] = useState(false);

  const availableTags = [
    "#Electronics",
    "#FemaleClothing",
    "#MensClothing",
    "#Books",
    "#HomeAppliances",
    "#Furniture",
    "#Toys",
    "#Accessories",
    "#Sports",
    "#Beauty",
  ];

  /**
   * Function to upload image and get URL
   */
  const uploadImageAsync = async (uri: string): Promise<string> => {
    try {
      // Compress the image
      const compressedImage = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 800 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
      );

      const response = await fetch(compressedImage.uri);
      const blob = await response.blob();

      const uniqueId = `${userId}-${Date.now()}`;
      const storageRef = ref(storage, `products/${uniqueId}`);

      await uploadBytes(storageRef, blob);

      const downloadURL = await getDownloadURL(storageRef);
      return downloadURL;
    } catch (error) {
      console.error("Error uploading image:", error);
      throw new Error("Image upload failed.");
    }
  };

  /**
   * Function to delete image from Firebase Storage
   */
  const deleteImageAsync = async (imageUrl: string) => {
    try {
      const imageRef = ref(storage, imageUrl);
      await deleteObject(imageRef);
    } catch (error) {
      console.error("Error deleting image:", error);
      // Optionally, inform the user
    }
  };

  useEffect(() => {
    const fetchProduct = async () => {
      if (!token) {
        setError("User not authenticated.");
        setLoading(false);
        return;
      }

      console.log("Fetching product with ID:", productId);

      if (!productId || productId.length !== 24) {
        setError("Invalid product ID format.");
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`${NGROK_URL}/products/${productId}`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });

        const contentType = response.headers.get("content-type");

        if (!response.ok) {
          // Log the full response for debugging
          const errorText = await response.text();
          console.error("Error response text:", errorText);
          throw new Error(
            "Failed to fetch product data. Server responded with an error."
          );
        } else if (!contentType || !contentType.includes("application/json")) {
          // Log unexpected content type and response body
          const errorText = await response.text();
          console.error("Unexpected content-type:", contentType);
          console.error("Response text:", errorText);
          throw new Error("Received unexpected content type. Expected JSON.");
        }

        const productData = await response.json();
        console.log("Fetched product data:", productData);

        setFormData({
          images: productData.images || [],
          title: productData.title || "",
          price: productData.price ? productData.price.toString() : "",
          outOfCampusPrice: productData.outOfCampusPrice
            ? productData.outOfCampusPrice.toString()
            : "",
          rentPrice: productData.rentPrice
            ? productData.rentPrice.toString()
            : "",
          description: productData.description || "",
          selectedTags: productData.selectedTags || [],
          availability: productData.isAvailableOutOfCampus
            ? "On and Off Campus"
            : "In Campus Only",
          rating: productData.rating || 0,
          listingType: productData.listingType || "Selling",
          isAvailableOutOfCampus: productData.isAvailableOutOfCampus || false,
        });
      } catch (err) {
        console.error("Error fetching product data:", err);
        setError(
          err instanceof Error ? err.message : "Failed to load product data."
        );
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [productId, token]);

  const toggleTag = (tag: string) => {
    setFormData((prevData) => {
      const isSelected = prevData.selectedTags.includes(tag);
      const selectedTags = isSelected
        ? prevData.selectedTags.filter((t) => t !== tag)
        : [...prevData.selectedTags, tag];
      return { ...prevData, selectedTags };
    });
  };

  const pickImage = async () => {
    if (formData.images.length >= 3) {
      Alert.alert("Image Limit Reached", "You can only upload up to 3 images.");
      return;
    }
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: false, // Expo ImagePicker doesn't support multiple selection by default
        quality: 1,
      });

      if (!result.canceled) {
        const newImageUri = result.assets[0].uri;

        // Upload the image and get the URL
        const uploadedImageUrl = await uploadImageAsync(newImageUri);

        setFormData((prevData) => ({
          ...prevData,
          images: [...prevData.images, uploadedImageUrl].slice(0, 3),
        }));
      }
    } catch (error) {
      console.error("Error picking/uploading image:", error);
      Alert.alert(
        "Image Picker Error",
        "There was an error selecting or uploading the image. Please try again."
      );
    }
  };

  const handleSubmit = async () => {
    if (!token) {
      Alert.alert("Submission Error", "User not authenticated.");
      return;
    }

    setIsSubmitting(true);
    try {
      const priceNumber = parseFloat(formData.price);
      const outOfCampusPriceNumber = parseFloat(formData.outOfCampusPrice);
      const rentPriceNumber = parseFloat(formData.rentPrice);

      // Validate numerical fields
      if (
        (formData.price && isNaN(priceNumber)) ||
        (formData.outOfCampusPrice && isNaN(outOfCampusPriceNumber)) ||
        (formData.rentPrice && isNaN(rentPriceNumber))
      ) {
        throw new Error("Please enter valid numerical values for prices.");
      }

      // Validate required fields
      if (
        !formData.title.trim() ||
        !formData.description.trim() ||
        formData.selectedTags.length === 0 ||
        formData.images.length === 0
      ) {
        throw new Error("Please fill in all required fields.");
      }

      // Prepare the payload
      const payload: any = {
        title: formData.title.trim(),
        price: priceNumber,
        description: formData.description.trim(),
        selectedTags: formData.selectedTags,
        images: formData.images,
        isAvailableOutOfCampus: formData.isAvailableOutOfCampus,
        rating: formData.rating,
        // listingType and availability are not editable
      };

      if (
        formData.listingType === "Both" ||
        formData.listingType === "Renting"
      ) {
        payload.rentPrice = rentPriceNumber;
        // If you have a rentDuration field, include it here
        // payload.rentDuration = formData.rentDuration.trim();
      }

      if (formData.availability === "On and Off Campus") {
        payload.outOfCampusPrice = outOfCampusPriceNumber;
      }

      // Make the PUT request to update the product
      const response = await fetch(`${NGROK_URL}/products/${productId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`, // Include JWT token
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to update product.");
      }

      setIsSuccessModalVisible(true);

      setTimeout(() => {
        setIsSuccessModalVisible(false);
        navigation.goBack();
      }, 1500);
    } catch (err) {
      console.error("Error updating product:", err);
      if (err instanceof Error) {
        Alert.alert("Error", err.message);
      } else {
        Alert.alert("Error", "Failed to update product. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Function to delete an image from both storage and formData
  const handleRemoveImage = async (index: number) => {
    const imageUrl = formData.images[index];
    // Delete image from Firebase Storage
    await deleteImageAsync(imageUrl);
    // Remove image from formData
    setFormData((prevData) => ({
      ...prevData,
      images: prevData.images.filter((_, i) => i !== index),
    }));
  };

  // Animation Functions
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

  const handleNext = () => {
    if (step < 3) {
      animateSlide("forward");
      setStep(step + 1);
    } else {
      handleSubmit();
    }
  };

  const handleBack = () => {
    if (step > 1) {
      animateSlide("backward");
      setStep(step - 1);
    }
  };

  const validateCurrentStep = (): boolean => {
    switch (step) {
      case 1:
        return formData.images.length > 0 && formData.title.trim().length > 0;
      case 2:
        return (
          formData.description.trim().length > 0 &&
          formData.selectedTags.length > 0 &&
          formData.rating > 0
        );
      case 3:
        return true; // Final step, no validation needed here
      default:
        return false;
    }
  };

  const slides = {
    1: {
      title: "Edit Images & Title",
      content: (
        <>
          <Text style={styles.imageCounter}>
            {`${formData.images.length}/3 Images`}
          </Text>
          <View style={styles.imageUploadContainer}>
            <TouchableOpacity style={styles.uploadButton} onPress={pickImage}>
              <Ionicons name="cloud-upload-outline" size={30} color="#BB86FC" />
              <Text style={styles.uploadButtonText}>Upload Images</Text>
            </TouchableOpacity>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {formData.images.map((image, index) => (
                <View key={index} style={styles.imageContainer}>
                  <Image source={{ uri: image }} style={styles.image} />
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => handleRemoveImage(index)}
                  >
                    <Ionicons name="close-circle-outline" size={24} color="#FF0000" />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          </View>
          <TextInput
            style={styles.input}
            placeholder="Product Title"
            placeholderTextColor="#888"
            value={formData.title}
            onChangeText={(text) => setFormData({ ...formData, title: text })}
          />
        </>
      ),
    },
    2: {
      title: "Edit Description & Tags",
      content: (
        <>
          {/* Description */}
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.descriptionInput]}
            placeholder="Enter product description"
            placeholderTextColor="#888"
            multiline
            value={formData.description}
            onChangeText={(text) =>
              setFormData({ ...formData, description: text })
            }
          />

          {/* Select Tags */}
          <Text style={styles.label}>Select Tags</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {availableTags.map((tag) => (
              <TouchableOpacity
                key={tag}
                style={[
                  styles.tag,
                  formData.selectedTags.includes(tag) ? styles.tagSelected : null,
                ]}
                onPress={() => toggleTag(tag)}
              >
                <Text
                  style={[
                    styles.tagText,
                    formData.selectedTags.includes(tag)
                      ? styles.tagTextSelected
                      : null,
                  ]}
                >
                  {tag}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Rating */}
          <Text style={styles.label}>Rate Quality</Text>
          <View style={styles.ratingContainer}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity
                key={star}
                onPress={() => setFormData({ ...formData, rating: star })}
              >
                <Ionicons
                  name="star"
                  size={30}
                  color={formData.rating >= star ? "#FFD700" : "#ccc"}
                />
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.ratingDescription}>
            {formData.rating === 1
              ? "Poor"
              : formData.rating === 2
              ? "Fair"
              : formData.rating === 3
              ? "Good"
              : formData.rating === 4
              ? "Very Good"
              : formData.rating === 5
              ? "Excellent"
              : "Select a rating"}
          </Text>
        </>
      ),
    },
    3: {
      title: "Edit Pricing & Info",
      content: (
        <>
          {/* Listing Type (Non-Editable) */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Listing Type</Text>
            <View style={styles.infoContainer}>
              <Text style={styles.infoText}>{formData.listingType}</Text>
            </View>
            <Text style={styles.noteText}>
              Listing type cannot be changed. To modify it, please delete the product and create a new one.
            </Text>
          </View>

          {/* Availability (Non-Editable) */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Availability</Text>
            <View style={styles.infoContainer}>
              <Text style={styles.infoText}>{formData.availability}</Text>
            </View>
            <Text style={styles.noteText}>
              Availability cannot be changed. To modify it, please delete the product and create a new one.
            </Text>
          </View>

          {/* Price */}
          {(formData.listingType === "Selling" ||
            formData.listingType === "Both") && (
            <>
              <Text style={styles.label}>Price</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter price"
                placeholderTextColor="#888"
                keyboardType="numeric"
                value={formData.price}
                onChangeText={(text) => setFormData({ ...formData, price: text })}
              />
            </>
          )}

          {/* Rent Price */}
          {(formData.listingType === "Renting" ||
            formData.listingType === "Both") && (
            <>
              <Text style={styles.label}>Rent Price</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter rent price"
                placeholderTextColor="#888"
                keyboardType="numeric"
                value={formData.rentPrice}
                onChangeText={(text) =>
                  setFormData({ ...formData, rentPrice: text })
                }
              />
            </>
          )}

          {/* Out of Campus Price */}
          {formData.availability === "On and Off Campus" && (
            <>
              <Text style={styles.label}>Off-Campus Price (with Shipping)</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter off-campus price"
                placeholderTextColor="#888"
                keyboardType="numeric"
                value={formData.outOfCampusPrice}
                onChangeText={(text) =>
                  setFormData({ ...formData, outOfCampusPrice: text })
                }
              />
            </>
          )}
        </>
      ),
    },
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 40 }}
    >
      {/* Progress Dots */}
      <View style={styles.progressContainer}>
        {[1, 2, 3].map((s) => (
          <View
            key={s}
            style={[
              styles.progressDot,
              s <= step ? styles.progressDotActive : null,
            ]}
          />
        ))}
      </View>

      {/* Animated Slide */}
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
          {slides[step as keyof typeof slides].title}
        </Text>
        {slides[step as keyof typeof slides].content}
      </Animated.View>

      {/* Navigation Buttons */}
      <View style={styles.buttonContainer}>
        {step > 1 && (
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Ionicons name="arrow-back" size={24} color="#aaa" />
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[
            styles.nextButton,
            (!validateCurrentStep() || isSubmitting) && styles.buttonDisabled,
          ]}
          onPress={handleNext}
          disabled={!validateCurrentStep() || isSubmitting}
        >
          {isSubmitting && step === 3 ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Text style={styles.nextButtonText}>
                {step === 3 ? "Save Changes" : "Next"}
              </Text>
              {step < 3 && (
                <Ionicons name="arrow-forward" size={24} color="#fff" />
              )}
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Success Modal */}
      <Modal transparent visible={isSuccessModalVisible} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Ionicons name="checkmark-circle" size={60} color="#9C27B0" />
            <Text style={styles.modalText}>Product Updated Successfully!</Text>
          </View>
        </View>
      </Modal>

      {/* Information Modal */}
      <Modal transparent visible={isInfoModalVisible} animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPressOut={() => setIsInfoModalVisible(false)}
        >
          <View style={styles.infoModalContent}>
            <Text style={styles.infoModalText}>
              Availability and Listing Type cannot be changed once the product is created. To modify these, please delete the current product and create a new one.
            </Text>
            <TouchableOpacity
              style={styles.closeInfoButton}
              onPress={() => setIsInfoModalVisible(false)}
            >
              <Text style={styles.closeInfoButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </ScrollView>
  );
};

export default EditProduct;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
    padding: 20,
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
  },
  imageCounter: {
    fontSize: 14,
    color: "#ccc",
    marginBottom: 10,
  },
  imageUploadContainer: {
    marginBottom: 20,
  },
  uploadButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 15,
    backgroundColor: "#1E1E1E",
    borderRadius: 10,
    marginBottom: 10,
  },
  uploadButtonText: {
    fontSize: 16,
    color: "#BB86FC",
    marginLeft: 10,
  },
  imageContainer: {
    position: "relative",
    marginRight: 10,
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
  input: {
    backgroundColor: "#1E1E1E",
    padding: 15,
    borderRadius: 12,
    marginBottom: 15,
    fontSize: 16,
    color: "#fff",
    borderWidth: 1,
    borderColor: "#424242",
  },
  descriptionInput: {
    height: 100,
    textAlignVertical: "top",
  },
  label: {
    color: "#BB86FC",
    fontSize: 16,
    marginBottom: 5,
    marginTop: 15,
  },
  tag: {
    paddingVertical: 8,
    paddingHorizontal: 15,
    backgroundColor: "#1E1E1E",
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 1,
    borderColor: "#424242",
  },
  tagSelected: {
    backgroundColor: "#BB86FC",
    borderColor: "#BB86FC",
  },
  tagText: {
    fontSize: 14,
    color: "#ccc",
  },
  tagTextSelected: {
    color: "#fff",
  },
  availabilityContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },
  availabilityButton: {
    flex: 1,
    padding: 15,
    borderRadius: 10,
    backgroundColor: "#1E1E1E",
    alignItems: "center",
    marginRight: 10,
  },
  availabilitySelected: {
    backgroundColor: "#BB86FC",
  },
  availabilityText: {
    color: "#ccc",
    fontSize: 16,
  },
  availabilityTextSelected: {
    color: "#fff",
  },
  listingTypeContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },
  listingTypeButton: {
    flex: 1,
    padding: 15,
    borderRadius: 10,
    backgroundColor: "#1E1E1E",
    alignItems: "center",
    marginRight: 10,
  },
  listingTypeSelected: {
    backgroundColor: "#BB86FC",
  },
  listingTypeText: {
    color: "#ccc",
    fontSize: 16,
  },
  listingTypeTextSelected: {
    color: "#fff",
  },
  ratingContainer: {
    flexDirection: "row",
    gap: 5,
    justifyContent: "center",
    marginVertical: 10,
  },
  ratingDescription: {
    textAlign: "center",
    color: "#ccc",
    fontSize: 14,
    marginTop: 5,
  },
  sectionContainer: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#BB86FC",
    marginBottom: 15,
    marginTop: 20,
  },
  optionsContainer: {
    flexDirection: "row",
    gap: 15,
    marginBottom: 15,
  },
  optionButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: 15,
    borderRadius: 12,
    backgroundColor: "#1E1E1E",
    gap: 10,
    flex: 1,
    justifyContent: "center",
  },
  optionButtonSelected: {
    backgroundColor: "#BB86FC",
  },
  optionText: {
    fontSize: 16,
    color: "#ccc",
    fontWeight: "500",
  },
  optionTextSelected: {
    color: "#fff",
  },
  infoContainer: {
    backgroundColor: "#1E1E1E",
    padding: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#424242",
    marginBottom: 10,
  },
  infoText: {
    color: "#ccc",
    fontSize: 16,
  },
  noteText: {
    fontSize: 14,
    color: "#bbb",
    marginTop: 10,
    textAlign: "center",
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 20,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: 15,
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
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
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
});
