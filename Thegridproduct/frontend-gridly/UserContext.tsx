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
  profilePic: string; // ✅ existing profilePic
  grids: number; // ✅ NEW: grids
}

interface UserProfile {
  firstName: string;
  lastName: string;
  institution: string;
  studentType: StudentType;
  profilePic: string; // ✅ existing profilePic
  grids: number; // ✅ NEW: grids
}

interface UserContextProps {
  userId: string;
  token: string;
  firstName: string;
  lastName: string;
  institution: string;
  studentType: StudentType | null;
  profilePic: string | null;
  grids: number; // ✅ NEW: grids in context
  likedProducts: string[];
  setLikedProducts: React.Dispatch<React.SetStateAction<string[]>>;
  isLoading: boolean;
  refreshUserGrids: () => Promise<void>;
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
  profilePic: null,
  grids: 0, // ✅ default grids
  likedProducts: [],
  setLikedProducts: () => {},
  isLoading: true,

  expoPushToken: null,
  setExpoPushToken: () => {},

  setUser: async () => {},
  clearUser: async () => {},
  refreshUserGrids: async () => {}, // ✅ Add this
});

/**
 * Fetch the full user profile (including grids).
 */
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

  return {
    firstName: data.firstName || "Unknown",
    lastName: data.lastName || "User",
    institution: data.institution || "N/A",
    studentType:
      data.studentType && Object.values(StudentType).includes(data.studentType)
        ? (data.studentType as StudentType)
        : StudentType.University,
    profilePic: data.profilePic || null,
    grids: data.grids ?? 0, // ✅ fetch grids or default to 0
  };
};

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [userId, setUserId] = useState<string>("");
  const [token, setToken] = useState<string>("");
  const [firstName, setFirstName] = useState<string>("");
  const [lastName, setLastName] = useState<string>("");
  const [institution, setInstitution] = useState<string>("");
  const [studentType, setStudentType] = useState<StudentType | null>(null);
  const [profilePic, setProfilePic] = useState<string | null>(null);
  const [grids, setGrids] = useState<number>(0); // ✅ NEW: grids state
  const [likedProducts, setLikedProducts] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const refreshUserGrids = async () => {
    try {
      if (!userId || !token) return;

      const userProfile = await fetchFullUserProfile(userId, token);
      setGrids(userProfile.grids); // ✅ Update grids in state
      await SecureStore.setItemAsync("grids", userProfile.grids.toString()); // ✅ Store in SecureStore
    } catch (error) {
      console.error("Error refreshing grids:", error);
    }
  };

  useEffect(() => {
    const loadUserData = async () => {
      try {
        const storedToken = await SecureStore.getItemAsync("userToken");
        const storedUserId = await SecureStore.getItemAsync("userId");

        if (storedToken && storedUserId) {
          const userProfile = await fetchFullUserProfile(
            storedUserId,
            storedToken
          );

          // Populate context states
          setUserId(storedUserId);
          setToken(storedToken);
          setFirstName(userProfile.firstName);
          setLastName(userProfile.lastName);
          setInstitution(userProfile.institution);
          setStudentType(userProfile.studentType);
          setProfilePic(userProfile.profilePic);
          setGrids(userProfile.grids); // ✅ set grids

          // Optionally store these in SecureStore if desired
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
          if (userProfile.profilePic) {
            await SecureStore.setItemAsync(
              "profilePic",
              userProfile.profilePic
            );
          }
          // If you want to store grids in SecureStore
          await SecureStore.setItemAsync("grids", userProfile.grids.toString());
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadUserData();
  }, []);

  /**
   * Called after login or if we manually set a user
   */
  const setUser = async (user: User) => {
    try {
      // Save token, userId
      await SecureStore.setItemAsync("userToken", user.token);
      await SecureStore.setItemAsync("userId", user.userId);

      // Fetch the full user profile from your backend
      const userProfile = await fetchFullUserProfile(user.userId, user.token);

      // Update context states
      setUserId(user.userId);
      setToken(user.token);
      setFirstName(userProfile.firstName);
      setLastName(userProfile.lastName);
      setInstitution(userProfile.institution);
      setStudentType(userProfile.studentType);
      setProfilePic(userProfile.profilePic);
      setGrids(userProfile.grids); // ✅ set grids

      // Optionally store them to SecureStore
      await SecureStore.setItemAsync("firstName", userProfile.firstName);
      await SecureStore.setItemAsync("lastName", userProfile.lastName);
      await SecureStore.setItemAsync("institution", userProfile.institution);
      await SecureStore.setItemAsync("studentType", userProfile.studentType);
      if (userProfile.profilePic) {
        await SecureStore.setItemAsync("profilePic", userProfile.profilePic);
      }
      await SecureStore.setItemAsync("grids", userProfile.grids.toString());

      // If we already have a push token, store it on the server
      if (expoPushToken) {
        await storeExpoPushTokenOnServer(
          user.userId,
          user.token,
          expoPushToken
        );
      }

      // ✅ Refresh grids after setting user
      await refreshUserGrids();
    } catch (error) {
      console.error("Error setting user data:", error);
      throw new Error("Failed to set user data.");
    }
  };

  /**
   * Clears the user from SecureStore and context states
   */
  const clearUser = async () => {
    try {
      // Clear SecureStore
      await SecureStore.deleteItemAsync("userToken");
      await SecureStore.deleteItemAsync("userId");
      await SecureStore.deleteItemAsync("firstName");
      await SecureStore.deleteItemAsync("lastName");
      await SecureStore.deleteItemAsync("institution");
      await SecureStore.deleteItemAsync("studentType");
      await SecureStore.deleteItemAsync("profilePic");
      await SecureStore.deleteItemAsync("grids");

      // Clear local states
      setUserId("");
      setToken("");
      setFirstName("");
      setLastName("");
      setInstitution("");
      setStudentType(null);
      setProfilePic(null);
      setGrids(0); // ✅ reset grids
      setLikedProducts([]);
      setExpoPushToken(null);
    } catch (error) {
      console.error("Error clearing user data:", error);
      throw new Error("Failed to clear user data.");
    }
  };

  /**
   * Helper to store the push token on server
   */
  const storeExpoPushTokenOnServer = async (
    userId: string,
    authToken: string,
    pushToken: string
  ) => {
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

  // If expoPushToken changes or user data changes, store push token
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
    profilePic,
    grids, // ✅ Provide grids
    likedProducts,
    setLikedProducts,
    isLoading,
    expoPushToken,
    setExpoPushToken,
    setUser,
    clearUser,
    refreshUserGrids,
  };

  return (
    <UserContext.Provider value={contextValue}>{children}</UserContext.Provider>
  );
};
