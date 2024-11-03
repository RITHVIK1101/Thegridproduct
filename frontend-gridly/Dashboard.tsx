import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { RouteProp } from "@react-navigation/native";
import Icon from "react-native-vector-icons/Ionicons";
import { RootStackParamList } from "./navigationTypes";

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

      {/* Bottom Icons: Home, Plus, and Activity */}
      <View style={styles.bottomIcons}>
        {/* Home Icon (Left) */}
        <TouchableOpacity style={styles.iconButton}>
          <Icon name="home" size={30} color="#006400" />
        </TouchableOpacity>

        {/* Plus Icon (Center) */}
        <TouchableOpacity style={[styles.iconButton, styles.plusButton]}>
          <Icon name="add-circle-outline" size={40} color="#000" />
        </TouchableOpacity>

        {/* Activity Icon (Right) */}
        <TouchableOpacity style={styles.iconButton}>
          <Icon name="stats-chart-outline" size={30} color="#000" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

// Default export
export default Dashboard;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  greetingText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#006400",
  },
  sectionsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 20,
  },
  sectionCard: {
    backgroundColor: "#E6F7FF",
    flex: 1,
    padding: 25,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 0,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  activeSection: {
    borderWidth: 2,
    borderColor: "#006400",
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#006400",
  },
  activeText: {
    color: "#006400",
  },
  divider: {
    height: 1,
    backgroundColor: "#ccc",
    position: "absolute",
    bottom: 100,
    width: "80%",
    alignSelf: "center",
  },
  bottomIcons: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    position: "absolute",
    bottom: 20,
    left: 0,
    right: 0,
    paddingHorizontal: 40,
  },
  iconButton: {
    width: 50,
    height: 50,
    justifyContent: "center",
    alignItems: "center",
  },
  plusButton: {
    transform: [{ scale: 1.1 }],
  },
});