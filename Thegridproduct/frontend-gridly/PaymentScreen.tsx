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
  Dimensions,
} from "react-native";
import { useStripe, CardField } from "@stripe/stripe-react-native";
import { useNavigation } from "@react-navigation/native";
import { UserContext } from "./UserContext";
import { NGROK_URL } from "@env";
import { LinearGradient } from "expo-linear-gradient";

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

const screenWidth = Dimensions.get("window").width;

const PaymentScreen: React.FC<PaymentScreenProps> = ({ route }) => {
  const { product } = route.params;
  const navigation = useNavigation();
  const { confirmPayment } = useStripe();
  const { userId, token } = useContext(UserContext);

  const buyerId = userId;
  const sellerId = product.sellerId;

  // Billing Address States
  const [nameOnCard, setNameOnCard] = useState("");
  const [saveCardForFuture, setSaveCardForFuture] = useState(false);
  const [addressLine1, setAddressLine1] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");

  // Validation Error States
  const [addressLine1Error, setAddressLine1Error] = useState("");
  const [cityError, setCityError] = useState("");
  const [postalCodeError, setPostalCodeError] = useState("");
  const [nameOnCardError, setNameOnCardError] = useState("");

  // Loading and Error States
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Animated error toast
  const errorOpacity = useRef(new Animated.Value(0)).current;

  // Card Details from CardField
  const [cardDetails, setCardDetails] = useState<any>(null);

  // Show Animated Error Toast
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

  // Handle Payment Press
  const handlePayPress = async () => {
    // Validate Billing Fields
    const isNameValid = validateNameOnCard();
    const isAddressValid = validateAddressLine1();
    const isCityValid = validateCity();
    const isPostalCodeValid = validatePostalCode();

    if (!isNameValid || !isAddressValid || !isCityValid || !isPostalCodeValid) {
      showError("Please enter all billing details correctly.");
      return;
    }

    // Validate Card Details
    if (!cardDetails || !cardDetails.complete) {
      showError("Please enter complete card details.");
      return;
    }

    if (!token || !buyerId || !sellerId) {
      showError("Missing user information.");
      return;
    }

    setLoading(true);
    console.log("Sending request to backend to create PaymentIntent...");

    try {
      // 1) Create PaymentIntent on your backend
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
          saveCard: saveCardForFuture,
          billingDetails: {
            name: nameOnCard.trim(),
            address: {
              line1: addressLine1.trim(),
              city: city.trim(),
              postal_code: postalCode.trim(),
            },
          },
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

      // 2) Confirm the payment with Stripe
      const { paymentIntent, error } = await confirmPayment(clientSecret, {
        paymentMethodType: "Card",
        // Optionally, you can pass additional billing details if needed
        billingDetails: {
          name: nameOnCard.trim(),
          address: {
            line1: addressLine1.trim(),
            city: city.trim(),
            postal_code: postalCode.trim(),
          },
        },
      });

      console.log("Stripe confirmPayment result:", { paymentIntent, error });

      if (error) {
        showError(error.message || "Payment failed.");
      } else if (paymentIntent) {
        console.log("Payment successful:", paymentIntent);
        Alert.alert("Success", "Payment was successful!", [
          {
            text: "OK",
            onPress: () => navigation.navigate("MessagingScreen", { chatId }),
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
                  {
                    opacity: errorOpacity,
                    transform: [
                      {
                        translateY: errorOpacity.interpolate({
                          inputRange: [0, 1],
                          outputRange: [-50, 0],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <Text style={styles.errorToastText}>{errorMessage}</Text>
              </Animated.View>
            ) : null}

            {/* Billing Form */}
            <View style={styles.formSection}>
              <Text style={styles.sectionTitle}>Billing Address</Text>

              <Text style={styles.inputLabel}>Name on Card</Text>
              <TextInput
                style={styles.input}
                placeholder="John Doe"
                placeholderTextColor="#999"
                value={nameOnCard}
                onChangeText={(text) => {
                  setNameOnCard(text);
                  if (nameOnCardError) validateNameOnCard();
                }}
                onBlur={validateNameOnCard}
              />

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
                  <Text style={styles.inputLabel}>Postal Code</Text>
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

            {/* Card Information */}
            <View style={styles.cardWrapper}>
              <LinearGradient
                colors={["#36315c", "#2e2849"]}
                style={styles.cardBackground}
              >
                {/* Card Chip or Logo */}
                <View style={styles.chipContainer}>
                  <View style={styles.chip} />
                </View>

                {/* Stripe's CardField */}
                <CardField
                  postalCodeEnabled={false}
                  placeholders={{
                    number: "4242 4242 4242 4242",
                  }}
                  cardStyle={{
                    backgroundColor: "#ffffff",
                    textColor: "#000000",
                    borderColor: "#443e66",
                  }}
                  style={styles.cardField}
                  onCardChange={(details) => {
                    setCardDetails(details);
                  }}
                />
              </LinearGradient>
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

// Styles
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
  cardField: {
    height: 50,
    marginTop: 20,
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
