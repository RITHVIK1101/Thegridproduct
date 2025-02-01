// TermsOfServiceContent.tsx

import React from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";

const TermsOfServiceContent: React.FC = () => {
  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll}>
        <Text style={styles.heading}>Gridly Terms of Service</Text>

        <Text style={styles.subHeading}>1. Introduction</Text>
        <Text style={styles.text}>
          Welcome to Gridly! Gridly is a college marketplace platform that
          enables students, faculty, and staff to buy, sell, rent, and access a
          variety of services and products. By accessing or using our platform,
          you agree to be bound by these Terms of Service. Please read them
          carefully.
        </Text>

        <Text style={styles.subHeading}>2. Eligibility</Text>
        <Text style={styles.text}>
          Gridly is intended for use by members of the college community. By
          using our platform, you represent that you are at least 18 years of
          age and have the necessary authority to enter into these terms.
        </Text>

        <Text style={styles.subHeading}>3. User Accounts</Text>
        <Text style={styles.text}>
          To access certain features of Gridly, you may be required to create an
          account. You agree to provide accurate, current, and complete
          information during registration and to update such information as
          needed. You are responsible for maintaining the confidentiality of
          your account credentials and for all activities that occur under your
          account.
        </Text>

        <Text style={styles.subHeading}>4. Platform Use</Text>
        <Text style={styles.text}>
          Gridly provides a platform for users to list products and services for
          sale, rent, or exchange, as well as to purchase or access these
          offerings. You agree to use Gridly only for lawful purposes and in
          accordance with these Terms. Prohibited activities include, but are
          not limited to, fraudulent listings, misrepresentation of products or
          services, and any activities that could harm the reputation or
          operation of the platform.
        </Text>

        <Text style={styles.subHeading}>5. Listings and Transactions</Text>
        <Text style={styles.text}>
          All listings on Gridly are the responsibility of the individual users
          who post them. Gridly does not endorse, guarantee, or assume
          responsibility for the accuracy or reliability of any listing,
          product, or service. Transactions conducted through Gridly are
          strictly between the buyer and the seller or service provider. We
          recommend exercising caution and using common sense when interacting
          with other users.
        </Text>

        <Text style={styles.subHeading}>6. Fees and Payment</Text>
        <Text style={styles.text}>
          While Gridly strives to offer a free and accessible platform, certain
          transactions may incur fees or service charges. Any fees will be
          clearly disclosed prior to the completion of a transaction. Payments
          processed through the platform are subject to the terms and conditions
          of the payment provider.
        </Text>

        <Text style={styles.subHeading}>7. Intellectual Property</Text>
        <Text style={styles.text}>
          All content on Gridly, including text, graphics, logos, and images, is
          the property of Gridly or its licensors. You agree not to reproduce,
          duplicate, copy, sell, resell, or exploit any portion of the service
          without prior written permission.
        </Text>

        <Text style={styles.subHeading}>8. User Conduct</Text>
        <Text style={styles.text}>
          You agree to use Gridly responsibly and not engage in any activity
          that may harm other users or the platform. This includes, but is not
          limited to, spamming, harassment, distributing malware, or engaging in
          fraudulent behavior.
        </Text>

        <Text style={styles.subHeading}>
          9. Disclaimers and Limitation of Liability
        </Text>
        <Text style={styles.text}>
          Gridly is provided on an "as is" and "as available" basis without
          warranties of any kind. In no event shall Gridly be liable for any
          indirect, incidental, special, or consequential damages arising out of
          or in connection with your use of the platform. You acknowledge that
          you use Gridly at your own risk.
        </Text>

        <Text style={styles.subHeading}>10. Changes to Terms</Text>
        <Text style={styles.text}>
          Gridly reserves the right to modify these Terms of Service at any
          time. Updated terms will be posted on the platform, and your continued
          use of Gridly after any changes constitutes your acceptance of the
          revised terms.
        </Text>

        <Text style={styles.subHeading}>11. Governing Law</Text>
        <Text style={styles.text}>
          These Terms of Service shall be governed by and construed in
          accordance with the laws applicable to the college community and the
          jurisdiction in which Gridly operates. Any disputes arising under or
          in connection with these Terms shall be resolved through binding
          arbitration or in the appropriate courts.
        </Text>

        <Text style={styles.subHeading}>12. Contact Information</Text>
        <Text style={styles.text}>
          If you have any questions regarding these Terms of Service, please
          contact us at thegridly@gmail.com.
        </Text>

        <Text style={styles.text}>
          {"\n"}By using Gridly, you acknowledge that you have read, understood,
          and agree to these Terms of Service.
        </Text>
      </ScrollView>
    </View>
  );
};

export default TermsOfServiceContent;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    padding: 20,
  },
  scroll: {
    flexGrow: 1,
  },
  heading: {
    color: "#fff",
    fontSize: 26,
    fontWeight: "700",
    marginBottom: 20,
    textAlign: "center",
  },
  subHeading: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "600",
    marginTop: 20,
    marginBottom: 10,
  },
  text: {
    color: "#ccc",
    fontSize: 16,
    lineHeight: 24,
  },
});
