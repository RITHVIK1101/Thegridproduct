// AddProduct.tsx

import React, { useState, useContext, useRef, useLayoutEffect } from "react";
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
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { NGROK_URL } from "@env";
import { useNavigation } from "@react-navigation/native";
import { UserContext } from "./UserContext";
import axios from "axios";

type DurationUnit = "Hours" | "Days" | "Weeks"; // "Months" removed
type ListingType = "Selling" | "Renting" | "Both";
type AvailabilityUI = "In Campus" | "Out of Campus" | "Both";
type Condition = "New" | "Used";

const availableTags = [
  "#FemaleClothing",
  "#MaleClothing",
  "#Tickets",
  "#Other",
] as const;
const durationUnits: DurationUnit[] = ["Hours", "Days", "Weeks"];
const listingTypes: ListingType[] = ["Selling", "Renting", "Both"];
const conditions: Condition[] = ["New", "Used"];

interface FormData {
  images: string[];
  title: string;
  price: string;
  outOfCampusPrice: string;
  rentPrice: string;
  rentDuration: string;
  durationUnit?: DurationUnit;
  description: string;
  selectedTags: string[];
  availability: AvailabilityUI;
  rating: number;
  listingType: ListingType;
  condition?: Condition;
  isAvailableOutOfCampus: boolean;
}

