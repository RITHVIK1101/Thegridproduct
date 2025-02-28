// AnimatedBackButton.tsx
import React, { useRef } from "react";
import { Pressable, Animated, StyleSheet } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";

type AnimatedBackButtonProps = {
  onPress: () => void;
};

const AnimatedBackButton: React.FC<AnimatedBackButtonProps> = ({ onPress }) => {
  const bubbleAnim = useRef(new Animated.Value(0)).current;

  const startBubbleAnimation = () => {
    Animated.sequence([
      Animated.timing(bubbleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(bubbleAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  };

  return (
    <Pressable
      onPressIn={() => {
        startBubbleAnimation();
        onPress();
      }}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      style={styles.backButton}
      accessibilityLabel="Go Back"
    >
      <Animated.View
        style={[
          styles.bubble,
          {
            opacity: bubbleAnim,
            transform: [
              {
                scale: bubbleAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.5, 1.5],
                }),
              },
            ],
          },
        ]}
      />
      <Ionicons name="arrow-back" size={24} color="#BB86FC" />
    </Pressable>
  );
};

const styles = StyleSheet.create({
    backButton: {
      position: "relative",
      alignItems: "center",
      justifyContent: "center",
    },
    bubble: {
      position: "absolute",
      width: 30,            // smaller width
      height: 30,           // smaller height
      borderRadius: 15,     // fully circular
      backgroundColor: "rgba(128,128,128,0.5)", // greyish color at 50% opacity
      zIndex: -1,           // places the bubble behind the icon
    },
  });
  
  

export default AnimatedBackButton;
