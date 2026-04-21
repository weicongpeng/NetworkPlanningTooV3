import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useMapStore } from '../../store/mapStore';

export default function MeasureControl() {
  const { measurePoints, measureMode, totalDistance, toggleMeasureMode, clearMeasure, removeLastMeasurePoint } = useMapStore();

  if (!measureMode && measurePoints.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>测距工具</Text>
        <View style={styles.buttons}>
          <TouchableOpacity
            style={[styles.btn, measureMode && styles.btnActive]}
            onPress={toggleMeasureMode}
          >
            <Text style={[styles.btnText, measureMode && styles.btnTextActive]}>
              {measureMode ? '退出测距' : '开始测距'}
            </Text>
          </TouchableOpacity>
          {measurePoints.length > 0 && (
            <>
              <TouchableOpacity style={styles.btn} onPress={removeLastMeasurePoint}>
                <Text style={styles.btnText}>撤销</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btn} onPress={clearMeasure}>
                <Text style={styles.btnText}>清除</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
      {measurePoints.length > 0 && (
        <View style={styles.info}>
          <Text style={styles.pointCount}>已选 {measurePoints.length} 个点</Text>
          {totalDistance !== null && (
            <Text style={styles.distance}>
              总距离: {(totalDistance / 1000).toFixed(2)} km
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60,
    right: 10,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 8,
    padding: 10,
    minWidth: 180,
  },
  header: { marginBottom: 8 },
  title: { fontSize: 14, fontWeight: 'bold', marginBottom: 8 },
  buttons: { flexDirection: 'row', gap: 8 },
  btn: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#f0f0f0', borderRadius: 4 },
  btnActive: { backgroundColor: '#007AFF' },
  btnText: { fontSize: 12, color: '#333' },
  btnTextActive: { color: '#fff' },
  info: { borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 8 },
  pointCount: { fontSize: 12, color: '#666' },
  distance: { fontSize: 14, fontWeight: 'bold', color: '#007AFF', marginTop: 4 },
});
