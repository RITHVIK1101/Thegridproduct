// AddProduct.tsx

import React, { useState, useContext, useRef } from "react";
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
  Keyboard,
  TouchableWithoutFeedback,
  Easing,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { NGROK_URL } from "@env";
import { useNavigation } from "@react-navigation/native";
import { UserContext, StudentType } from "./UserContext";
import axios from "axios";

type DurationUnit = "Hours" | "Days" | "Weeks" | "Months";
type ListingType = "Selling" | "Renting" | "Both";
type Availability = "In Campus Only" | "On and Off Campus";
type Condition = "New" | "Used";

const availableTags = ["#FemaleClothing", "#MensClothing", "#Other"] as const;
const durationUnits: DurationUnit[] = ["Hours", "Days", "Weeks", "Months"];
const listingTypes: ListingType[] = ["Selling", "Renting", "Both"];
const conditions: Condition[] = ["New", "Used"];

interface Product {
  title: string;
  price?: number;
  outOfCampusPrice?: number;
  rentPrice?: number;
  rentDuration?: string;
  description: string;
  selectedTags: string[];
  availability: Availability;
  rating?: number;
  listingType: ListingType;
  isAvailableOutOfCampus: boolean;
  university: string;
  studentType: StudentType;
  images: string[];
  condition?: Condition;
  durationUnit?: DurationUnit;
}

interface FormData {
  condition?: Condition;
  durationUnit?: DurationUnit;
  images: string[];
  title: string;
  price: string;
  outOfCampusPrice: string;
  rentPrice: string;
  rentDuration: string;
  description: string;
  selectedTags: string[];
  availability: Availability;
  rating: number;
  listingType: ListingType;
  isAvailableOutOfCampus: boolean;
}

