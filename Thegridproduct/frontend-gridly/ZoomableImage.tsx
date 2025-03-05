import React from "react";
import { StyleSheet, Dimensions } from "react-native";
import {
  GestureHandlerRootView,
  GestureDetector,
  Gesture,
} from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  Extrapolate,
} from "react-native-reanimated";

const { width, height } = Dimensions.get("window");

const ZoomableImage = ({ imageUri }: { imageUri: string }) => {
  const scale = useSharedValue(1);

  // Define a pinch gesture to update the scale
  const pinchGesture = Gesture.Pinch()
    .onUpdate((event) => {
      // Clamp the scale value to a safe range (0.7 to 3)
      const newScale = Math.max(0.7, Math.min(event.scale, 3));
      scale.value = newScale;
    })
    .onEnd(() => {
      // Smoothly reset zoom back to 1 when fingers are lifted
      scale.value = withTiming(1, { duration: 200 });
    });

  // Animated style for the cover image.
  // When scale is between 0.7 and 1, fade from 0 to 1.
  const animatedStyleCover = useAnimatedStyle(() => {
    const opacity = interpolate(
      scale.value,
      [0.7, 1, 3],
      [0, 1, 1],
      Extrapolate.CLAMP
    );
    return { opacity, transform: [{ scale: scale.value }] };
  });

  // Animated style for the contain image.
  // When scale is between 0.7 and 1, fade from 1 to 0.
  const animatedStyleContain = useAnimatedStyle(() => {
    const opacity = interpolate(
      scale.value,
      [0.7, 1, 3],
      [1, 0, 0],
      Extrapolate.CLAMP
    );
    return { opacity, transform: [{ scale: scale.value }] };
  });

  return (
    <GestureHandlerRootView style={styles.container}>
      <GestureDetector gesture={pinchGesture}>
        <>
          {/* Cover image: shown when scale is 1 or above */}
          <Animated.Image
            source={{ uri: imageUri }}
            style={[styles.image, animatedStyleCover]}
            resizeMode="cover"
          />
          {/* Contain image: shown when zooming out (scale < 1) */}
          <Animated.Image
            source={{ uri: imageUri }}
            style={[styles.image, animatedStyleContain]}
            resizeMode="contain"
          />
        </>
      </GestureDetector>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: {
    width: width,
    height: height,
    justifyContent: "center",
    alignItems: "center",
  },
  image: {
    ...StyleSheet.absoluteFillObject, // Makes each image fill the container
  },
});

export default ZoomableImage;
