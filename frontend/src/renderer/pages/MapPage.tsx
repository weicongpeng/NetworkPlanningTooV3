/**
 * 地图浏览页面
 *
 * 功能:
 * - 在线地图：显示LTE/NR扇区图层，支持搜索定位
 * - 离线地图：本地地图浏览
 * - 双模式搜索：地名搜索(高德) + 工参搜索
 * - 图层控制：切换LTE/NR扇区显示
 * - 显示当前工参文件名
 * - 坐标缺失警告
 */
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Loader2, MapIcon, Search, X, Trash2, MapPin, AlertTriangle, Database } from 'lucide-react'
import { OnlineMap, OfflineMap, LayerControl, createDefaultLayers } from '../components/Map'
import type { LayerOption, SectorLayerOption } from '../components/Map'
import { mapStateService } from '../services/mapStateService'
import { CoordinateTransformer } from '../utils/coordinate'
import { mapApi, layerApi, dataApi } from '../services/api'
import { useDataStore } from '../store/dataStore'
import { useMapStore } from '../store/mapStore'
import type { OnlineMapRef } from '../components/Map/OnlineMap'
import { mapDataService, type RenderSectorData } from '../services/mapDataService'

/**
 * 搜索模式
 */
type SearchMode = 'map' | 'parameter'

/**
 * 地名搜索结果接口
 */
interface PlaceSearchResult {
  type: 'place'
  name: string
  address: string
  district: string
  location: string  // "lng,lat"格式 (GCJ02坐标系)
  adcode: string
}

/**
 * 工参搜索结果接口
 */
interface ParameterSearchResult {
  type: 'parameter'
  id: string
  name: string
  networkType: 'LTE' | 'NR'
  siteId?: string
  sectorId?: string
  latitude?: number
  longitude?: number
  hasLocation: boolean  // 是否有坐标
}

type SearchResult = PlaceSearchResult | ParameterSearchResult

