// AddGig.tsx

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  Modal,
  Animated,
  Platform,
  Image,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as ImagePicker from "expo-image-picker";
import { NGROK_URL } from "@env";
import { useNavigation } from "@react-navigation/native"; // Import useNavigation

interface FormData {
  isAnonymous: boolean;
  isOnline: boolean;
  taskName: string;
  description: string;
  dueDate: Date | null;
  budget: string;
  images: string[]; // To store image URIs
}

const AddGig: React.FC = () => {
  const [step, setStep] = useState(1);
  const [slideAnim] = useState(new Animated.Value(0));
  const [formData, setFormData] = useState<FormData>({
    isAnonymous: false,
    isOnline: false,
    taskName: "",
    description: "",
    dueDate: null,
    budget: "",
    images: [],
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccessModalVisible, setIsSuccessModalVisible] = useState(false);

  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<Date | null>(null);
  const navigation = useNavigation();

  const currentYear = new Date().getFullYear();
  const startOfYear = new Date(currentYear, 0, 1);
  const endOfYear = new Date(currentYear, 11, 31, 23, 59, 59);

  const formatDateTime = (date: Date | null) => {
    if (!date) return "No date/time selected";
    return `${date.toLocaleDateString()} at ${date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  };

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
    if (step < 6) {
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

  const handleImageUpload = async () => {
    if (formData.images.length >= 5) {
      Alert.alert("Image Limit Reached", "You can upload up to 5 images.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 1,
    });
    if (!result.canceled) {
      const newImages = result.assets.map((asset) => asset.uri);
      if (formData.images.length + newImages.length > 5) {
        Alert.alert("Image Limit Exceeded", "You can upload up to 5 images.");
      } else {
        setFormData((prev) => ({
          ...prev,
          images: [...prev.images, ...newImages],
        }));
      }
    }
  };

  const removeImage = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));
  };

  const validateCurrentStep = (): boolean => {
    switch (step) {
      case 1:
        return formData.isAnonymous !== undefined;
      case 2:
        return true; // No specific validation for presence
      case 3:
        return formData.taskName.trim().length > 0;
      case 4:
        return formData.description.trim().length > 0;
      case 5:
        // Ensure both date and time are selected and dueDate is in the future
        if (selectedDate && selectedTime) {
          const combinedDate = new Date(selectedDate);
          combinedDate.setHours(selectedTime.getHours());
          combinedDate.setMinutes(selectedTime.getMinutes());
          combinedDate.setSeconds(0);
          combinedDate.setMilliseconds(0);
          return combinedDate.getTime() > Date.now();
        }
        return false;
      case 6:
        return formData.budget.trim().length > 0;
      default:
        return false;
    }
  };

  const handleSubmit = async () => {
    // Combine selectedDate and selectedTime into dueDate
    if (selectedDate && selectedTime) {
      const combinedDate = new Date(selectedDate);
      combinedDate.setHours(selectedTime.getHours());
      combinedDate.setMinutes(selectedTime.getMinutes());
      combinedDate.setSeconds(0);
      combinedDate.setMilliseconds(0);
      setFormData({ ...formData, dueDate: combinedDate });
    }

    setIsLoading(true);
    try {
      // Ensure dueDate is set
      if (!formData.dueDate) {
        throw new Error("Due date is not set.");
      }

      const response = await fetch(`${NGROK_URL}/tasks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log("Success:", data);

      setFormData({
        isAnonymous: false,
        isOnline: false,
        taskName: "",
        description: "",
        dueDate: null,
        budget: "",
        images: [],
      });
      setSelectedDate(null);
      setSelectedTime(null);
      setIsSuccessModalVisible(true);
      setTimeout(() => {
        setIsSuccessModalVisible(false);
        setStep(1);
      }, 2000);
      navigation.navigate("Dashboard");
    } catch (error) {
      console.error("Error:", error);
      Alert.alert("Error", "Failed to post task. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Effect to combine date and time when both are selected
  useEffect(() => {
    if (selectedDate && selectedTime) {
      const combinedDate = new Date(selectedDate);
      combinedDate.setHours(selectedTime.getHours());
      combinedDate.setMinutes(selectedTime.getMinutes());
      combinedDate.setSeconds(0);
      combinedDate.setMilliseconds(0);

      // Only set dueDate if combinedDate is in the future
      if (combinedDate.getTime() > Date.now()) {
        setFormData((prev) => ({ ...prev, dueDate: combinedDate }));
      } else {
        setFormData((prev) => ({ ...prev, dueDate: null }));
        Alert.alert(
          "Invalid Date/Time",
          "Please select a future date and time."
        );
      }
    }
  }, [selectedDate, selectedTime]);

  const slides = {
    1: {
      title: "How would you like to post?",
      content: (
        <View style={styles.optionsContainer}>
          <TouchableOpacity
            style={[
              styles.optionButton,
              formData.isAnonymous && styles.optionButtonSelected,
            ]}
            onPress={() => setFormData({ ...formData, isAnonymous: true })}
          >
            <Ionicons
              name="eye-off-outline"
              size={24}
              color={formData.isAnonymous ? "#fff" : "#ccc"}
            />
            <Text
              style={[
                styles.optionText,
                formData.isAnonymous && styles.optionTextSelected,
              ]}
            >
              Post Anonymously
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.optionButton,
              !formData.isAnonymous && styles.optionButtonSelected,
            ]}
            onPress={() => setFormData({ ...formData, isAnonymous: false })}
          >
            <Ionicons
              name="person-outline"
              size={24}
              color={!formData.isAnonymous ? "#fff" : "#ccc"}
            />
            <Text
              style={[
                styles.optionText,
                !formData.isAnonymous && styles.optionTextSelected,
              ]}
            >
              Post Publicly
            </Text>
          </TouchableOpacity>
        </View>
      ),
    },
    2: {
      title: "What presence does this task require?",
      content: (
        <View style={styles.optionsContainer}>
          <TouchableOpacity
            style={[
              styles.optionButton,
              formData.isOnline && styles.optionButtonSelected,
            ]}
            onPress={() => setFormData({ ...formData, isOnline: true })}
          >
            <Ionicons
              name="globe-outline"
              size={24}
              color={formData.isOnline ? "#fff" : "#ccc"}
            />
            <Text
              style={[
                styles.optionText,
                formData.isOnline && styles.optionTextSelected,
              ]}
            >
              Online
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.optionButton,
              !formData.isOnline && styles.optionButtonSelected,
            ]}
            onPress={() => setFormData({ ...formData, isOnline: false })}
          >
            <Ionicons
              name="school-outline"
              size={24}
              color={!formData.isOnline ? "#fff" : "#ccc"}
            />
            <Text
              style={[
                styles.optionText,
                !formData.isOnline && styles.optionTextSelected,
              ]}
            >
              In-Campus
            </Text>
          </TouchableOpacity>
        </View>
      ),
    },
    3: {
      title: "What's your task about?",
      content: (
        <TextInput
          style={styles.input}
          placeholder="Enter a clear title for your task"
          placeholderTextColor="#888"
          value={formData.taskName}
          onChangeText={(text) => setFormData({ ...formData, taskName: text })}
        />
      ),
    },
    4: {
      title: "Describe your task in detail",
      content: (
        <>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Provide specific details about what you need..."
            placeholderTextColor="#888"
            multiline
            numberOfLines={6}
            value={formData.description}
            onChangeText={(text) =>
              setFormData({ ...formData, description: text })
            }
          />
          <TouchableOpacity
            style={styles.uploadButton}
            onPress={handleImageUpload}
          >
            <Ionicons name="cloud-upload-outline" size={24} color="#BB86FC" />
            <Text style={styles.uploadButtonText}>Upload Images/Documents</Text>
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
        </>
      ),
    },
    5: {
      title: "When do you need this done?",
      content: (
        <View style={styles.dateTimeContainer}>
          <TouchableOpacity
            style={styles.dateTimeButton}
            onPress={() => {
              setShowDatePicker(true);
              setShowTimePicker(false); // Ensure only one picker is visible
            }}
          >
            <Ionicons name="calendar-outline" size={24} color="#ccc" />
            <Text style={styles.dateTimeButtonText}>Select Date</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.dateTimeButton}
            onPress={() => {
              setShowTimePicker(true);
              setShowDatePicker(false); // Ensure only one picker is visible
            }}
          >
            <Ionicons name="time-outline" size={24} color="#ccc" />
            <Text style={styles.dateTimeButtonText}>Select Time</Text>
          </TouchableOpacity>

          <Text style={styles.selectedDateTime}>
            Due: {formatDateTime(formData.dueDate)}
          </Text>

          {(showDatePicker || showTimePicker) && (
            <DateTimePicker
              value={
                showDatePicker
                  ? selectedDate || new Date()
                  : selectedTime || new Date()
              }
              mode={showDatePicker ? "date" : "time"}
              is24Hour={false}
              display={Platform.OS === "ios" ? "spinner" : "default"}
              minimumDate={showDatePicker ? startOfYear : undefined}
              maximumDate={showDatePicker ? endOfYear : undefined}
              onChange={(event, selectedDateTime) => {
                if (Platform.OS === "android") {
                  setShowDatePicker(false);
                  setShowTimePicker(false);
                }

                if (selectedDateTime) {
                  if (showDatePicker) {
                    setSelectedDate(selectedDateTime);
                  } else if (showTimePicker) {
                    setSelectedTime(selectedDateTime);
                  }
                }
              }}
              // Add textColor for iOS and accentColor for Android
              textColor={Platform.OS === "ios" ? "#fff" : undefined}
              accentColor={Platform.OS === "android" ? "#BB86FC" : undefined}
            />
          )}
        </View>
      ),
    },
    6: {
      title: "What's your budget?",
      content: (
        <TextInput
          style={styles.input}
          placeholder="Enter amount in USD"
          placeholderTextColor="#888"
          keyboardType="numeric"
          value={formData.budget}
          onChangeText={(text) => setFormData({ ...formData, budget: text })}
        />
      ),
    },
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 40 }}
    >
      <View style={styles.progressContainer}>
        {[1, 2, 3, 4, 5, 6].map((s) => (
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
          <Text style={styles.nextButtonText}>
            {step === 6 ? (isLoading ? "Posting..." : "Post Task") : "Next"}
          </Text>
          {step < 6 && <Ionicons name="arrow-forward" size={24} color="#fff" />}
        </TouchableOpacity>
      </View>

      <Modal transparent visible={isSuccessModalVisible} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Ionicons name="checkmark-circle" size={60} color="#9C27B0" />
            <Text style={styles.modalText}>Task Posted Successfully!</Text>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212", // Dark background
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
    backgroundColor: "#424242", // Dark grey for inactive dots
    marginHorizontal: 5,
  },
  progressDotActive: {
    backgroundColor: "#BB86FC", // Purple for active dots
    transform: [{ scale: 1.2 }],
  },
  slideContainer: {
    marginBottom: 30,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#BB86FC", // Purple text
    marginBottom: 20,
  },
  optionsContainer: {
    gap: 15,
  },
  optionButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    borderRadius: 12,
    backgroundColor: "#1E1E1E",
    gap: 15,
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
  dateTimeContainer: {
    gap: 15,
  },
  dateTimeButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1E1E1E",
    padding: 15,
    borderRadius: 12,
    gap: 10,
  },
  dateTimeButtonText: {
    fontSize: 16,
    color: "#ccc",
    fontWeight: "500",
  },
  selectedDateTime: {
    fontSize: 16,
    color: "#bbb",
    textAlign: "center",
    marginTop: 10,
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
    backgroundColor: "rgba(0, 0, 0, 0.7)", // Darker overlay
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#1E1E1E", // Dark modal background
    padding: 30,
    borderRadius: 15,
    alignItems: "center",
    gap: 15,
  },
  modalText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff", // White text
  },
  uploadButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1E1E1E", // Dark button background
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
  },
  uploadButtonText: {
    color: "#BB86FC",
    fontSize: 16,
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
});

export default AddGig;
