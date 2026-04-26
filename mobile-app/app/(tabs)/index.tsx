// mobile-app/app/(tabs)/index.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, StyleSheet, SafeAreaView, Alert, TouchableOpacity, Text,
  Modal, FlatList
} from 'react-native';
import MapViewComponent from '../../src/components/Map/MapView';
import LayerControl from '../../src/components/Map/LayerControl';
import SectorInfoPanel from '../../src/components/Map/SectorInfoPanel';
import SearchBar, { SearchResult } from '../../src/components/Search/SearchBar';
import NavControl from '../../src/components/Navigation/NavControl';
import MarkerList from '../../src/components/Marker/MarkerList';
import MeasureControl from '../../src/components/Measure/MeasureControl';
import { useMapStore, SectorData } from '../../src/store/mapStore';
import { apiService } from '../../src/services/api';
import { wgs84ToGcj02 } from '../../src/utils/coordinate';

type SearchMode = 'place' | 'parameter' | 'coordinate';

interface CoordinateHint {
  lat: number;
  lng: number;
  visible: boolean;
}

export default function MapScreen() {
  const {
    mapType, setMapType, setBackendInfo, setConnected,
    measureMode, measureFinished, addMarker, addMeasurePoint,
    toggleMeasureMode, finishMeasure, clearMeasure,
    layers, toggleLayer, lteSectors, nrSectors,
    setSectors, setSelectedSector, selectedSector,
    setSearchMarker, markers, coordinateMode, setCoordinateMode,
    clearMarkers, measurePoints,
  } = useMapStore();

  const [selectedLocation, setSelectedLocation] = useState<{
    lat: number; lng: number; name: string;
  } | null>(null);
  const [coordinateHint, setCoordinateHint] = useState<CoordinateHint | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number] | undefined>(undefined);
  const [searchMode, setSearchMode] = useState<SearchMode>('place');
  const [overlapSectors, setOverlapSectors] = useState<SectorData[]>([]);
  const [showOverlapModal, setShowOverlapModal] = useState(false);

  const prevCenterRef = useRef<string | null>(null);

  useEffect(() => {
    connectToBackend();
  }, []);

  const connectToBackend = async () => {
    try {
      const info = await apiService.getSystemInfo();
      setBackendInfo(info.backend_ip, info.backend_port);
      setConnected(true);
      await loadSectors();
    } catch (error) {
      console.error('Failed to connect to backend:', error);
      setConnected(false);
    }
  };

  const loadSectors = async () => {
    try {
      const response = await apiService.getMapData();
      if (response.success && response.data) {
        const sites = response.data.sites || [];
        const lte: SectorData[] = [];
        const nr: SectorData[] = [];

        sites.forEach((site: any) => {
          const networkType = site.networkType === 'NR' ? 'NR' : 'LTE';
          const sectors = site.sectors || [];
          // 按方位角排序，确保同一站点的扇区顺序稳定
          sectors.sort((a: any, b: any) => (a.azimuth ?? 0) - (b.azimuth ?? 0));
          sectors.forEach((sector: any, sectorIndex: number) => {
            // 生成唯一ID：优先使用 sector.id，否则用 siteId + sectorId，
            // 否则用 siteId + 扇区在数组中的索引，确保同一站点的不同扇区ID唯一
            const uniqueId = sector.id
              || (site.id && sector.sectorId ? `${site.id}_${sector.sectorId}` : null)
              || (site.id ? `${site.id}_idx${sectorIndex}` : `sector_${Math.random().toString(36).slice(2, 9)}`);

            const item: SectorData = {
              id: uniqueId,
              name: sector.name || site.name || '未命名',
              siteId: site.id || site.siteId,
              sectorId: sector.sectorId || sector.id,
              latitude: sector.latitude ?? site.latitude,
              longitude: sector.longitude ?? site.longitude,
              networkType: networkType,
              frequency: sector.frequency ?? site.frequency,
              pci: sector.pci,
              tac: sector.tac ?? site.tac,
              azimuth: sector.azimuth,
              beamwidth: sector.beamwidth ?? site.beamwidth,
              height: sector.height ?? site.height,
              cell_cover_type: sector.cell_cover_type,
              earfcn: sector.earfcn,
              ssbFrequency: sector.ssbFrequency,
              mcc: sector.mcc,
              mnc: sector.mnc,
              is_shared: sector.is_shared,
            };
            if (networkType === 'NR') {
              nr.push(item);
            } else {
              lte.push(item);
            }
          });
        });

        setSectors(lte, nr);
        // Auto-enable layers when data loaded
        if (lte.length > 0 && !layers.lte.visible) toggleLayer('lte');
        if (nr.length > 0 && !layers.nr.visible) toggleLayer('nr');
      }
    } catch (error) {
      console.error('Failed to load sectors:', error);
    }
  };

  const handleMapPress = useCallback((lat: number, lng: number) => {
    console.log('[MapScreen] handleMapPress:', lat, lng);
    if (measureMode) {
      addMeasurePoint(lat, lng);
    } else if (coordinateMode) {
      // Coordinate mode: map press does nothing
      // Coordinate lookup is done via search input, not map tap
      return;
    } else {
      setSelectedLocation({ lat, lng, name: '' });
    }
  }, [measureMode, coordinateMode, addMeasurePoint]);

  const handleLongPress = useCallback((lat: number, lng: number) => {
    addMarker(lat, lng, `标记 ${Date.now()}`);
    if (!measureMode && !coordinateMode) {
      setSelectedLocation({ lat, lng, name: '已添加标记' });
    }
  }, [measureMode, coordinateMode, addMarker]);

  const handleSectorOverlap = useCallback((sectors: SectorData[], lat: number, lng: number) => {
    setOverlapSectors(sectors);
    setShowOverlapModal(true);
    setSelectedLocation({ lat, lng, name: `${sectors.length} 个重叠扇区` });
  }, []);

  const handleSelectOverlapSector = useCallback((sector: SectorData) => {
    setSelectedSector(sector);
    setShowOverlapModal(false);
    setOverlapSectors([]);
  }, [setSelectedSector]);

  const handleResultSelect = (result: SearchResult) => {
    const [lng, lat] = result.location.split(',').map(Number);
    if (!isNaN(lat) && !isNaN(lng)) {
      if (searchMode === 'coordinate') {
        // User input is WGS84; convert to GCJ-02 for AMap positioning
        const [gcjLat, gcjLng] = wgs84ToGcj02(lat, lng);
        setSelectedLocation({ lat: gcjLat, lng: gcjLng, name: result.name });
        setSearchMarker({ lat: gcjLat, lng: gcjLng, name: result.name });
        setMapCenter([gcjLat, gcjLng]);
        // Show original WGS84 coordinate in hint
        setCoordinateHint({ lat, lng, visible: true });
      } else {
        setSelectedLocation({ lat, lng, name: result.name });
        setSearchMarker({ lat, lng, name: result.name });
        setMapCenter([lat, lng]);
      }
    } else {
      Alert.alert('错误', '无效的坐标');
    }
  };

  const handleToggleMapType = () => {
    setMapType(mapType === 'roadmap' ? 'satellite' : 'roadmap');
  };

  const handleClear = () => {
    clearMeasure();
    clearMarkers();
    setSelectedLocation(null);
    setCoordinateHint(null);
    setSearchMarker(null);
    setSelectedSector(null);
  };

  const handleModeChange = (mode: SearchMode) => {
    setSearchMode(mode);
    setCoordinateMode(mode === 'coordinate');
  };

  // Sync search mode when coordinate mode changes externally
  useEffect(() => {
    if (coordinateMode && searchMode !== 'coordinate') {
      setSearchMode('coordinate');
    }
  }, [coordinateMode]);

  // Navigate to search result center
  useEffect(() => {
    if (mapCenter) {
      const key = `${mapCenter[0]},${mapCenter[1]}`;
      if (prevCenterRef.current !== key) {
        prevCenterRef.current = key;
      }
      // Reset after consumed
      const timer = setTimeout(() => setMapCenter(undefined), 100);
      return () => clearTimeout(timer);
    }
  }, [mapCenter]);

  const renderSearchBar = () => (
    <SearchBar
      onSearch={() => {}}
      onResultSelect={handleResultSelect}
      onModeChange={handleModeChange}
      placeholder={
        searchMode === 'coordinate'
          ? '输入经纬度，如: 113.123,23.456'
          : '搜索地点或小区...'
      }
    />
  );

  const renderCoordinateHint = () => {
    if (!coordinateHint || !coordinateHint.visible) return null;
    return (
      <View style={styles.coordinateHint}>
        <Text style={styles.coordinateHintText}>
          {coordinateHint.lat.toFixed(3)}, {coordinateHint.lng.toFixed(3)}
        </Text>
      </View>
    );
  };

  const renderOverlapModal = () => (
    <Modal
      animationType="slide"
      transparent={true}
      visible={showOverlapModal}
      onRequestClose={() => setShowOverlapModal(false)}
      statusBarTranslucent={true}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>选择扇区</Text>
          <Text style={styles.modalSubtitle}>
            该位置有 {overlapSectors.length} 个重叠扇区
          </Text>
          <FlatList
            data={overlapSectors}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.overlapItem}
                onPress={() => handleSelectOverlapSector(item)}
              >
                <View style={[styles.networkDot, {
                  backgroundColor: item.networkType === 'LTE' ? '#4CAF50' : '#2196F3'
                }]} />
                <View style={styles.overlapItemInfo}>
                  <Text style={styles.overlapItemName}>{item.name}</Text>
                  <Text style={styles.overlapItemDetail}>
                    {item.networkType} | {item.siteId || ''} | PCI: {item.pci || 'N/A'}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
            style={styles.overlapList}
          />
          <TouchableOpacity
            style={styles.modalCancelBtn}
            onPress={() => setShowOverlapModal(false)}
          >
            <Text style={styles.modalCancelText}>取消</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.searchContainer}>
        {renderSearchBar()}
      </View>
      <View style={styles.mapContainer}>
        <MapViewComponent
          initialCenter={mapCenter}
          showSatellite={mapType === 'satellite'}
          onMapPress={handleMapPress}
          onLongPress={handleLongPress}
          onSectorOverlap={handleSectorOverlap}
          onMeasureFinish={finishMeasure}
          onMeasureClear={clearMeasure}
        />
        <LayerControl />
        <MeasureControl />
        <MarkerList />
        {renderCoordinateHint()}
        <TouchableOpacity style={styles.mapTypeBtn} onPress={handleToggleMapType}>
          <Text style={styles.mapTypeBtnText}>
            {mapType === 'roadmap' ? '卫星' : '地图'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.measureBtn, measureMode && styles.measureBtnActive]}
          onPress={toggleMeasureMode}
        >
          <Text style={[styles.measureBtnText, measureMode && styles.measureBtnTextActive]}>
            {measureMode ? '退出测距' : '测距'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.clearBtn} onPress={handleClear}>
          <Text style={styles.clearBtnText}>清除</Text>
        </TouchableOpacity>
      </View>
      {selectedLocation && !measureMode && !coordinateMode && (
        <NavControl
          latitude={selectedLocation.lat}
          longitude={selectedLocation.lng}
          name={selectedLocation.name}
        />
      )}
      <SectorInfoPanel />
      {renderOverlapModal()}
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
  mapTypeBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  mapTypeBtnText: {
    fontSize: 13,
    color: '#333',
  },
  measureBtn: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  measureBtnActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  measureBtnText: {
    fontSize: 13,
    color: '#333',
  },
  measureBtnTextActive: {
    color: '#fff',
  },
  clearBtn: {
    position: 'absolute',
    top: 56,
    left: 10,
    backgroundColor: 'rgba(255,107,107,0.95)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ff6b6b',
  },
  clearBtnText: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '600',
  },
  coordinateHint: {
    position: 'absolute',
    bottom: 20,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  coordinateHintText: {
    color: '#fff',
    fontSize: 14,
    fontFamily: 'monospace',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    maxHeight: '60%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#888',
    marginBottom: 12,
  },
  overlapList: {
    maxHeight: 300,
  },
  overlapItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  networkDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  overlapItemInfo: {
    flex: 1,
  },
  overlapItemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  overlapItemDetail: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  modalCancelBtn: {
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  modalCancelText: {
    fontSize: 15,
    color: '#666',
    fontWeight: '600',
  },
});
