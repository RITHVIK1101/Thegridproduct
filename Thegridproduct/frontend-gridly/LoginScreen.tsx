// LoginScreen.tsx

import React, { useState, useContext, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Animated,
  Dimensions,
  Platform,
  KeyboardAvoidingView,
  Keyboard,
  TouchableWithoutFeedback,
  Easing, // Import Easing separately
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "./navigationTypes";
import { UserContext, StudentType } from "./UserContext"; // Import StudentType
import { NGROK_URL } from "@env";
import * as SecureStore from "expo-secure-store";
import DropDownPicker from "react-native-dropdown-picker";
import { collegeList, College } from "./data/collegeList";
import { highSchoolList, HighSchool } from "./data/highschoolList";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "Login">;

const { width } = Dimensions.get("window");

const LoginScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { setUser } = useContext(UserContext);

  const [isLogin, setIsLogin] = useState(true);
  const [toggleAnim] = useState(new Animated.Value(0));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  // Shared Dropdown State for Signup
  const [open, setOpen] = useState(false);
  const [selectedInstitution, setSelectedInstitution] = useState("");
  const [items, setItems] = useState<Array<{ label: string; value: string }>>(
    collegeList.map((college: College) => ({
      label: college.institution,
      value: college.institution,
    }))
  );

  // Signup Specific State
  const [studentType, setStudentType] = useState<
    "highschool" | "university" | null
  >(null);
  const [isSelectingStudentType, setIsSelectingStudentType] = useState(false);

  useEffect(() => {
    // Reset form fields when toggling between login and signup
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setFirstName("");
    setLastName("");
    setSelectedInstitution("");
    setStudentType(null);
    setIsSelectingStudentType(false);
    setOpen(false);
  }, [isLogin]);

  const toggleForm = () => {
    setIsLogin(!isLogin);
    Animated.spring(toggleAnim, {
      toValue: isLogin ? 1 : 0,
      friction: 8,
      useNativeDriver: false,
    }).start();
  };

  const handleApiRequest = async (url: string, payload: object) => {
    try {
      const fullUrl = `${NGROK_URL}${url}`;
      console.log(`Making request to: ${fullUrl}`);
      console.log(`Payload:`, payload);

      const response = await fetch(fullUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const contentType = response.headers.get("content-type");
      console.log("Response status:", response.status);
      console.log("Content-Type:", contentType);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Error response text:", errorText);
        throw new Error(
          `Request failed with status ${response.status}: ${errorText}`
        );
      } else if (!contentType || !contentType.includes("application/json")) {
        const errorText = await response.text();
        console.error("Unexpected response format. Response text:", errorText);
        throw new Error("Unexpected response format. Expected JSON.");
      }

      const data = await response.json();
      console.log("Response data:", data);
      return data;
    } catch (error) {
      console.error("API request error:", error);
      throw error;
    }
  };

  const handleLogin = async () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert("Invalid Email", "Please enter a valid email address.");
      return;
    }
    if (password.length < 6) {
      Alert.alert(
        "Weak Password",
        "Password must be at least 6 characters long."
      );
      return;
    }

    try {
      const payload = {
        email,
        password,
      };

      const data = await handleApiRequest("/login", payload);

      console.log("Login Data:", data); // Log the received data

      const {
        token,
        userId,
        institution,
        studentType: responseStudentType,
      } = data;

      // Securely store the token and userId
      await SecureStore.setItemAsync("userToken", token);
      await SecureStore.setItemAsync("userId", userId.toString());

      if (!institution) {
        throw new Error(
          "Institution information is missing from the response."
        );
      }

      if (!responseStudentType) {
        throw new Error(
          "Student type information is missing from the response."
        );
      }

      // Validate and map studentType to enum
      if (
        responseStudentType !== "highschool" &&
        responseStudentType !== "university"
      ) {
        throw new Error("Received invalid student type from the server.");
      }

      const mappedStudentType =
        responseStudentType === "highschool"
          ? StudentType.HighSchool
          : StudentType.University;

      await saveUserData(token, userId, institution, mappedStudentType);
    } catch (error) {
      Alert.alert(
        "Login Error",
        error instanceof Error ? error.message : "An unknown error occurred."
      );
    }
  };

  const handleSignup = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert("Missing Fields", "Please enter your first and last name.");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert("Invalid Email", "Please enter a valid email address.");
      return;
    }
    if (password.length < 6) {
      Alert.alert(
        "Weak Password",
        "Password must be at least 6 characters long."
      );
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert(
        "Passwords do not match",
        "Please ensure your passwords match."
      );
      return;
    }
    if (!studentType) {
      Alert.alert(
        "Select Student Type",
        "Please select whether you are a high school or university student."
      );
      return;
    }
    if (!selectedInstitution) {
      Alert.alert(
        "Missing Field",
        `Please select your ${
          studentType === "university" ? "university" : "high school"
        }.`
      );
      return;
    }

    try {
      const payload = {
        email,
        password,
        firstName,
        lastName,
        studentType,
        institution: selectedInstitution,
      };

      const data = await handleApiRequest("/signup", payload);

      console.log("Signup Data:", data); // Log the received data

      const {
        token,
        userId,
        institution,
        studentType: responseStudentType,
      } = data;

      // Securely store the token and userId
      await SecureStore.setItemAsync("userToken", token);
      await SecureStore.setItemAsync("userId", userId.toString());

      if (!institution) {
        throw new Error(
          "Institution information is missing from the response."
        );
      }

      if (!responseStudentType) {
        throw new Error(
          "Student type information is missing from the response."
        );
      }

      // Validate and map studentType to enum
      if (
        responseStudentType !== "highschool" &&
        responseStudentType !== "university"
      ) {
        throw new Error("Received invalid student type from the server.");
      }

      const mappedStudentType =
        responseStudentType === "highschool"
          ? StudentType.HighSchool
          : StudentType.University;

      await saveUserData(token, userId, institution, mappedStudentType);
    } catch (error) {
      Alert.alert(
        "Signup Error",
        error instanceof Error ? error.message : "An unknown error occurred."
      );
    }
  };

  const saveUserData = async (
    token: string,
    userId: string,
    institution: string,
    studentType: StudentType
  ) => {
    // Update User Context
    setUser({ userId, token, institution, studentType });
    navigation.navigate("Dashboard"); // Navigate to Dashboard or appropriate screen
  };

  const renderLoginForm = () => (
    <View style={styles.formBox}>
      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="#ffffff" // Changed to pure white
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor="#ffffff" // Changed to pure white
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="password"
      />

      {/* Removed Student Type Selection for Login */}

      <TouchableOpacity style={styles.button} onPress={handleLogin}>
        <LinearGradient
          colors={["#3b5998", "#192f6a"]}
          style={styles.gradientButton}
        >
          <Text style={styles.buttonText}>Login</Text>
          <Ionicons
            name="log-in-outline"
            size={20}
            color="#fff"
            style={{ marginLeft: 8 }}
          />
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );

  const renderStudentTypeSelection = () => (
    <View style={styles.studentTypeContainer}>
      <View style={styles.studentTypeButtons}>
        {/* High School Student Button */}
        <TouchableOpacity
          style={styles.studentTypeButton}
          onPress={() => {
            setStudentType("highschool");
            setIsSelectingStudentType(false);
            setItems(
              highSchoolList.map((highschool: HighSchool) => ({
                label: highschool.institution,
                value: highschool.institution,
              }))
            );
          }}
        >
          <LinearGradient
            colors={["#6a11cb", "#2575fc"]}
            style={[
              styles.gradientStudentButton,
              studentType === "highschool" && styles.selectedGradient,
            ]}
          >
            <Ionicons name="school-outline" size={24} color="#fff" />
            <View style={styles.buttonTextContainer}>
              <Text style={styles.studentTypeTitle}>High School</Text>
              <Text style={styles.studentTypeSubtitle}>Student</Text>
            </View>
          </LinearGradient>
        </TouchableOpacity>

        {/* University Student Button */}
        <TouchableOpacity
          style={styles.studentTypeButton}
          onPress={() => {
            setStudentType("university");
            setIsSelectingStudentType(false);
            setItems(
              collegeList.map((college: College) => ({
                label: college.institution,
                value: college.institution,
              }))
            );
          }}
        >
          <LinearGradient
            colors={["#ff7e5f", "#feb47b"]}
            style={[
              styles.gradientStudentButton,
              studentType === "university" && styles.selectedGradient,
            ]}
          >
            <Ionicons name="book-outline" size={24} color="#fff" />
            <View style={styles.buttonTextContainer}>
              <Text style={styles.studentTypeTitle}>University</Text>
              <Text style={styles.studentTypeSubtitle}>Student</Text>
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderSignupForm = () => (
    <View style={styles.formBox}>
      {!studentType && (
        <View style={styles.studentTypePrompt}>
          {renderStudentTypeSelection()}
        </View>
      )}

      {studentType && (
        <>
          <TextInput
            style={styles.input}
            placeholder="First Name"
            placeholderTextColor="#ffffff" // Changed to pure white
            value={firstName}
            onChangeText={setFirstName}
            autoCapitalize="words"
            autoComplete="name"
          />
          <TextInput
            style={styles.input}
            placeholder="Last Name"
            placeholderTextColor="#ffffff" // Changed to pure white
            value={lastName}
            onChangeText={setLastName}
            autoCapitalize="words"
            autoComplete="name"
          />
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#ffffff" // Changed to pure white
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#ffffff" // Changed to pure white
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="password"
          />
          <TextInput
            style={styles.input}
            placeholder="Confirm Password"
            placeholderTextColor="#ffffff" // Changed to pure white
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="password"
          />
          <View style={styles.dropdownContainer}>
            <DropDownPicker
              open={open}
              value={selectedInstitution}
              items={items}
              setOpen={setOpen}
              setValue={setSelectedInstitution}
              setItems={setItems}
              searchable
              searchPlaceholder={
                studentType === "university"
                  ? "Search your university..."
                  : "Search your high school..."
              }
              placeholder={
                studentType === "university"
                  ? "Select your university"
                  : "Select your high school"
              }
              style={styles.dropdown}
              dropDownContainerStyle={styles.dropdownList}
              labelStyle={styles.dropdownLabel}
              placeholderStyle={styles.dropdownPlaceholder}
              selectedItemLabelStyle={styles.dropdownSelectedLabel}
              searchTextInputStyle={styles.searchInput}
              listMode="MODAL"
              modalProps={{
                animationType: "slide",
              }}
              activityIndicatorColor="#3b5998"
              theme="DARK"
              modalContentContainerStyle={styles.modalContentContainer}
              modalTitle={
                studentType === "university"
                  ? "Select Your University"
                  : "Select Your High School"
              }
              modalTitleStyle={styles.modalTitleStyle}
              customItemContainerStyle={styles.customItemContainerStyle}
              customItemLabelStyle={styles.customItemLabelStyle}
            />
          </View>
          <TouchableOpacity style={styles.button} onPress={handleSignup}>
            <LinearGradient
              colors={
                studentType === "university"
                  ? ["#ff7e5f", "#feb47b"]
                  : ["#6a11cb", "#2575fc"]
              }
              style={styles.gradientButton}
            >
              <Text style={styles.buttonText}>Signup</Text>
              <Ionicons
                name={
                  studentType === "university"
                    ? "person-add-outline"
                    : "school-outline"
                }
                size={20}
                color="#fff"
                style={{ marginLeft: 8 }}
              />
            </LinearGradient>
          </TouchableOpacity>
        </>
      )}
    </View>
  );

  // Animated rotation for the logo
  const rotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: 10000, // 10 seconds for a full rotation
        useNativeDriver: true,
        easing: Easing.linear, // Correctly use Easing.linear
      })
    ).start();
  }, [rotation]);

  const spin = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <LinearGradient colors={["#121212", "#1E1E1E"]} style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? -100 : -100} // Adjust this value as needed
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <Animated.ScrollView
            contentContainerStyle={styles.scrollViewContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.innerContainer}>
              {/* Header Section with Logo and Title */}
              <View style={styles.headerContainer}>
                <Animated.View style={{ transform: [{ rotate: spin }] }}>
                  <Ionicons name="grid-outline" size={42} color="#ff7e5f" />
                </Animated.View>
                <Text style={styles.title}>Gridly</Text>
              </View>

              {/* Slogan */}
              <Text style={styles.slogan}>
                Connect Students. Build Communities.
              </Text>

              {/* Toggle between Login and Signup */}
              <View style={styles.toggleContainer}>
                <TouchableOpacity
                  style={[
                    styles.toggleButton,
                    isLogin ? styles.activeToggle : styles.inactiveToggle,
                  ]}
                  onPress={() => !isLogin && toggleForm()}
                >
                  <Text
                    style={[
                      styles.toggleButtonText,
                      isLogin
                        ? styles.activeToggleText
                        : styles.inactiveToggleText,
                    ]}
                  >
                    Login
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.toggleButton,
                    !isLogin ? styles.activeToggle : styles.inactiveToggle,
                  ]}
                  onPress={() => isLogin && toggleForm()}
                >
                  <Text
                    style={[
                      styles.toggleButtonText,
                      !isLogin
                        ? styles.activeToggleText
                        : styles.inactiveToggleText,
                    ]}
                  >
                    Signup
                  </Text>
                </TouchableOpacity>
                <Animated.View
                  style={[
                    styles.slider,
                    {
                      transform: [
                        {
                          translateX: toggleAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0, width / 2 - 40],
                          }),
                        },
                      ],
                    },
                  ]}
                />
              </View>

              <Animated.View style={styles.formContainer}>
                {isLogin ? renderLoginForm() : renderSignupForm()}
              </Animated.View>
            </View>
          </Animated.ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
};

