/**
 * 地理化数据图层渲染器
 *
 * 功能:
 * - 智能识别数据类型：点、扇区、多边形
 * - 点状渲染：L.circleMarker (黑框白底)
 * - 扇区渲染：根据缩放级别 LOD 显示
 * - 多边形渲染：L.polygon (黑框白底)
 * - 支持点击事件和标签显示
 */
import L from 'leaflet'
import { CoordinateTransformer } from '../../utils/coordinate'

export type GeoDataGeometryType = 'point' | 'sector' | 'polygon'

export interface GeoDataItem {
  // 基础字段（所有类型都有）
  name?: string
  properties: Record<string, any>

  // 点/扇区专用
  longitude?: number
  latitude?: number
  displayLng?: number
  displayLat?: number
  azimuth?: number
  beamwidth?: number
  cell_cover_type?: number

  // 多边形专用
  wkt?: string
  coordinates?: [number, number][]
}

export interface GeoDataLayerOptions {
  id: string
  name: string
  geometryType: GeoDataGeometryType
  data: GeoDataItem[]
  visible?: boolean
  onFeatureClick?: (properties: Record<string, any>, event: L.LeafletMouseEvent, name?: string) => void
  /** 缩放级别（用于LOD策略） */
  zoom?: number
}

// 默认样式：黑框白底
const DEFAULT_POINT_STYLE = {
  radius: 10,  // 10米半径
  fillColor: '#ffffff',
  color: '#000000',
  weight: 2,
  opacity: 1,
  fillOpacity: 1
}

const DEFAULT_SECTOR_STYLE = {
  fillColor: '#ffffff',
  color: '#000000',
  weight: 2,
  opacity: 1,
  fillOpacity: 0.6
}

const DEFAULT_POLYGON_STYLE = {
  fillColor: '#ffffff',
  color: '#000000',
  weight: 2,
  opacity: 1,
  fillOpacity: 0.2
}

// LOD 阈值
const LOD_THRESHOLD = 9

/**
 * 创建扇区多边形坐标
 */
function createSectorPolygon(
  lat: number,
  lng: number,
  azimuth: number,
  beamwidth: number,
  radius: number
): L.LatLngExpression[] {
  const beamRad = (beamwidth / 2) * (Math.PI / 180)
  const aziRad = (azimuth - 90) * (Math.PI / 180)

  // 计算扇形边界点
  const points: L.LatLngExpression[] = [[lat, lng]]

  const startAngle = aziRad - beamRad
  const endAngle = aziRad + beamRad
  const numPoints = Math.max(6, Math.ceil(beamwidth / 5)) // 每5度一个点，最少6个

  for (let i = 0; i <= numPoints; i++) {
    const angle = startAngle + (endAngle - startAngle) * (i / numPoints)
    const x = lng + radius * Math.cos(angle)
    const y = lat + radius * Math.sin(angle)
    points.push([y, x])
  }

  points.push([lat, lng]) // 闭合
  return points
}

/**
 * 地理化数据图层类
 */
export class GeoDataLayer {
  private id: string
  private name: string
  private geometryType: GeoDataGeometryType
  private data: GeoDataItem[]
  private leafletLayer: L.LayerGroup | null = null
  private currentZoom: number = 12
  private onFeatureClick?: (properties: Record<string, any>, event: L.LeafletMouseEvent, name?: string) => void
  private labelMarkers: Map<string, L.Marker> = new Map()
  private labelsEnabled: boolean = false
  private visible: boolean = false
  private map: L.Map | null = null

  constructor(options: GeoDataLayerOptions) {
    this.id = options.id
    this.name = options.name
    this.geometryType = options.geometryType
    this.data = options.data
    this.onFeatureClick = options.onFeatureClick
    this.currentZoom = options.zoom || 12
    this.visible = options.visible ?? false
  }

