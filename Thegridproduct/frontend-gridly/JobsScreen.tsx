// JobsScreen.tsx

import React, { useState, useRef, useEffect, useContext } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Animated,
  Easing,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  ActivityIndicator,
  Alert,
  PanResponder,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import BottomNavBar from "./components/BottomNavbar";
import { NGROK_URL } from "@env";
import { UserContext } from "./UserContext";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "./navigationTypes"; // Adjust the path if necessary
import { useNavigation } from "@react-navigation/native";

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

interface TextMessage {
  id: string;
  text: string;
  role: "user" | "assistant";
  type: "text";
}

interface GigMessage {
  id: string;
  text: string; // Gig title
  role: "assistant";
  type: "gig";
  gig: GigMatch;
}

type Message = TextMessage | GigMessage;

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

// Helper function to get featured gigs based on the current cycle
const getCurrentCycle = (): number => {
  const now = new Date();
  // Calculate the number of 12-hour periods since epoch
  const cycle = Math.floor(now.getTime() / (12 * 60 * 60 * 1000));
  return cycle;
};

const getFeaturedGigs = (gigs: Gig[]): Gig[] => {
  if (gigs.length === 0) return [];

  const cycle = getCurrentCycle();
  const firstIndex = cycle % gigs.length;
  const secondIndex = (cycle + 1) % gigs.length;

  if (gigs.length === 1) {
    return [gigs[0]];
  }

  return [gigs[firstIndex], gigs[secondIndex]];
};

// Helper function to detect greetings
const isGreeting = (text: string): boolean => {
  const greetings = [
    "hello",
    "hi",
    "hey",
    "good morning",
    "good afternoon",
    "good evening",
    "greetings",
    "salutations",
  ];
  const lowerText = text.toLowerCase();
  return greetings.some((greet) => lowerText.includes(greet));
};

