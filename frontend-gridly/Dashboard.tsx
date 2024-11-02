import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { RouteProp } from "@react-navigation/native";
import Icon from "react-native-vector-icons/Ionicons"; // Importing icons
import { RootStackParamList } from "./navigationTypes"; // Import unchanged

type DashboardProps = {
  route: RouteProp<RootStackParamList, "Dashboard">;
};

const Dashboard: React.FC<DashboardProps> = ({ route }) => {
  const { firstName } = route.params;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.greetingText}>Hi, {firstName}!</Text>
      </View>

      {/* Marketplace and Campus Gigs */}
      <View style={styles.sectionsContainer}>
        <TouchableOpacity style={[styles.sectionCard, styles.activeSection]}>
          <Text style={[styles.sectionTitle, styles.activeText]}>Marketplace</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Campus Gigs</Text>
        </TouchableOpacity>
      </View>

      {/* Horizontal Divider */}
      <View style={styles.divider} />

      {/* Plus Button at the Bottom Center */}
      <TouchableOpacity style={styles.addButton}>
        <Icon name="add-outline" size={24} color="#fff" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 20,
  },
  header: {
    alignItems: "flex-start",
    marginBottom: 10,
  },
  greetingText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#006400", // Dark green
  },
  sectionsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 20,
  },
  sectionCard: {
    backgroundColor: "#E6F7FF",
    flex: 1,
    padding: 25, // Increased padding for bigger buttons
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 0, // Removed space between buttons
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  activeSection: {
    borderWidth: 2,
    borderColor: "#006400", // Dark green highlight for active tab
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#006400", // Dark green
  },
  activeText: {
    color: "#006400", // Dark green for active text
  },
  divider: {
    height: 1,
    backgroundColor: "#ccc", // Light gray for the divider line
    position: "absolute",
    bottom: 100, // Adjust this value to place the divider just above the plus button
    width: "80%", // Adjust the width to make it narrower
    alignSelf: "center", // Center the divider horizontally
  },
  addButton: {
    position: "absolute",
    bottom: 30,
    alignSelf: "center", // Use alignSelf to center horizontally
    backgroundColor: "#006400", // Dark green
    width: 50, // Reduced button size
    height: 50, // Reduced button size
    borderRadius: 25, // Adjusted borderRadius for smaller size
    justifyContent: "center",
    alignItems: "center",
  },
});

export default Dashboard;
