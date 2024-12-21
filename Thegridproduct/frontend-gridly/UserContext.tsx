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
  isLoading: true,
  setUser: async () => {},
  clearUser: async () => {},
});

/**
 * Fetches the full user profile from the server.
 * If it fails, it logs the error and returns fallback data
 * so as NOT to log the user out automatically.
 */
const fetchFullUserProfile = async (
  userId: string,
  token: string
): Promise<UserProfile> => {
  try {
    const response = await fetch(`${NGROK_URL}/users/${userId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      console.error("Failed to fetch user profile. Status:", response.status);
      // Return fallback data instead of throwing an error
      return {
        firstName: "",
        lastName: "",
        institution: "",
        studentType: StudentType.University,
      };
    }

    const data = await response.json();
    console.log("API Response:", data);

    const firstName = data.firstName || "Unknown";
    const lastName = data.lastName || "User";
    const institution = data.institution || "N/A";
    const studentType =
      data.studentType && Object.values(StudentType).includes(data.studentType)
        ? (data.studentType as StudentType)
        : StudentType.University; // Default to "university"

    return { firstName, lastName, institution, studentType };
  } catch (error) {
    console.error("Error in fetchFullUserProfile:", error);
    // Return fallback data so we NEVER forcibly log the user out
    return {
      firstName: "",
      lastName: "",
      institution: "",
      studentType: StudentType.University,
    };
  }
};

/** UserProvider component that wraps around your app */
export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [userId, setUserId] = useState<string>("");
  const [token, setToken] = useState<string>("");
  const [firstName, setFirstName] = useState<string>("");
  const [lastName, setLastName] = useState<string>("");
  const [institution, setInstitution] = useState<string>("");
  const [studentType, setStudentType] = useState<StudentType | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  /**
   * Load user data from SecureStore and attempt to fetch the full profile.
   * If fetching fails, we do NOT clear stored data (never auto-logout).
   */
  useEffect(() => {
    const loadUserData = async () => {
      try {
        // Retrieve stored data
        const storedToken = await SecureStore.getItemAsync("userToken");
        const storedUserId = await SecureStore.getItemAsync("userId");

        if (storedToken && storedUserId) {
          // Attempt to fetch full user profile from backend
          const userProfile = await fetchFullUserProfile(
            storedUserId,
            storedToken
          );

          // Update state with either real or fallback data
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
      } catch (error) {
        console.error("Error loading user data:", error);
        // We do NOT clear data here. We keep user in, no auto-logout.
      } finally {
        setIsLoading(false);
      }
    };

    loadUserData();
  }, []);

  /**
   * Sets the user data after login/signup.
   * Stores minimal data (userId and token) and then fetches the full profile.
   * If that fetch fails, it keeps minimal data (still not logging out).
   */
  const setUser = async (user: User) => {
    try {
      // Store minimal data
      await SecureStore.setItemAsync("userToken", user.token);
      await SecureStore.setItemAsync("userId", user.userId);

      // Attempt to fetch full user profile from backend
      const userProfile = await fetchFullUserProfile(user.userId, user.token);

      // Update state with either real or fallback data
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
      // Even on error, DO NOT clear user data. We stay logged in.
    }
  };

  /**
   * Clears all user data from SecureStore and resets the context state.
   * Only called if the user explicitly presses 'Logout' or if you manually call it.
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
    isLoading,
    setUser,
    clearUser,
  };

  return (
    <UserContext.Provider value={contextValue}>{children}</UserContext.Provider>
  );
};
