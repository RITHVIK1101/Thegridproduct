import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Button,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableWithoutFeedback,
  Keyboard,
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
import { collection, doc, getDoc } from "firebase/firestore";

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "Login">;

const LoginScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();

  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [university, setUniversity] = useState("");
  const [major, setMajor] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  const toggleForm = () => setIsLogin(!isLogin);

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
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView contentContainerStyle={styles.scrollViewContent}>
          <View style={styles.innerContainer}>
            <Text style={styles.title}>The Gridly</Text>
            {isLogin ? (
              <View style={styles.box}>
                <TextInput
                  style={styles.input}
                  placeholder="Email"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                />
                <TextInput
                  style={styles.input}
                  placeholder="Password"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />
                <Button title="Login" onPress={handleLogin} />
                <TouchableOpacity onPress={toggleForm}>
                  <Text style={styles.toggleText}>Signup instead</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.box}>
                <TextInput
                  style={styles.input}
                  placeholder="First Name"
                  value={firstName}
                  onChangeText={setFirstName}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Last Name"
                  value={lastName}
                  onChangeText={setLastName}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Email"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                />
                <TextInput
                  style={styles.input}
                  placeholder="Password"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />
                <TextInput
                  style={styles.input}
                  placeholder="Confirm Password"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                />
                <TextInput
                  style={styles.input}
                  placeholder="University Name"
                  value={university}
                  onChangeText={setUniversity}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Major (Optional)"
                  value={major}
                  onChangeText={setMajor}
                />
                <Button title="Signup" onPress={handleSignup} />
                <TouchableOpacity onPress={toggleForm}>
                  <Text style={styles.toggleText}>Login instead</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollViewContent: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  innerContainer: {
    width: "100%",
    maxWidth: 400,
    padding: 20,
    backgroundColor: "#f8f9fa",
    borderRadius: 10,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 20,
  },
  box: {
    width: "100%",
  },
  input: {
    height: 45,
    borderColor: "#ddd",
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 15,
    marginBottom: 15,
  },
  toggleText: {
    color: "#0066cc",
    textAlign: "center",
    marginTop: 10,
  },
});

export default LoginScreen;
