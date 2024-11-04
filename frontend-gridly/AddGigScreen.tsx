import React, { useState } from "react";
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
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";

const BACKEND_URL = "https://a18c-2601-600-9000-50-8875-1b80-3f88-576a.ngrok-free.app";

interface FormData {
  isAnonymous: boolean;
  taskName: string;
  description: string;
  timeframe: string;
  budget: string;
}

const AddGig: React.FC = () => {
  const [step, setStep] = useState(1);
  const [slideAnim] = useState(new Animated.Value(0));
  const [formData, setFormData] = useState<FormData>({
    isAnonymous: false,
    taskName: "",
    description: "",
    timeframe: "",
    budget: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccessModalVisible, setIsSuccessModalVisible] = useState(false);

  const slides = {
    1: {
      title: "How would you like to post?",
      content: (
        <View style={styles.optionsContainer}>
          <TouchableOpacity 
            style={[
              styles.optionButton,
              formData.isAnonymous && styles.optionButtonSelected
            ]}
            onPress={() => setFormData({ ...formData, isAnonymous: true })}
          >
            <Ionicons name="eye-off-outline" size={24} color={formData.isAnonymous ? "#fff" : "#333"} />
            <Text style={[styles.optionText, formData.isAnonymous && styles.optionTextSelected]}>
              Post Anonymously
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[
              styles.optionButton,
              !formData.isAnonymous && styles.optionButtonSelected
            ]}
            onPress={() => setFormData({ ...formData, isAnonymous: false })}
          >
            <Ionicons name="person-outline" size={24} color={!formData.isAnonymous ? "#fff" : "#333"} />
            <Text style={[styles.optionText, !formData.isAnonymous && styles.optionTextSelected]}>
              Post Publicly
            </Text>
          </TouchableOpacity>
        </View>
      )
    },
    2: {
      title: "What's your task about?",
      content: (
        <TextInput
          style={styles.input}
          placeholder="Enter a clear title for your task"
          placeholderTextColor="#888"
          value={formData.taskName}
          onChangeText={(text) => setFormData({ ...formData, taskName: text })}
        />
      )
    },
    3: {
      title: "Describe your task in detail",
      content: (
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Provide specific details about what you need..."
          placeholderTextColor="#888"
          multiline
          numberOfLines={6}
          value={formData.description}
          onChangeText={(text) => setFormData({ ...formData, description: text })}
        />
      )
    },
    4: {
      title: "When do you need this done?",
      content: (
        <TextInput
          style={styles.input}
          placeholder="e.g., 3 days, 2 weeks, 1 month"
          placeholderTextColor="#888"
          value={formData.timeframe}
          onChangeText={(text) => setFormData({ ...formData, timeframe: text })}
        />
      )
    },
    5: {
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
      )
    }
  };

  const animateSlide = (direction: 'forward' | 'backward') => {
    Animated.sequence([
      Animated.timing(slideAnim, {
        toValue: direction === 'forward' ? 1 : -1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 0,
        useNativeDriver: true,
      })
    ]).start();
  };

  const handleNext = () => {
    if (step < 5) {
      animateSlide('forward');
      setStep(step + 1);
    } else {
      handleSubmit();
    }
  };

  const handleBack = () => {
    if (step > 1) {
      animateSlide('backward');
      setStep(step - 1);
    }
  };

  const validateCurrentStep = (): boolean => {
    switch (step) {
      case 2:
        return formData.taskName.trim().length > 0;
      case 3:
        return formData.description.trim().length > 0;
      case 4:
        return formData.timeframe.trim().length > 0;
      case 5:
        return formData.budget.trim().length > 0;
      default:
        return true;
    }
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/tasks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      setIsSuccessModalVisible(true);
      setTimeout(() => {
        setIsSuccessModalVisible(false);
        // Reset form
        setFormData({
          isAnonymous: false,
          taskName: "",
          description: "",
          timeframe: "",
          budget: "",
        });
        setStep(1);
      }, 2000);
    } catch (error) {
      Alert.alert("Error", "Failed to post task. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
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
        <Text style={styles.stepTitle}>{slides[step as keyof typeof slides].title}</Text>
        {slides[step as keyof typeof slides].content}
      </Animated.View>

      <View style={styles.buttonContainer}>
        {step > 1 && (
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Ionicons name="arrow-back" size={24} color="#666" />
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
            {step === 5 ? (isLoading ? "Posting..." : "Post Task") : "Next"}
          </Text>
          {step < 5 && <Ionicons name="arrow-forward" size={24} color="#fff" />}
        </TouchableOpacity>
      </View>

      <Modal
        transparent
        visible={isSuccessModalVisible}
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Ionicons name="checkmark-circle" size={60} color="#4CAF50" />
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
    backgroundColor: "#fff",
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
    backgroundColor: "#E0E0E0",
    marginHorizontal: 5,
  },
  progressDotActive: {
    backgroundColor: "#2196F3",
    transform: [{ scale: 1.2 }],
  },
  slideContainer: {
    marginBottom: 30,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#333",
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
    backgroundColor: "#F5F5F5",
    gap: 15,
  },
  optionButtonSelected: {
    backgroundColor: "#2196F3",
  },
  optionText: {
    fontSize: 16,
    color: "#333",
    fontWeight: "500",
  },
  optionTextSelected: {
    color: "#fff",
  },
  input: {
    backgroundColor: "#F5F5F5",
    padding: 15,
    borderRadius: 12,
    fontSize: 16,
    color: "#333",
  },
  textArea: {
    height: 120,
    textAlignVertical: "top",
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
    color: "#666",
    fontSize: 16,
    fontWeight: "500",
  },
  nextButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2196F3",
    padding: 15,
    paddingHorizontal: 30,
    borderRadius: 12,
    gap: 10,
  },
  buttonDisabled: {
    backgroundColor: "#BDBDBD",
  },
  nextButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#fff",
    padding: 30,
    borderRadius: 15,
    alignItems: "center",
    gap: 15,
  },
  modalText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
});

export default AddGig;