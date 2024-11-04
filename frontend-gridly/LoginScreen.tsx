import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableWithoutFeedback,
  Keyboard,
  Animated,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "./navigationTypes";
import {
  signIn,
  firestore,
  signUp,
  addUserToFirestore,
} from "./firebaseConfig";
import { doc, getDoc } from "firebase/firestore";

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "Login">;

const LoginScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();

  const [isLogin, setIsLogin] = useState(true);
  const [toggleAnim] = useState(new Animated.Value(0));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [university, setUniversity] = useState("");
  const [major, setMajor] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  const toggleForm = () => {
    setIsLogin(!isLogin);
    Animated.timing(toggleAnim, {
      toValue: isLogin ? 1 : 0,
      duration: 500,
      useNativeDriver: false,
    }).start();
  };

  const handleLogin = async () => {
    try {
      const result = await signIn(email, password);
      if (result?.localId) {
        const userId = result.localId;
        const userRef = doc(firestore, "users", userId);
        const userDoc = await getDoc(userRef);

        if (!userDoc.exists()) {
          Alert.alert("Login Error", "User data not found in Firestore.");
          return;
        }

        const userData = userDoc.data();
        if (userData) {
          const { firstName } = userData;
          Alert.alert(
            "Login Successful",
            `Welcome to The Gridly, ${firstName}!`
          );
          navigation.navigate("Dashboard", { firstName });
        } else {
          Alert.alert("Login Error", "Failed to retrieve user data.");
        }
      } else {
        Alert.alert("Login Error", "Incorrect username or password.");
      }
    } catch (error) {
      Alert.alert(
        "Login Error",
        "Incorrect username or password. Please try again."
      );
    }
  };

  const handleSignup = async () => {
    if (password !== confirmPassword) {
      Alert.alert("Passwords do not match");
      return;
    }
    try {
      const userCredential = await signUp(email, password);
      const userId = userCredential.localId || userCredential.user?.uid;

      if (userId) {
        await addUserToFirestore(userId, {
          university,
          major,
          firstName,
          lastName,
        });
      }
      Alert.alert("Signup Successful");
      setIsLogin(true);
      toggleForm();
    } catch (error) {
      Alert.alert(
        "Signup Error",
        error instanceof Error ? error.message : "An unknown error occurred."
      );
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView contentContainerStyle={styles.scrollViewContent}>
          <View style={styles.innerContainer}>
            <Text style={styles.title}>The Gridly</Text>

            <View style={styles.toggleContainer}>
              <TouchableOpacity
                style={[
                  styles.toggleButton,
                  isLogin ? styles.activeToggle : null,
                ]}
                onPress={() => !isLogin && toggleForm()}
              >
                <Text
                  style={[
                    styles.toggleButtonText,
                    isLogin ? styles.activeToggleText : null,
                  ]}
                >
                  Login
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.toggleButton,
                  !isLogin ? styles.activeToggle : null,
                ]}
                onPress={() => isLogin && toggleForm()}
              >
                <Text
                  style={[
                    styles.toggleButtonText,
                    !isLogin ? styles.activeToggleText : null,
                  ]}
                >
                  Signup
                </Text>
              </TouchableOpacity>
            </View>

            <Animated.View
              style={[
                styles.formContainer,
                {
                  height: toggleAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [280, 550],
                  }),
                },
              ]}
            >
              <ScrollView
                contentContainerStyle={{ flexGrow: 1 }}
                scrollEnabled={false}
              >
                {isLogin ? (
                  <View style={styles.box}>
                    <TextInput
                      style={styles.input}
                      placeholder="Email"
                      placeholderTextColor="#999"
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="Password"
                      placeholderTextColor="#999"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry
                    />
                    <TouchableOpacity
                      style={styles.button}
                      onPress={handleLogin}
                    >
                      <Text style={styles.buttonText}>Login</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.box}>
                    <TextInput
                      style={styles.input}
                      placeholder="First Name"
                      placeholderTextColor="#999"
                      value={firstName}
                      onChangeText={setFirstName}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="Last Name"
                      placeholderTextColor="#999"
                      value={lastName}
                      onChangeText={setLastName}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="Email"
                      placeholderTextColor="#999"
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="Password"
                      placeholderTextColor="#999"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="Confirm Password"
                      placeholderTextColor="#999"
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      secureTextEntry
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="University Name"
                      placeholderTextColor="#999"
                      value={university}
                      onChangeText={setUniversity}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="Major (Optional)"
                      placeholderTextColor="#999"
                      value={major}
                      onChangeText={setMajor}
                    />
                    <TouchableOpacity
                      style={styles.button}
                      onPress={handleSignup}
                    >
                      <Text style={styles.buttonText}>Signup</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </ScrollView>
            </Animated.View>
          </View>
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "black",
  },
  scrollViewContent: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 40,
  },
  innerContainer: {
    width: "90%",
    maxWidth: 350,
    padding: 25,
    backgroundColor: "#ffffff",
    borderRadius: 40,
    shadowColor: "#aaa",
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  title: {
    fontSize: 34,
    fontWeight: "700",
    color: "#333",
    marginBottom: 30,
    textAlign: "center",
  },
  toggleContainer: {
    flexDirection: "row",
    marginBottom: 20,
    borderRadius: 30,
    backgroundColor: "#e0e0e0",
    overflow: "hidden",
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
  },
  toggleButtonText: {
    fontSize: 16,
    color: "#777",
    fontWeight: "600",
  },
  activeToggle: {
    backgroundColor: "#ffffff",
    elevation: 2,
  },
  activeToggleText: {
    color: "#333",
  },
  formContainer: {
    overflow: "hidden",
  },
  box: {
    width: "100%",
  },
  input: {
    height: 50,
    borderColor: "#ddd",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 15,
    marginBottom: 15,
    color: "#333",
    backgroundColor: "#fafafa",
  },
  button: {
    backgroundColor: "black",
    borderRadius: 50,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 40,
    shadowColor: "#4CAF50",
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 3,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
});

export default LoginScreen;
