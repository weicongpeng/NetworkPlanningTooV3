// mobile-app/app/(tabs)/index.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, StyleSheet, SafeAreaView, Alert, TouchableOpacity, Text,
  Modal, FlatList, Switch, TextInput
} from 'react-native';
import MapViewComponent, { MapViewRef } from '../../src/components/Map/MapView';
import LayerControl from '../../src/components/Map/LayerControl';
import SectorInfoPanel from '../../src/components/Map/SectorInfoPanel';
import SearchBar, { SearchResult } from '../../src/components/Search/SearchBar';
import NavControl from '../../src/components/Navigation/NavControl';
import MarkerList from '../../src/components/Marker/MarkerList';
import MeasureControl from '../../src/components/Measure/MeasureControl';
import NavigationPanel from '../../src/components/Navigation/NavigationPanel';
import { useMapStore, SectorData } from '../../src/store/mapStore';
import { gcj02ToWgs84 } from '../../src/utils/coordinate';
import { apiService } from '../../src/services/api';
import { wgs84ToGcj02 } from '../../src/utils/coordinate';
import { getCurrentPosition } from '../../src/services/navigationService';

type SearchMode = 'place' | 'parameter' | 'coordinate';

export default function MapScreen() {
  const {
    mapType, setMapType, setBackendInfo, setConnected,
    measureMode, measureFinished, addMarker, addMeasurePoint,
    toggleMeasureMode, finishMeasure, clearMeasure,
    layers, toggleLayer, lteSectors, nrSectors,
    setSectors, setSelectedSector, selectedSector,
    setSearchMarker, markers, coordinateMode, setCoordinateMode,
    clearMarkers, measurePoints,
    markerMode, toggleMarkerMode, setMarkerMode,
    pendingNavi, setPendingNavi,
  } = useMapStore();

  const [selectedLocation, setSelectedLocation] = useState<{
    lat: number; lng: number; name: string;
  } | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number] | undefined>(undefined);
  const [searchMode, setSearchMode] = useState<SearchMode>('place');
  const [overlapSectors, setOverlapSectors] = useState<SectorData[]>([]);
  const [showOverlapModal, setShowOverlapModal] = useState(false);
  const [showSectorMenu, setShowSectorMenu] = useState(false);
  const [sectorMenuPos, setSectorMenuPos] = useState({ x: 0, y: 0 });
  const sectorBtnRef = useRef<View>(null);
  const mapRef = useRef<MapViewRef>(null);

  // 打点重命名弹框状态
  const [showMarkerNameModal, setShowMarkerNameModal] = useState(false);
  const [pendingMarkerCoords, setPendingMarkerCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [markerNameInput, setMarkerNameInput] = useState('');

  const prevCenterRef = useRef<string | null>(null);
  const [showNaviPanel, setShowNaviPanel] = useState(false);

  // 图层菜单状态
  const [showLayerMenu, setShowLayerMenu] = useState(false);
  const [layerMenuType, setLayerMenuType] = useState<'tab' | 'geo'>('tab');
  const [dataList, setDataList] = useState<any[]>([]);
  const [loadingLayers, setLoadingLayers] = useState(false);

  // 当 pendingNavi 被设置时，自动打开导航面板
  useEffect(() => {
    if (pendingNavi) {
      setShowNaviPanel(true);
    }
  }, [pendingNavi]);

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

  // 加载图层数据列表
  const loadDataList = async () => {
    try {
      setLoadingLayers(true);
      const response = await apiService.getDataList();
      if (response.success) {
        setDataList(response.data || []);
      }
    } catch (error) {
      console.error('Failed to load data list:', error);
    } finally {
      setLoadingLayers(false);
    }
  };

  // 处理TAB图层点击
  const handleTabLayerPress = () => {
    setShowSectorMenu(false);
    setLayerMenuType('tab');
    loadDataList();
    setShowLayerMenu(true);
  };

  // 处理地理化数据点击
  const handleGeoDataPress = () => {
    setShowSectorMenu(false);
    setLayerMenuType('geo');
    loadDataList();
    setShowLayerMenu(true);
  };

  // 通过后端接口加载渲染数据（坐标已预处理为GCJ02）- 直接注入到WebView
  const loadMobileRenderData = async (dataId: string, dataName?: string) => {
    try {
      const injectJS = (code: string) => mapRef.current?.injectJavaScript(code);

      const response = await apiService.getMobileRenderData(dataId);
      if (!response.success || !response.data) {
        Alert.alert('错误', '无法获取渲染数据');
        return;
      }
      const renderData = response.data;

      if (renderData.dataType === 'tab') {
        const layers = renderData.layers || [];
        if (layers.length === 0) {
          Alert.alert('提示', '该文件没有可用的图层');
          return;
        }
        // 先注入一个测试点验证渲染管线正常
        const testGeoJSON = {"type":"FeatureCollection","features":[{"type":"Feature","geometry":{"type":"Point","coordinates":[114.7,23.74]},"properties":{"name":"test"}}]};
        injectJS(`window.updateTabLayerGCJ('__test__', ${JSON.stringify(testGeoJSON)});`);
        // 再渲染实际图层
        if (layers.length === 1) {
          const layerKey = dataId + '_' + layers[0].id;
          injectJS(`window.updateTabLayerGCJ('${layerKey}', ${JSON.stringify(layers[0].geojson)});`);
          Alert.alert('成功', `TAB图层 "${layers[0].name}" 已加载到地图`);
        } else {
          Alert.alert(
            '选择图层',
            `该文件包含 ${layers.length} 个图层`,
            layers.slice(0, 5).map((l: any) => ({
              text: l.name || l.id,
              onPress: () => {
                const layerKey = dataId + '_' + l.id;
                injectJS(`window.updateTabLayerGCJ('${layerKey}', ${JSON.stringify(l.geojson)});`);
                Alert.alert('成功', `TAB图层 "${l.name}" 已加载到地图`);
              }
            })).concat([{ text: '取消', style: 'cancel' as const }])
          );
        }
      } else if (renderData.dataType === 'geo') {
        const geometryType = renderData.geometryType || 'point';
        const features = renderData.features || [];
        if (features.length === 0) {
          Alert.alert('提示', '该文件中没有数据');
          return;
        }
        injectJS(`window.updateGeoDataLayer('${dataId}', '${geometryType}', ${JSON.stringify(features)});`);
        Alert.alert('成功', `已加载 "${dataName || dataId}" (${features.length}条, ${geometryType})`);
      } else {
        Alert.alert('错误', '不支持的数据类型');
      }
    } catch (error) {
      console.error('[MapScreen] 加载渲染数据失败:', error);
      Alert.alert('错误', '加载渲染数据失败:' + String(error));
    }
  };

  // 获取过滤后的数据列表（根据当前菜单类型）
  const filteredDataList = dataList.filter(item => {
    if (layerMenuType === 'tab') {
      // TAB图层：MapInfo文件 (subType === 'mapinfo' 或 type === 'map')
      return item.type === 'map' || item.subType === 'mapinfo';
    } else {
      // 地理化数据：Excel文件且包含地理化数据 (geometryType 或 fileType === 'geo_data')
      return item.type === 'excel' && (item.geometryType != null || item.fileType === 'geo_data');
    }
  });

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
        // Keep current layer visibility (default all off)
      }
    } catch (error) {
      console.error('Failed to load sectors:', error);
    }
  };

  const handleMapPress = useCallback((lat: number, lng: number) => {
    console.log('[MapScreen] handleMapPress:', lat, lng);
    if (showSectorMenu) {
      setShowSectorMenu(false);
      return;
    }
    if (markerMode) {
      // 打点模式：弹出重命名弹框
      const now = new Date();
      const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
      setPendingMarkerCoords({ lat, lng });
      setMarkerNameInput(`打点 ${timeStr}`);
      setShowMarkerNameModal(true);
      return;
    }
    if (measureMode) {
      addMeasurePoint(lat, lng);
    } else if (coordinateMode) {
      // Coordinate mode: map press does nothing
      // Coordinate lookup is done via search input, not map tap
      return;
    } else {
      // 空白地图点击不设置 selectedLocation，避免无意义地弹出导航控件
      setSelectedLocation(null);
    }
  }, [measureMode, coordinateMode, addMeasurePoint, showSectorMenu, markerMode, addMarker]);

  const handleLongPress = useCallback((lat: number, lng: number) => {
    // AMap 返回 GCJ-02，存储为 WGS84
    const [wgsLat, wgsLng] = gcj02ToWgs84(lat, lng);
    addMarker(wgsLat, wgsLng, `标记 ${Date.now()}`);
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
      if (searchMode === 'coordinate' || searchMode === 'parameter') {
        // coordinate: 用户输入 WGS84；parameter: 后端返回 WGS84
        // 均转换为 GCJ-02 用于高德地图定位
        const [gcjLat, gcjLng] = wgs84ToGcj02(lat, lng);
        setSelectedLocation({ lat: gcjLat, lng: gcjLng, name: result.name });
        setSearchMarker({ lat: gcjLat, lng: gcjLng, name: result.name });
        setMapCenter([gcjLat, gcjLng]);

      } else {
        // place 模式：高德 POI 接口返回的已是 GCJ-02，直接使用
        setSelectedLocation({ lat, lng, name: result.name });
        setSearchMarker({ lat, lng, name: result.name });
        setMapCenter([lat, lng]);
      }
    } else {
      Alert.alert('错误', '无效的坐标');
    }
  };

  const handleToggleMapType = () => {
    setShowSectorMenu(false);
    setMapType(mapType === 'roadmap' ? 'satellite' : 'roadmap');
  };

  // 定位到手机当前位置
  const handleLocateMe = useCallback(async () => {
    const pos = await getCurrentPosition();
    if (pos && mapRef?.current) {
      const [gcjLat, gcjLng] = wgs84ToGcj02(pos.lat, pos.lng);
      mapRef.current.locateMe(gcjLat, gcjLng, 16);
    } else {
      Alert.alert('定位失败', '无法获取当前位置，请检查GPS权限');
    }
  }, []);

  const handleClear = () => {
    setShowSectorMenu(false);
    setMarkerMode(false);
    clearMeasure();
    clearMarkers();
    setSelectedLocation(null);
    setSearchMarker(null);
    setSelectedSector(null);
    // 清除所有已加载的图层
    const injectJS = (code: string) => mapRef.current?.injectJavaScript(code);
    injectJS('Object.keys(tabLayerGroups).forEach(function(k) { window.removeTabLayer(k); });');
    injectJS('Object.keys(geoDataLayerGroups).forEach(function(k) { window.removeGeoDataLayer(k); });');
  };

  const handleConfirmMarkerName = () => {
    if (pendingMarkerCoords) {
      const name = markerNameInput.trim() || '未命名';
      // AMap 返回 GCJ-02，存储为 WGS84
      const [wgsLat, wgsLng] = gcj02ToWgs84(pendingMarkerCoords.lat, pendingMarkerCoords.lng);
      addMarker(wgsLat, wgsLng, name);
    }
    setShowMarkerNameModal(false);
    setPendingMarkerCoords(null);
    setMarkerNameInput('');
  };

  const handleCancelMarkerName = () => {
    setShowMarkerNameModal(false);
    setPendingMarkerCoords(null);
    setMarkerNameInput('');
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

  const handleSearch = useCallback(() => {}, []);

  const renderSearchBar = () => (
    <SearchBar
      onSearch={handleSearch}
      onResultSelect={handleResultSelect}
      onModeChange={handleModeChange}
      placeholder={
        searchMode === 'coordinate'
          ? '输入经纬度，如: 113.123,23.456'
          : '搜索地点或小区...'
      }
    />
  );

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
          ref={mapRef}
          initialCenter={mapCenter}
          showSatellite={mapType === 'satellite'}
          onMapPress={handleMapPress}
          onLongPress={handleLongPress}
          onSectorOverlap={handleSectorOverlap}
          onMeasureFinish={finishMeasure}
          onMeasureClear={clearMeasure}
        />
        <View style={styles.toolBar}>
          <TouchableOpacity
            style={[styles.toolBtn, measureMode && styles.toolBtnActive]}
            onPress={() => {
              setShowSectorMenu(false);
              toggleMeasureMode();
            }}
          >
            <Text style={[styles.toolBtnText, measureMode && styles.toolBtnTextActive]}>
              {measureMode ? '退出测距' : '测距'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.toolBtn, styles.clearToolBtn]} onPress={handleClear}>
            <Text style={[styles.toolBtnText, styles.clearToolBtnText]}>清除</Text>
          </TouchableOpacity>
          <LayerControl
            ref={sectorBtnRef}
            active={showSectorMenu}
            onPress={() => {
              if (!showSectorMenu) {
                sectorBtnRef.current?.measureInWindow((x, y, width, height) => {
                  setSectorMenuPos({ x, y: y + height });
                  setShowSectorMenu(true);
                });
              } else {
                setShowSectorMenu(false);
              }
            }}
          />
          <TouchableOpacity
            style={[styles.toolBtn, markerMode && styles.toolBtnActive]}
            onPress={() => {
              setShowSectorMenu(false);
              toggleMarkerMode();
            }}
          >
            <Text style={[styles.toolBtnText, markerMode && styles.toolBtnTextActive]}>
              {markerMode ? '退出打点' : '打点'}
            </Text>
          </TouchableOpacity>
        </View>
        {showSectorMenu && (
          <View style={[styles.sectorDropdown, { top: sectorMenuPos.y, left: sectorMenuPos.x }]}>
            <TouchableOpacity style={styles.sectorMenuItem} activeOpacity={1} onPress={() => {}}>
              <View style={styles.sectorLayerInfo}>
                <View style={[styles.sectorColorDot, { backgroundColor: '#4CAF50' }]} />
                <Text style={styles.sectorLayerName}>LTE</Text>
              </View>
              <Switch
                value={layers.lte.visible}
                onValueChange={() => toggleLayer('lte')}
                trackColor={{ false: '#ddd', true: '#4CAF50' }}
                style={{ transform: [{ scaleX: 0.55 }, { scaleY: 0.55 }] }}
              />
            </TouchableOpacity>
            <TouchableOpacity style={styles.sectorMenuItem} activeOpacity={1} onPress={() => {}}>
              <View style={styles.sectorLayerInfo}>
                <View style={[styles.sectorColorDot, { backgroundColor: '#2196F3' }]} />
                <Text style={styles.sectorLayerName}>NR</Text>
              </View>
              <Switch
                value={layers.nr.visible}
                onValueChange={() => toggleLayer('nr')}
                trackColor={{ false: '#ddd', true: '#2196F3' }}
                style={{ transform: [{ scaleX: 0.55 }, { scaleY: 0.55 }] }}
              />
            </TouchableOpacity>
            <View style={styles.dropdownDivider} />
            <TouchableOpacity style={styles.sectorMenuItem} activeOpacity={1} onPress={handleTabLayerPress}>
              <View style={styles.sectorLayerInfo}>
                <View style={[styles.sectorColorDot, { backgroundColor: '#FF9800' }]} />
                <Text style={styles.sectorLayerName}>TAB图层</Text>
              </View>
              <Text style={styles.dropdownArrow}>›</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sectorMenuItem} activeOpacity={1} onPress={handleGeoDataPress}>
              <View style={styles.sectorLayerInfo}>
                <View style={[styles.sectorColorDot, { backgroundColor: '#9C27B0' }]} />
                <Text style={styles.sectorLayerName}>地理化数据</Text>
              </View>
              <Text style={styles.dropdownArrow}>›</Text>
            </TouchableOpacity>
          </View>
        )}
        <MeasureControl />
        <MarkerList />
        <TouchableOpacity style={styles.mapTypeBtn} onPress={handleToggleMapType}>
          <Text style={styles.mapTypeBtnText}>
            {mapType === 'roadmap' ? '卫星' : '地图'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.locateBtn} onPress={handleLocateMe}>
          <Text style={styles.locateBtnText}>📍</Text>
        </TouchableOpacity>
      </View>
      {selectedLocation && !measureMode && !markerMode && (
        <NavControl
          latitude={selectedLocation.lat}
          longitude={selectedLocation.lng}
          name={selectedLocation.name}
        />
      )}
      <SectorInfoPanel />
      {renderOverlapModal()}
      <NavigationPanel
        visible={showNaviPanel}
        destLat={pendingNavi?.lat ?? 0}
        destLng={pendingNavi?.lng ?? 0}
        destName={pendingNavi?.name ?? '目的地'}
        onClose={() => {
          setShowNaviPanel(false);
          setPendingNavi(null);
        }}
        mapRef={mapRef as any}
      />

      {/* 打点重命名弹框 */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={showMarkerNameModal}
        onRequestClose={handleCancelMarkerName}
      >
        <View style={styles.markerNameModalOverlay}>
          <View style={styles.markerNameModalContent}>
            <Text style={styles.markerNameModalTitle}>标记名称</Text>
            <TextInput
              style={styles.markerNameInput}
              value={markerNameInput}
              onChangeText={setMarkerNameInput}
              placeholder="输入标记名称"
              autoFocus={true}
              selectTextOnFocus={true}
            />
            <View style={styles.markerNameModalActions}>
              <TouchableOpacity style={styles.markerNameModalBtn} onPress={handleCancelMarkerName}>
                <Text style={styles.markerNameModalBtnText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.markerNameModalBtn, styles.markerNameModalBtnPrimary]} onPress={handleConfirmMarkerName}>
                <Text style={[styles.markerNameModalBtnText, styles.markerNameModalBtnPrimaryText]}>确定</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 图层选择弹框 */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showLayerMenu}
        onRequestClose={() => setShowLayerMenu(false)}
        statusBarTranslucent={true}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.layerModalContent}>
            <View style={styles.layerModalHeader}>
              <Text style={styles.layerModalTitle}>
                {layerMenuType === 'tab' ? 'TAB图层' : '地理化数据'}
              </Text>
              <TouchableOpacity onPress={() => setShowLayerMenu(false)}>
                <Text style={styles.layerModalClose}>×</Text>
              </TouchableOpacity>
            </View>
            {loadingLayers ? (
              <View style={styles.layerModalLoading}>
                <Text style={styles.layerModalLoadingText}>加载中...</Text>
              </View>
            ) : dataList.length === 0 ? (
              <View style={styles.layerModalEmpty}>
                <Text style={styles.layerModalEmptyText}>暂无可用图层</Text>
                <Text style={styles.layerModalEmptyHint}>
                  请在桌面端「数据管理」导入数据
                </Text>
              </View>
            ) : filteredDataList.length === 0 ? (
              <View style={styles.layerModalEmpty}>
                <Text style={styles.layerModalEmptyText}>暂无可用图层</Text>
                <Text style={styles.layerModalEmptyHint}>
                  {layerMenuType === 'tab'
                    ? '请在桌面端导入 MapInfo 格式的图层文件'
                    : '请在桌面端导入带有经纬度坐标的Excel文件'}
                </Text>
              </View>
            ) : (
              <FlatList
                data={filteredDataList}
                keyExtractor={(item) => item.id}
                renderItem={({ item, index }) => (
                  <TouchableOpacity
                    style={styles.layerItem}
                    onPress={() => {
                      setShowLayerMenu(false);
                      loadMobileRenderData(item.id, item.name);
                    }}
                  >
                    <View style={styles.layerItemInfo}>
                      <Text style={styles.layerItemName} numberOfLines={1}>
                        {item.name || `文件 ${index + 1}`}
                      </Text>
                      <Text style={styles.layerItemType}>
                        {item.metadata?.layerCount
                          ? `${item.metadata.layerCount} 个图层`
                          : item.geometryType
                            ? `${item.geometryType} 要素`
                            : item.type === 'map' ? 'MapInfo' : 'Excel'}
                      </Text>
                    </View>
                    <Text style={styles.dropdownArrow}>›</Text>
                  </TouchableOpacity>
                )}
                style={styles.layerList}
              />
            )}
          </View>
        </View>
      </Modal>
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
  toolBar: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    zIndex: 60,
  },
  toolBtn: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  toolBtnActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  toolBtnText: {
    fontSize: 13,
    color: '#333',
  },
  toolBtnTextActive: {
    color: '#fff',
  },
  clearToolBtn: {
    backgroundColor: 'rgba(255,107,107,0.95)',
    borderColor: '#ff6b6b',
  },
  clearToolBtnText: {
    color: '#fff',
    fontWeight: '600',
  },
  sectorDropdown: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    width: 140,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 8,
    zIndex: 200,
  },
  sectorMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  sectorLayerInfo: { flexDirection: 'row', alignItems: 'center' },
  sectorColorDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  sectorLayerName: { fontSize: 12, color: '#333' },
  dropdownSection: {
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    marginBottom: 4,
  },
  dropdownSectionTitle: {
    fontSize: 11,
    color: '#888',
    fontWeight: '600',
  },
  dropdownDivider: {
    height: 1,
    backgroundColor: '#eee',
    marginVertical: 4,
  },
  dropdownArrow: {
    fontSize: 14,
    color: '#999',
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
  markerNameModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: '35%',
  },
  markerNameModalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '80%',
    maxWidth: 320,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 10,
  },
  markerNameModalTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  markerNameInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#333',
    marginBottom: 16,
  },
  markerNameModalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  markerNameModalBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#f5f5f5',
  },
  markerNameModalBtnPrimary: {
    backgroundColor: '#007AFF',
  },
  markerNameModalBtnText: {
    fontSize: 15,
    color: '#666',
    fontWeight: '600',
  },
  markerNameModalBtnPrimaryText: {
    color: '#fff',
  },
  locateBtn: {
    position: 'absolute',
    bottom: 20,
    right: 10,
    backgroundColor: 'rgba(255,255,255,0.95)',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 6,
    zIndex: 60,
  },
  locateBtnText: {
    fontSize: 20,
  },
  // 图层选择弹框样式
  layerModalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    maxHeight: '70%',
  },
  layerModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  layerModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  layerModalClose: {
    fontSize: 28,
    color: '#999',
    paddingHorizontal: 8,
  },
  layerModalLoading: {
    padding: 40,
    alignItems: 'center',
  },
  layerModalLoadingText: {
    fontSize: 14,
    color: '#666',
  },
  layerModalEmpty: {
    padding: 40,
    alignItems: 'center',
  },
  layerModalEmptyText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  layerModalEmptyHint: {
    fontSize: 12,
    color: '#999',
  },
  layerList: {
    maxHeight: 400,
  },
  layerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  layerItemInfo: {
    flex: 1,
  },
  layerItemName: {
    fontSize: 14,
    color: '#333',
    marginBottom: 2,
  },
  layerItemType: {
    fontSize: 12,
    color: '#888',
  },
});
