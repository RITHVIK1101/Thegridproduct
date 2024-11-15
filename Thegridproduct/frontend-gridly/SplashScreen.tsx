import React, { useEffect, useRef } from "react";
import { View, Text, Animated, StyleSheet } from "react-native";

interface SplashScreenProps {
  onAnimationEnd: () => void;
}

const SPLASH_TEXT_COLOR = "#BB86FC"; // Define the purple color for consistency

const SplashScreen: React.FC<SplashScreenProps> = ({ onAnimationEnd }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.8)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      // Fade in and scale up the main title
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 800, // Slightly longer fade-in
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          friction: 4,
          useNativeDriver: true,
        }),
      ]),
      // Fade in the subtitle
      Animated.timing(subtitleOpacity, {
        toValue: 1,
        duration: 800, // Fade-in for subtitle
        useNativeDriver: true,
      }),
      Animated.delay(1200), // Slightly longer hold time
      // Fade out and scale up slightly
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 500, // Slightly longer fade-out
          useNativeDriver: true,
        }),
        Animated.timing(subtitleOpacity, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1.2, // Slight scale up during fade-out
          duration: 500,
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      onAnimationEnd();
    });
  }, [opacity, scale, subtitleOpacity, onAnimationEnd]);

  return (
    <View style={styles.container}>
      <Animated.Text
        style={[
          styles.title,
          {
            opacity: opacity,
            transform: [{ scale: scale }],
          },
        ]}
      >
        The Gridly
      </Animated.Text>
      <Animated.Text
        style={[
          styles.subtitle,
          {
            opacity: subtitleOpacity,
          },
        ]}
      >
        The Largest Campus Marketplace for Everything
      </Animated.Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212", // Dark background to match the app's theme
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 48,
    fontWeight: "bold",
    color: "#BB86FC", // Changed to vibrant purple
    letterSpacing: 2,
    marginBottom: 10, // Space between title and subtitle
  },
  subtitle: {
    fontSize: 18,
    color: "#BB86FC", // Changed to vibrant purple
    textAlign: "center",
    paddingHorizontal: 20, // Optional padding
  },
});

export default SplashScreen;