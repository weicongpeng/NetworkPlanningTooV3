/**
 * 在线地图组件 - 使用高德地图 + Leaflet
 *
 * 功能:
 * - 支持平面地图和卫星地图切换
 * - 使用智能LOD扇区渲染器绘制LTE/NR扇区
 * - 支持点击扇区查看属性信息（带淡出动画）
 * - 默认位置：河源市
 * - 集成坐标转换服务 (WGS84 ↔ GCJ02)
 * - 支持图层控制 (LTE/NR切换)
 * - 支持MapInfo图层渲染
 * - 状态保持：页面切换时保持地图位置和缩放
 */
import { useEffect, useRef, useState, forwardRef, useImperativeHandle, useCallback } from 'react'
import { Loader2, Layers, Map as MapIcon } from 'lucide-react'
import L from 'leaflet'
import { mapDataService, RenderSectorData } from '../../services/mapDataService'
import { CoordinateTransformer } from '../../utils/coordinate'
import { createSectorLayer } from './SectorRendererSVG'
import { SectorInfoPanel, useSectorInfoPanel } from './SectorInfoPanel'
import { NetworkType } from '../../config/sector-config'
import { MapInfoLayerManager, MapInfoLayerOptions, LayerGeometryType } from './MapInfoLayer'
import { layerApi } from '../../services/api'
import { mapStateService } from '../../services/mapStateService'
import { SectorSVGLayer } from './SectorRendererSVG'

type MapLayerType = 'satellite' | 'roadmap'

/**
 * 搜索标记接口
 */
interface SearchMarker {
  lng: number
  lat: number
  name: string
}

/**
 * 图层可见性配置
 */
interface LayerVisibility {
  lte: boolean
  nr: boolean
}

/**
 * MapInfo图层文件配置
 */
interface LayerFileOption {
  id: string
  name: string
  type: 'point' | 'line' | 'polygon'
  visible: boolean
  dataId: string
}

/**
 * 在线地图组件属性
 */
interface OnlineMapProps {
  /** 数据源文件名 */
  dataSourceFileName?: string
  /** MapInfo图层文件列表 */
  layerFiles?: LayerFileOption[]
  /** 视图模式变化回调 */
  onViewModeChange?: (mode: 'online' | 'offline') => void
  /** 测距模式 */
  measureMode?: boolean
  /** 结束测距模式回调 */
  onMeasureModeEnd?: () => void
}

/**
 * 定位标记接口
 */
interface LocationMarker {
  id: string
  lng: number
  lat: number
}

/**
 * 暴露给父组件的方法
 */
export interface OnlineMapRef {
  /** 飞到指定位置 */
  flyTo: (latLng: [number, number], zoom?: number) => void
  /** 设置搜索标记 */
  setSearchMarker: (marker: SearchMarker | null) => void
  /** 清除搜索标记 */
  clearSearchMarker: () => void
  /** 设置图层可见性 */
  setLayerVisibility: (layer: 'lte' | 'nr', visible: boolean) => void
  /** 设置扇区标签可见性 */
  setSectorLabelVisibility: (layer: 'lte' | 'nr', visible: boolean) => void
  /** 设置MapInfo图层可见性 */
  setMapInfoLayerVisibility: (layerId: string, visible: boolean) => void
  /** 设置地图类型 */
  setMapType: (type: 'roadmap' | 'satellite') => void
  /** 切换地图类型 */
  toggleMapType: () => void
  /** 刷新地图数据 */
  refreshData: () => Promise<void>
  /** 添加定位标记 */
  addLocationMarker: (marker: LocationMarker, index: number) => void
  /** 清除所有定位标记 */
  clearLocationMarkers: () => void
  /** 清除所有测量 */
  clearMeasurements: () => void
}

