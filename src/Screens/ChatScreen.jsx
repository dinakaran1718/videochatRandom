import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StatusBar,
  Animated,
  Dimensions,
  Image,
  Alert,
  Modal
} from 'react-native';
import { database } from '../Services/Firebase';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import {
  createAgoraRtcEngine,
  ChannelProfileType,
  ClientRoleType,
  RtcSurfaceView,
} from 'react-native-agora';

import { PermissionsAndroid } from 'react-native';

const appId = 'b389de6c524d45668be2f15e1144b489';
const token = '007eJxTYNhbtn3t8SkHs/5IKKxR3PKjnOH92muJGhcv3dQ28J/9QcNMgSHJ2MIyJdUs2dTIJMXE1MzMIinVKM3QNNXQ0MQkycTCMuAhc3pDICODxPS5TIwMEAjiszEUJeal5OcyMAAAETkhEw==';
const channelName = 'random';
const uid = 0;

const { width } = Dimensions.get('window');

const avatarImages = [
  require('../assets/avatar1.png'),
  require('../assets/avatar2.png'),
  require('../assets/avatar3.png'),
  require('../assets/avatar4.png'),
];

const defaultAvatar = require('../assets/default-avatar.png');

const ChatMessage = React.memo(({ message, isSender, animationDelay }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(isSender ? 50 : -50)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        delay: animationDelay,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        tension: 40,
        delay: animationDelay,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim, animationDelay]);

  const bubbleStyle = useMemo(() => [
    styles.messageBubble,
    isSender ? styles.senderBubble : styles.receiverBubble,
    { opacity: fadeAnim, transform: [{ translateX: slideAnim }] },
  ], [isSender, fadeAnim, slideAnim]);

  const textStyle = useMemo(() => [
    styles.messageText,
    isSender ? styles.senderText : styles.receiverText
  ], [isSender]);

  return (
    <Animated.View style={bubbleStyle}>
      <Text style={textStyle}>{message.text}</Text>
    </Animated.View>
  );
});

const TypingIndicator = () => (
  <View style={[styles.messageBubble, styles.receiverBubble, styles.typingIndicator]}>
    <Text style={styles.typingText}>typing</Text>
    <View style={styles.dotContainer}>
      <View style={[styles.dot, styles.dot1]} />
      <View style={[styles.dot, styles.dot2]} />
      <View style={[styles.dot, styles.dot3]} />
    </View>
  </View>
);

