import React, { useState } from "react";
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
} from "react-native";
import { RouteProp, useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "./navigationTypes";
import { CardField, useStripe } from "@stripe/stripe-react-native";

type PaymentScreenRouteProp = RouteProp<RootStackParamList, "Payment">;

type PaymentScreenProps = {
  route: PaymentScreenRouteProp;
};

const PaymentScreen: React.FC<PaymentScreenProps> = ({ route }) => {
  const { product } = route.params;
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { confirmPayment } = useStripe();

  const [cardDetails, setCardDetails] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [nameOnCard, setNameOnCard] = useState<string>("");
  const [cardNumber, setCardNumber] = useState<string>("");
  const [expiryDate, setExpiryDate] = useState<string>("");
  const [securityCode, setSecurityCode] = useState<string>("");
  const [zipCode, setZipCode] = useState<string>("");

  const handleCardNumberChange = (value: string) => {
    const formattedValue = value
      .replace(/\s/g, "")
      .replace(/(\d{4})(?=\d)/g, "$1 ");
    setCardNumber(formattedValue);
  };

  const handleExpiryDateChange = (value: string) => {
    let formattedValue = value.replace(/\//g, "");
    if (formattedValue.length > 2) {
      formattedValue = `${formattedValue.slice(0, 2)}/${formattedValue.slice(
        2
      )}`;
    }
    setExpiryDate(formattedValue);
  };

  const handleZipCodeChange = (value: string) => {
    setZipCode(value.replace(/\D/g, "").slice(0, 5));
  };

  const handlePayPress = async () => {
    if (!cardDetails?.complete) {
      Alert.alert("Incomplete Details", "Please enter complete card details.");
      return;
    }

    setLoading(true);

    try {
      // 1. Call your backend to create a PaymentIntent
      const response = await fetch(
        `${process.env.NGROK_URL}/create-payment-intent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            // Include authentication headers if required
          },
          body: JSON.stringify({
            amount: Math.round(product.price * product.quantity * 100), // Amount in cents
            currency: "usd",
            // Include any additional data like product ID, user ID, etc.
            productId: product.id,
            quantity: product.quantity,
          }),
        }
      );

      const { clientSecret, error } = await response.json();

      if (error) {
        Alert.alert("Payment Error", error);
        setLoading(false);
        return;
      }

      if (!clientSecret) {
        Alert.alert("Payment Error", "Failed to initialize payment.");
        setLoading(false);
        return;
      }

      // 2. Confirm the payment using the client secret
      const { paymentIntent, error: stripeError } = await confirmPayment(
        clientSecret,
        {
          type: "Card",
          billingDetails: {
            // Optionally, include billing details like name, email, etc.
            name: nameOnCard,
            email: "customer@example.com",
          },
        }
      );

      if (stripeError) {
        Alert.alert("Payment Failed", stripeError.message);
      } else if (paymentIntent) {
        Alert.alert("Payment Successful", "Your payment was successful!");
        // Optionally, navigate to an order confirmation screen
        navigation.navigate("Dashboard"); // Adjust based on your app's flow
        // Optionally, remove the purchased product from the cart here or refresh the cart
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
                value={nameOnCard}
                onChangeText={setNameOnCard}
              />
              <TextInput
                style={styles.paymentInput}
                placeholder="Card number"
                value={cardNumber}
                onChangeText={handleCardNumberChange}
                keyboardType="numeric"
                maxLength={19}
              />
              <View style={styles.dateCodeContainer}>
                <TextInput
                  style={[styles.paymentInput, styles.dateCodeInput]}
                  placeholder="MM/YY"
                  value={expiryDate}
                  onChangeText={handleExpiryDateChange}
                  keyboardType="numeric"
                  maxLength={5}
                />
                <TextInput
                  style={[styles.paymentInput, styles.dateCodeInput]}
                  placeholder="CVV"
                  value={securityCode}
                  onChangeText={setSecurityCode}
                  keyboardType="numeric"
                  maxLength={3}
                />
              </View>
              <TextInput
                style={styles.paymentInput}
                placeholder="ZIP/Postal code"
                value={zipCode}
                onChangeText={handleZipCodeChange}
                keyboardType="numeric"
                maxLength={5}
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
    </KeyboardAvoidingView>
  );
};

export default PaymentScreen;

// Stylesheet
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
    fontWeight: "600",
    marginTop: 10,
    textAlign: "center",
  },
  productPrice: {
    color: "#BB86FC",
    fontSize: 16,
    marginTop: 5,
  },
  productQuantity: {
    color: "#fff",
    fontSize: 16,
    marginTop: 5,
  },
  cardContainer: {
    marginTop: 30,
  },
  card: {
    backgroundColor: "#1E1E1E",
    textColor: "#FFFFFF",
    placeholderColor: "#888", // Enhanced placeholder visibility
  },
  cardField: {
    width: "100%",
    height: 50,
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
  },
  dateCodeContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  dateCodeInput: {
    width: "48%",
  },
});
