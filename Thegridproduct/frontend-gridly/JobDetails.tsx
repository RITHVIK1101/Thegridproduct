// JobDetails.tsx

import React, { useEffect, useState, useContext } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Image,
  TouchableOpacity,
  Alert,
  Dimensions,
} from "react-native";
import { RouteProp, useRoute, useNavigation } from "@react-navigation/native";
import { RootStackParamList } from "./navigationTypes";
import Ionicons from "react-native-vector-icons/Ionicons";
import { UserContext } from "./UserContext";
import { NGROK_URL } from "@env";
import { LinearGradient } from "expo-linear-gradient";
import { StackNavigationProp } from "@react-navigation/stack";

type JobDetailRouteProp = RouteProp<RootStackParamList, "JobDetail">;
type JobDetailNavigationProp = StackNavigationProp<
  RootStackParamList,
  "JobDetail"
>;

interface JobDetail {
  id: string;
  title: string;
  description: string;
  category: string;
  price: string;
  userId: string;
  images: string[]; // Changed from coverImage
  deliveryTime: string;
  studentType: string;
  university: string;
  status: string;
  // Add other fields as necessary
}

const { width } = Dimensions.get("window");

const JobDetails: React.FC = () => {
  const route = useRoute<JobDetailRouteProp>();
  const navigation = useNavigation<JobDetailNavigationProp>();
  const { jobId } = route.params;
  const { token, userId } = useContext(UserContext);

  const [jobDetail, setJobDetail] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    fetchJobDetails();
  }, []);

  const fetchJobDetails = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${NGROK_URL}/services/${jobId}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch job details: ${response.status}`);
      }

      const data = await response.json();

      // Remove the .gig check since the API returns the gig directly
      if (!data) {
        throw new Error("Job detail not found.");
      }

      setJobDetail(data);
    } catch (error) {
      console.error(error);
      Alert.alert(
        "Error",
        "Unable to fetch job details. Please try again later."
      );
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const handleMessagePress = () => {
    if (!jobDetail) return;

    // Here you would implement logic to either create a new chat or get existing chatId
    // For simplicity, we'll assume chatId is a combination of userId and jobDetail.userId

    const chatId = `chat_${userId}_${jobDetail.userId}`;

    navigation.navigate("Messaging", { chatId, userId: jobDetail.userId });
  };

  if (loading || !jobDetail) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#BB86FC" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Cover Image */}
      {jobDetail.images && jobDetail.images.length > 0 ? (
        <Image
          source={{ uri: jobDetail.images[0] }} // Use first image as cover
          style={styles.coverImage}
          resizeMode="cover"
          onError={(e) => {
            console.log(
              `Failed to load image for job ID ${jobDetail.id}:`,
              e.nativeEvent.error
            );
          }}
        />
      ) : (
        <View style={styles.coverPlaceholder}>
          <Ionicons name="image-outline" size={60} color="#555" />
        </View>
      )}

      {/* Job Details */}
      <View style={styles.detailsContainer}>
        <Text style={styles.title}>{jobDetail.title}</Text>
        <View style={styles.categoryRow}>
          <Ionicons
            name={categoryIcons[jobDetail.category] || "grid-outline"}
            size={20}
            color="#BB86FC"
            style={{ marginRight: 5 }}
          />
          <Text style={styles.category}>{jobDetail.category}</Text>
        </View>
        <Text style={styles.price}>
          {jobDetail.price === "Open to Communication"
            ? jobDetail.price
            : `$${parseFloat(jobDetail.price).toFixed(2)}`}
        </Text>
        <Text style={styles.description}>{jobDetail.description}</Text>

        {/* Add more details as needed, e.g., seller info, ratings, etc. */}

        <TouchableOpacity
          style={styles.messageButton}
          onPress={handleMessagePress}
        >
          <LinearGradient
            colors={["#8E2DE2", "#4A00E0"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.messageButtonGradient}
          >
            <Ionicons
              name="chatbubble-ellipses-outline"
              size={20}
              color="#fff"
            />
            <Text style={styles.messageButtonText}>Message</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const categoryIcons: { [key: string]: string } = {
  Tutoring: "school-outline",
  Design: "color-palette-outline",
  Writing: "create-outline",
  Delivery: "bicycle-outline",
  Coding: "code-slash-outline",
  Other: "grid-outline",
};

export default JobDetails;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
  },
  coverImage: {
    width: "100%",
    height: 200,
  },
  coverPlaceholder: {
    width: "100%",
    height: 200,
    backgroundColor: "#333",
    justifyContent: "center",
    alignItems: "center",
  },
  detailsContainer: {
    padding: 20,
  },
  title: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 10,
  },
  categoryRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  category: {
    color: "#BB86FC",
    fontSize: 16,
    fontWeight: "600",
  },
  price: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 15,
  },
  description: {
    color: "#ccc",
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 20,
  },
  messageButton: {
    alignSelf: "center",
    width: "80%",
    borderRadius: 25,
    overflow: "hidden",
    marginTop: 20,
  },
  messageButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
  },
  messageButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 10,
  },
});
