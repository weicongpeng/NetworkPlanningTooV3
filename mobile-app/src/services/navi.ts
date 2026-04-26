// mobile-app/src/services/navi.ts
import { Platform, Linking } from 'react-native';

interface NaviParams {
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  mode?: 'drive' | 'walk' | 'bus';
}

export async function startNavi(params: NaviParams): Promise<void> {
  const { startLat, startLng, endLat, endLng, mode = 'drive' } = params;

  if (Platform.OS === 'android') {
    const scheme = `amapuri://route/${mode}?sourceApplication=工参地图&slat=${startLat}&slng=${startLng}&sname=起点&dlat=${endLat}&dlng=${endLng}&dname=终点&dev=0&m=0`;
    try {
      await Linking.openURL(scheme);
    } catch (error) {
      console.error('Failed to open navigation:', error);
      await Linking.openURL('market://details/com.autonavi.minimap');
    }
  }
}

export async function startNaviToCoord(lat: number, lng: number, name?: string, isWgs84?: boolean): Promise<void> {
  if (Platform.OS === 'android') {
    // dev=0: GCJ-02 坐标；dev=1: WGS84 原始坐标（高德自动纠偏）
    const dev = isWgs84 ? 1 : 0;
    const scheme = `amapuri://route/drive?sourceApplication=工参地图&dlat=${lat}&dlng=${lng}&dname=${encodeURIComponent(name || '目的地')}&dev=${dev}&m=0`;
    try {
      await Linking.openURL(scheme);
    } catch (error) {
      console.error('Failed to open navigation:', error);
    }
  }
}
