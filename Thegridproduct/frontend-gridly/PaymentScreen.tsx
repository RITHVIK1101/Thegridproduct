// PaymentScreen.tsx

import React, { useState, useContext, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TouchableWithoutFeedback,
  Keyboard,
  Platform,
  KeyboardAvoidingView,
  TextInput,
  Switch,
} from "react-native";
import { RouteProp, useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList, CartProduct } from "./navigationTypes";
import { useStripe } from "@stripe/stripe-react-native";
import { NGROK_URL } from "@env";
import { UserContext } from "./UserContext";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "react-native-vector-icons/Ionicons";

type PaymentScreenRouteProp = RouteProp<RootStackParamList, "Payment">;
type PaymentScreenProps = {
  route: PaymentScreenRouteProp;
};
type NavigationProp = StackNavigationProp<RootStackParamList, "Payment">;

const PaymentScreen: React.FC<PaymentScreenProps> = ({ route }) => {
  const { product } = route.params; // Only product is received
  const navigation = useNavigation<NavigationProp>();
  const { confirmPayment } = useStripe();
  const { userId, token } = useContext(UserContext); // Extract userId and token from context

  // Derive buyerId and sellerId
  const buyerId = userId; // Current authenticated user
  const sellerId = product.userId; // Correctly retrieve seller's ID from userId

  // Debugging Statements
  console.log("Buyer ID:", buyerId); // Should log authenticated user's ID
  console.log("Seller ID:", sellerId); // Should log product's userId
  console.log("Token:", token); // Should log the authentication token

  // Card states
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCVC, setCardCVC] = useState("");
  const [nameOnCard, setNameOnCard] = useState("");
  const [saveCardForFuture, setSaveCardForFuture] = useState(false);

  // Address fields
  const [addressLine1, setAddressLine1] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");

  // Errors
  const [addressLine1Error, setAddressLine1Error] = useState("");
  const [cityError, setCityError] = useState("");
  const [postalCodeError, setPostalCodeError] = useState("");
  const [nameOnCardError, setNameOnCardError] = useState("");
  const [cardNumberError, setCardNumberError] = useState("");
  const [cardExpiryError, setCardExpiryError] = useState("");
  const [cardCVCError, setCardCVCError] = useState("");

  const [loading, setLoading] = useState(false);

  const cardNumberRef = useRef<TextInput>(null);
  const cardExpiryRef = useRef<TextInput>(null);
  const cardCVCRef = useRef<TextInput>(null);
  const cardNameRef = useRef<TextInput>(null);

  // Validation Functions
  const validateNameOnCard = (): boolean => {
    if (!nameOnCard.trim()) {
      setNameOnCardError("Required.");
      return false;
    }
    setNameOnCardError("");
    return true;
  };

  const validateAddressLine1 = (): boolean => {
    if (!addressLine1.trim()) {
      setAddressLine1Error("Required.");
      return false;
    }
    setAddressLine1Error("");
    return true;
  };

  const validateCity = (): boolean => {
    if (!city.trim()) {
      setCityError("Required.");
      return false;
    }
    const cityRegex = /^[a-zA-Z\s]+$/;
    if (!cityRegex.test(city.trim())) {
      setCityError("Letters only.");
      return false;
    }
    setCityError("");
    return true;
  };

  const validatePostalCode = (): boolean => {
    if (!postalCode.trim()) {
      setPostalCodeError("Required.");
      return false;
    }
    const postalCodeRegex = /^[0-9]{5}(?:-[0-9]{4})?$/;
    if (!postalCodeRegex.test(postalCode.trim())) {
      setPostalCodeError("Invalid code.");
      return false;
    }
    setPostalCodeError("");
    return true;
  };

  const validateCardNumber = (): boolean => {
    const rawNum = cardNumber.replace(/\s+/g, "");
    if (rawNum.length < 13 || rawNum.length > 19) {
      setCardNumberError("Invalid card number.");
      return false;
    }
    setCardNumberError("");
    return true;
  };

  const validateCardExpiry = (): boolean => {
    const trimmed = cardExpiry.replace(/\s+/g, "");
    const match = /^(0[1-9]|1[0-2])\/?([0-9]{2})$/.exec(trimmed);
    if (!match) {
      setCardExpiryError("Invalid expiry.");
      return false;
    }
    setCardExpiryError("");
    return true;
  };

  const validateCardCVC = (): boolean => {
    const rawCvc = cardCVC.trim();
    if (rawCvc.length < 3 || rawCvc.length > 4) {
      setCardCVCError("Invalid CVC.");
      return false;
    }
    setCardCVCError("");
    return true;
  };

  // Formatting Functions
  const formatCardNumber = (input: string) => {
    const cleaned = input.replace(/\D+/g, "");
    let formatted = cleaned;
    if (formatted.length > 4) {
      formatted = formatted.slice(0, 4) + " " + formatted.slice(4);
    }
    if (formatted.length > 9) {
      formatted = formatted.slice(0, 9) + " " + formatted.slice(9);
    }
    if (formatted.length > 14) {
      formatted = formatted.slice(0, 14) + " " + formatted.slice(14);
    }
    return formatted;
  };

  const formatExpiry = (input: string) => {
    const cleaned = input.replace(/\D+/g, "");
    let formatted = cleaned;
    if (formatted.length > 2) {
      formatted = formatted.slice(0, 2) + "/" + formatted.slice(2, 4);
    }
    return formatted;
  };

  // Handle Payment Press
  const handlePayPress = async () => {
    const isNameValid = validateNameOnCard();
    const isAddressLine1Valid = validateAddressLine1();
    const isCityValid = validateCity();
    const isPostalCodeValid = validatePostalCode();
    const isCardNumValid = validateCardNumber();
    const isExpiryValid = validateCardExpiry();
    const isCVCValid = validateCardCVC();

    if (
      !isNameValid ||
      !isAddressLine1Valid ||
      !isCityValid ||
      !isPostalCodeValid ||
      !isCardNumValid ||
      !isExpiryValid ||
      !isCVCValid
    ) {
      Alert.alert("Invalid Input", "Please fix the errors and try again.");
      return;
    }

    if (!token || !buyerId || !sellerId || buyerId === "" || sellerId === "") {
      Alert.alert("Error", "Missing user information.");
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
          amount: Math.round(product.price * product.quantity * 100), // Amount in cents
          currency: "usd",
          productId: product.id,
          buyerId: buyerId,
          sellerId: sellerId,
        }),
      });

      const responseText = await response.text();

      if (!response.ok) {
        console.error("Error:", responseText);
        Alert.alert("Payment Error", "Failed to create payment intent.");
        setLoading(false);
        return;
      }

      let responseData;
      try {
        responseData = JSON.parse(responseText);
      } catch (parseError) {
        console.error("Parse Error:", parseError);
        Alert.alert("Error", "Invalid server response.");
        setLoading(false);
        return;
      }

      const { clientSecret, chatId, error } = responseData;
      if (error) {
        Alert.alert("Error", error);
        setLoading(false);
        return;
      }
      if (!clientSecret) {
        Alert.alert("Error", "No client secret returned.");
        setLoading(false);
        return;
      }

      // Extracting month/year from expiry
      const [expMonth, expYearShort] = cardExpiry.split("/");
      const expMonthNum = parseInt(expMonth, 10);
      const currentYear = new Date().getFullYear();
      const century = Math.floor(currentYear / 100) * 100;
      const expYearNum = century + parseInt(expYearShort, 10);

      const { paymentIntent, error: stripeError } = await confirmPayment(
        clientSecret,
        {
          paymentMethodType: "Card",
          paymentMethodData: {
            billingDetails: {
              name: nameOnCard.trim(),
              address: {
                line1: addressLine1.trim(),
                city: city.trim(),
                postalCode: postalCode.trim(),
              },
            },
            card: {
              number: cardNumber.replace(/\s+/g, ""),
              cvc: cardCVC.trim(),
              expMonth: expMonthNum,
              expYear: expYearNum,
            },
          },
        }
      );

      if (stripeError) {
        Alert.alert("Failed", stripeError.message);
      } else if (paymentIntent) {
        Alert.alert("Success", "Payment was successful!");
        navigation.navigate("Messaging", { chatId, userId: buyerId });
      }
    } catch (err) {
      console.error("Payment Error:", err);
      Alert.alert("Error", "Unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.container}>
          <Text style={styles.headerTitle}>Secure Payment</Text>

          {/* Realistic Credit Card UI */}
          <View style={styles.cardWrapper}>
            <LinearGradient
              colors={["#4e2d8f", "#a56be8"]}
              style={styles.cardBackground}
            >
              <View style={styles.chipContainer}>
                <View style={styles.chip} />
              </View>
              <Text style={styles.fakeBankName}>BANK NAME</Text>

              {/* Card Number Input (Positioned on Card) */}
              <TextInput
                ref={cardNumberRef}
                style={[styles.cardNumberInput, styles.cardTextInput]}
                keyboardType="numeric"
                maxLength={19}
                placeholder="-> Enter Card Number"
                placeholderTextColor="#ffffff90"
                value={cardNumber}
                onChangeText={(text) => {
                  const formatted = formatCardNumber(text);
                  setCardNumber(formatted);
                  if (cardNumberError) validateCardNumber();
                }}
                onBlur={validateCardNumber}
              />

              {/* Name on Card Input */}
              <TextInput
                ref={cardNameRef}
                style={[styles.nameInput, styles.cardTextInput]}
                placeholder="-> CARDHOLDER NAME"
                placeholderTextColor="#ffffff90"
                value={nameOnCard}
                onChangeText={(text) => {
                  setNameOnCard(text);
                  if (nameOnCardError) validateNameOnCard();
                }}
                onBlur={validateNameOnCard}
              />

              {/* Expiry Input */}
              <TextInput
                ref={cardExpiryRef}
                style={[styles.expiryInput, styles.cardTextInput]}
                placeholder="MM/YY"
                placeholderTextColor="#ffffff90"
                value={cardExpiry}
                maxLength={5}
                onChangeText={(text) => {
                  const formatted = formatExpiry(text);
                  setCardExpiry(formatted);
                  if (cardExpiryError) validateCardExpiry();
                }}
                onBlur={validateCardExpiry}
              />

              {/* CVC Input */}
              <TextInput
                ref={cardCVCRef}
                style={[styles.cvcInput, styles.cardTextInput]}
                placeholder="CVC"
                placeholderTextColor="#ffffff90"
                keyboardType="numeric"
                maxLength={4}
                value={cardCVC}
                onChangeText={(text) => {
                  setCardCVC(text);
                  if (cardCVCError) validateCardCVC();
                }}
                onBlur={validateCardCVC}
              />
            </LinearGradient>
          </View>

          {/* Errors for Card Fields if any */}
          {!!cardNumberError && (
            <Text style={styles.errorText}>{cardNumberError}</Text>
          )}
          {!!nameOnCardError && (
            <Text style={styles.errorText}>{nameOnCardError}</Text>
          )}
          {!!cardExpiryError && (
            <Text style={styles.errorText}>{cardExpiryError}</Text>
          )}
          {!!cardCVCError && (
            <Text style={styles.errorText}>{cardCVCError}</Text>
          )}

          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Billing Address</Text>

            <Text style={styles.inputLabel}>Address Line 1</Text>
            <TextInput
              style={styles.input}
              placeholder="123 Main St"
              placeholderTextColor="#999"
              value={addressLine1}
              onChangeText={(text) => {
                setAddressLine1(text);
                if (addressLine1Error) validateAddressLine1();
              }}
              onBlur={validateAddressLine1}
            />
            {addressLine1Error ? (
              <Text style={styles.errorText}>{addressLine1Error}</Text>
            ) : null}

            <View style={styles.row}>
              <View style={styles.halfInputContainer}>
                <Text style={styles.inputLabel}>City</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Seattle"
                  placeholderTextColor="#999"
                  value={city}
                  onChangeText={(text) => {
                    setCity(text);
                    if (cityError) validateCity();
                  }}
                  onBlur={validateCity}
                />
                {cityError ? (
                  <Text style={styles.errorText}>{cityError}</Text>
                ) : null}
              </View>
              <View style={styles.halfInputContainer}>
                <Text style={styles.inputLabel}>Postal</Text>
                <TextInput
                  style={styles.input}
                  placeholder="98101"
                  placeholderTextColor="#999"
                  keyboardType="numeric"
                  value={postalCode}
                  onChangeText={(text) => {
                    setPostalCode(text);
                    if (postalCodeError) validatePostalCode();
                  }}
                  onBlur={validatePostalCode}
                />
                {postalCodeError ? (
                  <Text style={styles.errorText}>{postalCodeError}</Text>
                ) : null}
              </View>
            </View>

            <View style={styles.saveCardContainer}>
              <Switch
                value={saveCardForFuture}
                onValueChange={setSaveCardForFuture}
                trackColor={{ false: "#3e3566", true: "#c5a3ff" }}
                thumbColor="#fff"
              />
              <Text style={styles.saveCardText}>
                Save card for future payments
              </Text>
            </View>
          </View>

          <View style={styles.summaryContainer}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total</Text>
              <Text style={styles.summaryAmount}>
                ${(product.price * product.quantity).toFixed(2)}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.payButton}
              onPress={handlePayPress}
              disabled={loading}
              accessibilityLabel="Pay Now"
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.payButtonText}>Pay Now</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
};

