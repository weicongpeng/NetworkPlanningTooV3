// mobile-app/app/(tabs)/index.tsx
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, SafeAreaView, Alert } from 'react-native';
import MapViewComponent from '../../src/components/Map/MapView';
import SearchBar, { SearchResult } from '../../src/components/Search/SearchBar';
import NavControl from '../../src/components/Navigation/NavControl';
import { useMapStore } from '../../src/store/mapStore';
import { apiService } from '../../src/services/api';

export default function MapScreen() {
  const { mapType, setMapType, setBackendInfo, setConnected } = useMapStore();
  const [selectedLocation, setSelectedLocation] = useState<{
    lat: number;
    lng: number;
    name: string;
  } | null>(null);

  useEffect(() => {
    connectToBackend();
  }, []);

  const connectToBackend = async () => {
    try {
      const info = await apiService.getSystemInfo();
      setBackendInfo(info.backend_ip, info.backend_port);
      setConnected(true);
    } catch (error) {
      console.error('Failed to connect to backend:', error);
      setConnected(false);
    }
  };

  const handleMapPress = (lat: number, lng: number) => {
    setSelectedLocation({ lat, lng, name: '' });
  };

  const handleResultSelect = (result: SearchResult) => {
    const [lng, lat] = result.location.split(',').map(Number);
    if (!isNaN(lat) && !isNaN(lng)) {
      setSelectedLocation({ lat, lng, name: result.name });
    } else {
      Alert.alert('错误', '无效的坐标');
    }
  };

  const handleToggleMapType = () => {
    setMapType(mapType === 'roadmap' ? 'satellite' : 'roadmap');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.searchContainer}>
        <SearchBar
          onSearch={() => {}}
          onResultSelect={handleResultSelect}
          placeholder="搜索地点或坐标..."
        />
      </View>
      <View style={styles.mapContainer}>
        <MapViewComponent
          initialCenter={selectedLocation ? [selectedLocation.lat, selectedLocation.lng] : undefined}
          showSatellite={mapType === 'satellite'}
          onMapPress={handleMapPress}
        />
      </View>
      {selectedLocation && (
        <NavControl
          latitude={selectedLocation.lat}
          longitude={selectedLocation.lng}
          name={selectedLocation.name}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  searchContainer: {
    zIndex: 10,
  },
  mapContainer: {
    flex: 1,
  },
});
