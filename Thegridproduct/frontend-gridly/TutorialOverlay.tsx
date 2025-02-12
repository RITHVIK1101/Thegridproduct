import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Platform } from "react-native";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

type TutorialStep = {
  id: number;
  text: string;
  containerStyle: object;
  pointerPosition?: "top" | "bottom";
};

const tutorialSteps: TutorialStep[] = [
  {
    id: 1,
    text: "Welcome to Gridly!\nSwipe up for more products. Double tap to like. Tap for details.",
    containerStyle: { top: SCREEN_HEIGHT / 2 - 100, left: 100, width: 180 },
    pointerPosition: "bottom",
  },
  {
    id: 2,
    text: "Tap here to upload a product or gig.",
    containerStyle: { bottom: 105, right: 100, width: 160 },
    pointerPosition: "top",
  },
  {
    id: 3,
    text: "Check your posts and activity here.",
    containerStyle: { bottom: 105, left: 220, width: 160 },
    pointerPosition: "top",
  },
  {
    id: 4,
    text: "Search and explore posted gigs here!",
    containerStyle: { bottom: 105, left: SCREEN_WIDTH / 2 - 100, width: 160 },
    pointerPosition: "top",
  },
  {
    id: 5,
    text: "Your added items show here.\nYou can reach out to sellers in the cart.",
    // Position near the top right—adjust these values as needed.
    containerStyle: { top: Platform.OS === "ios" ? 116 : 40, right: 10, width: 200 },
    pointerPosition: "bottom",
  },
  {
    id: 6,
    text: "You're all set! Enjoy Gridly.",
    containerStyle: { top: SCREEN_HEIGHT / 2 - 100, left: 100, right: 20 },
    pointerPosition: "bottom",
  },
];

interface TutorialOverlayProps {
  onFinish: () => void;
}

const TutorialOverlay: React.FC<TutorialOverlayProps> = ({ onFinish }) => {
  const [currentStep, setCurrentStep] = useState(0);

  const handleNext = () => {
    if (currentStep < tutorialSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onFinish();
    }
  };

  const step = tutorialSteps[currentStep];

  // Determine pointer style based on pointerPosition.
  // For step 5, we override to shift the pointer toward the right side.
  let pointerStyle;
  if (step.id === 5) {
    // Since this is a "bottom" pointer, we want it to point from near the right side.
    pointerStyle = {
      top: -18,
      left: "80%", // Shifted more to the right than the default "50%"
      transform: [{ translateX: -12 }, { rotate: "180deg" }],
    };
  } else if (step.pointerPosition === "top") {
    pointerStyle = {
      bottom: -18,
      left: "50%",
      transform: [{ translateX: -12 }],
    };
  } else {
    pointerStyle = {
      top: -18,
      left: "50%",
      transform: [{ translateX: -12 }, { rotate: "180deg" }],
    };
  }

  return (
    <View style={styles.overlay}>
      <View style={[styles.tooltipContainer, step.containerStyle]}>
        <Text style={styles.tooltipText}>{step.text}</Text>
        <TouchableOpacity
          style={[
            styles.nextButton,
            currentStep === tutorialSteps.length - 1 && { backgroundColor: "purple" },
          ]}
          onPress={handleNext}
        >
          <Text style={styles.nextButtonText}>
            {currentStep === tutorialSteps.length - 1 ? "Done" : "Next"}
          </Text>
        </TouchableOpacity>
        <View style={[styles.pointer, pointerStyle]} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    zIndex: 1000,
  },
  tooltipContainer: {
    position: "absolute",
    paddingVertical: 12,
    paddingHorizontal: 16,
    maxWidth: 180,
    backgroundColor: "#000",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#555",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  tooltipText: {
    fontSize: 14,
    color: "#fff",
    textAlign: "center",
    marginBottom: 10,
  },
  nextButton: {
    backgroundColor: "#555",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 15,
    alignSelf: "center",
  },
  nextButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  pointer: {
    position: "absolute",
    width: 0,
    height: 0,
    borderLeftWidth: 12,
    borderRightWidth: 12,
    borderTopWidth: 18,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: "#000",
  },
});

export default TutorialOverlay;
