import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Button,
  TouchableOpacity,
  StyleSheet,
  Alert,
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
      console.log("SignIn Result:", result);

      if (result?.localId) {
        const userId = result.localId;
        const userRef = doc(firestore, "users", userId);
        const userDoc = await getDoc(userRef);

        if (!userDoc.exists()) {
          Alert.alert("Login Error", "User data not found in Firestore.");
          return;
        }

        const userData = userDoc.data();
        console.log("User Data:", userData);

        if (userData) {
          const { firstName } = userData;
          Alert.alert(
            "Login Successful",
            `Welcome to the Gridly, ${firstName}!`
          );
          navigation.navigate("Dashboard", { firstName });
        } else {
          Alert.alert("Login Error", "Failed to retrieve user data.");
        }
      } else {
        Alert.alert("Login Error", "No user data returned.");
      }
    } catch (error) {
      console.error("Error in login:", error);
      Alert.alert(
        "Login Error",
        error instanceof Error ? error.message : "An unknown error occurred."
      );
    }
  };

  const handleSignup = async () => {
    if (password !== confirmPassword) {
      Alert.alert("Passwords do not match");
      return;
    }
    try {
      // Call the signup function
      const userCredential = await signUp(email, password);
      console.log("User successfully signed up:", userCredential);

      const userId = userCredential.localId || userCredential.user?.uid;
      console.log("User ID:", userId);

      // Add user data to Firestore
      if (userId) {
        await addUserToFirestore(userId, {
          university,
          major,
          firstName,
          lastName,
        });
        console.log("User data added to Firestore successfully.");
      }

      Alert.alert("Signup Successful");
      setIsLogin(true);
    } catch (error) {
      console.error("Error in signup:", error);
      Alert.alert(
        "Signup Error",
        error instanceof Error ? error.message : "An unknown error occurred."
      );
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>The Gridly</Text>
      {isLogin ? (
        <View style={styles.box}>
          <TextInput
            style={styles.input}
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
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
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f2f2f2",
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    marginBottom: 20,
  },
  box: {
    width: "100%",
    maxWidth: 400,
    padding: 20,
    backgroundColor: "white",
    borderRadius: 8,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  input: {
    height: 40,
    borderColor: "#ccc",
    borderWidth: 1,
    marginBottom: 10,
    paddingHorizontal: 10,
    borderRadius: 4,
  },
  toggleText: {
    color: "#007bff",
    textAlign: "center",
    marginTop: 10,
  },
});

export default LoginScreen;
