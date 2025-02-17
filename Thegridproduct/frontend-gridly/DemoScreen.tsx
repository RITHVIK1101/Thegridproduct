// DemoScreen.tsx
import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  memo,
  FC,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Animated,
  Easing,
  ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "./navigationTypes";
import Ionicons from "react-native-vector-icons/Ionicons";

const { width, height } = Dimensions.get("window");

/**
 * Data model for each slide.
 */
interface Slide {
  title: string;
  description: string;
  image: string;
}

const slides: Slide[] = [
  {
    title: "Welcome to Gridly",
    description:
      "Your go-to marketplace for connecting with your college community.",
    image: "https://via.placeholder.com/300x200.png?text=Welcome",
  },
  {
    title: "Buy, Sell & Rent",
    description:
      "List your items, find great deals, and explore rental options.",
    image: "https://via.placeholder.com/300x200.png?text=Buy+Sell+Rent",
  },
  {
    title: "Find & Post Gigs",
    description:
      "Showcase your skills, discover gigs, or hire talented peers.",
    image: "https://via.placeholder.com/300x200.png?text=Find+Post+Gigs",
  },
  {
    title: "Request & Discover",
    description:
      "Need something special? Post your request and connect instantly.",
    image: "https://via.placeholder.com/300x200.png?text=Request+Discover",
  },
  {
    title: "Navigation Overview",
    description:
      "Learn how to navigate the app: Home, Gigs, Add, Messages, and Activity.",
    image: "", // No image needed for this custom slide
  },
];

/**
 * Custom hook for background pulsing and rotating.
 */
const usePulseAnimation = (duration = 15000) => {
  const pulseValue = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.timing(pulseValue, {
        toValue: 1,
        duration,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, [pulseValue, duration]);
  const scale = pulseValue.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.95, 1.5, 0.95],
  });
  const rotate = pulseValue.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });
  return { scale, rotate };
};

interface SlideItemProps {
  slide: Slide;
  index: number;
  scrollX: Animated.Value;
  slideWidth: number;
  active: boolean;
  trigger: number;
}

/**
 * SlideItem component with parallax effect and an animated custom image.
 * When the slide is active, the image bounces (pops) between scale 1 and 1.3.
 */
