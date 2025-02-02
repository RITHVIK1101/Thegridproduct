import React, { useState, useRef, useContext } from "react";
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
import { UserContext } from "./UserContext"; // Import the UserContext

const RequestProduct: React.FC = () => {
  const navigation = useNavigation();
  const { token } = useContext(UserContext); // Access the token from UserContext

  const [productName, setProductName] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccessModalVisible, setIsSuccessModalVisible] = useState(false);
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

  const handleRequestProduct = async () => {
    if (!productName.trim()) {
      showError("Please enter a product name.");
      return;
    }

    if (!description.trim()) {
      showError("Please enter a description.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(
        "https://thegridproduct-production.up.railway.app/requests",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`, // Include the JWT token in the Authorization header
          },
          body: JSON.stringify({
            productName,
            description,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to submit request");
      }

      const data = await response.json();
      setIsSubmitting(false);
      setIsSuccessModalVisible(true);
      setProductName("");
      setDescription("");
      setTimeout(() => {
        setIsSuccessModalVisible(false);
        navigation.goBack();
      }, 1500);
    } catch (error) {
      setIsSubmitting(false);
      showError(error.message || "An error occurred. Please try again.");
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.outerContainer}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
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

      <Modal transparent visible={isSuccessModalVisible} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Ionicons name="checkmark-circle" size={60} color="#9C27B0" />
            <Text style={styles.modalText}>
              Product Requested Successfully!
            </Text>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

export default RequestProduct;

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: "#000000",
  },
  container: {
    flex: 1,
    padding: 20,
    paddingTop: 40,
  },
  errorToast: {
    position: "absolute",
    top: Platform.OS === "ios" ? 50 : 20,
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
  slideContainer: {},
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
    backgroundColor: "#BB86FC",
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
});
