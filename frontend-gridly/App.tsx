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
} from "react-native";
import Icon from "react-native-vector-icons/MaterialIcons";
import LoginScreen from "./LoginScreen";
import Dashboard from "./Dashboard";
import AddProductScreen from "./AddProductScreen";
import { RootStackParamList } from "./navigationTypes";

// Define navigation ref for use in handleLogout
export const navigationRef =
  createRef<NavigationContainerRef<RootStackParamList>>();

const Stack = createStackNavigator<RootStackParamList>();

export default function App() {
  const [modalVisible, setModalVisible] = useState(false);

  // Logout handler
  const handleLogout = () => {
    // Log the user out by clearing their session, token, or navigating back to Login
    setModalVisible(false);
    Alert.alert("Logout Successful", "You have been logged out.");
    navigationRef.current?.navigate("Login");
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
            headerRight: () => (
              <TouchableOpacity
                onPress={() => console.log("Messaging icon pressed!")}
                style={{ marginRight: 30 }}
              >
                <Icon name="chat" size={24} color="#006400" />
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
            <TouchableOpacity onPress={handleLogout} style={styles.option}>
              <Text style={styles.optionText}>Logout</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setModalVisible(false);
                console.log("View Terms of Service pressed!");
              }}
              style={styles.option}
            >
              <Text style={styles.optionText}>View Terms of Service</Text>
            </TouchableOpacity>
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
  },
  option: { padding: 10, borderBottomWidth: 1, borderBottomColor: "#ccc" },
  optionText: { fontSize: 16 },
});
