// PushNotificationSetup.tsx
import React, { useContext, useEffect } from "react";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { UserContext } from "./UserContext";

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
    const expoPushTokenResponse = await Notifications.getExpoPushTokenAsync();
    console.log("Expo Push Token:", expoPushTokenResponse.data);

    await AsyncStorage.setItem("expoPushToken", expoPushTokenResponse.data);

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

export const PushNotificationSetup: React.FC = () => {
  const { userId, token, studentType } = useContext(UserContext);

  useEffect(() => {
    if (userId && token && studentType) {
      requestPermissionAndGetToken(userId, studentType, token);
    }
  }, [userId, token, studentType]);

  return null;
};
