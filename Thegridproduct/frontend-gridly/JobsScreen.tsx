// JobsScreen.tsx

import React, { useState, useRef } from 'react';
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
  Dimensions
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import BottomNavBar from "./components/BottomNavbar";

const { width } = Dimensions.get('window');

const mockServices = [
  {
    id: '1',
    title: 'Math Tutoring',
    description: 'Expert help with calculus, algebra, and geometry.',
    category: 'Tutoring',
    price: '$20/hour'
  },
  {
    id: '2',
    title: 'Graphic Design',
    description: 'Custom logos, banners, and branding materials.',
    category: 'Design',
    price: '$50/project'
  },
  {
    id: '3',
    title: 'Essay Editing',
    description: 'Proofreading and editing for academic essays.',
    category: 'Writing',
    price: '$15/hour'
  },
  {
    id: '4',
    title: 'Grocery Delivery',
    description: 'Fast delivery right to your doorstep.',
    category: 'Delivery',
    price: 'Varies'
  },
];

interface Message {
  id: string;
  text: string;
  role: 'user' | 'assistant';
}

const suggestionPhrases = [
  "I have a budget of $50",
  "I'm looking for a designer",
  "Deadline: Next week",
  "I need help with math homework",
  "I'm looking for a writer"
];

const categoryIcons: { [key: string]: string } = {
  Tutoring: "school-outline",
  Design: "color-palette-outline",
  Writing: "create-outline",
  Delivery: "bicycle-outline"
};

