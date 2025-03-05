import React, { useState, useRef, useContext } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "./navigationTypes";
import { NGROK_URL } from "@env";
import * as SecureStore from "expo-secure-store";
import { UserContext } from "./UserContext";
import Ionicons from "react-native-vector-icons/Ionicons";

type VerificationScreenRouteProp = RouteProp<
  RootStackParamList,
  "Verification"
>;
type VerificationScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "Verification"
>;

const VerificationScreen: React.FC = () => {
  const navigation = useNavigation<VerificationScreenNavigationProp>();
  const route = useRoute<VerificationScreenRouteProp>();
  const { email } = route.params; // The email used during signup
  const { setUser } = useContext(UserContext); // Get setUser from UserContext

  // Store each digit in an array of length 6
  const [codeDigits, setCodeDigits] = useState<string[]>([
    "",
    "",
    "",
    "",
    "",
    "",
  ]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false); // Loading state

  // Create refs for each of the 6 TextInputs
  const inputRefs = useRef<Array<TextInput | null>>([]);

  // Update the digit at the given index, and if filled, auto-focus the next box.
  const updateDigit = (index: number, value: string) => {
    if (value.length > 1) {
      // Allow only one character per box
      value = value.slice(-1);
    }
    const newDigits = [...codeDigits];
    newDigits[index] = value;
    setCodeDigits(newDigits);

    // If a digit was entered and we're not at the last box, focus next input.
    if (value !== "" && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleVerify = async () => {
    setError(""); // Clear previous errors
    setIsLoading(true); // Start loading
    const code = codeDigits.join("");

    if (code.length < 6) {
      setError("Please enter a complete 6-digit code.");
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch(`${NGROK_URL}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        setError(errorText || "Verification failed");
        setIsLoading(false);
        return;
      }

      const data = await response.json();
      console.log("Verification Response:", data);

      // Extract user details from response, including grids
      const {
        token,
        userId,
        institution,
        studentType,
        firstName,
        lastName,
        profilePic,
        grids,
      } = data;

      if (!token || !userId || !institution) {
        setError("Invalid user data received. Please try again.");
        setIsLoading(false);
        return;
      }

      const validStudentType = studentType || "university";
      const validProfilePic = profilePic || null;
      const validGrids = grids ?? 0; // Default grids to 0 if missing

      // Store data in SecureStore
      await SecureStore.setItemAsync("userToken", token);
      await SecureStore.setItemAsync("userId", userId);
      await SecureStore.setItemAsync("firstName", firstName || "Unknown");
      await SecureStore.setItemAsync("lastName", lastName || "User");
      await SecureStore.setItemAsync("institution", institution);
      await SecureStore.setItemAsync("studentType", validStudentType);
      if (validProfilePic) {
        await SecureStore.setItemAsync("profilePic", validProfilePic);
      }
      await SecureStore.setItemAsync("grids", validGrids.toString());

      // Update the User Context
      setUser({
        token,
        userId,
        institution,
        studentType: validStudentType,
        firstName: firstName || "Unknown",
        lastName: lastName || "User",
        profilePic: validProfilePic,
        grids: validGrids,
      });

      // Navigate to Dashboard
      navigation.navigate("Dashboard");
    } catch (err) {
      setError("An error occurred. Please try again.");
    } finally {
      setIsLoading(false); // Stop loading
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Email Verification</Text>
      <Text style={styles.subtitle}>
        Enter the 6-digit code sent to <Text style={styles.bold}>{email}</Text>
      </Text>
      <View style={styles.warningContainer}>
        <Ionicons name="alert-circle-outline" size={16} color="#A78BFA" />
        <Text style={styles.warningText}>
          Make sure to check your junk/spam folder.
        </Text>
      </View>

      <View style={styles.inputContainer}>
        {codeDigits.map((digit, index) => (
          <TextInput
            key={index}
            style={styles.codeInput}
            value={digit}
            onChangeText={(text) => updateDigit(index, text)}
            keyboardType="numeric"
            maxLength={1}
            ref={(ref) => (inputRefs.current[index] = ref)}
            returnKeyType="done"
          />
        ))}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <TouchableOpacity
        style={[styles.button, isLoading && styles.disabledButton]}
        onPress={handleVerify}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Verify</Text>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0D0D0D",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  title: {
    fontSize: 24,
    color: "#fff",
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: "#bbb",
    marginBottom: 20,
    textAlign: "center",
  },
  bold: {
    fontWeight: "bold",
    color: "#fff",
  },
  inputContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  codeInput: {
    width: 40,
    height: 50,
    backgroundColor: "#1D1D1D",
    borderColor: "#333",
    borderWidth: 1,
    borderRadius: 12,
    textAlign: "center",
    fontSize: 20,
    color: "#fff",
    marginHorizontal: 5,
  },
  button: {
    backgroundColor: "#A78BFA",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 30,
  },
  disabledButton: {
    backgroundColor: "#6D28D9",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  error: {
    color: "#FF6B6B",
    marginBottom: 10,
  },
  warningContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 15,
    backgroundColor: "rgba(167, 139, 250, 0.1)",
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  warningText: {
    color: "#A78BFA",
    fontSize: 14,
    marginLeft: 6,
    fontWeight: "500",
    textAlign: "center",
  },
});

export default VerificationScreen;
