import React, { useState, useEffect, useContext } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  Alert,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import BottomNavBar from "./components/BottomNavbar";
import { NGROK_URL } from "@env";
import { UserContext } from "./UserContext";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "./navigationTypes";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";

const { width } = Dimensions.get("window");

interface Gig {
  id: string;
  title: string;
  description: string;
  category: string;
  price: string;
  userId: string;
}

interface GigMatch {
  id: string;
  title: string;
  description: string;
  category: string;
  price: string;
  similarity: number;
}

const suggestionPhrases = [
  "I need a logo designer",
  "Looking for a web developer",
  "Require tutoring in Physics",
  "Need content writing services",
  "Seeking a graphic designer",
];

const categoryIcons: { [key: string]: string } = {
  Tutoring: "school-outline",
  Design: "color-palette-outline",
  Writing: "create-outline",
  Delivery: "bicycle-outline",
  Coding: "code-slash-outline",
  Other: "grid-outline",
};

const categoriesFilter = [
  "All",
  "Tutoring",
  "Design",
  "Writing",
  "Delivery",
  "Coding",
  "Other",
];

/* ----------------- Helper Functions ----------------- */

// Standard Fisher–Yates shuffle for randomizing every time the page loads.
function shuffleArray<T>(array: T[]): T[] {
  const copy = array.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// A simple seeded random generator
function getSeededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

// Seeded shuffle to deterministically randomize the gigs based on the seed.
function seededShuffle<T>(array: T[], seed: number): T[] {
  const copy = array.slice();
  let currentSeed = seed;
  for (let i = copy.length - 1; i > 0; i--) {
    currentSeed++;
    const j = Math.floor(getSeededRandom(currentSeed) * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Get today's seed based on the current date (e.g. "20250214")
function getTodaySeed(): number {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return parseInt(today, 10);
}

// Select 3 featured gigs in a deterministic (seeded) way.
function getFeaturedGigs(gigs: Gig[]): Gig[] {
  if (gigs.length === 0) return [];
  const seed = getTodaySeed();
  const shuffled = seededShuffle(gigs, seed);
  return shuffled.slice(0, Math.min(3, gigs.length));
}

const setValidatedGigs = (
  data: any,
  setGigs: React.Dispatch<React.SetStateAction<Gig[] | null>>
) => {
  if (data && Array.isArray(data.gigs)) {
    setGigs(data.gigs);
  } else if (Array.isArray(data)) {
    setGigs(data);
  } else {
    console.error("Invalid gigs data:", data);
    Alert.alert("Error", "Received invalid gigs data.");
  }
};

type JobsScreenRouteProp = RouteProp<RootStackParamList, "Jobs">;
type JobsScreenNavigationProp = StackNavigationProp<RootStackParamList, "Jobs">;

const JobsScreen: React.FC = () => {
  const navigation = useNavigation<JobsScreenNavigationProp>();
  const route = useRoute<JobsScreenRouteProp>();
  const { token } = useContext(UserContext);

  // If gigs were pre-fetched and passed via route params, use them;
  // otherwise, start with null.
  const preFetchedGigs: Gig[] | undefined = route.params?.preFetchedGigs;
  const [gigs, setGigs] = useState<Gig[] | null>(preFetchedGigs || null);
  // We'll use a separate state for the randomized "all services" list.
  const [randomGigs, setRandomGigs] = useState<Gig[]>([]);

  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchBar, setShowSearchBar] = useState(false);
  const [currentFilter, setCurrentFilter] = useState("All");
  const [filterMenuVisible, setFilterMenuVisible] = useState<boolean>(false);

  useEffect(() => {
    if (gigs === null) {
      fetchGigs();
    }
  }, []);

  // Once gigs are loaded, randomize the "all services" list.
  useEffect(() => {
    if (gigs) {
      setRandomGigs(shuffleArray(gigs));
    }
  }, [gigs]);

  const fetchGigs = async () => {
    try {
      const response = await fetch(`${NGROK_URL}/services`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch gigs: ${response.status}`);
      }
      const data = await response.json();
      console.log("Fetched Gigs:", data);
      setValidatedGigs(data, setGigs);
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Unable to fetch services. Please try again later.");
      setGigs([]);
    }
  };

  // Compute featured gigs using the seeded shuffle (3 per day).
  const featuredGigs = gigs ? getFeaturedGigs(gigs) : [];

  // Filtered gigs based on current filter and search query,
  // using the randomized order from randomGigs.
  const filteredGigs = randomGigs.filter((gig) => {
    const matchSearch =
      gig.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      gig.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      gig.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchCategory = currentFilter === "All" || gig.category === currentFilter;
    return matchSearch && matchCategory;
  });

  const toggleSearchBar = () => {
    setShowSearchBar(!showSearchBar);
  };

  const getDisplayedPrice = (price: string): string => {
    return price.replace(/^\$/, "");
  };

  const truncateDescription = (desc: string, length: number) => {
    if (desc.length <= length) return desc;
    return desc.slice(0, length) + "...";
  };

  return (
    <View style={styles.container}>
      {/* Header with Title, Search & Filter Icons */}
      <View style={styles.headerContainer}>
        <Text style={styles.headerTitle}>Explore Services</Text>
        <View style={styles.headerIcons}>
          <TouchableOpacity onPress={toggleSearchBar} style={styles.headerIconButton}>
            <Ionicons
              name={showSearchBar ? "close" : "search-outline"}
              size={24}
              color="#BB86FC"
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.filterButton}
            onPress={() => setFilterMenuVisible(true)}
            accessibilityLabel="Filter Options"
          >
            <Ionicons
              name="filter-outline"
              size={20}
              color="#BB86FC"
              style={{ marginRight: 5 }}
            />
            <Text style={styles.filterButtonText}>{currentFilter}</Text>
            {currentFilter !== "All" && (
              <Ionicons name="close-circle" size={18} color="#BB86FC" />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Expanded Search Bar */}
      {showSearchBar && (
        <View style={styles.searchBarContainer}>
          <Ionicons
            name="search-outline"
            size={20}
            color="#BB86FC"
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Search for services..."
            placeholderTextColor="#888"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Ionicons name="close-circle" size={20} color="#888" />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Filter Modal */}
      <Modal
        visible={filterMenuVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setFilterMenuVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPressOut={() => setFilterMenuVisible(false)}
        >
          <View style={styles.filterModalContainer}>
            <Text style={styles.filterModalTitle}>Select Category</Text>
            {categoriesFilter.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={styles.filterModalOption}
                onPress={() => {
                  setCurrentFilter(cat);
                  setFilterMenuVisible(false);
                }}
              >
                <Ionicons
                  name={categoryIcons[cat] || "grid-outline"}
                  size={20}
                  color="#BB86FC"
                  style={{ marginRight: 10 }}
                />
                <Text style={styles.filterModalOptionText}>{cat}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Featured Gigs */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Featured</Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.featuredScroll}
          contentContainerStyle={{ paddingLeft: 8 }}
        >
          {featuredGigs.map((gig) => (
            <TouchableOpacity
              key={gig.id}
              onPress={() =>
                navigation.navigate("JobDetail", { jobId: gig.id })
              }
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={["#7F00FF", "#E100FF"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.featuredCard}
              >
                <Text style={styles.featuredTitle}>{gig.title}</Text>
                <View style={styles.featuredCategoryRow}>
                  <Ionicons
                    name={categoryIcons[gig.category] || "grid-outline"}
                    size={16}
                    color="#FFFFFF"
                    style={{ marginRight: 5 }}
                  />
                  <Text style={styles.featuredCategory}>{gig.category}</Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* All Services */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>All Services</Text>
        </View>

        {filteredGigs.length > 0 ? (
          filteredGigs.map((gig) => {
            const displayedPrice = getDisplayedPrice(gig.price);
            return (
              <TouchableOpacity
                key={gig.id}
                onPress={() =>
                  navigation.navigate("JobDetail", { jobId: gig.id })
                }
                activeOpacity={0.8}
              >
                <View style={styles.gigCard}>
                  <View style={styles.gigInfo}>
                    <Text style={styles.gigTitle}>{gig.title}</Text>
                    <View style={styles.gigCategoryRow}>
                      <Ionicons
                        name={categoryIcons[gig.category] || "grid-outline"}
                        size={16}
                        color="#BB86FC"
                        style={{ marginRight: 6 }}
                      />
                      <Text style={styles.gigCategory}>{gig.category}</Text>
                    </View>
                    <Text style={styles.gigDescription}>
                      {truncateDescription(gig.description, 60)}
                    </Text>
                    <Text style={styles.gigPrice}>${displayedPrice}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#BB86FC" />
                </View>
              </TouchableOpacity>
            );
          })
        ) : (
          <Text style={styles.noResultsText}>
            No services found for "{currentFilter}"
          </Text>
        )}
      </ScrollView>

      {/* Bottom Navbar */}
      <BottomNavBar />
    </View>
  );
};

export default JobsScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
    position: "relative",
  },
  headerContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#0B0B0B",
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 5,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  headerIcons: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerIconButton: {
    marginRight: 12,
  },
  filterButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: "#1A1A1A",
    borderRadius: 20,
  },
  filterButtonText: {
    color: "#BB86FC",
    fontSize: 14,
    marginRight: 5,
  },
  searchBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0B0B0B",
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 25,
    paddingHorizontal: 15,
    paddingVertical: 8,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 15,
  },
  scrollContainer: {
    paddingBottom: 90,
    paddingHorizontal: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  featuredScroll: {
    marginTop: 10,
  },
  featuredCard: {
    width: 200,
    height: 100,
    borderRadius: 12,
    padding: 16,
    marginRight: 16,
    justifyContent: "space-around",
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  featuredTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  featuredCategoryRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  featuredCategory: {
    fontSize: 13,
    color: "#FFFFFF",
  },
  gigCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0B0B0B",
    marginVertical: 8,
    padding: 12,
    borderRadius: 10,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  gigInfo: {
    flex: 1,
    marginRight: 10,
  },
  gigTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  gigCategoryRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  gigCategory: {
    fontSize: 13,
    color: "#BB86FC",
  },
  gigDescription: {
    fontSize: 13,
    color: "#B3B3B3",
    marginBottom: 4,
  },
  gigPrice: {
    fontSize: 13,
    fontWeight: "500",
    color: "#BB86FC",
  },
  noResultsText: {
    fontSize: 14,
    color: "#B3B3B3",
    textAlign: "center",
    marginTop: 40,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "flex-end",
  },
  filterModalContainer: {
    backgroundColor: "#0B0B0B",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
  },
  filterModalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 12,
  },
  filterModalOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
  },
  filterModalOptionText: {
    fontSize: 14,
    color: "#FFFFFF",
  },
});
