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
  FlatList,
} from "react-native";
import { RouteProp, useRoute, useNavigation } from "@react-navigation/native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { UserContext } from "./UserContext";
import { NGROK_URL } from "@env";
import { LinearGradient } from "expo-linear-gradient";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "./navigationTypes";

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
  images: string[]; // Array of image URLs
  deliveryTime: string;
  university: string;
  postedDate: string; // Date Posted
  // Removed studentType and status
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

      if (!data) {
        throw new Error("Job detail not found.");
      }

      // Ensure `images` is always an array
      if (!Array.isArray(data.images)) {
        data.images = [];
      }

      // Ensure `postedDate` is present and formatted
      if (data.postedDate) {
        const date = new Date(data.postedDate);
        data.postedDate = date.toLocaleDateString(undefined, {
          year: "numeric",
          month: "long",
          day: "numeric",
        });
      } else {
        data.postedDate = "N/A";
      }

      setJobDetail(data);
    } catch (error) {
      console.error("Error fetching job details:", error);
      Alert.alert("Error", "Unable to fetch job details. Please try again later.");
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const handleMessagePress = () => {
    if (!jobDetail) return;

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

  // Reusable component to display label & value
  const DetailItem: React.FC<{ label: string; value: string }> = ({
    label,
    value,
  }) => (
    <View style={styles.detailItem}>
      <Text style={styles.detailLabel}>{label}:</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );

  return (
    <ScrollView style={styles.container}>
      {/* Image Gallery */}
      {jobDetail.images.length > 0 ? (
        <FlatList
          data={jobDetail.images.slice(0, 5)} // Show up to 5 images
          horizontal
          keyExtractor={(item, index) => `${jobDetail.id}_image_${index}`}
          showsHorizontalScrollIndicator={false}
          style={styles.imageGallery}
          renderItem={({ item }) => {
            // Convert relative URLs to absolute if necessary
            const imageUrl = item.startsWith("http")
              ? item
              : `${NGROK_URL}/${item}`;

            return (
              <Image
                source={{ uri: imageUrl }}
                style={styles.galleryImage}
                resizeMode="cover"
                onError={(e) => {
                  console.log("Error loading image:", e.nativeEvent.error);
                }}
              />
            );
          }}
        />
      ) : (
        <View style={styles.coverPlaceholder}>
          <Ionicons name="image-outline" size={60} color="#555" />
        </View>
      )}

      {/* Details Container */}
      <View style={styles.detailsContainer}>
        {/* Title */}
        <Text style={styles.title}>{jobDetail.title}</Text>

        {/* Category/Type */}
        <View style={styles.categoryRow}>
          <Ionicons
            name={categoryIcons[jobDetail.category] || "grid-outline"}
            size={20}
            color="#BB86FC"
            style={{ marginRight: 5 }}
          />
          <Text style={styles.category}>{jobDetail.category}</Text>
        </View>

        {/* Date Posted */}
        <Text style={styles.datePosted}>Posted on {jobDetail.postedDate}</Text>

        {/* Price */}
        <Text
          style={[
            styles.price,
            jobDetail.price === "Open to Communication" && styles.priceOpen,
          ]}
        >
          {jobDetail.price === "Open to Communication"
            ? jobDetail.price
            : `$${parseFloat(jobDetail.price).toFixed(2)}`}
        </Text>

        {/* Description */}
        <Text style={styles.description}>{jobDetail.description}</Text>

        {/* Additional Details */}
        <View style={styles.additionalDetails}>
          <DetailItem label="Delivery Time" value={jobDetail.deliveryTime} />
          <DetailItem label="University" value={jobDetail.university} />
          {/* Removed studentType and status */}
        </View>

        {/* Message Button */}
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
  imageGallery: {
    width: "100%",
    height: 200,
  },
  galleryImage: {
    width: width * 0.8,
    height: 200,
    marginRight: 10,
    borderRadius: 10,
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
    fontSize: 26,
    fontWeight: "800",
    marginBottom: 10,
  },
  categoryRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 5,
  },
  category: {
    color: "#BB86FC",
    fontSize: 18,
    fontWeight: "700",
  },
  datePosted: {
    color: "#AAAAAA",
    fontSize: 14,
    marginBottom: 10,
  },
  price: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 15,
  },
  priceOpen: {
    fontWeight: "400", // Normal weight for "Open to Communication"
  },
  description: {
    color: "#ccc",
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 20,
  },
  additionalDetails: {
    marginBottom: 20,
  },
  detailItem: {
    flexDirection: "row",
    marginBottom: 10,
  },
  detailLabel: {
    color: "#BB86FC",
    fontSize: 16,
    fontWeight: "600",
    width: 120, // Adjust if needed
  },
  detailValue: {
    color: "#fff",
    fontSize: 16,
    flex: 1,
    flexWrap: "wrap",
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