export default LoginScreen;
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollViewContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  innerContainer: {
    width: "100%",
    maxWidth: 400,
    alignSelf: "center",
    padding: 20,
    borderRadius: 25,
  },
  headerContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  title: {
    fontSize: 32,
    fontFamily: Platform.OS === "ios" ? "HelveticaNeue-Bold" : "Roboto",
    fontWeight: "700",
    color: "#fff",
    marginLeft: 10, // Space between logo and title
    textAlign: "center",
  },
  slogan: {
    fontSize: 16,
    color: "#ccc",
    textAlign: "center",
    marginBottom: 20,
  },
  spinningLogo: {
    width: 30, // Smaller size for the logo
    height: 30,
    borderRadius: 18, // Fully round shape
    alignItems: "center",
    justifyContent: "center",
  },
  logoGradient: {
    width: "100%",
    height: "100%",
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent", // Transparent background for the gradient
  },
  icon: {
    fontSize: 24, // Adjusted size for the icon
    color: "#fff", // Icon color remains white for contrast
  },
  toggleContainer: {
    flexDirection: "row",
    marginBottom: 15,
    borderRadius: 25,
    backgroundColor: "#333", // Dark background for toggle
    overflow: "hidden",
    position: "relative",
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    zIndex: 2,
  },
  toggleButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ccc",
  },
  activeToggle: {
    backgroundColor: "#444",
  },
  inactiveToggle: {
    backgroundColor: "#333",
  },
  activeToggleText: {
    color: "#fff",
  },
  inactiveToggleText: {
    color: "#ccc",
  },
  slider: {
    position: "absolute",
    bottom: 0,
    left: 0,
    width: width / 2 - 40,
    height: 3,
    backgroundColor: "#8a2be2", // Purple color
    borderRadius: 2,
  },
  formContainer: {
    overflow: "hidden",
    paddingBottom: 10,
  },
  formBox: {
    width: "100%",
  },
  input: {
    height: 45,
    borderColor: "#555",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 15,
    marginBottom: 12,
    color: "#fff",
    backgroundColor: "rgba(44, 44, 44, 0.8)",
    fontSize: 15,
    fontFamily: Platform.OS === "ios" ? "HelveticaNeue" : "Roboto",
  },
  dropdownContainer: {
    marginBottom: 12,
    zIndex: 1000,
  },
  dropdown: {
    backgroundColor: "rgba(44, 44, 44, 0.8)",
    borderColor: "#555",
    height: 50,
    borderRadius: 12,
    paddingHorizontal: 10,
  },
  dropdownList: {
    backgroundColor: "rgba(44, 44, 44, 0.95)",
    borderColor: "#555",
    borderRadius: 12,
    paddingHorizontal: 10,
  },
  dropdownLabel: {
    fontSize: 16,
    color: "#fff",
  },
  dropdownPlaceholder: {
    fontSize: 16,
    color: "#ffffff",
  },
  dropdownSelectedLabel: {
    color: "#8a2be2", // Purple color for selected items
    fontWeight: "600",
  },
  searchInput: {
    height: 40,
    borderColor: "#555",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 16,
    color: "#fff",
    backgroundColor: "#3a3a3a",
  },
  button: {
    borderRadius: 30,
    overflow: "hidden",
    marginTop: 10,
  },
  gradientButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 30,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
  modalContentContainer: {
    backgroundColor: "rgba(44, 44, 44, 0.95)",
  },
  modalTitleStyle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#8a2be2", // Purple color for modal title
    textAlign: "center",
    marginVertical: 10,
  },
  customItemContainerStyle: {
    backgroundColor: "rgba(58, 58, 58, 0.95)",
    borderRadius: 10,
    marginVertical: 5,
    padding: 10,
  },
  customItemLabelStyle: {
    color: "#fff",
    fontSize: 16,
  },
  studentTypeContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
  subtitle: {
    fontSize: 18,
    color: "#fff",
    marginBottom: 15,
    textAlign: "center",
  },
  studentTypeButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
  },
  studentTypeButton: {
    flex: 1,
    marginHorizontal: 5,
  },
  gradientStudentButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 15,
    borderRadius: 15,
    justifyContent: "center",
  },
  selectedGradient: {
    borderWidth: 2,
    borderColor: "#fff",
  },
  buttonTextContainer: {
    marginLeft: 10,
    alignItems: "flex-start",
  },
  studentTypeTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  studentTypeSubtitle: {
    color: "#fff",
    fontSize: 14,
  },
  studentTypePrompt: {
    marginBottom: 20,
  },
});
