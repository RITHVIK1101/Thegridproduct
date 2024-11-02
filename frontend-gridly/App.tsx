import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import LoginScreen from "./LoginScreen";
import Dashboard from "./Dashboard";
import { RootStackParamList } from "./navigationTypes";

const Stack = createStackNavigator<RootStackParamList>();

export default function App() {
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
            headerLeft: () => null, // Remove the back button
            headerTitle: "Dashboard", // Customize title if needed
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
