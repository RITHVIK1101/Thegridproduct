import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Animated, TouchableOpacity, PanResponder } from "react-native";
import * as Notifications from "expo-notifications";
import { navigationRef } from "./App"; // Ensure this path is correct

const InAppNotification: React.FC = () => {
  const [notification, setNotification] = useState<Notifications.Notification | null>(null);
  const [visible, setVisible] = useState(false);
  const slideAnim = useRef(new Animated.Value(-100)).current; // Start slightly above
  const panY = useRef(new Animated.Value(0)).current; // For vertical swipe

  // PanResponder for swipe-to-dismiss upward
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 5,
      onPanResponderMove: (_, gestureState) => {
        panY.setValue(gestureState.dy);
      },
      onPanResponderRelease: (_, gestureState) => {
        // If swiped upward enough (dy is negative)
        if (gestureState.dy < -50) {
          Animated.timing(panY, {
            toValue: -200,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            panY.setValue(0);
            setVisible(false);
            setNotification(null);
          });
        } else {
          Animated.spring(panY, { toValue: 0, useNativeDriver: true }).start();
        }
      },
    })
  ).current;

  useEffect(() => {
    const subscription = Notifications.addNotificationReceivedListener((notif) => {
      // Check the current route; if on "Messaging", skip displaying the notification.
      const currentRoute = navigationRef?.current?.getCurrentRoute()?.name;
      if (currentRoute === "Messaging") {
        return;
      }
      setNotification(notif);
      setVisible(true);
      // Slide the notification into view
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start();

      // Auto-hide after ~4.2 seconds
      setTimeout(() => {
        Animated.timing(slideAnim, {
          toValue: -100,
          duration: 250,
          useNativeDriver: true,
        }).start(() => {
          setVisible(false);
          setNotification(null);
        });
      }, 3000);
    });

    return () => {
      subscription.remove();
    };
  }, [slideAnim]);

  if (!visible || !notification) return null;

  const { title, body } = notification.request.content;

  return (
    <Animated.View
      style={[
        styles.container,
        { transform: [{ translateY: Animated.add(slideAnim, panY) }] },
      ]}
      {...panResponder.panHandlers}
    >
      <TouchableOpacity style={styles.touchArea}>
        <Text style={styles.title}>{title}</Text>
        {body ? <Text style={styles.body}>{body}</Text> : null}
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 50, // Slightly lower for better visibility
    left: 20,
    right: 20,
    backgroundColor: "#E1BEE7", // Soft light purple
    borderRadius: 16, // Rounded but smaller
    paddingVertical: 8, // Slightly smaller padding
    paddingHorizontal: 14,
    zIndex: 1000,
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  touchArea: {
    justifyContent: "flex-start",
  },
  title: {
    fontSize: 14, // Slightly smaller text
    fontWeight: "600",
    color: "#4A148C",
    textAlign: "left",
  },
  body: {
    fontSize: 12, // Slightly smaller text
    color: "#4A148C",
    marginTop: 2,
    textAlign: "left",
  },
});

export default InAppNotification;