  /**
   * 添加到地图
   */
  addTo(map: L.Map): this {
    this.map = map

    if (!this.visible) {
      return this
    }

    // 清理旧图层
    this.remove(map)

    this.leafletLayer = L.layerGroup()

    switch (this.geometryType) {
      case 'point':
        this._renderPoints()
        break
      case 'sector':
        this._renderSectors()
        break
      case 'polygon':
        this._renderPolygons()
        break
    }

    this.leafletLayer.addTo(map)
    return this
  }

  /**
   * 渲染点状数据
   */
  private _renderPoints(): void {
    if (!this.leafletLayer) return

    for (let i = 0; i < this.data.length; i++) {
      const item = this.data[i]
      if (item.longitude === undefined || item.latitude === undefined) continue

      // 坐标转换
      const [displayLat, displayLng] = item.displayLat !== undefined && item.displayLng !== undefined
        ? [item.displayLat, item.displayLng]
        : CoordinateTransformer.wgs84ToGcj02(item.latitude, item.longitude)

      const marker = L.circleMarker([displayLat, displayLng], DEFAULT_POINT_STYLE)

      // 绑定点击事件
      if (this.onFeatureClick) {
        marker.on('click', (e) => {
          L.DomEvent.stopPropagation(e as unknown as L.DomEvent.MouseEvent)
          this.onFeatureClick!(item.properties, e as L.LeafletMouseEvent, item.name)
        })
      }

      marker.bindTooltip(item.name || `点${i+1}`, { permanent: false, direction: 'top' })
      marker.addTo(this.leafletLayer!)
    }
  }

  /**
   * 渲染扇区数据
   * LOD策略: zoom <= 9 用圆点, zoom > 9 用扇形
   */
  private _renderSectors(): void {
    if (!this.leafletLayer) return

    for (let i = 0; i < this.data.length; i++) {
      const item = this.data[i]
      if (item.longitude === undefined || item.latitude === undefined) continue

      // 坐标转换
      const [displayLat, displayLng] = item.displayLat !== undefined && item.displayLng !== undefined
        ? [item.displayLat, item.displayLng]
        : CoordinateTransformer.wgs84ToGcj02(item.latitude, item.longitude)

      const azimuth = item.azimuth || 0
      const beamwidth = item.beamwidth || 65
      const coverType = item.cell_cover_type || 1

      // LOD: 室内小区 或 低缩放级别 → 圆点
      if (coverType === 4 || this.currentZoom <= LOD_THRESHOLD) {
        const marker = L.circleMarker([displayLat, displayLng], DEFAULT_POINT_STYLE)
        if (this.onFeatureClick) {
          marker.on('click', (e) => {
            L.DomEvent.stopPropagation(e as unknown as L.DomEvent.MouseEvent)
            this.onFeatureClick!(item.properties, e as L.LeafletMouseEvent, item.name)
          })
        }
        marker.bindTooltip(item.name || `扇区${i+1}`, { permanent: false, direction: 'top' })
        marker.addTo(this.leafletLayer!)
      } else {
        // 室外小区且高缩放级别 → 扇形
        // 半径根据缩放级别调整
        const baseRadius = 50 // 米
        const radius = baseRadius * Math.pow(2, Math.max(0, this.currentZoom - 12))

        const points = createSectorPolygon(displayLat, displayLng, azimuth, beamwidth, radius)
        const polygon = L.polygon(points, DEFAULT_SECTOR_STYLE)

        if (this.onFeatureClick) {
          polygon.on('click', (e) => {
            L.DomEvent.stopPropagation(e as unknown as L.DomEvent.MouseEvent)
            this.onFeatureClick!(item.properties, e as L.LeafletMouseEvent, item.name)
          })
        }
        polygon.bindTooltip(item.name || `扇区${i+1}`, { permanent: false, direction: 'top' })
        polygon.addTo(this.leafletLayer!)
      }
    }
  }

