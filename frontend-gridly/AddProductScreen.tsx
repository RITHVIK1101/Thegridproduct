import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  TextInput,
  ScrollView,
  FlatList,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import Ionicons from "react-native-vector-icons/Ionicons";

const AddProduct: React.FC = () => {
  const [images, setImages] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
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

  const pickImage = async () => {
    if (images.length >= 3) {
      alert("You can only upload up to 3 images.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 1,
    });
    if (!result.canceled) {
      const newImages = result.assets.map((asset) => asset.uri);
      if (images.length + newImages.length > 3) {
        alert("You can only upload up to 3 images.");
      } else {
        setImages((prevImages) => [...prevImages, ...newImages]);
      }
    }
  };

  const removeImage = (index: number) => {
    setImages((prevImages) => prevImages.filter((_, i) => i !== index));
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prevTags) =>
      prevTags.includes(tag)
        ? prevTags.filter((t) => t !== tag)
        : [...prevTags, tag]
    );
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.heading}>Add a New Product</Text>

      {/* Image Counter */}
      <Text style={styles.imageCounter}>{`${images.length}/3 Images`}</Text>

      {/* Upload Images Section */}
      <View style={styles.imageUploadContainer}>
        <TouchableOpacity style={styles.uploadButton} onPress={pickImage}>
          <Ionicons name="cloud-upload-outline" size={30} color="#555" />
          <Text style={styles.uploadButtonText}>Upload Images</Text>
        </TouchableOpacity>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {images.map((image, index) => (
            <View key={index} style={styles.imageContainer}>
              <Image source={{ uri: image }} style={styles.image} />
              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => removeImage(index)}
              >
                <Ionicons name="close-circle-outline" size={24} color="#444" />
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      </View>

      {/* Product Details */}
      <TextInput
        style={styles.input}
        placeholder="Product Title"
        placeholderTextColor="#888"
        value={title}
        onChangeText={setTitle}
      />
      <TextInput
        style={styles.input}
        placeholder="Price ($)"
        placeholderTextColor="#888"
        keyboardType="numeric"
        value={price}
        onChangeText={setPrice}
      />
      <TextInput
        style={[styles.input, styles.descriptionInput]}
        placeholder="Description"
        placeholderTextColor="#888"
        multiline
        value={description}
        onChangeText={setDescription}
      />

      {/* Tags Section */}
      <Text style={styles.sectionTitle}>Select Tags</Text>
      <FlatList
        data={availableTags}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.tag,
              selectedTags.includes(item) ? styles.tagSelected : null,
            ]}
            onPress={() => toggleTag(item)}
          >
            <Text
              style={[
                styles.tagText,
                selectedTags.includes(item) ? styles.tagTextSelected : null,
              ]}
            >
              {item}
            </Text>
          </TouchableOpacity>
        )}
      />

      {/* Submit Button */}
      <TouchableOpacity style={styles.submitButton}>
        <Text style={styles.submitButtonText}>Add Product</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

export default AddProduct;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9f9f9",
    padding: 20,
  },
  heading: {
    fontSize: 24,
    fontWeight: "700",
    color: "#333",
    marginBottom: 20,
  },
  imageCounter: {
    fontSize: 14,
    color: "#666",
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
    backgroundColor: "#e6e6e6",
    borderRadius: 10,
    marginBottom: 10,
  },
  uploadButtonText: {
    fontSize: 16,
    color: "#555",
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
    backgroundColor: "rgba(255, 255, 255, 0.8)",
    borderRadius: 12,
  },
  input: {
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    fontSize: 16,
    color: "#333",
    borderWidth: 1,
    borderColor: "#ddd",
  },
  descriptionInput: {
    height: 100,
    textAlignVertical: "top",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#555",
    marginBottom: 10,
  },
  tag: {
    paddingVertical: 8,
    paddingHorizontal: 15,
    backgroundColor: "#eee",
    borderRadius: 20,
    marginRight: 10,
  },
  tagSelected: {
    backgroundColor: "#333",
  },
  tagText: {
    fontSize: 14,
    color: "#666",
  },
  tagTextSelected: {
    color: "#fff",
  },
  submitButton: {
    backgroundColor: "#000",
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 20,
  },
  submitButtonText: {
    fontSize: 16,
    color: "#fff",
    fontWeight: "600",
  },
});