const SlideItem: FC<SlideItemProps> = memo(
  ({ slide, index, scrollX, slideWidth, active, trigger }) => {
    const inputRange = [
      (index - 1) * slideWidth,
      index * slideWidth,
      (index + 1) * slideWidth,
    ];

    const translateY = scrollX.interpolate({
      inputRange,
      outputRange: [30, 0, -30],
      extrapolate: "clamp",
    });
    const scale = scrollX.interpolate({
      inputRange,
      outputRange: [0.85, 1, 0.85],
      extrapolate: "clamp",
    });
    const opacity = scrollX.interpolate({
      inputRange,
      outputRange: [0.5, 1, 0.5],
      extrapolate: "clamp",
    });

    // Bounce (pop) animation for the active slide
    const bounceAnim = useRef(new Animated.Value(1)).current;
    useEffect(() => {
      let bounceAnimation: Animated.CompositeAnimation;
      if (active) {
        bounceAnimation = Animated.loop(
          Animated.sequence([
            Animated.timing(bounceAnim, {
              toValue: 1.3,
              duration: 300,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(bounceAnim, {
              toValue: 1,
              duration: 300,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
          ])
        );
        bounceAnimation.start();
      } else {
        bounceAnim.setValue(1);
      }
      return () => {
        if (bounceAnimation) bounceAnimation.stop();
      };
    }, [active, bounceAnim, trigger]);

    return (
      <View style={[styles.slide, { width: slideWidth }]}>
        <Animated.View
          style={[
            styles.slideContent,
            { opacity, transform: [{ translateY }, { scale }] },
          ]}
        >
          {/* Custom image with bounce effect */}
          <Animated.Image
            source={require("./assets/logonobg.png")}
            style={[styles.iconWrapper, { transform: [{ scale: bounceAnim }] }]}
            resizeMode="contain"
          />
          <Text style={styles.title}>{slide.title}</Text>
          <Text style={styles.description}>{slide.description}</Text>
          <Animated.Image
            source={{ uri: slide.image }}
            style={[styles.image, { transform: [{ scale }] }]}
            resizeMode="contain"
          />
        </Animated.View>
      </View>
    );
  }
);

/**
 * NavigationOverviewSlide component for the custom navigation overview slide.
 * It shows the icons and bubbles explaining what each navigation option does.
 */
interface NavigationOverviewSlideProps {
  index: number;
  scrollX: Animated.Value;
  slideWidth: number;
  active: boolean;
  trigger: number;
}

const NavigationOverviewSlide: FC<NavigationOverviewSlideProps> = memo(
  ({ index, scrollX, slideWidth, active, trigger }) => {
    const inputRange = [
      (index - 1) * slideWidth,
      index * slideWidth,
      (index + 1) * slideWidth,
    ];

    const translateY = scrollX.interpolate({
      inputRange,
      outputRange: [30, 0, -30],
      extrapolate: "clamp",
    });
    const scale = scrollX.interpolate({
      inputRange,
      outputRange: [0.85, 1, 0.85],
      extrapolate: "clamp",
    });
    const opacity = scrollX.interpolate({
      inputRange,
      outputRange: [0.5, 1, 0.5],
      extrapolate: "clamp",
    });

    return (
      <View style={[styles.slide, { width: slideWidth }]}>
        <Animated.View
          style={[
            styles.navSlideContent,
            { opacity, transform: [{ translateY }, { scale }] },
          ]}
        >
          <Text style={styles.title}>Navigation Overview</Text>
          <Text style={styles.description}>
            Learn how to navigate the app. 
          </Text>
          {/* First Row: Home & Jobs */}
          <View style={styles.navigationOverviewContainer}>
            <View style={styles.navOverviewItem}>
              <Ionicons name="home-outline" size={35} color="#BB86FC" />
              <Text style={styles.navOverviewText}>Home</Text>
              <View style={styles.bubble}>
                <Text style={styles.navOverviewSubText}>
                  Dashboard &amp; main feed
                </Text>
              </View>
            </View>
            <View style={styles.navOverviewItem}>
              <Ionicons name="briefcase-outline" size={35} color="#BB86FC" />
              <Text style={styles.navOverviewText}>Gigs</Text>
              <View style={styles.bubble}>
                <Text style={styles.navOverviewSubText}>
                  Browse Gig listings
                </Text>
              </View>
            </View>
          </View>
          {/* Second Row: Add, Messages & Activity */}
          <View style={styles.navigationOverviewContainer}>
            <View style={styles.navOverviewItem}>
              <Ionicons name="add-outline" size={35} color="#BB86FC" />
              <Text style={styles.navOverviewText}>Add</Text>
              <View style={styles.bubble}>
                <Text style={styles.navOverviewSubText}>
                  Post products or gigs
                </Text>
              </View>
            </View>
            <View style={styles.navOverviewItem}>
              <Ionicons name="chatbubble-outline" size={35} color="#BB86FC" />
              <Text style={styles.navOverviewText}>Messages</Text>
              <View style={styles.bubble}>
                <Text style={styles.navOverviewSubText}>
                  Chat with others
                </Text>
              </View>
            </View>
            <View style={styles.navOverviewItem}>
              <Ionicons name="stats-chart-outline" size={35} color="#BB86FC" />
              <Text style={styles.navOverviewText}>Activity</Text>
              <View style={styles.bubble}>
                <Text style={styles.navOverviewSubText}>
                  View and manage your posts
                </Text>
              </View>
            </View>
          </View>
        </Animated.View>
      </View>
    );
  }
);

interface DemoScreenProps {
  navigation: StackNavigationProp<RootStackParamList, "Demo">;
}

/**
 * DemoScreen component with advanced animations and theming.
 */
const DemoScreen: FC<DemoScreenProps> = ({ navigation }) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [showFounders, setShowFounders] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  // Global background animation
  const { scale: bgScale, rotate: bgRotate } = usePulseAnimation(15000);

  const handleNext = useCallback(() => {
    if (currentSlide < slides.length - 1) {
      scrollRef.current?.scrollTo({
        x: (currentSlide + 1) * width,
        animated: true,
      });
    } else {
      navigation.replace("Login");
    }
  }, [currentSlide, navigation]);

  const onMomentumScrollEnd = useCallback((e: any) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / width);
    setCurrentSlide(index);
  }, []);

  return (
    <LinearGradient colors={["#000000", "#1a0033"]} style={styles.container}>
      {/* Animated Background */}
      <Animated.View
        style={[
          styles.animatedBackground,
          { transform: [{ scale: bgScale }, { rotate: bgRotate }] },
        ]}
      />

      {/* Founders Button */}
      <TouchableOpacity
        style={styles.foundersButton}
        onPress={() => setShowFounders(true)}
      >
        <Text style={styles.foundersButtonText}>Founders</Text>
      </TouchableOpacity>

      {/* Horizontal ScrollView with slides */}
      <View style={styles.sliderContainer}>
        <Animated.ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          onMomentumScrollEnd={onMomentumScrollEnd}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { x: scrollX } } }],
            { useNativeDriver: false }
          )}
        >
          {slides.map((slide, index) => {
            if (slide.title === "Navigation Overview") {
              return (
                <NavigationOverviewSlide
                  key={index}
                  index={index}
                  slideWidth={width}
                  scrollX={scrollX}
                  active={currentSlide === index}
                  trigger={currentSlide}
                />
              );
            } else {
              return (
                <SlideItem
                  key={index}
                  slide={slide}
                  index={index}
                  slideWidth={width}
                  scrollX={scrollX}
                  active={currentSlide === index}
                  trigger={currentSlide}
                />
              );
            }
          })}
        </Animated.ScrollView>
      </View>

      {/* Footer with Pagination Dots and Next Button */}
      <View style={styles.footer}>
        <View style={styles.dotContainer}>
          {slides.map((_, idx) => (
            <View
              key={idx}
              style={[styles.dot, currentSlide === idx && styles.activeDot]}
            />
          ))}
        </View>
        <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
          <Text style={styles.nextButtonText}>
            {currentSlide === slides.length - 1 ? "Get Started" : "Next"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Founders Popup */}
      {showFounders && (
        <View style={styles.foundersModal}>
          <BlurView
            intensity={120}
            tint="dark"
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.foundersContent}>
            <Text style={styles.foundersTitle}>Founders</Text>
            <Text style={styles.foundersEmail}>dhruvreddy05@gmail.com</Text>
            <Text style={styles.foundersEmail}>rithviksaba@gmail.com</Text>
            <TouchableOpacity onPress={() => setShowFounders(false)}>
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </LinearGradient>
  );
};

