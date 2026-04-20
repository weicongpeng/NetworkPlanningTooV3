import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';
import { useMapStore } from '../../src/store/mapStore';
import { apiService } from '../../src/services/api';

export default function MapScreen() {
  const { backendIp, isConnected, setBackendInfo, setConnected } = useMapStore();

  useEffect(() => {
    const connect = async () => {
      try {
        const info = await apiService.getSystemInfo();
        setBackendInfo(info.backend_ip, info.backend_port);
        setConnected(true);
      } catch (error) {
        console.error('Failed to connect:', error);
        setConnected(false);
      }
    };
    connect();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>网络规划工具</Text>
        <Text style={styles.status}>
          {isConnected ? `已连接后端 ${backendIp}:8000` : '未连接后端'}
        </Text>
        <Text style={styles.hint}>地图功能开发中...</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  status: {
    fontSize: 16,
    color: '#666',
    marginBottom: 10,
  },
  hint: {
    fontSize: 14,
    color: '#999',
  },
});