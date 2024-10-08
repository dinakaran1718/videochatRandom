import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const ChatMessage = ({ message, isSender }) => {
  return (
    <View style={[styles.messageContainer, isSender ? styles.sender : styles.receiver]}>
      <Text style={[styles.text, isSender ? styles.senderText : styles.receiverText]}>
        {message.text}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  messageContainer: {
    padding: 10,
    borderRadius: 20,
    marginVertical: 5,
    maxWidth: '80%',
  },
  sender: {
    backgroundColor: '#0084FF', // Facebook Messenger blue
    alignSelf: 'flex-end',
    borderBottomRightRadius: 0,
  },
  receiver: {
    backgroundColor: '#E4E6EB', // Light gray
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 0,
  },
  text: {
    fontSize: 16,
  },
  senderText: {
    color: 'white',
  },
  receiverText: {
    color: 'black',
  },
});

export default ChatMessage;