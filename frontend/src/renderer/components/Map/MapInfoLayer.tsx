/**
 * MapInfo 图层渲染器
 *
 * 功能:
 * - 渲染点要素（Point）
 * - 渲染线要素（LineString）
 * - 渲染面要素（Polygon）
 * - 使用 Leaflet GeoJSON 图层
 * - 自动应用 WGS84 → GCJ-02 坐标纠偏（与扇区图一致）
 */
import L from 'leaflet'
import { GeoJSONProps } from 'leaflet'
import { CoordinateTransformer } from '../../utils/coordinate'

/**
 * 图层要素类型
 */
export type LayerGeometryType = 'point' | 'line' | 'polygon'

/**
 * MapInfo 图层配置
 */
export interface MapInfoLayerOptions {
  /** 图层ID */
  id: string
  /** 图层名称 */
  name: string
  /** 几何类型 */
  type: LayerGeometryType
  /** GeoJSON 数据 */
  data: GeoJSON.FeatureCollection
  /** 数据集ID（用于重新加载数据） */
  dataId: string
  /** 是否可见 */
  visible?: boolean
  /** 样式配置 */
  style?: MapInfoLayerStyle
}

/**
 * 图层样式配置
 */
export interface MapInfoLayerStyle {
  /** 点样式 */
  point?: {
    radius?: number
    fillColor?: string
    color?: string
    weight?: number
    opacity?: number
    fillOpacity?: number
  }
  /** 线样式 */
  line?: {
    color?: string
    weight?: number
    opacity?: number
    dashArray?: string
  }
  /** 面样式 */
  polygon?: {
    color?: string
    weight?: number
    opacity?: number
    dashArray?: string
    fillColor?: string
    fillOpacity?: number
  }
}

/**
 * 默认样式配置
 */
const DEFAULT_STYLES: Record<LayerGeometryType, any> = {
  point: {
    radius: 6,
    fillColor: '#f59e0b',
    color: '#fff',
    weight: 2,
    opacity: 1,
    fillOpacity: 0.8
  },
  line: {
    color: '#8b5cf6',
    weight: 3,
    opacity: 1
  },
  polygon: {
    color: '#10b981',
    weight: 2,
    opacity: 1,
    fillColor: '#10b981',
    fillOpacity: 0.3
  }
}

/**
 * 转换 GeoJSON 坐标（WGS84 → GCJ-02）
 *
 * @param coordinates GeoJSON 坐标（可能是单个点、线、或面）
 * @returns 转换后的坐标
 */
function transformGeoJSONCoordinates(coordinates: any): any {
  // Point: [longitude, latitude]
  if (Array.isArray(coordinates) && coordinates.length >= 2) {
    const firstItem = coordinates[0]
    // 检查是否是数字（坐标点）
    if (typeof firstItem === 'number') {
      const lng = coordinates[0]
      const lat = coordinates[1]
      const [gcjLat, gcjLng] = CoordinateTransformer.wgs84ToGcj02(lat, lng)
      return [gcjLng, gcjLat, ...coordinates.slice(2)]
    }
    // 递归处理嵌套坐标（LineString 或 Polygon 的环）
    else {
      return coordinates.map((coord: any) => transformGeoJSONCoordinates(coord))
    }
  }
  return coordinates
}

/**
 * 转换整个 GeoJSON Feature 的坐标
 */
function transformFeatureCoordinates(feature: GeoJSON.Feature): GeoJSON.Feature {
  if (!feature.geometry) return feature

  const geometry = feature.geometry

  // Point
  if (geometry.type === 'Point') {
    geometry.coordinates = transformGeoJSONCoordinates(geometry.coordinates)
  }
  // LineString
  else if (geometry.type === 'LineString') {
    geometry.coordinates = transformGeoJSONCoordinates(geometry.coordinates)
  }
  // Polygon
  else if (geometry.type === 'Polygon') {
    geometry.coordinates = geometry.coordinates.map((ring: any) =>
      transformGeoJSONCoordinates(ring)
    )
  }
  // MultiPoint
  else if (geometry.type === 'MultiPoint') {
    geometry.coordinates = geometry.coordinates.map((coord: any) =>
      transformGeoJSONCoordinates(coord)
    )
  }
  // MultiLineString
  else if (geometry.type === 'MultiLineString') {
    geometry.coordinates = geometry.coordinates.map((line: any) =>
      transformGeoJSONCoordinates(line)
    )
  }
  // MultiPolygon
  else if (geometry.type === 'MultiPolygon') {
    geometry.coordinates = geometry.coordinates.map((polygon: any) =>
      polygon.map((ring: any) => transformGeoJSONCoordinates(ring))
    )
  }

  return feature
}

