// mobile-app/src/components/Navigation/NavControl.tsx
import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { startNaviToCoord } from '../../services/navi';

interface NavControlProps {
  latitude: number;
  longitude: number;
  name?: string;
}

export default function NavControl({ latitude, longitude, name }: NavControlProps) {
  const handleNavigate = async () => {
    await startNaviToCoord(latitude, longitude, name);
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.button} onPress={handleNavigate}>
        <Text style={styles.buttonText}>导航到这里</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 10,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