const ChatScreen = ({ route }) => {
  const { userId, partnerId: initialPartnerId } = route.params;
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState('Connecting...');
  const [isLoading, setIsLoading] = useState(true);
  const [showSearchingPopup, setShowSearchingPopup] = useState(false);
  const [partnerId, setPartnerId] = useState(initialPartnerId);
  const [isSearching, setIsSearching] = useState(false);
  const [showConnectedMessage, setShowConnectedMessage] = useState(false);
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);
  const [partnerAvatar, setPartnerAvatar] = useState(defaultAvatar);
  const flatListRef = useRef(null);
  const navigation = useNavigation();
  const chatId = useRef(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const typingTimeout = useRef(null);

  const agoraEngineRef = useRef(null);
  const [isJoined, setIsJoined] = useState(false);
  const [remoteUid, setRemoteUid] = useState(0);
  const eventHandler = useRef(null);
  
  const [isIncomingCall, setIsIncomingCall] = useState(false);
  const [isInCall, setIsInCall] = useState(false);
  const [callerId, setCallerId] = useState(null);
  const [hasHandledIncomingCall, setHasHandledIncomingCall] = useState(false);




  useEffect(() => {
    const callsRef = database().ref(`calls/${userId}`);
    
    callsRef.on('value', (snapshot) => {
      const callData = snapshot.val();
      if (callData && callData.type === 'incoming' && !isInCall) {
        setIsIncomingCall(true);
        setCallerId(callData.caller);
      } else if (callData && callData.status === 'accepted') {
        setIsInCall(true);
        setIsIncomingCall(false);
      } else if (callData && callData.status === 'declined' || callData === null) {
        setIsInCall(false);
        setIsIncomingCall(false);
        leave();
      }
    });
  
    return () => callsRef.off();
  }, [userId, isInCall]);




  const requestPermissions = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.CAMERA,
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        ]);
        
        if (
          granted['android.permission.CAMERA'] === PermissionsAndroid.RESULTS.GRANTED &&
          granted['android.permission.RECORD_AUDIO'] === PermissionsAndroid.RESULTS.GRANTED
        ) {
          console.log('Permissions granted');
          return true;
        } else {
          console.log('All permissions not granted');
          return false;
        }
      } catch (err) {
        console.warn(err);
        return false;
      }
    } else if (Platform.OS === 'ios') {
      // For iOS, permissions are typically handled when the app is installed
      // You might want to add specific iOS permission checks here if needed
      return true;
    }
    return false;
  };


  const checkAndRequestPermissions = async () => {
    const hasPermissions = await requestPermissions();
    if (!hasPermissions) {
      Alert.alert(
        "Permissions Required",
        "Camera and microphone permissions are required for video calls.",
        [{ text: "OK" }]
      );
    }
    return hasPermissions;
  };













  












  const handleVideoCall = async () => {
    const permissionGranted = await checkAndRequestPermissions();
    if (permissionGranted && connectionStatus === 'Connected') {
      database()
        .ref(`calls/${partnerId}`)
        .set({
          caller: userId,
          type: 'incoming',
          timestamp: database.ServerValue.TIMESTAMP,
        });
      
      await join();
    }
  };

  const handleAcceptCall = useCallback(async () => {
    const permissionGranted = await checkAndRequestPermissions();
    if (permissionGranted) {
      setIsIncomingCall(false);
      setIsInCall(true);
      setHasHandledIncomingCall(true);
      
      await database()
        .ref(`calls/${callerId}/status`)
        .set('accepted');
        
      await join();
    } else {
      handleDeclineCall();
    }
  }, [callerId]);


  const handleDeclineCall = useCallback(() => {
    setIsIncomingCall(false);
    setHasHandledIncomingCall(true);
    
    database()
      .ref(`calls/${callerId}/status`)
      .set('declined');
  }, [callerId]);

  const handleEndCall = useCallback(async () => {
    await leave();
    setIsInCall(false);
    
    await database()
      .ref(`calls/${partnerId}`)
      .remove();
  }, [partnerId]);

  useEffect(() => {
    const callsRef = database().ref(`calls/${userId}`);
    
    callsRef.on('value', (snapshot) => {
      const callData = snapshot.val();
      if (callData && callData.type === 'incoming' && !hasHandledIncomingCall) {
        setIsIncomingCall(true);
        setCallerId(callData.caller);
      } else if (callData && callData.status === 'accepted') {
        setIsInCall(true);
      } else if (callData && callData.status === 'declined') {
        setIsInCall(false);
        leave();
      }
    });

    return () => callsRef.off();
  }, [userId, hasHandledIncomingCall]);

  useEffect(() => {
    setupVideoSDKEngine();
    
    return () => {
      if (agoraEngineRef.current) {
        agoraEngineRef.current.unregisterEventHandler(eventHandler.current);
        agoraEngineRef.current.release();
      }
    };
  }, []);

  const setupVideoSDKEngine = async () => {
    try {
      agoraEngineRef.current = createAgoraRtcEngine();
      const agoraEngine = agoraEngineRef.current;
      
      agoraEngine.initialize({
        appId: appId,
        channelProfile: ChannelProfileType.ChannelProfileLiveBroadcasting,
      });

      agoraEngine.enableVideo();
      agoraEngine.enableAudio();

      eventHandler.current = {
        onJoinChannelSuccess: (_connection, _elapsed) => {
          console.log('Successfully joined the channel');
          setIsJoined(true);
        },
        onUserJoined: (_connection, _remoteUid, _elapsed) => {
          console.log('Remote user joined with UID:', _remoteUid);
          setRemoteUid(_remoteUid);
        },
        onUserOffline: (_connection, _remoteUid, _reason) => {
          console.log('Remote user left:', _remoteUid);
          setRemoteUid(0);
          handleEndCall();
        },
      };

      agoraEngine.registerEventHandler(eventHandler.current);
    } catch (e) {
      console.error('Error setting up Agora:', e);
    }
  };

  const join = async () => {
    if (isJoined) {
      console.log('Already joined channel');
      return;
    }

    try {
      await agoraEngineRef.current?.setChannelProfile(
        ChannelProfileType.ChannelProfileCommunication
      );
      
      await agoraEngineRef.current?.startPreview();
      
      const options = {
        clientRoleType: ClientRoleType.ClientRoleBroadcaster,
        publishMicrophoneTrack: true,
        publishCameraTrack: true,
      };

      await agoraEngineRef.current?.joinChannel(token, channelName, uid, options);
      
      console.log('Joined channel successfully');
    } catch (e) {
      console.error('Error joining channel:', e);
    }
  };

  const leave = async () => {
    try {
      await agoraEngineRef.current?.leaveChannel();
      setRemoteUid(0);
      setIsJoined(false);
      setIsInCall(false);
    } catch (e) {
      console.error('Error leaving channel:', e);
    }
  };

  const updateChatId = useCallback(() => {
    chatId.current = [userId, partnerId].sort().join('_');
  }, [userId, partnerId]);

  useEffect(() => {
    updateChatId();
  }, [updateChatId]);

  const clearChat = useCallback(async () => {
    setMessages([]);
    if (chatId.current) {
      try {
        await database().ref(`chats/${chatId.current}`).remove();
      } catch (error) {
        console.error('Error clearing chat:', error);
      }
    }
  }, [chatId]);

  const checkConnectionStatus = useCallback((snapshot) => {
    const partnerStatus = snapshot.val();
    if (partnerStatus === 'in_chat') {
      setConnectionStatus('Connected');
      setShowSearchingPopup(false);
      setIsLoading(false);
      clearChat();
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start();
      
      setShowConnectedMessage(true);
      setTimeout(() => setShowConnectedMessage(false), 1000);
    } else {
      setConnectionStatus('Disconnected');
      setShowSearchingPopup(true);
      clearChat();
      setTimeout(() => setShowSearchingPopup(false), 2000);
    }
  }, [clearChat, fadeAnim]);

  const setupPresence = useCallback(async (newPartnerId) => {
    const userRef = database().ref(`users/${userId}`);
    const partnerRef = database().ref(`users/${newPartnerId}`);
    const chatRef = database().ref(`chats/${chatId.current}`);
    const typingRef = database().ref(`typing/${chatId.current}`);
    const avatarRef = database().ref(`avatars/${newPartnerId}`);

    try {
      const userStatusRef = database().ref(`users/${userId}/status`);
      const userStatusOfflineRef = database().ref('.info/connected');

      userStatusOfflineRef.on('value', (snapshot) => {
        if (!snapshot.val()) return;
        userStatusRef.onDisconnect().set('offline').then(clearChat);
        userStatusRef.set('in_chat');
      });

      await userRef.update({ partnerId: newPartnerId, chatId: chatId.current });
      await clearChat();

      chatRef.on('child_added', (snapshot) => {
        const newMessage = { id: snapshot.key, ...snapshot.val() };

        setMessages(prevMessages => {
          const messageExists = prevMessages.some(msg => msg.id === newMessage.id);
          if (!messageExists) {
            return [...prevMessages, { ...newMessage, animationDelay: prevMessages.length * 100 }];
          }
          return prevMessages;
        });

        setIsLoading(false);
      });

      typingRef.on('value', (snapshot) => {
        const typingStatus = snapshot.val();
        if (typingStatus && typingStatus[newPartnerId]) {
          setIsPartnerTyping(true);
          if (typingTimeout.current) clearTimeout(typingTimeout.current);
          typingTimeout.current = setTimeout(() => setIsPartnerTyping(false), 3000);
        } else {
          setIsPartnerTyping(false);
        }
      });

      partnerRef.child('status').on('value', checkConnectionStatus);
      
      avatarRef.on('value', (snapshot) => {
        const avatarIndex = snapshot.val()?.avatar;
        if (avatarIndex !== null && avatarIndex !== undefined) {
          setPartnerAvatar(avatarImages[avatarIndex] || defaultAvatar);
        } else {
          setPartnerAvatar(defaultAvatar);
        }
      });
    } catch (error) {
      console.error('Error setting up chat:', error);
      Alert.alert('Error', 'Failed to set up chat. Please try again.');
    }
  }, [userId, chatId, clearChat, checkConnectionStatus]);

  const setupChat = useCallback((newPartnerId) => {
    setPartnerId(newPartnerId);
    clearChat();
    setIsLoading(true);
    setConnectionStatus('Connecting...');
    setShowSearchingPopup(false);
    setupPresence(newPartnerId);
  }, [setupPresence, clearChat]);

  useFocusEffect(
    useCallback(() => {
      const cleanup = setupChat(partnerId);
      return () => {
        cleanup();
        const userRef = database().ref(`users/${userId}`);
        userRef.child('status').set('online');
        userRef.update({ partnerId: null, chatId: null });
        clearChat();
      };
    }, [userId, partnerId, setupChat, clearChat])
  );

  const handleTyping = useCallback(() => {
    const typingRef = database().ref(`typing/${chatId.current}/${userId}`);
    typingRef.set(true);
    typingRef.onDisconnect().remove();

    setTimeout(() => typingRef.set(false), 3000);
  }, [chatId, userId]);

  const sendMessage = useCallback(() => {
    if (!message.trim() || connectionStatus !== 'Connected') return;

    const chatRef = database().ref(`chats/${chatId.current}`);
    const newMessage = {
      sender: userId,
      text: message.trim(),
      timestamp: database.ServerValue.TIMESTAMP,
    };

    chatRef.push(newMessage).then(() => setMessage('')).catch((error) => {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message. Please try again.');
    });
  }, [message, connectionStatus, userId, chatId]);

  const findNextStranger = useCallback(async () => {
    setIsSearching(true);
    setConnectionStatus('Searching...');
    setIsLoading(true);
    setShowSearchingPopup(true);
    fadeAnim.setValue(0);

    try {
      await clearChat();

      const userRef = database().ref(`users/${userId}`);
      await userRef.update({ status: 'searching', partnerId: null, chatId: null });

      const snapshot = await database().ref('users').orderByChild('status').equalTo('waiting').once('value');
      if (snapshot.exists()) {
        const availableUsers = Object.entries(snapshot.val());
        const randomUser = availableUsers[Math.floor(Math.random() * availableUsers.length)];
        const newPartnerId = randomUser[0];

        await Promise.all([
          userRef.update({ status: 'in_chat', partnerId: newPartnerId }),
          database().ref(`users/${newPartnerId}`).update({ status: 'in_chat', partnerId: userId }),
        ]);

        setupChat(newPartnerId);
      } else {
        await userRef.update({ status: 'waiting' });
        setConnectionStatus('Waiting for partner...');
      }
    } catch (error) {
      console.error('Error finding next stranger:', error);
      Alert.alert('Error', 'Failed to find a new partner. Please try again.');
    } finally {
      setIsSearching(false);
    }
  }, [userId, setupChat, clearChat, fadeAnim]);

  useEffect(() => {
    if (flatListRef.current && messages.length > 0) {
      flatListRef.current.scrollToEnd({ animated: true });
    }
  }, [messages]);

  const renderHeader = useCallback(() => (
    <View style={styles.header}>
      <View style={styles.headerInfo}>
        <Image source={partnerAvatar} style={styles.avatarImage} />
        <View>
          <Text style={styles.headerTitle}>Stranger</Text>
          <Text style={styles.headerSubtitle}>{connectionStatus}</Text>
        </View>
      </View>
      <View style={styles.headerButtons}>
        <TouchableOpacity onPress={handleVideoCall} style={styles.videoCallButton}>
          <Icon name="videocam" size={24} color="#0095f6" />
        </TouchableOpacity>
        <TouchableOpacity onPress={findNextStranger} style={styles.headerButton}>
          <Text style={styles.findNextText}>Find Next</Text>
        </TouchableOpacity>
      </View>
    </View>
  ), [connectionStatus, findNextStranger, partnerAvatar, handleVideoCall]);

  const renderInputArea = useCallback(() => (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.inputArea}>
      <View style={styles.inputWrapper}>
        <TextInput
          style={styles.input}
          value={message}
          onChangeText={(text) => {
            setMessage(text);
            handleTyping();
          }}
          placeholder={connectionStatus === 'Connected' ? "Message..." : "Waiting for connection..."}
          placeholderTextColor="#999999"
          editable={connectionStatus === 'Connected'}
        />
        {message.trim() && connectionStatus === 'Connected' ? (
          <TouchableOpacity style={styles.sendButton} onPress={sendMessage}>
            <Icon name="send" size={24} color="#0095f6" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.micButton} disabled={true}>
            
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  ), [message, connectionStatus, sendMessage, handleTyping]);

  const renderItem = useCallback(({ item, index }) => (
    <ChatMessage
      message={item}
      isSender={item.sender === userId}
      animationDelay={item.animationDelay || index * 100}
    />
  ), [userId]);

  const renderIncomingCallModal = () => (
    <Modal
      visible={isIncomingCall}
      transparent={true}
      animationType="slide"
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <Text style={styles.modalText}>Incoming Video Call</Text>
          <View style={styles.callButtons}>
            <TouchableOpacity
              style={[styles.callButton, styles.acceptButton]}
              onPress={handleAcceptCall}
            >
              <Icon name="call" size={30} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.callButton, styles.rejectButton]}
              onPress={handleDeclineCall}
            >
              <Icon name="call-sharp" size={30} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  const renderVideoCall = () => (
    <Modal
      visible={isInCall}
      animationType="slide"
      style={styles.videoCallModal}
    >
      <View style={styles.videoCallContainer}>
        {isJoined && (
          <View style={styles.streamContainer}>
            <View style={styles.streamWrapper}>
              <RtcSurfaceView
                style={styles.localStream}
                canvas={{
                  uid: 0,
                  renderMode: 1,
                  mirrorMode: 1,
                }}
              />
              <View style={styles.streamOverlay}>
                <Text style={styles.streamText}>Me</Text>
              </View>
            </View>
            <View style={styles.streamWrapper}>
              {remoteUid !== 0 ? (
                <RtcSurfaceView
                  style={styles.remoteStream}
                  canvas={{
                    uid: remoteUid,
                    renderMode: 1,
                    mirrorMode: 1,
                  }}
                />
              ) : (
                <View style={styles.noRemoteStream}>
                  <Text style={styles.noRemoteStreamText}>Waiting for Stranger...</Text>
                </View>
              )}
              <View style={styles.streamOverlay}>
                <Text style={styles.streamText}>Stranger</Text>
              </View>
            </View>
          </View>
        )}
        <View style={styles.callControlsContainer}>
          <TouchableOpacity
            style={[styles.callButton, styles.rejectButton]}
            onPress={handleEndCall}
          >
            <Icon name="call-sharp" size={30} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      {renderHeader()}
      {isLoading ? (
        <ActivityIndicator size="large" color="#0095f6" style={styles.loader} />
      ) : (
        <Animated.View style={[styles.chatContainer, { opacity: fadeAnim }]}>
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.messagesContainer}
            ListFooterComponent={isPartnerTyping ? <TypingIndicator /> : null}
          />
        </Animated.View>
      )}
      {renderInputArea()}
      {renderIncomingCallModal()}
      {renderVideoCall()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F7F7',
  },
  chatContainer: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EFEFEF',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  headerButton: {
    padding: 8,
  },
  headerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  headerTitle: {
    color: '#262626',
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: '#8E8E8E',
    fontSize: 14,
  },
  findNextText: {
    color: '#0095f6',
    fontSize: 16,
    fontWeight: '600',
  },
  inputArea: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#EFEFEF',
    padding: 12,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    height: 40,
    borderColor: '#DBDBDB',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    marginRight: 8,
    backgroundColor: '#FAFAFA',
    color: '#262626',
  },
  sendButton: {
    padding: 8,
  },
  micButton: {
    padding: 8,
  },
  messagesContainer: {
    padding: 16,
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  messageBubble: {
    marginVertical: 4,
    padding: 12,
    borderRadius: 20,
    maxWidth: '75%',
  },
  senderBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#0095f6',
  },
  receiverBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#EFEFEF',
  },
  messageText: {
    fontSize: 16,
  },
  senderText: {
    color: '#FFFFFF',
  },
  receiverText: {
    color: '#262626',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 20,
    alignItems: 'center',
    width: width * 0.8,
  },
  modalText: {
    color: '#262626',
    fontSize: 18,
    marginBottom: 20,
    textAlign: 'center',
  },
  modalButton: {
    backgroundColor: '#0095f6',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 5,
    marginTop: 20,
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  connectedMessageContainer: {
    position: 'absolute',
    top: 80,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0, 149, 246, 0.9)',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  connectedMessageText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  typingText: {
    color: '#262626',
    marginRight: 5,
  },
  dotContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#262626',
    marginHorizontal: 1,
  },
  dot1: {
    opacity: 0.4,
  },
  dot2: {
    opacity: 0.7,
  },
  dot3: {
    opacity: 1,
  },
  acceptButton: {
    backgroundColor: '#4CD964',
  },

  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  videoCallButton: {
    padding: 8,
    marginRight: 8,
  },
 









  videoCallModal: {
    flex: 1,
  },
  videoCallContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  streamContainer: {
    flex: 1,
    flexDirection: 'column',
  },
  streamWrapper: {
    flex: 1,
    position: 'relative',
  },
  localStream: {
    flex: 1,
  },
  remoteStream: {
    flex: 1,
  },
  noRemoteStream: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#333',
  },
  noRemoteStreamText: {
    color: '#fff',
    fontSize: 18,
  },
  streamOverlay: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  streamText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  callControlsContainer: {
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    zIndex: 2,
  },
  callButton: {
    borderRadius: 30,
    padding: 15,
  },
  rejectButton: {
    backgroundColor: '#FF3B30',
  },



});

export default ChatScreen;

