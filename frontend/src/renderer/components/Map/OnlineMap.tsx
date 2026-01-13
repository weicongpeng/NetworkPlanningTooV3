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
import { Loader2 } from 'lucide-react'
import L from 'leaflet'
import { frequencyColorMapper } from '../../utils/frequencyColors'
import { mapDataService, RenderSectorData } from '../../services/mapDataService'
import { CoordinateTransformer } from '../../utils/coordinate'
import { createSectorLayer } from './SectorRendererSVG'
import { SectorInfoPanel, useSectorInfoPanel } from './SectorInfoPanel'
import { MapInfoLayerManager, MapInfoLayer, MapInfoLayerOptions, LayerGeometryType } from './MapInfoLayer'
import { layerApi, dataApi } from '../../services/api'
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
  sourceType?: 'mapinfo' | 'excel'
}

/**
 * 频点选项 (用于图层控制)
 */
export interface FrequencyOption {
  frequency: number
  color: string
  strokeColor: string
  visible: boolean
  networkType: 'LTE' | 'NR'
}

/**
 * 自定义图层选项
 */
export interface CustomLayerOption {
  id: string
  name: string
  type: 'point' | 'line' | 'polygon'
  visible: boolean
  data: any[] // 点坐标或GeoJSON
}


/**
 * 在线地图组件属性
 */
