// AddGig.tsx

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
  Image,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import * as ImagePicker from "expo-image-picker";
import { NGROK_URL } from "@env";
import { useNavigation } from "@react-navigation/native";

const PREDEFINED_CATEGORIES = [
  "Tutoring",
  "Writing",
  "Design",
  "Delivery",
  "Coding",
  "Other",
];

const AddGig: React.FC = () => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [price, setPrice] = useState("");
  const [deliveryTime, setDeliveryTime] = useState("");
  const [requirements, setRequirements] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccessModalVisible, setIsSuccessModalVisible] = useState(false);
  const [showCategoriesModal, setShowCategoriesModal] = useState(false);

  const navigation = useNavigation();

  const handleImageUpload = async () => {
    if (images.length >= 5) {
      Alert.alert("Limit Reached", "You can upload up to 5 images.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 1,
    });

    if (!result.canceled) {
      const newImages = result.assets.map((asset) => asset.uri);
      if (images.length + newImages.length > 5) {
        Alert.alert("Limit Exceeded", "You can upload up to 5 images total.");
      } else {
        setImages((prev) => [...prev, ...newImages]);
      }
    }
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const validateForm = (): boolean => {
    if (title.trim().length === 0) {
      Alert.alert("Required Field Missing", "Please enter a title.");
      return false;
    }

    if (description.trim().length === 0) {
      Alert.alert("Required Field Missing", "Please enter a description.");
      return false;
    }

    return true;
  };

  const handlePostService = async () => {
    if (!validateForm()) return;

    setIsLoading(true);
    const payload = {
      title: title.trim(),
      description: description.trim(),
      category: category || "Other",
      price: price.trim(),
      deliveryTime: deliveryTime.trim(),
      requirements: requirements.trim(),
      images,
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
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      setIsSuccessModalVisible(true);
      // Reset the form after success
      setTitle("");
      setDescription("");
      setCategory(null);
      setPrice("");
      setDeliveryTime("");
      setRequirements("");
      setImages([]);

      setTimeout(() => {
        setIsSuccessModalVisible(false);
        navigation.navigate("Dashboard");
      }, 2000);
    } catch (error) {
      console.error("Error:", error);
      Alert.alert("Error", "Failed to post the service. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={styles.title}>Post a Service</Text>

      <TextInput
        style={styles.input}
        placeholder="Service Title (Required)"
        placeholderTextColor="#888"
        value={title}
        onChangeText={setTitle}
      />

      <TextInput
        style={[styles.input, styles.textArea]}
        placeholder="Service Description (Required)"
        placeholderTextColor="#888"
        multiline
        numberOfLines={4}
        value={description}
        onChangeText={setDescription}
      />

      <TouchableOpacity style={styles.dropdown} onPress={() => setShowCategoriesModal(true)}>
        <Text style={styles.dropdownText}>
          {category ? category : "Select Category (Optional)"}
        </Text>
        <Ionicons name="chevron-down-outline" size={20} color="#ccc" />
      </TouchableOpacity>

      <TextInput
        style={styles.input}
        placeholder="Pricing (Optional, e.g., $25/hour)"
        placeholderTextColor="#888"
        value={price}
        onChangeText={setPrice}
      />

      <TextInput
        style={styles.input}
        placeholder="Delivery Time (Optional, e.g., 2 days)"
        placeholderTextColor="#888"
        value={deliveryTime}
        onChangeText={setDeliveryTime}
      />

      <TextInput
        style={styles.input}
        placeholder="Requirements (Optional)"
        placeholderTextColor="#888"
        value={requirements}
        onChangeText={setRequirements}
      />

      <TouchableOpacity style={styles.uploadButton} onPress={handleImageUpload}>
        <Ionicons name="cloud-upload-outline" size={24} color="#BB86FC" />
        <Text style={styles.uploadButtonText}>Upload Portfolio Images</Text>
      </TouchableOpacity>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {images.map((image, index) => (
          <View key={index} style={styles.imageContainer}>
            <Image source={{ uri: image }} style={styles.image} />
            <TouchableOpacity style={styles.removeButton} onPress={() => removeImage(index)}>
              <Ionicons name="close-circle-outline" size={24} color="#BB86FC" />
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>

      <TouchableOpacity
        style={[styles.postButton, isLoading && styles.buttonDisabled]}
        onPress={handlePostService}
        disabled={isLoading}
      >
        <Text style={styles.postButtonText}>{isLoading ? "Posting..." : "Post Service"}</Text>
      </TouchableOpacity>

      {/* Success Modal */}
      <Modal transparent visible={isSuccessModalVisible} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Ionicons name="checkmark-circle" size={60} color="#9C27B0" />
            <Text style={styles.modalText}>Service Posted Successfully!</Text>
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
    </ScrollView>
  );
};

export default AddGig;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#BB86FC",
    marginBottom: 20,
    textAlign: "center",
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
    marginBottom: 15,
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
  postButton: {
    backgroundColor: "#BB86FC",
    padding: 15,
    borderRadius: 12,
    marginTop: 20,
  },
  buttonDisabled: {
    backgroundColor: "#3A3A3A",
  },
  postButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
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
});
