import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { RouteProp } from "@react-navigation/native";
import { RootStackParamList } from "./navigationTypes";

type DashboardProps = {
  route: RouteProp<RootStackParamList, "Dashboard">;
};

const Dashboard: React.FC<DashboardProps> = ({ route }) => {
  const { firstName } = route.params;

  return (
    <View style={styles.container}>
      <Text style={styles.welcomeText}>
        Welcome to the Gridly, {firstName}!
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f2f2f2",
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: "bold",
  },
});

export default Dashboard;
