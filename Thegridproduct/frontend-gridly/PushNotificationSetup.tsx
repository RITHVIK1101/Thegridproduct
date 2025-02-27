import React, { useContext, useEffect } from "react";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants"; // Import Constants from Expo
import { UserContext } from "./UserContext";

/**
 * Requests notification permissions, retrieves the Expo push token,
 * saves it locally, and sends it to the backend.
 */
async function requestPermissionAndGetToken(
  userId: string,
  userType: string,
  token: string
): Promise<void> {
  if (!Device.isDevice) {
    console.log("Push notifications require a physical device.");
    return;
  }

  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== "granted") {
    alert("Permission required: Please enable notifications.");
    return;
  }

  try {
    // Ensure projectId is provided in the bare workflow
    const projectId = Constants?.expoConfig?.extra?.eas?.projectId;
    if (!projectId) {
      console.error(
        "Expo projectId is missing. Check app.json or app.config.js."
      );
      return;
    }

    // Fetch Expo push token
    const expoPushTokenResponse = await Notifications.getExpoPushTokenAsync({
      projectId, // Pass projectId explicitly
    });

    console.log("Expo Push Token:", expoPushTokenResponse.data);

    // Save the push token locally
    await AsyncStorage.setItem("expoPushToken", expoPushTokenResponse.data);

    // Send the token to the backend
    await fetch(
      "https://thegridproduct-production.up.railway.app/user/push-token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "X-User-Type": userType, // e.g., "university" or "highschool"
        },
        body: JSON.stringify({
          userId,
          expoPushToken: expoPushTokenResponse.data,
        }),
      }
    );

    console.log("Push token sent to backend.");
  } catch (error) {
    console.error("Error getting or sending Expo push token:", error);
  }
}

/**
 * Push Notification Setup Component
 * Runs once on app load to request permission and register the token.
 */
export const PushNotificationSetup: React.FC = () => {
  const { userId, token, studentType } = useContext(UserContext);

  useEffect(() => {
    if (userId && token && studentType) {
      requestPermissionAndGetToken(userId, studentType, token);
    }
  }, [userId, token, studentType]);

  return null;
};
