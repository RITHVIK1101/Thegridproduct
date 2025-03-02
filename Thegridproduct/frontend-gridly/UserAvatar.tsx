import React from "react";
import { TouchableOpacity, Text, StyleSheet, Image } from "react-native";

interface UserAvatarProps {
  firstName?: string;
  lastName?: string;
  profilePic?: string; // URL of the user's profile picture
  onPress: () => void;
}

const UserAvatar: React.FC<UserAvatarProps> = ({
  firstName,
  lastName,
  profilePic,
  onPress,
}) => {
  const initials = `${firstName?.charAt(0).toUpperCase() || "?"}${
    lastName?.charAt(0).toUpperCase() || "?"
  }`;

  return (
    <TouchableOpacity
      onPress={onPress}
      style={styles.userAvatar}
      accessibilityLabel="Open User Menu"
    >
      {profilePic ? (
        <Image source={{ uri: profilePic }} style={styles.profileImage} />
      ) : (
        <Text style={styles.userAvatarText}>{initials}</Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  userAvatar: {
    width: 36,
    height: 36,
    borderRadius: 20,
    backgroundColor: "#6f42c1",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  userAvatarText: {
    color: "#FFF",
    fontWeight: "700",
    fontSize: 16,
  },
  profileImage: {
    width: "100%",
    height: "100%",
    borderRadius: 20, // Ensures it remains circular
  },
});

export default UserAvatar;
