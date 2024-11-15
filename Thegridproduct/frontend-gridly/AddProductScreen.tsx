// AddProduct.tsx

import React, { useState, useContext } from "react";
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
import * as ImageManipulator from "expo-image-manipulator";
import { NGROK_URL } from "@env"; // Ensure NGROK_URL is correctly set in your .env file
import { useNavigation } from "@react-navigation/native";
import { UserContext, StudentType } from "./UserContext"; // Ensure correct import
import axios from "axios";

interface Product {
  title: string;
  price?: number;
  outOfCampusPrice?: number;
  rentPrice?: number;
  rentDuration?: string;
  description: string;
  selectedTags: string[];
  availability: "In Campus Only" | "On and Off Campus";
  rating: number;
  listingType: "Selling" | "Renting" | "Both";
  isAvailableOutOfCampus: boolean;
  university: string;
  studentType: StudentType;
  images: string[];
}

interface FormData {
  images: string[]; // Will store image URLs
  title: string;
  price: string;
  outOfCampusPrice: string;
  rentPrice: string;
  rentDuration: string; // New Field for Rent Duration
  description: string;
  selectedTags: string[];
  availability: "In Campus Only" | "On and Off Campus";
  rating: number;
  listingType: "Selling" | "Renting" | "Both";
  isAvailableOutOfCampus: boolean;
}

