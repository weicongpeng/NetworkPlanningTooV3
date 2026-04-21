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
    const scheme = `amapuri://route/${mode}?sourceApplication=NetworkPlanning&slat=${startLat}&slng=${startLng}&sname=起点&dlat=${endLat}&dlng=${endLng}&dname=终点&dev=0&m=0`;
    try {
      await Linking.openURL(scheme);
    } catch (error) {
      console.error('Failed to open navigation:', error);
      await Linking.openURL('market://details/com.autonavi.minimap');
    }
  }
}

export async function startNaviToCoord(lat: number, lng: number, name?: string): Promise<void> {
  if (Platform.OS === 'android') {
    const scheme = `amapuri://route/drive?sourceApplication=NetworkPlanning&dlat=${lat}&dlng=${lng}&dname=${name || '目的地'}&dev=0&m=0`;
    try {
      await Linking.openURL(scheme);
    } catch (error) {
      console.error('Failed to open navigation:', error);
    }
  }
}
