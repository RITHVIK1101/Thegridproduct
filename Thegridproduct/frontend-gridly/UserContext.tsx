// UserContext.tsx
import React, { createContext, useState, ReactNode, useEffect } from "react";
import * as SecureStore from "expo-secure-store";
import { NGROK_URL } from "@env";

export enum StudentType {
  HighSchool = "highschool",
  University = "university",
}

interface User {
  userId: string;
  token: string;
  firstName: string;
  lastName: string;
  institution: string;
  studentType: StudentType;
}

interface UserProfile {
  firstName: string;
  lastName: string;
  institution: string;
  studentType: StudentType;
}

interface UserContextProps {
  userId: string;
  token: string;
  firstName: string;
  lastName: string;
  institution: string;
  studentType: StudentType | null;
  likedProducts: string[];
  setLikedProducts: React.Dispatch<React.SetStateAction<string[]>>;
  isLoading: boolean;

  // NEW: Expo push token
  expoPushToken: string | null;
  setExpoPushToken: React.Dispatch<React.SetStateAction<string | null>>;

  setUser: (user: User) => Promise<void>;
  clearUser: () => Promise<void>;
}

export const UserContext = createContext<UserContextProps>({
  userId: "",
  token: "",
  firstName: "",
  lastName: "",
  institution: "",
  studentType: null,
  likedProducts: [],
  setLikedProducts: () => {},
  isLoading: true,

  expoPushToken: null,
  setExpoPushToken: () => {},

  setUser: async () => {},
  clearUser: async () => {},
});

const fetchFullUserProfile = async (userId: string, token: string): Promise<UserProfile> => {
  const response = await fetch(`${NGROK_URL}/users/${userId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch user profile");
  }

  const data = await response.json();
  console.log("API Response:", data);

  const firstName = data.firstName || "Unknown";
  const lastName = data.lastName || "User";
  const institution = data.institution || "N/A";
  const studentType =
    data.studentType && Object.values(StudentType).includes(data.studentType)
      ? (data.studentType as StudentType)
      : StudentType.University;

  return { firstName, lastName, institution, studentType };
};

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [userId, setUserId] = useState<string>("");
  const [token, setToken] = useState<string>("");
  const [firstName, setFirstName] = useState<string>("");
  const [lastName, setLastName] = useState<string>("");
  const [institution, setInstitution] = useState<string>("");
  const [studentType, setStudentType] = useState<StudentType | null>(null);
  const [likedProducts, setLikedProducts] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // NEW: Expo push token
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);

  useEffect(() => {
    const loadUserData = async () => {
      try {
        const storedToken = await SecureStore.getItemAsync("userToken");
        const storedUserId = await SecureStore.getItemAsync("userId");

        if (storedToken && storedUserId) {
          const userProfile = await fetchFullUserProfile(storedUserId, storedToken);

          setUserId(storedUserId);
          setToken(storedToken);
          setFirstName(userProfile.firstName);
          setLastName(userProfile.lastName);
          setInstitution(userProfile.institution);
          setStudentType(userProfile.studentType);

          await SecureStore.setItemAsync("firstName", userProfile.firstName);
          await SecureStore.setItemAsync("lastName", userProfile.lastName);
          await SecureStore.setItemAsync("institution", userProfile.institution);
          await SecureStore.setItemAsync("studentType", userProfile.studentType);
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadUserData();
  }, []);

  const setUser = async (user: User) => {
    try {
      await SecureStore.setItemAsync("userToken", user.token);
      await SecureStore.setItemAsync("userId", user.userId);

      const userProfile = await fetchFullUserProfile(user.userId, user.token);

      setUserId(user.userId);
      setToken(user.token);
      setFirstName(userProfile.firstName);
      setLastName(userProfile.lastName);
      setInstitution(userProfile.institution);
      setStudentType(userProfile.studentType);

      await SecureStore.setItemAsync("firstName", userProfile.firstName);
      await SecureStore.setItemAsync("lastName", userProfile.lastName);
      await SecureStore.setItemAsync("institution", userProfile.institution);
      await SecureStore.setItemAsync("studentType", userProfile.studentType);

      if (expoPushToken) {
        await storeExpoPushTokenOnServer(user.userId, user.token, expoPushToken);
      }
    } catch (error) {
      console.error("Error setting user data:", error);
      throw new Error("Failed to set user data.");
    }
  };

  const clearUser = async () => {
    try {
      await SecureStore.deleteItemAsync("userToken");
      await SecureStore.deleteItemAsync("userId");
      await SecureStore.deleteItemAsync("firstName");
      await SecureStore.deleteItemAsync("lastName");
      await SecureStore.deleteItemAsync("institution");
      await SecureStore.deleteItemAsync("studentType");

      setUserId("");
      setToken("");
      setFirstName("");
      setLastName("");
      setInstitution("");
      setStudentType(null);
      setLikedProducts([]);
      setExpoPushToken(null);
    } catch (error) {
      console.error("Error clearing user data:", error);
      throw new Error("Failed to clear user data.");
    }
  };

  const storeExpoPushTokenOnServer = async (userId: string, authToken: string, pushToken: string) => {
    try {
      await fetch(`${NGROK_URL}/users/push-token`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId, expoPushToken: pushToken }),
      });
    } catch (error) {
      console.error("Failed to store push token on server:", error);
    }
  };

  useEffect(() => {
    if (expoPushToken && userId && token) {
      storeExpoPushTokenOnServer(userId, token, expoPushToken);
    }
  }, [expoPushToken, userId, token]);

  const contextValue: UserContextProps = {
    userId,
    token,
    firstName,
    lastName,
    institution,
    studentType,
    likedProducts,
    setLikedProducts,
    isLoading,
    expoPushToken,
    setExpoPushToken,
    setUser,
    clearUser,
  };

  return <UserContext.Provider value={contextValue}>{children}</UserContext.Provider>;
};
