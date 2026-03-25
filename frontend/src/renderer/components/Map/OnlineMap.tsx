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
import { useTranslation } from 'react-i18next'
import L from 'leaflet'
import { NetworkStatusAlert } from './NetworkStatusIndicator'
import { frequencyColorMapper } from '../../utils/frequencyColors'
import { mapDataService, RenderSectorData } from '../../services/mapDataService'
import { CoordinateTransformer } from '../../utils/coordinate'
import { SectorInfoPanel, useSectorInfoPanel } from './SectorInfoPanel'
import { FeatureInfoPanel, useFeatureInfoPanel } from './FeatureInfoPanel'
import { MapInfoLayerManager, MapInfoLayer, MapInfoLayerOptions, LayerGeometryType } from './MapInfoLayer'
import { layerApi, dataApi } from '../../services/api'
import { mapStateService } from '../../services/mapStateService'
import { SectorSVGLayer, PCIHighlightConfig, TACHighlightConfig, NeighborHighlightConfig, SectorLabelConfig } from './SectorRendererSVG'
import { pciDataSyncService } from '../../services/pciDataSyncService'
import { neighborDataSyncService } from '../../services/neighborDataSyncService'
import { tacDataSyncService } from '../../services/tacDataSyncService'
// TACLegend 已移除，各个页面自己管理对应的图例组件

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
  /** 地理化点文件列表 */
  pointFiles?: any[]
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
  /** 地图显示模式 */
  mode?: 'default' | 'pci-planning' | 'neighbor-planning' | 'tac-check'
  /** 扇区点击回调 */
  onSectorClick?: (sector: RenderSectorData) => void
  /** 扇区标签可见性 */
  sectorLabelVisibility?: Record<string, boolean>
  /** 标签设置映射 */
  labelSettingsMap?: Record<string, any>
  /** 圈选模式 */
  selectionMode?: 'none' | 'point' | 'circle' | 'polygon'
  /** 结束圈选模式回调 */
  onSelectionModeEnd?: () => void
  /** 地图拖拽工具是否启用 */
  mapDragTool?: boolean
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
  /** 调整地图视野以包含指定的所有坐标点 */
  fitBounds: (latLngs: Array<[number, number]>, padding?: [number, number]) => void
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
  /** 设置点文件标签可见性并更新设置 (MapPage用) */
  setLayerFileLabelVisibility: (fileId: string, visible: boolean, settings: any) => void
  /** 设置地图类型切换 */
  toggleMapType: () => void
  /** 设置频点可见性 */
  setFrequencyVisibility: (networkType: 'LTE' | 'NR', frequency: number, visible: boolean) => void
  /** 设置自定义图层可见性 */
  setCustomLayerVisibility: (layerId: string, visible: boolean) => void
  /** 设置底图可见性 */
  setBaseMapVisibility: (visible: boolean) => void
  /** 刷新地图数据 */
  refreshData: () => Promise<void>
  /** 添加定位标记 */
  addLocationMarker: (marker: LocationMarker, index: number) => void
  /** 清除所有定位标记 */
  clearLocationMarkers: () => void
  /** 清除所有测量 */
  clearMeasurements: () => void
  /** 设置测距模式 */
  setMeasureMode: (enabled: boolean) => void
  /** 设置邻区高亮 */
  setNeighborHighlight: (config: NeighborHighlightConfig | null) => void
  /** 清除邻区高亮 */
  clearNeighborHighlight: () => void
  /** 设置扇区ID白名单 */
  setSectorIdWhitelist: (whitelist: Set<string> | null, mode: 'pci-planning' | 'neighbor-planning' | 'tac-check', networkType?: 'LTE' | 'NR') => void
  /** 清除扇区ID白名单 */
  clearSectorIdWhitelist: () => void
  /** 设置PCI高亮模式 */
  setPCIHighlightMode: (config: PCIHighlightConfig | null) => void
  /** 清除PCI高亮 */
  clearPCIHighlight: () => void
  /** 设置TAC高亮模式 */
  setTACHighlightMode: (config: TACHighlightConfig | null) => void
  /** 清除圈选高亮 */
  clearSelectionHighlight: () => void
  /** 设置圈选高亮 */
  setSelectionHighlight: (ids: Set<string> | null) => void
  /** 获取撒点文件数据 */
  getPointFileData: () => Record<string, any[]>
  /** 设置扇区标签配置 */
  setSectorLabelSettings: (settings: any, layerId: string) => void
}

