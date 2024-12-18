// AddGig.tsx

import React, { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Modal,
  Image,
  Animated,
  Easing,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import * as ImagePicker from "expo-image-picker";
import { useNavigation } from "@react-navigation/native";
import { NGROK_URL } from "@env";

const PREDEFINED_CATEGORIES = [
  "Tutoring",
  "Writing",
  "Design",
  "Delivery",
  "Coding",
  "Other",
];

type Step = 1 | 2 | 3 | 4 | 5;

type AvailabilityDays = {
  Monday: boolean;
  Tuesday: boolean;
  Wednesday: boolean;
  Thursday: boolean;
  Friday: boolean;
  Saturday: boolean;
  Sunday: boolean;
};

const AddGig: React.FC = () => {
  const navigation = useNavigation();

  // Form fields
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [coverImage, setCoverImage] = useState<string | null>(null);

  const [price, setPrice] = useState("");
  const [isPriceOpenComm, setIsPriceOpenComm] = useState(false);

  // Availability states
  const [availabilityDays, setAvailabilityDays] = useState<AvailabilityDays>({
    Monday: false,
    Tuesday: false,
    Wednesday: false,
    Thursday: false,
    Friday: false,
    Saturday: false,
    Sunday: false,
  });
  const [isWhenever, setIsWhenever] = useState(false);

  // Additional Links and Documents
  const [additionalLinks, setAdditionalLinks] = useState<string[]>([]);
  const [newLink, setNewLink] = useState("");
  const [additionalDocuments, setAdditionalDocuments] = useState<string[]>([]);

  const [description, setDescription] = useState("");

  // States
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [showCategoriesModal, setShowCategoriesModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccessModalVisible, setIsSuccessModalVisible] = useState(false);

  // Animation for slide transitions
  const slideAnim = useRef(new Animated.Value(0)).current;

  // Error Toast States
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

  const animateTransition = (forward: boolean) => {
    Animated.sequence([
      Animated.timing(slideAnim, {
        toValue: forward ? 1 : -1,
        duration: 200,
        easing: Easing.ease,
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
    if (currentStep < 5) {
      animateTransition(true);
      setCurrentStep((prev) => (prev + 1) as Step);
    } else {
      handleSubmit();
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      animateTransition(false);
      setCurrentStep((prev) => (prev - 1) as Step);
    }
  };

  const validateCurrentStep = (): boolean => {
    switch (currentStep) {
      case 1:
        if (!title.trim()) {
          showError("Please enter a Title.");
          return false;
        }
        if (!category) {
          showError("Please select a Category.");
          return false;
        }
        if (!coverImage) {
          showError("Please upload a Headshot Image.");
          return false;
        }
        return true;
      case 2:
        if (!isPriceOpenComm && !price.trim()) {
          showError(
            "Please specify a price or choose 'Open to Communication'."
          );
          return false;
        }
        const anyDaySelected = Object.values(availabilityDays).some(Boolean);
        if (!isWhenever && !anyDaySelected) {
          showError("Please select availability days or choose 'Whenever'.");
          return false;
        }
        return true;
      case 3:
        if (!description.trim()) {
          showError("Please provide a description.");
          return false;
        }
        return true;
      case 4:
        // Additional resources are optional, no strict validation needed
        return true;
      case 5:
        return true;
      default:
        return false;
    }
  };

  const handleSubmit = async () => {
    setIsLoading(true);

    let finalAvailability = "Open to Communication";
    if (!isWhenever) {
      const selectedDays = Object.entries(availabilityDays)
        .filter(([_, selected]) => selected)
        .map(([day]) => day)
        .join(", ");
      if (selectedDays.trim()) {
        finalAvailability = selectedDays;
      }
    }

    const finalPrice = isPriceOpenComm ? "Open to Communication" : price.trim();

    const payload = {
      title: title.trim(),
      description: description.trim(),
      category: category || "Other",
      price: finalPrice,
      availability: finalAvailability,
      additionalLinks: additionalLinks,
      additionalDocuments: additionalDocuments,
      coverImage: coverImage,
      images: additionalDocuments, // Assuming additionalDocuments are images/documents
    };

    try {
      const response = await fetch(`${NGROK_URL}/services`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Error:", response.status, errorData);
        showError(
          errorData.error || "Failed to post the service. Please try again."
        );
        return;
      }

      setIsSuccessModalVisible(true);
      // Reset after success
      setTitle("");
      setDescription("");
      setCategory(null);
      setPrice("");
      setIsPriceOpenComm(false);
      setAdditionalLinks([]);
      setAdditionalDocuments([]);
      setCoverImage(null);
      setAvailabilityDays({
        Monday: false,
        Tuesday: false,
        Wednesday: false,
        Thursday: false,
        Friday: false,
        Saturday: false,
        Sunday: false,
      });
      setIsWhenever(false);
      setCurrentStep(1);

      setTimeout(() => {
        setIsSuccessModalVisible(false);
        navigation.navigate("Dashboard");
      }, 2000);
    } catch (error) {
      console.error("Error:", error);
      showError("Failed to post the service. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const pickCoverImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: false,
      quality: 1,
    });

    if (!result.canceled) {
      const uri = result.assets[0].uri;
      setCoverImage(uri);
    }
  };

  const pickAdditionalDocument = async () => {
    if (additionalDocuments.length >= 5) {
      showError("You can upload up to 5 images/documents.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All, // Allow both images and documents
      allowsMultipleSelection: true,
      quality: 1,
    });

    if (!result.canceled) {
      const newDocuments = result.assets.map((asset) => asset.uri);
      if (additionalDocuments.length + newDocuments.length > 5) {
        showError("You can upload up to 5 images/documents total.");
      } else {
        setAdditionalDocuments((prev) => [...prev, ...newDocuments]);
      }
    }
  };

  const removeAdditionalDocument = (index: number) => {
    setAdditionalDocuments((prev) => prev.filter((_, i) => i !== index));
  };

  const addNewLink = () => {
    if (additionalLinks.length >= 5) {
      showError("You can add up to 5 links.");
      return;
    }
    if (!newLink.trim()) {
      showError("Please enter a valid link before adding.");
      return;
    }
    // Optional: Add URL validation here
    setAdditionalLinks((prev) => [...prev, newLink.trim()]);
    setNewLink("");
  };

  const removeLink = (index: number) => {
    setAdditionalLinks((prev) => prev.filter((_, i) => i !== index));
  };

  const toggleDay = (day: keyof AvailabilityDays) => {
    setAvailabilityDays((prev) => ({
      ...prev,
      [day]: !prev[day],
    }));
  };

  const handleWheneverToggle = () => {
    if (!isWhenever) {
      setAvailabilityDays({
        Monday: false,
        Tuesday: false,
        Wednesday: false,
        Thursday: false,
        Friday: false,
        Saturday: false,
        Sunday: false,
      });
    }
    setIsWhenever(!isWhenever);
  };

  const priceSection = (
    <View style={styles.sectionContainer}>
      <Text style={styles.subTitle}>Pricing</Text>
      <View style={styles.priceOptionContainer}>
        <TouchableOpacity
          style={[
            styles.priceOption,
            isPriceOpenComm && styles.priceOptionSelected,
          ]}
          onPress={() => {
            setIsPriceOpenComm(true);
            setPrice("");
          }}
        >
          <Text style={styles.priceOptionText}>Open to Communication</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.priceOption,
            !isPriceOpenComm && styles.priceOptionSelected,
          ]}
          onPress={() => {
            setIsPriceOpenComm(false);
          }}
        >
          <Text style={styles.priceOptionText}>Set a Price</Text>
        </TouchableOpacity>
      </View>
      {!isPriceOpenComm && (
        <TextInput
          style={styles.input}
          placeholder="Price (e.g., $25/hour)"
          placeholderTextColor="#888"
          value={price}
          onChangeText={setPrice}
        />
      )}
    </View>
  );

  const availabilitySection = (
    <View style={styles.sectionContainer}>
      <Text style={styles.subTitle}>Availability</Text>
      <TouchableOpacity
        style={[
          styles.availabilityOption,
          isWhenever && styles.availabilityOptionSelected,
        ]}
        onPress={handleWheneverToggle}
      >
        <Text style={styles.availabilityOptionText}>
          Whenever / Open to Communicate
        </Text>
      </TouchableOpacity>

      {!isWhenever && (
        <View style={styles.daysContainer}>
          {Object.keys(availabilityDays).map((day) => {
            const dayKey = day as keyof AvailabilityDays;
            const selected = availabilityDays[dayKey];
            return (
              <TouchableOpacity
                key={day}
                style={[styles.dayButton, selected && styles.dayButtonSelected]}
                onPress={() => toggleDay(dayKey)}
              >
                <Text style={styles.dayButtonText}>{day}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );

  const additionalResourcesSection = (
    <View style={styles.sectionContainer}>
      <Text style={styles.subTitle}>Additional Resources</Text>

      <Text style={styles.helperText}>Links/Resume/Profiles (Optional):</Text>
      <View style={styles.addLinksContainer}>
        {additionalLinks.map((link, index) => (
          <View key={index} style={styles.linkItem}>
            <Text style={styles.linkText}>{link}</Text>
            <TouchableOpacity onPress={() => removeLink(index)}>
              <Ionicons name="close-circle-outline" size={20} color="#BB86FC" />
            </TouchableOpacity>
          </View>
        ))}

        {additionalLinks.length < 5 && (
          <View style={styles.addLinkRow}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Add a link..."
              placeholderTextColor="#888"
              value={newLink}
              onChangeText={setNewLink}
            />
            <TouchableOpacity style={styles.addLinkButton} onPress={addNewLink}>
              <Ionicons name="add-circle-outline" size={24} color="#BB86FC" />
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={styles.divider} />

      <Text style={styles.helperText}>
        Additional Images/Documents (Optional):
      </Text>
      {additionalDocuments.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginBottom: 10 }}
        >
          {additionalDocuments.map((doc, index) => (
            <View key={index} style={styles.imageContainer}>
              <Image source={{ uri: doc }} style={styles.additionalImage} />
              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => removeAdditionalDocument(index)}
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
      )}
      {additionalDocuments.length < 5 && (
        <TouchableOpacity
          style={styles.uploadButton}
          onPress={pickAdditionalDocument}
        >
          <Ionicons name="cloud-upload-outline" size={24} color="#BB86FC" />
          <Text style={styles.uploadButtonText}>Add Images/Documents</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const stepsContent = {
    1: (
      <>
        <Text style={styles.sectionTitle}>Basic Information</Text>
        <TextInput
          style={styles.input}
          placeholder="Service Title"
          placeholderTextColor="#888"
          value={title}
          onChangeText={setTitle}
        />

        <TouchableOpacity
          style={styles.dropdown}
          onPress={() => setShowCategoriesModal(true)}
        >
          <Text style={styles.dropdownText}>
            {category ? category : "Select Category"}
          </Text>
          <Ionicons name="chevron-down-outline" size={20} color="#ccc" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.uploadButton} onPress={pickCoverImage}>
          <Ionicons name="cloud-upload-outline" size={24} color="#BB86FC" />
          <Text style={styles.uploadButtonText}>
            {coverImage ? "Change Headshot Image" : "Upload Headshot Image"}
          </Text>
        </TouchableOpacity>

        {coverImage && (
          <View style={styles.coverImageContainer}>
            <Image source={{ uri: coverImage }} style={styles.coverImage} />
          </View>
        )}
      </>
    ),
    2: (
      <>
        <Text style={styles.sectionTitle}>Pricing & Availability</Text>
        {priceSection}
        <View style={styles.divider} />
        {availabilitySection}
      </>
    ),
    3: (
      <>
        <Text style={styles.sectionTitle}>Description</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Describe your service in detail..."
          placeholderTextColor="#888"
          multiline
          numberOfLines={6}
          value={description}
          onChangeText={setDescription}
        />
      </>
    ),
    4: <>{additionalResourcesSection}</>,
    5: (
      <>
        <Text style={styles.sectionTitle}>Review & Submit</Text>
        <View style={styles.reviewContainer}>
          <Text style={styles.reviewText}>
            <Text style={styles.reviewLabel}>Title: </Text>
            {title}
          </Text>
          <Text style={styles.reviewText}>
            <Text style={styles.reviewLabel}>Category: </Text>
            {category}
          </Text>
          <Text style={styles.reviewText}>
            <Text style={styles.reviewLabel}>Price: </Text>
            {isPriceOpenComm ? "Open to Communication" : price || "N/A"}
          </Text>
          <Text style={styles.reviewText}>
            <Text style={styles.reviewLabel}>Availability: </Text>
            {isWhenever
              ? "Whenever/Open to Communication"
              : Object.entries(availabilityDays)
                  .filter(([_, sel]) => sel)
                  .map(([day]) => day)
                  .join(", ") || "N/A"}
          </Text>

          <Text style={styles.reviewText}>
            <Text style={styles.reviewLabel}>Links: </Text>
            {additionalLinks.length > 0 ? additionalLinks.join(", ") : "N/A"}
          </Text>

          <Text style={styles.reviewText}>
            <Text style={styles.reviewLabel}>Documents/Images: </Text>
            {additionalDocuments.length > 0
              ? `${additionalDocuments.length} Uploaded`
              : "N/A"}
          </Text>

          <Text style={styles.reviewText}>
            <Text style={styles.reviewLabel}>Description: </Text>
            {description || "N/A"}
          </Text>
          <Text style={styles.reviewText}>
            <Text style={styles.reviewLabel}>Headshot Image: </Text>
            {coverImage ? "Uploaded" : "None"}
          </Text>
        </View>
        <Text style={styles.note}>
          Please confirm all details are correct before posting.
        </Text>
      </>
    ),
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Error Toast outside of innerContainer */}
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
        <View style={styles.innerContainer}>
          {/* Progress Dots */}
          <View style={styles.progressContainer}>
            {[1, 2, 3, 4, 5].map((step) => (
              <View
                key={step}
                style={[
                  styles.progressDot,
                  step <= currentStep ? styles.progressDotActive : null,
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
            <ScrollView
              contentContainerStyle={{ paddingBottom: 60 }}
              showsVerticalScrollIndicator={false}
            >
              {stepsContent[currentStep]}

              {/* Navigation Buttons */}
              <View style={styles.buttonContainer}>
                {currentStep > 1 && (
                  <TouchableOpacity
                    style={styles.backButton}
                    onPress={handleBack}
                  >
                    <Ionicons name="arrow-back" size={24} color="#aaa" />
                    <Text style={styles.backButtonText}>Back</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[
                    styles.nextButton,
                    isLoading && currentStep === 5 && styles.buttonDisabled,
                  ]}
                  onPress={handleNext}
                  disabled={isLoading && currentStep === 5}
                >
                  {isLoading && currentStep === 5 ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Text style={styles.nextButtonText}>
                        {currentStep === 5 ? "Post Service" : "Next"}
                      </Text>
                      {currentStep < 5 && (
                        <Ionicons name="arrow-forward" size={24} color="#fff" />
                      )}
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </Animated.View>

          {/* Success Modal */}
          <Modal
            transparent
            visible={isSuccessModalVisible}
            animationType="fade"
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <Ionicons name="checkmark-circle" size={60} color="#9C27B0" />
                <Text style={styles.modalText}>
                  Service Posted Successfully!
                </Text>
              </View>
            </View>
          </Modal>

          {/* Categories Modal */}
          <Modal transparent visible={showCategoriesModal} animationType="fade">
            <TouchableOpacity
              style={styles.modalOverlay}
              activeOpacity={1}
              onPressOut={() => setShowCategoriesModal(false)}
            >
              <View style={styles.modalPickerContent}>
                <Text style={styles.modalTitle}>Select a Category</Text>
                {PREDEFINED_CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={styles.modalOption}
                    onPress={() => {
                      setCategory(cat);
                      setShowCategoriesModal(false);
                    }}
                  >
                    <Text style={styles.modalOptionText}>{cat}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </TouchableOpacity>
          </Modal>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
};

export default AddGig;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "black",
  },
  innerContainer: {
    flex: 1,
    paddingTop: 20,
    paddingHorizontal: 20,
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
    flex: 1,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#BB86FC",
    marginBottom: 25,
    textAlign: "center",
  },
  sectionContainer: {
    marginBottom: 25,
  },
  subTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#BB86FC",
    marginBottom: 10,
  },
  helperText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#aaa",
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
  uploadButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1E1E1E",
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
  },
  uploadButtonText: {
    color: "#BB86FC",
    fontSize: 16,
    marginLeft: 10,
  },
  coverImageContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
  coverImage: {
    width: 150,
    height: 150,
    borderRadius: 15,
    resizeMode: "cover",
  },
  reviewContainer: {
    backgroundColor: "#1E1E1E",
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: "#424242",
  },
  reviewText: {
    color: "#fff",
    fontSize: 16,
    marginBottom: 10,
  },
  reviewLabel: {
    color: "#BB86FC",
    fontWeight: "700",
  },
  note: {
    color: "#888",
    fontSize: 14,
    textAlign: "center",
    marginTop: 20,
    paddingHorizontal: 10,
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 30,
    marginBottom: 40,
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
  availabilityOption: {
    backgroundColor: "#1E1E1E",
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "#424242",
  },
  availabilityOptionSelected: {
    borderColor: "#BB86FC",
  },
  availabilityOptionText: {
    color: "#fff",
    fontSize: 16,
  },
  daysContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 10,
    gap: 10,
  },
  dayButton: {
    backgroundColor: "#1E1E1E",
    borderWidth: 1,
    borderColor: "#424242",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  dayButtonSelected: {
    borderColor: "#BB86FC",
  },
  dayButtonText: {
    color: "#fff",
    fontSize: 14,
  },
  priceOptionContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 15,
  },
  priceOption: {
    flex: 1,
    backgroundColor: "#1E1E1E",
    padding: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#424242",
    marginRight: 10,
  },
  priceOptionSelected: {
    borderColor: "#BB86FC",
  },
  priceOptionText: {
    color: "#fff",
    fontSize: 16,
  },
  addLinksContainer: {
    marginBottom: 20,
  },
  linkItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#1E1E1E",
    borderColor: "#424242",
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
  },
  linkText: {
    color: "#fff",
    flex: 1,
    marginRight: 10,
  },
  addLinkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  addLinkButton: {
    backgroundColor: "#1E1E1E",
    borderRadius: 10,
    padding: 10,
  },
  imageContainer: {
    position: "relative",
    marginRight: 10,
  },
  additionalImage: {
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
  divider: {
    height: 1,
    backgroundColor: "#333",
    marginVertical: 20,
  },
});
