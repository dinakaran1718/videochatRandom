import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
  SafeAreaView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { database } from '../Services/Firebase';

const avatarImages = [
  require('../assets/avatar1.png'),
  require('../assets/avatar2.png'),
  require('../assets/avatar3.png'),
  require('../assets/avatar4.png'),
];

const generateFallbackId = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

const StartScreen = () => {
  const [userId, setUserId] = useState(null);
  const [isReady, setIsReady] = useState(false);
  const [isInChat, setIsInChat] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState(null);
  const navigation = useNavigation();

  useEffect(() => {
    const initializeUser = async () => {
      try {
        console.log('Initializing user');
        let storedUserId = await AsyncStorage.getItem('userId');
        if (!storedUserId) {
          storedUserId = generateFallbackId();
          await AsyncStorage.setItem('userId', storedUserId);
        }
        setUserId(storedUserId);

        // Fetch avatar data from Firebase (new reference 'avatars')
        const avatarSnapshot = await database().ref(`avatars/${storedUserId}`).once('value');
        const avatarData = avatarSnapshot.val();
        
        if (avatarData && avatarData.avatar !== undefined) {
          setSelectedAvatar(avatarData.avatar);
        }

        setIsReady(true);
        console.log('User initialized:', storedUserId);
      } catch (error) {
        console.error('Failed to initialize user:', error);
        Alert.alert('Error', 'Failed to initialize user. Please restart the app.');
      }
    };

    initializeUser();
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!userId) return;

      console.log('Setting up Firebase listeners for user:', userId);
      const userRef = database().ref(`users/${userId}`);

      const handleDisconnect = () => {
        console.log('Handling disconnect for user:', userId);
        userRef.update({ status: 'offline' });
      };

      userRef.onDisconnect().update({ status: 'offline' });

      const checkUserStatus = async () => {
        try {
          const snapshot = await userRef.once('value');
          const userData = snapshot.val();
          console.log('Current user data:', userData);
          if (userData && userData.status === 'in_chat' && userData.partnerId) {
            console.log('User is already in chat, navigating to ChatScreen');
            setIsInChat(true);
            navigation.navigate('ChatScreen', { userId, partnerId: userData.partnerId });
          } else {
            console.log('User is not in chat, updating status to online');
            await userRef.update({ status: 'online' });
            setIsInChat(false);
          }
        } catch (error) {
          console.error('Error checking user status:', error);
          Alert.alert('Error', 'Failed to check user status. Please try again.');
        }
      };

      checkUserStatus();

      const handleStatusChange = (snapshot) => {
        const userData = snapshot.val();
        console.log('User status changed:', userData);
        if (userData && userData.status === 'in_chat' && userData.partnerId) {
          console.log('User entered chat, navigating to ChatScreen');
          navigation.navigate('ChatScreen', { userId, partnerId: userData.partnerId });
        }
      };

      userRef.on('value', handleStatusChange);

      return () => {
        console.log('Cleaning up Firebase listeners');
        handleDisconnect();
        userRef.off('value', handleStatusChange);
      };
    }, [userId, navigation])
  );

  const saveAvatarSelection = async (avatarIndex) => {
    setSelectedAvatar(avatarIndex);
    if (userId) {
      try {
        // Save avatar selection in a new database reference, for example, 'avatars'
        await database().ref(`avatars/${userId}`).set({
          avatar: avatarIndex,
        });
        console.log('Avatar selection saved in the new reference');
      } catch (error) {
        console.error('Error saving avatar selection:', error);
        Alert.alert('Error', 'Failed to save avatar selection. Please try again.');
      }
    }
  };

  const startChatting = async () => {
    if (!userId || isLoading) {
      console.log('Cannot start chatting: userId not set or already loading');
      return;
    }

    if (selectedAvatar === null) {
      Alert.alert('Avatar Required', 'Please select an avatar before starting a chat.');
      return;
    }

    console.log('Starting chat process for user:', userId);
    setIsLoading(true);
    const userRef = database().ref(`users/${userId}`);
    
    try {
      await userRef.update({ 
        status: 'waiting'
      });
      console.log('Updated user status to waiting');
      findChatPartner(userId);
    } catch (error) {
      console.error('Error updating user status:', error);
      setIsLoading(false);
      Alert.alert('Error', 'Failed to start chatting. Please try again.');
    }
  };

  const findChatPartner = async (currentUserId) => {
    console.log('Finding chat partner for user:', currentUserId);
    const waitingUserRef = database().ref('users').orderByChild('status').equalTo('waiting');
    
    try {
      const snapshot = await waitingUserRef.once('value');
      const users = snapshot.val();
      if (users) {
        const availableUsers = Object.entries(users)
          .filter(([key]) => key !== currentUserId)
          .sort(() => Math.random() - 0.5);

        if (availableUsers.length > 0) {
          const [partnerId] = availableUsers[0];
          console.log('Selected partner:', partnerId);
          await connectUsers(currentUserId, partnerId);
        } else {
          console.log('No available users, waiting for partner');
          await waitForPartner(currentUserId);
        }
      } else {
        console.log('No waiting users found, waiting for partner');
        await waitForPartner(currentUserId);
      }
    } catch (error) {
      console.error('Error finding chat partner:', error);
      await database().ref(`users/${currentUserId}`).update({ status: 'online' });
      setIsLoading(false);
      Alert.alert('Error', 'Failed to find a chat partner. Please try again.');
    }
  };

  const waitForPartner = (currentUserId) => {
    const userRef = database().ref(`users/${currentUserId}`);
    return new Promise((resolve) => {
      const onUserUpdate = (snapshot) => {
        const userData = snapshot.val();
        if (userData && userData.status === 'in_chat' && userData.partnerId) {
          userRef.off('value', onUserUpdate);
          resolve();
        }
      };
      userRef.on('value', onUserUpdate);
    });
  };

  const connectUsers = async (user1Id, user2Id) => {
    console.log('Connecting users:', user1Id, user2Id);
    const chatId = [user1Id, user2Id].sort().join('_');
    const batch = {};
    batch[`users/${user1Id}`] = { status: 'in_chat', partnerId: user2Id, chatId };
    batch[`users/${user2Id}`] = { status: 'in_chat', partnerId: user1Id, chatId };
    batch[`chats/${chatId}/metadata`] = { createdAt: database.ServerValue.TIMESTAMP };

    try {
      await database().ref().update(batch);
      console.log('Users connected successfully');
      setIsLoading(false);
      navigation.navigate('ChatScreen', { userId: user1Id, partnerId: user2Id });
    } catch (error) {
      console.error('Error connecting users:', error);
      await database().ref(`users/${user1Id}`).update({ status: 'online' });
      await database().ref(`users/${user2Id}`).update({ status: 'online' });
      setIsLoading(false);
      Alert.alert('Error', 'Failed to connect with a chat partner. Please try again.');
    }
  };

  if (!isReady) {
    return (
      <LinearGradient colors={['#4c669f', '#3b5998', '#192f6a']} style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ffffff" />
      </LinearGradient>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient colors={['#4c669f', '#3b5998', '#192f6a']} style={styles.container}>
        <Text style={styles.headerText}>Start Chatting</Text>
        
        <View style={styles.avatarContainer}>
          {avatarImages.map((avatar, index) => (
            <TouchableOpacity key={index} onPress={() => saveAvatarSelection(index)}>
              <Image
                source={avatar}
                style={[
                  styles.avatar,
                  selectedAvatar === index && styles.selectedAvatar
                ]}
              />
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.startButton} onPress={startChatting}>
          {isLoading ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text style={styles.startButtonText}>Let's Start</Text>
          )}
        </TouchableOpacity>

        {isInChat && (
          <View style={styles.statusContainer}>
            <Ionicons name="chatbubbles" size={20} color="#ffffff" />
            <Text style={styles.statusText}>You are currently in a chat session</Text>
          </View>
        )}
      </LinearGradient>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#192f6a',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  headerText: {
    fontSize: 24,
    color: '#ffffff',
    marginBottom: 30,
  },
  avatarContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 20,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginHorizontal: 10,
    borderWidth: 3,
    opacity:0.5,
    borderColor: 'transparent',
  },
  selectedAvatar: {
    
    opacity:1,
    borderColor: 'lightgreen',
  },
  startButton: {
    backgroundColor: '#3b5998',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
    marginTop: 20,
  },
  startButtonText: {
    color: '#ffffff',
    fontSize: 18,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  statusText: {
    color: '#ffffff',
    marginLeft: 8,
  },
});

export default StartScreen;
