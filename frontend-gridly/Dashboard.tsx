import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  TextInput,
  Switch,
  Modal,
} from "react-native";
import {
  RouteProp,
  useNavigation,
  NavigationProp,
} from "@react-navigation/native";
import Ionicons from "react-native-vector-icons/Ionicons";

import { RootStackParamList } from "./navigationTypes";

type DashboardProps = {
  route: RouteProp<RootStackParamList, "Dashboard">;
};

const Dashboard: React.FC<DashboardProps> = ({ route }) => {
  const { firstName } = route.params;
  const [isMarketplace, setIsMarketplace] = React.useState(true);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const toggleMarketplace = () => {
    setIsMarketplace((previousState) => !previousState);
  };

  const toggleModal = () => {
    setIsModalVisible(!isModalVisible);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.greetingText}>Welcome, {firstName}</Text>
        <TouchableOpacity style={styles.postJobButton}>
          <Text style={styles.postJobText}>Active Gigs</Text>
        </TouchableOpacity>
      </View>

      {/* Search Bar with Toggle */}
      <View style={styles.searchToggleContainer}>
        <View style={styles.searchContainer}>
          <Ionicons
            name="search"
            size={20}
            color="#000"
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Search..."
            placeholderTextColor="#999"
          />
        </View>

        {/* Small Toggle Button */}
        <View style={styles.toggleContainer}>
          <TouchableOpacity
            onPress={() => {
              /* Navigate to all products */
            }}
          >
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
        <Image
          source={{ uri: "https://via.placeholder.com/400" }}
          style={styles.productImage}
          resizeMode="cover"
        />
        <View style={styles.priceOverlay}>
          <Text style={styles.productPrice}>$100</Text>
        </View>
        <Text style={styles.productDescription}>
          Brief description of the item.
        </Text>
      </View>

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem}>
          <Ionicons name="home-outline" size={28} color="#000" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={toggleModal}>
          <Ionicons name="add-circle" size={56} color="#000" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem}>
          <Ionicons name="stats-chart-outline" size={28} color="#000" />
        </TouchableOpacity>
      </View>

      {/* Modal for Add Options */}
      <Modal
        visible={isModalVisible}
        transparent
        animationType="fade"
        onRequestClose={toggleModal}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Options</Text>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => {
                toggleModal();
                navigation.navigate("AddProduct"); // Use the correct route name as a string
              }}
            >
              <Text style={styles.modalButtonText}>Add Product</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => {
                toggleModal();
                navigation.navigate(""); // Correct route name
              }}
            >
              <Text style={styles.modalButtonText}>Add Gig</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={toggleModal} style={styles.modalClose}>
              <Ionicons name="close-outline" size={24} color="#000" />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
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
    marginBottom: 15,
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
    marginVertical: 15,
  },
  productImage: {
    width: "95%",
    height: "105%",
    alignSelf: "center",
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
  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: "80%",
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 15,
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 15,
  },
  modalButton: {
    backgroundColor: "#000",
    paddingVertical: 10,
    paddingHorizontal: 30,
    borderRadius: 20,
    marginVertical: 5,
  },
  modalButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "500",
  },
  modalClose: {
    position: "absolute",
    top: 10,
    right: 10,
  },
});