// Helper function to validate and set gigs
const setValidatedGigs = (
  data: any,
  setGigs: React.Dispatch<React.SetStateAction<Gig[]>>
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

// Define the navigation prop type
type JobsScreenNavigationProp = StackNavigationProp<RootStackParamList, "Jobs">;

const JobsScreen: React.FC = () => {
  const navigation = useNavigation<JobsScreenNavigationProp>();
  const { token } = useContext(UserContext);

  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchBar, setShowSearchBar] = useState(false);
  const [showAssistant, setShowAssistant] = useState(false);
  const [hasUserMessaged, setHasUserMessaged] = useState(false);
  const assistantAnim = useRef(new Animated.Value(0)).current;
  const [currentFilter, setCurrentFilter] = useState("All");
  const [filterMenuVisible, setFilterMenuVisible] = useState<boolean>(false);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "init1",
      text: "Hey there! 👋 How can I assist you today?",
      role: "assistant",
      type: "text",
    },
  ]);
  const [userInput, setUserInput] = useState("");

  const [gigs, setGigs] = useState<Gig[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  // Initialize PanResponder for swipe-down-to-close
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // Activate responder for vertical swipes
        return Math.abs(gestureState.dy) > 10 && Math.abs(gestureState.dx) < 50;
      },
      onPanResponderMove: (evt, gestureState) => {
        if (gestureState.dy > 0) {
          // Optionally, add visual feedback here
          // For simplicity, we won't animate the modal during the swipe
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (gestureState.dy > 100) {
          // If the swipe down is beyond the threshold, close the modal
          toggleAssistant();
        }
        // If not, do nothing and keep the modal open
      },
    })
  ).current;

  useEffect(() => {
    fetchGigs();
  }, []);

  const fetchGigs = async () => {
    setLoading(true);
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
      console.log("Fetched Gigs:", data.gigs);

      setValidatedGigs(data, setGigs);
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Unable to fetch services. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  // Determine featured gigs based on the current cycle
  const featuredGigs = getFeaturedGigs(gigs);

  const filteredGigs = Array.isArray(gigs)
    ? gigs.filter((gig) => {
        const matchSearch =
          gig.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          gig.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
          gig.description.toLowerCase().includes(searchQuery.toLowerCase());

        const matchCategory =
          currentFilter === "All" || gig.category === currentFilter;

        return matchSearch && matchCategory;
      })
    : [];

  const toggleAssistant = (callback?: () => void) => {
    if (showAssistant) {
      Animated.timing(assistantAnim, {
        toValue: 0,
        duration: 300,
        easing: Easing.ease,
        useNativeDriver: true,
      }).start(() => {
        setShowAssistant(false);
        if (callback) callback();
      });
    } else {
      setShowAssistant(true);
      Animated.timing(assistantAnim, {
        toValue: 1,
        duration: 300,
        easing: Easing.ease,
        useNativeDriver: true,
      }).start();
    }
  };

  const sendMessage = async () => {
    if (userInput.trim() === "") return;

    const newUserMessage: TextMessage = {
      id: Math.random().toString(),
      text: userInput,
      role: "user",
      type: "text",
    };
    setMessages((prev) => [...prev, newUserMessage]);
    setUserInput("");

    if (isGreeting(userInput)) {
      const assistantMessage: TextMessage = {
        id: Math.random().toString(),
        text: "Hello! 👋 How can I assist you today?",
        role: "assistant",
        type: "text",
      };
      setMessages((prev) => [...prev, assistantMessage]);
      return;
    }

    try {
      setLoading(true);
      const aiResponse = await fetch(`${NGROK_URL}/services/search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ query: userInput }),
      });

      if (!aiResponse.ok) {
        throw new Error(`Failed to process AI request: ${aiResponse.status}`);
      }

      const aiData = await aiResponse.json();
      console.log("AI Response:", aiData);

      if (Array.isArray(aiData)) {
        if (aiData.length > 0 && "message" in aiData[0]) {
          // GPT is asking for clarification
          const assistantMessage: TextMessage = {
            id: Math.random().toString(),
            text: aiData[0].message,
            role: "assistant",
            type: "text",
          };
          setMessages((prev) => [...prev, assistantMessage]);
        } else if (aiData.length > 0 && "id" in aiData[0]) {
          // Received gigs
          const gigMessages: GigMessage[] = aiData.map((gig: GigMatch) => ({
            id: gig.id,
            text: gig.title, // Use gig's title for display
            role: "assistant",
            type: "gig",
            gig, // Attach the gig data
          }));
          setMessages((prev) => [...prev, ...gigMessages]);
        } else {
          // Unexpected format
          const assistantMessage: TextMessage = {
            id: Math.random().toString(),
            text: "I encountered an unexpected response. Please try again.",
            role: "assistant",
            type: "text",
          };
          setMessages((prev) => [...prev, assistantMessage]);
        }
      } else {
        // Unexpected response format
        const assistantMessage: TextMessage = {
          id: Math.random().toString(),
          text: "I encountered an unexpected response. Please try again.",
          role: "assistant",
          type: "text",
        };
        setMessages((prev) => [...prev, assistantMessage]);
      }
    } catch (error) {
      console.error(error);
      const assistantMessage: TextMessage = {
        id: Math.random().toString(),
        text: "Something went wrong. Please try again later.",
        role: "assistant",
        type: "text",
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } finally {
      setLoading(false);
    }
  };

  const sendMessageWithSuggestion = (suggestion: string) => {
    const newUserMessage: TextMessage = {
      id: Math.random().toString(),
      text: suggestion,
      role: "user",
      type: "text",
    };
    setMessages((prev) => [...prev, newUserMessage]);
    setUserInput("");

    if (!hasUserMessaged) {
      setHasUserMessaged(true);
    }

    setTimeout(() => {
      const assistantReplies = [
        "Awesome! Could you tell me more about the category or field you're interested in?",
        "Great. Any specific deadline or timeframe?",
        "Got it. What's your budget range?",
        "Perfect! I'll find some gigs that match your needs.",
      ];

      const userMessagesCount =
        messages.filter((m) => m.role === "user").length + 1;
      let responseText = "Let me think...";
      if (userMessagesCount <= assistantReplies.length) {
        responseText = assistantReplies[userMessagesCount - 1];
      } else {
        responseText = "Alright! Let me find some matches for you. One sec...";
      }

      const newAssistantMessage: TextMessage = {
        id: Math.random().toString(),
        text: responseText,
        role: "assistant",
        type: "text",
      };
      setMessages((prev) => [...prev, newAssistantMessage]);
    }, 1000);
  };

  const handleSuggestionPress = (suggestion: string) => {
    setUserInput(suggestion);
    sendMessageWithSuggestion(suggestion);
  };

  const toggleSearchBar = () => {
    setShowSearchBar(!showSearchBar);
  };

  const handleFilterPillPress = () => {
    if (currentFilter === "All") {
      setFilterMenuVisible(true);
    } else {
      // If currently filtered by a category, pressing again resets to All
      setCurrentFilter("All");
    }
  };

  // Prevent double '$' in displayed price
  const getDisplayedPrice = (price: string): string => {
    return price.replace(/^\$/, ""); // Remove leading $ if present
  };

  const truncateDescription = (desc: string, length: number) => {
    if (desc.length <= length) return desc;
    return desc.slice(0, length) + "...";
  };

  const opacity = assistantAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const translateY = assistantAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [50, 0],
  });

  return (
    <View style={styles.container}>
      {/* Header Section */}
      <View style={styles.headerContainer}>
        <Text style={styles.headerTitle}>Explore Services</Text>
        <TouchableOpacity
          style={styles.filterButton}
          onPress={handleFilterPillPress}
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

      {/* Search Bar */}
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

      {/* Gigs List */}
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Featured Gigs */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Featured</Text>
          {loading && (
            <ActivityIndicator
              size="small"
              color="#BB86FC"
              style={{ marginRight: 10 }}
            />
          )}
        </View>
        {loading ? (
          <ActivityIndicator
            size="large"
            color="#BB86FC"
            style={{ marginTop: 20 }}
          />
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.featuredScroll}
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
        )}

        {/* All Gigs */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>All Services</Text>
          <TouchableOpacity onPress={toggleSearchBar}>
            <Ionicons
              name={showSearchBar ? "close" : "search-outline"}
              size={24}
              color="#BB86FC"
            />
          </TouchableOpacity>
        </View>
        {loading ? (
          <ActivityIndicator
            size="large"
            color="#BB86FC"
            style={{ marginTop: 20 }}
          />
        ) : (
          <>
            {filteredGigs.length > 0 ? (
              filteredGigs.map((gig) => {
                // Safely handle the gig price
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
                      <Ionicons
                        name="chevron-forward"
                        size={20}
                        color="#BB86FC"
                      />
                    </View>
                  </TouchableOpacity>
                );
              })
            ) : (
              <Text style={styles.noResultsText}>
                No services found for "{currentFilter}"
              </Text>
            )}
          </>
        )}
      </ScrollView>

      <BottomNavBar />

      {/* Floating "Find a Gig" Button */}
      <TouchableOpacity
        activeOpacity={0.9}
        style={styles.fab}
        onPress={toggleAssistant}
      >
        <LinearGradient
          colors={["rgb(168, 237, 234)", "rgb(254, 214, 227)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.fabGradient}
        >
          <Text style={styles.fabText}>Find a Job</Text>
        </LinearGradient>
      </TouchableOpacity>

      {/* AI Assistant Modal */}
      <Modal visible={showAssistant} transparent animationType="fade">
        <KeyboardAvoidingView
          style={styles.modalContainer}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <Animated.View style={[styles.assistantModalOverlay, { opacity }]} />
          <Animated.View
            {...panResponder.panHandlers}
            style={[
              styles.assistantModal,
              {
                transform: [{ translateY: translateY }],
                opacity,
              },
            ]}
          >
            <View style={styles.assistantHeader}>
              <Text style={styles.assistantHeaderText}>AI Assistant</Text>
              <TouchableOpacity onPress={() => toggleAssistant()}>
                <Ionicons name="close" size={24} color="#BB86FC" />
              </TouchableOpacity>
            </View>

            <View style={styles.chatContainer}>
              <ScrollView
                contentContainerStyle={styles.chatContent}
                showsVerticalScrollIndicator={false}
              >
                {!hasUserMessaged && (
                  <View style={styles.initialSuggestionsContainer}>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.initialSuggestionsScroll}
                    >
                      {suggestionPhrases.map((phrase) => (
                        <TouchableOpacity
                          key={phrase}
                          style={styles.initialSuggestionCard}
                          onPress={() => handleSuggestionPress(phrase)}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.initialSuggestionText}>
                            {phrase}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}

                {messages.map((msg) => (
                  <View
                    key={msg.id}
                    style={[
                      styles.messageBubble,
                      msg.role === "assistant"
                        ? styles.assistantBubble
                        : styles.userBubble,
                    ]}
                  >
                    {msg.type === "gig" && msg.gig ? (
                      <TouchableOpacity
                        style={styles.gigCard}
                        onPress={() => {
                          toggleAssistant(() => {
                            navigation.navigate("JobDetail", {
                              jobId: msg.gig.id,
                            });
                          });
                        }}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.gigTitle}>{msg.gig.title}</Text>
                        <View style={styles.gigCategoryRow}>
                          <Ionicons
                            name={
                              categoryIcons[msg.gig.category] || "grid-outline"
                            }
                            size={16}
                            color="#BB86FC"
                            style={{ marginRight: 6 }}
                          />
                          <Text style={styles.gigCategory}>
                            {msg.gig.category}
                          </Text>
                        </View>
                        <Text style={styles.gigDescription}>
                          {truncateDescription(msg.gig.description, 60)}
                        </Text>
                        <Text style={styles.gigPrice}>
                          ${getDisplayedPrice(msg.gig.price)}
                        </Text>
                      </TouchableOpacity>
                    ) : (
                      <Text
                        style={[
                          styles.messageText,
                          msg.role === "assistant"
                            ? styles.assistantText
                            : styles.userText,
                        ]}
                      >
                        {msg.text}
                      </Text>
                    )}
                  </View>
                ))}
              </ScrollView>

              <View style={styles.inputArea}>
                <TextInput
                  style={styles.chatInput}
                  placeholder="How can I help you?"
                  placeholderTextColor="#888"
                  value={userInput}
                  onChangeText={setUserInput}
                />
                <TouchableOpacity
                  style={styles.sendButton}
                  onPress={sendMessage}
                >
                  <Ionicons name="send" size={20} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

export default JobsScreen;

const styles = StyleSheet.create({
  // Overall Screen Container
  container: {
    flex: 1,
    backgroundColor: "#000000", // Deeper black
    position: "relative",
  },
  // Header
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
  // Search Bar
  searchBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0B0B0B",
    marginHorizontal: 16,
    marginTop: 6,
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
  // Scroll View Container
  scrollContainer: {
    paddingBottom: 90,
  },
  // Section Headers
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  // Featured Gigs
  featuredScroll: {
    marginTop: 10,
    paddingLeft: 16,
  },
  featuredCard: {
    width: width * 0.55,
    borderRadius: 12,
    padding: 16,
    marginRight: 12,
    justifyContent: "space-between",
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  featuredTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 8,
  },
  featuredCategoryRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  featuredCategory: {
    fontSize: 13,
    color: "#FFFFFF",
  },
  // All Gigs
  gigCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0B0B0B",
    marginHorizontal: 12,
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
    fontSize: 14,
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
    fontSize: 12,
    color: "#BB86FC",
  },
  gigDescription: {
    fontSize: 12,
    color: "#B3B3B3",
    marginBottom: 4,
  },
  gigPrice: {
    fontSize: 12,
    fontWeight: "500",
    color: "#BB86FC",
  },
  noResultsText: {
    fontSize: 14,
    color: "#B3B3B3",
    textAlign: "center",
    marginTop: 40,
  },
  // Floating Action Button
  fab: {
    position: "absolute",
    bottom: 110,
    right: 20,
    width: 120,
    height: 48,
    borderRadius: 24,
    overflow: "hidden",
    elevation: 5,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  fabGradient: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 10,
  },
  fabText: {
    color: "#000",
    fontSize: 15,
    fontWeight: "600",
  },
  // AI Assistant Modal
  modalContainer: {
    flex: 1,
    justifyContent: "flex-end",
  },
  assistantModalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000000AA",
  },
  assistantModal: {
    backgroundColor: "#0B0B0B",
    height: "85%",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: "hidden",
  },
  assistantHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: Platform.OS === "ios" ? 48 : 16,
    paddingBottom: 12,
    paddingHorizontal: 16,
    backgroundColor: "#BB86FC",
  },
  assistantHeaderText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  chatContainer: {
    flex: 1,
    padding: 12,
  },
  chatContent: {
    paddingBottom: 80,
  },
  initialSuggestionsContainer: {
    marginBottom: 16,
    alignItems: "center",
  },
  initialSuggestionsScroll: {
    paddingHorizontal: 10,
  },
  initialSuggestionCard: {
    backgroundColor: "#BB86FC",
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginRight: 10,
  },
  initialSuggestionText: {
    color: "#FFFFFF",
    fontSize: 13,
  },
  messageBubble: {
    padding: 10,
    borderRadius: 16,
    marginBottom: 10,
    maxWidth: "80%",
  },
  assistantBubble: {
    backgroundColor: "#1A1A1A",
    alignSelf: "flex-start",
  },
  userBubble: {
    backgroundColor: "#BB86FC",
    alignSelf: "flex-end",
  },
  messageText: {
    fontSize: 14,
  },
  assistantText: {
    color: "#FFFFFF",
  },
  userText: {
    color: "#FFFFFF",
  },
  inputArea: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1A1A1A",
    borderRadius: 25,
    paddingHorizontal: 12,
    paddingVertical: 6,
    position: "absolute",
    bottom: 12,
    left: 12,
    right: 12,
  },
  chatInput: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 14,
  },
  sendButton: {
    backgroundColor: "#BB86FC",
    borderRadius: 20,
    padding: 8,
    marginLeft: 8,
  },
  // Filter Modal
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
  // Gig Card Styles within Chat
  gigCard: {
    backgroundColor: "#1A1A1A",
    borderRadius: 12,
    padding: 12,
    marginVertical: 5,
    width: width * 0.7,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  gigTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 5,
  },
  gigCategoryRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 5,
  },
  gigCategory: {
    fontSize: 14,
    color: "#BB86FC",
  },
  gigDescription: {
    fontSize: 14,
    color: "#B3B3B3",
    marginBottom: 5,
  },
  gigPrice: {
    fontSize: 14,
    fontWeight: "500",
    color: "#BB86FC",
  },
});
