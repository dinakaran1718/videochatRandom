import * as React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { NavigationContainer } from '@react-navigation/native';
import StartScreen from '../Screens/StartScreen';
import ChatScreen from '../Screens/ChatScreen';


const Stack = createStackNavigator();

const AppNavigator = () => (
  <NavigationContainer>
    <Stack.Navigator initialRouteName="StartScreen">
      <Stack.Screen name="StartScreen" component={StartScreen} />
      <Stack.Screen name="ChatScreen" component={ChatScreen} />
      
    </Stack.Navigator>
  </NavigationContainer>
);

export default AppNavigator;
