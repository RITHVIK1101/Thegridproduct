import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Button,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { useNavigation } from "@react-navigation/native"; // Import useNavigation hook
import Icon from "react-native-vector-icons/Ionicons";

const AddProductScreen: React.FC = () => {
  const navigation = useNavigation(); // Access navigation
  const [productName, setProductName] = useState("");
  const [price, setPrice] = useState("");
  const [tags, setTags] = useState("");

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

      <Button
        title="Add Product"
        onPress={() => console.log("Product added")}
      />
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
