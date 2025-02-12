// UserContext.tsx

import React, { createContext, useState, ReactNode, useEffect } from "react";
import * as SecureStore from "expo-secure-store"; // If using Expo
import { NGROK_URL } from "@env"; // Ensure you have NGROK_URL defined in your environment variables

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
  likedProducts: string[]; // Added likedProducts
  setLikedProducts: React.Dispatch<React.SetStateAction<string[]>>; // Added setLikedProducts
  isLoading: boolean;
  setUser: (user: User) => Promise<void>;
  clearUser: () => Promise<void>;
}

/** Create the UserContext with default values */
export const UserContext = createContext<UserContextProps>({
  userId: "",
  token: "",
  firstName: "",
  lastName: "",
  institution: "",
  studentType: null,
  likedProducts: [], // Initialize as empty array
  setLikedProducts: () => {},
  isLoading: true,
  setUser: async () => {},
  clearUser: async () => {},
});

const fetchFullUserProfile = async (
  userId: string,
  token: string
): Promise<UserProfile> => {
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

/** UserProvider component that wraps around your app */
export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [userId, setUserId] = useState<string>("");
  const [token, setToken] = useState<string>("");
  const [firstName, setFirstName] = useState<string>("");
  const [lastName, setLastName] = useState<string>("");
  const [institution, setInstitution] = useState<string>("");
  const [studentType, setStudentType] = useState<StudentType | null>(null);
  const [likedProducts, setLikedProducts] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  /** Load user data from SecureStore and fetch full profile */
  useEffect(() => {
    const loadUserData = async () => {
      try {
        // Retrieve stored data
        const storedToken = await SecureStore.getItemAsync("userToken");
        const storedUserId = await SecureStore.getItemAsync("userId");

        if (storedToken && storedUserId) {
          // Fetch full user profile from backend
          const userProfile = await fetchFullUserProfile(
            storedUserId,
            storedToken
          );

          // Update state
          setUserId(storedUserId);
          setToken(storedToken);
          setFirstName(userProfile.firstName);
          setLastName(userProfile.lastName);
          setInstitution(userProfile.institution);
          setStudentType(userProfile.studentType);

          // Optionally, store additional fields in SecureStore
          await SecureStore.setItemAsync("firstName", userProfile.firstName);
          await SecureStore.setItemAsync("lastName", userProfile.lastName);
          await SecureStore.setItemAsync(
            "institution",
            userProfile.institution
          );
          await SecureStore.setItemAsync(
            "studentType",
            userProfile.studentType
          );
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadUserData();
  }, []);

  /**
   * Sets the user data after login/signup.
   * Stores minimal data (userId and token) and fetches the full profile.
   */
  const setUser = async (user: User) => {
    try {
      // Store minimal data
      await SecureStore.setItemAsync("userToken", user.token);
      await SecureStore.setItemAsync("userId", user.userId);

      // Fetch full user profile from backend
      const userProfile = await fetchFullUserProfile(user.userId, user.token);

      // Update state
      setUserId(user.userId);
      setToken(user.token);
      setFirstName(userProfile.firstName);
      setLastName(userProfile.lastName);
      setInstitution(userProfile.institution);
      setStudentType(userProfile.studentType);

      // Store additional fields in SecureStore
      await SecureStore.setItemAsync("firstName", userProfile.firstName);
      await SecureStore.setItemAsync("lastName", userProfile.lastName);
      await SecureStore.setItemAsync("institution", userProfile.institution);
      await SecureStore.setItemAsync("studentType", userProfile.studentType);
    } catch (error) {
      console.error("Error setting user data:", error);
      throw new Error("Failed to set user data.");
    }
  };

  /**
   * Clears all user data from SecureStore and resets the context state.
   */
  const clearUser = async () => {
    try {
      // Delete all stored items
      await SecureStore.deleteItemAsync("userToken");
      await SecureStore.deleteItemAsync("userId");
      await SecureStore.deleteItemAsync("firstName");
      await SecureStore.deleteItemAsync("lastName");
      await SecureStore.deleteItemAsync("institution");
      await SecureStore.deleteItemAsync("studentType");

      // Reset state
      setUserId("");
      setToken("");
      setFirstName("");
      setLastName("");
      setInstitution("");
      setStudentType(null);
      setLikedProducts([]); // Clear likedProducts
    } catch (error) {
      console.error("Error clearing user data:", error);
      throw new Error("Failed to clear user data.");
    }
  };

  /** Define the context value to be provided */
  const contextValue: UserContextProps = {
    userId,
    token,
    firstName,
    lastName,
    institution,
    studentType,
    likedProducts, // Provide likedProducts
    setLikedProducts, // Provide setLikedProducts
    isLoading,
    setUser,
    clearUser,
  };

  return (
    <UserContext.Provider value={contextValue}>{children}</UserContext.Provider>
  );
};
