// SplashScreen.tsx

import React, { useEffect, useRef } from "react";
import {
  View,
  Animated,
  StyleSheet,
  Dimensions,
  Platform,
  Image,
} from "react-native";

interface SplashScreenProps {
  onAnimationEnd: () => void;
}

const ACCENT_COLOR = "#A78BFA"; // Purple accent (same as in LoginScreen)
const BG_COLOR = "#0D0D0D"; // Dark background (matches LoginScreen)

const { width, height } = Dimensions.get("window");
const SPEED_MULTIPLIER = 0.65; // Slightly faster animation

const SplashScreen: React.FC<SplashScreenProps> = ({ onAnimationEnd }) => {
  // Animated values for the logo
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;
  const logoPulse = useRef(new Animated.Value(1)).current; // For pulsing effect

  // Animated values for the lines
  const linesOpacity = useRef(new Animated.Value(0)).current;
  const linesTranslateY = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    // Logo animations: fade in and scale up with pulsing
    const logoAnimation = Animated.parallel([
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 800 * SPEED_MULTIPLIER,
        useNativeDriver: true,
      }),
      Animated.spring(logoScale, {
        toValue: 1,
        friction: 4,
        useNativeDriver: true,
      }),
    ]);

    // Lines animations: fade in and slide up
    const linesAnimation = Animated.parallel([
      Animated.timing(linesOpacity, {
        toValue: 1,
        duration: 800 * SPEED_MULTIPLIER,
        useNativeDriver: true,
      }),
      Animated.timing(linesTranslateY, {
        toValue: 0,
        duration: 800 * SPEED_MULTIPLIER,
        useNativeDriver: true,
      }),
    ]);

    // Pulsing animation for the logo
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(logoPulse, {
          toValue: 1.05,
          duration: 1000 * SPEED_MULTIPLIER,
          useNativeDriver: true,
        }),
        Animated.timing(logoPulse, {
          toValue: 1,
          duration: 1000 * SPEED_MULTIPLIER,
          useNativeDriver: true,
        }),
      ])
    );

    // Start the pulse animation
    pulseAnimation.start();

    // Sequence of animations
    Animated.sequence([
      logoAnimation,
      linesAnimation,
      Animated.delay(1200 * SPEED_MULTIPLIER), // Hold the splash screen briefly
      // Fade out animations
      Animated.parallel([
        Animated.timing(logoOpacity, {
          toValue: 0,
          duration: 500 * SPEED_MULTIPLIER,
          useNativeDriver: true,
        }),
        Animated.timing(linesOpacity, {
          toValue: 0,
          duration: 500 * SPEED_MULTIPLIER,
          useNativeDriver: true,
        }),
        Animated.timing(logoScale, {
          toValue: 1.2,
          duration: 500 * SPEED_MULTIPLIER,
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      // Stop the pulse animation when done
      pulseAnimation.stop();
      // Notify parent that the animation has finished
      onAnimationEnd();
    });
  }, [
    logoOpacity,
    logoScale,
    logoPulse,
    linesOpacity,
    linesTranslateY,
    onAnimationEnd,
  ]);

  return (
    <View style={styles.container}>
      {/* Logo Section */}
      <Animated.View
        style={[
          styles.logoContainer,
          {
            opacity: logoOpacity,
            transform: [{ scale: logoScale }, { scale: logoPulse }],
          },
        ]}
      >
        <Image
          source={require("./assets/logonobg.png")}
          style={styles.logoImage}
          resizeMode="contain"
        />
      </Animated.View>

      {/* Animated Lines */}
      <Animated.View
        style={[
          styles.line,
          {
            opacity: linesOpacity,
            transform: [{ translateY: linesTranslateY }],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.line,
          styles.lineSecond,
          {
            opacity: linesOpacity,
            transform: [{ translateY: linesTranslateY }],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.line,
          styles.lineThird,
          {
            opacity: linesOpacity,
            transform: [{ translateY: linesTranslateY }],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.line,
          styles.lineFourth,
          {
            opacity: linesOpacity,
            transform: [{ translateY: linesTranslateY }],
          },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG_COLOR,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  logoContainer: {
    marginBottom: 40,
  },
  // Increased image size for a larger display
  logoImage: {
    width: 100,
    height: 100,
  },
  line: {
    position: "absolute",
    width: width * 0.6,
    height: 3,
    backgroundColor: ACCENT_COLOR,
    top: height / 2 + 50, // Positioned below the logo
    borderRadius: 2,
  },
  lineSecond: {
    top: height / 2 + 60,
    width: width * 0.5,
  },
  lineThird: {
    top: height / 2 + 70,
    width: width * 0.4,
  },
  lineFourth: {
    top: height / 2 + 80,
    width: width * 0.3,
  },
});

export default SplashScreen;
