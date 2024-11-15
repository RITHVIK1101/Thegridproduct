// UserContext.tsx

import React, { createContext, useState, ReactNode, useEffect } from "react";
import * as SecureStore from "expo-secure-store"; // If using Expo

export enum StudentType {
  HighSchool = "highschool",
  University = "university",
}

interface User {
  userId: string;
  token: string;
  institution: string;
  studentType: StudentType;
}

interface UserContextProps {
  userId: string;
  token: string;
  institution: string;
  studentType: StudentType | null;
  isLoading: boolean; // New State
  setUser: (user: User) => Promise<void>;
  clearUser: () => Promise<void>;
}

export const UserContext = createContext<UserContextProps>({
  userId: "",
  token: "",
  institution: "",
  studentType: null,
  isLoading: true, // Initialize as loading
  setUser: async () => {},
  clearUser: async () => {},
});

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [userId, setUserId] = useState<string>("");
  const [token, setToken] = useState<string>("");
  const [institution, setInstitution] = useState<string>("");
  const [studentType, setStudentType] = useState<StudentType | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true); // Initialize as loading

  useEffect(() => {
    const loadUserData = async () => {
      try {
        const storedToken = await SecureStore.getItemAsync("userToken");
        const storedUserId = await SecureStore.getItemAsync("userId");
        const storedInstitution = await SecureStore.getItemAsync("institution");
        const storedStudentType = await SecureStore.getItemAsync("studentType");

        if (
          storedToken &&
          storedUserId &&
          storedInstitution &&
          storedStudentType
        ) {
          setUserId(storedUserId);
          setToken(storedToken);
          setInstitution(storedInstitution);
          setStudentType(storedStudentType as StudentType);
        }
      } catch (error) {
        console.error("Error loading user data from SecureStore:", error);
        // Optionally, handle specific errors or provide user feedback here.
      } finally {
        setIsLoading(false); // Data loading complete
      }
    };

    loadUserData();
  }, []);

  const setUser = async (user: User) => {
    try {
      await SecureStore.setItemAsync("userToken", user.token);
      await SecureStore.setItemAsync("userId", user.userId);
      await SecureStore.setItemAsync("institution", user.institution);
      await SecureStore.setItemAsync("studentType", user.studentType);

      setUserId(user.userId);
      setToken(user.token);
      setInstitution(user.institution);
      setStudentType(user.studentType);
    } catch (error) {
      console.error("Error setting user data:", error);
      // Optionally, handle errors (e.g., show a toast or alert to the user).
      throw new Error("Failed to set user data.");
    }
  };

  const clearUser = async () => {
    try {
      await SecureStore.deleteItemAsync("userToken");
      await SecureStore.deleteItemAsync("userId");
      await SecureStore.deleteItemAsync("institution");
      await SecureStore.deleteItemAsync("studentType");

      setUserId("");
      setToken("");
      setInstitution("");
      setStudentType(null);
    } catch (error) {
      console.error("Error clearing user data:", error);
      // Optionally, handle errors (e.g., show a toast or alert to the user).
      throw new Error("Failed to clear user data.");
    }
  };

  const contextValue: UserContextProps = {
    userId,
    token,
    institution,
    studentType,
    isLoading, // Provide isLoading
    setUser,
    clearUser,
  };

  return (
    <UserContext.Provider value={contextValue}>{children}</UserContext.Provider>
  );
};
