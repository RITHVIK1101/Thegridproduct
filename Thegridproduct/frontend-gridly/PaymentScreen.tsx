// PaymentScreen.tsx

import React, { useState, useContext, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TouchableWithoutFeedback,
  Keyboard,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
  TextInput,
  Modal,
} from "react-native";
import { RouteProp, useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList, CartProduct } from "./navigationTypes";
import { CardField, useStripe } from "@stripe/stripe-react-native";
import { NGROK_URL } from "@env";
import { UserContext } from "./UserContext";

type PaymentScreenRouteProp = RouteProp<RootStackParamList, "Payment">;

type PaymentScreenProps = {
  route: PaymentScreenRouteProp;
};

type NavigationProp = StackNavigationProp<RootStackParamList, "Payment">;

const PaymentScreen: React.FC<PaymentScreenProps> = ({ route }) => {
  const { product, buyerId, sellerId } = route.params; // Ensure all are strings
  const navigation = useNavigation<NavigationProp>();
  const { confirmPayment } = useStripe();
  const { token } = useContext(UserContext);

  // Debugging Logs
  if (__DEV__) {
    console.log("Route Params:", route.params);
    console.log("User Token:", token);
    console.log("Buyer ID:", buyerId);
    console.log("Seller ID:", sellerId);
    console.log("Product ID:", product.id);
  }

  const [cardDetails, setCardDetails] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [nameOnCard, setNameOnCard] = useState<string>("");
  const [countdown, setCountdown] = useState<number>(3);
  const [showSuccessModal, setShowSuccessModal] = useState<boolean>(false);
  const [chatId, setChatId] = useState<string>(""); // State to hold chatId

  // Handle Countdown for Success Modal
  useEffect(() => {
    let timer: NodeJS.Timeout | undefined;
    if (showSuccessModal && countdown > 0) {
      timer = setTimeout(
        () => setCountdown((prev) => Math.max(prev - 1, 0)),
        1000
      );
    } else if (showSuccessModal && countdown === 0) {
      setShowSuccessModal(false);
      navigation.navigate("Messaging", {
        chatId: chatId || "",
        userId: buyerId,
      });
    }
    return () => clearTimeout(timer);
  }, [showSuccessModal, countdown, chatId, buyerId, navigation]);

  // Function to Update Product Status in Database
  const updateProductStatus = async () => {
    try {
      const response = await fetch(`${NGROK_URL}/update-product-status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          productId: product.id,
          status: "talks", // Update product status to "talks"
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Failed to update product status:", errorText);
        Alert.alert("Error", "Failed to update product status.");
        return false;
      }

      return true;
    } catch (error) {
      console.error("Error updating product status:", error);
      Alert.alert(
        "Error",
        "An unexpected error occurred while updating product status."
      );
      return false;
    }
  };

  // Function to Update Cart Status to "bought"
  const updateCartStatus = async () => {
    try {
      const response = await fetch(`${NGROK_URL}/cart/update-status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          productId: product.id,
          cartStatus: "bought", // Update cart status to "bought"
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Failed to update cart status:", errorText);
        Alert.alert("Error", "Failed to update cart status.");
        return false;
      }

      return true;
    } catch (error) {
      console.error("Error updating cart status:", error);
      Alert.alert(
        "Error",
        "An unexpected error occurred while updating cart status."
      );
      return false;
    }
  };

  // Handle Payment Press
  const handlePayPress = async () => {
    if (!cardDetails?.complete) {
      Alert.alert("Incomplete Details", "Please enter complete card details.");
      return;
    }

    if (!nameOnCard.trim()) {
      Alert.alert("Missing Information", "Please enter the name on the card.");
      return;
    }

    // Validate Required Parameters
    if (!token || !buyerId || !sellerId || buyerId === "" || sellerId === "") {
      Alert.alert(
        "Authentication Error",
        "User or seller information missing."
      );
      return;
    }

    setLoading(true);

    try {
      // Create Payment Intent
      const response = await fetch(`${NGROK_URL}/create-payment-intent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount: Math.round(product.price * product.quantity * 100), // Amount in cents
          currency: "usd",
          productId: product.id,
          buyerId: buyerId,
          sellerId: sellerId,
        }),
      });

      const responseText = await response.text();
      console.log("Response Status:", response.status);
      console.log("Raw Response Text:", responseText);

      if (!response.ok) {
        console.error("Error Response:", responseText);
        Alert.alert("Payment Error", "Failed to create payment intent.");
        setLoading(false);
        return;
      }

      let responseData;
      try {
        responseData = JSON.parse(responseText);
        console.log("Parsed Response Data:", responseData);
      } catch (parseError) {
        console.error("JSON Parse Error:", parseError);
        Alert.alert("Payment Error", "Invalid server response.");
        setLoading(false);
        return;
      }

      const { clientSecret, chatId: receivedChatId, error } = responseData;

      if (error) {
        Alert.alert("Payment Error", error);
        setLoading(false);
        return;
      }

      if (!clientSecret || !receivedChatId) {
        Alert.alert("Payment Error", "Failed to initialize payment.");
        setLoading(false);
        return;
      }

      // Store chatId in state
      setChatId(receivedChatId);

      // Confirm Payment with Stripe
      const { paymentIntent, error: stripeError } = await confirmPayment(
        clientSecret,
        {
          paymentMethodType: "Card",
          paymentMethodData: {
            billingDetails: {
              name: nameOnCard,
            },
          },
        }
      );

      if (stripeError) {
        Alert.alert("Payment Failed", stripeError.message);
      } else if (paymentIntent) {
        // Update Cart Status to 'bought'
        const cartStatusUpdated = await updateCartStatus();

        // Update Product Status to 'talks'
        const productStatusUpdated = await updateProductStatus();

        if (cartStatusUpdated && productStatusUpdated) {
          // Show Success Modal with Countdown
          setShowSuccessModal(true);
          setCountdown(3);
        } else {
          // If either update failed, notify the user
          Alert.alert("Payment Successful", "But failed to update statuses.");
        }
      }
    } catch (err) {
      console.error("Payment Error:", err);
      Alert.alert("Payment Error", "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.container}>
            {/* Product Details */}
            <View style={styles.productContainer}>
              <Image
                source={{
                  uri:
                    product.images && product.images.length > 0
                      ? product.images[0]
                      : "https://via.placeholder.com/150",
                }}
                style={styles.productImage}
                resizeMode="contain"
              />
              <Text style={styles.productTitle}>{product.title}</Text>
              <Text style={styles.productPrice}>
                Price: ${(product.price * product.quantity).toFixed(2)}
              </Text>
              <Text style={styles.productQuantity}>
                Quantity: {product.quantity}
              </Text>
            </View>

            {/* Payment Details */}
            <View style={styles.paymentDetailsContainer}>
              <Text style={styles.paymentDetailsTitle}>Payment Details</Text>
              <TextInput
                style={styles.paymentInput}
                placeholder="Name on card"
                placeholderTextColor="#888"
                value={nameOnCard}
                onChangeText={setNameOnCard}
                accessibilityLabel="Name on Card"
              />
              <CardField
                postalCodeEnabled={false}
                placeholders={{
                  number: "4242 4242 4242 4242",
                }}
                cardStyle={styles.cardStyle}
                style={styles.cardField}
                onCardChange={(details) => {
                  setCardDetails(details);
                }}
                accessibilityLabel="Card Details"
              />
            </View>

            {/* Pay Button */}
            <TouchableOpacity
              style={styles.payButton}
              onPress={handlePayPress}
              disabled={loading}
              accessibilityLabel="Pay Now"
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.payButtonText}>
                  Pay ${(product.price * product.quantity).toFixed(2)}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </TouchableWithoutFeedback>

      {/* Success Modal */}
      <Modal visible={showSuccessModal} transparent={true} animationType="fade">
        <View style={styles.modalBackground}>
          <View style={styles.modalContainer}>
            <Text style={styles.successText}>Payment Successful!</Text>
            <Text style={styles.countdownText}>
              Redirecting in {countdown}...
            </Text>
            <ActivityIndicator
              size="large"
              color="#BB86FC"
              style={{ marginTop: 20 }}
            />
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

export default PaymentScreen;

// --- Styles ---
const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    backgroundColor: "#121212",
    padding: 20,
    justifyContent: "space-between",
  },
  container: {
    flex: 1,
    justifyContent: "space-between",
  },
  productContainer: {
    alignItems: "center",
    marginTop: 20,
  },
  productImage: {
    width: 150,
    height: 150,
    borderRadius: 10,
    backgroundColor: "gray",
  },
  productTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    marginTop: 10,
    textAlign: "center",
  },
  productPrice: {
    color: "#BB86FC",
    fontSize: 16,
    marginTop: 5,
  },
  productQuantity: {
    color: "#bbb",
    fontSize: 16,
    marginTop: 5,
  },
  paymentDetailsContainer: {
    marginTop: 30,
  },
  paymentDetailsTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 10,
  },
  paymentInput: {
    backgroundColor: "#1E1E1E",
    color: "#fff",
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
    fontSize: 16,
  },
  cardStyle: {
    backgroundColor: "#1E1E1E",
  },
  cardField: {
    width: "100%",
    height: 50,
    marginVertical: 30,
    borderRadius: 8,
    backgroundColor: "#1E1E1E",
  },
  payButton: {
    backgroundColor: "#BB86FC",
    paddingVertical: 15,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
    marginBottom: 50,
  },
  payButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  modalBackground: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    width: 250,
    padding: 20,
    backgroundColor: "#1E1E1E",
    borderRadius: 10,
    alignItems: "center",
  },
  successText: {
    fontSize: 22,
    fontWeight: "700",
    color: "#34C759",
    textAlign: "center",
  },
  countdownText: {
    fontSize: 18,
    color: "#fff",
    marginTop: 10,
  },
});
