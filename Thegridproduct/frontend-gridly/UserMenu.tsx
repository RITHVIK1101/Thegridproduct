import React, { useContext, memo, useState } from "react";
import { 
  View, 
  TouchableOpacity, 
  Text, 
  StyleSheet, 
  Image, 
  Modal 
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { UserContext } from "./UserContext";

const UserMenuScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const {
    clearUser,
    firstName,
    lastName,
    institution,
    profilePic,
    grids, // ✅ Fetch grids from context
  } = useContext(UserContext);

  const [isGridsModalVisible, setIsGridsModalVisible] = useState(false);

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

          {/* ✅ Grids Badge UI wrapped in a Touchable */}
          <TouchableOpacity 
            style={styles.gridsBadge}
            onPress={() => setIsGridsModalVisible(true)}
            accessibilityLabel="Show Grids Explanation"
          >
            <Ionicons name="grid-outline" size={16} color="#FFF" />
            <Text style={styles.gridsText}>{grids} Grids</Text>
          </TouchableOpacity>
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

      {/* Grids Explanation Modal */}
      <Modal
        visible={isGridsModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsGridsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>What are Grids?</Text>
            <Text style={styles.modalBody}>
              Grids are a score that represents your activity and engagement on the platform. 
              You earn Grids when you post a product, request a product, or create a gig. 
              Your current Grid count is {grids}.
            </Text>
            <TouchableOpacity
              style={styles.closeModalButton}
              onPress={() => setIsGridsModalVisible(false)}
              accessibilityLabel="Close Grids Info"
            >
              <Text style={styles.closeModalButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    overflow: "hidden",
  },
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
  /* ✅ Grids Badge Style */
  gridsBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#7B61FF",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 10,
    shadowColor: "#7B61FF",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  gridsText: {
    fontSize: 14,
    color: "#FFFFFF",
    fontWeight: "600",
    marginLeft: 5,
  },
  bottomSheetOptions: { marginTop: 20, width: "100%" },
  bottomSheetOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 15,
    borderBottomColor: "#333333",
    borderBottomWidth: 1,
  },
  bottomSheetOptionText: { color: "#FFFFFF", fontSize: 16 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#1E1E1E",
    padding: 40,
    borderRadius: 20,
    alignItems: "center",
    width: "85%",
    borderWidth: 1,
    borderColor: "#7B61FF",
    shadowColor: "#7B61FF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 15,
    textAlign: "center",
  },
  modalBody: {
    fontSize: 16,
    color: "#CCCCCC",
    textAlign: "center",
    marginBottom: 20,
  },
  closeModalButton: {
    backgroundColor: "#7B61FF",
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 10,
  },
  closeModalButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default memo(UserMenuScreen);