export const OnlineMap = forwardRef<OnlineMapRef, OnlineMapProps>(({
  layerFiles = [],
  pointFiles = [],
  measureMode = false,
  onMeasureModeEnd,
  frequencies = { lte: [], nr: [] },
  customLayers = [],
  initialLayerVisibility = { lte: true, nr: true },
  mode = 'default',
  onSectorClick,
  sectorLabelVisibility = {},
  labelSettingsMap = {},
  selectionMode = 'none',
  onSelectionModeEnd,
  mapDragTool = false
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
  const tileLoadTimeoutRef = useRef<NodeJS.Timeout | null>(null) // 瓦片加载超时定时器
  const networkEventListenersRef = useRef<{
    handleOnline: () => void
    handleOffline: () => void
    cleanup?: () => void
  } | null>(null) // 网络事件监听器引用
  const hasLoadedAnyTileRef = useRef(false) // 跟踪是否成功加载过至少一个瓦片
  const hasNetworkErrorRef = useRef(false) // 跟踪是否有真正的网络错误
  const isUserInteractingRef = useRef(false)
  const isInitializingRef = useRef(false) // 防止 React Strict Mode 双重初始化
  const initializedRef = useRef(false) // 跟踪是否已初始化过
  const measureModeRef = useRef(measureMode) // 测距模式Ref
  const selectionModeRef = useRef(selectionMode) // 圈选模式Ref
  const shadowLineRef = useRef<any>(null) // 测量预览虚线
  const shadowLabelRef = useRef<any>(null) // 测量预览标签

  // 框选功能状态
  const selectionShapeRef = useRef<L.Circle | L.Polygon | null>(null) // 框选形状
  const selectionDrawingRef = useRef(false) // 是否正在绘制框选
  const selectionPointsRef = useRef<L.LatLng[]>([]) // 多边形框选的点
  const selectionStartPointRef = useRef<L.LatLng | null>(null) // 框选起点
  const selectedFeaturesRef = useRef<any[]>([]) // 选中的要素属性数据
  const selectedIdsRef = useRef<Set<string>>(new Set()) // 选中的要素ID集合
  const polygonTempLayerRef = useRef<L.Polyline | null>(null) // 多边形绘制临时线
  const [selectionTip, setSelectionTip] = useState<string>('') // 框选提示信息
  const preserveSelectionRef = useRef<boolean>(false) // 同步跟踪保留状态，避免 state 异步更新问题
  const [customLayerVisibility, setCustomLayerVisibilityState] = useState<Record<string, boolean>>({})

  // i18n translation
  const { t } = useTranslation()

  // 同步Ref
  useEffect(() => { measureModeRef.current = measureMode }, [measureMode])
  useEffect(() => { selectionModeRef.current = selectionMode }, [selectionMode])

  // 使用Ref跟踪上一次的mapDragTool值，用于检测变化
  const prevMapDragToolRef = useRef<boolean>(mapDragTool)
  // 临时存储选中状态，用于在拖拽工具激活时保留
  const preservedSelectionRef = useRef<{
    ids: Set<string>,
    features: any[],
    shapeInfo?: {
      type: 'circle' | 'polygon',
      center?: L.LatLng,
      radius?: number,
      points?: L.LatLng[]
    }
  } | null>(null)

  // 监听mapDragTool变化，当激活拖拽工具时保留选中状态
  useEffect(() => {
    const prevMapDragTool = prevMapDragToolRef.current
    prevMapDragToolRef.current = mapDragTool

    // 检测mapDragTool从false变为true，表示用户点击了拖拽按钮
    if (!prevMapDragTool && mapDragTool) {
      // 在清除选中状态之前，保存当前选中状态和图形
      console.log('[OnlineMap] 检测到拖拽工具激活，检查是否需要保存选中状态，选中要素数量:', selectedIdsRef.current.size)
      if (selectedIdsRef.current.size > 0) {
        // 收集框选图形信息
        let shapeInfo: { type: 'circle' | 'polygon', center?: L.LatLng, radius?: number, points?: L.LatLng[] } | undefined

        if (selectionShapeRef.current) {
          if (selectionShapeRef.current instanceof L.Circle) {
            shapeInfo = {
              type: 'circle',
              center: selectionShapeRef.current.getLatLng(),
              radius: selectionShapeRef.current.getRadius()
            }
          } else if (selectionShapeRef.current instanceof L.Polygon) {
            const latLngs = selectionShapeRef.current.getLatLngs()[0] as L.LatLng[]
            shapeInfo = {
              type: 'polygon',
              points: latLngs
            }
          }
        }

        // 保存当前选中状态到临时存储
        preservedSelectionRef.current = {
          ids: new Set(selectedIdsRef.current),
          features: [...selectedFeaturesRef.current],
          shapeInfo
        }
        // 设置保留标志
        preserveSelectionRef.current = true
        console.log('[OnlineMap] 保存选中状态和图形信息', { shapeType: shapeInfo?.type })
      }
    } else if (prevMapDragTool && !mapDragTool) {
      // 拖拽工具被禁用时，清除临时存储
      preservedSelectionRef.current = null
    }
  }, [mapDragTool])

  // 监听selectionMode变化，处理退出框选模式时的清除逻辑
  useEffect(() => {
    const isSelectionActive = selectionMode !== 'none'

    // 退出框选模式时，根据preserveSelection决定是否清除选中状态
    if (!isSelectionActive) {
      // 使用 ref 来判断，因为 state 更新是异步的
      const shouldPreserve = preserveSelectionRef.current
      if (!shouldPreserve) {
        // 不保留选中状态，清除所有选中状态和图形
        console.log('[OnlineMap] 退出框选模式，清除选中状态')
        selectedFeaturesRef.current = []
        selectedIdsRef.current = new Set()
        selectionPointsRef.current = []
        // 清除扇区图层高亮
        if (lteSectorLayerRef.current) {
          lteSectorLayerRef.current.setSelectionHighlight(null)
        }
        if (nrSectorLayerRef.current) {
          nrSectorLayerRef.current.setSelectionHighlight(null)
        }
        // 清除MapInfo图层高亮
        mapInfoLayerRefsRef.current.forEach(({ mapInfoLayer }) => {
          mapInfoLayer.setSelectionHighlight(null)
        })
        // 清除框选形状
        const map = mapInstanceRef.current
        if (map) {
          if (selectionShapeRef.current) {
            map.removeLayer(selectionShapeRef.current)
            selectionShapeRef.current = null
          }
          if (polygonTempLayerRef.current) {
            map.removeLayer(polygonTempLayerRef.current)
            polygonTempLayerRef.current = null
          }
        }
        setSelectionTip('')
      } else {
        // 保留选中状态，恢复之前保存的状态
        console.log('[OnlineMap] 退出框选模式，保留选中状态')
        if (preservedSelectionRef.current) {
          // 恢复保存的选中状态
          selectedIdsRef.current = preservedSelectionRef.current.ids
          selectedFeaturesRef.current = preservedSelectionRef.current.features
          console.log('[OnlineMap] 恢复选中状态，选中要素数量:', selectedIdsRef.current.size)
          // 重新应用高亮
          mapInfoLayerRefsRef.current.forEach(({ mapInfoLayer }) => {
            mapInfoLayer.setSelectionHighlight(selectedIdsRef.current)
          })
          if (lteSectorLayerRef.current) {
            lteSectorLayerRef.current.setSelectionHighlight(selectedIdsRef.current)
          }
          if (nrSectorLayerRef.current) {
            nrSectorLayerRef.current.setSelectionHighlight(selectedIdsRef.current)
          }

          // 恢复框选图形
          const map = mapInstanceRef.current
          const shapeInfo = preservedSelectionRef.current.shapeInfo
          if (map && shapeInfo) {
            const L = window.L
            // 先清除现有的框选图形
            if (selectionShapeRef.current) {
              map.removeLayer(selectionShapeRef.current)
              selectionShapeRef.current = null
            }

            if (shapeInfo.type === 'circle' && shapeInfo.center && shapeInfo.radius) {
              // 恢复圆形框选图形
              selectionShapeRef.current = L.circle(shapeInfo.center, {
                radius: shapeInfo.radius,
                color: '#00ffff',
                weight: 2,
                fillColor: '#00ffff',
                fillOpacity: 0.1
              }).addTo(map)
              console.log('[OnlineMap] 恢复圆形框选图形，半径:', shapeInfo.radius)
            } else if (shapeInfo.type === 'polygon' && shapeInfo.points && shapeInfo.points.length >= 3) {
              // 恢复多边形框选图形
              selectionShapeRef.current = L.polygon(shapeInfo.points, {
                color: '#00ffff',
                weight: 2,
                fillColor: '#00ffff',
                fillOpacity: 0.1
              }).addTo(map)
              console.log('[OnlineMap] 恢复多边形框选图形，顶点数:', shapeInfo.points.length)
            }
          }
        }
        // 更新提示
        if (selectedIdsRef.current.size > 0) {
          setSelectionTip(`${t('map.featuresSelected', { count: selectedIdsRef.current.size })}，${t('map.pressEscClear')}`)
        } else {
          setSelectionTip('')
        }
      }
    } else {
      // 进入框选模式时，重置保留状态标志和临时存储
      preserveSelectionRef.current = false
      preservedSelectionRef.current = null
    }
  }, [selectionMode])

  // 扇区图层引用
  const lteSectorLayerRef = useRef<SectorSVGLayer | null>(null)
  const nrSectorLayerRef = useRef<SectorSVGLayer | null>(null)

  // MapInfo图层管理器引用
  const mapInfoLayerManagerRef = useRef<MapInfoLayerManager | null>(null)

  // 高亮配置Refs
  const pciHighlightConfigRef = useRef<PCIHighlightConfig | null>(null)
  const neighborHighlightConfigRef = useRef<NeighborHighlightConfig | null>(null)
  const tacHighlightConfigRef = useRef<TACHighlightConfig | null>(null)

  // 已加载的MapInfo图层ID集合（用于避免重复加载）
  const loadedMapInfoLayersRef = useRef<Set<string>>(new Set())

  // MapInfo图层对象映射 - 存储图层实例和Leaflet图层引用
  const mapInfoLayerRefsRef = useRef<Map<string, { mapInfoLayer: MapInfoLayer, leafletLayer: L.Layer }>>(new Map())

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

  // 要素信息面板 (MapInfo/地理化点文件)
  const {
    featureProperties,
    featurePanelVisible,
    featureTitle,
    featureClickPosition,
    showFeatureInfo,
    hideFeatureInfo
  } = useFeatureInfoPanel()

  // 移除悬停状态管理，改为仅使用点击事件显示属性

  // State
  const [loading, setLoading] = useState(true)
  const [isMapInitialized, setIsMapInitialized] = useState(false)
  const [mapLayerType, setMapLayerType] = useState<MapLayerType>(() => mapStateService.getState().mapLayerType)
  const [layerVisibility, setLayerVisibility] = useState<LayerVisibility>(initialLayerVisibility)

  // 网络错误状态
  const [networkError, setNetworkError] = useState<{
    visible: boolean
    message: string
    canRetry: boolean
  }>({
    visible: false,
    message: '',
    canRetry: false
  })

  // 监听 networkError 状态变化（调试用）
  useEffect(() => {
    console.log('[OnlineMap] networkError 状态变化:', networkError)
  }, [networkError])

  // 重试初始化地图的函数
  const retryInitMap = useCallback(() => {
    // 隐藏错误提示
    setNetworkError({ ...networkError, visible: false })
    // 重置网络错误相关的 ref
    hasLoadedAnyTileRef.current = false
    hasNetworkErrorRef.current = false
    // 重置初始化状态，允许重新初始化
    initializedRef.current = false
    isInitializingRef.current = false
    setLoading(true)

    // 触发重新初始化 - 通过强制重新加载组件的方式
    // 由于地图初始化逻辑在 useEffect 中，我们需要重新挂载组件
    // 这里使用一个简单的 hack：触发状态更新来重新执行 useEffect
    window.location.reload()
  }, [networkError])
  
  // 图层可见性Ref - 用于在回调中获取最新的图层可见性状态
  const layerVisibilityRef = useRef<LayerVisibility>(layerVisibility)
  useEffect(() => { layerVisibilityRef.current = layerVisibility }, [layerVisibility])
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

    fitBounds: (latLngs: Array<[number, number]>, padding: [number, number] = [50, 50]) => {
      if (mapInstanceRef.current && latLngs.length > 0) {
        isUserInteractingRef.current = true
        const bounds = L.latLngBounds(latLngs)
        mapInstanceRef.current.fitBounds(bounds, { padding: [padding[0], padding[1]] })
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
      const layerRef = mapInfoLayerRefsRef.current.get(fileId)
      if (layerRef) {
        layerRef.mapInfoLayer.setLabelVisibility(visible)
      }
    },

    setMapInfoLayerVisibility: (layerId: string, visible: boolean) => {
      console.log('[OnlineMap] setMapInfoLayerVisibility called:', { layerId, visible })
      const layerRef = mapInfoLayerRefsRef.current.get(layerId)
      if (layerRef && mapInstanceRef.current) {
        if (visible) {
          // 使用 MapInfoLayer 的 addTo 方法而不是直接添加 Leaflet 图层
          // 这样可以正确设置 currentMap 引用，使标签功能能够工作
          layerRef.mapInfoLayer.addTo(mapInstanceRef.current)
        } else {
          // 使用 MapInfoLayer 的 remove 方法而不是直接移除 Leaflet 图层
          // 这样可以正确清理标签和其他资源
          layerRef.mapInfoLayer.remove(mapInstanceRef.current)
        }
      }
    },

    setMapType: (type: 'roadmap' | 'satellite') => {
      console.log('[OnlineMap] setMapType called with type:', type)
      setMapLayerType(type)
      mapStateService.setState({ mapLayerType: type })
      // 图层更新由useEffect钩子统一处理，不直接操作图层
    },

    setLayerFileLabelVisibility: (fileId: string, visible: boolean, settings: any) => {
      console.log('[OnlineMap] setLayerFileLabelVisibility:', fileId, visible, settings)
      setPointFileLabelVisibilityState(prev => ({ ...prev, [fileId]: visible }))
      const layerRef = mapInfoLayerRefsRef.current.get(fileId)
      if (layerRef) {
        layerRef.mapInfoLayer.setLabelVisibility(visible)
        if (settings) {
          layerRef.mapInfoLayer.setLabelConfig(settings)
        }
      }
    },

    toggleMapType: () => {
      toggleMapType()
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
          <h3 style="margin: 0 0 5px 0; font-size: 14px; color: #ef4444;">${t('map.locationPoint')}${index}</h3>
          <p style="margin: 0; font-size: 12px; color: #666;">
            ${t('map.longitude')}: ${marker.lng.toFixed(6)}<br>
            ${t('map.latitude')}: ${marker.lat.toFixed(6)}
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
    },

    setNeighborHighlight: (config: NeighborHighlightConfig | null) => {
      neighborHighlightConfigRef.current = config
      if (lteSectorLayerRef.current) {
        lteSectorLayerRef.current.setNeighborHighlightMode(config)
      }
      if (nrSectorLayerRef.current) {
        nrSectorLayerRef.current.setNeighborHighlightMode(config)
      }
    },

    clearNeighborHighlight: () => {
      neighborHighlightConfigRef.current = null
      if (lteSectorLayerRef.current) {
        lteSectorLayerRef.current.setNeighborHighlightMode(null)
      }
      if (nrSectorLayerRef.current) {
        nrSectorLayerRef.current.setNeighborHighlightMode(null)
      }
    },

    setSectorIdWhitelist: (whitelist: Set<string> | null, mode: 'pci-planning' | 'neighbor-planning' | 'tac-check', networkType?: 'LTE' | 'NR') => {
      console.log('[OnlineMap] setSectorIdWhitelist 调用', { whitelistCount: whitelist?.size, mode, networkType })

      // 只在PCI/邻区规划/TAC核查模式下处理
      if (mode !== 'pci-planning' && mode !== 'neighbor-planning' && mode !== 'tac-check') {
        console.log('[OnlineMap] 非PCI/邻区规划/TAC核查模式，忽略白名单设置')
        return
      }

      // 如果设置白名单（非null），需要加载对应的同步数据
      if (whitelist !== null) {
        if (mode === 'pci-planning') {
          // PCI模式：使用PCI数据同步服务，只加载指定网络类型的数据
          // 关键修复：使用 getUpdatedPCIData() 而不是 getSyncedData()
          // getUpdatedPCIData() 会将 syncedPCI 正确赋值给 pci 字段
          const updatedData = pciDataSyncService.getUpdatedPCIData()
          if (updatedData) {
            // 如果指定了网络类型，只加载该类型的数据；否则加载所有数据
            const loadLTE = !networkType || networkType === 'LTE'
            const loadNR = !networkType || networkType === 'NR'

            // 坐标转换（数据已经是更新后的PCI）
            const sectorData = {
              lte: loadLTE ? updatedData.lte.map(s => {
                const [displayLat, displayLng] = CoordinateTransformer.wgs84ToGcj02(s.latitude || 0, s.longitude || 0)
                return { ...s, displayLat, displayLng }
              }) : [],
              nr: loadNR ? updatedData.nr.map(s => {
                const [displayLat, displayLng] = CoordinateTransformer.wgs84ToGcj02(s.latitude || 0, s.longitude || 0)
                return { ...s, displayLat, displayLng }
              }) : []
            }
            // 记录数据验证信息
            const sectorIdsInData = {
              lte: sectorData.lte.map(s => s.id),
              nr: sectorData.nr.map(s => s.id)
            }
            console.log('[OnlineMap] PCI模式加载扇区数据（使用更新后的PCI）', {
              loadLTE, loadNR,
              lteCount: sectorData.lte.length,
              nrCount: sectorData.nr.length,
              networkType,
              sampleLteIds: sectorIdsInData.lte.slice(0, 5),
              sampleNrIds: sectorIdsInData.nr.slice(0, 5)
            })
            setSectorData(sectorData)

            // 延迟应用高亮，只对加载的图层应用
            setTimeout(() => {
              if (pciHighlightConfigRef.current) {
                if (loadLTE && lteSectorLayerRef.current) lteSectorLayerRef.current.setPCIHighlightMode(pciHighlightConfigRef.current)
                if (loadNR && nrSectorLayerRef.current) nrSectorLayerRef.current.setPCIHighlightMode(pciHighlightConfigRef.current)
              }
            }, 100)
          }
        } else if (mode === 'neighbor-planning') {
          // 邻区规划模式：使用全量工参数据
          const fullParamsData = neighborDataSyncService.getFullParamsData()
          if (fullParamsData) {
            const sectorData = {
              lte: initialLayerVisibility.lte ? fullParamsData.lte : [],
              nr: initialLayerVisibility.nr ? fullParamsData.nr : []
            }
            setSectorData(sectorData)

            // 延迟应用高亮
            setTimeout(() => {
              if (neighborHighlightConfigRef.current) {
                if (lteSectorLayerRef.current) lteSectorLayerRef.current.setNeighborHighlightMode(neighborHighlightConfigRef.current)
                if (nrSectorLayerRef.current) nrSectorLayerRef.current.setNeighborHighlightMode(neighborHighlightConfigRef.current)
              }
            }, 100)
          }
        } else if (mode === 'tac-check') {
          // TAC核查模式：从tacDataSyncService加载全量同步数据
          // 严格按网络类型过滤，不考虑 initialLayerVisibility
          const syncedData = tacDataSyncService.getSyncedData()
          if (syncedData) {
            // 必须指定网络类型，默认为 LTE
            const effectiveNetworkType = networkType || 'LTE'
            const loadLTE = effectiveNetworkType === 'LTE'
            const loadNR = effectiveNetworkType === 'NR'

            // 初始化/更新TAC高亮配置，包含网络类型信息，确保createSectorLayers能正确过滤图层
            // 保留当前选中的扇区ID，但更新网络类型
            const currentSelectedId = tacHighlightConfigRef.current?.selectedId || null
            tacHighlightConfigRef.current = {
              selectedId: currentSelectedId,
              networkType: effectiveNetworkType
            }
            console.log('[OnlineMap] 初始化TAC高亮配置', { networkType: effectiveNetworkType, previousSelectedId: currentSelectedId })

            const sectorDataToLoad = {
              lte: loadLTE
                ? syncedData.lte.map(s => {
                  const [displayLat, displayLng] = CoordinateTransformer.wgs84ToGcj02(s.latitude || 0, s.longitude || 0)
                  return { ...s, displayLat, displayLng }
                })
                : [],
              nr: loadNR
                ? syncedData.nr.map(s => {
                  const [displayLat, displayLng] = CoordinateTransformer.wgs84ToGcj02(s.latitude || 0, s.longitude || 0)
                  return { ...s, displayLat, displayLng }
                })
                : []
            }
            console.log('[OnlineMap] TAC核查模式加载扇区数据', {
              networkType: effectiveNetworkType,
              loadLTE,
              loadNR,
              lteCount: sectorDataToLoad.lte.length,
              nrCount: sectorDataToLoad.nr.length
            })
            setSectorData(sectorDataToLoad)

            // 延迟应用TAC高亮
            setTimeout(() => {
              if (tacHighlightConfigRef.current) {
                if (loadLTE && lteSectorLayerRef.current) lteSectorLayerRef.current.setTACHighlightMode(tacHighlightConfigRef.current)
                if (loadNR && nrSectorLayerRef.current) nrSectorLayerRef.current.setTACHighlightMode(tacHighlightConfigRef.current)
              }
            }, 100)
          }
        }
      }

      // 设置扇区图层的白名单和渲染模式
      // 对于PCI规划和TAC核查模式，只对加载的图层设置白名单
      if (mode === 'pci-planning' || mode === 'tac-check') {
        // 使用 effectiveNetworkType 确保正确过滤
        const effectiveNetworkType = networkType || 'LTE'
        const loadLTE = effectiveNetworkType === 'LTE'
        const loadNR = effectiveNetworkType === 'NR'

        if (loadLTE && lteSectorLayerRef.current) {
          lteSectorLayerRef.current.setSectorIdWhitelist(whitelist)
          lteSectorLayerRef.current.setRenderMode(mode as any)
        }
        if (loadNR && nrSectorLayerRef.current) {
          nrSectorLayerRef.current.setSectorIdWhitelist(whitelist)
          nrSectorLayerRef.current.setRenderMode(mode as any)
        }
      } else {
        // 其他模式：对所有图层设置白名单
        if (lteSectorLayerRef.current) {
          lteSectorLayerRef.current.setSectorIdWhitelist(whitelist)
          lteSectorLayerRef.current.setRenderMode(mode as any)
        }
        if (nrSectorLayerRef.current) {
          nrSectorLayerRef.current.setSectorIdWhitelist(whitelist)
          nrSectorLayerRef.current.setRenderMode(mode as any)
        }
      }
    },

    clearSectorIdWhitelist: () => {
      console.log('[OnlineMap] clearSectorIdWhitelist 调用')
      if (lteSectorLayerRef.current) {
        lteSectorLayerRef.current.setSectorIdWhitelist(null)
        lteSectorLayerRef.current.setRenderMode('default')
      }
      if (nrSectorLayerRef.current) {
        nrSectorLayerRef.current.setSectorIdWhitelist(null)
        nrSectorLayerRef.current.setRenderMode('default')
      }

      // 恢复默认展示数据
      loadSectorData()
    },

    setPCIHighlightMode: (config: PCIHighlightConfig | null) => {
      pciHighlightConfigRef.current = config
      if (lteSectorLayerRef.current) lteSectorLayerRef.current.setPCIHighlightMode(config)
      if (nrSectorLayerRef.current) nrSectorLayerRef.current.setPCIHighlightMode(config)
    },

    setTACHighlightMode: (config: TACHighlightConfig | null) => {
      tacHighlightConfigRef.current = config
      if (lteSectorLayerRef.current) lteSectorLayerRef.current.setTACHighlightMode(config)
      if (nrSectorLayerRef.current) nrSectorLayerRef.current.setTACHighlightMode(config)
    },

    clearPCIHighlight: () => {
      pciHighlightConfigRef.current = null
      if (lteSectorLayerRef.current) lteSectorLayerRef.current.setPCIHighlightMode(null)
      if (nrSectorLayerRef.current) nrSectorLayerRef.current.setPCIHighlightMode(null)
    },

    clearSelectionHighlight: () => {
      preserveSelectionRef.current = false // 清除保留状态标志
      // 清除选中状态
      selectedFeaturesRef.current = []
      selectedIdsRef.current = new Set()
      selectionPointsRef.current = []
      // 清除扇区图层高亮
      if (lteSectorLayerRef.current) lteSectorLayerRef.current.setSelectionHighlight(null)
      if (nrSectorLayerRef.current) nrSectorLayerRef.current.setSelectionHighlight(null)
      // 清除MapInfo图层高亮
      mapInfoLayerRefsRef.current.forEach(({ mapInfoLayer }) => {
        mapInfoLayer.setSelectionHighlight(null)
      })
      // 清除框选形状
      const map = mapInstanceRef.current
      if (map) {
        if (selectionShapeRef.current) {
          map.removeLayer(selectionShapeRef.current)
          selectionShapeRef.current = null
        }
        if (polygonTempLayerRef.current) {
          map.removeLayer(polygonTempLayerRef.current)
          polygonTempLayerRef.current = null
        }
      }
      setSelectionTip('')
    },

    setSelectionHighlight: (ids: Set<string> | null) => {
      if (lteSectorLayerRef.current) lteSectorLayerRef.current.setSelectionHighlight(ids)
      if (nrSectorLayerRef.current) nrSectorLayerRef.current.setSelectionHighlight(ids)
    },

    getPointFileData: () => {
      const data: Record<string, any[]> = {}
      pointFileDataRef.current.forEach((value, key) => {
        data[key] = value
      })
      return data
    },

    setSectorLabelSettings: (settings: any, layerId: string) => {
      console.log('[OnlineMap] setSectorLabelSettings:', layerId, settings)
      if (layerId === 'lte-sectors' && lteSectorLayerRef.current) {
        lteSectorLayerRef.current.updateLabelConfig(settings)
      } else if (layerId === 'nr-sectors' && nrSectorLayerRef.current) {
        nrSectorLayerRef.current.updateLabelConfig(settings)
      }
    },

    setLayerFileLabelSettings: (fileId: string, settings: any) => {
      console.log('[OnlineMap] setLayerFileLabelSettings:', fileId, settings)
      const layerRef = mapInfoLayerRefsRef.current.get(fileId)
      if (layerRef && layerRef.mapInfoLayer) {
        layerRef.mapInfoLayer.setLabelConfig(settings)
      }
    },

    setMeasureMode: (enabled: boolean) => {
      console.log('[OnlineMap] setMeasureMode:', enabled)
      measureModeRef.current = enabled
      // useEffect hook会自动处理扇区图层的测距模式更新
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
    // 测距模式或圈选模式下不显示扇区属性
    if (measureModeRef.current || selectionModeRef.current !== 'none') return;

    // PCI规划模式下不显示扇区属性面板，只调用点击回调
    if (mode === 'pci-planning') {
      if (onSectorClick) {
        onSectorClick(sector)
      }
      return
    }

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

    // 过滤并去重
    const uniqueOverlapping = allOverlapping.filter((v, i, a) => a.findIndex(t => t.id === v.id) === i)

    if (uniqueOverlapping.length > 1) {
      setOverlappingSectors(uniqueOverlapping)
      setOverlapPosition({ x: clientX, y: clientY })
    } else {
      showSectorInfo(sector, event)
    }

    if (onSectorClick) {
      onSectorClick(sector)
    }
  }, [showSectorInfo, layerVisibility, onSectorClick, mode])

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
    // 框选模式下不处理地图点击事件
    if (selectionModeRef.current !== 'none') return

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
        labelText = t('map.measureStartPoint') || '起点'
      } else {
        for (let i = 0; i < updatedPoints.length - 1; i++) {
          totalDist += calculateDistance(updatedPoints[i].lat, updatedPoints[i].lng, updatedPoints[i + 1].lat, updatedPoints[i + 1].lng)
        }
        labelText = `${totalDist.toFixed(2)}${t('map.meters')}`
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
                ${t('map.totalDistance')} ${totalDist.toFixed(2)}${t('map.meters')}
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
   * 处理全键盘事件，支持 Esc 退出测距/框选，Ctrl+C 复制选中要素，Backspace 删除多边形最后一个点
   */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (measureModeRef.current) {
        if (e.key === 'Escape') {
          onMeasureModeEnd?.()
        } else if (e.key === 'Backspace') {
          e.preventDefault()
          undoLastPointRef.current()
        }
      } else if (selectionModeRef.current !== 'none') {
        if (e.key === 'Escape') {
          // 按Escape键时，清除选中状态
          preserveSelectionRef.current = false
          onSelectionModeEnd?.()
        } else if (e.key === 'Backspace' && selectionModeRef.current === 'polygon') {
          // 多边形模式：删除最后一个点
          e.preventDefault()
          const map = mapInstanceRef.current
          if (!map) return

          if (selectionPointsRef.current.length > 0) {
            // 删除最后一个点
            selectionPointsRef.current.pop()

            // 清除临时多边形线
            if (polygonTempLayerRef.current) {
              map.removeLayer(polygonTempLayerRef.current)
              polygonTempLayerRef.current = null
            }

            // 如果还有剩余的点，重新绘制临时线
            if (selectionPointsRef.current.length >= 2) {
              const points = selectionPointsRef.current.map(p => [p.lat, p.lng])
              const L = window.L
              polygonTempLayerRef.current = L.polyline(points as L.LatLngExpression[], {
                color: '#00ffff',
                weight: 2,
                dashArray: '5, 5'
              }).addTo(map)
            }

            // 更新提示信息
            if (selectionPointsRef.current.length === 0) {
              setSelectionTip('点击添加多边形顶点，双击完成绘制，按 Backspace 删除上一个点')
            } else {
              setSelectionTip(`已添加 ${selectionPointsRef.current.length} 个点，双击完成绘制，按 Backspace 删除上一个点`)
            }
          }
        } else if (e.key === 'c' && (e.ctrlKey || e.metaKey)) {
          // Ctrl+C 复制选中要素到剪贴板
          if (selectedFeaturesRef.current.length > 0) {
            copySelectionToClipboard(selectedFeaturesRef.current)
          }
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onMeasureModeEnd, onSelectionModeEnd])

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
   * 创建扇区图层的辅助函数
   */
  const createSectorLayer = useCallback((options: {
    sectors: RenderSectorData[]
    onClick: (sector: RenderSectorData, event: L.LeafletMouseEvent) => void
    zoom: number
    showLabels: boolean
    labelConfig?: SectorLabelConfig
    measureMode?: boolean
  }) => {
    return new SectorSVGLayer({
      sectors: options.sectors,
      zoom: options.zoom,
      showLabels: options.showLabels,
      labelConfig: options.labelConfig,
      onClick: options.onClick,
      measureMode: options.measureMode || false
    })
  }, [])

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

    // 在TAC-check模式下，根据配置的网络类型只创建对应图层
    let shouldCreateLTELayer = sectorData.lte.length > 0
    let shouldCreateNRLayer = sectorData.nr.length > 0

    if (mode === 'tac-check') {
      const effectiveNetworkType = tacHighlightConfigRef.current?.networkType || 'LTE'
      shouldCreateLTELayer = effectiveNetworkType === 'LTE' && sectorData.lte.length > 0
      shouldCreateNRLayer = effectiveNetworkType === 'NR' && sectorData.nr.length > 0
      console.log('[OnlineMap] TAC-check模式创建图层', {
        effectiveNetworkType,
        shouldCreateLTELayer,
        shouldCreateNRLayer,
        lteDataCount: sectorData.lte.length,
        nrDataCount: sectorData.nr.length
      })
    }

    // 创建LTE扇区图层
    if (shouldCreateLTELayer) {
      lteSectorLayerRef.current = createSectorLayer({
        sectors: sectorData.lte,
        onClick: (sector, event) => handleSectorClick(sector, event),
        zoom: currentZoom,
        // PCI规划模式下禁用标签显示
        showLabels: mode !== 'pci-planning' && (labelVisibility.lte || (sectorLabelVisibility && sectorLabelVisibility['lte-sectors'])),
        labelConfig: labelSettingsMap && labelSettingsMap['lte-sectors'],
        measureMode: measureMode
      })
      if (layerVisibility.lte) {
        lteSectorLayerRef.current.addTo(mapInstanceRef.current)
      }

      // 设置渲染模式
      lteSectorLayerRef.current.setRenderMode(mode as any)

      // TAC核查模式：立即应用TAC高亮配置，确保初始渲染使用正确的TAC颜色
      if (mode === 'tac-check' && tacHighlightConfigRef.current) {
        lteSectorLayerRef.current.setTACHighlightMode(tacHighlightConfigRef.current)
        console.log('[OnlineMap] LTE图层应用TAC高亮配置', tacHighlightConfigRef.current)
      }

      // 应用当前频点可见性
      const visibilityMap = new Map<number, boolean>()
      frequencies.lte.forEach(f => visibilityMap.set(f.frequency, f.visible))
      lteSectorLayerRef.current.setFrequenciesVisibility(visibilityMap)
    }

    // 创建NR扇区图层
    if (shouldCreateNRLayer) {
      nrSectorLayerRef.current = createSectorLayer({
        sectors: sectorData.nr,
        onClick: (sector, event) => handleSectorClick(sector, event),
        zoom: currentZoom,
        // PCI规划模式下禁用标签显示
        showLabels: mode !== 'pci-planning' && (labelVisibility.nr || (sectorLabelVisibility && sectorLabelVisibility['nr-sectors'])),
        labelConfig: labelSettingsMap && labelSettingsMap['nr-sectors'],
        measureMode: measureMode
      })
      if (layerVisibility.nr) {
        nrSectorLayerRef.current.addTo(mapInstanceRef.current)
      }

      // 设置渲染模式
      nrSectorLayerRef.current.setRenderMode(mode as any)

      // TAC核查模式：立即应用TAC高亮配置，确保初始渲染使用正确的TAC颜色
      if (mode === 'tac-check' && tacHighlightConfigRef.current) {
        nrSectorLayerRef.current.setTACHighlightMode(tacHighlightConfigRef.current)
        console.log('[OnlineMap] NR图层应用TAC高亮配置', tacHighlightConfigRef.current)
      }

      // 应用当前频点可见性
      const visibilityMap = new Map<number, boolean>()
      frequencies.nr.forEach(f => visibilityMap.set(f.frequency, f.visible))
      nrSectorLayerRef.current.setFrequenciesVisibility(visibilityMap)
    }
  }, [sectorData, layerVisibility, labelVisibility, sectorLabelVisibility, labelSettingsMap, handleSectorClick, mode, frequencies, createSectorLayer, measureMode])

  /**
   * 加载单个MapInfo图层或Excel点图层
   */
  const loadMapInfoLayer = useCallback(async (layerFile: LayerFileOption) => {
    if (!mapInstanceRef.current) return

    console.log('[OnlineMap] loadMapInfoLayer 开始加载:', layerFile.id, layerFile.name, 'sourceType:', layerFile.sourceType, 'visible:', layerFile.visible)

    // 如果已经加载过，跳过
    if (loadedMapInfoLayersRef.current.has(layerFile.id)) {
      console.log('[OnlineMap] 图层已加载，跳过:', layerFile.id)
      return
    }

    try {
      let geojsonData: GeoJSON.FeatureCollection | null = null

      if (layerFile.sourceType === 'excel') {
        console.log('[OnlineMap] 从Excel加载点数据, dataId:', layerFile.dataId)
        const response = await dataApi.get(layerFile.dataId)
        console.log('[OnlineMap] Excel API响应:', response.success, '有数据:', !!response.data)
        console.log('[OnlineMap] response.data type:', Array.isArray(response.data) ? 'array' : typeof response.data)
        console.log('[OnlineMap] response.data keys:', response.data ? Object.keys(response.data) : 'no data')

        // 后端返回的数据格式：
        // 1. default.json -> 直接返回数组
        // 2. data.json -> 直接返回数组
        // 3. LTE.json/NR.json -> 返回 {lte: [...]} 或 {nr: [...]}
        // 前端需要正确处理这些格式
        let rawData = null
        if (Array.isArray(response.data)) {
          // 直接是数组格式
          rawData = response.data
          console.log('[OnlineMap] 数据是数组格式，长度:', rawData.length)
        } else if (response.data && typeof response.data === 'object') {
          // 可能是 {lte: [...]} 或 {nr: [...]} 或 {default: [...]} 格式
          if (response.data.default) {
            rawData = response.data.default
            console.log('[OnlineMap] 从 data.default 获取数据，长度:', rawData.length)
          } else if (response.data.lte) {
            rawData = response.data.lte
            console.log('[OnlineMap] 从 data.lte 获取数据，长度:', rawData.length)
          } else if (response.data.nr) {
            rawData = response.data.nr
            console.log('[OnlineMap] 从 data.nr 获取数据，长度:', rawData.length)
          }
        }

        if (rawData && rawData.length > 0) {
          // 存储原始数据用于标签渲染
          const pointData = rawData.filter((item: any) => item.longitude && item.latitude)
          console.log('[OnlineMap] 过滤后的点数据数量:', pointData.length)
          pointFileDataRef.current.set(layerFile.id, pointData)

          // 转换Excel数据为GeoJSON
          // 注意：这里使用原始 WGS84 坐标，不进行前端转换
          // MapInfoLayer.fromGeoJSON 会通过 transformFeatureCoordinates 进行 WGS84 -> GCJ02 转换
          // 这样确保只有一次坐标转换，避免双重纠偏导致位置偏移
          const features = pointData.map((item: any) => {
            return {
              type: 'Feature',
              geometry: {
                type: 'Point',
                // GeoJSON 坐标格式: [longitude, latitude] (原始 WGS84)
                coordinates: [item.longitude || 0, item.latitude || 0]
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
          console.warn('[OnlineMap] 图层数据不存在或为空，跳过:', layerFile.id, layerFile.name, 'rawData存在:', !!rawData, 'rawData长度:', rawData?.length || 0)
          return
        }
      } else {
        // 默认 MapInfo 图层
        console.log('[OnlineMap] 从MapInfo文件加载图层, dataId:', layerFile.dataId)
        const response = await layerApi.getLayerData(layerFile.dataId, layerFile.id)
        console.log('[OnlineMap] MapInfo API响应:', response.success, '有数据:', !!response.data)
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
          visible: layerFile.visible,
          onFeatureClick: (properties, event) => showFeatureInfo(properties, event, layerFile.name)
        }

        // 创建 Map Info 图层
        console.log('[OnlineMap] 开始创建MapInfoLayer, options:', { id: options.id, name: options.name, type: options.type })
        const mapInfoLayer = await MapInfoLayer.fromGeoJSON(options)
        const leafletLayer = mapInfoLayer.getLeafletLayer()
        console.log('[OnlineMap] MapInfoLayer创建完成, leafletLayer存在:', !!leafletLayer)

        if (leafletLayer) {
          // 存储图层实例和 Leaflet 图层以便控制
          mapInfoLayerRefsRef.current.set(layerFile.id, { mapInfoLayer, leafletLayer })
          loadedMapInfoLayersRef.current.add(layerFile.id)
          console.log('[OnlineMap] 图层已存储到refs, loaded状态:', loadedMapInfoLayersRef.current.has(layerFile.id))

          // 同步标签可见性
          const labelVisible = pointFileLabelVisibility[layerFile.id] || false
          mapInfoLayer.setLabelVisibility(labelVisible)
          if (labelSettingsMap[layerFile.id]) {
            mapInfoLayer.setLabelConfig(labelSettingsMap[layerFile.id])
          }

          console.log('[OnlineMap] Layer created:', layerFile.id, 'visible:', layerFile.visible)

          // 根据初始可见性决定是否添加到地图
          if (layerFile.visible && mapInstanceRef.current) {
            // 使用 MapInfoLayer 的 addTo 方法而不是直接添加 Leaflet 图层
            // 这样可以正确设置 currentMap 引用，使标签功能能够工作
            console.log('[OnlineMap] 准备添加图层到地图...')
            mapInfoLayer.addTo(mapInstanceRef.current)
            console.log('[OnlineMap] Layer added to map on load:', layerFile.id)
          } else {
            console.log('[OnlineMap] Layer created but NOT added to map (visible=' + layerFile.visible + ', mapInstance=' + !!mapInstanceRef.current + ')')
          }
        } else {
          console.error('[OnlineMap] Failed to create Leaflet layer for:', layerFile.id)
        }
      }
    } catch (error) {
      console.error('[OnlineMap] 加载图层失败:', layerFile.id, error)
    }
  }, [pointFileLabelVisibility, labelSettingsMap, showFeatureInfo])

  /**
   * 加载所有MapInfo图层
   */
  const loadMapInfoLayers = useCallback(async () => {
    if (!mapInfoLayerManagerRef.current || !mapInstanceRef.current) return

    const allFiles = [...layerFiles, ...pointFiles]
    console.log('[OnlineMap] Loading all layers, count:', allFiles.length)

    for (const layerFile of allFiles) {
      await loadMapInfoLayer(layerFile)
    }
  }, [layerFiles, pointFiles, loadMapInfoLayer])

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
                                    ${currentTotal.toFixed(2)}${t('map.meters')}
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
        // 注意：高德地图服务器对不存在的瓦片（如海洋区域、地图边界外）会返回 404，这是正常行为
        const tileLayer = L.tileLayer(getAMapTileUrl(savedState.mapLayerType), {
          attribution: '&copy; <a href="https://www.amap.com/">高德地图</a>',
          maxZoom: 18,
          minZoom: 3
        }).addTo(map)

        // 监听浏览器网络状态变化（仅依赖系统级事件）
        const handleOnline = () => {
          console.log('[OnlineMap] 浏览器检测到网络恢复')
          hasNetworkErrorRef.current = false
          // 清除错误提示
          if (networkError.visible) {
            setNetworkError(prev => ({ ...prev, visible: false }))
          }
        }

        const handleOffline = () => {
          console.log('[OnlineMap] 浏览器检测到网络断开')
          hasNetworkErrorRef.current = true
          // 显示错误提示
          setNetworkError({
            visible: true,
            message: '网络连接已断开，请检查网络设置',
            canRetry: true
          })
        }

        window.addEventListener('online', handleOnline)
        window.addEventListener('offline', handleOffline)

        // 保存事件监听器引用，用于清理
        networkEventListenersRef.current = {
          handleOnline,
          handleOffline,
          cleanup: () => {
            window.removeEventListener('online', handleOnline)
            window.removeEventListener('offline', handleOffline)
          }
        }

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

        // 判断错误类型并设置网络错误状态
        const errorMessage = error instanceof Error ? error.message : '未知错误'

        // 检查是否是网络相关错误
        const isNetworkError = errorMessage.includes('Failed to fetch') ||
                             errorMessage.includes('NetworkError') ||
                             errorMessage.includes('load') ||
                             errorMessage.includes('网络')

        setNetworkError({
          visible: true,
          message: isNetworkError
            ? '网络连接异常，无法加载在线地图。请检查网络连接或后端服务状态。'
            : `地图初始化失败: ${errorMessage}`,
          canRetry: true
        })

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
      // 清理瓦片加载超时定时器
      if (tileLoadTimeoutRef.current) {
        clearTimeout(tileLoadTimeoutRef.current)
        tileLoadTimeoutRef.current = null
      }
      // 清理网络事件监听器和定时器
      if (networkEventListenersRef.current) {
        if (networkEventListenersRef.current.cleanup) {
          networkEventListenersRef.current.cleanup()
        } else {
          // 兼容旧版本逻辑
          window.removeEventListener('online', networkEventListenersRef.current.handleOnline)
          window.removeEventListener('offline', networkEventListenersRef.current.handleOffline)
        }
        networkEventListenersRef.current = null
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

  useEffect(() => {
    if (mapInstanceRef.current) {
      const map = mapInstanceRef.current
      if (measureMode) {
        map.getContainer().style.cursor = 'crosshair'
        map.dragging.enable()
        map.doubleClickZoom.disable() // 测距模式下禁用双击缩放，改为结束测距

        // 通知扇区图层进入测距模式，禁用扇区点击
        if (lteSectorLayerRef.current) {
          lteSectorLayerRef.current.setMeasureMode(true)
        }
        if (nrSectorLayerRef.current) {
          nrSectorLayerRef.current.setMeasureMode(true)
        }
      } else {
        map.getContainer().style.cursor = mapDragTool ? 'default' : 'default' // 保持默认
        map.dragging.enable()
        map.doubleClickZoom.enable()

        // 通知扇区图层退出测距模式，恢复扇区点击
        if (lteSectorLayerRef.current) {
          lteSectorLayerRef.current.setMeasureMode(false)
        }
        if (nrSectorLayerRef.current) {
          nrSectorLayerRef.current.setMeasureMode(false)
        }
      }
    }
  }, [measureMode, mapDragTool])

  /**
   * 监听地图拖拽工具状态
   */
  useEffect(() => {
    if (mapInstanceRef.current) {
      const map = mapInstanceRef.current
      if (mapDragTool) {
        map.dragging.enable()
      } else if (!measureMode && selectionMode === 'none') {
        // 只有在非测量且非圈选模式下，才根据拖拽工具状态禁用（如果需要的话，但通常地图都需要拖拽）
        // 这里根据需求逻辑决定是否禁用
      }
    }
  }, [mapDragTool, measureMode, selectionMode])

  /**
   * 框选功能辅助函数
   */

  /**
   * 清除选中状态和高亮
   */
  const clearSelectionState = useCallback(() => {
    selectedFeaturesRef.current = []
    selectedIdsRef.current = new Set()
    // 清除扇区图层高亮
    if (lteSectorLayerRef.current) {
      lteSectorLayerRef.current.setSelectionHighlight(null)
    }
    if (nrSectorLayerRef.current) {
      nrSectorLayerRef.current.setSelectionHighlight(null)
    }
    // 清除MapInfo图层高亮
    mapInfoLayerRefsRef.current.forEach(({ mapInfoLayer }) => {
      mapInfoLayer.setSelectionHighlight(null)
    })
  }, [])

  /**
   * 点选：选择点击位置附近的要素
   * @param latLng 点击位置 (GCJ-02渲染坐标)
   * @param clientX 浏览器视口X坐标 (用于精确像素命中检测)
   * @param clientY 浏览器视口Y坐标 (用于精确像素命中检测)
   * @param isMultiSelect 是否多选模式（Shift+点击）
   * @returns 选中的要素及其属性
   */
  const selectFeaturesAtPoint = useCallback((latLng: L.LatLng, clientX?: number, clientY?: number, isMultiSelect: boolean = false): { ids: Set<string>, properties: any[] } => {
    // 获取当前图层可见性
    const visibility = layerVisibilityRef.current

    // 收集点击位置的所有要素
    const clickedFeatures: Array<{ id: string, props: any, layerType: string }> = []

    // 1. 遍历所有MapInfoLayer（只选择可见图层）
    mapInfoLayerRefsRef.current.forEach(({ mapInfoLayer }) => {
      // 检查图层是否可见
      if (!mapInfoLayer.isVisible()) return

      // 获取图层内的所有要素
      const geoJSONLayer = mapInfoLayer.getLeafletLayer()
      if (!geoJSONLayer) return

      geoJSONLayer.eachLayer((layer: any) => {
        let isNear = false

        if (layer.getLatLng) {
          // 点要素
          const pointLatLng = layer.getLatLng()
          const distance = latLng.distanceTo(pointLatLng)
          isNear = distance < 30 // 提高容差到30米
        } else if (layer.getBounds) {
          // 线/面要素: 检查边界是否包含点击点
          const bounds = layer.getBounds()
          isNear = bounds.contains(latLng)
        }

        if (isNear) {
          const props = layer.feature.properties
          // 尝试多种可能的ID字段
          const id = props.id || props.name || props.小区名称 || props.OBJECTID || ''
          if (id) {
            clickedFeatures.push({ id: String(id), props: { ...props, _layerType: 'MapInfo' }, layerType: 'MapInfo' })
          }
        }
      })
    })

    // 2. 遍历扇区图层 (LTE/NR) - 只选择可见图层
    if (visibility.lte && lteSectorLayerRef.current) {
      let sectorsAtPoint: RenderSectorData[] = []
      if (clientX !== undefined && clientY !== undefined) {
        sectorsAtPoint = lteSectorLayerRef.current.getSectorsAt(clientX, clientY)
      }
      sectorsAtPoint.forEach(sector => {
        clickedFeatures.push({ id: String(sector.id), props: { ...sector, _layerType: 'LTE' }, layerType: 'LTE' })
      })
    }

    if (visibility.nr && nrSectorLayerRef.current) {
      let sectorsAtPoint: RenderSectorData[] = []
      if (clientX !== undefined && clientY !== undefined) {
        sectorsAtPoint = nrSectorLayerRef.current.getSectorsAt(clientX, clientY)
      }
      sectorsAtPoint.forEach(sector => {
        clickedFeatures.push({ id: String(sector.id), props: { ...sector, _layerType: 'NR' }, layerType: 'NR' })
      })
    }

    // 如果没有点击到任何要素，清除选中状态
    if (clickedFeatures.length === 0) {
      if (!isMultiSelect) {
        clearSelectionState()
        setSelectionTip('点击选择要素（再次点击取消），Shift+点击多选，按 Ctrl+C 复制')
      }
      return { ids: new Set(), properties: [] }
    }

    // 处理选中逻辑
    let selectedIds: Set<string>
    let selectedProperties: any[]

    if (isMultiSelect) {
      // 多选模式：从现有选中集合开始，添加新要素
      selectedIds = new Set(selectedIdsRef.current)
      selectedProperties = [...selectedFeaturesRef.current]

      clickedFeatures.forEach(feature => {
        if (!selectedIds.has(feature.id)) {
          selectedIds.add(feature.id)
          selectedProperties.push(feature.props)
          console.log('[OnlineMap] 点选添加要素:', feature.props.name || feature.id, 'from', feature.layerType)
        }
      })
    } else {
      // 单选模式：支持toggle操作
      if (clickedFeatures.length === 1) {
        // 只点击了一个要素，检查是否已选中
        const feature = clickedFeatures[0]
        const wasSelected = selectedIdsRef.current.has(feature.id)

        if (wasSelected) {
          // 已选中，取消选择
          selectedIds = new Set(selectedIdsRef.current)
          selectedProperties = [...selectedFeaturesRef.current]
          selectedIds.delete(feature.id)
          selectedProperties = selectedProperties.filter(p => {
            const pid = p.id || p.name || p.小区名称 || p.OBJECTID || ''
            return String(pid) !== feature.id
          })
          console.log('[OnlineMap] 点选取消要素:', feature.props.name || feature.id)
        } else {
          // 未选中，选中它
          selectedIds = new Set([feature.id])
          selectedProperties = [feature.props]
          console.log('[OnlineMap] 点选选中要素:', feature.props.name || feature.id, 'from', feature.layerType)
        }
      } else {
        // 点击了多个要素，只选中第一个
        const feature = clickedFeatures[0]
        selectedIds = new Set([feature.id])
        selectedProperties = [feature.props]
        console.log('[OnlineMap] 点选选中要素（多个中的第一个）:', feature.props.name || feature.id, 'from', feature.layerType)
      }
    }

    // 应用高亮
    console.log('[OnlineMap] 点选选中要素总数:', selectedIds.size, isMultiSelect ? '(多选模式)' : '')

    // 对MapInfoLayer应用高亮
    mapInfoLayerRefsRef.current.forEach(({ mapInfoLayer }) => {
      mapInfoLayer.setSelectionHighlight(selectedIds)
    })

    // 对扇区图层应用高亮
    if (lteSectorLayerRef.current) {
      lteSectorLayerRef.current.setSelectionHighlight(selectedIds)
    }
    if (nrSectorLayerRef.current) {
      nrSectorLayerRef.current.setSelectionHighlight(selectedIds)
    }

    // 保存选中状态到 Ref
    selectedFeaturesRef.current = selectedProperties
    selectedIdsRef.current = selectedIds

    // 更新提示信息
    if (selectedIds.size > 0) {
      setSelectionTip(`已选中 ${selectedIds.size} 个要素，按 Ctrl+C 复制`)
    } else {
      setSelectionTip('点击选择要素（再次点击取消），Shift+点击多选，按 Ctrl+C 复制')
    }

    return { ids: selectedIds, properties: selectedProperties }
  }, [])

  /**
   * 圆形选择：选择圆内的所有要素
   * @param center 圆心 (GCJ-02渲染坐标)
   * @param radius 半径 (米)
   * @returns 选中的要素及其属性
   */
  const selectFeaturesInCircle = useCallback((center: L.LatLng, radius: number): { ids: Set<string>, properties: any[] } => {
    // 获取当前图层可见性
    const visibility = layerVisibilityRef.current

    const selectedIds = new Set<string>()
    const selectedProperties: any[] = []

    // 1. 遍历所有MapInfoLayer（只选择可见图层）
    mapInfoLayerRefsRef.current.forEach(({ mapInfoLayer }) => {
      // 检查图层是否可见
      const isVisible = mapInfoLayer.isVisible()
      console.log('[OnlineMap] 圆形框选检查MapInfo图层:', {
        id: (mapInfoLayer as any).id,
        name: (mapInfoLayer as any).name,
        isVisible
      })
      if (!isVisible) return

      // 使用MapInfoLayer的getFeaturesInCircle方法
      const features = mapInfoLayer.getFeaturesInCircle(center, radius)
      console.log('[OnlineMap] MapInfo图层返回的要素数量:', features.length)

      // 收集要素ID和属性
      features.forEach(props => {
        const id = props.id || props.name || props.小区名称 || props.OBJECTID || ''
        console.log('[OnlineMap] 处理要素:', { id, props })
        if (id) {
          selectedIds.add(String(id))
          selectedProperties.push({ ...props, _layerType: 'MapInfo' })
        }
      })
    })

    // 2. 遍历扇区图层 (LTE/NR) - 只选择可见图层
    if (visibility.lte && lteSectorLayerRef.current) {
      const sectorsInCircle = lteSectorLayerRef.current.getSectorsInCircle(center, radius)
      sectorsInCircle.forEach(sector => {
        const id = String(sector.id)
        selectedIds.add(id)
        selectedProperties.push({ ...sector, _layerType: 'LTE' })
        console.log('[OnlineMap] 圆形框选选中LTE扇区:', sector.name, sector.id)
      })
    }

    if (visibility.nr && nrSectorLayerRef.current) {
      const sectorsInCircle = nrSectorLayerRef.current.getSectorsInCircle(center, radius)
      sectorsInCircle.forEach(sector => {
        const id = String(sector.id)
        selectedIds.add(id)
        selectedProperties.push({ ...sector, _layerType: 'NR' })
        console.log('[OnlineMap] 圆形框选选中NR扇区:', sector.name, sector.id)
      })
    }

    // 应用高亮
    if (selectedIds.size > 0) {
      console.log('[OnlineMap] 圆形框选选中要素总数:', selectedIds.size)

      // 对MapInfoLayer应用高亮
      mapInfoLayerRefsRef.current.forEach(({ mapInfoLayer }) => {
        mapInfoLayer.setSelectionHighlight(selectedIds)
      })

      // 对扇区图层应用高亮
      if (lteSectorLayerRef.current) {
        lteSectorLayerRef.current.setSelectionHighlight(selectedIds)
      }
      if (nrSectorLayerRef.current) {
        nrSectorLayerRef.current.setSelectionHighlight(selectedIds)
      }

      // 保存选中状态到 Ref
      selectedFeaturesRef.current = selectedProperties
      selectedIdsRef.current = selectedIds

      // 更新提示信息
      setSelectionTip(`已选中 ${selectedIds.size} 个要素，按 Ctrl+C 复制`)
    } else {
      setSelectionTip('未选中任何要素')
    }

    return { ids: selectedIds, properties: selectedProperties }
  }, [])

  /**
   * 多边形选择：选择多边形内的所有要素
   * @param points 多边形顶点 (GCJ-02渲染坐标)
   * @returns 选中的要素及其属性
   */
  const selectFeaturesInPolygon = useCallback((points: L.LatLng[]): { ids: Set<string>, properties: any[] } => {
    const L = window.L
    // 获取当前图层可见性
    const visibility = layerVisibilityRef.current

    const selectedIds = new Set<string>()
    const selectedProperties: any[] = []

    if (points.length < 3) {
      console.warn('[OnlineMap] 多边形至少需要3个点')
      return { ids: selectedIds, properties: selectedProperties }
    }

    // 创建临时多边形对象用于查询
    const polygon = L.polygon(points.map(p => [p.lat, p.lng]))

    // 1. 遍历所有MapInfoLayer（只选择可见图层）
    mapInfoLayerRefsRef.current.forEach(({ mapInfoLayer }) => {
      // 检查图层是否可见
      if (!mapInfoLayer.isVisible()) return

      // 使用MapInfoLayer的getFeaturesInPolygon方法
      const features = mapInfoLayer.getFeaturesInPolygon(polygon)

      // 收集要素ID和属性
      features.forEach(props => {
        const id = props.id || props.name || props.小区名称 || props.OBJECTID || ''
        if (id) {
          selectedIds.add(String(id))
          selectedProperties.push({ ...props, _layerType: 'MapInfo' })
        }
      })
    })

    // 2. 遍历扇区图层 (LTE/NR) - 只选择可见图层
    if (visibility.lte && lteSectorLayerRef.current) {
      const sectorsInPolygon = lteSectorLayerRef.current.getSectorsInPolygon(polygon)
      sectorsInPolygon.forEach(sector => {
        const id = String(sector.id)
        selectedIds.add(id)
        selectedProperties.push({ ...sector, _layerType: 'LTE' })
        console.log('[OnlineMap] 多边形框选选中LTE扇区:', sector.name, sector.id)
      })
    }

    if (visibility.nr && nrSectorLayerRef.current) {
      const sectorsInPolygon = nrSectorLayerRef.current.getSectorsInPolygon(polygon)
      sectorsInPolygon.forEach(sector => {
        const id = String(sector.id)
        selectedIds.add(id)
        selectedProperties.push({ ...sector, _layerType: 'NR' })
        console.log('[OnlineMap] 多边形框选选中NR扇区:', sector.name, sector.id)
      })
    }

    // 应用高亮
    if (selectedIds.size > 0) {
      console.log('[OnlineMap] 多边形框选选中要素总数:', selectedIds.size)

      // 对MapInfoLayer应用高亮
      mapInfoLayerRefsRef.current.forEach(({ mapInfoLayer }) => {
        mapInfoLayer.setSelectionHighlight(selectedIds)
      })

      // 对扇区图层应用高亮
      if (lteSectorLayerRef.current) {
        lteSectorLayerRef.current.setSelectionHighlight(selectedIds)
      }
      if (nrSectorLayerRef.current) {
        nrSectorLayerRef.current.setSelectionHighlight(selectedIds)
      }

      // 保存选中状态到 Ref
      selectedFeaturesRef.current = selectedProperties
      selectedIdsRef.current = selectedIds

      // 更新提示信息
      setSelectionTip(`已选中 ${selectedIds.size} 个要素，按 Ctrl+C 复制`)
    } else {
      setSelectionTip('未选中任何要素')
    }

    return { ids: selectedIds, properties: selectedProperties }
  }, [])

  /**
   * 将选中的要素属性格式化为 Tab 分隔的文本，用于粘贴到 Excel
   * @param properties 属性列表
   */
  const formatFeaturesToExcelText = (properties: any[]) => {
    if (!properties || properties.length === 0) return ''

    // 提取所有唯一的键作为表头 (排除内部私有字段和不必要的坐标字段)
    const excludeKeys = new Set(['displayLat', 'displayLng', '_layerType', 'geometry', 'id_type', 'layerId', 'properties', 'attributes'])
    const allKeys = new Set<string>()
    properties.forEach(p => {
      Object.keys(p).forEach(key => {
        if (!excludeKeys.has(key)) allKeys.add(key)
      })
      // 处理嵌套属性
      const nested = p.properties || p.attributes
      if (nested && typeof nested === 'object') {
        Object.keys(nested).forEach(key => {
          if (!excludeKeys.has(key)) allKeys.add(key)
        })
      }
    })

    const header = Array.from(allKeys)
    const rows = properties.map(p => {
      const nested = p.properties || p.attributes || {}
      return header.map(key => {
        const val = p[key] !== undefined ? p[key] : nested[key]
        return val === undefined || val === null ? '' : String(val).replace(/[\r\n\t]/g, ' ')
      }).join('\t')
    })

    return [header.join('\t'), ...rows].join('\n')
  }

  /**
   * 复制选中要素到剪贴板并提示
   */
  const copySelectionToClipboard = (properties: any[]) => {
    const excelText = formatFeaturesToExcelText(properties)
    if (excelText) {
      navigator.clipboard.writeText(excelText).then(() => {
        console.log('[OnlineMap] 选中要素属性已复制到剪贴板，数量:', properties.length)
      }).catch(err => {
        console.error('[OnlineMap] 复制到剪贴板失败:', err)
      })
    }
  }

  /**
   * 监听圈选模式变化 - 控制地图拖拽和交互
   */
  useEffect(() => {
    const isSelectionActive = selectionMode !== 'none'
    if (lteSectorLayerRef.current) lteSectorLayerRef.current.updateSelectionMode(isSelectionActive)
    if (nrSectorLayerRef.current) nrSectorLayerRef.current.updateSelectionMode(isSelectionActive)

    // 框选模式下禁用 MapInfoLayer 的点击交互
    mapInfoLayerRefsRef.current.forEach(({ mapInfoLayer }) => {
      mapInfoLayer.setInteractive(!isSelectionActive)
    })

    if (mapInstanceRef.current) {
      const map = mapInstanceRef.current
      if (isSelectionActive) {
        // 只有圆形模式需要禁用地图拖拽（因为需要拖拽绘制圆形）
        // 点选和多边形模式允许拖拽地图
        if (selectionMode === 'circle') {
          map.dragging.disable()
        } else {
          map.dragging.enable()
        }
        map.doubleClickZoom.disable() // 圈选时禁用双击放大
        // 根据模式设置提示
        if (selectionMode === 'point') {
          setSelectionTip('点击选择要素（再次点击取消），Shift+点击多选，按 Ctrl+C 复制')
        } else if (selectionMode === 'circle') {
          setSelectionTip('按住鼠标左键拖动绘制圆形')
        } else if (selectionMode === 'polygon') {
          setSelectionTip('点击添加多边形顶点，双击完成绘制，按 Backspace 删除上一个点')
        }
        // 进入框选模式时，清除保留状态标志
        preserveSelectionRef.current = false
      } else if (!measureMode) {
        // 退出框选模式时，恢复地图交互
        // 注意：选中状态和图形的清除逻辑在另一个useEffect中处理
        map.dragging.enable()
        map.doubleClickZoom.enable()
      }
    }
  }, [selectionMode, measureMode])

  /**
   * 监听框选模式的鼠标事件
   */
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map) return

    // 清除之前的框选形状
    const clearSelectionShape = () => {
      if (selectionShapeRef.current) {
        map.removeLayer(selectionShapeRef.current)
        selectionShapeRef.current = null
      }
      if (polygonTempLayerRef.current) {
        map.removeLayer(polygonTempLayerRef.current)
        polygonTempLayerRef.current = null
      }
      selectionStartPointRef.current = null
      selectionDrawingRef.current = false
    }

    // 清除多边形临时点（保留已绘制的点）
    const clearPolygonTempLine = () => {
      if (polygonTempLayerRef.current) {
        map.removeLayer(polygonTempLayerRef.current)
        polygonTempLayerRef.current = null
      }
    }

    // 处理鼠标按下
    const handleMouseDown = (e: L.LeafletMouseEvent) => {
      if (selectionModeRef.current === 'none') return

      const latLng = e.latlng
      const originalEvent = e.originalEvent

      if (selectionModeRef.current === 'point') {
        // 点选模式：支持 Shift 多选
        const isMultiSelect = originalEvent.shiftKey
        selectFeaturesAtPoint(latLng, originalEvent.clientX, originalEvent.clientY, isMultiSelect)
        L.DomEvent.stopPropagation(e)
      } else if (selectionModeRef.current === 'circle') {
        // 圆形模式：开始绘制
        clearSelectionShape()
        selectionStartPointRef.current = latLng
        selectionDrawingRef.current = true
        setSelectionTip('拖动鼠标绘制圆形，松开完成选择')
        L.DomEvent.stopPropagation(e)
      } else if (selectionModeRef.current === 'polygon') {
        // 多边形模式：单击添加点
        selectionPointsRef.current.push(latLng)
        clearPolygonTempLine()
        
        // 绘制临时线段
        const L = window.L
        if (selectionPointsRef.current.length >= 1) {
          const points = selectionPointsRef.current.map(p => [p.lat, p.lng])
          // 如果有多个点，绘制线段
          if (points.length >= 2) {
            polygonTempLayerRef.current = L.polyline(points as L.LatLngExpression[], {
              color: '#00ffff',
              weight: 2,
              dashArray: '5, 5'
            }).addTo(map)
          }
        }
        
        setSelectionTip(`已添加 ${selectionPointsRef.current.length} 个点，双击完成绘制`)
        L.DomEvent.stopPropagation(e)
      }
    }

    // 处理鼠标移动
    const handleMouseMove = (e: L.LeafletMouseEvent) => {
      const latLng = e.latlng
      const startPoint = selectionStartPointRef.current

      if (selectionModeRef.current === 'circle' && selectionDrawingRef.current && startPoint) {
        // 清除之前的预览形状
        if (selectionShapeRef.current) {
          map.removeLayer(selectionShapeRef.current)
        }

        const L = window.L
        const radius = startPoint.distanceTo(latLng)
        selectionShapeRef.current = L.circle(startPoint, {
          radius: radius,
          color: '#00ffff',
          weight: 2,
          fillColor: '#00ffff',
          fillOpacity: 0.1,
          dashArray: '5, 5',
          interactive: false
        }).addTo(map)
        
        setSelectionTip(`半径: ${Math.round(radius)} 米，松开完成选择`)
        L.DomEvent.stopPropagation(e)
      } else if (selectionModeRef.current === 'polygon' && selectionPointsRef.current.length > 0) {
        // 多边形模式：更新临时线段到鼠标位置
        clearPolygonTempLine()
        
        const L = window.L
        const points = selectionPointsRef.current.map(p => [p.lat, p.lng])
        points.push([latLng.lat, latLng.lng]) // 添加鼠标当前位置
        
        polygonTempLayerRef.current = L.polyline(points as L.LatLngExpression[], {
          color: '#00ffff',
          weight: 2,
          dashArray: '5, 5'
        }).addTo(map)
      }
    }

    // 处理鼠标释放
    const handleMouseUp = (e: L.LeafletMouseEvent) => {
      if (selectionModeRef.current === 'none') return

      const latLng = e.latlng
      const startPoint = selectionStartPointRef.current

      if (selectionModeRef.current === 'circle' && selectionDrawingRef.current && startPoint) {
        // 圆形模式：完成选择
        const radius = startPoint.distanceTo(latLng)
        if (radius > 10) { // 最小半径10米
          selectFeaturesInCircle(startPoint, radius)
          
          // 保留最终圆形形状
          if (selectionShapeRef.current) {
            map.removeLayer(selectionShapeRef.current)
          }
          const L = window.L
          selectionShapeRef.current = L.circle(startPoint, {
            radius: radius, color: '#00ffff', weight: 2, fillColor: '#00ffff', fillOpacity: 0.1,
            interactive: false // 禁止交互，避免拦截鼠标事件
          }).addTo(map)
          
          // 注意：不要在这里恢复地图拖拽，因为用户仍在圆形框选模式下
          // 地图拖拽状态由 selectionMode 变化的 useEffect 控制
        } else {
          setSelectionTip('半径太小，请重新绘制')
        }
        selectionDrawingRef.current = false
        selectionStartPointRef.current = null
      }
      L.DomEvent.stopPropagation(e)
    }

    // 处理双击
    const handleDoubleClick = (e: L.LeafletMouseEvent) => {
      if (selectionModeRef.current !== 'polygon') return
      
      // 移除双击添加的多余点（双击会触发两次 mousedown，添加两个点）
      if (selectionPointsRef.current.length >= 2) {
        selectionPointsRef.current.pop() // 移除最后一个点
        selectionPointsRef.current.pop() // 移除倒数第二个点
      } else if (selectionPointsRef.current.length === 1) {
        selectionPointsRef.current.pop()
      }

      if (selectionPointsRef.current.length >= 3) {
        clearPolygonTempLine()
        selectFeaturesInPolygon(selectionPointsRef.current)
        
        // 保留最终多边形形状
        if (selectionShapeRef.current) {
          map.removeLayer(selectionShapeRef.current)
        }
        const L = window.L
        selectionShapeRef.current = L.polygon(selectionPointsRef.current, {
          color: '#00ffff', weight: 2, fillColor: '#00ffff', fillOpacity: 0.1,
          interactive: false // 禁止交互，避免拦截鼠标事件
        }).addTo(map)
        
        selectionPointsRef.current = []
      } else {
        setSelectionTip('多边形至少需要3个点')
      }
      L.DomEvent.stopPropagation(e)
      L.DomEvent.preventDefault(e)
    }

    // 注册事件监听器
    map.on('mousedown', handleMouseDown)
    map.on('mousemove', handleMouseMove)
    map.on('mouseup', handleMouseUp)
    map.on('dblclick', handleDoubleClick)

    return () => {
      map.off('mousedown', handleMouseDown)
      map.off('mousemove', handleMouseMove)
      map.off('mouseup', handleMouseUp)
      map.off('dblclick', handleDoubleClick)
      // 清理框选形状
      clearSelectionShape()
    }
  }, [selectionMode, selectFeaturesAtPoint, selectFeaturesInCircle, selectFeaturesInPolygon])

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

    // 监听所有瓦片加载完成事件（用于检测网络恢复）
    // 注意：404 错误是高德地图服务器的正常行为 - 某些瓦片（如海洋区域）不存在
    newTileLayer.on('load', () => {
      hasLoadedAnyTileRef.current = true
      hasNetworkErrorRef.current = false

      // 立即清除网络错误提示
      if (networkError.visible) {
        setNetworkError(prev => ({ ...prev, visible: false }))
      }
    })

    tileLayerRef.current = newTileLayer
  }, [isMapInitialized, mapLayerType])

  // 地图点击事件已经在handleMapClick中处理，这里的useEffect是重复的，会导致事件被多次绑定
  // 移除重复的地图点击事件处理

  /**
   * 监听缩放变化，更新扇区图层和MapInfo图层
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

      // 更新所有MapInfo图层的缩放级别，确保标签配置生效
      mapInfoLayerRefsRef.current.forEach(({ mapInfoLayer }) => {
        mapInfoLayer.updateZoom(zoom)
      })
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
    (async () => {
      if (!mapInstanceRef.current) return;

      const allFiles = [...layerFiles, ...pointFiles];

      // 清理不再存在的图层
      const currentLayerIds = new Set(allFiles.map(f => f.id));
      for (const [id, { leafletLayer }] of mapInfoLayerRefsRef.current.entries()) {
        if (!currentLayerIds.has(id)) {
          if (mapInstanceRef.current.hasLayer(leafletLayer)) {
            mapInstanceRef.current.removeLayer(leafletLayer);
          }
          mapInfoLayerRefsRef.current.delete(id);
          loadedMapInfoLayersRef.current.delete(id);
        }
      }

      // 加载新图层（等待加载完成后再更新可见性）
      await loadMapInfoLayers();

      // 更新可见性
      console.log('[OnlineMap] 更新图层可见性, 总数:', allFiles.length)
      for (const layerFile of allFiles) {
        const layerRef = mapInfoLayerRefsRef.current.get(layerFile.id);
        console.log('[OnlineMap] 处理图层:', layerFile.id, layerFile.name, 'visible:', layerFile.visible, 'layerRef存在:', !!layerRef)

        if (layerRef && mapInstanceRef.current) {
          const hasLayer = mapInstanceRef.current.hasLayer(layerRef.leafletLayer)
          console.log('[OnlineMap]   - hasLayer检查结果:', hasLayer, 'leafletLayer存在:', !!layerRef.leafletLayer)

          if (layerFile.visible) {
            // 使用 MapInfoLayer 的 addTo 方法而不是直接添加 Leaflet 图层
            // 这样可以正确设置 currentMap 引用，使标签功能能够工作
            if (!hasLayer) {
              console.log('[OnlineMap]   - 添加图层到地图')
              layerRef.mapInfoLayer.addTo(mapInstanceRef.current)
            } else {
              console.log('[OnlineMap]   - 图层已在地图上，跳过')
            }
          } else {
            // 使用 MapInfoLayer 的 remove 方法而不是直接移除 Leaflet 图层
            // 这样可以正确清理标签和其他资源
            if (hasLayer) {
              console.log('[OnlineMap]   - 从地图移除图层')
              layerRef.mapInfoLayer.remove(mapInstanceRef.current)
            } else {
              console.log('[OnlineMap]   - 图层不在地图上，跳过移除')
            }
          }
        } else {
          console.log('[OnlineMap]   - 跳过: layerRef或mapInstance不存在')
        }
      }
    })();
  }, [layerFiles, pointFiles, loadMapInfoLayers]);

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
            // 与扇区数据处理方式一致：在前端进行坐标转换
            const [displayLat, displayLng] = CoordinateTransformer.wgs84ToGcj02(p.latitude || 0, p.longitude || 0)

            L.circleMarker([displayLat, displayLng], {
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
    for (const [_, markers] of pointFileLabelMarkersRef.current.entries()) {
      for (const marker of markers) {
        map.removeLayer(marker)
      }
    }
    pointFileLabelMarkersRef.current.clear()

    // 遍历所有点文件，为启用标签的文件创建标记
    for (const [fileId, pointData] of pointFileDataRef.current.entries()) {
      const shouldShowLabels = pointFileLabelVisibility[fileId] === true

      if (shouldShowLabels && pointData && pointData.length > 0) {
        // 获取用户配置的标签设置
        const labelConfig = labelSettingsMap?.[fileId]

        // 如果没有配置标签内容，跳过（不显示默认标签）
        if (!labelConfig || !labelConfig.content) {
          console.log('[OnlineMap] 点文件未配置标签内容，跳过:', fileId)
          continue
        }

        const markers: L.Marker[] = []

        for (const point of pointData) {
          if (!point.longitude || !point.latitude) continue

          // 与扇区数据处理方式一致：在前端进行坐标转换
          const [displayLat, displayLng] = CoordinateTransformer.wgs84ToGcj02(point.latitude || 0, point.longitude || 0)
          const gcjLat = displayLat
          const gcjLng = displayLng

          // 获取标签字段值
          const attributes = point.attributes || {}
          let labelText = ''

          // 按优先级查找配置的字段值
          const targetField = labelConfig.content

          // 依次检查: point 对象的直接属性 -> attributes 对象
          if (point[targetField] !== undefined && point[targetField] !== null) {
            labelText = String(point[targetField]).trim()
          } else if (attributes[targetField] !== undefined && attributes[targetField] !== null) {
            labelText = String(attributes[targetField]).trim()
          }

          // 如果没有找到字段值，跳过此点
          if (!labelText) continue

          // 使用用户配置的颜色和字体大小
          const labelHtml = `
            <div style="
              background: transparent;
              padding: 0;
              font-size: ${labelConfig.fontSize || 12}px;
              color: ${labelConfig.color || '#000000'};
              white-space: nowrap;
              text-shadow: 0 1px 2px rgba(0,0,0,0.5);
              font-weight: 500;
            ">
              ${labelText}
            </div>
          `

          // 动态计算图标大小基于文本长度和字体大小
          const estimatedWidth = Math.min(200, Math.max(60, labelText.length * (labelConfig.fontSize || 12) * 0.6))
          const estimatedHeight = (labelConfig.fontSize || 12) + 8

          const icon = L.divIcon({
            html: labelHtml,
            className: 'point-file-label',
            iconSize: [estimatedWidth, estimatedHeight],
            iconAnchor: [estimatedWidth / 2, estimatedHeight / 2]
          })

          const marker = L.marker([gcjLat, gcjLng], { icon })
          marker.addTo(map)
          markers.push(marker)
        }

        pointFileLabelMarkersRef.current.set(fileId, markers)
        console.log('[OnlineMap] Point file labels added:', fileId, markers.length, 'config:', labelConfig)
      }
    }
  }, [pointFileLabelVisibility, pointFiles, labelSettingsMap])

  return (
    <>
      {/* 网络状态提示 - 仅在有错误时显示 */}
      <NetworkStatusAlert
        visible={networkError.visible}
        message={networkError.message}
        onRetry={networkError.canRetry ? retryInitMap : undefined}
        onDismiss={() => setNetworkError({ ...networkError, visible: false })}
      />

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

        {/* 框选提示 */}
        {selectionTip && selectionMode !== 'none' && (
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-[1000] bg-blue-600/95 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
            <span className="text-sm font-medium">{selectionTip}</span>
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

      {/* TAC 频段图例已移除 - 各个页面自己管理对应的图例组件 */}

      {/* 要素属性面板 (MapInfo/地理化数据) */}
      <FeatureInfoPanel
        title={featureTitle}
        properties={featureProperties}
        visible={featurePanelVisible}
        position={featureClickPosition}
        onClose={hideFeatureInfo}
      />
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
