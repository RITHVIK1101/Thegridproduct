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
  Animated,
  Easing,
  Dimensions
} from "react-native";
import { RouteProp, useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "./navigationTypes";
import { useStripe } from "@stripe/stripe-react-native";
import { NGROK_URL } from "@env";
import { UserContext } from "./UserContext";
import { LinearGradient } from "expo-linear-gradient";

type PaymentScreenRouteProp = RouteProp<RootStackParamList, "Payment">;
type PaymentScreenProps = {
  route: PaymentScreenRouteProp;
};
type NavigationProp = StackNavigationProp<RootStackParamList, "Payment">;

const screenWidth = Dimensions.get("window").width;

const PaymentScreen: React.FC<PaymentScreenProps> = ({ route }) => {
  const { product } = route.params;
  const navigation = useNavigation<NavigationProp>();
  const { confirmPayment } = useStripe();
  const { userId, token } = useContext(UserContext);

  const buyerId = userId;
  const sellerId = product.userId;

  // States
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCVC, setCardCVC] = useState("");
  const [nameOnCard, setNameOnCard] = useState("");
  const [saveCardForFuture, setSaveCardForFuture] = useState(false);
  const [addressLine1, setAddressLine1] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");

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

  const [errorMessage, setErrorMessage] = useState("");

  // Animated error toast
  const errorOpacity = useRef(new Animated.Value(0)).current;

  const showError = (msg: string) => {
    setErrorMessage(msg);
    Animated.timing(errorOpacity, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
      easing: Easing.out(Easing.ease),
    }).start(() => {
      setTimeout(() => {
        Animated.timing(errorOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
          easing: Easing.in(Easing.ease),
        }).start(() => {
          setErrorMessage("");
        });
      }, 2500);
    });
  };

  // Validation Functions
  const validateNameOnCard = (): boolean => {
    if (!nameOnCard.trim()) {
      setNameOnCardError("Name required.");
      return false;
    }
    setNameOnCardError("");
    return true;
  };

  const validateAddressLine1 = (): boolean => {
    if (!addressLine1.trim()) {
      setAddressLine1Error("Address required.");
      return false;
    }
    setAddressLine1Error("");
    return true;
  };

  const validateCity = (): boolean => {
    if (!city.trim()) {
      setCityError("City required.");
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
      setPostalCodeError("Postal code required.");
      return false;
    }
    const postalCodeRegex = /^[0-9]{5}(?:-[0-9]{4})?$/;
    if (!postalCodeRegex.test(postalCode.trim())) {
      setPostalCodeError("Invalid postal code.");
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

  // Formatting
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
      showError("Please enter all details before paying.");
      return;
    }

    if (!token || !buyerId || !sellerId || buyerId === "" || sellerId === "") {
      showError("Missing user information.");
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

      if (!response.ok) {
        console.error("Error:", responseText);
        showError("Failed to create payment intent.");
        setLoading(false);
        return;
      }

      let responseData;
      try {
        responseData = JSON.parse(responseText);
      } catch (parseError) {
        console.error("Parse Error:", parseError);
        showError("Invalid server response.");
        setLoading(false);
        return;
      }

      const { clientSecret, chatId, error } = responseData;
      if (error) {
        showError(error);
        setLoading(false);
        return;
      }
      if (!clientSecret) {
        showError("No client secret returned.");
        setLoading(false);
        return;
      }

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
        showError(stripeError.message || "Payment failed.");
      } else if (paymentIntent) {
        Alert.alert("Success", "Payment was successful!", [
          { text: "OK", onPress: () => navigation.navigate("Messaging", { chatId, userId: buyerId }) }
        ]);
      }
    } catch (err) {
      console.error("Payment Error:", err);
      showError("Unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={["#1c1b2a", "#0c0b10"]}
      style={styles.gradientBackground}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.container}>
            {/* Error Toast */}
            {errorMessage ? (
              <Animated.View
                style={[
                  styles.errorToast,
                  { opacity: errorOpacity, transform: [{ translateY: errorOpacity.interpolate({ inputRange: [0, 1], outputRange: [-50, 0] })}] }
                ]}
              >
                <Text style={styles.errorToastText}>{errorMessage}</Text>
              </Animated.View>
            ) : null}

            {/* Modern Credit Card UI */}
            <View style={styles.cardWrapper}>
              <LinearGradient
                colors={["#36315c", "#2e2849"]}
                style={styles.cardBackground}
              >
                {/* A subtle pattern or chip */}
                <View style={styles.chipContainer}>
                  <View style={styles.chip} />
                </View>
                {/* Card Number Input */}
                <TextInput
                  ref={cardNumberRef}
                  style={[styles.cardNumberInput, styles.cardTextInput]}
                  keyboardType="numeric"
                  maxLength={19}
                  placeholder="#### #### #### ####"
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
                  placeholder="CARDHOLDER NAME"
                  placeholderTextColor="#ffffff60"
                  value={nameOnCard}
                  onChangeText={(text) => {
                    setNameOnCard(text);
                    if (nameOnCardError) validateNameOnCard();
                  }}
                  onBlur={validateNameOnCard}
                />

                {/* Expiry and CVC Row */}
                <View style={styles.expCvcRow}>
                  <TextInput
                    ref={cardExpiryRef}
                    style={[styles.expiryInput, styles.cardTextInput]}
                    placeholder="MM/YY"
                    placeholderTextColor="#ffffff60"
                    value={cardExpiry}
                    maxLength={5}
                    onChangeText={(text) => {
                      const formatted = formatExpiry(text);
                      setCardExpiry(formatted);
                      if (cardExpiryError) validateCardExpiry();
                    }}
                    onBlur={validateCardExpiry}
                  />

                  <TextInput
                    ref={cardCVCRef}
                    style={[styles.cvcInput, styles.cardTextInput]}
                    placeholder="CVC"
                    placeholderTextColor="#ffffff60"
                    keyboardType="numeric"
                    maxLength={4}
                    value={cardCVC}
                    onChangeText={(text) => {
                      setCardCVC(text);
                      if (cardCVCError) validateCardCVC();
                    }}
                    onBlur={validateCardCVC}
                  />
                </View>
              </LinearGradient>
            </View>

            {/* Billing Form */}
            <View style={styles.formSection}>
              <Text style={styles.sectionTitle}>Billing Address</Text>

              <Text style={styles.inputLabel}>Street Address</Text>
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
              {/* Errors not shown inline to prevent shifting, errors shown in toast */}

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
                </View>
              </View>

              <View style={styles.saveCardContainer}>
                <Switch
                  value={saveCardForFuture}
                  onValueChange={setSaveCardForFuture}
                  trackColor={{ false: "#3e3566", true: "#a56be8" }}
                  thumbColor="#fff"
                />
                <Text style={styles.saveCardText}>
                  Save card for future use
                </Text>
              </View>
            </View>

            {/* Payment Summary */}
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
    </LinearGradient>
  );
};