export default DemoScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  animatedBackground: {
    position: "absolute",
    top: -height * 0.3,
    left: -width * 0.3,
    width: width * 1.5,
    height: width * 1.5,
    borderRadius: (width * 1.5) / 2,
    backgroundColor: "#6200EE",
    opacity: 0.2,
  },
  skipButton: {
    position: "absolute",
    top: 50,
    right: 20,
    zIndex: 10,
    padding: 10,
  },
  skipText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  foundersButton: {
    position: "absolute",
    top: 50,
    left: 20,
    zIndex: 10,
    padding: 10,
  },
  foundersButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  sliderContainer: {
    flex: 8,
  },
  slide: {
    justifyContent: "center",
    alignItems: "center",
  },
  // For regular slides
  slideContent: {
    marginTop: height * 0.3,
    alignItems: "center",
    paddingHorizontal: 20,
  },
  // For the Navigation Overview slide (shifted upward)
  navSlideContent: {
    marginTop: height * 0.2,
    alignItems: "center",
    paddingHorizontal: 20,
  },
  iconWrapper: {
    marginBottom: 20,
    width: 48,
    height: 48,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: 10,
    textShadowColor: "#000",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  description: {
    fontSize: 16,
    color: "#CCCCCC",
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 22,
  },
  image: {
    width: width * 0.8,
    height: height * 0.3,
    marginTop: 30,
    borderRadius: 15,
  },
  footer: {
    flex: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  dotContainer: {
    flexDirection: "row",
    marginBottom: 20,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#555",
    marginHorizontal: 5,
  },
  activeDot: {
    backgroundColor: "#BB86FC",
  },
  nextButton: {
    backgroundColor: "#BB86FC",
    paddingVertical: 12,
    paddingHorizontal: 40,
    borderRadius: 25,
  },
  nextButtonText: {
    color: "#000000",
    fontSize: 16,
    fontWeight: "600",
  },
  // Founders Popup styles
  foundersModal: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 20,
    paddingHorizontal: 20,
  },
  foundersContent: {
    alignItems: "center",
  },
  foundersTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 10,
    textAlign: "center",
  },
  foundersEmail: {
    fontSize: 18,
    color: "#FFFFFF",
    marginVertical: 5,
    textAlign: "center",
  },
  closeButtonText: {
    fontSize: 16,
    color: "#BB86FC",
    marginTop: 20,
    textAlign: "center",
  },
  // Navigation Overview Slide styles
  navigationOverviewContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    marginVertical: 15,
    width: "100%",
  },
  navOverviewItem: {
    alignItems: "center",
    marginHorizontal: 15,
    marginVertical: 10,
  },
  navOverviewText: {
    marginTop: 8,
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
    textAlign: "center",
  },
  navOverviewSubText: {
    fontSize: 12,
    color: "#CCCCCC",
    textAlign: "center",
    width: 120,
  },
  bubble: {
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 4,
  },
});
