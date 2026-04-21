import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { useMapStore, MarkerPoint } from '../../store/mapStore';

interface MarkerListProps {
  onMarkerSelect?: (marker: MarkerPoint) => void;
}

export default function MarkerList({ onMarkerSelect }: MarkerListProps) {
  const { markers, removeMarker } = useMapStore();

  if (markers.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>标记点 ({markers.length})</Text>
        <TouchableOpacity onPress={() => useMapStore.getState().clearMarkers()}>
          <Text style={styles.clearBtn}>清除全部</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={markers}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <View style={styles.markerItem}>
            <Text style={styles.markerIndex}>{index + 1}</Text>
            <View style={styles.markerInfo}>
              <Text style={styles.markerName}>{item.name || '未命名'}</Text>
              <Text style={styles.markerCoord}>{item.lat.toFixed(6)}, {item.lng.toFixed(6)}</Text>
            </View>
            <TouchableOpacity onPress={() => removeMarker(item.id)}>
              <Text style={styles.deleteBtn}>×</Text>
            </TouchableOpacity>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 80,
    left: 10,
    right: 10,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 8,
    padding: 10,
    maxHeight: 200,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: { fontSize: 14, fontWeight: 'bold' },
  clearBtn: { fontSize: 12, color: '#007AFF' },
  markerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  markerIndex: { width: 24, fontSize: 12, color: '#666' },
  markerInfo: { flex: 1 },
  markerName: { fontSize: 13, fontWeight: '600' },
  markerCoord: { fontSize: 11, color: '#999' },
  deleteBtn: { fontSize: 20, color: '#999', paddingHorizontal: 10 },
});