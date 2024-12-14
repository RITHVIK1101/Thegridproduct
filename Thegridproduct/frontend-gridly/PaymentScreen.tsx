import React, { useState, useContext, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
} from "react-native";
import { useStripe } from "@stripe/stripe-react-native";
import { useNavigation } from "@react-navigation/native";
import { UserContext } from "./UserContext";
import { NGROK_URL } from "@env";

type PaymentScreenProps = {
  route: {
    params: {
      product: {
        id: string;
        price: number;
        quantity: number;
        sellerId: string;
        // Add other product fields as needed
      };
    };
  };
};

const PaymentScreen: React.FC<PaymentScreenProps> = ({ route }) => {
  const { product } = route.params;
  const navigation = useNavigation();
  const { confirmPayment } = useStripe();
  const { userId, token } = useContext(UserContext);

  const buyerId = userId;
  const sellerId = product.sellerId;

  // Card Details States
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState(""); // Format: MM/YY
  const [cardCVC, setCardCVC] = useState("");

  // Loading State
  const [loading, setLoading] = useState(false);

  // Error Message State
  const [errorMessage, setErrorMessage] = useState("");

  // Logging for Debugging
  useEffect(() => {
    console.log("=== PaymentScreen Mounted ===");
    console.log("userId:", userId);
    console.log("token:", token);
    console.log("buyerId:", buyerId);
    console.log("sellerId:", sellerId);
    console.log("product:", product);
    console.log("Card Details:", { cardNumber, cardExpiry, cardCVC });
  }, [
    userId,
    token,
    buyerId,
    sellerId,
    product,
    cardNumber,
    cardExpiry,
    cardCVC,
  ]);

  // Show Alert for Errors
  const showError = (msg: string) => {
    setErrorMessage(msg);
    Alert.alert("Error", msg);
  };

  // Formatting Functions
  const formatCardNumber = (input: string) => {
    const cleaned = input.replace(/\D+/g, ""); // Remove non-digits
    const formatted = cleaned.match(/.{1,4}/g)?.join(" ") || cleaned;
    return formatted;
  };

  const formatExpiry = (input: string) => {
    const cleaned = input.replace(/\D+/g, ""); // Remove non-digits
    if (cleaned.length > 2) {
      return `${cleaned.slice(0, 2)}/${cleaned.slice(2, 4)}`;
    }
    return cleaned;
  };

  // Handle Payment Press
  const handlePayPress = async () => {
    console.log("=== handlePayPress Initiated ===");

    // Basic Validation
    const rawCardNumber = cardNumber.replace(/\s+/g, "");
    if (rawCardNumber.length !== 16 || !/^\d{16}$/.test(rawCardNumber)) {
      showError("Card number must be 16 digits.");
      return;
    }

    const expiryMatch = /^(0[1-9]|1[0-2])\/(\d{2})$/.exec(cardExpiry);
    if (!expiryMatch) {
      showError("Expiry date must be in MM/YY format.");
      return;
    }

    const [, monthStr, yearStr] = expiryMatch;
    const expMonth = parseInt(monthStr, 10);
    const expYear = parseInt(`20${yearStr}`, 10); // Convert YY to 20YY

    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;

    if (
      expYear < currentYear ||
      (expYear === currentYear && expMonth < currentMonth)
    ) {
      showError("Card has expired.");
      return;
    }

    if (
      cardCVC.length < 3 ||
      cardCVC.length > 4 ||
      !/^\d{3,4}$/.test(cardCVC)
    ) {
      showError("CVC must be 3 or 4 digits.");
      return;
    }

    if (!token || !buyerId || !sellerId) {
      showError("Missing user information.");
      return;
    }

    setLoading(true);
    console.log("Sending request to backend to create PaymentIntent...");

    try {
      // Create PaymentIntent via backend
      const response = await fetch(`${NGROK_URL}/create-payment-intent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount: Math.round(product.price * product.quantity * 100), // in cents
          currency: "usd",
          productId: product.id,
          buyerId: buyerId,
          sellerId: sellerId,
        }),
      });

      const responseData = await response.json();
      console.log("Backend response:", responseData);

      if (!response.ok) {
        console.error("Backend Error:", responseData);
        showError(responseData.message || "Failed to create payment intent.");
        setLoading(false);
        return;
      }

      const { clientSecret, chatId } = responseData;
      if (!clientSecret) {
        showError("No client secret returned.");
        setLoading(false);
        return;
      }

      console.log("Confirming payment with Stripe...");

      // Confirm the payment with Stripe
      const { paymentIntent, error: stripeError } = await confirmPayment(
        clientSecret,
        {
          paymentMethodType: "Card",
          paymentMethodData: {
            card: {
              number: rawCardNumber,
              expMonth: expMonth,
              expYear: expYear,
              cvc: cardCVC,
            },
          },
        }
      );

      console.log("Stripe confirmPayment result:", {
        paymentIntent,
        stripeError,
      });

      if (stripeError) {
        showError(stripeError.message || "Payment failed.");
      } else if (paymentIntent) {
        console.log("Payment successful:", paymentIntent);
        Alert.alert("Success", "Payment was successful!", [
          {
            text: "OK",
            onPress: () =>
              navigation.navigate("Messaging", { chatId, userId: buyerId }),
          },
        ]);
      }
    } catch (err) {
      console.error("Payment Error:", err);
      showError("Unexpected error occurred.");
    } finally {
      setLoading(false);
      console.log("handlePayPress completed.");
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.innerContainer}>
          {/* Card Number Input */}
          <Text style={styles.label}>Card Number</Text>
          <TextInput
            style={styles.input}
            placeholder="4242 4242 4242 4242"
            placeholderTextColor="#999"
            keyboardType="numeric"
            value={cardNumber}
            onChangeText={(text) => setCardNumber(formatCardNumber(text))}
            maxLength={19}
          />

          {/* Expiry Date Input */}
          <Text style={styles.label}>Expiry Date (MM/YY)</Text>
          <TextInput
            style={styles.input}
            placeholder="MM/YY"
            placeholderTextColor="#999"
            keyboardType="numeric"
            value={cardExpiry}
            onChangeText={(text) => setCardExpiry(formatExpiry(text))}
            maxLength={5}
          />

          {/* CVC Input */}
          <Text style={styles.label}>CVC</Text>
          <TextInput
            style={styles.input}
            placeholder="CVC"
            placeholderTextColor="#999"
            keyboardType="numeric"
            value={cardCVC}
            onChangeText={setCardCVC}
            maxLength={4}
          />

          {/* Pay Button */}
          <TouchableOpacity
            style={styles.payButton}
            onPress={handlePayPress}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.payButtonText}>Pay Now</Text>
            )}
          </TouchableOpacity>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
};

export default PaymentScreen;

// Minimal Styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
    backgroundColor: "#f2f2f2",
  },
  innerContainer: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 10,
    elevation: 2,
  },
  label: {
    fontSize: 14,
    marginBottom: 5,
    color: "#333",
  },
  input: {
    height: 50,
    borderColor: "#ccc",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    marginBottom: 15,
    fontSize: 16,
    color: "#333",
  },
  payButton: {
    backgroundColor: "#28a745",
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: "center",
  },
  payButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
});