const AddProduct: React.FC = () => {
  const [previewModalVisible, setPreviewModalVisible] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const navigation = useNavigation();
  const { userId, token, institution, studentType, refreshUserGrids } =
    useContext(UserContext);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: "",
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.headerBackButton}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  const [step, setStep] = useState(1);
  const [slideAnim] = useState(new Animated.Value(0));
  const scrollViewRef = useRef<ScrollView>(null);

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
    availability: "In Campus",
    rating: 0,
    listingType: "Selling",
    isAvailableOutOfCampus: false,
    condition: undefined,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isSuccessModalVisible, setIsSuccessModalVisible] = useState(false);

  // Info Modal State
  const [infoModalVisible, setInfoModalVisible] = useState(false);
  const [infoModalText, setInfoModalText] = useState("");

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

  const CLOUDINARY_URL =
    "https://api.cloudinary.com/v1_1/ds0zpfht9/image/upload";
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
    if (step < 5) {
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
      showError("Please fill out all information");
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.7,
        selectionLimit: 3 - formData.images.length,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setIsUploadingImage(true);

        const selectedAssets = result.assets.slice(
          0,
          3 - formData.images.length
        );

        for (const asset of selectedAssets) {
          const uri = asset.uri;
          const manipulatedImage = await ImageManipulator.manipulateAsync(
            uri,
            [{ resize: { width: 800 } }],
            { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
          );

          const formDataImage = new FormData();
          formDataImage.append("file", {
            uri: manipulatedImage.uri,
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

            if (formData.images.length >= 3) {
              showError("Please fill out all information");
              setIsUploadingImage(false);
              return;
            }

            setFormData((prev) => ({
              ...prev,
              images: [...prev.images, imageUrl],
            }));
          } catch (error) {
            console.error("Error uploading image:", error);
            showError("Image upload failed. Please try again.");
          }
        }
        setIsUploadingImage(false);
      }
    } catch (error) {
      console.error("Image Picker Error:", error);
      showError("Image upload failed. Please try again.");
    }
  };
  const takePhoto = async () => {
    // Request camera permissions
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      showError("Camera permission not granted.");
      return;
    }

    if (formData.images.length >= 3) {
      showError("You can only add up to 3 images");
      return;
    }
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setIsUploadingImage(true);
        const asset = result.assets[0];
        const uri = asset.uri;
        const manipulatedImage = await ImageManipulator.manipulateAsync(
          uri,
          [{ resize: { width: 800 } }],
          { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
        );

        const formDataImage = new FormData();
        formDataImage.append("file", {
          uri: manipulatedImage.uri,
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
          setFormData((prev) => ({
            ...prev,
            images: [...prev.images, imageUrl],
          }));
        } catch (error) {
          console.error("Error uploading image:", error);
          showError("Image upload failed. Please try again.");
        }
        setIsUploadingImage(false);
      }
    } catch (error) {
      console.error("Camera Error:", error);
      showError("Camera failed to open or capture image. Please try again.");
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

  // Validate current step with a generic error message
  const validateCurrentStep = (): boolean => {
    switch (step) {
      case 1:
        if (formData.images.length === 0 || !formData.title.trim()) {
          showError("Please fill out all information");
          return false;
        }
        return true;
      case 2:
        if (!listingTypes.includes(formData.listingType)) {
          showError("Please fill out all information");
          return false;
        }
        return true;
      case 3:
        if (
          formData.listingType !== "Renting" &&
          !["In Campus", "Out of Campus", "Both"].includes(
            formData.availability
          )
        ) {
          showError("Please fill out all information");
          return false;
        }
        return true;
      case 4:
        if (
          formData.selectedTags.length === 0 ||
          !formData.condition ||
          ((formData.listingType === "Selling" ||
            formData.listingType === "Both") &&
            formData.condition === "Used" &&
            formData.rating === 0) ||
          ((formData.listingType === "Renting" ||
            formData.listingType === "Both") &&
            (!formData.rentDuration.trim() || !formData.durationUnit))
        ) {
          showError("Please fill out all information");
          return false;
        }
        return true;
      case 5:
        if (
          ((formData.listingType === "Selling" ||
            formData.listingType === "Both") &&
            !formData.price.trim()) ||
          ((formData.listingType === "Renting" ||
            formData.listingType === "Both") &&
            !formData.rentPrice.trim()) ||
          (((formData.listingType === "Both" &&
            formData.availability === "Both") ||
            (formData.listingType === "Selling" &&
              (formData.availability === "Out of Campus" ||
                formData.availability === "Both"))) &&
            !formData.outOfCampusPrice.trim())
        ) {
          showError("Please fill out all information");
          return false;
        }
        return true;
      default:
        return false;
    }
  };

  const handleSubmit = async () => {
    if (!userId || !token || !institution || !studentType) {
      showError("Please fill out all information");
      return;
    }

    setIsLoading(true);

    try {
      const price = formData.price
        ? parseFloat(formData.price.trim())
        : undefined;
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
        throw new Error("Please fill out all information");
      }
      if (formData.selectedTags.length === 0) {
        throw new Error("Please fill out all information");
      }
      if (formData.images.length === 0) {
        throw new Error("Please fill out all information");
      }

      let backendAvailability = "";
      if (formData.listingType === "Renting") {
        backendAvailability = "In Campus Only";
      } else if (formData.listingType === "Both") {
        backendAvailability = "On and Off Campus";
      } else {
        switch (formData.availability) {
          case "In Campus":
            backendAvailability = "In Campus Only";
            break;
          case "Out of Campus":
            backendAvailability = "Off Campus Only";
            break;
          case "Both":
            backendAvailability = "On and Off Campus";
            break;
          default:
            backendAvailability = "In Campus Only";
        }
      }

      const payload = {
        title: formData.title.trim(),
        category: formData.selectedTags[0],
        price: price ?? 0,
        outOfCampusPrice: outOfCampusPrice ?? 0,
        rentPrice: rentPrice ?? 0,
        rentDuration:
          formData.rentDuration.trim() && formData.durationUnit
            ? `${formData.rentDuration.trim()} ${formData.durationUnit}`
            : "",
        description: formData.description.trim(),
        selectedTags: formData.selectedTags,
        images: formData.images,
        isAvailableOutOfCampus:
          formData.availability === "Out of Campus" ||
          formData.availability === "Both" ||
          formData.listingType === "Both",
        rating:
          formData.listingType === "Selling" || formData.listingType === "Both"
            ? formData.rating
            : formData.rating,
        listingType: formData.listingType,
        availability: backendAvailability,
        condition: formData.condition,
        status: "inshop",
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
          throw new Error(data.message || `Please fill out all information `);
        }
        // Reset the form after successful submission
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
          availability: "In Campus",
          rating: 0,
          listingType: "Selling",
          isAvailableOutOfCampus: false,
          condition: undefined,
        });
        await refreshUserGrids();
        setIsSuccessModalVisible(true);
        setTimeout(() => {
          setIsSuccessModalVisible(false);
          navigation.goBack();
        }, 1500);
      } else {
        const errorText = await response.text();
        console.error("Unexpected response:", errorText);
        throw new Error("Unexpected response format. Expected JSON.");
      }
    } catch (error: unknown) {
      console.error("Error:", error);
      const errMsg =
        error instanceof Error ? error.message : "An unknown error occurred.";
      if (errMsg.toLowerCase().includes("https")) {
        showError("Please fill out all information");
      } else {
        showError(errMsg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const openInfoModal = (text: string) => {
    setInfoModalText(text);
    setInfoModalVisible(true);
  };

  const closeInfoModal = () => {
    setInfoModalVisible(false);
    setInfoModalText("");
  };

  const slides: Record<number, { title: string; content: JSX.Element }> = {
    1: {
      title: "Upload Images & Enter Title",
      content: (
        <>
          <Text
            style={styles.imageCounter}
          >{`${formData.images.length}/3 Images`}</Text>
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
            <TouchableOpacity
              style={[styles.uploadButton, { marginTop: 10 }]}
              onPress={takePhoto}
              disabled={isUploadingImage}
            >
              {isUploadingImage ? (
                <ActivityIndicator size="small" color="#BB86FC" />
              ) : (
                <>
                  <Ionicons name="camera-outline" size={30} color="#BB86FC" />
                  <Text style={styles.uploadButtonText}>Take Photo</Text>
                </>
              )}
            </TouchableOpacity>

            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {formData.images.map((image, index) => (
                <View key={index} style={styles.imageContainer}>
                  <TouchableOpacity
                    onPress={() => {
                      setPreviewImage(image);
                      setPreviewModalVisible(true);
                    }}
                  >
                    <Image source={{ uri: image }} style={styles.image} />
                  </TouchableOpacity>
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
        <View style={styles.sectionContainer}>
          <View style={styles.titleWithInfo}>
            <Text style={styles.sectionTitle}>Listing Type</Text>
            <TouchableOpacity
              onPress={() =>
                openInfoModal(
                  "Select how you want to offer your product:\n- Selling: In-campus (hand) or Out-of-campus (ship in 7 days).\n- Renting: Always in-campus.\n- Both: Offer both buying and renting."
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
          <View style={styles.optionsContainer}>
            {listingTypes.map((type) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.optionButton,
                  formData.listingType === type && styles.optionButtonSelected,
                ]}
                onPress={() =>
                  setFormData({
                    ...formData,
                    listingType: type,
                    availability:
                      type === "Renting" ? "In Campus" : formData.availability,
                    outOfCampusPrice: "",
                    rentPrice: "",
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
                    formData.listingType === type && styles.optionTextSelected,
                  ]}
                >
                  {type}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ),
    },
    3: {
      title: "Select Availability",
      content:
        formData.listingType === "Renting" ? (
          <View style={styles.sectionContainer}>
            <View style={styles.titleWithInfo}>
              <Text style={styles.sectionTitle}>Availability</Text>
              <TouchableOpacity
                onPress={() =>
                  openInfoModal(
                    "Renting is always in-campus only. You will hand over the product directly without shipping."
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
            <View style={styles.lockedAvailability}>
              <Ionicons name="lock-closed" size={20} color="#BB86FC" />
              <Text style={styles.lockedAvailabilityText}>
                In Campus (Forced)
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.sectionContainer}>
            <View style={styles.titleWithInfo}>
              <Text style={styles.sectionTitle}>Availability</Text>
              <TouchableOpacity
                onPress={() =>
                  openInfoModal(
                    "In Campus: Hand delivery.\nOut of Campus: Must ship within 7 days.\nBoth: Provide separate prices for in-campus and out-of-campus."
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
            <View style={styles.optionsContainer}>
              <TouchableOpacity
                style={[
                  styles.optionButton,
                  formData.availability === "In Campus" &&
                    styles.optionButtonSelected,
                ]}
                onPress={() =>
                  setFormData({
                    ...formData,
                    availability: "In Campus",
                    isAvailableOutOfCampus: false,
                  })
                }
              >
                <Text
                  style={[
                    styles.optionText,
                    formData.availability === "In Campus" &&
                      styles.optionTextSelected,
                  ]}
                >
                  In Campus
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.optionButton,
                  formData.availability === "Out of Campus" &&
                    styles.optionButtonSelected,
                ]}
                onPress={() =>
                  setFormData({
                    ...formData,
                    availability: "Out of Campus",
                    isAvailableOutOfCampus: true,
                  })
                }
              >
                <Text
                  style={[
                    styles.optionText,
                    formData.availability === "Out of Campus" &&
                      styles.optionTextSelected,
                  ]}
                >
                  Out of Campus
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.optionButton,
                  formData.availability === "Both" &&
                    styles.optionButtonSelected,
                ]}
                onPress={() =>
                  setFormData({
                    ...formData,
                    availability: "Both",
                    isAvailableOutOfCampus: true,
                  })
                }
              >
                <Text
                  style={[
                    styles.optionText,
                    formData.availability === "Both" &&
                      styles.optionTextSelected,
                  ]}
                >
                  Both
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ),
    },
    4: {
      title: "Tags, Condition & Rent Details",
      content: (
        <>
          <View style={styles.sectionContainer}>
            <View style={styles.titleWithInfo}>
              <Text style={styles.sectionTitle}>Select Tags</Text>
              <TouchableOpacity
                onPress={() =>
                  openInfoModal(
                    "Tags help categorize your product (e.g. #FemaleClothing). Select at least one."
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
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {availableTags.map((tag) => (
                <TouchableOpacity
                  key={tag}
                  style={[
                    styles.tag,
                    formData.selectedTags.includes(tag) && styles.tagSelected,
                  ]}
                  onPress={() => toggleTag(tag)}
                >
                  <Text
                    style={[
                      styles.tagText,
                      formData.selectedTags.includes(tag) &&
                        styles.tagTextSelected,
                    ]}
                  >
                    {tag}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
          <View style={styles.sectionContainer}>
            <View style={styles.titleWithInfo}>
              <Text style={styles.sectionTitle}>Condition</Text>
              <TouchableOpacity
                onPress={() =>
                  openInfoModal(
                    "Select 'New' or 'Used'. Used items can be rated for quality."
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
            <View style={styles.optionsContainer}>
              {conditions.map((condition) => (
                <TouchableOpacity
                  key={condition}
                  style={[
                    styles.optionButton,
                    formData.condition === condition &&
                      styles.optionButtonSelected,
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
                      formData.condition === condition &&
                        styles.optionTextSelected,
                    ]}
                  >
                    {condition}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {formData.condition === "Used" && (
              <View style={styles.sectionContainer}>
                <View style={styles.titleWithInfo}>
                  <Text style={styles.sectionTitle}>Rate Quality</Text>
                  <TouchableOpacity
                    onPress={() =>
                      openInfoModal(
                        "Rate the quality of the used item, from 1 (Poor) to 5 (Excellent)."
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
                <View style={styles.ratingContainer}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <TouchableOpacity
                      key={star}
                      onPress={() => setRatingValue(star)}
                    >
                      <Ionicons
                        name="star"
                        size={20}
                        color={formData.rating >= star ? "#FFD700" : "#ccc"}
                      />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </View>
          {(formData.listingType === "Renting" ||
            formData.listingType === "Both") && (
            <View style={styles.sectionContainer}>
              <View style={styles.titleWithInfo}>
                <Text style={styles.sectionTitle}>Rent Duration</Text>
                <TouchableOpacity
                  onPress={() =>
                    openInfoModal(
                      "Set how long the renter can use the product before returning it on-campus."
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
              <View style={styles.rentDurationContainer}>
                <TextInput
                  style={styles.durationInput}
                  placeholder="Duration"
                  placeholderTextColor="#888"
                  keyboardType="numeric"
                  value={formData.rentDuration}
                  onChangeText={(text) =>
                    setFormData({ ...formData, rentDuration: text })
                  }
                  onFocus={() =>
                    scrollViewRef.current?.scrollToEnd({ animated: true })
                  }
                />
                <View style={styles.durationUnitContainer}>
                  {durationUnits.map((unit) => (
                    <TouchableOpacity
                      key={unit}
                      style={[
                        styles.durationUnitButton,
                        formData.durationUnit === unit &&
                          styles.durationUnitButtonSelected,
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
                          styles.durationUnitText,
                          formData.durationUnit === unit &&
                            styles.durationUnitTextSelected,
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
        </>
      ),
    },
    5: {
      title: "Prices & Description",
      content: (
        <>
          {(formData.listingType === "Selling" ||
            formData.listingType === "Both") && (
            <>
              <View style={styles.titleWithInfoRow}>
                <Text style={styles.sectionSubtitle}>
                  Buying Price (In Campus) $
                </Text>
                <TouchableOpacity
                  onPress={() =>
                    openInfoModal(
                      "In-campus transactions are done by hand, no shipping required."
                    )
                  }
                >
                  <Ionicons
                    name="information-circle-outline"
                    size={18}
                    color="#BB86FC"
                  />
                </TouchableOpacity>
              </View>
              <TextInput
                style={styles.input}
                placeholder="Enter In-Campus Buying Price"
                placeholderTextColor="#888"
                keyboardType="numeric"
                value={formData.price}
                onChangeText={(text) =>
                  setFormData({ ...formData, price: text })
                }
              />
              {((formData.listingType === "Both" &&
                formData.availability === "Both") ||
                (formData.listingType === "Selling" &&
                  (formData.availability === "Both" ||
                    formData.availability === "Out of Campus"))) && (
                <>
                  <View style={styles.titleWithInfoRow}>
                    <Text style={styles.sectionSubtitle}>
                      Buying Price (Out of Campus) $
                    </Text>
                    <TouchableOpacity
                      onPress={() =>
                        openInfoModal(
                          "Out-of-campus requires shipping within 7 days. Price should cover shipping."
                        )
                      }
                    >
                      <Ionicons
                        name="information-circle-outline"
                        size={18}
                        color="#BB86FC"
                      />
                    </TouchableOpacity>
                  </View>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter Out-Of-Campus Buying Price"
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
          )}
          {(formData.listingType === "Renting" ||
            formData.listingType === "Both") && (
            <>
              <View style={styles.titleWithInfoRow}>
                <Text style={styles.sectionSubtitle}>
                  Renting Price (In Campus) $
                </Text>
                <TouchableOpacity
                  onPress={() =>
                    openInfoModal(
                      "Renting is on-campus only; you hand over and retrieve the item in person."
                    )
                  }
                >
                  <Ionicons
                    name="information-circle-outline"
                    size={18}
                    color="#BB86FC"
                  />
                </TouchableOpacity>
              </View>
              <TextInput
                style={styles.input}
                placeholder="Enter In-Campus Renting Price"
                placeholderTextColor="#888"
                keyboardType="numeric"
                value={formData.rentPrice}
                onChangeText={(text) =>
                  setFormData({ ...formData, rentPrice: text })
                }
              />
            </>
          )}
          <View style={{ marginTop: 20 }}>
            <View style={styles.titleWithInfoRow}>
              <Text style={styles.sectionSubtitle}>
                Additional Description (Optional)
              </Text>
            </View>
            <TextInput
              style={[styles.input, styles.descriptionInput]}
              placeholder="Describe your product..."
              placeholderTextColor="#888"
              multiline
              value={formData.description}
              onFocus={() =>
                scrollViewRef.current?.scrollToEnd({ animated: true })
              }
              onChangeText={(text) =>
                setFormData({ ...formData, description: text })
              }
            />
          </View>
        </>
      ),
    },
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.outerContainer}>
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
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}
        >
          <ScrollView
            ref={scrollViewRef}
            style={styles.container}
            contentContainerStyle={{
              flexGrow: 1,
              justifyContent: "flex-start",
              paddingBottom: 60,
            }}
            keyboardShouldPersistTaps="always"
            alwaysBounceVertical={true}
            bounces={true}
            showsVerticalScrollIndicator={true}
          >
            <View style={styles.progressContainer}>
              {[1, 2, 3, 4, 5].map((s) => (
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
              <Text style={styles.stepTitle}>{slides[step].title}</Text>
              {slides[step].content}
            </Animated.View>

            <View
              style={[
                styles.buttonContainer,
                { justifyContent: step > 1 ? "space-between" : "flex-end" },
              ]}
            >
              {step > 1 && (
                <TouchableOpacity
                  style={styles.backButton}
                  onPress={handleBack}
                >
                  <Ionicons name="arrow-back" size={24} color="#aaa" />
                  <Text style={styles.backButtonText}>Back</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.nextButton}
                onPress={handleNext}
                disabled={isLoading}
              >
                {isLoading && step === 5 ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Text style={styles.nextButtonText}>
                      {step === 5 ? "Add Product" : "Next"}
                    </Text>
                    {step < 5 && (
                      <Ionicons name="arrow-forward" size={24} color="#fff" />
                    )}
                  </>
                )}
              </TouchableOpacity>
            </View>

            <Modal
              transparent
              visible={isSuccessModalVisible}
              animationType="fade"
            >
              <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                  <Ionicons name="checkmark-circle" size={60} color="#9C27B0" />
                  <Text style={styles.modalText}>
                    Product Posted Successfully!
                  </Text>
                </View>
              </View>
            </Modal>

            <Modal transparent visible={infoModalVisible} animationType="fade">
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

            {/* Add the preview modal here */}
            <Modal
              transparent
              visible={previewModalVisible}
              animationType="fade"
            >
              <TouchableWithoutFeedback
                onPress={() => setPreviewModalVisible(false)}
              >
                <View style={styles.previewModalOverlay}>
                  <TouchableWithoutFeedback>
                    <View style={styles.previewModalContent}>
                      {previewImage && (
                        <Image
                          source={{ uri: previewImage }}
                          style={styles.previewImage}
                          resizeMode="contain"
                        />
                      )}
                    </View>
                  </TouchableWithoutFeedback>
                </View>
              </TouchableWithoutFeedback>
            </Modal>
          </ScrollView>
        </KeyboardAvoidingView>
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
  headerBackButton: {
    marginLeft: 15,
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
  descriptionInput: {
    height: 120,
    textAlignVertical: "top",
    marginTop: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#BB86FC",
    marginBottom: 15,
    marginTop: 20,
  },
  sectionSubtitle: {
    fontSize: 16,
    fontWeight: "500",
    color: "#BB86FC",
  },
  sectionContainer: {
    marginBottom: 20,
  },
  ratingContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginVertical: 5,
  },
  optionsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 15,
  },
  // Updated optionButton style: adding a fixed minimum height to ensure uniformity
  optionButton: {
    flex: 1,
    marginHorizontal: 5,
    padding: 10,
    minHeight: 50,
    borderRadius: 12,
    backgroundColor: "#1E1E1E",
    alignItems: "center",
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
  previewModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  previewModalContent: {
    width: "80%",
    maxHeight: "50%",
    backgroundColor: "#1E1E1E",
    borderRadius: 12,
    padding: 10,
  },
  previewImage: {
    width: "100%",
    height: "100%",
    borderRadius: 12,
  },

  infoModalContent: {
    backgroundColor: "#1E1E1E",
    padding: 20,
    borderRadius: 15,
    alignItems: "center",
    width: "100%",
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
  rentDurationContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    backgroundColor: "#1E1E1E",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#424242",
    overflow: "hidden",
  },
  durationInput: {
    width: "30%",
    padding: 10,
    borderRightWidth: 1,
    borderRightColor: "#424242",
    backgroundColor: "#1E1E1E",
    color: "#fff",
    textAlign: "center",
    fontSize: 16,
  },
  durationUnitContainer: {
    flexDirection: "row",
    flex: 1,
    justifyContent: "center",
  },
  durationUnitButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    margin: 5,
    borderRadius: 10,
    backgroundColor: "#1E1E1E",
    borderWidth: 1,
    borderColor: "#424242",
  },
  durationUnitButtonSelected: {
    backgroundColor: "#BB86FC",
    borderColor: "#BB86FC",
  },
  durationUnitText: {
    color: "#ccc",
    fontSize: 14,
  },
  durationUnitTextSelected: {
    color: "#fff",
    fontWeight: "600",
  },
  titleWithInfo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  titleWithInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 5,
  },
  lockedAvailability: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1E1E1E",
    borderRadius: 12,
    padding: 15,
    marginTop: 15,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#424242",
  },
  lockedAvailabilityText: {
    color: "#fff",
    fontSize: 16,
    marginLeft: 10,
    fontWeight: "500",
  },
});