export const OnlineMap = forwardRef<OnlineMapRef, OnlineMapProps>(({
  dataSourceFileName,
  layerFiles = [],
  onViewModeChange,
  measureMode = false,
  onMeasureModeEnd
}, ref) => {
  // Refs
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const leafletRef = useRef<any>(null)
  const searchMarkerRef = useRef<Array<any>>([]) // 改为数组，支持多个搜索标记
  const locationMarkersRef = useRef<Array<any>>([]) // 定位标记数组
  const measurementLinesRef = useRef<Array<any>>([]) // 测量线条数组
  const measurementMarkersRef = useRef<Array<any>>([]) // 测量点标记数组
  const measurementDistanceRef = useRef<any>(null) // 距离显示标签
  const tileLayerRef = useRef<any>(null)
  const isUserInteractingRef = useRef(false)
  const isInitializingRef = useRef(false) // 防止 React Strict Mode 双重初始化
  const initializedRef = useRef(false) // 跟踪是否已初始化过（跨 Strict Mode 双重调用）

  // 扇区图层引用
  const lteSectorLayerRef = useRef<SectorSVGLayer | null>(null)
  const nrSectorLayerRef = useRef<SectorSVGLayer | null>(null)

  // MapInfo图层管理器引用
  const mapInfoLayerManagerRef = useRef<MapInfoLayerManager | null>(null)

  // 已加载的MapInfo图层ID集合（用于避免重复加载）
  const loadedMapInfoLayersRef = useRef<Set<string>>(new Set())

  // 扇区信息面板
  const {
    selectedSector,
    panelVisible,
    clickPosition,
    showSectorInfo,
    hideSectorInfo
  } = useSectorInfoPanel()

  // 移除悬停状态管理，改为仅使用点击事件显示属性

  // State
  const [loading, setLoading] = useState(true)
  const [isMapInitialized, setIsMapInitialized] = useState(false)
  const [mapLayerType, setMapLayerType] = useState<MapLayerType>(() => mapStateService.getState().mapLayerType)
  const [layerVisibility, setLayerVisibility] = useState<LayerVisibility>({
    lte: true,
    nr: true
  })
  const [labelVisibility, setLabelVisibility] = useState<LayerVisibility>({
    lte: false,
    nr: false
  })
  const [sectorData, setSectorData] = useState<{
    lte: RenderSectorData[]
    nr: RenderSectorData[]
  }>({ lte: [], nr: [] })

  // 测量相关状态
  const [measurePoints, setMeasurePoints] = useState<Array<{ lng: number; lat: number }>>([])
  const [totalDistance, setTotalDistance] = useState<number | null>(null)

  /**
   * 暴露方法给父组件
   */
  useImperativeHandle(ref, () => ({
    flyTo: (latLng: [number, number], zoom = 14) => {
      if (mapInstanceRef.current) {
        isUserInteractingRef.current = true
        mapInstanceRef.current.flyTo(latLng, zoom, { duration: 1.5 })
      }
    },

    setSearchMarker: (marker: SearchMarker | null) => {
      if (!mapInstanceRef.current || !window.L) return

      const L = window.L

      // 添加新的搜索标记
      if (marker) {
        const icon = L.divIcon({
          html: `<div style="background-color: #ef4444; width: 24px; height: 24px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3);"></div>`,
          className: 'search-marker-icon',
          iconSize: [24, 24],
          iconAnchor: [12, 24]
        })

        const mapMarker = L.marker([marker.lat, marker.lng], { icon })
          .addTo(mapInstanceRef.current)

        // 将GCJ02坐标转换为WGS84坐标，以便显示准确的标准坐标
        const [wgsLat, wgsLng] = CoordinateTransformer.gcj02ToWgs84(marker.lat, marker.lng)
        
        const popupContent = `
          <div style="padding: 8px; min-width: 150px;">
            <h3 style="margin: 0 0 5px 0; font-size: 14px; color: #ef4444;">${marker.name}</h3>
            <p style="margin: 0; font-size: 12px; color: #666;">
              ${wgsLat.toFixed(6)}, ${wgsLng.toFixed(6)}
            </p>
          </div>
        `
        mapMarker.bindPopup(popupContent).openPopup()
        searchMarkerRef.current.push(mapMarker) // 添加到数组中，支持多个标记
      }
    },

    clearSearchMarker: () => {
      if (!mapInstanceRef.current) return
      
      // 移除所有搜索标记
      searchMarkerRef.current.forEach(marker => {
        mapInstanceRef.current?.removeLayer(marker)
      })
      searchMarkerRef.current = [] // 清空数组
    },

    setLayerVisibility: (layer: 'lte' | 'nr', visible: boolean) => {
      setLayerVisibility(prev => ({ ...prev, [layer]: visible }))
    },

    setSectorLabelVisibility: (layer: 'lte' | 'nr', visible: boolean) => {
      console.log('[OnlineMap] setSectorLabelVisibility called:', layer, visible)
      setLabelVisibility(prev => ({ ...prev, [layer]: visible }))
    },

    setMapInfoLayerVisibility: (layerId: string, visible: boolean) => {
      if (mapInfoLayerManagerRef.current) {
        mapInfoLayerManagerRef.current.setLayerVisibility(layerId, visible)
      }
    },

    setMapType: (type: 'roadmap' | 'satellite') => {
      console.log('[OnlineMap] setMapType called with type:', type)
      setMapLayerType(type)
      mapStateService.setState({ mapLayerType: type })
      // 图层更新由useEffect钩子统一处理，不直接操作图层
    },

    toggleMapType: () => {
      toggleMapType()
    },

    refreshData: async () => {
      await loadSectorData()
    },

    addLocationMarker: (marker: LocationMarker, index: number) => {
      if (!mapInstanceRef.current || !window.L) return

      const L = window.L
      const map = mapInstanceRef.current

      // 创建定位标记图标 - 红色
      const icon = L.divIcon({
        html: `<div style="background-color: #ef4444; width: 20px; height: 20px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); border: 2px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3);"></div>`,
        className: 'location-marker-icon',
        iconSize: [20, 20],
        iconAnchor: [10, 20]
      })

      // 创建标记
      const mapMarker = L.marker([marker.lat, marker.lng], { icon })
        .addTo(map)

      // 添加弹窗信息 - 定位点编号和经纬度
      mapMarker.bindPopup(`
        <div style="padding: 8px; min-width: 150px;">
          <h3 style="margin: 0 0 5px 0; font-size: 14px; color: #ef4444;">定位点${index}</h3>
          <p style="margin: 0; font-size: 12px; color: #666;">
            经度: ${marker.lng.toFixed(6)}<br>
            纬度: ${marker.lat.toFixed(6)}
          </p>
        </div>
      `)

      // 默认展开弹窗
      mapMarker.openPopup()

      // 添加到定位标记数组
      locationMarkersRef.current.push(mapMarker)
    },

    clearLocationMarkers: () => {
      if (!mapInstanceRef.current) return
      
      // 移除所有定位标记
      locationMarkersRef.current.forEach(marker => {
        mapInstanceRef.current?.removeLayer(marker)
      })
      locationMarkersRef.current = []
    },

    clearMeasurements: () => {
      if (!mapInstanceRef.current) return
      
      // 移除所有测量线条
      measurementLinesRef.current.forEach(line => {
        mapInstanceRef.current?.removeLayer(line)
      })
      measurementLinesRef.current = []

      // 移除所有测量点标记
      measurementMarkersRef.current.forEach(marker => {
        mapInstanceRef.current?.removeLayer(marker)
      })
      measurementMarkersRef.current = []

      // 移除距离显示标签
      if (measurementDistanceRef.current) {
        mapInstanceRef.current.removeLayer(measurementDistanceRef.current)
        measurementDistanceRef.current = null
      }
    }
  }))

  /**
   * 加载扇区数据（不自动调整地图位置）
   */
  const loadSectorData = useCallback(async () => {
    try {
      const zoom = mapInstanceRef.current?.getZoom() ?? mapStateService.getState().zoom
      const data = await mapDataService.getMapData(zoom)

      setSectorData({
        lte: data.lteSectors,
        nr: data.nrSectors
      })

      // 统计覆盖类型
      const lteCoverType1 = data.lteSectors.filter(s => s.cell_cover_type === 1).length
      const lteCoverType4 = data.lteSectors.filter(s => s.cell_cover_type === 4).length
      const nrCoverType1 = data.nrSectors.filter(s => s.cell_cover_type === 1).length
      const nrCoverType4 = data.nrSectors.filter(s => s.cell_cover_type === 4).length

      console.log('[OnlineMap] 扇区数据加载完成:', {
        lte: data.lteSectors.length,
        nr: data.nrSectors.length,
        coverType: {
          lte: { type1: lteCoverType1, type4: lteCoverType4 },
          nr: { type1: nrCoverType1, type4: nrCoverType4 }
        }
      })
    } catch (error) {
      console.error('[OnlineMap] 加载扇区数据失败:', error)
    }
  }, [])

  /**
   * 处理扇区点击事件 - 显示属性面板
   */
  const handleSectorClick = useCallback((sector: RenderSectorData, event: L.LeafletMouseEvent) => {
    console.log('[OnlineMap] 扇区点击事件触发:', {
      name: sector.name,
      networkType: sector.networkType,
      cell_cover_type: sector.cell_cover_type,
      siteId: sector.siteId,
      sectorId: sector.sectorId,
      pci: sector.pci,
      lat: sector.displayLat,
      lng: sector.displayLng
    })
    showSectorInfo(sector, event)
  }, [showSectorInfo])

  // 移除悬停事件处理函数，仅使用点击事件

  /**
   * 计算两点之间的距离
   */
  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6378137 // 地球半径（米）
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLng = (lng2 - lng1) * Math.PI / 180
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }

  /**
   * 处理地图点击事件
   */
  const handleMapClick = useCallback((event: any) => {
    hideSectorInfo()
    
    // 如果处于测量模式，处理测量点点击
    if (measureMode && mapInstanceRef.current && leafletRef.current) {
      const L = leafletRef.current
      const map = mapInstanceRef.current
      const latLng = event.latlng
      
      // 确保测量图层在顶层显示 - 使用overlay pane
      let measurementPane = map.getPane('measurement')
      if (!measurementPane) {
        measurementPane = map.createPane('measurement')
        measurementPane.style.zIndex = '1000' // 在tile pane(200)和overlay pane(400)之上
      }
      
      // 添加测量点
      const newPoint = { lng: latLng.lng, lat: latLng.lat }
      const updatedPoints = [...measurePoints, newPoint]
      setMeasurePoints(updatedPoints)
      
      // 创建测量点标记 - 添加到顶层pane
      const icon = L.divIcon({
        html: `<div style="background-color: #ef4444; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
        className: 'measure-point-icon',
        iconSize: [12, 12],
        iconAnchor: [6, 6]
      })
      
      const marker = L.marker([latLng.lat, latLng.lng], { 
        icon,
        pane: 'measurement'
      }).addTo(map)
      measurementMarkersRef.current.push(marker)
      
      // 如果有至少两个点，绘制或更新测量线条 - 添加到顶层pane
      if (updatedPoints.length >= 2) {
        // 移除旧的测量线条
        measurementLinesRef.current.forEach(line => {
          map.removeLayer(line)
        })
        measurementLinesRef.current = []
        
        // 绘制新的测量线条
        const polyline = L.polyline(
          updatedPoints.map(p => [p.lat, p.lng]),
          {
            color: '#ef4444',
            weight: 3,
            opacity: 1,
            pane: 'measurement'
          }
        ).addTo(map)
        measurementLinesRef.current.push(polyline)
        
        // 计算总距离
        let totalDist = 0
        for (let i = 0; i < updatedPoints.length - 1; i++) {
          const p1 = updatedPoints[i]
          const p2 = updatedPoints[i + 1]
          totalDist += calculateDistance(p1.lat, p1.lng, p2.lat, p2.lng)
        }
        setTotalDistance(totalDist)
        
        // 显示距离信息 - 添加到顶层pane
        if (measurementDistanceRef.current) {
          map.removeLayer(measurementDistanceRef.current)
        }
        
        const lastPoint = updatedPoints[updatedPoints.length - 1]
        const distanceMarker = L.marker([lastPoint.lat, lastPoint.lng], {
          icon: L.divIcon({
            html: `<div style="position: relative; display: inline-block;">
              <div style="background-color: rgba(255, 255, 255, 0.9); padding: 4px 8px; border-radius: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.15); font-size: 12px; color: #ef4444;">
                ${totalDist.toFixed(0)}米
              </div>
              <button onclick="javascript:event.stopPropagation(); window.removeMeasurement()" style="background: #ef4444; color: white; border: none; font-size: 10px; cursor: pointer; padding: 0; line-height: 1; width: 16px; height: 16px; border-radius: 50%; display: flex; align-items: center; justify-content: center; position: absolute; top: -6px; right: -6px; box-shadow: 0 1px 3px rgba(0,0,0,0.2);">
                ✕
                </button>
            </div>`,
            className: 'distance-marker',
            iconSize: [80, 32],
            iconAnchor: [40, -16]
          }),
          zIndexOffset: 3000,
          pane: 'measurement'
        }).addTo(map)
        measurementDistanceRef.current = distanceMarker
        
        // 添加全局删除测量函数
        ;(window as any).removeMeasurement = () => {
          // 清除所有测量线条
          measurementLinesRef.current.forEach(line => {
            mapInstanceRef.current?.removeLayer(line)
          })
          measurementLinesRef.current = []
          
          // 清除所有测量点标记
          measurementMarkersRef.current.forEach(m => {
            mapInstanceRef.current?.removeLayer(m)
          })
          measurementMarkersRef.current = []
          
          // 清除距离信息标记
          if (measurementDistanceRef.current) {
            mapInstanceRef.current.removeLayer(measurementDistanceRef.current)
            measurementDistanceRef.current = null
          }
          
          // 重置测量状态
          setMeasurePoints([])
          setTotalDistance(null)
          // 不结束测量模式，只清除当前轨迹
        }
      }
    }
  }, [measureMode, measurePoints, hideSectorInfo])

  /**
   * 处理地图右键事件，用于结束测量或释放测距模式
   */
  const handleMapContextMenu = useCallback((event: any) => {
    // 阻止默认右键菜单
    event.originalEvent.preventDefault()
    
    // 如果处于测量模式，结束测量并退出测量模式
    if (measureMode) {
      // 调用回调通知父组件结束测量模式
      onMeasureModeEnd?.()
    }
  }, [measureMode, onMeasureModeEnd])

  /**
   * 当测量模式改变时，清除历史数据
   */
  useEffect(() => {
    if (!measureMode) {
      // 退出测量模式时，清除所有历史测量数据
      if (mapInstanceRef.current) {
        // 清除所有测量线条
        measurementLinesRef.current.forEach(line => {
          mapInstanceRef.current?.removeLayer(line)
        })
        measurementLinesRef.current = []
        
        // 清除所有测量点标记
        measurementMarkersRef.current.forEach(m => {
          mapInstanceRef.current?.removeLayer(m)
        })
        measurementMarkersRef.current = []
        
        // 清除距离信息标记
        if (measurementDistanceRef.current) {
          mapInstanceRef.current.removeLayer(measurementDistanceRef.current)
          measurementDistanceRef.current = null
        }
        
        // 重置测量状态
        setMeasurePoints([])
        setTotalDistance(null)
      }
    }
  }, [measureMode])

  /**
   * 创建扇区图层
   */
  const createSectorLayers = useCallback(() => {
    if (!mapInstanceRef.current) return

    const currentZoom = mapInstanceRef.current.getZoom()

    // 移除旧图层
    if (lteSectorLayerRef.current) {
      mapInstanceRef.current.removeLayer(lteSectorLayerRef.current)
      lteSectorLayerRef.current = null
    }
    if (nrSectorLayerRef.current) {
      mapInstanceRef.current.removeLayer(nrSectorLayerRef.current)
      nrSectorLayerRef.current = null
    }

    // 创建LTE扇区图层
    if (sectorData.lte.length > 0) {
      lteSectorLayerRef.current = createSectorLayer({
        sectors: sectorData.lte,
        onClick: handleSectorClick,
        zoom: currentZoom,
        showLabels: labelVisibility.lte
      })
      if (layerVisibility.lte) {
        lteSectorLayerRef.current.addTo(mapInstanceRef.current)
      }
    }

    // 创建NR扇区图层
    if (sectorData.nr.length > 0) {
      nrSectorLayerRef.current = createSectorLayer({
        sectors: sectorData.nr,
        onClick: handleSectorClick,
        zoom: currentZoom,
        showLabels: labelVisibility.nr
      })
      if (layerVisibility.nr) {
        nrSectorLayerRef.current.addTo(mapInstanceRef.current)
      }
    }
  }, [sectorData, layerVisibility, labelVisibility, handleSectorClick])

  /**
   * 加载单个MapInfo图层
   */
  const loadMapInfoLayer = useCallback(async (layerFile: LayerFileOption) => {
    if (!mapInstanceRef.current) return

    // 如果已经加载过，跳过
    if (loadedMapInfoLayersRef.current.has(layerFile.id)) {
      return
    }

    try {
      const response = await layerApi.getLayerData(layerFile.dataId, layerFile.id)
      if (response.success && response.data) {
        const geojsonData = response.data as GeoJSON.FeatureCollection

        // 创建图层选项
        const options: MapInfoLayerOptions = {
          id: layerFile.id,
          name: layerFile.name,
          type: layerFile.type as LayerGeometryType,
          data: geojsonData,
          dataId: layerFile.dataId,
          visible: layerFile.visible
        }

        // 通过管理器添加图层
        if (mapInfoLayerManagerRef.current) {
          await mapInfoLayerManagerRef.current.addLayer(options, layerFile.visible)
          loadedMapInfoLayersRef.current.add(layerFile.id)
        }
      }
    } catch (error) {
      console.error('[OnlineMap] 加载MapInfo图层失败:', layerFile.id, error)
    }
  }, [])

  /**
   * 加载所有MapInfo图层
   */
  const loadMapInfoLayers = useCallback(async () => {
    if (!mapInfoLayerManagerRef.current || !mapInstanceRef.current) return

    for (const layerFile of layerFiles) {
      await loadMapInfoLayer(layerFile)
    }
  }, [layerFiles, loadMapInfoLayer])

  /**
   * 切换地图类型
   */
  const toggleMapType = useCallback(() => {
    const newType = mapLayerType === 'roadmap' ? 'satellite' : 'roadmap'
    setMapLayerType(newType)
    mapStateService.setState({ mapLayerType: newType })
  }, [mapLayerType])

  /**
   * 初始化Leaflet地图
   */
  useEffect(() => {
    if (!mapRef.current) return

    // 动态加载Leaflet CSS和JS
    const loadLeaflet = () => {
      return new Promise<void>((resolve, reject) => {
        if ((window as any).L) {
          leafletRef.current = (window as any).L
          resolve()
          return
        }

        // 加载CSS
        const link = document.createElement('link')
        link.rel = 'stylesheet'
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
        document.head.appendChild(link)

        // 加载JS
        const script = document.createElement('script')
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
        script.onload = () => {
          leafletRef.current = (window as any).L
          resolve()
        }
        script.onerror = () => reject(new Error('加载Leaflet失败'))
        document.head.appendChild(script)
      })
    }

    // 获取高德地图图层URL
    const getAMapTileUrl = (type: MapLayerType) => {
      if (type === 'satellite') {
        return `https://webst02.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}`
      } else {
        return `https://webrd02.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}`
      }
    }

    const initMap = async () => {
      try {
        // 如果已经初始化过（React Strict Mode 双重调用保护），跳过
        if (initializedRef.current) {
          console.log('[OnlineMap] 已经初始化过，跳过重复初始化')
          setLoading(false)
          return
        }

        // 如果正在初始化，跳过
        if (isInitializingRef.current) {
          console.log('[OnlineMap] 正在初始化中，跳过重复调用')
          setLoading(false)
          return
        }

        // 如果地图实例已存在（可能是热重载），跳过
        if (mapInstanceRef.current) {
          console.log('[OnlineMap] 地图实例已存在，跳过初始化')
          setLoading(false)
          initializedRef.current = true
          return
        }

        // 立即标记已初始化和正在初始化，防止 Strict Mode 双重调用
        initializedRef.current = true
        isInitializingRef.current = true

        setLoading(true)

        await loadLeaflet()

        const L = leafletRef.current
        const savedState = mapStateService.getState()
        const container = mapRef.current

        if (!container) {
          console.error('[OnlineMap] 地图容器不存在')
          setLoading(false)
          isInitializingRef.current = false
          initializedRef.current = false // 允许重试
          return
        }

        // 检查并清理已初始化的容器
        const hasLeafletMap = container.querySelector('.leaflet-container')
        if (hasLeafletMap) {
          console.log('[OnlineMap] 检测到旧的地图实例，清理容器')
          container.innerHTML = ''
        }

        // 创建地图实例
        const map = L.map(container, {
          ...L.Map.prototype.options,
          zoomControl: false,
          // 确保地图点击事件能够触发
          dragging: true,
          zooming: true,
          doubleClickZoom: true,
          scrollWheelZoom: true,
          boxZoom: true,
          tap: true,
          touchZoom: true
        }).setView(savedState.center, savedState.zoom)
        
        // 添加测量模式下的十字光标
        map.on('mousemove', (e) => {
          if (measureMode) {
            map.getContainer().style.cursor = 'crosshair'
          } else {
            map.getContainer().style.cursor = ''
          }
        })
        
        // 鼠标离开地图时恢复默认光标
        map.on('mouseout', () => {
          map.getContainer().style.cursor = ''
        })
        
        // 添加高德地图图层
        const tileLayer = L.tileLayer(getAMapTileUrl(savedState.mapLayerType), {
          attribution: '&copy; <a href="https://www.amap.com/">高德地图</a>',
          maxZoom: 18,
          minZoom: 3
        }).addTo(map)

        tileLayerRef.current = tileLayer
        mapInstanceRef.current = map

        // 监听地图移动和缩放
        const saveMapState = () => {
          const center = map.getCenter()
          const zoom = map.getZoom()
          mapStateService.setState({
            center: [center.lat, center.lng] as [number, number],
            zoom: zoom
          })
        }
        
        map.on('moveend', saveMapState)
        map.on('zoomend', saveMapState)
        
        // 监听地图点击事件，点击其他区域时隐藏扇区信息面板
        map.on('click', (event) => {
          handleMapClickRef.current(event)
        })
        
        // 监听地图右键事件，用于结束测量
        map.on('contextmenu', handleMapContextMenu)

        // 初始化MapInfo图层管理器
        if (!mapInfoLayerManagerRef.current) {
          const manager = new MapInfoLayerManager()
          manager.setMap(map)
          mapInfoLayerManagerRef.current = manager
        }

        // 加载扇区数据
        await loadSectorData()

        setLoading(false)
        setIsMapInitialized(true)
        isInitializingRef.current = false
        console.log('[OnlineMap] 地图初始化完成')
      } catch (error) {
        console.error('[OnlineMap] 初始化地图失败:', error)
        setLoading(false)
        isInitializingRef.current = false
        // 失败时重置标志，允许重试（除非是 Strict Mode 双重调用）
        // initializedRef 保持为 true 以防止 Strict Mode 第二次调用
      }
    }

    initMap()

    return () => {
      // 清理地图实例
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove()
        } catch (e) {
          // 忽略清理错误
        }
        mapInstanceRef.current = null
      }
      // 重置正在初始化标志，但保持 initializedRef 为 true 以防止 Strict Mode 第二次调用
      isInitializingRef.current = false
      // 注意：不重置 initializedRef，因为同一个组件实例（Strict Mode 双重调用）不应该初始化两次
    // 如果组件完全卸载后重新挂载，useEffect 会重新执行，此时 initializedRef 会在新的闭包中重新创建
    tileLayerRef.current = null
    if (mapInfoLayerManagerRef.current) {
      mapInfoLayerManagerRef.current = null
    }
    lteSectorLayerRef.current = null
    nrSectorLayerRef.current = null
    console.log('[OnlineMap] 清理完成')
  }
  // 只在mount时执行一次
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [])

// 用于跟踪最新的handleMapClick函数
  const handleMapClickRef = useRef(handleMapClick)

  // 当handleMapClick变化时更新ref
  useEffect(() => {
    handleMapClickRef.current = handleMapClick
  }, [handleMapClick])

  /**
   * 当测量模式改变时更新光标
   */
  useEffect(() => {
    if (mapInstanceRef.current) {
      const map = mapInstanceRef.current
      if (measureMode) {
        map.getContainer().style.cursor = 'crosshair'
        // 测量模式下允许拖拽，方便移动到其他区域
        map.dragging.enable()
      } else {
        map.getContainer().style.cursor = ''
        map.dragging.enable()
      }
    }
  }, [measureMode])

/**
 * 当地图类型改变时更新瓦片图层
 */
useEffect(() => {
  // 当地图初始化完成后，更新瓦片图层
  if (!isMapInitialized || !mapInstanceRef.current || !window.L) return

  const L = window.L
  const map = mapInstanceRef.current

  // 移除旧的瓦片图层
  if (tileLayerRef.current) {
    map.removeLayer(tileLayerRef.current)
  }

  // 添加新的瓦片图层
  const getAMapTileUrl = (type: MapLayerType) => {
    if (type === 'satellite') {
      return `https://webst02.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}`
    } else {
      return `https://webrd02.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}`
      }
    }

    const newTileLayer = L.tileLayer(getAMapTileUrl(mapLayerType), {
      attribution: '&copy; <a href="https://www.amap.com/">高德地图</a>',
      maxZoom: 18,
      minZoom: 3
    }).addTo(map)

    tileLayerRef.current = newTileLayer
  }, [isMapInitialized, mapLayerType])

  // 地图点击事件已经在handleMapClick中处理，这里的useEffect是重复的，会导致事件被多次绑定
  // 移除重复的地图点击事件处理

  /**
   * 监听缩放变化，更新扇区图层
   */
  useEffect(() => {
    if (!mapInstanceRef.current) return

    const handleZoomEnd = () => {
      const zoom = mapInstanceRef.current!.getZoom()

      // 更新扇区图层的缩放级别
      if (lteSectorLayerRef.current) {
        lteSectorLayerRef.current.updateZoom(zoom)
      }
      if (nrSectorLayerRef.current) {
        nrSectorLayerRef.current.updateZoom(zoom)
      }
    }

    mapInstanceRef.current.on('zoomend', handleZoomEnd)

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.off('zoomend', handleZoomEnd)
      }
    }
  }, [])

  /**
   * 当layerFiles变化时加载MapInfo图层
   */
  useEffect(() => {
    if (mapInstanceRef.current && mapInfoLayerManagerRef.current && layerFiles.length > 0) {
      loadMapInfoLayers()
    }
  }, [layerFiles, loadMapInfoLayers])

  /**
   * 当扇区数据变化时更新图层
   */
  useEffect(() => {
    if (mapInstanceRef.current && sectorData) {
      createSectorLayers()
    }
  }, [sectorData, createSectorLayers])

  /**
   * 当图层可见性变化时更新
   */
  useEffect(() => {
    if (!mapInstanceRef.current) return

    if (lteSectorLayerRef.current) {
      if (layerVisibility.lte) {
        lteSectorLayerRef.current.addTo(mapInstanceRef.current)
      } else {
        mapInstanceRef.current.removeLayer(lteSectorLayerRef.current)
      }
    }

    if (nrSectorLayerRef.current) {
      if (layerVisibility.nr) {
        nrSectorLayerRef.current.addTo(mapInstanceRef.current)
      } else {
        mapInstanceRef.current.removeLayer(nrSectorLayerRef.current)
      }
    }
  }, [layerVisibility])

  /**
   * 当扇区标签可见性变化时更新图层
   */
  useEffect(() => {
    if (mapInstanceRef.current && sectorData) {
      console.log('[OnlineMap] 扇区标签可见性变化，重新创建扇区图层:', labelVisibility)
      createSectorLayers()
    }
  }, [labelVisibility])

  return (
    <>
      {/* 扇区属性信息面板 - 渲染在地图容器之外，避免受地图事件影响 */}
      <SectorInfoPanel
        sector={selectedSector}
        visible={panelVisible}
        onClose={hideSectorInfo}
        position={clickPosition}
      />
      
      {/* 地图容器 */}
      <div
        ref={mapRef}
        style={{ height: '100%', width: '100%' }}
        className="relative"
      >
        {/* 加载提示 */}
        {loading && (
          <div className="absolute top-4 left-4 z-[1000] bg-white/90 backdrop-blur px-4 py-2 rounded-lg shadow flex items-center gap-2">
            <Loader2 className="animate-spin" size={16} />
            <span className="text-sm">加载地图中...</span>
          </div>
        )}
      </div>
    </>
  )
})

OnlineMap.displayName = 'OnlineMap'
