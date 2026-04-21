import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import MapScreen from './app/(tabs)/index';

export default function App() {
  return (
    <SafeAreaProvider>
      <MapScreen />
    </SafeAreaProvider>
  );
}
