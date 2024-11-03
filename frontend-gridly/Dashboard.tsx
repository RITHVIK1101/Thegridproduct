import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  TextInput,
  Switch,
} from "react-native";
import { RouteProp } from "@react-navigation/native";
import Icon from "react-native-vector-icons/Ionicons";
import { RootStackParamList } from "./navigationTypes";

type DashboardProps = {
  route: RouteProp<RootStackParamList, "Dashboard">;
};

const Dashboard: React.FC<DashboardProps> = ({ route }) => {
  const { firstName } = route.params;
  const [isMarketplace, setIsMarketplace] = React.useState(true);

  const toggleMarketplace = () => {
    setIsMarketplace((previousState) => !previousState);
    // Add functionality to switch marketplaces here
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.greetingText}>Welcome, {firstName}</Text>

        {/* Active Gigs Button */}
        <TouchableOpacity style={styles.postJobButton}>
          <Text style={styles.postJobText}>Active Gigs</Text>
        </TouchableOpacity>
      </View>

      {/* Search Bar with Toggle */}
      <View style={styles.searchToggleContainer}>
        <View style={styles.searchContainer}>
          <Icon name="search" size={20} color="#000" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search..."
            placeholderTextColor="#999"
          />
        </View>

        {/* Small Toggle Button */}
        <View style={styles.toggleContainer}>
          {/* View All Products Text */}
          <TouchableOpacity onPress={() => {/* Navigate to all products */}}>
            <Text style={styles.viewAllText}>View All</Text>
          </TouchableOpacity>

          <Switch
            trackColor={{ false: "#ccc", true: "#000" }}
            thumbColor="#fff"
            ios_backgroundColor="#ccc"
            onValueChange={toggleMarketplace}
            value={!isMarketplace}
          />
        </View>
      </View>

      {/* Refined Product Card */}
      <View style={styles.productCard}>
        {/* Product Image */}
        <Image
          source={{ uri: "https://via.placeholder.com/400" }}
          style={styles.productImage}
          resizeMode="cover" // Ensures the image covers the container
        />

        {/* Price Overlay */}
        <View style={styles.priceOverlay}>
          <Text style={styles.productPrice}>$100</Text>
        </View>

        {/* Description */}
        <Text style={styles.productDescription}>
          Brief description of the item.
        </Text>
      </View>

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem}>
          <Icon name="home-outline" size={28} color="#000" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem}>
          <Icon name="add-circle" size={56} color="#000" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem}>
          <Icon name="stats-chart-outline" size={28} color="#000" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default Dashboard;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    paddingHorizontal: 20,
    paddingTop: 40,
  },
  header: {
    flexDirection: "row", // Arrange items horizontally
    alignItems: "center", // Center items vertically
    justifyContent: "space-between", // Space between items
    marginBottom: 20, // Shift everything else up
  },
  greetingText: {
    fontSize: 24,
    fontWeight: "600",
    color: "#000",
  },
  postJobButton: {
    backgroundColor: "#000",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 30,
  },
  postJobText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "500",
  },
  searchToggleContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 15, // Adjusted to shift components up
  },
  searchContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f2f2f2",
    borderRadius: 30,
    paddingHorizontal: 15,
    paddingVertical: 8,
  },
  searchIcon: {
    marginRight: 10,
    color: "#000",
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: "#000",
  },
  toggleContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 15,
  },
  viewAllText: {
    fontSize: 12,
    color: "#000",
    marginRight: 10,
  },
  productCard: {
    flex: 1,
    borderRadius: 20,
    overflow: "hidden",
    marginVertical: 15, // Reduced to shift components up
  },
  productImage: {
    width: "95%", // Decreased the image width slightly
    height: "105%", // Increased the image height slightly
    alignSelf: "center", // Center the image horizontally
  },
  priceOverlay: {
    position: "absolute",
    top: 15,
    right: 15,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  productPrice: {
    fontSize: 20,
    fontWeight: "600",
    color: "#fff",
  },
  productDescription: {
    position: "absolute",
    bottom: 20,
    left: 20,
    right: 20,
    fontSize: 16,
    color: "#fff",
    textAlign: "center",
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    padding: 10,
    borderRadius: 10,
  },
  bottomNav: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingVertical: 15,
  },
  navItem: {
    alignItems: "center",
  },
});