export default PaymentScreen;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gradientBackground: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingVertical: 30,
    paddingHorizontal: 20,
  },
  errorToast: {
    position: "absolute",
    top: 0,
    left: 0,
    width: screenWidth,
    paddingVertical: 15,
    backgroundColor: "#FF6B6B",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
  },
  errorToastText: {
    color: "#fff",
    fontWeight: "700",
    textAlign: "center",
  },
  cardWrapper: {
    width: "100%",
    aspectRatio: 1.8,
    marginBottom: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  cardBackground: {
    width: "100%",
    height: "100%",
    borderRadius: 16,
    padding: 20,
    position: "relative",
  },
  chipContainer: {
    position: "absolute",
    top: 25,
    left: 25,
  },
  chip: {
    width: 40,
    height: 30,
    borderRadius: 4,
    backgroundColor: "#d3c0ff",
  },
  cardTextInput: {
    color: "#fff",
    fontWeight: "600",
  },
  cardNumberInput: {
    marginTop: 40,
    fontSize: 18,
    letterSpacing: 2,
    padding: 0,
  },
  nameInput: {
    marginTop: 25,
    fontSize: 14,
    letterSpacing: 1,
    padding: 0,
    width: "65%",
  },
  expCvcRow: {
    flexDirection: "row",
    marginTop: 20,
    width: "50%",
    justifyContent: "space-between",
  },
  expiryInput: {
    fontSize: 14,
    letterSpacing: 1,
    padding: 0,
    width: 60,
    textAlign: "center",
  },
  cvcInput: {
    fontSize: 14,
    letterSpacing: 1,
    padding: 0,
    width: 50,
    textAlign: "center",
  },
  formSection: {
    backgroundColor: "#211b33",
    borderRadius: 10,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#443e66",
  },
  sectionTitle: {
    color: "#a56be8",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 10,
    letterSpacing: 1,
  },
  inputLabel: {
    color: "#ddd",
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
    letterSpacing: 0.5,
  },
  summaryContainer: {
    backgroundColor: "#211b33",
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
    backgroundColor: "#a56be8",
    paddingVertical: 12,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  payButtonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 1,
  },
});