const AddProduct: React.FC = () => {
  const navigation = useNavigation();
  const { userId, token, institution, studentType } = useContext(UserContext);

  const [step, setStep] = useState(1);
  const [slideAnim] = useState(new Animated.Value(0));

  const [formData, setFormData] = useState<FormData>({
    images: [],
    title: "",
    price: "",
    outOfCampusPrice: "",
    rentPrice: "",
    rentDuration: "",
    durationUnit: undefined,
    description: "",
    selectedTags: [],
    availability: "In Campus Only",
    rating: 0,
    listingType: "Selling",
    isAvailableOutOfCampus: false,
    condition: undefined,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isSuccessModalVisible, setIsSuccessModalVisible] = useState(false);
  const [isInfoModalVisible, setIsInfoModalVisible] = useState(false);

  // Error Toast State
  const [errorMessage, setErrorMessage] = useState("");
  const errorOpacity = useRef(new Animated.Value(0)).current;

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

  const CLOUDINARY_URL = "https://api.cloudinary.com/v1_1/ds0zpfht9/image/upload";
  const UPLOAD_PRESET = "gridly_preset";

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
    if (!validateCurrentStep()) return;
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
      showError("You can only upload up to 3 images.");
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.7,
      });

      if (!result.canceled) {
        let selectedImages = result.assets.map((asset) => asset.uri);

        setIsUploadingImage(true);

        const compressedImages = await Promise.all(
          selectedImages.map(async (uri) => {
            const manipulatedImage = await ImageManipulator.manipulateAsync(
              uri,
              [{ resize: { width: 800 } }],
              { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
            );
            return manipulatedImage.uri;
          })
        );

        if (formData.images.length + compressedImages.length > 3) {
          showError("You can only upload up to 3 images.");
          setIsUploadingImage(false);
          return;
        }

        const uploadedImageUrls = await Promise.all(
          compressedImages.map(async (uri) => {
            const formDataImage = new FormData();
            formDataImage.append("file", {
              uri,
              type: "image/jpeg",
              name: `upload_${Date.now()}.jpg`,
            } as any);
            formDataImage.append("upload_preset", UPLOAD_PRESET);

            try {
              const response = await axios.post(CLOUDINARY_URL, formDataImage, {
                headers: {
                  "Content-Type": "multipart/form-data",
                },
              });

              const imageUrl = response.data.secure_url;
              return imageUrl;
            } catch (error) {
              console.error("Error uploading image:", error);
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
      console.error("Image Picker Error:", error);
      showError("Error selecting or uploading images. Please try again.");
    } finally {
      setIsUploadingImage(false);
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
        if (formData.images.length === 0) {
          showError("Please upload at least one image.");
          return false;
        }
        if (!formData.title.trim()) {
          showError("Please enter a product title.");
          return false;
        }
        return true;
      case 2:
        if (!listingTypes.includes(formData.listingType)) {
          showError("Please select a valid listing type.");
          return false;
        }
        return true;
      case 3:
        if (formData.selectedTags.length === 0) {
          showError("Please select at least one tag.");
          return false;
        }

        if (formData.listingType === "Selling") {
          if (formData.rating === 0 && formData.condition === "Used") {
            showError("Please rate the product if it's used.");
            return false;
          }
        }

        if (
          formData.listingType === "Renting" ||
          formData.listingType === "Both"
        ) {
          if (!formData.condition) {
            showError("Please specify if the product is New or Used.");
            return false;
          }

          if (!formData.rentDuration.trim()) {
            showError("Please enter a rent duration.");
            return false;
          }
          if (!formData.durationUnit) {
            showError("Please select a rent duration unit.");
            return false;
          }
        }
        return true;
      case 4:
        if (
          (formData.listingType === "Selling" ||
            formData.listingType === "Both") &&
          !formData.price.trim()
        ) {
          showError("Please enter a price for selling.");
          return false;
        }

        if (
          (formData.listingType === "Renting" ||
            formData.listingType === "Both") &&
          !formData.rentPrice.trim()
        ) {
          showError("Please enter a rent price.");
          return false;
        }

        if (
          formData.listingType === "Both" &&
          formData.availability === "On and Off Campus" &&
          !formData.outOfCampusPrice.trim()
        ) {
          showError("Please enter an off-campus price.");
          return false;
        }

        return true;
      default:
        return false;
    }
  };

  const handleSubmit = async () => {
    if (!userId || !token || !institution || !studentType) {
      showError("User not logged in or incomplete profile.");
      return;
    }

    setIsLoading(true);

    try {
      const price = formData.price ? parseFloat(formData.price.trim()) : undefined;
      const outOfCampusPrice = formData.outOfCampusPrice
        ? parseFloat(formData.outOfCampusPrice.trim())
        : undefined;
      const rentPrice = formData.rentPrice
        ? parseFloat(formData.rentPrice.trim())
        : undefined;

      if (
        (formData.price && (isNaN(price!) || price! < 0)) ||
        (formData.outOfCampusPrice &&
          (isNaN(outOfCampusPrice!) || outOfCampusPrice! < 0)) ||
        (formData.rentPrice && (isNaN(rentPrice!) || rentPrice! < 0))
      ) {
        throw new Error("Please enter valid numerical values for prices.");
      }

      if (formData.selectedTags.length === 0)
        throw new Error("Tags cannot be empty.");
      if (formData.images.length === 0)
        throw new Error("Images cannot be empty.");

      if (
        formData.listingType === "Both" &&
        formData.availability !== "On and Off Campus"
      ) {
        throw new Error(
          "Availability must be 'On and Off Campus' for listing type 'Both'."
        );
      }

      if (
        formData.listingType === "Renting" &&
        formData.availability !== "In Campus Only"
      ) {
        throw new Error(
          "Availability must be 'In Campus Only' for listing type 'Renting'."
        );
      }

      const payload: Partial<Product> = {
        title: formData.title.trim(),
        ...(price !== undefined ? { price } : {}),
        ...(outOfCampusPrice !== undefined ? { outOfCampusPrice } : {}),
        ...(rentPrice !== undefined ? { rentPrice } : {}),
        ...(formData.listingType === "Both" ||
        formData.listingType === "Renting"
          ? {
              rentDuration: `${formData.rentDuration.trim()} ${
                formData.durationUnit
              }`,
            }
          : {}),
        description: formData.description.trim(),
        selectedTags: formData.selectedTags,
        images: formData.images,
        isAvailableOutOfCampus: formData.isAvailableOutOfCampus,
        ...(formData.listingType === "Selling" ||
        formData.listingType === "Both"
          ? { rating: formData.rating }
          : {}),
        listingType: formData.listingType,
        availability: formData.availability,
        university: institution,
        studentType: studentType,
        condition: formData.condition,
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

      if (contentType && contentType.includes("application/json")) {
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.message || `HTTP error! status: ${response.status}`);
        }
        setFormData({
          images: [],
          title: "",
          price: "",
          outOfCampusPrice: "",
          rentPrice: "",
          rentDuration: "",
          durationUnit: undefined,
          description: "",
          selectedTags: [],
          availability: "In Campus Only",
          condition: undefined,
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
        const errorText = await response.text();
        console.error("Unexpected response:", errorText);
        throw new Error("Unexpected response format. Expected JSON.");
      }
    } catch (error: unknown) {
      console.error("Error:", error);
      showError(
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
            <TouchableOpacity
              style={styles.uploadButton}
              onPress={pickImage}
              disabled={isUploadingImage}
            >
              {isUploadingImage ? (
                <ActivityIndicator size="small" color="#BB86FC" />
              ) : (
                <>
                  <Ionicons
                    name="cloud-upload-outline"
                    size={30}
                    color="#BB86FC"
                  />
                  <Text style={styles.uploadButtonText}>Upload Images</Text>
                </>
              )}
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
              {listingTypes.map((type) => (
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
                      listingType: type,
                      availability:
                        type === "Renting"
                          ? "In Campus Only"
                          : formData.availability,
                      outOfCampusPrice: "",
                      rentPrice: "",
                      isAvailableOutOfCampus:
                        type === "Both"
                          ? formData.isAvailableOutOfCampus
                          : false,
                      rentDuration: "",
                      durationUnit: undefined,
                      condition: undefined,
                      rating: 0,
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
      title: "Select Tags, Condition & Rent Details",
      content: (
        <>
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

          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Is the Product New or Used?</Text>
            <View style={styles.optionsContainer}>
              {conditions.map((condition) => (
                <TouchableOpacity
                  key={condition}
                  style={[
                    styles.optionButton,
                    formData.condition === condition
                      ? styles.optionButtonSelected
                      : null,
                  ]}
                  onPress={() =>
                    setFormData({
                      ...formData,
                      condition: condition,
                      rating: condition === "New" ? 0 : formData.rating,
                    })
                  }
                >
                  <Text
                    style={[
                      styles.optionText,
                      formData.condition === condition
                        ? styles.optionTextSelected
                        : null,
                    ]}
                  >
                    {condition}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {(formData.listingType === "Renting" ||
            formData.listingType === "Both") && (
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionTitle}>Rent Duration</Text>
              <View style={styles.rentDurationContainer}>
                <TextInput
                  style={styles.durationInput}
                  placeholder="1"
                  placeholderTextColor="#888"
                  keyboardType="numeric"
                  value={formData.rentDuration}
                  onChangeText={(text) =>
                    setFormData({ ...formData, rentDuration: text })
                  }
                />
                <View style={styles.dropdown}>
                  {durationUnits.map((unit) => (
                    <TouchableOpacity
                      key={unit}
                      style={[
                        styles.dropdownItem,
                        formData.durationUnit === unit
                          ? styles.dropdownItemSelected
                          : null,
                      ]}
                      onPress={() =>
                        setFormData({
                          ...formData,
                          durationUnit: unit,
                        })
                      }
                    >
                      <Text
                        style={[
                          styles.dropdownText,
                          formData.durationUnit === unit
                            ? styles.dropdownTextSelected
                            : null,
                        ]}
                      >
                        {unit}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          )}

          {formData.condition === "Used" && (
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
          )}
        </>
      ),
    },

    4: {
      title: "Enter Prices & Description",
      content: (
        <>
          {(formData.listingType === "Selling" ||
            formData.listingType === "Both") && (
            <TextInput
              style={styles.input}
              placeholder={`Price${
                formData.listingType === "Both" ? " (In Campus Selling)" : ""
              } $`}
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
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.outerContainer}>
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
              style={styles.nextButton}
              onPress={handleNext}
              disabled={isLoading}
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
                  Upon the money transfer, the specified rent duration is the
                  period the renter has to use and return the product.
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
      </View>
    </TouchableWithoutFeedback>
  );
};

export default AddProduct;

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: "#000000",
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
  rentDurationContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginVertical: 10,
  },
  durationInput: {
    width: "30%",
    padding: 15,
    borderRadius: 12,
    backgroundColor: "#1E1E1E",
    color: "#fff",
    textAlign: "center",
  },
  dropdown: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: "#1E1E1E",
    padding: 10,
  },
  dropdownItem: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#424242",
  },
  dropdownItemSelected: {
    backgroundColor: "#BB86FC",
  },
  dropdownText: {
    color: "#ccc",
    fontSize: 16,
    textAlign: "center",
  },
  dropdownTextSelected: {
    color: "#fff",
    fontWeight: "bold",
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
