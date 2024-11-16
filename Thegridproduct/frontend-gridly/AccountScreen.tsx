// screens/AccountScreen.tsx

import React, { useContext, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
} from "react-native";
import { UserContext } from "./UserContext"; // Adjust the path if necessary
import { NGROK_URL } from "@env";
import { CommonActions, useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "./navigationTypes"; // Adjust the path if necessary

type AccountScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  "Account"
>;

const AccountScreen: React.FC = () => {
  const { userId, token, clearUser } = useContext(UserContext);
  const navigation = useNavigation<AccountScreenNavigationProp>();
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch user account details
  const fetchUserData = async () => {
    if (!userId || !token) {
      setError("User not authenticated.");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${NGROK_URL}/users/${userId}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 401) {
        // Unauthorized: Clear user data and navigate to Login
        Alert.alert(
          "Session Expired",
          "Your session has expired. Please log in again.",
          [
            {
              text: "OK",
              onPress: async () => {
                await clearUser();
                navigation.dispatch(
                  CommonActions.reset({
                    index: 0,
                    routes: [{ name: "Login" }],
                  })
                );
              },
            },
          ]
        );
        return;
      }

      if (!response.ok) {
        const responseText = await response.text();
        console.error("Error response text:", responseText);
        throw new Error("Failed to fetch user data.");
      }

      const data = await response.json();
      setUserData(data);
    } catch (err) {
      console.error("Fetch User Data Error:", err);
      setError("Could not fetch user data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#BB86FC" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
        {/* Optionally, add a retry button */}
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>My Account</Text>
      <View style={styles.infoContainer}>
        <Text style={styles.label}>First Name:</Text>
        <Text style={styles.value}>{userData.firstName}</Text>
      </View>
      <View style={styles.infoContainer}>
        <Text style={styles.label}>Last Name:</Text>
        <Text style={styles.value}>{userData.lastName}</Text>
      </View>
      <View style={styles.infoContainer}>
        <Text style={styles.label}>Email:</Text>
        <Text style={styles.value}>{userData.email}</Text>
      </View>
      <View style={styles.infoContainer}>
        <Text style={styles.label}>Institution:</Text>
        <Text style={styles.value}>{userData.institution}</Text>
      </View>
    </ScrollView>
  );
};

export default AccountScreen;

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: "#121212",
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#121212",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 15,
    backgroundColor: "#121212",
  },
  errorText: {
    color: "#FF6B6B",
    fontSize: 16,
    textAlign: "center",
    marginBottom: 10,
  },
  title: {
    fontSize: 24,
    color: "#BB86FC",
    fontWeight: "700",
    marginBottom: 20,
    textAlign: "center",
  },
  infoContainer: {
    flexDirection: "row",
    marginBottom: 15,
  },
  label: {
    fontSize: 16,
    color: "#fff",
    fontWeight: "600",
    width: 120, // Fixed width for labels
  },
  value: {
    fontSize: 16,
    color: "#ccc",
    flex: 1,
  },
});
