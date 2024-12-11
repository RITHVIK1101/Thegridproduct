// LoginScreen.tsx

import React, {
  useState,
  useContext,
  useEffect,
  useRef,
  useLayoutEffect,
} from "react";
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
  Easing,
  ScrollView,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "./navigationTypes";
import { UserContext, StudentType } from "./UserContext"; 
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

  const [open, setOpen] = useState(false);
  const [selectedInstitution, setSelectedInstitution] = useState("");
  const [items, setItems] = useState<Array<{ label: string; value: string }>>(
    collegeList.map((college: College) => ({
      label: college.institution,
      value: college.institution,
    }))
  );

  const [studentType, setStudentType] = useState<"highschool" | "university" | null>(null);

  // Animations
  const formOpacity = useRef(new Animated.Value(0)).current;
  const headerScale = useRef(new Animated.Value(0.8)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Reset form fields when toggling between login and signup
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setFirstName("");
    setLastName("");
    setSelectedInstitution("");
    setStudentType(null);
    setOpen(false);

    // Animate form entrance
    Animated.timing(formOpacity, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
      easing: Easing.out(Easing.ease),
    }).start();
  }, [isLogin]);

  useLayoutEffect(() => {
    // Animate header scaling in
    Animated.spring(headerScale, {
      toValue: 1,
      friction: 5,
      useNativeDriver: true,
    }).start();
  }, []);

  useEffect(() => {
    // Animate the icon spinning indefinitely
    Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 10000, 
        useNativeDriver: true,
        easing: Easing.linear,
      })
    ).start();
  }, [spinAnim]);

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

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
        throw new Error(`Request failed with status ${response.status}: ${errorText}`);
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
      Alert.alert("Weak Password", "Password must be at least 6 characters long.");
      return;
    }

    try {
      const payload = { email, password };
      const data = await handleApiRequest("/login", payload);

      console.log("Login Data:", data);
      const { token, userId, institution, studentType: responseStudentType } = data;

      await SecureStore.setItemAsync("userToken", token);
      await SecureStore.setItemAsync("userId", userId.toString());

      if (!institution) throw new Error("Institution information is missing.");
      if (!responseStudentType) throw new Error("Student type information is missing.");

      if (responseStudentType !== "highschool" && responseStudentType !== "university") {
        throw new Error("Invalid student type from server.");
      }

      const mappedStudentType =
        responseStudentType === "highschool" ? StudentType.HighSchool : StudentType.University;

      await saveUserData(token, userId, institution, mappedStudentType);
    } catch (error) {
      Alert.alert("Login Error", error instanceof Error ? error.message : "An unknown error occurred.");
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
      Alert.alert("Weak Password", "Password must be at least 6 characters long.");
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert("Passwords do not match", "Please ensure your passwords match.");
      return;
    }
    if (!studentType) {
      Alert.alert("Select Student Type", "Please select your student type first.");
      return;
    }
    if (!selectedInstitution) {
      Alert.alert(
        "Missing Field",
        `Please select your ${studentType === "university" ? "university" : "high school"}.`
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

      console.log("Signup Data:", data);
      const { token, userId, institution, studentType: responseStudentType } = data;

      await SecureStore.setItemAsync("userToken", token);
      await SecureStore.setItemAsync("userId", userId.toString());

      if (!institution) throw new Error("Institution missing from response.");
      if (!responseStudentType) throw new Error("Student type missing from response.");

      if (responseStudentType !== "highschool" && responseStudentType !== "university") {
        throw new Error("Invalid student type from server.");
      }

      const mappedStudentType =
        responseStudentType === "highschool" ? StudentType.HighSchool : StudentType.University;

      await saveUserData(token, userId, institution, mappedStudentType);
    } catch (error) {
      Alert.alert("Signup Error", error instanceof Error ? error.message : "An unknown error occurred.");
    }
  };

  const saveUserData = async (
    token: string,
    userId: string,
    institution: string,
    studentType: StudentType
  ) => {
    setUser({ userId, token, institution, studentType });
    navigation.navigate("Dashboard");
  };

  const renderLoginForm = () => (
    <Animated.View style={{ opacity: formOpacity }}>
      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="#cccccc"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor="#cccccc"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="password"
      />
      <TouchableOpacity style={styles.button} onPress={handleLogin}>
        <LinearGradient
          colors={["#8a2be2", "#4c2e93"]}
          style={styles.gradientButton}
        >
          <Text style={styles.buttonText}>Login</Text>
          <Ionicons name="log-in-outline" size={20} color="#fff" style={{ marginLeft: 8 }} />
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );

  const renderStudentTypeSelection = () => (
    <View style={styles.studentTypeContainer}>
      <Text style={styles.studentTypeTitle}>Select your student type</Text>
      <View style={styles.studentTypeButtons}>
        <TouchableOpacity
          style={[styles.studentTypeButton, studentType === "highschool" && styles.selectedType]}
          onPress={() => {
            setStudentType("highschool");
            setItems(
              highSchoolList.map((highschool: HighSchool) => ({
                label: highschool.institution,
                value: highschool.institution,
              }))
            );
          }}
        >
          <Ionicons name="school-outline" size={24} color="#fff" style={{ marginBottom: 5 }} />
          <Text style={styles.studentTypeButtonText}>High School</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.studentTypeButton, studentType === "university" && styles.selectedType]}
          onPress={() => {
            setStudentType("university");
            setItems(
              collegeList.map((college: College) => ({
                label: college.institution,
                value: college.institution,
              }))
            );
          }}
        >
          <Ionicons name="book-outline" size={24} color="#fff" style={{ marginBottom: 5 }} />
          <Text style={styles.studentTypeButtonText}>University</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderSignupForm = () => (
    <Animated.View style={{ opacity: formOpacity }}>
      {!studentType && renderStudentTypeSelection()}
      {studentType && (
        <>
          <TextInput
            style={styles.input}
            placeholder="First Name"
            placeholderTextColor="#cccccc"
            value={firstName}
            onChangeText={setFirstName}
            autoCapitalize="words"
          />
          <TextInput
            style={styles.input}
            placeholder="Last Name"
            placeholderTextColor="#cccccc"
            value={lastName}
            onChangeText={setLastName}
            autoCapitalize="words"
          />
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#cccccc"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#cccccc"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
          />
          <TextInput
            style={styles.input}
            placeholder="Confirm Password"
            placeholderTextColor="#cccccc"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            autoCapitalize="none"
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
              activityIndicatorColor="#8a2be2"
              theme="DARK"
              modalContentContainerStyle={styles.modalContentContainer}
              modalTitle={
                studentType === "university"
                  ? "Select Your University"
                  : "Select Your High School"
              }
              modalTitleStyle={styles.modalTitleStyle}
            />
          </View>

          <TouchableOpacity style={styles.button} onPress={handleSignup}>
            <LinearGradient
              colors={["#8a2be2", "#4c2e93"]}
              style={styles.gradientButton}
            >
              <Text style={styles.buttonText}>Signup</Text>
              <Ionicons
                name="person-add-outline"
                size={20}
                color="#fff"
                style={{ marginLeft: 8 }}
              />
            </LinearGradient>
          </TouchableOpacity>
        </>
      )}
    </Animated.View>
  );

  return (
    <LinearGradient colors={["#141E30", "#243B55"]} style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? -100 : -100}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView
            contentContainerStyle={styles.scrollViewContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.innerContainer}>
              {/* Animated Header */}
              <Animated.View style={[styles.headerContainer, { transform: [{ scale: headerScale }] }]}>
                <Animated.View style={{ transform: [{ rotate: spin }] }}>
                  <Ionicons name="grid-outline" size={42} color="#8a2be2" />
                </Animated.View>
                <Text style={styles.title}>Gridly</Text>
              </Animated.View>
              <Text style={styles.slogan}>Connect Students. Build Communities.</Text>

              {/* Toggle Container */}
              <View style={styles.toggleContainer}>
                <TouchableOpacity
                  style={[styles.toggleButton, isLogin ? styles.activeToggle : styles.inactiveToggle]}
                  onPress={() => !isLogin && toggleForm()}
                >
                  <Text
                    style={[
                      styles.toggleButtonText,
                      isLogin ? styles.activeToggleText : styles.inactiveToggleText,
                    ]}
                  >
                    Login
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.toggleButton, !isLogin ? styles.activeToggle : styles.inactiveToggle]}
                  onPress={() => isLogin && toggleForm()}
                >
                  <Text
                    style={[
                      styles.toggleButtonText,
                      !isLogin ? styles.activeToggleText : styles.inactiveToggleText,
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
                            outputRange: [0, width / 2 ],
                          }),
                        },
                      ],
                    },
                  ]}
                />
              </View>

              <View style={styles.formCard}>
                {isLogin ? renderLoginForm() : renderSignupForm()}
              </View>
            </View>
          </ScrollView>
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
    paddingVertical: 30,
    paddingHorizontal: 20,
  },
  innerContainer: {
    width: "100%",
    maxWidth: 420,
    alignSelf: "center",
    borderRadius: 25,
    alignItems: "center",
  },
  headerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  title: {
    fontSize: 34,
    fontWeight: "700",
    color: "#fff",
    marginLeft: 10,
    textAlign: "center",
    fontFamily: Platform.OS === "ios" ? "HelveticaNeue-Bold" : "Roboto",
  },
  slogan: {
    fontSize: 16,
    color: "#ccc",
    textAlign: "center",
    marginBottom: 25,
    fontFamily: Platform.OS === "ios" ? "HelveticaNeue" : "Roboto",
  },
  toggleContainer: {
    flexDirection: "row",
    marginBottom: 15,
    borderRadius: 25,
    backgroundColor: "#2c2c2c",
    position: "relative",
    width: "100%",
    overflow: "hidden",
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
  },
  toggleButtonText: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: Platform.OS === "ios" ? "HelveticaNeue" : "Roboto",
  },
  activeToggle: {
    backgroundColor: "#333",
  },
  inactiveToggle: {
    backgroundColor: "transparent",
  },
  activeToggleText: {
    color: "#fff",
  },
  inactiveToggleText: {
    color: "#aaa",
  },
  slider: {
    position: "absolute",
    bottom: 0,
    left: 0,
    width: width / 2 - 40,
    height: 3,
    backgroundColor: "#8a2be2",
    borderRadius: 2,
  },
  formCard: {
    width: "100%",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 15,
    padding: 20,
    marginTop: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  input: {
    height: 50,
    borderColor: "#444",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 15,
    marginBottom: 12,
    color: "#fff",
    fontSize: 15,
    backgroundColor: "rgba(0,0,0,0.3)",
    fontFamily: Platform.OS === "ios" ? "HelveticaNeue" : "Roboto",
  },
  dropdownContainer: {
    marginBottom: 12,
    zIndex: 1000,
  },
  dropdown: {
    backgroundColor: "rgba(0,0,0,0.3)",
    borderColor: "#444",
    height: 50,
    borderRadius: 12,
    paddingHorizontal: 10,
  },
  dropdownList: {
    backgroundColor: "#2c2c2c",
    borderColor: "#444",
    borderRadius: 12,
    paddingHorizontal: 10,
  },
  dropdownLabel: {
    fontSize: 16,
    color: "#fff",
    fontFamily: Platform.OS === "ios" ? "HelveticaNeue" : "Roboto",
  },
  dropdownPlaceholder: {
    fontSize: 16,
    color: "#cccccc",
  },
  dropdownSelectedLabel: {
    color: "#8a2be2",
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
    fontFamily: Platform.OS === "ios" ? "HelveticaNeue-Bold" : "Roboto",
  },
  modalContentContainer: {
    backgroundColor: "#2c2c2c",
  },
  modalTitleStyle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#8a2be2",
    textAlign: "center",
    marginVertical: 10,
    fontFamily: Platform.OS === "ios" ? "HelveticaNeue-Bold" : "Roboto",
  },
  studentTypeContainer: {
    marginBottom: 20,
    alignItems: "center",
  },
  studentTypeTitle: {
    fontSize: 18,
    color: "#fff",
    marginBottom: 15,
    fontFamily: Platform.OS === "ios" ? "HelveticaNeue" : "Roboto",
  },
  studentTypeButtons: {
    flexDirection: "row",
    justifyContent: "space-evenly",
    width: "100%",
  },
  studentTypeButton: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 12,
    paddingVertical: 15,
    paddingHorizontal: 20,
    alignItems: "center",
    width: "45%",
  },
  selectedType: {
    borderColor: "#8a2be2",
    backgroundColor: "rgba(138,43,226,0.1)",
  },
  studentTypeButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    fontFamily: Platform.OS === "ios" ? "HelveticaNeue" : "Roboto",
  },
});
 