export default PaymentScreen;

// Stylesheet
const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flex: 1,
    backgroundColor: "black",
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#FFF",
    marginBottom: 20,
    marginTop: 10,
    textAlign: "center",
  },
  cardWrapper: {
    width: "100%",
    aspectRatio: 1.6,
    marginBottom: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  cardBackground: {
    width: "100%",
    height: "100%",
    borderRadius: 12,
    padding: 20,
    position: "relative",
  },
  chipContainer: {
    position: "absolute",
    top: 20,
    left: 20,
  },
  chip: {
    width: 40,
    height: 30,
    borderRadius: 4,
    backgroundColor: "#c5a3ff",
  },
  fakeBankName: {
    position: "absolute",
    top: 20,
    right: 20,
    color: "#fff",
    fontWeight: "700",
    fontSize: 12,
  },
  cardTextInput: {
    color: "#fff",
    fontWeight: "600",
  },
  cardNumberInput: {
    position: "absolute",
    bottom: "45%",
    left: 20,
    right: 20,
    fontSize: 18,
    letterSpacing: 2,
    padding: 0,
  },
  nameInput: {
    position: "absolute",
    bottom: "25%",
    left: 20,
    right: 100,
    fontSize: 12,
    letterSpacing: 1,
    padding: 0,
  },
  expiryInput: {
    position: "absolute",
    bottom: "25%",
    right: 70,
    width: 50,
    fontSize: 12,
    textAlign: "center",
    padding: 0,
  },
  cvcInput: {
    position: "absolute",
    bottom: "25%",
    right: 20,
    width: 40,
    fontSize: 12,
    textAlign: "center",
    padding: 0,
  },
  errorText: {
    color: "#FF6B6B",
    fontSize: 10,
    marginBottom: 5,
  },
  formSection: {
    backgroundColor: "#2a2440",
    borderRadius: 10,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#443e66",
  },
  sectionTitle: {
    color: "#c5a3ff",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 10,
  },
  inputLabel: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 5,
    marginTop: 10,
  },
  input: {
    backgroundColor: "#322d4f",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 8,
    fontSize: 14,
    color: "#fff",
    borderWidth: 1,
    borderColor: "#443e66",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  halfInputContainer: {
    flex: 1,
    marginRight: 10,
  },
  saveCardContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 15,
  },
  saveCardText: {
    marginLeft: 8,
    fontSize: 12,
    color: "#FFFFFF",
  },
  summaryContainer: {
    backgroundColor: "#2a2440",
    borderRadius: 10,
    padding: 20,
    borderWidth: 1,
    borderColor: "#443e66",
    marginBottom: 40,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  summaryLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  summaryAmount: {
    fontSize: 16,
    fontWeight: "700",
    color: "#c5a3ff",
  },
  payButton: {
    backgroundColor: "white",
    paddingVertical: 12,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  payButtonText: {
    color: "black",
    fontSize: 14,
    fontWeight: "700",
  },
});
