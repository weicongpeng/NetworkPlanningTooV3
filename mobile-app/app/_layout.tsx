import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}
