import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Platform, Text } from 'react-native';
import { AMapScene, MapView, UserLocation, AMapRef } from 'react-native-amap3d';
import { AMAP_CONFIG } from '../../utils/config';

interface MapViewProps {
  initialCenter?: [number, number];
  initialZoom?: number;
  showSatellite?: boolean;
  onMapPress?: (lat: number, lng: number) => void;
}

export default function MapViewComponent({
  initialCenter = [39.908823, 116.397470],
  initialZoom = 12,
  showSatellite = false,
  onMapPress,
}: MapViewProps) {
  const mapRef = useRef<AMapRef>(null);
  const [isReady, setIsReady] = useState(false);

  const handleMapPress = (event: { nativeEvent: { coordinate: { latitude: number; longitude: number } } }) => {
    if (onMapPress) {
      const { latitude, longitude } = event.nativeEvent.coordinate;
      onMapPress(latitude, longitude);
    }
  };

  return (
    <View style={styles.container}>
      <AMapScene
        style={styles.map}
        onLoad={() => setIsReady(true)}
        apikey={AMAP_CONFIG.androidKey}
      >
        <MapView
          ref={mapRef}
          style={styles.map}
          mapType={showSatellite ? 'Satellite' : 'Standard'}
          onPress={handleMapPress}
          showsUserLocation={true}
          showsCompass={true}
          showsScale={true}
          zoomLevel={initialZoom}
          centerCoordinate={{
            latitude: initialCenter[0],
            longitude: initialCenter[1],
          }}
        />
      </AMapScene>
      {!isReady && (
        <View style={styles.loading}>
          <Text>地图加载中...</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  loading: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
});
