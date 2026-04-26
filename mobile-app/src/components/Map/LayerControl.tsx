import React, { useRef, useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, Animated } from 'react-native';
import { useMapStore } from '../../store/mapStore';

const PANEL_WIDTH = 170;

export default function LayerControl() {
  const { layers, toggleLayer } = useMapStore();
  const [visible, setVisible] = useState(false);
  const slideAnim = useRef(new Animated.Value(-PANEL_WIDTH)).current;

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: visible ? 0 : -PANEL_WIDTH,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [visible, slideAnim]);

  return (
    <>
      {/* 侧边隐藏/显示按钮 - 始终可见 */}
      <TouchableOpacity
        style={styles.toggleBtn}
        onPress={() => setVisible(!visible)}
        activeOpacity={0.8}
      >
        <Text style={styles.toggleBtnText}>
          {visible ? '›' : '‹'}
        </Text>
        <Text style={styles.toggleLabel}>图层</Text>
      </TouchableOpacity>

      {/* 侧边面板 */}
      <Animated.View
        style={[
          styles.panel,
          { transform: [{ translateX: slideAnim }] },
        ]}
      >
        <View style={styles.panelInner}>
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
              style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
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
              style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
            />
          </View>
        </View>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  toggleBtn: {
    position: 'absolute',
    left: 0,
    top: 100,
    width: 28,
    height: 80,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderTopRightRadius: 10,
    borderBottomRightRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 1, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 4,
    zIndex: 60,
  },
  toggleBtnText: {
    fontSize: 18,
    color: '#007AFF',
    fontWeight: 'bold',
    lineHeight: 16,
  },
  toggleLabel: {
    fontSize: 9,
    color: '#555',
    marginTop: 1,
  },
  panel: {
    position: 'absolute',
    left: 0,
    top: 100,
    width: PANEL_WIDTH,
    zIndex: 55,
    elevation: 4,
  },
  panelInner: {
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: 8,
    padding: 14,
    marginLeft: 28,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  title: { fontSize: 13, fontWeight: 'bold', marginBottom: 10, color: '#333' },
  layerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  layerInfo: { flexDirection: 'row', alignItems: 'center' },
  colorDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  layerName: { fontSize: 13, color: '#333' },
});