const JobsScreen: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchBar, setShowSearchBar] = useState(false);
  const [showAssistant, setShowAssistant] = useState(false);
  const [hasUserMessaged, setHasUserMessaged] = useState(false);
  const assistantAnim = useRef(new Animated.Value(0)).current;

  const [messages, setMessages] = useState<Message[]>([
    { id: 'init1', text: 'Hey there! 👋 What kind of service are you looking for today?', role: 'assistant' },
  ]);
  const [userInput, setUserInput] = useState('');

  const featuredServices = mockServices.slice(0, 2);
  const allServices = mockServices;

  const filteredServices = allServices.filter(service =>
    service.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    service.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
    service.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleAssistant = () => {
    if (showAssistant) {
      Animated.timing(assistantAnim, {
        toValue: 0,
        duration: 300,
        easing: Easing.ease,
        useNativeDriver: true
      }).start(() => {
        setShowAssistant(false);
      });
    } else {
      setShowAssistant(true);
      Animated.timing(assistantAnim, {
        toValue: 1,
        duration: 300,
        easing: Easing.ease,
        useNativeDriver: true
      }).start();
    }
  };

  const sendMessage = () => {
    if (userInput.trim() === '') return;
    const newUserMessage: Message = {
      id: Math.random().toString(),
      text: userInput,
      role: 'user'
    };
    setMessages(prev => [...prev, newUserMessage]);
    setUserInput('');

    // Once user sends a message, suggestions vanish
    if (!hasUserMessaged) {
      setHasUserMessaged(true);
    }

    // Mock assistant reply logic
    setTimeout(() => {
      const assistantReplies = [
        "Awesome! Could you tell me more about the category or field you're interested in?",
        "Great. Any specific deadline or timeframe you're working with?",
        "Got it. What's your budget range?",
        "Perfect! I'll find some top-rated freelancers that match your needs."
      ];

      const userMessagesCount = messages.filter(m => m.role === 'user').length + 1;
      let responseText = "Let me think...";
      if (userMessagesCount <= assistantReplies.length) {
        responseText = assistantReplies[userMessagesCount - 1];
      } else {
        responseText = "Alright! Let me find some matches for you. One sec...";
      }

      const newAssistantMessage: Message = {
        id: Math.random().toString(),
        text: responseText,
        role: 'assistant'
      };
      setMessages(prev => [...prev, newAssistantMessage]);
    }, 1000);
  };

  const toggleSearchBar = () => {
    setShowSearchBar(!showSearchBar);
  };

  const handleSuggestionPress = (suggestion: string) => {
    setUserInput(suggestion);
  };

  const opacity = assistantAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1]
  });

  const translateY = assistantAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [50, 0]
  });

  return (
    <View style={styles.container}>
      {/* Hero Section (Purple Gradient) */}
      <LinearGradient
        colors={['#BB86FC', '#3700B3']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroContainer}
      >
        <Text style={styles.heroTitle}>Find Your Perfect Service</Text>
        <TouchableOpacity style={styles.heroSearchIcon} onPress={toggleSearchBar}>
          <Ionicons name={showSearchBar ? "close" : "search"} size={24} color="#fff" />
        </TouchableOpacity>
      </LinearGradient>

      {/* Search Bar Below Hero */}
      {showSearchBar && (
        <View style={styles.searchBarContainer}>
          <Ionicons name="search-outline" size={20} color="#BB86FC" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search services..."
            placeholderTextColor="#888"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      )}

      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* Featured Services */}
        <Text style={styles.sectionTitle}>Featured</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.featuredScroll}
        >
          {featuredServices.map((service) => (
            <LinearGradient
              key={service.id}
              colors={['#1E1E1E', '#2A2A2A']}
              start={{ x: 0.1, y: 0.1 }}
              end={{ x: 0.9, y: 0.9 }}
              style={styles.featuredCard}
            >
              <View style={styles.featuredTextContainer}>
                <Text style={styles.featuredTitle}>{service.title}</Text>
                <View style={styles.featuredCategoryRow}>
                  <Ionicons 
                    name={categoryIcons[service.category] || 'help-outline'} 
                    size={16} 
                    color="#BB86FC" 
                    style={{ marginRight: 5 }} 
                  />
                  <Text style={styles.featuredCategory}>{service.category}</Text>
                </View>
              </View>
            </LinearGradient>
          ))}
        </ScrollView>

        {/* All Services (Simple List with lines, no images) */}
        <Text style={styles.sectionTitle}>All Services</Text>
        {filteredServices.map((service, index) => (
          <View key={service.id}>
            <View style={styles.serviceRow}>
              <Ionicons 
                name={categoryIcons[service.category] || 'help-outline'} 
                size={24} 
                color="#BB86FC" 
                style={{ marginRight: 15 }} 
              />
              <View style={styles.serviceInfo}>
                <Text style={styles.serviceTitle}>{service.title}</Text>
                <Text style={styles.serviceCategory}>{service.category}</Text>
                <Text style={styles.serviceDescription}>{service.description}</Text>
                <Text style={styles.servicePrice}>{service.price}</Text>
              </View>
            </View>
            {index < filteredServices.length - 1 && <View style={styles.divider} />}
          </View>
        ))}

        {filteredServices.length === 0 && (
          <Text style={styles.noResultsText}>
            No services found for "{searchQuery}"
          </Text>
        )}
      </ScrollView>

      <BottomNavBar />

      {/* Floating "Ask AI" Button */}
      <TouchableOpacity activeOpacity={0.9} style={styles.fab} onPress={toggleAssistant}>
        <LinearGradient
          colors={['rgb(168, 237, 234)', 'rgb(254, 214, 227)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.fabGradient}
        >
          <Ionicons name="chatbubble-ellipses" size={24} color="#000" />
        </LinearGradient>
      </TouchableOpacity>

      {/* Full-Screen AI Assistant Modal */}
      <Modal
        visible={showAssistant}
        transparent
        animationType="none"
      >
        <KeyboardAvoidingView
          style={styles.modalContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Animated.View style={[styles.assistantModalOverlay, { opacity }]} />
          <Animated.View style={[styles.assistantModal, { transform: [{ translateY }], opacity }]}>
            {/* Updated Gradient Header for Assistant */}
            <LinearGradient
              colors={['#BB86FC', '#03DAC6']}
              start={{ x: 0.2, y: 0 }}
              end={{ x: 0.8, y: 1 }}
              style={styles.assistantHeader}
            >
              <View style={styles.assistantHeaderLeft}>
                <Ionicons name="robot-outline" size={24} color="#fff" style={{ marginRight: 10 }} />
                <Text style={styles.assistantHeaderText}>AI Assistant</Text>
              </View>
              <TouchableOpacity onPress={toggleAssistant}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </LinearGradient>

            <LinearGradient
              colors={['#000000', '#1E1E1E']}
              style={styles.chatContainer}
            >
              <ScrollView
                contentContainerStyle={styles.chatContent}
                showsVerticalScrollIndicator={false}
              >
                {/* Suggestions in the center if user hasn't messaged yet */}
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
                          activeOpacity={0.7}
                        >
                          <Text style={styles.initialSuggestionText}>{phrase}</Text>
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
                      msg.role === 'assistant' ? styles.assistantBubble : styles.userBubble
                    ]}
                  >
                    <Text style={[
                      styles.messageText,
                      msg.role === 'assistant' ? styles.assistantText : styles.userText
                    ]}>
                      {msg.text}
                    </Text>
                  </View>
                ))}
              </ScrollView>

              {/* Input Area */}
              <View style={styles.inputArea}>
                <TextInput
                  style={styles.chatInput}
                  placeholder="Tell me what you need..."
                  placeholderTextColor="#666"
                  value={userInput}
                  onChangeText={setUserInput}
                />
                <TouchableOpacity style={styles.sendButton} onPress={sendMessage}>
                  <Ionicons name="paper-plane" size={20} color="#fff" />
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>

    </View>
  );
};

