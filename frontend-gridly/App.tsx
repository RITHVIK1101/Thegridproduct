import { useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { TouchableOpacity, View, Text, Modal, StyleSheet } from "react-native";
import Icon from "react-native-vector-icons/MaterialIcons";  // Keep the original import
import LoginScreen from "./LoginScreen";
import Dashboard from "./Dashboard";
import { RootStackParamList } from "./navigationTypes";

const Stack = createStackNavigator<RootStackParamList>();

export default function App() {
  const [modalVisible, setModalVisible] = useState(false);

  return (
    <NavigationContainer>
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
                onPress={() => {
                  console.log("Messaging icon pressed!");
                }}
                style={{ marginRight: 30 }}
              >
                <Icon name="chat" size={24} color="#006400" />
              </TouchableOpacity>
            ),
            headerTitle: "The Gridly",
          }}
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
              onPress={() => {
                setModalVisible(false);
                console.log("Logout pressed!");
              }}
              style={styles.option}
            >
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
  option: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#ccc",
  },
  optionText: {
    fontSize: 16,
  },
});