// UserContext.js
import React, {
  createContext,
  useState,
  ReactNode,
  useEffect,
  Dispatch,
  SetStateAction,
} from "react";
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
  setLikedProducts: Dispatch<SetStateAction<string[]>>; //Use correct type
  isLoading: boolean;
  setUser: (user: User) => Promise<void>;
  clearUser: () => Promise<void>;
  unreadCount: number; // ADD THIS: Unread message count
  setUnreadCount: Dispatch<SetStateAction<number>>; // ADD THIS: Function to update unread count
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
  setUser: async () => {},
  clearUser: async () => {},
  unreadCount: 0, // ADD THIS: Initial value for unread count
  setUnreadCount: () => {}, // ADD THIS: Dummy function for unread count
});

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
      throw new Error("Failed to fetch user profile");
    }

    const data = await response.json();
    return {
      firstName: data.firstName || "Unknown",
      lastName: data.lastName || "User",
      institution: data.institution || "N/A",
      studentType: Object.values(StudentType).includes(data.studentType)
        ? (data.studentType as StudentType)
        : StudentType.University,
    };
  } catch (error) {
    console.error("Error fetching user profile:", error);
    throw error;
  }
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
  const [unreadCount, setUnreadCount] = useState<number>(0); // ADD THIS: State for unread count

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

          setUserId(storedUserId);
          setToken(storedToken);
          setFirstName(userProfile.firstName);
          setLastName(userProfile.lastName);
          setInstitution(userProfile.institution);
          setStudentType(userProfile.studentType);
        }
      } catch (error) {
        console.error("Error loading user data:", error);
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
    } catch (error) {
      console.error("Error setting user data:", error);
      throw new Error("Failed to set user data.");
    }
  };

  const clearUser = async () => {
    try {
      await SecureStore.deleteItemAsync("userToken");
      await SecureStore.deleteItemAsync("userId");

      setUserId("");
      setToken("");
      setFirstName("");
      setLastName("");
      setInstitution("");
      setStudentType(null);
      setLikedProducts([]);
      setUnreadCount(0); //ADD THIS: Clear unread count on logout
    } catch (error) {
      console.error("Error clearing user data:", error);
      throw new Error("Failed to clear user data.");
    }
  };

  return (
    <UserContext.Provider
      value={{
        userId,
        token,
        firstName,
        lastName,
        institution,
        studentType,
        likedProducts,
        setLikedProducts,
        isLoading,
        setUser,
        clearUser,
        unreadCount, // ADD THIS: Provide unreadCount to the context
        setUnreadCount, // ADD THIS: Provide setUnreadCount to the context
      }}
    >
      {children}
    </UserContext.Provider>
  );
};
