import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch } from 'react-native';
import { useMapStore } from '../../store/mapStore';

export default function LayerControl() {
  const { layers, toggleLayer } = useMapStore();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>图层控制</Text>
      <View style={styles.layerRow}>
        <View style={styles.layerInfo}>
          <View style={[styles.colorDot, { backgroundColor: '#4CAF50' }]} />
          <Text style={styles.layerName}>LTE 扇区</Text>
        </View>
        <Switch
          value={layers.lte.visible}
          onValueChange={() => toggleLayer('lte')}
          trackColor={{ false: '#ddd', true: '#4CAF50' }}
        />
      </View>
      <View style={styles.layerRow}>
        <View style={styles.layerInfo}>
          <View style={[styles.colorDot, { backgroundColor: '#2196F3' }]} />
          <Text style={styles.layerName}>NR 扇区</Text>
        </View>
        <Switch
          value={layers.nr.visible}
          onValueChange={() => toggleLayer('nr')}
          trackColor={{ false: '#ddd', true: '#2196F3' }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60,
    left: 10,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 8,
    padding: 12,
    minWidth: 140,
  },
  title: { fontSize: 14, fontWeight: 'bold', marginBottom: 10 },
  layerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  layerInfo: { flexDirection: 'row', alignItems: 'center' },
  colorDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  layerName: { fontSize: 13 },
});
