/**
 * NavControl - 导航控制按钮
 *
 * 点击后设置 pendingNavi 到 store，由父组件负责渲染 NavigationPanel。
 */
import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { useMapStore } from '../../store/mapStore';
import { gcj02ToWgs84 } from '../../utils/coordinate';

interface NavControlProps {
  latitude: number;   // 目的地纬度 (GCJ-02，来自高德地图)
  longitude: number;  // 目的地经度 (GCJ-02)
  name?: string;      // 目的地名称
}

export default function NavControl({ latitude, longitude, name }: NavControlProps) {
  const setPendingNavi = useMapStore(s => s.setPendingNavi);

  const handleOpenNavi = () => {
    // selectedLocation 来自 AMap 为 GCJ-02，planRoute 需要 WGS84，需反转纠偏
    const [wgsLat, wgsLng] = gcj02ToWgs84(latitude, longitude);
    setPendingNavi({ lat: wgsLat, lng: wgsLng, name: name || '目的地' });
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.button} onPress={handleOpenNavi}>
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
