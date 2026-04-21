// mobile-app/app/(tabs)/index.tsx
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, SafeAreaView, Alert, TouchableOpacity, Text } from 'react-native';
import MapViewComponent from '../../src/components/Map/MapView';
import LayerControl from '../../src/components/Map/LayerControl';
import SearchBar, { SearchResult } from '../../src/components/Search/SearchBar';
import NavControl from '../../src/components/Navigation/NavControl';
import MarkerList from '../../src/components/Marker/MarkerList';
import MeasureControl from '../../src/components/Measure/MeasureControl';
import { useMapStore } from '../../src/store/mapStore';
import { apiService } from '../../src/services/api';

export default function MapScreen() {
  const { mapType, setMapType, setBackendInfo, setConnected, measureMode, addMarker, addMeasurePoint, toggleMeasureMode } = useMapStore();
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
    if (measureMode) {
      addMeasurePoint(lat, lng);
    } else {
      setSelectedLocation({ lat, lng, name: '' });
    }
  };

  const handleLongPress = (lat: number, lng: number) => {
    addMarker(lat, lng, `标记 ${Date.now()}`);
    if (!measureMode) {
      setSelectedLocation({ lat, lng, name: '已添加标记' });
    }
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
          onLongPress={handleLongPress}
        />
        <LayerControl />
        <MeasureControl />
        <MarkerList />
        <TouchableOpacity style={styles.mapTypeBtn} onPress={handleToggleMapType}>
          <Text style={styles.mapTypeBtnText}>{mapType === 'roadmap' ? '卫星' : '地图'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.measureBtn, measureMode && styles.measureBtnActive]}
          onPress={toggleMeasureMode}
        >
          <Text style={[styles.measureBtnText, measureMode && styles.measureBtnTextActive]}>
            {measureMode ? '退出测距' : '测距'}
          </Text>
        </TouchableOpacity>
      </View>
      {selectedLocation && !measureMode && (
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