/**
 * MapInfo 图层类
 */
export class MapInfoLayer {
  private id: string
  private name: string
  private type: LayerGeometryType
  private dataId: string
  private geoJSONLayer: L.GeoJSON | null = null
  private style: MapInfoLayerStyle

  constructor(options: MapInfoLayerOptions) {
    this.id = options.id
    this.name = options.name
    this.type = options.type
    this.dataId = options.dataId
    this.style = options.style || {}
  }

  /**
   * 获取底层的 Leaflet GeoJSON 图层
   * 用于直接控制图层的添加/移除
   */
  getLeafletLayer(): L.GeoJSON | null {
    return this.geoJSONLayer
  }

  /**
   * 添加到地图
   */
  addTo(map: L.Map): this {
    if (!this.geoJSONLayer) {
      throw new Error('图层未初始化，请先调用 loadData() 加载数据')
    }

    // 先移除（如果已存在），避免重复添加
    if (map.hasLayer(this.geoJSONLayer)) {
      console.log('[MapInfoLayer] Layer already on map, removing first:', this.id)
      map.removeLayer(this.geoJSONLayer)
    }

    this.geoJSONLayer.addTo(map)
    console.log('[MapInfoLayer] Layer added to map:', this.id)
    return this
  }

  /**
   * 从地图移除
   */
  remove(map: L.Map): this {
    if (this.geoJSONLayer && map.hasLayer(this.geoJSONLayer)) {
      console.log('[MapInfoLayer] Removing layer from map:', this.id)
      map.removeLayer(this.geoJSONLayer)
    } else {
      console.log('[MapInfoLayer] Layer not on map, skipping remove:', this.id, {
        hasGeoJSONLayer: !!this.geoJSONLayer,
        hasLayerInMap: this.geoJSONLayer ? map.hasLayer(this.geoJSONLayer) : false
      })
    }
    return this
  }

  /**
   * 设置可见性
   */
  setVisible(map: L.Map, visible: boolean): this {
    console.log('[MapInfoLayer] setVisible called:', this.id, visible, {
      hasGeoJSONLayer: !!this.geoJSONLayer,
      hasLayerInMap: this.geoJSONLayer ? map.hasLayer(this.geoJSONLayer) : false
    })
    if (visible) {
      this.addTo(map)
    } else {
      this.remove(map)
    }
    return this
  }

  /**
   * 从 GeoJSON 数据创建图层
   */
  static async fromGeoJSON(options: MapInfoLayerOptions): Promise<MapInfoLayer> {
    const layer = new MapInfoLayer(options)

    // 应用坐标转换：WGS84 → GCJ-02（与扇区图使用相同的纠偏算法）
    const transformedData: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: options.data.features.map(feature => transformFeatureCoordinates(feature))
    }

    console.log('[MapInfoLayer] Applied coordinate transformation to', transformedData.features.length, 'features')

