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
  Animated,
  Dimensions,
  Platform,
  KeyboardAvoidingView,
  Keyboard,
  TouchableWithoutFeedback,
  Easing,
  ScrollView,
  Alert,
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
import { Ionicons } from "@expo/vector-icons";

console.log("Backend URL:", NGROK_URL);

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
  const [isEmailFocused, setIsEmailFocused] = useState(false);

  // Added state for toggling password visibility
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [open, setOpen] = useState(false);
  const [selectedInstitution, setSelectedInstitution] = useState("");
  const [items, setItems] = useState<Array<{ label: string; value: string }>>(
    collegeList.map((college: College) => ({
      label: college.institution,
      value: college.institution,
    }))
  );

  const [studentType, setStudentType] = useState<
    "highschool" | "university" | null
  >(null);
  const [error, setError] = useState<string>("");

  // Animations
  const formOpacity = useRef(new Animated.Value(0)).current;
  const headerScale = useRef(new Animated.Value(0.8)).current;
  const headerBounceAnim = useRef(new Animated.Value(1)).current;

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
    setError("");

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
    // Animate the header logo bouncing indefinitely
    Animated.loop(
      Animated.sequence([
        Animated.timing(headerBounceAnim, {
          toValue: 1.3,
          duration: 500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(headerBounceAnim, {
          toValue: 1,
          duration: 500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [headerBounceAnim]);

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

      const response = await fetch(fullUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const contentType = response.headers.get("content-type");

      if (!response.ok) {
        if (url === "/login") {
          setError("Incorrect email or password.");
          return null;
        } else {
          const errorText = await response.text();
          setError(errorText || "An error occurred. Please try again.");
          return null;
        }
      } else if (!contentType || !contentType.includes("application/json")) {
        setError("An unexpected error occurred. Please try again.");
        return null;
      }

      const data = await response.json();
      return data;
    } catch (error) {
      setError("An error occurred. Please try again.");
      throw error;
    }
  };

  const handleLogin = async () => {
    setError("");
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    const payload = { email, password };
    const data = await handleApiRequest("/login", payload);

    if (data) {
      if (data.unverified) {
        Alert.alert(
          "Email Not Verified",
          "Please verify your email before logging in.",
          [
            {
              text: "Verify Now",
              onPress: () => navigation.navigate("Verification", { email }),
            },
            { text: "Cancel", style: "cancel" },
          ]
        );
        return;
      }

      const {
        token,
        userId,
        institution,
        studentType: responseStudentType,
      } = data;

      if (!institution) {
        setError("Institution information is missing.");
        return;
      }
      if (!responseStudentType) {
        setError("Student type information is missing.");
        return;
      }

      if (
        responseStudentType !== "highschool" &&
        responseStudentType !== "university"
      ) {
        setError("Invalid student type from server.");
        return;
      }

      const mappedStudentType =
        responseStudentType === "highschool"
          ? StudentType.HighSchool
          : StudentType.University;

      await SecureStore.setItemAsync("userToken", token);
      await SecureStore.setItemAsync("userId", userId.toString());

      await saveUserData(token, userId, institution, mappedStudentType);
      navigation.navigate("Dashboard");
    }
  };

  const handleSignup = async () => {
    setError("");

    if (!firstName.trim() || !lastName.trim()) {
      setError("Please enter your first and last name.");
      return;
    }

    // Updated regex to allow only .edu, .org, or .college emails
    const emailRegex = /^[^\s@]+@[^\s@]+\.(edu|org|college)$/;
    if (!emailRegex.test(email)) {
      setError("Please enter a valid .edu, .org, or .college email address.");
      return;
    }

    if (password.length <= 6) {
      setError("Password must be longer than 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (!studentType || !selectedInstitution) {
      setError("Please select your student type and institution.");
      return;
    }

    const payload = {
      email,
      password,
      firstName,
      lastName,
      studentType,
      institution: selectedInstitution,
    };
    const data = await handleApiRequest("/signup", payload);

    if (data) {
      navigation.navigate("Verification", { email });
    }
  };

  const saveUserData = async (
    token: string,
    userId: string,
    institution: string,
    studentType: StudentType
  ) => {
    setUser({ userId, token, institution, studentType });
  };

  const renderError = () => {
    if (!error) return null;
    return <Text style={styles.errorText}>{error}</Text>;
  };

  const renderLoginForm = () => (
    <Animated.View style={{ opacity: formOpacity }}>
      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="#888"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
      />
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#888"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          autoComplete="password"
        />
        <TouchableOpacity
          style={styles.eyeIcon}
          onPress={() => setShowPassword(!showPassword)}
        >
          <Ionicons
            name={showPassword ? "eye-off-outline" : "eye-outline"}
            size={20}
            color="#aaa"
          />
        </TouchableOpacity>
      </View>
      {renderError()}
      <TouchableOpacity
        style={[styles.button, styles.simpleButton]}
        onPress={handleLogin}
      >
        <Text style={styles.buttonText}>Login</Text>
        <Ionicons
          name="log-in-outline"
          size={20}
          color="#fff"
          style={{ marginLeft: 8 }}
        />
      </TouchableOpacity>
    </Animated.View>
  );

  const renderStudentTypeSelection = () => (
    <View style={styles.studentTypeContainer}>
      <Text style={styles.studentTypeTitle}>Select your student type</Text>
      <View style={styles.studentTypeButtons}>
        <TouchableOpacity
          style={[
            styles.studentTypeButton,
            studentType === "highschool" && styles.selectedType,
          ]}
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
          <Ionicons
            name="school-outline"
            size={24}
            color="#fff"
            style={{ marginBottom: 5 }}
          />
          <Text style={styles.studentTypeButtonText}>High School</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.studentTypeButton,
            studentType === "university" && styles.selectedType,
          ]}
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
          <Ionicons
            name="book-outline"
            size={24}
            color="#fff"
            style={{ marginBottom: 5 }}
          />
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
            placeholderTextColor="#888"
            value={firstName}
            onChangeText={setFirstName}
            autoCapitalize="words"
          />
          <TextInput
            style={styles.input}
            placeholder="Last Name"
            placeholderTextColor="#888"
            value={lastName}
            onChangeText={setLastName}
            autoCapitalize="words"
          />

          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#888"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            onFocus={() => setIsEmailFocused(true)}
            onBlur={() => setIsEmailFocused(false)}
          />

          {isEmailFocused && (
            <Text style={styles.subtleHint}>Use a school email address</Text>
          )}

          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#888"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={styles.eyeIcon}
              onPress={() => setShowPassword(!showPassword)}
            >
              <Ionicons
                name={showPassword ? "eye-off-outline" : "eye-outline"}
                size={20}
                color="#aaa"
              />
            </TouchableOpacity>
          </View>

          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Confirm Password"
              placeholderTextColor="#888"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showConfirmPassword}
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={styles.eyeIcon}
              onPress={() => setShowConfirmPassword(!showConfirmPassword)}
            >
              <Ionicons
                name={showConfirmPassword ? "eye-off-outline" : "eye-outline"}
                size={20}
                color="#aaa"
              />
            </TouchableOpacity>
          </View>

          {renderError()}

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
              modalProps={{ animationType: "slide" }}
              activityIndicatorColor="#A78BFA"
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

          <TouchableOpacity
            style={[styles.button, styles.simpleButton]}
            onPress={handleSignup}
          >
            <Text style={styles.buttonText}>Signup</Text>
            <Ionicons
              name="person-add-outline"
              size={20}
              color="#fff"
              style={{ marginLeft: 8 }}
            />
          </TouchableOpacity>
        </>
      )}
    </Animated.View>
  );

  return (
    <View style={styles.container}>
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
              {/* Animated Header with bouncing logo */}
              <Animated.View
                style={[
                  styles.headerContainer,
                  { transform: [{ scale: headerScale }] },
                ]}
              >
                <Animated.Image
                  // Updated the image source to a relative path.
                  source={require("./assets/logonobg.png")}
                  style={[
                    styles.logoIcon,
                    { transform: [{ scale: headerBounceAnim }] },
                  ]}
                  resizeMode="contain"
                />
                <Text style={styles.title}>Gridly</Text>
              </Animated.View>
              <Text style={styles.slogan}>
                Connect Students. Build Communities.
              </Text>

              {/* Toggle Container */}
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
                            outputRange: [0, width / 2],
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
    </View>
  );
};