interface OnlineMapProps {
  /** MapInfo图层文件列表 */
  layerFiles?: LayerFileOption[]
  /** 测距模式 */
  measureMode?: boolean
  /** 结束测距模式回调 */
  onMeasureModeEnd?: () => void
  /** 频点可见性状态 */
  frequencies?: { lte: FrequencyOption[]; nr: FrequencyOption[] }
  /** 自定义图层列表 */
  customLayers?: CustomLayerOption[]
  /** 初始图层可见性 */
  initialLayerVisibility?: LayerVisibility
  /** 视图模式切换回调 */
  onViewModeChange?: (mode: 'online' | 'offline') => void
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
  /** 设置点文件标签可见性 */
  setPointFileLabelVisibility: (fileId: string, visible: boolean) => void
  /** 设置MapInfo图层可见性 */
  setMapInfoLayerVisibility: (layerId: string, visible: boolean) => void
  /** 设置地图类型 */
  setMapType: (type: 'roadmap' | 'satellite') => void
  /** 设置频点可见性 */
  setFrequencyVisibility: (networkType: 'LTE' | 'NR', frequency: number, visible: boolean) => void
  /** 设置自定义图层可见性 */
  setCustomLayerVisibility: (layerId: string, visible: boolean) => void
  /** 设置底图可见性 */
  setBaseMapVisibility: (visible: boolean) => void
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
  layerFiles = [],
  measureMode = false,
  onMeasureModeEnd,
  frequencies = { lte: [], nr: [] },
  customLayers = [],
  initialLayerVisibility = { lte: true, nr: true }
}, ref) => {
  // Refs
  const customLayerRefs = useRef<Record<string, L.LayerGroup | L.FeatureGroup>>({})
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
  const initializedRef = useRef(false) // 跟踪是否已初始化过
  const measureModeRef = useRef(measureMode) // 测距模式Ref
  const shadowLineRef = useRef<any>(null) // 测量预览虚线
  const shadowLabelRef = useRef<any>(null) // 测量预览标签
  const [customLayerVisibility, setCustomLayerVisibilityState] = useState<Record<string, boolean>>({})

  // 扇区图层引用
  const lteSectorLayerRef = useRef<SectorSVGLayer | null>(null)
  const nrSectorLayerRef = useRef<SectorSVGLayer | null>(null)

  // MapInfo图层管理器引用
  const mapInfoLayerManagerRef = useRef<MapInfoLayerManager | null>(null)

  // 已加载的MapInfo图层ID集合（用于避免重复加载）
  const loadedMapInfoLayersRef = useRef<Set<string>>(new Set())

  // MapInfo图层对象映射 - 直接存储 Leaflet GeoJSON 图层引用
  const mapInfoLayerRefsRef = useRef<Map<string, L.GeoJSON>>(new Map())

  // 点文件数据存储（用于属性标签渲染）
  const pointFileDataRef = useRef<Map<string, any[]>>(new Map())

  // 点文件标签标记映射
  const pointFileLabelMarkersRef = useRef<Map<string, L.Marker[]>>(new Map())

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
  const [layerVisibility, setLayerVisibility] = useState<LayerVisibility>(initialLayerVisibility)
  const [labelVisibility, setLabelVisibility] = useState<LayerVisibility>({
    lte: false,
    nr: false
  })
  // 点文件标签可见性（撒点文件的属性标签）
  const [pointFileLabelVisibility, setPointFileLabelVisibilityState] = useState<Record<string, boolean>>({})
  const [sectorData, setSectorData] = useState<{
    lte: RenderSectorData[]
    nr: RenderSectorData[]
  }>({ lte: [], nr: [] })

  // 底图可见性状态 - 用于控制背景颜色
  const [baseMapVisible, setBaseMapVisibleState] = useState(true)

  // 测量相关状态
  const [measurePoints, setMeasurePoints] = useState<Array<{ lng: number; lat: number }>>([])

  // 重叠扇区选择状态
  const [overlappingSectors, setOverlappingSectors] = useState<RenderSectorData[]>([])
  const [overlapPosition, setOverlapPosition] = useState<{ x: number, y: number } | null>(null)

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

    setPointFileLabelVisibility: (fileId: string, visible: boolean) => {
      console.log('[OnlineMap] setPointFileLabelVisibility called:', fileId, visible)
      setPointFileLabelVisibilityState(prev => ({ ...prev, [fileId]: visible }))
    },

    setMapInfoLayerVisibility: (layerId: string, visible: boolean) => {
      console.log('[OnlineMap] setMapInfoLayerVisibility called:', { layerId, visible })
      // 可见性控制现在由 useEffect 自动处理
      // 当 layerFiles prop 更新时，useEffect 会自动添加/移除图层
    },

    setMapType: (type: 'roadmap' | 'satellite') => {
      console.log('[OnlineMap] setMapType called with type:', type)
      setMapLayerType(type)
      mapStateService.setState({ mapLayerType: type })
      // 图层更新由useEffect钩子统一处理，不直接操作图层
    },

    setFrequencyVisibility: (networkType: 'LTE' | 'NR', frequency: number, visible: boolean) => {
      console.log('[OnlineMap] setFrequencyVisibility called:', networkType, frequency, visible)
      if (networkType === 'LTE' && lteSectorLayerRef.current) {
        lteSectorLayerRef.current.setFrequencyVisibility(frequency, visible)
      } else if (networkType === 'NR' && nrSectorLayerRef.current) {
        nrSectorLayerRef.current.setFrequencyVisibility(frequency, visible)
      }
    },

    setCustomLayerVisibility: (layerId: string, visible: boolean) => {
      setCustomLayerVisibilityState(prev => ({
        ...prev,
        [layerId]: visible
      }))
    },

    setBaseMapVisibility: (visible: boolean) => {
      console.log('[OnlineMap] setBaseMapVisibility called:', visible)
      setBaseMapVisibleState(visible)  // 更新本地状态
      if (!mapInstanceRef.current || !tileLayerRef.current) return

      if (visible) {
        // 显示底图
        if (!mapInstanceRef.current.hasLayer(tileLayerRef.current)) {
          tileLayerRef.current.addTo(mapInstanceRef.current)
        }
      } else {
        // 隐藏底图
        if (mapInstanceRef.current.hasLayer(tileLayerRef.current)) {
          mapInstanceRef.current.removeLayer(tileLayerRef.current)
        }
      }
    },

    toggleMapType: () => {
      toggleMapType()
    },

    refreshData: async () => {
      await loadSectorData(true)
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
  const loadSectorData = useCallback(async (forceRefresh = false) => {
    try {
      const zoom = mapInstanceRef.current?.getZoom() ?? mapStateService.getState().zoom
      const data = await mapDataService.getMapData(zoom, forceRefresh)

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
   * 处理扇区点击事件 - 支持重叠扇区选择
   */
  const handleSectorClick = useCallback((sector: RenderSectorData, event: L.LeafletMouseEvent) => {
    // 测距模式下不显示扇区属性
    if (measureMode) return;

    // 获取点击位置
    const clientX = event.originalEvent.clientX
    const clientY = event.originalEvent.clientY

    // 从所有可见图层中获取该位置的所有扇区
    const allOverlapping: RenderSectorData[] = []

    if (lteSectorLayerRef.current && layerVisibility.lte) {
      allOverlapping.push(...lteSectorLayerRef.current.getSectorsAt(clientX, clientY))
    }

    if (nrSectorLayerRef.current && layerVisibility.nr) {
      allOverlapping.push(...nrSectorLayerRef.current.getSectorsAt(clientX, clientY))
    }

    // 过滤掉当前不显示的频点对应的扇区 (getSectorsAt 是基于 DOM 的，所以已经过滤了隐藏的扇区)
    // 去重
    const uniqueOverlapping = allOverlapping.filter((v, i, a) => a.findIndex(t => t.id === v.id) === i)

    if (uniqueOverlapping.length > 1) {
      // 如果有多个重叠扇区，显示选择列表
      setOverlappingSectors(uniqueOverlapping)
      setOverlapPosition({ x: clientX, y: clientY })
    } else {
      // 只有一个或没有重叠（兜底），直接显示属性
      showSectorInfo(sector, event)
    }
  }, [showSectorInfo, layerVisibility])

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
    setOverlappingSectors([])
    setOverlapPosition(null)

    // 如果处于测量模式，处理测量点点击
    if (measureMode && mapInstanceRef.current && leafletRef.current) {
      const L = leafletRef.current
      const map = mapInstanceRef.current
      const latLng = event.latlng

      // 确保测量图层在顶层显示 - 使用overlay pane
      let measurementPane = map.getPane('measurement')
      if (!measurementPane) {
        measurementPane = map.createPane('measurement')
        measurementPane.style.zIndex = '1000'
      }

      // 添加测量点
      const newPoint = { lng: latLng.lng, lat: latLng.lat }
      const updatedPoints = [...measurePoints, newPoint]
      setMeasurePoints(updatedPoints)
      measurePointsRef.current = updatedPoints // 立即更新 ref 供 mousemove 使用

      // 创建测量点标记
      const icon = L.divIcon({
        html: `<div style="background-color: white; width: 10px; height: 10px; border-radius: 50%; border: 2px solid #ef4444; box-shadow: 0 1px 3px rgba(0,0,0,0.3);"></div>`,
        className: 'measure-point-icon',
        iconSize: [10, 10],
        iconAnchor: [5, 5]
      })

      const marker = L.marker([latLng.lat, latLng.lng], {
        icon,
        pane: 'measurement'
      }).addTo(map)
      measurementMarkersRef.current.push(marker)

      // 计算距离并显示标签
      let labelText = ''
      let totalDist = 0
      if (updatedPoints.length === 1) {
        labelText = '起点'
      } else {
        for (let i = 0; i < updatedPoints.length - 1; i++) {
          totalDist += calculateDistance(updatedPoints[i].lat, updatedPoints[i].lng, updatedPoints[i + 1].lat, updatedPoints[i + 1].lng)
        }
        labelText = `${totalDist.toFixed(2)}米`
      }

      const distanceLabel = L.marker([latLng.lat, latLng.lng], {
        icon: L.divIcon({
          html: `<div style="white-space: nowrap; font-size: 11px; color: #ef4444; font-weight: bold; text-shadow: 1px 1px 1px white, -1px -1px 1px white, 1px -1px 1px white, -1px 1px 1px white;">
                  ${labelText}
                </div>`,
          className: 'measure-label',
          iconSize: [0, 0],
          iconAnchor: [-5, 10]
        }),
        pane: 'measurement'
      }).addTo(map)
      measurementMarkersRef.current.push(distanceLabel)

      // 绘制测量连线
      if (updatedPoints.length >= 2) {
        const polyline = L.polyline(
          updatedPoints.map(p => [p.lat, p.lng]),
          {
            color: '#ef4444',
            weight: 2,
            opacity: 1,
            pane: 'measurement'
          }
        ).addTo(map)
        measurementLinesRef.current.push(polyline)
      }
    }
  }, [measureMode, measurePoints, hideSectorInfo])

  /**
   * 处理地图右键事件，用于结束测量或释放测距模式
   */
  const handleMapContextMenu = useCallback((event: any) => {
    // 阻止默认右键菜单
    event.originalEvent.preventDefault()
  }, [])

  /**
   * 结束当前测距
   */
  const finishMeasurement = useCallback(() => {
    if (!mapInstanceRef.current || measurePoints.length < 2) return

    const L = (window as any).L
    const map = mapInstanceRef.current

    // 复制点数组进行处理
    let points = [...measurePoints]

    // 如果最后两个点坐标一致（通常是双击导致的），移除最后一个重复点
    if (points.length >= 2) {
      const p1 = points[points.length - 1]
      const p2 = points[points.length - 2]
      if (p1.lat === p2.lat && p1.lng === p2.lng) {
        points.pop()
        // 同时移除对应的标记和标签（因为双击触发了两次click）
        const redundantLabel = measurementMarkersRef.current.pop()
        if (redundantLabel) map.removeLayer(redundantLabel)
        const redundantMarker = measurementMarkersRef.current.pop()
        if (redundantMarker) map.removeLayer(redundantMarker)
      }
    }

    // 现在移除最后一个有效点的数字标签，准备替换为“总长”
    const lastLabel = measurementMarkersRef.current.pop()
    if (lastLabel) {
      map.removeLayer(lastLabel)
    }

    const lastPoint = points[points.length - 1]

    // 计算总距离
    let totalDist = 0
    for (let i = 0; i < points.length - 1; i++) {
      totalDist += calculateDistance(points[i].lat, points[i].lng, points[i + 1].lat, points[i + 1].lng)
    }

    // 绘制最终的总长标签
    const totalLabel = L.marker([lastPoint.lat, lastPoint.lng], {
      icon: L.divIcon({
        html: `<div style="color: #ef4444; white-space: nowrap; font-size: 13px; font-weight: bold; text-shadow: 1px 1px 2px white, -1px -1px 2px white, 1px -1px 2px white, -1px 1px 2px white;">
                总长 ${totalDist.toFixed(2)}米
              </div>`,
        className: 'measure-total-label',
        iconSize: [0, 0],
        iconAnchor: [-5, 20]
      }),
      pane: 'measurement'
    }).addTo(map)
    measurementMarkersRef.current.push(totalLabel)

    // 清除预览线
    if (shadowLineRef.current) {
      map.removeLayer(shadowLineRef.current)
      shadowLineRef.current = null
    }
    if (shadowLabelRef.current) {
      map.removeLayer(shadowLabelRef.current)
      shadowLabelRef.current = null
    }

    setMeasurePoints([])
    measurePointsRef.current = [] // 立即更新 ref
  }, [measurePoints, calculateDistance])

  /**
   * 撤销上一个测量点
   */
  const undoLastPoint = useCallback(() => {
    if (!mapInstanceRef.current || measurePoints.length <= 1) return

    const map = mapInstanceRef.current

    // 移除最后一个点的数据
    const updatedPoints = [...measurePoints]
    updatedPoints.pop()
    setMeasurePoints(updatedPoints)
    measurePointsRef.current = updatedPoints

    // 移除最后一个标记（点）
    const lastMarker = measurementMarkersRef.current.pop()
    if (lastMarker) map.removeLayer(lastMarker)

    // 移除最后一个标签（距离）
    const lastLabel = measurementMarkersRef.current.pop()
    if (lastLabel) map.removeLayer(lastLabel)

    // 移除最后一段连线
    const lastLine = measurementLinesRef.current.pop()
    if (lastLine) map.removeLayer(lastLine)

    // 强制更新预览线（如果有）
    if (shadowLineRef.current && updatedPoints.length > 0) {
      // 触发一次 mousemove 的逻辑（或者等待下一次 mousemove）
    } else if (shadowLineRef.current) {
      map.removeLayer(shadowLineRef.current)
      shadowLineRef.current = null
      if (shadowLabelRef.current) {
        map.removeLayer(shadowLabelRef.current)
        shadowLabelRef.current = null
      }
    }
  }, [measurePoints])

  /**
   * 处理全键盘事件，支持 Esc 退出测距
   */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (measureModeRef.current) {
        if (e.key === 'Escape') {
          onMeasureModeEnd?.()
        } else if (e.key === 'Backspace') {
          // 阻止浏览器回退行为
          e.preventDefault()
          undoLastPointRef.current()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onMeasureModeEnd])

  /**
   * 当测量模式改变时，清除历史数据
   */
  useEffect(() => {
    if (mapInstanceRef.current) {
      const map = mapInstanceRef.current

      // 清除所有测量线条
      measurementLinesRef.current.forEach(line => {
        map.removeLayer(line)
      })
      measurementLinesRef.current = []

      // 清除所有测量点标记
      measurementMarkersRef.current.forEach(m => {
        map.removeLayer(m)
      })
      measurementMarkersRef.current = []

      // 清除预览线
      if (shadowLineRef.current) {
        map.removeLayer(shadowLineRef.current)
        shadowLineRef.current = null
      }
      if (shadowLabelRef.current) {
        map.removeLayer(shadowLabelRef.current)
        shadowLabelRef.current = null
      }

      // 移除距离信息标记
      if (measurementDistanceRef.current) {
        map.removeLayer(measurementDistanceRef.current)
        measurementDistanceRef.current = null
      }

      // 重置测量状态
      setMeasurePoints([])
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

      // 应用当前频点可见性
      const visibilityMap = new Map<number, boolean>()
      frequencies.lte.forEach(f => visibilityMap.set(f.frequency, f.visible))
      lteSectorLayerRef.current.setFrequenciesVisibility(visibilityMap)
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

      // 应用当前频点可见性
      const visibilityMap = new Map<number, boolean>()
      frequencies.nr.forEach(f => visibilityMap.set(f.frequency, f.visible))
      nrSectorLayerRef.current.setFrequenciesVisibility(visibilityMap)
    }
  }, [sectorData, layerVisibility, labelVisibility, handleSectorClick])

  /**
   * 加载单个MapInfo图层或Excel点图层
   */
  const loadMapInfoLayer = useCallback(async (layerFile: LayerFileOption) => {
    if (!mapInstanceRef.current) return

    // 如果已经加载过，跳过
    if (loadedMapInfoLayersRef.current.has(layerFile.id)) {
      return
    }

    try {
      let geojsonData: GeoJSON.FeatureCollection | null = null

      if (layerFile.sourceType === 'excel') {
        const response = await dataApi.get(layerFile.dataId)
        if (response.success && response.data && response.data.default) {
          // 存储原始数据用于标签渲染
          const pointData = response.data.default.filter((item: any) => item.longitude && item.latitude)
          pointFileDataRef.current.set(layerFile.id, pointData)

          // 转换Excel数据为GeoJSON，并进行坐标纠偏 (WGS84 -> GCJ02)
          const features = pointData.map((item: any) => {
            const [lat, lng] = CoordinateTransformer.wgs84ToGcj02(item.latitude, item.longitude)
            return {
              type: 'Feature',
              geometry: {
                type: 'Point',
                coordinates: [lng, lat]
              },
              properties: item
            }
          })

          geojsonData = {
            type: 'FeatureCollection',
            features
          }
        } else {
          // 数据不存在或加载失败，跳过此图层
          console.log('[OnlineMap] 图层数据不存在，跳过:', layerFile.id, layerFile.name)
          return
        }
      } else {
        // 默认 MapInfo 图层
        const response = await layerApi.getLayerData(layerFile.dataId, layerFile.id)
        if (response.success && response.data) {
          geojsonData = response.data as GeoJSON.FeatureCollection
        } else {
          // 数据不存在或加载失败，跳过此图层
          console.log('[OnlineMap] 图层数据不存在，跳过:', layerFile.id, layerFile.name)
          return
        }
      }

      if (geojsonData) {
        // 创建图层选项
        const options: MapInfoLayerOptions = {
          id: layerFile.id,
          name: layerFile.name,
          type: layerFile.type as LayerGeometryType,
          data: geojsonData,
          dataId: layerFile.dataId,
          visible: layerFile.visible
        }

        // 创建 MapInfo 图层
        const mapInfoLayer = await MapInfoLayer.fromGeoJSON(options)
        const leafletLayer = mapInfoLayer.getLeafletLayer()

        if (leafletLayer) {
          // 存储底层的 Leaflet GeoJSON 图层以便直接控制可见性
          mapInfoLayerRefsRef.current.set(layerFile.id, leafletLayer)
          loadedMapInfoLayersRef.current.add(layerFile.id)

          console.log('[OnlineMap] Layer created:', layerFile.id, 'visible:', layerFile.visible)

          // 根据初始可见性决定是否添加到地图
          if (layerFile.visible && mapInstanceRef.current) {
            leafletLayer.addTo(mapInstanceRef.current)
            console.log('[OnlineMap] Layer added to map on load:', layerFile.id)
          }
        } else {
          console.error('[OnlineMap] Failed to create Leaflet layer for:', layerFile.id)
        }
      }
    } catch (error) {
      console.error('[OnlineMap] 加载图层失败:', layerFile.id, error)
    }
  }, [])

  /**
   * 加载所有MapInfo图层
   */
  const loadMapInfoLayers = useCallback(async () => {
    if (!mapInfoLayerManagerRef.current || !mapInstanceRef.current) return

    console.log('[OnlineMap] Loading all MapInfo layers, count:', layerFiles.length)

    for (const layerFile of layerFiles) {
      await loadMapInfoLayer(layerFile)
    }
  }, [layerFiles])  // 只依赖 layerFiles，不依赖 loadMapInfoLayer

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
          attributionControl: false, // 禁用版权标签
          // 确保地图点击事件能够触发
          dragging: true,
          zooming: true,
          doubleClickZoom: true,
          scrollWheelZoom: true,
          boxZoom: true,
          tap: true,
          touchZoom: true
        }).setView(savedState.center, savedState.zoom)

        // 设置默认光标
        map.getContainer().style.cursor = 'default'

        // 添加测量模式下的十字光标和预览线
        map.on('mousemove', (e: L.LeafletMouseEvent) => {
          if (measureModeRef.current) {
            map.getContainer().style.cursor = 'crosshair'

            // 如果已经有至少一个点，显示跟随鼠标的虚线
            if (measurePointsRef.current.length > 0) {
              const lastPoint = measurePointsRef.current[measurePointsRef.current.length - 1]
              const mouseLatLng = e.latlng

              // 更新虚线
              if (shadowLineRef.current) {
                shadowLineRef.current.setLatLngs([[lastPoint.lat, lastPoint.lng], [mouseLatLng.lat, mouseLatLng.lng]])
              } else {
                shadowLineRef.current = L.polyline(
                  [[lastPoint.lat, lastPoint.lng], [mouseLatLng.lat, mouseLatLng.lng]],
                  {
                    color: '#ef4444',
                    weight: 2,
                    dashArray: '5, 10',
                    opacity: 0.5,
                    pane: 'measurement'
                  }
                ).addTo(map)
              }

              // 更新悬浮距离标签
              let totalDist = 0
              for (let i = 0; i < measurePointsRef.current.length - 1; i++) {
                totalDist += calculateDistance(measurePointsRef.current[i].lat, measurePointsRef.current[i].lng, measurePointsRef.current[i + 1].lat, measurePointsRef.current[i + 1].lng)
              }
              const lastSegment = calculateDistance(lastPoint.lat, lastPoint.lng, mouseLatLng.lat, mouseLatLng.lng)
              const currentTotal = totalDist + lastSegment

              const labelContent = `<div style="white-space: nowrap; font-size: 11px; color: #ef4444; font-weight: bold; text-shadow: 1px 1px 1px white, -1px -1px 1px white, 1px -1px 1px white, -1px 1px 1px white;">
                                    ${currentTotal.toFixed(2)}米
                                  </div>`

              if (shadowLabelRef.current) {
                shadowLabelRef.current.setLatLng(mouseLatLng)
                shadowLabelRef.current.setIcon(L.divIcon({
                  html: labelContent,
                  className: 'measure-label-shadow',
                  iconSize: [0, 0],
                  iconAnchor: [-5, 10]
                }))
              } else {
                shadowLabelRef.current = L.marker(mouseLatLng, {
                  icon: L.divIcon({
                    html: labelContent,
                    className: 'measure-label-shadow',
                    iconSize: [0, 0],
                    iconAnchor: [-5, 10]
                  }),
                  pane: 'measurement'
                }).addTo(map)
              }
            }
          } else {
            map.getContainer().style.cursor = 'default'
          }
        })

        // 监听双击事件结束测量
        map.on('dblclick', (e: L.LeafletMouseEvent) => {
          if (measureModeRef.current) {
            // 禁止双击缩放
            e.originalEvent.stopPropagation()
            finishMeasurementRef.current()
          }
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
        map.on('click', (event: L.LeafletMouseEvent) => {
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
        mapInfoLayerManagerRef.current.clear() // 清理所有图层
        mapInfoLayerManagerRef.current = null
      }
      loadedMapInfoLayersRef.current.clear() // 清理已加载图层记录
      mapInfoLayerRefsRef.current.clear() // 清理图层引用映射
      lteSectorLayerRef.current = null
      nrSectorLayerRef.current = null
      console.log('[OnlineMap] 清理完成')
    }
    // 只在mount时执行一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 用于跟踪最新的handleMapClick函数
  const handleMapClickRef = useRef(handleMapClick)
  const measurePointsRef = useRef(measurePoints)
  const finishMeasurementRef = useRef(finishMeasurement)
  const undoLastPointRef = useRef(undoLastPoint)

  // 更新refs
  useEffect(() => {
    handleMapClickRef.current = handleMapClick
    measurePointsRef.current = measurePoints
    finishMeasurementRef.current = finishMeasurement
    undoLastPointRef.current = undoLastPoint
    measureModeRef.current = measureMode
  }, [handleMapClick, measurePoints, finishMeasurement, undoLastPoint, measureMode])

  /**
   * 当测量模式改变时更新光标
   */
  useEffect(() => {
    if (mapInstanceRef.current) {
      const map = mapInstanceRef.current
      if (measureMode) {
        map.getContainer().style.cursor = 'crosshair'
        map.dragging.enable()
        map.doubleClickZoom.disable() // 测距模式下禁用双击缩放，改为结束测距
      } else {
        map.getContainer().style.cursor = 'default'
        map.dragging.enable()
        map.doubleClickZoom.enable()
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
    if (mapInstanceRef.current && layerFiles.length > 0) {
      loadMapInfoLayers()
    } else if (layerFiles.length === 0 && loadedMapInfoLayersRef.current.size > 0) {
      // 如果图层列表为空但有已加载的图层，清理所有图层
      console.log('[OnlineMap] Layer files cleared, cleaning up loaded layers')
      if (mapInstanceRef.current) {
        for (const leafletLayer of mapInfoLayerRefsRef.current.values()) {
          if (mapInstanceRef.current.hasLayer(leafletLayer)) {
            mapInstanceRef.current.removeLayer(leafletLayer)
          }
        }
      }
      mapInfoLayerRefsRef.current.clear()
      loadedMapInfoLayersRef.current.clear()
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
   * 当自定义图层变化时更新渲染
   */
  useEffect(() => {
    if (!mapInstanceRef.current || !window.L) return
    const map = mapInstanceRef.current
    const L = window.L

    // 清理已删除的图层
    const currentLayerIds = new Set(customLayers.map(l => l.id))
    Object.keys(customLayerRefs.current).forEach(id => {
      if (!currentLayerIds.has(id)) {
        map.removeLayer(customLayerRefs.current[id])
        delete customLayerRefs.current[id]
      }
    })

    // 创建或更新图层
    customLayers.forEach(layer => {
      // 如果已经有图层引用，更新可见性
      if (customLayerRefs.current[layer.id]) {
        const isVisible = customLayerVisibility[layer.id] ?? layer.visible
        if (isVisible) {
          if (!map.hasLayer(customLayerRefs.current[layer.id])) {
            map.addLayer(customLayerRefs.current[layer.id])
          }
        } else {
          map.removeLayer(customLayerRefs.current[layer.id])
        }
        return
      }

      // 创建新图层
      let leafletLayer: L.LayerGroup | L.FeatureGroup

      if (layer.type === 'point') {
        leafletLayer = L.layerGroup()
        layer.data.forEach((p: any) => {
          if (p.latitude && p.longitude) {
            // 纠偏处理: WGS84 -> GCJ02
            const [gcjLat, gcjLng] = CoordinateTransformer.wgs84ToGcj02(p.latitude, p.longitude)

            L.circleMarker([gcjLat, gcjLng], {
              radius: 5,
              fillColor: '#ef4444',
              color: '#fff',
              weight: 1,
              opacity: 1,
              fillOpacity: 0.8
            }).bindPopup(`<b>${p.name || '未命名点'}</b><br/>经度: ${p.longitude}<br/>纬度: ${p.latitude}`)
              .addTo(leafletLayer)
          }
        })
      } else {
        // 对于线和面图层，如果是来自MapInfo的数据，MapInfoLayerManager会自动处理
        // 这里如果是通过"导入图层"添加的，我们可以创建一个FeatureGroup
        leafletLayer = L.featureGroup()
      }

      customLayerRefs.current[layer.id] = leafletLayer

      const isVisible = customLayerVisibility[layer.id] ?? layer.visible
      if (isVisible) {
        leafletLayer.addTo(map)
      }
    })
  }, [customLayers, customLayerVisibility])

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
   * 当 MapInfo 图层文件可见性变化时更新（参考扇区图层的处理方式）
   */
  useEffect(() => {
    if (!mapInstanceRef.current) return

    const map = mapInstanceRef.current

    // 遍历所有已加载的 MapInfo 图层，根据其可见性状态进行控制
    for (const [layerId, layer] of mapInfoLayerRefsRef.current.entries()) {
      // 从 layerFiles 中查找对应的图层文件以获取当前可见性状态
      const layerFile = layerFiles.find(f => f.id === layerId)

      if (layerFile) {
        if (layerFile.visible) {
          // 图层应该可见 - 添加到地图（如果尚未添加）
          if (!map.hasLayer(layer)) {
            layer.addTo(map)
            console.log('[OnlineMap] MapInfo layer added to map:', layerId)
          }
        } else {
          // 图层应该隐藏 - 从地图移除
          if (map.hasLayer(layer)) {
            map.removeLayer(layer)
            console.log('[OnlineMap] MapInfo layer removed from map:', layerId)
          }
        }
      }
    }
  }, [layerFiles])

  /**
   * 当扇区标签可见性变化时更新图层
   */
  useEffect(() => {
    if (mapInstanceRef.current && sectorData) {
      console.log('[OnlineMap] 扇区标签可见性变化，重新创建扇区图层:', labelVisibility)
      createSectorLayers()
    }
  }, [labelVisibility])

  /**
   * 当点文件标签可见性变化时更新标签标记
   */
  useEffect(() => {
    if (!mapInstanceRef.current || !window.L) return

    const map = mapInstanceRef.current
    const L = window.L

    // 清理所有现有的点文件标签标记
    for (const [fileId, markers] of pointFileLabelMarkersRef.current.entries()) {
      for (const marker of markers) {
        map.removeLayer(marker)
      }
    }
    pointFileLabelMarkersRef.current.clear()

    // 遍历所有点文件，为启用标签的文件创建标记
    for (const [fileId, pointData] of pointFileDataRef.current.entries()) {
      const shouldShowLabels = pointFileLabelVisibility[fileId] === true

      if (shouldShowLabels && pointData && pointData.length > 0) {
        const markers: L.Marker[] = []

        for (const point of pointData) {
          if (!point.longitude || !point.latitude) continue

          // 应用坐标纠偏
          const [gcjLat, gcjLng] = CoordinateTransformer.wgs84ToGcj02(point.latitude, point.longitude)

          // 收集属性信息（排除常用字段）
          const attributes = point.attributes || {}
          const labelParts: string[] = []

          // 优先显示名称相关字段
          if (point.name) labelParts.push(point.name)
          else if (point.siteId) labelParts.push(point.siteId)
          else if (point.id) labelParts.push(point.id)

          // 添加其他属性（最多3个）
          let attrCount = 0
          for (const [key, value] of Object.entries(attributes)) {
            if (attrCount >= 3) break
            if (value && typeof value === 'string' && value.length < 20) {
              labelParts.push(`${key}: ${value}`)
              attrCount++
            }
          }

          if (labelParts.length === 0) continue

          // 创建标签图标
          const labelHtml = `
            <div style="
              background: rgba(255, 255, 255, 0.95);
              border: 1px solid #3b82f6;
              border-radius: 4px;
              padding: 4px 6px;
              font-size: 11px;
              color: #1e293b;
              white-space: nowrap;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            ">
              ${labelParts.join('<br/>')}
            </div>
          `

          const icon = L.divIcon({
            html: labelHtml,
            className: 'point-file-label',
            iconSize: [100, 50],
            iconAnchor: [50, 25]
          })

          const marker = L.marker([gcjLat, gcjLng], { icon })
          marker.addTo(map)
          markers.push(marker)
        }

        pointFileLabelMarkersRef.current.set(fileId, markers)
        console.log('[OnlineMap] Point file labels added:', fileId, markers.length)
      }
    }
  }, [pointFileLabelVisibility, layerFiles])

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
        style={{
          height: '100%',
          width: '100%',
          backgroundColor: baseMapVisible ? 'transparent' : '#ffffff'  // 底图隐藏时显示白色背景
        }}
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

      {/* 重叠扇区选择菜单 */}
      {overlappingSectors.length > 0 && overlapPosition && (
        <OverlappingSectorsMenu
          sectors={overlappingSectors}
          position={overlapPosition}
          onSelect={(sector) => {
            showSectorInfo(sector, {
              originalEvent: {
                clientX: overlapPosition.x,
                clientY: overlapPosition.y
              }
            } as any)
            setOverlappingSectors([])
            setOverlapPosition(null)
          }}
          onClose={() => {
            setOverlappingSectors([])
            setOverlapPosition(null)
          }}
        />
      )}
    </>
  )
})

/**
 * 重叠扇区选择菜单组件
 */
function OverlappingSectorsMenu({ sectors, position, onSelect, onClose }: {
  sectors: RenderSectorData[],
  position: { x: number, y: number },
  onSelect: (sector: RenderSectorData) => void,
  onClose: () => void
}) {
  return (
    <div
      style={{
        position: 'fixed',
        left: position.x + 10,
        top: position.y,
        backgroundColor: 'white',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        borderRadius: '8px',
        padding: '8px 0',
        zIndex: 11000,
        minWidth: '180px',
        border: '1px solid #e2e8f0',
        fontFamily: 'sans-serif'
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div style={{ padding: '6px 12px 10px 12px', fontSize: '12px', color: '#64748b', borderBottom: '1px solid #f1f5f9', marginBottom: '4px' }}>
        检测到 {sectors.length} 个重叠扇区:
      </div>
      <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
        {sectors.map(sector => (
          <div
            key={sector.id}
            style={{
              padding: '10px 12px',
              cursor: 'pointer',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            onClick={() => onSelect(sector)}
          >
            <div style={{
              width: '10px',
              height: '10px',
              borderRadius: '2px',
              backgroundColor: sector.frequency ? frequencyColorMapper.getColor(sector.frequency, sector.networkType).color || '#ccc' : '#ccc',
              border: '1px solid rgba(0,0,0,0.1)'
            }} />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontWeight: 500 }}>{sector.id}</span>
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>{sector.name} | {sector.networkType} | PCI: {sector.pci}</span>
            </div>
          </div>
        ))}
      </div>
      <div
        style={{
          padding: '8px 12px',
          borderTop: '1px solid #f1f5f9',
          marginTop: '4px',
          fontSize: '12px',
          color: '#64748b',
          cursor: 'pointer',
          textAlign: 'center',
          fontWeight: 500
        }}
        onClick={onClose}
      >
        取消
      </div>
    </div>
  )
}

OnlineMap.displayName = 'OnlineMap'