    // 创建 GeoJSON 图层（使用转换后的数据）
    layer.geoJSONLayer = L.geoJSON(transformedData, {
      // 点要素样式
      pointToLayer: (feature, latLng) => {
        // 获取 feature 级别的样式（如果存在）
        const featureStyle = (feature.properties as any)?._style?.point || {}
        const pointStyle = { ...DEFAULT_STYLES.point, ...layer.style.point, ...featureStyle }

        // 如果有符号类型，可以使用自定义图标
        if (featureStyle.markerSymbol && featureStyle.markerSymbol !== 'circle') {
          // MapInfo 符号编号转 Leaflet 图标
          return L.circleMarker(latLng, {
            radius: pointStyle.markerSize || pointStyle.radius || 6,
            fillColor: pointStyle.markerColor || pointStyle.fillColor || '#f59e0b',
            color: pointStyle.color || '#fff',
            weight: pointStyle.weight || 2,
            opacity: pointStyle.opacity || 1,
            fillOpacity: pointStyle.fillOpacity || 0.8
          })
        }

        return L.circleMarker(latLng, {
          radius: pointStyle.markerSize || pointStyle.radius || 6,
          fillColor: pointStyle.markerColor || pointStyle.fillColor || '#f59e0b',
          color: pointStyle.color || '#fff',
          weight: pointStyle.weight || 2,
          opacity: pointStyle.opacity || 1,
          fillOpacity: pointStyle.fillOpacity || 0.8
        })
      },

      // 线和面要素样式
      style: (feature) => {
        const geometry = feature.geometry?.type
        const featureStyle = (feature.properties as any)?._style || {}

        // 调试：打印第一个要素的样式
        if (feature.properties && Object.keys(feature.properties).length > 0) {
          const featureId = feature.properties?.id || feature.properties?.ID || 'unknown'
          if (!this._debugPrinted) {
            console.log('[MapInfoLayer] Feature style sample:', {
              geometry,
              featureStyle,
              properties: Object.keys(feature.properties).slice(0, 5)
            })
            ;(this as any)._debugPrinted = true
          }
        }

        if (geometry === 'LineString' || geometry === 'MultiLineString') {
          // 合并样式：默认样式 -> 图层样式 -> 要素样式
          // 注意：后端返回的样式属性名需要映射到 Leaflet 的属性名
          const mergedStyle = {
            ...DEFAULT_STYLES.line,
            ...layer.style.line
          }

          // 映射后端样式属性到 Leaflet 属性
          if (featureStyle.strokeColor) mergedStyle.color = featureStyle.strokeColor
          if (featureStyle.strokeWidth !== undefined) mergedStyle.weight = featureStyle.strokeWidth
          if (featureStyle.strokeDasharray) mergedStyle.dashArray = featureStyle.strokeDasharray
          if (featureStyle.opacity !== undefined) mergedStyle.opacity = featureStyle.opacity

          // 只有明确设置了 dashArray 才应用虚线，否则使用实线
          const result: any = {
            color: mergedStyle.color || '#8b5cf6',
            weight: mergedStyle.weight || 3,
            opacity: mergedStyle.opacity || 1
          }
          if (mergedStyle.dashArray) {
            result.dashArray = mergedStyle.dashArray
          }
          return result
        } else if (geometry === 'Polygon' || geometry === 'MultiPolygon') {
          const mergedStyle = {
            ...DEFAULT_STYLES.polygon,
            ...layer.style.polygon
          }

          // 映射后端样式属性到 Leaflet 属性
          if (featureStyle.strokeColor) mergedStyle.color = featureStyle.strokeColor
          if (featureStyle.strokeWidth !== undefined) mergedStyle.weight = featureStyle.strokeWidth
          if (featureStyle.strokeOpacity !== undefined) mergedStyle.opacity = featureStyle.strokeOpacity
          if (featureStyle.strokeDasharray) mergedStyle.dashArray = featureStyle.strokeDasharray
          if (featureStyle.fillColor) mergedStyle.fillColor = featureStyle.fillColor
          if (featureStyle.fillOpacity !== undefined) mergedStyle.fillOpacity = featureStyle.fillOpacity

          // 只有明确设置了 dashArray 才应用虚线，否则使用实线边界
          const result: any = {
            color: mergedStyle.color || '#10b981',
            weight: mergedStyle.weight || 2,
            opacity: mergedStyle.opacity || 1,
            fillColor: mergedStyle.fillColor || '#10b981',
            fillOpacity: mergedStyle.fillOpacity || 0.3
          }
          if (mergedStyle.dashArray) {
            result.dashArray = mergedStyle.dashArray
          }
          return result
        }
        return {}
      }
    })

