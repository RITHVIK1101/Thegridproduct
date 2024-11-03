import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Button,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import Icon from "react-native-vector-icons/Ionicons";

const AddProductScreen: React.FC = () => {
  const navigation = useNavigation();
  const [productName, setProductName] = useState("");
  const [price, setPrice] = useState("");
  const [tags, setTags] = useState("");
  const [image, setImage] = useState("");

  const addProduct = async () => {
    try {
      const response = await fetch("http://10.0.0.174:8080/products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: productName,
          price: price,
          tags: tags,
          image: image,
        }),
      });

      if (response.ok) {
        console.log("Product added successfully");
        navigation.goBack();
      } else {
        console.error("Failed to add product");
      }
    } catch (error) {
      console.error("Error adding product:", error);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Icon name="arrow-back" size={24} color="#000" />
      </TouchableOpacity>
      <Text style={styles.title}>Add Product</Text>

      <TextInput
        style={styles.input}
        placeholder="Product Name"
        value={productName}
        onChangeText={setProductName}
      />

      <TouchableOpacity style={styles.imageUploadButton}>
        <Text style={styles.imageUploadText}>Upload Image</Text>
      </TouchableOpacity>

      <TextInput
        style={styles.input}
        placeholder="Price"
        value={price}
        onChangeText={setPrice}
        keyboardType="numeric"
      />

      <TextInput
        style={styles.input}
        placeholder="Tags"
        value={tags}
        onChangeText={setTags}
      />

      <Button title="Add Product" onPress={addProduct} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { fontSize: 24, fontWeight: "bold", marginVertical: 15 },
  input: { borderWidth: 1, padding: 10, borderRadius: 10, marginVertical: 10 },
  imageUploadButton: {
    padding: 10,
    backgroundColor: "#ddd",
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 15,
  },
  imageUploadText: { fontSize: 16 },
});

export default AddProductScreen;