export function MapPage() {
  // 视图模式
  const [viewMode, setViewMode] = useState<'online' | 'offline'>(() => {
    // 从状态服务获取当前视图模式
    return 'online' // 默认在线地图
  })

  // 地图类型（平面/卫星）
  const [mapType, setMapType] = useState<'roadmap' | 'satellite'>(() => mapStateService.getState().mapLayerType)

  // 数据存储 - 获取工参文件名
  const { items } = useDataStore()

  // 刷新按钮状态：idle(红色), loading(旋转), loaded(绿色)
  const [refreshStatus, setRefreshStatus] = useState<'idle' | 'loading' | 'loaded'>('idle')

  // 获取当前工参文件名（最新的前缀为"ProjectParameter_mongoose"的excel类型文件）
  const currentDataSourceFile = useMemo(() => {
    const excelFiles = items
      .filter(item => item.type === 'excel' && item.status === 'ready' && item.name.startsWith('ProjectParameter_mongoose'))
      .sort((a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime())
    return excelFiles.length > 0 ? excelFiles[0].name : null
  }, [items])

  // 初始化时获取数据列表
  useEffect(() => {
    useDataStore.getState().fetchList()
  }, [])

  // 自动重置刷新状态为idle（绿色状态保持2秒后恢复红色）
  useEffect(() => {
    if (refreshStatus === 'loaded') {
      const timer = setTimeout(() => {
        setRefreshStatus('idle')
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [refreshStatus])

  // 图层控制
  const [layers, setLayers] = useState<LayerOption[]>(createDefaultLayers())
  // 扇区标签可见性
  const [sectorLabelVisibility, setSectorLabelVisibility] = useState<Record<string, boolean>>({
    'lte-sectors': false,
    'nr-sectors': false
  })
  // 外部图层文件（MapInfo导入）
  const [layerFiles, setLayerFiles] = useState<Array<{
    id: string
    name: string
    type: 'point' | 'line' | 'polygon'
    visible: boolean
    dataId: string
  }>>([])

  // 转换旧的 LayerOption 格式到新的 SectorLayerOption 格式
  const sectorLayers: SectorLayerOption[] = layers.map(layer => ({
    id: layer.id,
    label: layer.label,
    type: layer.type,
    visible: layer.visible,
    icon: layer.icon,
    color: layer.color
  }))

  /**
   * 加载MapInfo图层文件列表
   */
  const loadLayerFiles = useCallback(async () => {
    try {
      // 从数据列表中获取所有map类型的数据项
      const items = useDataStore.getState().items
      const mapItems = items.filter(item => item.type === 'map')

      const allLayerFiles: Array<{
        id: string
        name: string
        type: 'point' | 'line' | 'polygon'
        visible: boolean
        dataId: string
      }> = []

      for (const mapItem of mapItems) {
        try {
          const response = await layerApi.getLayers(mapItem.id)
          if (response.success && response.data?.layers) {
            const layers = response.data.layers
            for (const layer of layers) {
              allLayerFiles.push({
                id: layer.id,
                name: layer.name,
                type: layer.type as 'point' | 'line' | 'polygon',
                visible: false,  // 默认不显示
                dataId: mapItem.id
              })
            }
          }
        } catch (error) {
          console.error('[MapPage] 获取图层文件失败:', mapItem.id, error)
        }
      }

      setLayerFiles(allLayerFiles)
    } catch (error) {
      console.error('[MapPage] 加载图层文件失败:', error)
    }
  }, [])

  // 当数据列表更新后，加载图层文件
  useEffect(() => {
    if (items.length > 0) {
      loadLayerFiles()
    }
  }, [items, loadLayerFiles])

  // 搜索模式
  const [searchMode, setSearchMode] = useState<SearchMode>('parameter')

  // 搜索状态
  const [searchKeyword, setSearchKeyword] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [showSearchResults, setShowSearchResults] = useState(false)
  const [searching, setSearching] = useState(false)
  const [missingCoordCount, setMissingCoordCount] = useState(0)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // 工具控件状态
  const [showToolMenu, setShowToolMenu] = useState(false)
  const [showLocationModal, setShowLocationModal] = useState(false)
  const [measureMode, setMeasureMode] = useState(false)
  const [measurePoints, setMeasurePoints] = useState<Array<{ lng: number; lat: number }>>([])
  const [totalDistance, setTotalDistance] = useState<number | null>(null)
  const [locationInput, setLocationInput] = useState({ lng: '', lat: '' })

  
  // 从mapStore获取定位点数据
  const { locationPoints, addLocationPoint, clearLocationPoints } = useMapStore()

  // 工参数据缓存（用于工参搜索）
  const [sectorDataCache, setSectorDataCache] = useState<{
    lte: RenderSectorData[]
    nr: RenderSectorData[]
  }>({ lte: [], nr: [] })
  
  // 使用ref保存最新的sectorDataCache状态，解决闭包问题
  const sectorDataCacheRef = useRef(sectorDataCache)
  
  // 当sectorDataCache状态更新时，同步更新ref
  useEffect(() => {
    sectorDataCacheRef.current = sectorDataCache
  }, [sectorDataCache])

  // 地图组件引用
  const onlineMapRef = useRef<OnlineMapRef>(null)

  /**
   * 选择搜索结果并定位
   */
  const selectSearchResult = useCallback((result: SearchResult) => {
    if (result.type === 'place') {
      // 地名搜索 - 高德API返回的坐标已经是GCJ02坐标系
      const parts = result.location.split(',')
      if (parts.length !== 2) return

      const gcjLng = parseFloat(parts[0])
      const gcjLat = parseFloat(parts[1])

      if (onlineMapRef.current) {
        onlineMapRef.current.flyTo([gcjLat, gcjLng], 15)
        onlineMapRef.current.setSearchMarker({ lng: gcjLng, lat: gcjLat, name: result.name })
      }
    } else {
      // 工参搜索
      if (result.hasLocation && result.latitude !== undefined && result.longitude !== undefined) {
        const gcjLat = result.latitude
        const gcjLng = result.longitude

        if (onlineMapRef.current) {
          onlineMapRef.current.flyTo([gcjLat, gcjLng], 16)
          onlineMapRef.current.setSearchMarker({
            lng: gcjLng,
            lat: gcjLat,
            name: `${result.name} (${result.networkType})`
          })
        }
      }
    }

    setSearchKeyword(result.name)
    setShowSearchResults(false)
  }, [])

  /**
   * 加载工参数据用于搜索
   */
  const loadSectorDataForSearch = useCallback(async () => {
    try {
      const data = await mapDataService.getMapData()
      setSectorDataCache({
        lte: data.lteSectors,
        nr: data.nrSectors
      })
    } catch (error) {
      console.error('[MapPage] 加载工参数据失败:', error)
    }
  }, [])

  /**
   * 执行工参搜索
   */
  const executeParameterSearch = useCallback(async (keyword: string) => {
    if (!keyword.trim()) {
      setSearchResults([])
      setShowSearchResults(false)
      return
    }

    setSearching(true)
    try {
      // 直接使用缓存的数据，避免重复加载
      // 数据已在组件加载时通过useEffect预加载
      const allSectors = [...sectorDataCacheRef.current.lte, ...sectorDataCacheRef.current.nr]

      const lowerKeyword = keyword.toLowerCase()

      // 优化搜索算法：使用更高效的搜索方式，限制结果数量
      const matched = allSectors.filter(sector => {
        const nameMatch = sector.name && sector.name.toLowerCase().includes(lowerKeyword)
        const siteIdMatch = sector.siteId && sector.siteId.toLowerCase().includes(lowerKeyword)
        const sectorIdMatch = sector.sectorId && sector.sectorId.toLowerCase().includes(lowerKeyword)
        return nameMatch || siteIdMatch || sectorIdMatch
      }).slice(0, 20) // 限制最多显示20条结果，提高渲染性能

      const results: ParameterSearchResult[] = matched.map(sector => ({
        type: 'parameter',
        id: sector.id,
        name: sector.name || '未命名',
        networkType: sector.networkType,
        siteId: sector.siteId,
        sectorId: sector.sectorId,
        latitude: sector.displayLat,
        longitude: sector.displayLng,
        hasLocation: !!sector.displayLat && !!sector.displayLng
      }))

      setSearchResults(results)
      // 延迟设置showSearchResults，确保searchResults已经更新
      setTimeout(() => {
        setShowSearchResults(true)
      }, 0)
    } catch (error) {
      setSearchResults([])
      setShowSearchResults(true)
    } finally {
      setSearching(false)
    }
  }, [])
  
  /**
   * 预加载工参数据
   */
  useEffect(() => {
    const preloadSectorData = async () => {
      try {
        await loadSectorDataForSearch()
      } catch (error) {
        console.error('[MapPage] 预加载工参数据失败:', error)
      }
    }
    
    preloadSectorData()
  }, [loadSectorDataForSearch])

  /**
   * 渲染定位点 - 当组件挂载或locationPoints变化时
   */
  useEffect(() => {
    if (onlineMapRef.current && locationPoints.length > 0) {
      // 重新添加所有定位点标记
      locationPoints.forEach((point, index) => {
        onlineMapRef.current?.addLocationMarker(point, index + 1)
      })
    }
  }, [locationPoints])

  /**
   * 执行地名搜索
   */
  const executeMapSearch = useCallback(async (keyword: string) => {
    if (!keyword.trim()) {
      setSearchResults([])
      setShowSearchResults(false)
      return
    }

    setSearching(true)
    try {
      // 使用高德Place Text API进行模糊搜索
      const apiKey = '5299af602f4ee3cd7351c1bc7f32b1cb'
      const url = `https://restapi.amap.com/v3/place/text?key=${apiKey}&keywords=${encodeURIComponent(keyword)}&output=json&citylimit=10`

      const response = await fetch(url)
      const data = await response.json()

      if (data.status === '1' && data.pois && data.pois.length > 0) {
        const results: PlaceSearchResult[] = data.pois.map((poi: any) => ({
          type: 'place',
          name: poi.name,
          address: poi.address || '',
          district: poi.pname || poi.cityname || '',
          location: poi.location,  // GCJ02坐标
          adcode: poi.adcode || ''
        }))
        setSearchResults(results)
        // 延迟设置showSearchResults，确保searchResults已经更新
        setTimeout(() => {
          setShowSearchResults(true)
          console.log('Search results set, showSearchResults:', true)
        }, 0)
      } else {
        setSearchResults([])
        // 延迟设置showSearchResults，确保searchResults已经更新
        setTimeout(() => {
          setShowSearchResults(true)
          console.log('Search results set, showSearchResults:', true)
        }, 0)
      }
    } catch (err) {
      console.error('[MapPage] 地名查询失败:', err)
      setSearchResults([])
      setShowSearchResults(true)
    } finally {
      setSearching(false)
    }
  }, [])

  /**
   * 执行搜索（根据模式分发）
   */
  const executeSearch = useCallback(async (keyword: string) => {
    if (searchMode === 'parameter') {
      await executeParameterSearch(keyword)
    } else {
      await executeMapSearch(keyword)
    }
  }, [searchMode, executeParameterSearch, executeMapSearch])

  /**
   * 处理输入变化 - 添加防抖机制
   */
  // 防抖定时器引用
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setSearchKeyword(value)
    
    // 清除之前的定时器
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    
    // 实时搜索，显示预览结果 - 添加150ms防抖
    if (value.trim()) {
      debounceTimerRef.current = setTimeout(() => {
        executeSearch(value)
      }, 150)
    } else {
      setSearchResults([])
      setShowSearchResults(false)
    }
  }

  /**
   * 处理回车键
   */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      console.log('Enter key pressed, executing search with keyword:', searchKeyword)
      
      // 如果有搜索结果，默认选择第一条
      if (searchResults.length > 0) {
        selectSearchResult(searchResults[0])
      } else {
        executeSearch(searchKeyword)
      }
    }
  }

  /**
   * 清除搜索输入 - 只清空输入框和搜索结果，不清除地图标记
   */
  const clearSearchInput = () => {
    setSearchKeyword('')
    setSearchResults([])
    setShowSearchResults(false)
    if (searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }
  
  /**
   * 清除所有搜索 - 清空输入框、搜索结果和地图标记
   */
  const clearAllSearch = () => {
    setSearchKeyword('')
    setSearchResults([])
    setShowSearchResults(false)
    if (onlineMapRef.current) {
      onlineMapRef.current.clearSearchMarker()
      onlineMapRef.current.clearLocationMarkers()
      onlineMapRef.current.clearMeasurements()
    }
    // 清空定位点和测量点
    clearLocationPoints() // 使用全局store清除定位点
    setMeasurePoints([])
    setTotalDistance(null)
    setMeasureMode(false)
    if (searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }

  /**
   * 处理图层切换
   */
  const handleLayerToggle = useCallback((layerId: string, visible: boolean) => {
    // 更新本地状态
    setLayers(prev => prev.map(layer =>
      layer.id === layerId ? { ...layer, visible } : layer
    ))

    // 通知地图组件
    if (layerId === 'lte-sectors' && onlineMapRef.current) {
      onlineMapRef.current.setLayerVisibility('lte', visible)
    } else if (layerId === 'nr-sectors' && onlineMapRef.current) {
      onlineMapRef.current.setLayerVisibility('nr', visible)
    }
  }, [])

  /**
   * 处理地图类型切换
   */
  const handleMapTypeChange = useCallback((type: 'roadmap' | 'satellite') => {
    console.log('[MapPage] Map type change:', type)
    setMapType(type)
    // 调用 OnlineMap 的 setMapType 方法直接设置地图类型
    if (onlineMapRef.current) {
      console.log('[MapPage] Calling onlineMapRef.current.setMapType')
      onlineMapRef.current.setMapType(type)
    }
  }, [])

  /**
   * 处理扇区标签可见性切换
   */
  const handleSectorLabelToggle = useCallback((layerId: string, visible: boolean) => {
    console.log('[MapPage] Sector label toggle:', layerId, visible)
    // 更新本地状态
    setSectorLabelVisibility(prev => ({
      ...prev,
      [layerId]: visible
    }))

    // 通知地图组件
    if (onlineMapRef.current) {
      const layerType = layerId === 'lte-sectors' ? 'lte' : 'nr'
      console.log('[MapPage] Calling onlineMapRef.current.setSectorLabelVisibility:', layerType, visible)
      onlineMapRef.current.setSectorLabelVisibility(layerType, visible)
    }
  }, [])

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* 地图工具栏 */}
      <div className="h-14 bg-card border-b border-border flex items-center justify-start px-4 flex-shrink-0 gap-4">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold">地图浏览</h1>
            {/* 数据源文件名显示 */}
          {currentDataSourceFile ? (
            <div className="px-3 py-1.5 bg-muted/50 rounded-md">
              <div className="flex items-center gap-2">
                <Database size={14} className="text-muted-foreground" />
                <span className="text-xs text-muted-foreground">工参: {currentDataSourceFile}</span>
              </div>
            </div>
          ) : (
            <div className="px-3 py-1.5 bg-muted/50 rounded-md">
              <div className="flex items-center gap-2">
                <Database size={14} className="text-muted-foreground" />
                <span className="text-xs text-muted-foreground">未导入工参文件</span>
              </div>
            </div>
          )}
        </div>

        {/* 搜索框 */}
        <div className="relative flex items-center gap-2 flex-1 justify-start">
          {/* 搜索模式切换 */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                setSearchMode('map')
                setSearchResults([])
                setShowSearchResults(false)
              }}
              className={`text-xs px-2 py-1 rounded transition-colors ${
                searchMode === 'map'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              地名搜索
            </button>
            <button
              onClick={() => {
                setSearchMode('parameter')
                setSearchResults([])
                setShowSearchResults(false)
              }}
              className={`text-xs px-2 py-1 rounded transition-colors ${
                searchMode === 'parameter'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              工参搜索
            </button>
            {searchMode === 'parameter' && missingCoordCount > 0 && (
              <div className="flex items-center gap-1 ml-2 text-xs text-amber-600" title="部分扇区缺少坐标信息">
                <AlertTriangle size={12} />
                <span>{missingCoordCount}个扇区缺坐标</span>
              </div>
            )}
          </div>

          {/* 搜索输入框 */}
            <div className="relative w-64">
              <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchKeyword}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                onFocus={() => {
                  if (searchResults.length > 0) setShowSearchResults(true)
                }}
                onBlur={() => {
                  // 延迟隐藏，以便点击搜索结果
                  setTimeout(() => setShowSearchResults(false), 200)
                }}
                placeholder={searchMode === 'map' ? '输入地名、道路名称等' : '输入小区名称、基站ID'}
                className="w-full pl-8 pr-14 py-1.5 text-xs border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-xs"
              />
              
              {/* 清除输入按钮 */}
              <div className="absolute right-1 top-1/2 -translate-y-1/2">
                {searchKeyword && (
                  <button
                    onClick={clearSearchInput}
                    className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                    title="清除输入"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>
          
          {/* 独立的清除搜索标记按钮，使用文字标签 */}
          <button
            onClick={clearAllSearch}
            className="px-2 py-1.5 text-xs rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground flex items-center gap-1"
            title="清除所有搜索标记"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-broom"><path d="M18 11h-5l-5 9v-9H3L12 2l9 9z"></path><path d="M2 2v3h3"></path><path d="M21 2v3h3"></path><path d="M11 15h1"></path><path d="M8 18h8"></path></svg>
            清除
          </button>

          {/* 工具控件 */}
          <div className="relative">
            <button
              className="px-2 py-1.5 text-xs rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground flex items-center gap-1"
              onClick={() => setShowToolMenu(!showToolMenu)}
              title="定位和测距工具"
            >
              <div className="w-4 h-4 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-tool"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94z"></path></svg>
              </div>
              <span>工具</span>
            </button>

            {/* 工具下拉菜单 */}
            {showToolMenu && (
              <div className="absolute top-full right-0 mt-1 z-[3000] bg-card border border-border rounded-lg shadow-lg w-16">
                <button
                  onClick={() => {
                    setShowToolMenu(false);
                    setShowLocationModal(true);
                  }}
                  className="w-full text-left px-1 py-2 text-xs hover:bg-muted transition-colors flex items-center justify-center gap-1"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-map-pin"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                  定位
                </button>
                <button
                  onClick={() => {
                    setShowToolMenu(false);
                    setMeasureMode(true);
                  }}
                  className="w-full text-left px-1 py-2 text-xs hover:bg-muted transition-colors flex items-center justify-center gap-1"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-ruler"><path d="M12 2v20"></path><path d="m17 5-5 5"></path><path d="m9 5 5 5"></path><path d="m17 19-5-5"></path><path d="m9 19 5-5"></path></svg>
                  测距
                </button>
              </div>
            )}
          </div>
          
          {/* 搜索结果容器 */}
          <div className="absolute top-full left-0 mt-1 z-[2000] w-64">
            {/* 搜索结果下拉框 */}
            {showSearchResults && searchResults.length > 0 && (
              <div className="bg-card border border-border rounded-lg shadow-lg max-h-64 overflow-y-auto">
                {searchResults.map((result, index) => {
                  if (result.type === 'place') {
                    return (
                      <button
                        key={index}
                        onMouseDown={(e) => {
                          e.preventDefault()
                          selectSearchResult(result)
                        }}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors border-b border-border last:border-0"
                      >
                        <div className="flex items-start gap-2">
                          <MapPin size={14} className="mt-0.5 text-red-500 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{result.name}</div>
                            <div className="text-xs text-muted-foreground truncate">
                              {result.address} {result.district}
                            </div>
                          </div>
                        </div>
                      </button>
                    )
                  } else {
                    return (
                      <button
                        key={index}
                        onMouseDown={(e) => {
                          e.preventDefault()
                          selectSearchResult(result)
                        }}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors border-b border-border last:border-0"
                      >
                        <div className="flex items-start gap-2">
                          <Database size={14} className={`mt-0.5 shrink-0 ${
                            result.networkType === 'LTE' ? 'text-blue-500' : 'text-green-500'
                          }`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium truncate">{result.name}</span>
                              <span className={`text-xs px-1.5 py-0.5 rounded ${
                                result.networkType === 'LTE'
                                  ? 'bg-blue-100 text-blue-700'
                                  : 'bg-green-100 text-green-700'
                              }`}>
                                {result.networkType}
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {result.siteId && <span>基站ID: {result.siteId}</span>}
                              {result.sectorId && <span> • 小区ID: {result.sectorId}</span>}
                            </div>
                            {!result.hasLocation && (
                              <div className="text-xs text-amber-600 flex items-center gap-1 mt-1">
                                <AlertTriangle size={10} />
                                缺少坐标信息
                              </div>
                            )}
                          </div>
                        </div>
                      </button>
                    )
                  }
                })}
              </div>
            )}

            {/* 搜索中提示 */}
            {searching && (
              <div className="bg-card border border-border rounded-lg shadow-lg p-3 text-sm text-muted-foreground flex items-center justify-center gap-2">
                <Loader2 className="animate-spin" size={14} />
                搜索中...
              </div>
            )}

            {/* 无结果提示 */}
            {showSearchResults && searchResults.length === 0 && !searching && (
              <div className="bg-card border border-border rounded-lg shadow-lg p-3 text-sm text-muted-foreground">
                {searchMode === 'map' ? '未找到相关地点' : '未找到相关小区'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 定位弹窗 */}
      {showLocationModal && (
        <div className="fixed inset-0 z-[4000] flex items-center justify-center bg-black/20">
          <div className="bg-card border border-border rounded-lg shadow-lg p-4 w-64">
            <h3 className="text-sm font-semibold mb-3">输入经纬度定位</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">经度</label>
                <input
                  type="text"
                  value={locationInput.lng}
                  onChange={(e) => setLocationInput(prev => ({ ...prev, lng: e.target.value }))}
                  placeholder="例如: 116.397428"
                  className="w-full px-3 py-2 text-xs border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">纬度</label>
                <input
                  type="text"
                  value={locationInput.lat}
                  onChange={(e) => setLocationInput(prev => ({ ...prev, lat: e.target.value }))}
                  placeholder="例如: 39.90923"
                  className="w-full px-3 py-2 text-xs border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => {
                    setShowLocationModal(false);
                    setLocationInput({ lng: '', lat: '' });
                  }}
                  className="flex-1 px-3 py-2 text-xs bg-muted rounded-lg hover:bg-muted/80 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={async () => {
                    const lng = parseFloat(locationInput.lng);
                    const lat = parseFloat(locationInput.lat);
                    if (isNaN(lng) || isNaN(lat)) return;

                    // 使用纠偏后的经纬度
                    const [correctedLat, correctedLng] = CoordinateTransformer.wgs84ToGcj02(lat, lng);

                    // 生成唯一ID
                    const id = `location-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                    const newPoint = { id, lng: correctedLng, lat: correctedLat };

                    // 添加定位点到全局store
                    addLocationPoint(newPoint);

                    // 定位到该点并做标记
                    if (onlineMapRef.current) {
                      onlineMapRef.current.flyTo([correctedLat, correctedLng], 15);
                      // 索引从1开始
                      onlineMapRef.current.addLocationMarker(newPoint, locationPoints.length + 1);
                    }

                    setShowLocationModal(false);
                    setLocationInput({ lng: '', lat: '' });
                  }}
                  className="flex-1 px-3 py-2 text-xs bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                >
                  确定
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 地图容器 */}
      <div className="flex-1 relative min-h-0">
        {/* 地图内容 */}
        {viewMode === 'online' ? (
          <>
            {/* 在线地图 */}
            <div className="w-full h-full">
              <OnlineMap
                ref={onlineMapRef}
                dataSourceFileName={currentDataSourceFile}
                layerFiles={layerFiles}
                onViewModeChange={setViewMode}
                measureMode={measureMode}
                onMeasureModeEnd={() => setMeasureMode(false)}
              />
            </div>

            {/* 图层控制 - 只在在线地图模式显示 */}
            <LayerControl
              sectors={sectorLayers}
              layerFiles={layerFiles}
              onSectorToggle={handleLayerToggle}
              onSectorLabelToggle={handleSectorLabelToggle}
              sectorLabelVisibility={sectorLabelVisibility}
              onLayerFileToggle={(fileId, visible) => {
                setLayerFiles(prev => prev.map(f =>
                  f.id === fileId ? { ...f, visible } : f
                ))
                // 通知地图组件更新图层可见性
                if (onlineMapRef.current) {
                  onlineMapRef.current.setMapInfoLayerVisibility(fileId, visible)
                }
              }}
              onMapTypeChange={handleMapTypeChange}
              mapType={mapType}
            />
          </>
        ) : (
          /* 离线地图 */
          <OfflineMap />
        )}
      </div>
    </div>
  )
}
