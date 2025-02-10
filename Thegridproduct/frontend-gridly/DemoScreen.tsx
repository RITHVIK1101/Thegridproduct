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
  import { Ionicons } from "@expo/vector-icons";
  import { StackNavigationProp } from "@react-navigation/stack";
  import { RootStackParamList } from "./navigationTypes";
  
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
  ];
  
  /**
   * Custom hook to create a continuous spin animation.
   */
  const useSpinAnimation = (duration = 8000): Animated.AnimatedInterpolation => {
    const spinValue = useRef(new Animated.Value(0)).current;
    useEffect(() => {
      Animated.loop(
        Animated.timing(spinValue, {
          toValue: 1,
          duration,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();
    }, [spinValue, duration]);
    return spinValue.interpolate({
      inputRange: [0, 1],
      outputRange: ["0deg", "360deg"],
    });
  };
  
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
    iconSpin: Animated.AnimatedInterpolation;
    slideWidth: number;
    active: boolean;
    trigger: number;
  }
  
  /**
   * SlideItem component with parallax effect and an animated logo.
   * The spinning logo will “pop” (zoom in then back out) when the slide becomes active.
   */
  const SlideItem: FC<SlideItemProps> = memo(
    ({ slide, index, scrollX, iconSpin, slideWidth, active, trigger }) => {
      // Define the input range based on the slide index
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
  
      // Animated value for the logo "pop" effect on slide change
      const logoScaleAnim = useRef(new Animated.Value(1)).current;
      useEffect(() => {
        if (active) {
          Animated.sequence([
            Animated.timing(logoScaleAnim, {
              toValue: 1.5,
              duration: 200,
              easing: Easing.out(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(logoScaleAnim, {
              toValue: 1,
              duration: 200,
              easing: Easing.in(Easing.ease),
              useNativeDriver: true,
            }),
          ]).start();
        }
      }, [active, trigger, logoScaleAnim]);
  
      return (
        <View style={[styles.slide, { width: slideWidth }]}>
          <Animated.View
            style={[
              styles.slideContent,
              { opacity, transform: [{ translateY }, { scale }] },
            ]}
          >
            {/* Spinning logo with an added pop (scale) effect on slide change */}
            <Animated.View
              style={[
                styles.iconWrapper,
                { transform: [{ rotate: iconSpin }, { scale: logoScaleAnim }] },
              ]}
            >
              <Ionicons name="grid-outline" size={48} color="#BB86FC" />
            </Animated.View>
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
  
  interface DemoScreenProps {
    navigation: StackNavigationProp<RootStackParamList, "Demo">;
  }
  
  /**
   * DemoScreen component with advanced animations and theming.
   */
  const DemoScreen: FC<DemoScreenProps> = ({ navigation }) => {
    const [currentSlide, setCurrentSlide] = useState(0);
    const scrollRef = useRef<ScrollView>(null);
    const scrollX = useRef(new Animated.Value(0)).current;
  
    // Global animations from custom hooks
    const iconSpin = useSpinAnimation(8000);
    const { scale: bgScale, rotate: bgRotate } = usePulseAnimation(15000);
  
    const handleNext = useCallback(() => {
      if (currentSlide < slides.length - 1) {
        scrollRef.current?.scrollTo({ x: (currentSlide + 1) * width, animated: true });
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
  
        {/* Skip Button */}
        <TouchableOpacity
          style={styles.skipButton}
          onPress={() => navigation.replace("Login")}
        >
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
  
        {/* Animated Horizontal ScrollView with Parallax */}
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
            {slides.map((slide, index) => (
              <SlideItem
                key={index}
                slide={slide}
                index={index}
                slideWidth={width}
                scrollX={scrollX}
                iconSpin={iconSpin}
                active={currentSlide === index}
                trigger={currentSlide} // triggers the pop effect when currentSlide changes
              />
            ))}
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
    sliderContainer: {
      flex: 8,
    },
    slide: {
      justifyContent: "center",
      alignItems: "center",
    },
    slideContent: {
      marginTop: height * 0.3,
      alignItems: "center",
      paddingHorizontal: 20,
    },
    iconWrapper: {
      marginBottom: 20,
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
  });
  