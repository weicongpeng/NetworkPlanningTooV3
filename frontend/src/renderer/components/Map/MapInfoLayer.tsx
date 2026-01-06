/**
 * MapInfo 图层渲染器
 *
 * 功能:
 * - 渲染点要素（Point）
 * - 渲染线要素（LineString）
 * - 渲染面要素（Polygon）
 * - 使用 Leaflet GeoJSON 图层
 */
import L from 'leaflet'
import { GeoJSONProps } from 'leaflet'

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
    opacity: 1,
    dashArray: '5, 10'
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
   * 添加到地图
   */
  addTo(map: L.Map): this {
    if (!this.geoJSONLayer) {
      throw new Error('图层未初始化，请先调用 loadData() 加载数据')
    }

    this.geoJSONLayer.addTo(map)
    return this
  }

  /**
   * 从地图移除
   */
  remove(map: L.Map): this {
    if (this.geoJSONLayer && map.hasLayer(this.geoJSONLayer)) {
      map.removeLayer(this.geoJSONLayer)
    }
    return this
  }

  /**
   * 设置可见性
   */
  setVisible(map: L.Map, visible: boolean): this {
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

    // 创建 GeoJSON 图层
    layer.geoJSONLayer = L.geoJSON(options.data, {
      // 点要素样式
      pointToLayer: (feature, latLng) => {
        const pointStyle = { ...DEFAULT_STYLES.point, ...layer.style.point }
        return L.circleMarker(latLng, {
          radius: pointStyle.radius,
          fillColor: pointStyle.fillColor,
          color: pointStyle.color,
          weight: pointStyle.weight,
          opacity: pointStyle.opacity,
          fillOpacity: pointStyle.fillOpacity
        })
      },

      // 线和面要素样式
      style: (feature) => {
        const geometry = feature.geometry?.type
        if (geometry === 'LineString' || geometry === 'MultiLineString') {
          const lineStyle = { ...DEFAULT_STYLES.line, ...layer.style.line }
          return {
            color: lineStyle.color,
            weight: lineStyle.weight,
            opacity: lineStyle.opacity,
            dashArray: lineStyle.dashArray
          }
        } else if (geometry === 'Polygon' || geometry === 'MultiPolygon') {
          const polygonStyle = { ...DEFAULT_STYLES.polygon, ...layer.style.polygon }
          return {
            color: polygonStyle.color,
            weight: polygonStyle.weight,
            opacity: polygonStyle.opacity,
            dashArray: polygonStyle.dashArray,
            fillColor: polygonStyle.fillColor,
            fillOpacity: polygonStyle.fillOpacity
          }
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
    this.layers.set(layer.getId(), layer)

    if (visible && this.map) {
      layer.addTo(this.map)
    }
  }

  /**
   * 移除图层
   */
  removeLayer(layerId: string): void {
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
    const layer = this.layers.get(layerId)
    if (layer && this.map) {
      layer.setVisible(this.map, visible)
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