export default LoginScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0D0D0D",
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
  logoIcon: {
    width: 42,
    height: 42,
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
    color: "#bbb",
    textAlign: "center",
    marginBottom: 25,
    fontFamily: Platform.OS === "ios" ? "HelveticaNeue" : "Roboto",
  },
  toggleContainer: {
    flexDirection: "row",
    marginBottom: 15,
    borderRadius: 25,
    backgroundColor: "#222",
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
    color: "#777",
  },
  slider: {
    position: "absolute",
    bottom: 0,
    left: 0,
    width: width / 2 - 40,
    height: 3,
    backgroundColor: "#A78BFA",
    borderRadius: 2,
  },
  formCard: {
    width: "100%",
    backgroundColor: "#131313",
    borderRadius: 15,
    padding: 20,
    marginTop: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  inputContainer: {
    position: "relative",
    width: "100%",
    marginBottom: 1,
  },
  input: {
    height: 50,
    borderColor: "#333",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 15,
    color: "#fff",
    fontSize: 15,
    backgroundColor: "#1D1D1D",
    fontFamily: Platform.OS === "ios" ? "HelveticaNeue" : "Roboto",
    marginBottom: 12,
  },
  eyeIcon: {
    position: "absolute",
    right: 15,
    top: 15,
  },
  dropdownContainer: {
    marginBottom: 12,
    zIndex: 1000,
  },
  dropdown: {
    backgroundColor: "#1D1D1D",
    borderColor: "#333",
    height: 50,
    borderRadius: 12,
    paddingHorizontal: 10,
  },
  dropdownList: {
    backgroundColor: "#1A1A1A",
    borderColor: "#333",
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
    color: "#666",
  },
  dropdownSelectedLabel: {
    color: "#A78BFA",
    fontWeight: "600",
  },
  searchInput: {
    height: 40,
    borderColor: "#444",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 16,
    color: "#fff",
    backgroundColor: "#111",
  },
  button: {
    borderRadius: 30,
    overflow: "hidden",
    marginTop: 10,
  },
  simpleButton: {
    backgroundColor: "#A78BFA",
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
    backgroundColor: "#1A1A1A",
  },
  modalTitleStyle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#A78BFA",
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
    backgroundColor: "#1A1A1A",
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 12,
    paddingVertical: 15,
    paddingHorizontal: 20,
    alignItems: "center",
    width: "45%",
  },
  subtleHint: {
    fontSize: 12,
    color: "#bbb",
    marginTop: -8,
    marginBottom: 8,
    textAlign: "center",
    fontFamily: Platform.OS === "ios" ? "HelveticaNeue" : "Roboto",
  },
  selectedType: {
    borderColor: "#A78BFA",
    backgroundColor: "rgba(167,139,250,0.1)",
  },
  studentTypeButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    fontFamily: Platform.OS === "ios" ? "HelveticaNeue" : "Roboto",
  },
  errorText: {
    color: "#FF6B6B",
    textAlign: "center",
    marginBottom: 10,
    fontSize: 14,
    fontFamily: Platform.OS === "ios" ? "HelveticaNeue" : "Roboto",
  },
});