export default JobsScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    position: 'relative',
  },
  heroContainer: {
    width: '100%',
    paddingTop: 50,
    paddingBottom: 30,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  heroSearchIcon: {
    position: 'absolute',
    top: 55,
    right: 20,
  },

  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    marginHorizontal: 20,
    borderRadius: 10,
    paddingHorizontal: 15,
    marginTop: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#BB86FC',
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    paddingVertical: 8,
  },

  scrollContainer: {
    paddingBottom: 100,
  },
  sectionTitle: {
    color: '#BB86FC',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 20,
    marginBottom: 10,
    marginTop: 20,
  },
  featuredScroll: {
    marginLeft: 20,
    marginBottom: 20,
  },
  featuredCard: {
    marginRight: 15,
    width: width * 0.5,
    borderRadius: 12,
    padding: 15,
    justifyContent: 'center',
  },
  featuredTextContainer: {
    justifyContent: 'center',
  },
  featuredTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 5,
  },
  featuredCategoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  featuredCategory: {
    color: '#BB86FC',
    fontSize: 14,
  },

  // All Services List (No images, just icons and text)
  serviceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 15,
    paddingHorizontal: 20,
  },
  serviceInfo: {
    flex: 1,
  },
  serviceTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  serviceCategory: {
    fontSize: 14,
    color: '#BB86FC',
    marginBottom: 2,
  },
  serviceDescription: {
    fontSize: 13,
    color: '#ccc',
    marginBottom: 2,
  },
  servicePrice: {
    fontSize: 13,
    color: '#aaa',
  },
  divider: {
    height: 1,
    marginHorizontal: 20,
    backgroundColor: '#333',
  },
  noResultsText: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    marginTop: 50,
  },

  // Floating FAB
  fab: {
    position: 'absolute',
    bottom: 120,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  fabGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Assistant Modal Styles
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  assistantModalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000AA',
  },
  assistantModal: {
    backgroundColor: '#121212',
    height: '90%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  assistantHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  assistantHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  assistantHeaderText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
  },

  chatContainer: {
    flex: 1,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 15,
  },
  chatContent: {
    paddingBottom: 140, // space for input
    alignItems: 'center', // Center content including suggestions if present
  },

  initialSuggestionsContainer: {
    marginTop: 50,
    marginBottom: 30,
  },
  initialSuggestionsScroll: {
    paddingHorizontal: 10,
  },
  initialSuggestionCard: {
    backgroundColor: '#1E1E1E',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BB86FC',
    paddingVertical: 10,
    paddingHorizontal: 15,
    marginRight: 10,
  },
  initialSuggestionText: {
    color: '#BB86FC',
    fontSize: 14,
  },

  messageBubble: {
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
    maxWidth: '80%',
  },
  assistantBubble: {
    backgroundColor: '#2A2A2A',
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#BB86FC',
    shadowColor: '#BB86FC',
    shadowOpacity: 0.4,
    shadowRadius: 4,
  },
  userBubble: {
    backgroundColor: '#fff',
    alignSelf: 'flex-end',
    borderWidth: 1,
    borderColor: '#03DAC6',
    shadowColor: '#03DAC6',
    shadowOpacity: 0.4,
    shadowRadius: 4,
  },
  messageText: {
    fontSize: 15,
  },
  assistantText: {
    color: '#fff',
  },
  userText: {
    color: '#000',
  },

  inputArea: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    position: 'absolute',
    bottom: 20,
    left: 15,
    right: 15,
    borderWidth: 1,
    borderColor: '#BB86FC',
  },
  chatInput: {
    flex: 1,
    color: '#fff',
    fontSize: 15,
    padding: 10,
  },
  sendButton: {
    backgroundColor: '#03DAC6',
    borderRadius: 20,
    padding: 8,
    marginLeft: 8,
  },
});
