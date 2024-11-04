import { useState, createRef } from "react";
import {
  NavigationContainer,
  NavigationContainerRef,
} from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import {
  TouchableOpacity,
  View,
  Text,
  Modal,
  StyleSheet,
  Alert,
  ScrollView,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialIcons";
import SplashScreen from "./SplashScreen";
import LoginScreen from "./LoginScreen";
import Dashboard from "./Dashboard";
import AddProductScreen from "./AddProductScreen";
import { RootStackParamList } from "./navigationTypes";
import { logout } from "./firebaseConfig";

// Define navigation ref for use in handleLogout
export const navigationRef =
  createRef<NavigationContainerRef<RootStackParamList>>();

const Stack = createStackNavigator<RootStackParamList>();

export default function App() {
  const [modalVisible, setModalVisible] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  const handleLogout = () => {
    // Close the modal before logging out
    setModalVisible(false);
    logout(); // Clears the auth token
    Alert.alert("Logout Successful", "You have been logged out.");
    navigationRef.current?.navigate("Login"); // Redirect to login screen
  };

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator initialRouteName="Login">
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Dashboard"
          component={Dashboard}
          options={{
            headerLeft: () => (
              <TouchableOpacity
                onPress={() => setModalVisible(true)}
                style={{ marginLeft: 10 }}
              >
                <Icon name="person" size={30} color="#000" />
              </TouchableOpacity>
            ),
            headerTitle: "The Gridly",
          }}
        />
        <Stack.Screen
          name="AddProduct"
          component={AddProductScreen}
          options={{ headerTitle: "Add Product" }}
        />
      </Stack.Navigator>

      {/* Modal for options */}
      <Modal
        transparent={true}
        visible={modalVisible}
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <TouchableOpacity
              onPress={() => setModalVisible(false)}
              style={styles.closeButton}
            >
              <Icon name="close" size={24} color="#000" />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleLogout} style={styles.option}>
              <Text style={styles.optionText}>Logout</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setShowTerms(true);
                setModalVisible(false);
              }}
              style={styles.option}
            >
              <Text style={styles.optionText}>View Terms of Service</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal for Terms of Service */}
      <Modal
        transparent={true}
        visible={showTerms}
        animationType="slide"
        onRequestClose={() => setShowTerms(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.termsContent}>
            <TouchableOpacity
              onPress={() => setShowTerms(false)}
              style={styles.closeButton}
            >
              <Icon name="close" size={24} color="#000" />
            </TouchableOpacity>
            <ScrollView>
              <Text style={styles.termsText}>
                Terms of Service: {"\n\n"}Welcome to The Gridly. By using our
                platform, you agree to the following terms... [Add more terms
                here as needed for your service.]
              </Text>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "white",
    padding: 20,
    borderRadius: 10,
    width: "80%",
    position: "relative",
  },
  closeButton: {
    position: "absolute",
    top: 10,
    right: 10,
  },
  option: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#ccc",
  },
  optionText: {
    fontSize: 16,
  },
  termsContent: {
    backgroundColor: "white",
    padding: 20,
    borderRadius: 10,
    width: "90%",
    height: "80%",
    position: "relative",
  },
  termsText: {
    fontSize: 14,
    color: "#333",
  },
});