const AddProduct: React.FC = () => {
  const navigation = useNavigation(); // Initialize navigation
  const { userId, token, institution, studentType } = useContext(UserContext); // Corrected destructuring

  const [step, setStep] = useState(1);
  const [slideAnim] = useState(new Animated.Value(0));

  const [formData, setFormData] = useState<FormData>({
    images: [],
    title: "",
    price: "",
    outOfCampusPrice: "",
    rentPrice: "",
    rentDuration: "", // Initialize Rent Duration
    description: "",
    selectedTags: [],
    availability: "In Campus Only",
    rating: 0,
    listingType: "Selling",
    isAvailableOutOfCampus: false,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isSuccessModalVisible, setIsSuccessModalVisible] = useState(false);
  const [isInfoModalVisible, setIsInfoModalVisible] = useState(false); // New State for Info Modal

  const availableTags = ["#FemaleClothing", "#MensClothing", "#Other"];

  // Replace with your Cloudinary credentials
  const CLOUDINARY_URL =
    "https://api.cloudinary.com/v1_1/ds0zpfht9/image/upload"; // Replace with your Cloudinary URL
  const UPLOAD_PRESET = "gridly_preset"; // Replace with your Upload Preset

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
    if (step < 4) {
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

  const pickImage = async () => {
    if (formData.images.length >= 3) {
      Alert.alert("Image Limit Reached", "You can only upload up to 3 images.");
      return;
    }
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true, // Ensure your Expo SDK version supports this
        quality: 0.7, // Compress the image to 70% quality
      });
      if (!result.canceled) {
        let selectedImages = result.assets.map((asset) => asset.uri);

        // Compress images
        const compressedImages = await Promise.all(
          selectedImages.map(async (uri) => {
            const manipulatedImage = await ImageManipulator.manipulateAsync(
              uri,
              [{ resize: { width: 800 } }], // Resize to width 800px
              { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
            );
            return manipulatedImage.uri;
          })
        );

        if (formData.images.length + compressedImages.length > 3) {
          Alert.alert(
            "Image Limit Exceeded",
            "You can only upload up to 3 images."
          );
          return;
        }

        // Upload each image to Cloudinary
        const uploadedImageUrls = await Promise.all(
          compressedImages.map(async (uri) => {
            const formData = new FormData();
            formData.append("file", {
              uri,
              type: "image/jpeg",
              name: `upload_${Date.now()}.jpg`,
            } as any);
            formData.append("upload_preset", UPLOAD_PRESET);

            try {
              const response = await axios.post(CLOUDINARY_URL, formData, {
                headers: {
                  "Content-Type": "multipart/form-data",
                },
                onUploadProgress: (progressEvent) => {
                  const progress =
                    (progressEvent.loaded / progressEvent.total) * 100;
                  console.log(`Upload Progress: ${progress.toFixed(2)}%`);
                },
              });

              const imageUrl = response.data.secure_url;
              console.log("Image uploaded successfully. URL:", imageUrl);
              return imageUrl;
            } catch (error) {
              console.error("Error uploading image to Cloudinary:", error);
              throw new Error("Image upload failed. Please try again.");
            }
          })
        );

        setFormData((prev) => ({
          ...prev,
          images: [...prev.images, ...uploadedImageUrls],
        }));
      }
    } catch (error) {
      console.error("Error picking/uploading images:", error);
      Alert.alert(
        "Image Picker Error",
        "There was an error selecting or uploading images. Please try again."
      );
    }
  };

  const removeImage = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));
  };

  const toggleTag = (tag: string) => {
    setFormData((prev) => ({
      ...prev,
      selectedTags: prev.selectedTags.includes(tag)
        ? prev.selectedTags.filter((t) => t !== tag)
        : [...prev.selectedTags, tag],
    }));
  };

  const setRatingValue = (rating: number) => {
    setFormData((prev) => ({ ...prev, rating }));
  };

  const validateCurrentStep = (): boolean => {
    switch (step) {
      case 1:
        return formData.images.length > 0 && formData.title.trim().length > 0;
      case 2:
        return formData.listingType.length > 0;
      case 3:
        // Validate for each listingType
        if (formData.listingType === "Selling") {
          return formData.selectedTags.length > 0 && formData.rating > 0;
        }
        if (formData.listingType === "Renting") {
          return (
            formData.selectedTags.length > 0 &&
            formData.availability === "In Campus Only" &&
            formData.rating > 0 &&
            formData.rentDuration.trim().length > 0
          );
        }
        if (formData.listingType === "Both") {
          return (
            formData.selectedTags.length > 0 &&
            formData.availability.length > 0 &&
            formData.rating > 0 &&
            formData.rentDuration.trim().length > 0
          );
        }
        return false;
      case 4:
        if (
          formData.listingType === "Selling" ||
          formData.listingType === "Both"
        ) {
          return (
            formData.price.trim().length > 0 &&
            (formData.listingType === "Both"
              ? formData.rentPrice.trim().length > 0
              : true) &&
            (formData.availability === "On and Off Campus"
              ? formData.outOfCampusPrice.trim().length > 0
              : true)
          );
        } else if (formData.listingType === "Renting") {
          return formData.rentPrice.trim().length > 0;
        }
        return false;
      default:
        return false;
    }
  };

  const handleSubmit = async () => {
    if (!userId || !token || !institution || !studentType) {
      // Added studentType check
      Alert.alert(
        "Submission Error",
        "User not logged in or incomplete profile."
      );
      return;
    }

    setIsLoading(true);

    try {
      console.log("Submitting Form Data:", formData); // Debugging log

      // Convert string inputs to numbers and validate
      const price = parseFloat(formData.price.trim());
      const outOfCampusPrice = parseFloat(formData.outOfCampusPrice.trim());
      const rentPrice = parseFloat(formData.rentPrice.trim());

      if (
        (formData.price && isNaN(price)) ||
        (formData.outOfCampusPrice && isNaN(outOfCampusPrice)) ||
        (formData.rentPrice && isNaN(rentPrice))
      ) {
        throw new Error("Please enter valid numerical values for prices.");
      }

      if (formData.selectedTags.length === 0)
        throw new Error("Tags cannot be empty.");
      if (formData.images.length === 0)
        throw new Error("Images cannot be empty.");

      const payload: Partial<Product> = {
        title: formData.title.trim(),
        price:
          formData.listingType === "Both" || formData.listingType === "Selling"
            ? price
            : undefined,
        outOfCampusPrice:
          formData.availability === "On and Off Campus"
            ? outOfCampusPrice
            : undefined,
        rentPrice:
          formData.listingType === "Both" || formData.listingType === "Renting"
            ? rentPrice
            : undefined,
        rentDuration:
          formData.listingType === "Both" || formData.listingType === "Renting"
            ? formData.rentDuration.trim()
            : undefined,
        description: formData.description.trim(),
        selectedTags: formData.selectedTags,
        images: formData.images, // Now contains URLs
        isAvailableOutOfCampus: formData.isAvailableOutOfCampus,
        rating: formData.rating,
        listingType: formData.listingType,
        availability: formData.availability,
        university: institution, // Ensure backend expects 'university'
        studentType: studentType, // Ensure backend accepts enum or string
      };

      const response = await fetch(`${NGROK_URL}/products`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const contentType = response.headers.get("content-type");

      // Check if response is JSON, if not log and throw an error
      if (contentType && contentType.includes("application/json")) {
        const data = await response.json();
        if (!response.ok) {
          throw new Error(
            data.message || `HTTP error! status: ${response.status}`
          );
        }
        console.log("Success:", data);

        setFormData({
          images: [],
          title: "",
          price: "",
          outOfCampusPrice: "",
          rentPrice: "",
          rentDuration: "",
          description: "",
          selectedTags: [],
          availability: "In Campus Only",
          rating: 0,
          listingType: "Selling",
          isAvailableOutOfCampus: false,
        });
        setIsSuccessModalVisible(true);

        setTimeout(() => {
          setIsSuccessModalVisible(false);
          navigation.navigate("Dashboard");
        }, 1500);
      } else {
        const errorText = await response.text(); // Read response as text
        console.error("Unexpected response format:", errorText); // Log unexpected format
        throw new Error("Unexpected response format. Expected JSON.");
      }
    } catch (error: unknown) {
      console.error("Error:", error);
      Alert.alert(
        "Submission Error",
        error instanceof Error ? error.message : "An unknown error occurred."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const slides = {
    1: {
      title: "Upload Images & Enter Title",
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
      title: "Choose Listing Type",
      content: (
        <>
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Listing Type</Text>
            <View style={styles.optionsContainer}>
              {["Selling", "Renting", "Both"].map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.optionButton,
                    formData.listingType === type
                      ? styles.optionButtonSelected
                      : null,
                  ]}
                  onPress={() =>
                    setFormData({
                      ...formData,
                      listingType: type as "Selling" | "Renting" | "Both",
                      availability:
                        type === "Renting"
                          ? "In Campus Only"
                          : formData.availability,
                      // Reset related fields when listingType changes
                      outOfCampusPrice: "",
                      rentPrice: "",
                      isAvailableOutOfCampus:
                        type === "Both" || type === "On and Off Campus"
                          ? formData.isAvailableOutOfCampus
                          : false,
                      rentDuration: "", // Reset Rent Duration on Type Change
                      rating: 0, // Reset Rating on Type Change
                    })
                  }
                >
                  <Text
                    style={[
                      styles.optionText,
                      formData.listingType === type
                        ? styles.optionTextSelected
                        : null,
                    ]}
                  >
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {formData.listingType === "Renting" && (
              <Text style={styles.noteText}>
                Renting is available for In Campus only.
              </Text>
            )}
          </View>
        </>
      ),
    },
    3: {
      title: "Select Tags, Availability & Rent Details",
      content: (
        <>
          {/* Select Tags Section */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Select Tags</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {availableTags.map((tag) => (
                <TouchableOpacity
                  key={tag}
                  style={[
                    styles.tag,
                    formData.selectedTags.includes(tag)
                      ? styles.tagSelected
                      : null,
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
          </View>

          {/* Availability Section */}
          {formData.listingType !== "Renting" && (
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionTitle}>Availability</Text>
              <View style={styles.optionsContainer}>
                {["In Campus Only", "On and Off Campus"].map((option) => (
                  <TouchableOpacity
                    key={option}
                    style={[
                      styles.optionButton,
                      formData.availability === option
                        ? styles.optionButtonSelected
                        : null,
                    ]}
                    onPress={() =>
                      setFormData({
                        ...formData,
                        availability: option as
                          | "In Campus Only"
                          | "On and Off Campus",
                        isAvailableOutOfCampus: option === "On and Off Campus",
                      })
                    }
                  >
                    <Text
                      style={[
                        styles.optionText,
                        formData.availability === option
                          ? styles.optionTextSelected
                          : null,
                      ]}
                    >
                      {option}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.noteText}>
                {formData.availability === "On and Off Campus"
                  ? "For off-campus, include shipping fees in your price. In-campus transactions can be handled directly with the buyer."
                  : "In-campus availability allows for direct transactions without additional shipping costs."}
              </Text>
            </View>
          )}

          {/* Rent Duration Section */}
          {(formData.listingType === "Renting" ||
            formData.listingType === "Both") && (
            <View style={styles.sectionContainer}>
              <View style={styles.rentDurationHeader}>
                <Text style={styles.sectionTitle}>Rent Duration</Text>
                <TouchableOpacity
                  onPress={() => setIsInfoModalVisible(true)}
                  style={styles.infoButton}
                >
                  <Ionicons
                    name="information-circle-outline"
                    size={24}
                    color="#BB86FC"
                  />
                </TouchableOpacity>
              </View>
              <TextInput
                style={styles.input}
                placeholder="e.g., 1 Month, 6 Months"
                placeholderTextColor="#888"
                value={formData.rentDuration}
                onChangeText={(text) =>
                  setFormData({ ...formData, rentDuration: text })
                }
              />
            </View>
          )}

          {/* Rate Quality Section */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Rate Quality</Text>
            <View style={styles.ratingContainer}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity
                  key={star}
                  onPress={() => setRatingValue(star)}
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
          </View>
        </>
      ),
    },
    4: {
      title: "Enter Prices & Description",
      content: (
        <>
          {/* Conditionally Render Price Inputs Based on Listing Type */}
          {(formData.listingType === "Selling" ||
            formData.listingType === "Both") && (
            <TextInput
              style={styles.input}
              placeholder={`Price (In Campus${
                formData.listingType === "Both" ? " Selling" : ""
              }) $`}
              placeholderTextColor="#888"
              keyboardType="numeric"
              value={formData.price}
              onChangeText={(text) => setFormData({ ...formData, price: text })}
            />
          )}

          {(formData.listingType === "Renting" ||
            formData.listingType === "Both") && (
            <TextInput
              style={styles.input}
              placeholder="Renting Price (In Campus Only) $"
              placeholderTextColor="#888"
              keyboardType="numeric"
              value={formData.rentPrice}
              onChangeText={(text) =>
                setFormData({ ...formData, rentPrice: text })
              }
            />
          )}

          {formData.listingType === "Both" &&
            formData.availability === "On and Off Campus" && (
              <TextInput
                style={styles.input}
                placeholder="Off-Campus Price (with Shipping) $"
                placeholderTextColor="#888"
                keyboardType="numeric"
                value={formData.outOfCampusPrice}
                onChangeText={(text) =>
                  setFormData({ ...formData, outOfCampusPrice: text })
                }
              />
            )}

          <TextInput
            style={[styles.input, styles.descriptionInput]}
            placeholder="Description"
            placeholderTextColor="#888"
            multiline
            value={formData.description}
            onChangeText={(text) =>
              setFormData({ ...formData, description: text })
            }
          />
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
        {[1, 2, 3, 4].map((s) => (
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
            (!validateCurrentStep() || isLoading) && styles.buttonDisabled,
          ]}
          onPress={handleNext}
          disabled={!validateCurrentStep() || isLoading}
        >
          {isLoading && step === 4 ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Text style={styles.nextButtonText}>
                {step === 4 ? "Add Product" : "Next"}
              </Text>
              {step < 4 && (
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
            <Text style={styles.modalText}>Product Posted Successfully!</Text>
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
              Upon the money transfer, the specified rent duration is the period
              the renter has to use and return the product.
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

export default AddProduct;

// Stylesheet
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#BB86FC",
    marginBottom: 15,
    marginTop: 20,
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
  noteText: {
    fontSize: 14,
    color: "#bbb",
    marginTop: 10,
    textAlign: "center",
  },
  rentDurationHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  infoButton: {
    padding: 5,
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
