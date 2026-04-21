import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Platform, Text } from 'react-native';
import { AMapScene, MapView, UserLocation, Marker, AMapRef } from 'react-native-amap3d';
import { AMAP_CONFIG } from '../../utils/config';
import { useMapStore, SectorData } from '../../store/mapStore';
import { apiService } from '../../services/api';

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
  const {
    layers,
    lteSectors,
    nrSectors,
    setSectors,
    setConnected
  } = useMapStore();

  useEffect(() => {
    loadMapData();
  }, []);

  const loadMapData = async () => {
    try {
      const response = await apiService.getMapData();
      if (response.success && response.data) {
        const sites = response.data.sites || [];
        const lte = sites
          .filter((s: any) => s.networkType === 'LTE' || !s.networkType)
          .map((s: any) => ({
            id: s.id || s.sectorId || Math.random().toString(36),
            name: s.name || '未命名',
            siteId: s.siteId,
            sectorId: s.sectorId,
            latitude: s.latitude,
            longitude: s.longitude,
            networkType: 'LTE' as const,
            frequency: s.frequency,
            pci: s.pci,
            tac: s.tac,
          }));
        const nr = sites
          .filter((s: any) => s.networkType === 'NR')
          .map((s: any) => ({
            id: s.id || s.sectorId || Math.random().toString(36),
            name: s.name || '未命名',
            siteId: s.siteId,
            sectorId: s.sectorId,
            latitude: s.latitude,
            longitude: s.longitude,
            networkType: 'NR' as const,
            frequency: s.frequency,
            pci: s.pci,
            tac: s.tac,
          }));
        setSectors(lte, nr);
        setConnected(true);
      }
    } catch (error) {
      console.error('Failed to load map data:', error);
      setConnected(false);
    }
  };

  const handleMapPress = (event: { nativeEvent: { coordinate: { latitude: number; longitude: number } } }) => {
    if (onMapPress) {
      const { latitude, longitude } = event.nativeEvent.coordinate;
      onMapPress(latitude, longitude);
    }
  };

  const renderLTEProviders = () => {
    if (!layers.lte.visible) return null;
    return lteSectors.map((sector) => (
      <Marker
        key={sector.id}
        coordinate={{
          latitude: sector.latitude,
          longitude: sector.longitude,
        }}
        title={sector.name}
        description={`${sector.siteId || ''} ${sector.frequency ? 'F' + sector.frequency : ''}`}
        pinColor="blue"
        onPress={() => useMapStore.getState().setSelectedSector(sector)}
      />
    ));
  };

  const renderNRProviders = () => {
    if (!layers.nr.visible) return null;
    return nrSectors.map((sector) => (
      <Marker
        key={sector.id}
        coordinate={{
          latitude: sector.latitude,
          longitude: sector.longitude,
        }}
        title={sector.name}
        description={`${sector.siteId || ''} ${sector.frequency ? 'N' + sector.frequency : ''}`}
        pinColor="green"
        onPress={() => useMapStore.getState().setSelectedSector(sector)}
      />
    ));
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
        >
          {renderLTEProviders()}
          {renderNRProviders()}
        </MapView>
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
