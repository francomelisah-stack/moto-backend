import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AppProvider, useApp } from './context/AppContext';
import { NotificationService } from './services/NotificationService';
import AuthScreen from './screens/AuthScreen';
import HomeScreen from './screens/HomeScreen';
import MapScreen  from './screens/MapScreen';

export type RootStackParamList = {
  Auth: undefined;
  Home: undefined;
  Map:  undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function Navigator() {
  const { isAuthenticated } = useApp();
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
      {!isAuthenticated ? (
        <Stack.Screen name="Auth" component={AuthScreen} />
      ) : (
        <>
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="Map"  component={MapScreen}  options={{ animation: 'slide_from_right' }} />
        </>
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  useEffect(() => {
    NotificationService.init();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppProvider>
        <NavigationContainer>
          <StatusBar style="light" />
          <Navigator />
        </NavigationContainer>
      </AppProvider>
    </GestureHandlerRootView>
  );
}
