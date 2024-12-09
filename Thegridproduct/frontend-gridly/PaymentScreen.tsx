// PaymentScreen.tsx

import React, { useState, useContext } from "react";
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
  const { product, buyerId, sellerId } = route.params; // They should now all be strings
  const navigation = useNavigation<NavigationProp>();
  const { confirmPayment } = useStripe();
  const { token } = useContext(UserContext);

  if (__DEV__) {
    console.log("Route Params:", route.params); // Log all route params
    console.log("User Token:", token);
    console.log("Buyer ID:", buyerId);
    console.log("Seller ID:", sellerId);
    console.log("Product ID:", product.id);
  }

  const [cardDetails, setCardDetails] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [nameOnCard, setNameOnCard] = useState<string>("");

  const handlePayPress = async () => {
    if (!cardDetails?.complete) {
      Alert.alert("Incomplete Details", "Please enter complete card details.");
      return;
    }

    if (!nameOnCard.trim()) {
      Alert.alert("Missing Information", "Please enter the name on the card.");
      return;
    }

    // Check for buyerId, sellerId, token
    if (!token || !buyerId || !sellerId || buyerId === "" || sellerId === "") {
      Alert.alert(
        "Authentication Error",
        "User or seller information missing."
      );
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${NGROK_URL}/create-payment-intent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount: Math.round(product.price * product.quantity * 100),
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

      const { clientSecret, chatId, error } = responseData;

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
        Alert.alert("Payment Successful", "Your payment was successful!");
        navigation.navigate("Messaging", { chatId, userId: buyerId });
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

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    backgroundColor: "#fff",
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
    color: "#000",
    fontSize: 18,
    fontWeight: "600",
    marginTop: 10,
    textAlign: "center",
  },
  productPrice: {
    color: "#000",
    fontSize: 16,
    marginTop: 5,
  },
  productQuantity: {
    color: "#000",
    fontSize: 16,
    marginTop: 5,
  },
  paymentDetailsContainer: {
    marginTop: 30,
  },
  paymentDetailsTitle: {
    color: "#000",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 10,
  },
  paymentInput: {
    backgroundColor: "#f2f2f2",
    color: "#000",
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  cardStyle: {
    backgroundColor: "#FFFFFF",
  },
  cardField: {
    width: "100%",
    height: 50,
    marginVertical: 30,
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
});