  /**
   * 渲染多边形数据
   */
  private _renderPolygons(): void {
    if (!this.leafletLayer) return

    for (let i = 0; i < this.data.length; i++) {
      const item = this.data[i]
      if (!item.coordinates || item.coordinates.length < 3) continue

      // 转换坐标并构建多边形
      const latLngs: L.LatLngExpression[] = item.coordinates.map(([lng, lat]) => {
        const [gcjLat, gcjLng] = CoordinateTransformer.wgs84ToGcj02(lat, lng)
        return [gcjLat, gcjLng] as L.LatLngExpression
      })

      // 确保多边形闭合
      const first = latLngs[0]
      const last = latLngs[latLngs.length - 1]
      if (first[0] !== (last as number[])[0] || first[1] !== (last as number[])[1]) {
        latLngs.push(first)
      }

      const polygon = L.polygon(latLngs, DEFAULT_POLYGON_STYLE)

      if (this.onFeatureClick) {
        polygon.on('click', (e) => {
          L.DomEvent.stopPropagation(e as unknown as L.DomEvent.MouseEvent)
          this.onFeatureClick!(item.properties, e as L.LeafletMouseEvent, item.name)
        })
      }

      polygon.bindTooltip(item.name || `多边形${i+1}`, { permanent: false, direction: 'top' })
      polygon.addTo(this.leafletLayer!)
    }
  }

  /**
   * 从地图移除
   */
  remove(map?: L.Map): this {
    const targetMap = map || this.map
    if (this.leafletLayer && targetMap) {
      targetMap.removeLayer(this.leafletLayer)
      this.leafletLayer = null
    }
    this._removeLabels()
    return this
  }

  /**
   * 设置可见性
   */
  setVisible(map: L.Map, visible: boolean): this {
    this.visible = visible
    if (visible) {
      this.addTo(map)
    } else {
      this.remove(map)
    }
    return this
  }

  /**
   * 更新缩放级别
   */
  updateZoom(zoom: number, map: L.Map): void {
    const zoomChanged = this.currentZoom !== zoom
    this.currentZoom = zoom

    // 如果几何类型是扇区且图层可见，需要重新渲染
    if (zoomChanged && this.geometryType === 'sector' && this.visible) {
      this.addTo(map)
    }
  }

  /**
   * 设置标签可见性
   */
  setLabelVisibility(visible: boolean): this {
    this.labelsEnabled = visible
    // 标签通过 tooltip 实现，不需要单独处理
    return this
  }

  /**
   * 获取图层ID
   */
  getId(): string {
    return this.id
  }

  /**
   * 获取几何类型
   */
  getGeometryType(): GeoDataGeometryType {
    return this.geometryType
  }

  private _removeLabels(): void {
    this.labelMarkers.forEach(marker => {
      try {
        if (marker._map) {
          marker._map.removeLayer(marker)
        }
      } catch {
        // ignore
      }
    })
    this.labelMarkers.clear()
  }
}

/**
 * GeoDataLayer 管理器 - 管理多个地理化数据图层
 */
export class GeoDataLayerManager {
  private layers: Map<string, GeoDataLayer> = new Map()
  private map: L.Map | null = null

  /**
   * 初始化管理器
   */
  init(map: L.Map): void {
    this.map = map
  }

  /**
   * 添加图层
   */
  addLayer(options: GeoDataLayerOptions): GeoDataLayer {
    const layer = new GeoDataLayer(options)
    this.layers.set(options.id, layer)

    if (this.map && options.visible) {
      layer.addTo(this.map)
    }

    return layer
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
   * 获取图层
   */
  getLayer(layerId: string): GeoDataLayer | undefined {
    return this.layers.get(layerId)
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
   * 更新缩放级别
   */
  updateZoom(zoom: number): void {
    if (!this.map) return

    this.layers.forEach(layer => {
      layer.updateZoom(zoom, this.map!)
    })
  }

  /**
   * 获取所有图层
   */
  getAllLayers(): GeoDataLayer[] {
    return Array.from(this.layers.values())
  }

  /**
   * 清空所有图层
   */
  clear(): void {
    if (this.map) {
      this.layers.forEach(layer => {
        layer.remove(this.map!)
      })
    }
    this.layers.clear()
  }
}