    return layer
  }

  /**
   * 获取图层ID
   */
  getId(): string {
    return this.id
  }

  /**
   * 获取图层名称
   */
  getName(): string {
    return this.name
  }

  /**
   * 获取几何类型
   */
  getType(): LayerGeometryType {
    return this.type
  }
}

/**
 * MapInfo 图层管理器
 */
export class MapInfoLayerManager {
  private layers: Map<string, MapInfoLayer> = new Map()
  private map: L.Map | null = null

  constructor() {}

  /**
   * 调试方法：打印所有图层及其在地图上的状态
   */
  debugPrintLayers(): void {
    console.log('[MapInfoLayerManager] === LAYER STATUS ===')
    console.log('[MapInfoLayerManager] Total layers in memory:', this.layers.size)
    console.log('[MapInfoLayerManager] Map instance:', this.map ? 'exists' : 'NULL')

    for (const [id, layer] of this.layers) {
      const geoJSONLayer = (layer as any).geoJSONLayer
      const onMap = this.map && geoJSONLayer && this.map.hasLayer(geoJSONLayer)
      console.log(`[MapInfoLayerManager] Layer "${id}": ${onMap ? '✓ ON MAP' : '✗ NOT ON MAP'}`)
    }
    console.log('[MapInfoLayerManager] ======================')
  }

  /**
   * 设置地图实例
   */
  setMap(map: L.Map): void {
    this.map = map
  }

  /**
   * 添加图层
   */
  async addLayer(options: MapInfoLayerOptions, visible: boolean = false): Promise<void> {
    const layer = await MapInfoLayer.fromGeoJSON(options)
    console.log('[MapInfoLayerManager] Adding layer:', layer.getId(), 'visible:', visible)
    this.layers.set(layer.getId(), layer)

    if (visible && this.map) {
      layer.addTo(this.map)
      console.log('[MapInfoLayerManager] Layer added to map:', layer.getId())
    }
  }

  /**
   * 移除图层
   */
  removeLayer(layerId: string): void {
    console.log('[MapInfoLayerManager] Removing layer:', layerId, 'existing layers:', Array.from(this.layers.keys()))
    const layer = this.layers.get(layerId)
    if (layer && this.map) {
      layer.remove(this.map)
    }
    this.layers.delete(layerId)
  }

  /**
   * 设置图层可见性
   */
  setLayerVisibility(layerId: string, visible: boolean): void {
    console.log('[MapInfoLayerManager] setLayerVisibility:', layerId, visible, 'existing layers:', Array.from(this.layers.keys()))
    console.log('[MapInfoLayerManager] Map instance:', this.map ? 'exists' : 'NULL')

    // 调试：打印所有图层状态
    this.debugPrintLayers()

    const layer = this.layers.get(layerId)
    if (layer) {
      console.log('[MapInfoLayerManager] Found layer:', layerId)
      if (this.map) {
        layer.setVisible(this.map, visible)
        console.log('[MapInfoLayerManager] Layer visibility set, checking result...')
        // 验证：检查图层是否真的在地图上
        const geoJSONLayer = (layer as any).geoJSONLayer
        if (geoJSONLayer && this.map.hasLayer(geoJSONLayer)) {
          console.log('[MapInfoLayerManager] ✓ Layer IS on map:', layerId)
        } else {
          console.log('[MapInfoLayerManager] ✗ Layer NOT on map:', layerId)
        }

        // 再次打印状态以确认更改
        console.log('[MapInfoLayerManager] After visibility change:')
        this.debugPrintLayers()
      } else {
        console.log('[MapInfoLayerManager] Map instance is null!')
      }
    } else {
      console.log('[MapInfoLayerManager] Layer not found:', layerId)
    }
  }

  /**
   * 获取所有图层
   */
  getLayers(): MapInfoLayer[] {
    return Array.from(this.layers.values())
  }

  /**
   * 清空所有图层
   */
  clear(): void {
    if (this.map) {
      for (const layer of this.layers.values()) {
        layer.remove(this.map)
      }
    }
    this.layers.clear()
  }
}
