import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useNavigation } from "@react-navigation/native";
import { NGROK_URL } from "@env";
import { UserContext } from "./UserContext";

const contactOptions = [
  { id: "report", label: "Report Issue/User", icon: "alert-circle-outline" },
  { id: "talk", label: "Talk to Founders", icon: "chatbubbles-outline" },
  { id: "feedback", label: "Give Feedback", icon: "star-outline" },
  { id: "feature", label: "Suggest a Feature", icon: "bulb-outline" },
];

const reportCategories = [
  "Inappropriate Behavior",
  "Bug or Technical Issue",
  "Fraudulent Activity",
  "Scamming",
  "Other",
];

const GetInTouch: React.FC = () => {
  const navigation = useNavigation();
  const { userId, token } = React.useContext(UserContext);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [category, setCategory] = useState<string>("Select a Category");
  const [description, setDescription] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isDropdownVisible, setIsDropdownVisible] = useState<boolean>(false);

  const handleSubmit = async () => {
    if (
      !description.trim() ||
      (selectedOption === "report" && category === "Select a Category")
    ) {
      Alert.alert("Error", "Please fill in all required fields.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`${NGROK_URL}/general-report`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId,
          type: selectedOption,
          category: selectedOption === "report" ? category : null,
          description: description.trim(),
        }),
      });

      if (!response.ok) throw new Error("Failed to submit request.");
      Alert.alert("Success", "Your request has been submitted.");
      setSelectedOption(null);
      setDescription("");
      setCategory("Select a Category");
    } catch (error) {
      Alert.alert("Error", "Failed to submit request. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>


      {/* Contact Options */}
      {!selectedOption ? (
        <ScrollView contentContainerStyle={styles.optionsContainer}>
          {contactOptions.map((option) => (
            <TouchableOpacity
              key={option.id}
              style={styles.optionBubble}
              onPress={() => setSelectedOption(option.id)}
            >
              <Ionicons name={option.icon} size={28} color="#FFFFFF" />
              <Text style={styles.optionText}>{option.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : (
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.formContainer}
        >
          {/* Title */}
          <Text style={styles.sectionTitle}>
            {contactOptions.find((opt) => opt.id === selectedOption)?.label}
          </Text>

          {/* Report: Category Dropdown */}
          {selectedOption === "report" && (
            <>
              <Text style={styles.label}>Category</Text>
              <Pressable
                style={styles.dropdown}
                onPress={() => setIsDropdownVisible(true)}
              >
                <Text
                  style={
                    category === "Select a Category"
                      ? styles.dropdownPlaceholder
                      : styles.dropdownText
                  }
                >
                  {category}
                </Text>
                <Ionicons name="chevron-down" size={16} color="#FFFFFF" />
              </Pressable>
              {isDropdownVisible && (
                <Modal
                  transparent
                  animationType="fade"
                  onRequestClose={() => setIsDropdownVisible(false)}
                >
                  <Pressable
                    style={styles.overlay}
                    onPress={() => setIsDropdownVisible(false)}
                  >
                    <View style={styles.dropdownMenu}>
                      {reportCategories.map((item) => (
                        <TouchableOpacity
                          key={item}
                          style={styles.dropdownItem}
                          onPress={() => {
                            setCategory(item);
                            setIsDropdownVisible(false);
                          }}
                        >
                          <Text style={styles.dropdownText}>{item}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </Pressable>
                </Modal>
              )}
            </>
          )}

          {/* Description Field */}
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={styles.input}
            placeholder="Type here..."
            placeholderTextColor="#AAAAAA"
            multiline
            value={description}
            onChangeText={setDescription}
          />

          {/* Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setSelectedOption(null)}
            >
              <Text style={styles.buttonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.submitButton}
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              <Text style={styles.buttonText}>
                {isSubmitting ? "Submitting..." : "Submit"}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}
    </View>
  );
};

export default GetInTouch;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
  backButton: { marginRight: 10 },
  headerTitle: { fontSize: 22, fontWeight: "700", color: "#BB86FC" },
  optionsContainer: { alignItems: "center", marginTop: 20 },
  optionBubble: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1E1E1E",
    padding: 15,
    borderRadius: 50,
    width: "100%",
    marginBottom: 15,
    justifyContent: "center",
  },
  optionText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
    marginLeft: 10,
  },
  formContainer: { flex: 1, marginTop: 20 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 10,
  },
  label: { color: "#BB86FC", fontSize: 16, marginBottom: 5 },
  dropdown: {
    flexDirection: "row",
    backgroundColor: "#1E1E1E",
    padding: 12,
    borderRadius: 6,
    justifyContent: "space-between",
  },
  dropdownPlaceholder: { color: "#888888", fontSize: 16 },
  dropdownText: { color: "#FFFFFF", fontSize: 16 },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
  },
  dropdownMenu: {
    backgroundColor: "#1E1E1E",
    borderRadius: 6,
    padding: 10,
    marginHorizontal: 50,
  },
  dropdownItem: { paddingVertical: 10 },
  input: {
    backgroundColor: "#1E1E1E",
    color: "#FFFFFF",
    borderRadius: 6,
    padding: 12,
    minHeight: 80,
    textAlignVertical: "top",
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
  },
  cancelButton: { backgroundColor: "#444", padding: 12, borderRadius: 6 },
  submitButton: { backgroundColor: "#BB86FC", padding: 12, borderRadius: 6 },
  buttonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "bold" },
});
