import React, { useContext, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  TouchableOpacity,
  Image,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { UserContext } from "./UserContext"; // Adjust path if necessary
import { NGROK_URL } from "@env";
import { CommonActions, useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "./navigationTypes"; // Adjust path if necessary
import * as ImagePicker from "expo-image-picker";

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
  }, []);

  // Function to upload new profile pic (Cloudinary upload then PUT to backend)
  const uploadProfilePic = async (uri: string) => {
    try {
      const CLOUDINARY_URL =
        "https://api.cloudinary.com/v1_1/ds0zpfht9/image/upload";
      const UPLOAD_PRESET = "gridly_preset";

      const formData = new FormData();
      formData.append("file", {
        uri,
        type: "image/jpeg",
        name: `profile_${Date.now()}.jpg`,
      } as any);
      formData.append("upload_preset", UPLOAD_PRESET);

      // Upload to Cloudinary
      const cloudResponse = await fetch(CLOUDINARY_URL, {
        method: "POST",
        body: formData,
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      const cloudData = await cloudResponse.json();
      if (!cloudData.secure_url) {
        throw new Error("Failed to upload image.");
      }
      const newProfilePicUrl = cloudData.secure_url;

      // Update backend with the new profile pic URL using a PUT request
      const updateResponse = await fetch(`${NGROK_URL}/user/update-profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ profilePic: newProfilePicUrl }),
      });

      if (!updateResponse.ok) {
        throw new Error("Failed to update profile picture.");
      }
      const updateData = await updateResponse.json();

      // Update local state with the new profilePic
      setUserData((prevData: any) => ({
        ...prevData,
        profilePic: updateData.profilePic,
      }));

      Alert.alert("Success", "Profile picture updated!");
    } catch (error) {
      console.error("Profile pic upload error:", error);
      Alert.alert("Error", "Failed to update profile picture.");
    }
  };

  // Function to pick an image from the library
  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1], // Square crop
      quality: 0.7,
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      await uploadProfilePic(result.assets[0].uri);
    }
  };

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
        <TouchableOpacity style={styles.retryButton} onPress={fetchUserData}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      bounces={false}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>My Account</Text>

      {/* Profile Picture */}
      <View style={styles.profileContainer}>
        <TouchableOpacity onPress={pickImage}>
          {userData.profilePic ? (
            <Image
              source={{ uri: userData.profilePic }}
              style={styles.profilePic}
            />
          ) : (
            <View style={styles.placeholder}>
              <Ionicons name="camera-outline" size={30} color="#666" />
              <Text style={styles.placeholderText}>Add Profile Pic</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* User Details */}
      <View style={styles.infoRow}>
        <Text style={styles.label}>First Name:</Text>
        <Text style={styles.value}>{userData.firstName}</Text>
      </View>
      <View style={styles.divider} />
      <View style={styles.infoRow}>
        <Text style={styles.label}>Last Name:</Text>
        <Text style={styles.value}>{userData.lastName}</Text>
      </View>
      <View style={styles.divider} />
      <View style={styles.infoRow}>
        <Text style={styles.label}>Email:</Text>
        <Text style={styles.value}>{userData.email}</Text>
      </View>
      <View style={styles.divider} />
      <View style={styles.infoRow}>
        <Text style={styles.label}>Institution:</Text>
        <Text style={styles.value}>{userData.institution}</Text>
      </View>
      <Text style={styles.note}>
        Note: The above information cannot be changed.
      </Text>

      {/* Delete Account Button */}
      <View style={styles.deleteAccountContainer}>
        <TouchableOpacity
          style={styles.deleteAccountButton}
          onPress={() =>
            Alert.alert(
              "Delete Account",
              "Are you sure you want to delete your account? All your information—including products, gigs, and requests—will be permanently deleted.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Delete",
                  style: "destructive",
                  onPress: async () => {
                    try {
                      const response = await fetch(`${NGROK_URL}/user/delete`, {
                        method: "DELETE",
                        headers: {
                          "Content-Type": "application/json",
                          Authorization: `Bearer ${token}`,
                        },
                      });
                      if (!response.ok) {
                        throw new Error("Failed to delete account.");
                      }
                      Alert.alert(
                        "Account Deleted",
                        "Your account has been successfully deleted."
                      );
                      await clearUser();
                      navigation.dispatch(
                        CommonActions.reset({
                          index: 0,
                          routes: [{ name: "Login" }],
                        })
                      );
                    } catch (error) {
                      Alert.alert(
                        "Error",
                        "Failed to delete account. Please try again later."
                      );
                    }
                  },
                },
              ]
            )
          }
        >
          <Text style={styles.deleteAccountText}>Delete Account</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

export default AccountScreen;

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: "#000",
    padding: 20,
    paddingBottom: 40,
    justifyContent: "flex-start",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
    paddingHorizontal: 15,
  },
  errorText: {
    color: "#FF6B6B",
    fontSize: 16,
    textAlign: "center",
    marginBottom: 10,
  },
  retryButton: {
    backgroundColor: "#BB86FC",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
  },
  retryButtonText: {
    color: "#000",
    fontSize: 16,
    fontWeight: "600",
  },
  title: {
    fontSize: 28,
    color: "#BB86FC",
    fontWeight: "700",
    marginBottom: 20,
    textAlign: "center",
    marginTop: 10,
  },
  profileContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
  profilePic: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: "#BB86FC",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
  },
  label: {
    fontSize: 18,
    color: "#fff",
    fontWeight: "600",
    width: 140,
  },
  value: {
    fontSize: 18,
    color: "#ccc",
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: "#333",
    marginVertical: 5,
  },
  placeholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: "#BB86FC",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#222",
  },
  placeholderText: {
    fontSize: 14,
    color: "#666",
    marginTop: 5,
  },
  note: {
    marginTop: 20,
    fontSize: 14,
    color: "#777",
    textAlign: "center",
    fontStyle: "italic",
  },
  deleteAccountContainer: {
    marginTop: 30,
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  deleteAccountButton: {
    backgroundColor: "#FF3B30",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  deleteAccountText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
});
