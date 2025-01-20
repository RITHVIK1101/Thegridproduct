// RequestProduct.tsx

import React, { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  Animated,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  ScrollView,
  Easing,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useNavigation } from "@react-navigation/native";

const RequestProduct: React.FC = () => {
  const navigation = useNavigation();

  const [productName, setProductName] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccessModalVisible, setIsSuccessModalVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const errorOpacity = useRef(new Animated.Value(0)).current;

  // Function to display error messages with animation
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

  // Handler for the Request Product button
  const handleRequestProduct = () => {
    if (!productName.trim()) {
      showError("Please enter a product name.");
      return;
    }

    if (!description.trim()) {
      showError("Please enter a description.");
      return;
    }

    // Simulate a submission process
    setIsSubmitting(true);

    setTimeout(() => {
      setIsSubmitting(false);
      setIsSuccessModalVisible(true);
      setProductName("");
      setDescription("");
    }, 1500);
  };

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
          {/* Slide Content */}
          <View style={styles.slideContainer}>
            <Text style={styles.stepTitle}>Request a Product</Text>

            <Text style={styles.label}>Product Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter product name"
              placeholderTextColor="#888"
              value={productName}
              onChangeText={(text) => setProductName(text)}
            />

            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Provide a detailed description of the product."
              placeholderTextColor="#888"
              multiline
              numberOfLines={4}
              value={description}
              onChangeText={(text) => setDescription(text)}
            />

            <TouchableOpacity
              style={styles.requestButton}
              onPress={handleRequestProduct}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Text style={styles.requestButtonText}>Request Product</Text>
                  <Ionicons name="arrow-forward" size={20} color="#fff" />
                </>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </TouchableWithoutFeedback>

      {/* Success Modal */}
      <Modal transparent visible={isSuccessModalVisible} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Ionicons name="checkmark-circle" size={60} color="#9C27B0" />
            <Text style={styles.modalText}>Product Requested Successfully!</Text>
            <TouchableOpacity
              style={styles.closeModalButton}
              onPress={() => setIsSuccessModalVisible(false)}
            >
              <Text style={styles.closeModalButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

export default RequestProduct;

// Styles (matching AddGig.tsx and AddProduct.tsx)
const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: "#000000", // Dark background
  },
  container: {
    flex: 1,
    padding: 20,
    paddingTop: 40, // Shifted up by adding paddingTop
  },
  errorToast: {
    position: "absolute",
    top: Platform.OS === "ios" ? 50 : 20, // Adjusted top position for different platforms
    left: 20,
    right: 20,
    paddingVertical: 15,
    backgroundColor: "#FF6B6B",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 10,
    zIndex: 9999,
  },
  errorToastText: {
    color: "#fff",
    fontWeight: "700",
    textAlign: "center",
  },
  slideContainer: {
    // Removed marginBottom since progress dot is removed
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#BB86FC", // Consistent purple color
    marginBottom: 20,
    textAlign: "center",
  },
  label: {
    fontSize: 16,
    color: "#BB86FC",
    marginBottom: 5,
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
  requestButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#BB86FC", // Exact same purple color as AddProduct and AddGig
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 12,
    justifyContent: "center",
    shadowColor: "#BB86FC",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 5,
    marginTop: 10,
  },
  requestButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginRight: 10,
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
    width: "80%",
  },
  modalText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
    textAlign: "center",
    marginVertical: 10,
  },
  closeModalButton: {
    backgroundColor: "#BB86FC",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginTop: 10,
  },
  closeModalButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
