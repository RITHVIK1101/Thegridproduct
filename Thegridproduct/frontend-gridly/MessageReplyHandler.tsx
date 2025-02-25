import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";

interface MessageReplyHandlerProps {
  replyToMessage: { content: string; senderName: string } | null;
  onCancelReply: () => void;
  setNewMessage: React.Dispatch<React.SetStateAction<string>>; // Add setNewMessage prop
}

const MessageReplyHandler: React.FC<MessageReplyHandlerProps> = ({
  replyToMessage,
  onCancelReply,
  setNewMessage,
}) => {
  if (!replyToMessage) return null;

  return (
    <View style={styles.replyContainer}>
      <View style={styles.replyIndicator} />
      <View style={styles.replyContent}>
        <Text style={styles.replySender}>Replying to {replyToMessage.senderName}</Text>
        <Text style={styles.replyText} numberOfLines={1}>
          {replyToMessage.content}
        </Text>
      </View>
      <Pressable
        onPress={() => {
          onCancelReply();
          setNewMessage(""); // Ensure input is cleared
        }}
        style={styles.cancelReply}
      >
        <Ionicons name="close" size={20} color="#FFF" />
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  replyContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#333",
    padding: 10,
    borderRadius: 10,
    marginHorizontal: 10,
    marginBottom: 5,
  },
  replyIndicator: {
    width: 4,
    height: "100%",
    backgroundColor: "#BB86FC",
    borderRadius: 2,
    marginRight: 8,
  },
  replyContent: {
    flex: 1,
  },
  replySender: {
    color: "#BB86FC",
    fontWeight: "bold",
    fontSize: 14,
  },
  replyText: {
    color: "#FFFFFF",  // Set to pure white for better contrast
    fontSize: 14,
    opacity: 1,  // Remove opacity if you want solid text
  },
  
  cancelReply: {
    padding: 5,
  },
});

export default MessageReplyHandler;
