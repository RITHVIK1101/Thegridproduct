import React, { useContext, memo } from "react";
import { View, TouchableOpacity, Text, StyleSheet, Image } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { UserContext } from "./UserContext";

const UserMenuScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  // Add profilePic here
  const {
    clearUser,
    firstName,
    lastName,
    institution,
    studentType,
    profilePic,
  } = useContext(UserContext);

  const handleLogout = async () => {
    try {
      await clearUser();
      navigation.replace("Login");
    } catch (error) {
      console.error("Logout Error:", error);
    }
  };

  return (
    <View style={styles.fullScreenMenuContainer}>
      <View style={styles.fullScreenMenuHeader}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          accessibilityLabel="Close User Menu"
        >
          <Ionicons name="close" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
      <View style={styles.fullScreenMenuContent}>
        <View style={styles.bottomSheetUserInfo}>
          {/* Conditionally render profile pic or initials */}
          <View style={styles.bottomSheetAvatar}>
            {profilePic ? (
              <Image
                source={{ uri: profilePic }}
                style={styles.menuProfileImage}
              />
            ) : (
              <Text style={styles.bottomSheetAvatarText}>
                {firstName?.charAt(0).toUpperCase() || "?"}
                {lastName?.charAt(0).toUpperCase() || "?"}
              </Text>
            )}
          </View>
          <Text style={styles.bottomSheetUserName}>
            {firstName} {lastName}
          </Text>
          {institution && (
            <Text style={styles.bottomSheetUserInstitution}>{institution}</Text>
          )}
          {studentType && (
            <Text style={styles.bottomSheetUserInstitution}>
              {studentType.charAt(0).toUpperCase() + studentType.slice(1)}
            </Text>
          )}
        </View>

        <View style={styles.bottomSheetOptions}>
          <TouchableOpacity
            style={styles.bottomSheetOption}
            onPress={handleLogout}
          >
            <Ionicons
              name="log-out-outline"
              size={20}
              color="#FFFFFF"
              style={{ marginRight: 10 }}
            />
            <Text style={styles.bottomSheetOptionText}>Logout</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.bottomSheetOption}
            onPress={() => navigation.navigate("TermsOfService")}
          >
            <Ionicons
              name="document-text-outline"
              size={20}
              color="#FFFFFF"
              style={{ marginRight: 10 }}
            />
            <Text style={styles.bottomSheetOptionText}>View Terms of Use</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.bottomSheetOption}
            onPress={() => navigation.navigate("Account")}
          >
            <Ionicons
              name="person-circle-outline"
              size={20}
              color="#FFFFFF"
              style={{ marginRight: 10 }}
            />
            <Text style={styles.bottomSheetOptionText}>My Account</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.bottomSheetOption}
            onPress={() => navigation.navigate("GetInTouch")}
          >
            <Ionicons
              name="mail-outline"
              size={20}
              color="#FFFFFF"
              style={{ marginRight: 10 }}
            />
            <Text style={styles.bottomSheetOptionText}>Get in Touch</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  fullScreenMenuContainer: { flex: 1, backgroundColor: "#000000" },
  fullScreenMenuHeader: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
  },
  fullScreenMenuContent: {
    flex: 1,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  bottomSheetUserInfo: { alignItems: "center", marginBottom: 20 },
  bottomSheetAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#8a2be2",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
    overflow: "hidden", // So image doesn't spill out
  },
  // Add a style for the image
  menuProfileImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  bottomSheetAvatarText: {
    color: "#FFF",
    fontWeight: "700",
    fontSize: 24,
  },
  bottomSheetUserName: { fontSize: 18, fontWeight: "700", color: "#FFFFFF" },
  bottomSheetUserInstitution: { fontSize: 14, color: "#CCCCCC", marginTop: 5 },
  bottomSheetOptions: { marginTop: 20, width: "100%" },
  bottomSheetOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 15,
    borderBottomColor: "#333333",
    borderBottomWidth: 1,
  },
  bottomSheetOptionText: { color: "#FFFFFF", fontSize: 16 },
});

export default memo(UserMenuScreen);
