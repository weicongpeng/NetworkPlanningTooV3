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
import { CoordinateTransformer } from '../../utils/coordinate'

const IS_DEV = import.meta.env.DEV

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
  /** 要素点击回调 */
  onFeatureClick?: (properties: any, event: L.LeafletMouseEvent) => void
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
  private geoJSONLayer: L.GeoJSON | null = null
  private style: MapInfoLayerStyle
  private static _debugPrinted: boolean = false

  // 标签相关属性
  private labelsEnabled: boolean = false
  private labelMarkers: Map<string, L.Marker> = new Map()
  private labelConfig: {
    content: string
    color: string
    fontSize: number
  }
  private currentZoom: number = 14
  private currentMap: L.Map | null = null  // 存储当前地图实例
  private onFeatureClickCallback?: (properties: any, event: L.LeafletMouseEvent) => void
  private isInteractive: boolean = true // 是否允许交互 (满足需求3)

  // 框选高亮配置
  private selectionHighlightIds: Set<string> | null = null

  constructor(options: MapInfoLayerOptions) {
    this.id = options.id
    this.name = options.name
    this.type = options.type
    this.style = options.style || {}

    // 初始化标签配置
    this.labelConfig = {
      content: 'name',
      color: '#000000',
      fontSize: 12
    }
    this.onFeatureClickCallback = options.onFeatureClick
    this.currentMap = null
  }

  /**
   * 获取底层的 Leaflet GeoJSON 图层
   * 用于直接控制图层的添加/移除
   */
  getLeafletLayer(): L.GeoJSON | null {
    return this.geoJSONLayer
  }

  /**
   * 获取圆圈内的要素
   * @param center 中心点 (渲染坐标/GCJ02)
   * @param radius 半径 (米)
   */
  getFeaturesInCircle(center: L.LatLng, radius: number): any[] {
    if (!this.geoJSONLayer) {
      if (IS_DEV) console.log('[MapInfoLayer] getFeaturesInCircle: geoJSONLayer不存在', this.id)
      return []
    }
    const results: any[] = []
    let layerCount = 0

    this.geoJSONLayer.eachLayer((layer: any) => {
      layerCount++
      if (layer.getLatLng) {
        const latlng = layer.getLatLng()
        const distance = center.distanceTo(latlng)
        if (distance <= radius) {
          results.push(layer.feature.properties)
        }
      } else if (layer.getBounds) {
        // 对于线和面，如果边界中心在圆内或者边界与圆相交
        // 简化处理：检查边界中心
        const bounds = layer.getBounds()
        const distance = center.distanceTo(bounds.getCenter())
        if (distance <= radius) {
          results.push(layer.feature.properties)
        }
      }
    })

    if (IS_DEV) console.log('[MapInfoLayer] getFeaturesInCircle:', {
      id: this.id,
      name: this.name,
      totalLayers: layerCount,
      matchedFeatures: results.length,
      radius
    })
    return results
  }

  /**
   * 获取多边形内的要素
   * @param polygon Leaflet 多边形对象 (坐标为渲染坐标/GCJ02)
   */
  getFeaturesInPolygon(polygon: L.Polygon): any[] {
    if (!this.geoJSONLayer) return []
    const results: any[] = []
    const bounds = polygon.getBounds()
    const points = (polygon.getLatLngs()[0] as L.LatLng[]).map(p => [p.lat, p.lng])

    this.geoJSONLayer.eachLayer((layer: any) => {
      if (layer.getLatLng) {
        const latlng = layer.getLatLng()
        if (bounds.contains(latlng)) {
          if (this._isPointInPolygon([latlng.lat, latlng.lng], points)) {
            results.push(layer.feature.properties)
          }
        }
      } else if (layer.getBounds) {
        // 对于线和面，检查其边界中心是否在多边形内
        const layerBounds = layer.getBounds()
        const center = layerBounds.getCenter()
        if (bounds.contains(center)) {
          if (this._isPointInPolygon([center.lat, center.lng], points)) {
            results.push(layer.feature.properties)
          }
        }
      }
    })

    return results
  }

  /**
   * 射线法判断点是否在多边形内
   */
  private _isPointInPolygon(point: number[], polygon: number[][]): boolean {
    const x = point[0], y = point[1]
    let inside = false
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i][0], yi = polygon[i][1]
      const xj = polygon[j][0], yj = polygon[j][1]
      const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)
      if (intersect) inside = !inside
    }
    return inside
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
      if (IS_DEV) console.log('[MapInfoLayer] Layer already on map, removing first:', this.id)
      map.removeLayer(this.geoJSONLayer)
    }

    this.geoJSONLayer.addTo(map)
    this.currentMap = map  // 存储地图实例

    // 如果标签已开启，在添加到地图时自动创建标签
    if (this.labelsEnabled) {
      if (IS_DEV) console.log('[MapInfoLayer] Labels enabled, creating labels upon adding to map:', this.id)
      this._createLabels(map)
    }

    // 监听缩放变化，缩放结束后重新应用高亮样式
    map.on('zoomend', this._onZoomEnd.bind(this))

    if (IS_DEV) console.log('[MapInfoLayer] Layer added to map:', this.id)
    return this
  }

  /**
   * 缩放结束事件处理 - 重新应用高亮样式
   */
  private _onZoomEnd(): void {
    // 如果之前设置过高亮，缩放结束后重新应用
    if (this.selectionHighlightIds && this.selectionHighlightIds.size > 0) {
      if (IS_DEV) console.log('[MapInfoLayer] Zoom ended, re-applying highlight:', this.id)
      this.setSelectionHighlight(this.selectionHighlightIds)
    }
  }

  /**
   * 从地图移除
   */
  remove(map: L.Map): this {
    if (this.geoJSONLayer && map.hasLayer(this.geoJSONLayer)) {
      if (IS_DEV) console.log('[MapInfoLayer] Removing layer from map:', this.id)
      map.removeLayer(this.geoJSONLayer)
      // 移除 zoomend 事件监听器，防止事件泄漏
      map.off('zoomend', this._onZoomEnd)
      // 清除标签
      this._removeLabels()
    } else {
      if (IS_DEV) console.log('[MapInfoLayer] Layer not on map, skipping remove:', this.id, {
        hasGeoJSONLayer: !!this.geoJSONLayer,
        hasLayerInMap: this.geoJSONLayer ? map.hasLayer(this.geoJSONLayer) : false
      })
    }
    if (this.currentMap === map) {
      this.currentMap = null
    }
    return this
  }

  /**
   * 设置可见性
   */
  setVisible(map: L.Map, visible: boolean): this {
    if (IS_DEV) console.log('[MapInfoLayer] setVisible called:', this.id, visible, {
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
   * 检查图层是否可见
   */
  isVisible(): boolean {
    if (!this.geoJSONLayer || !this.currentMap) {
      if (IS_DEV) console.log('[MapInfoLayer] isVisible: 不可见', {
        id: this.id,
        name: this.name,
        hasGeoJSONLayer: !!this.geoJSONLayer,
        hasCurrentMap: !!this.currentMap
      })
      return false
    }
    const visible = this.currentMap.hasLayer(this.geoJSONLayer)
    if (IS_DEV) console.log('[MapInfoLayer] isVisible:', {
      id: this.id,
      name: this.name,
      visible
    })
    return visible
  }

  /**
   * 从 GeoJSON 数据创建图层
   */
  static async fromGeoJSON(options: MapInfoLayerOptions): Promise<MapInfoLayer> {
    const mapInfoLayer = new MapInfoLayer(options)

    // 应用坐标转换：WGS84 → GCJ-02（与扇区图使用相同的纠偏算法）
    const transformedData: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: options.data.features.map(feature => transformFeatureCoordinates(feature))
    }

    if (IS_DEV) console.log('[MapInfoLayer] Applied coordinate transformation to', transformedData.features.length, 'features')

    // 创建 GeoJSON 图层（使用转换后的数据）
    mapInfoLayer.geoJSONLayer = L.geoJSON(transformedData, {
      // 点要素样式
      pointToLayer: (feature, latLng) => {
        // 获取 feature 级别的样式（如果存在）
        const featureStyle = (feature.properties as any)?._style?.point || {}
        const pointStyle = { ...DEFAULT_STYLES.point, ...mapInfoLayer.style.point, ...featureStyle }

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
        if (!feature || !feature.geometry) return {}
        const geometry = feature.geometry.type
        const featureStyle = (feature.properties as any)?._style || {}

        // 调试：打印第一个要素的样式
        if (feature && feature.properties && Object.keys(feature.properties).length > 0) {
          if (!MapInfoLayer._debugPrinted) {
            if (IS_DEV) console.log('[MapInfoLayer] Feature style sample:', {
              geometry,
              featureStyle,
              properties: Object.keys(feature.properties).slice(0, 5)
            })
            MapInfoLayer._debugPrinted = true
          }
        }

        if (geometry === 'LineString' || geometry === 'MultiLineString') {
          // 合并样式：默认样式 -> 图层样式 -> 要素样式
          const mergedStyle = {
            ...DEFAULT_STYLES.line,
            ...mapInfoLayer.style.line
          }

          if (featureStyle.strokeColor) mergedStyle.color = featureStyle.strokeColor
          if (featureStyle.strokeWidth !== undefined) mergedStyle.weight = featureStyle.strokeWidth
          if (featureStyle.strokeDasharray) mergedStyle.dashArray = featureStyle.strokeDasharray
          if (featureStyle.strokeOpacity !== undefined) mergedStyle.opacity = featureStyle.strokeOpacity

          const result: any = {
            color: mergedStyle.color || '#8b5cf6',
            weight: mergedStyle.weight || 3,
            opacity: mergedStyle.opacity !== undefined ? mergedStyle.opacity : 1,
            lineCap: 'round',
            lineJoin: 'round'
          }
          if (mergedStyle.dashArray) {
            result.dashArray = mergedStyle.dashArray
          }
          return result
        } else if (geometry === 'Polygon' || geometry === 'MultiPolygon') {
          const mergedStyle = {
            ...DEFAULT_STYLES.polygon,
            ...mapInfoLayer.style.polygon
          }

          if (featureStyle.strokeColor) mergedStyle.color = featureStyle.strokeColor
          if (featureStyle.strokeWidth !== undefined) mergedStyle.weight = featureStyle.strokeWidth
          if (featureStyle.strokeOpacity !== undefined) mergedStyle.opacity = featureStyle.strokeOpacity
          if (featureStyle.strokeDasharray) mergedStyle.dashArray = featureStyle.strokeDasharray
          if (featureStyle.fillColor) mergedStyle.fillColor = featureStyle.fillColor
          if (featureStyle.fillOpacity !== undefined) mergedStyle.fillOpacity = featureStyle.fillOpacity

          const result: any = {
            color: mergedStyle.color || '#10b981',
            weight: mergedStyle.weight || 2,
            opacity: mergedStyle.opacity !== undefined ? mergedStyle.opacity : 1,
            fillColor: mergedStyle.fillColor || '#10b981',
            fillOpacity: mergedStyle.fillOpacity || 0.3
          }
          if (mergedStyle.dashArray) {
            result.dashArray = mergedStyle.dashArray
          }
          return result
        }
        return {}
      },

      // 要素交互处理
      onEachFeature: (feature, leafletLayer) => {
        leafletLayer.on('click', (e: L.LeafletMouseEvent) => {
          // 阻止事件冒泡到地图
          L.DomEvent.stopPropagation(e as any)

          // 如果交互被禁用（如框选模式下），不处理点击
          if (!mapInfoLayer.isInteractive) {
            return
          }

          if (mapInfoLayer.onFeatureClickCallback) {
            if (IS_DEV) console.log('[MapInfoLayer] Feature clicked:', feature.properties)
            mapInfoLayer.onFeatureClickCallback(feature.properties, e)
          }
        })
      }
    })

    return mapInfoLayer
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

  /**
   * 设置是否允许交互 (满足需求3)
   */
  setInteractive(interactive: boolean): void {
    this.isInteractive = interactive
  }

  /**
   * 设置框选高亮
   * @param ids 选中的要素ID集合（通常基于某个唯一属性，如'id'或'name'），null表示清除
   * @param idField 用于匹配的属性字段名，默认为 'id'
   */
  setSelectionHighlight(ids: Set<string> | null, idField: string = 'id'): void {
    this.selectionHighlightIds = ids
    if (!this.geoJSONLayer) return

    this.geoJSONLayer.eachLayer((layer: any) => {
      const feature = layer.feature
      if (!feature || !feature.properties) return

      // 获取标识符 - 与 selectFeaturesAtPoint 保持一致的ID获取逻辑
      const val = feature.properties[idField] || feature.properties['id'] || feature.properties['name'] || feature.properties['小区名称'] || feature.properties['OBJECTID'] || ''
      const isSelected = ids?.has(String(val))

      // 更新样式
      if (layer instanceof L.Path) {
        if (isSelected) {
          // 高亮样式
          layer.setStyle({
            color: '#00ffff',
            weight: 6,
            opacity: 1
          })
          if (layer.bringToFront) layer.bringToFront()
        } else {
          // 恢复默认样式 (重新触发 GeoJSON 的 style 函数)
          this.geoJSONLayer?.resetStyle(layer)
        }
      } else if (layer instanceof L.CircleMarker) {
        if (isSelected) {
          layer.setStyle({
            color: '#00ffff',
            weight: 6,
            opacity: 1
          })
          if (layer.bringToFront) layer.bringToFront()
        } else {
          this.geoJSONLayer?.resetStyle(layer)
        }
      }
    })
  }

  /**
   * 设置标签可见性
   * @param visible 是否显示标签
   */
  setLabelVisibility(visible: boolean): void {
    this.labelsEnabled = visible
    if (IS_DEV) console.log('[MapInfoLayer] setLabelVisibility:', this.id, visible)

    if (!this.currentMap) {
      console.warn('[MapInfoLayer] 图层未添加到地图，无法显示标签')
      return
    }

    if (visible) {
      this._createLabels(this.currentMap)
    } else {
      this._removeLabels()
    }
  }

  /**
   * 设置标签配置
   * @param config 标签配置
   */
  setLabelConfig(config: { content: string; color: string; fontSize: number }): void {
    // 更新配置
    this.labelConfig = { ...this.labelConfig, ...config }
    if (IS_DEV) console.log('[MapInfoLayer] setLabelConfig:', this.id, this.labelConfig)

    // 如果标签已启用且图层已添加到地图，重新创建标签以应用新配置
    if (this.labelsEnabled && this.currentMap) {
      if (IS_DEV) console.log('[MapInfoLayer] 标签已启用，立即重新创建标签')
      this._removeLabels()
      this._createLabels(this.currentMap)
    }
  }

  /**
   * 更新缩放级别并重绘标签
   */
  updateZoom(zoom: number): void {
    const oldZoom = this.currentZoom
    this.currentZoom = zoom

    // 如果缩放级别改变较大或者标签已开启，重新创建标签以应用碰撞检测
    if (this.labelsEnabled && this.currentMap && Math.abs(oldZoom - zoom) >= 1) {
      if (IS_DEV) console.log('[MapInfoLayer] Zoom changed, re-creating labels:', this.id, zoom)
      this._createLabels(this.currentMap)
    }
  }

  /**
   * 创建标签
   *
   * P1-3 优化:
   * 1. 优先级采样: 按要素重要性排序后采样
   * 2. 视口裁剪: 只渲染当前视口内的标签
   */
  private _createLabels(map: L.Map): void {
    if (!this.geoJSONLayer) return

    // 清除现有标签
    this._removeLabels()

    // 获取当前视口边界
    const mapBounds = map.getBounds()

    // 收集所有候选标签要素
    interface LabelCandidate {
      layer: any
      latLng: L.LatLng
      properties: any
      priority: number  // 优先级（数值越大越优先）
    }
    const candidates: LabelCandidate[] = []

    this.geoJSONLayer.eachLayer((layer: any) => {
      try {
        const feature = layer.feature
        let latLng: L.LatLng | null = null
        const properties = feature?.properties || {}

        // 获取标签显示位置
        if (layer instanceof L.CircleMarker) {
          latLng = layer.getLatLng()
        } else if (layer instanceof L.Polyline && !(layer instanceof L.Polygon)) {
          latLng = layer.getBounds().getCenter()
        } else if (layer instanceof L.Polygon) {
          latLng = layer.getBounds().getCenter()
        }

        if (!latLng) return

        // P1-3: 视口裁剪 - 只处理视口内的要素
        if (!mapBounds.contains(latLng)) return

        // 获取标签内容
        const labelContent = this._getLabelContent(properties)
        if (!labelContent) return

        // P1-3: 计算优先级
        const priority = this._calculateLabelPriority(properties, feature)
        candidates.push({ layer, latLng, properties, priority })
      } catch (err) {
        console.warn('[MapInfoLayer] Failed to collect label candidate:', err)
      }
    })

    // P1-3: 按优先级排序（高优先级在前）
    candidates.sort((a, b) => b.priority - a.priority)

    // 设置标签最小间距（像素）：随缩放级别动态调整
    const minDistance = this.currentZoom <= 11 ? this.labelConfig.fontSize * 6 : this.currentZoom <= 16 ? this.labelConfig.fontSize * 2.5 : this.labelConfig.fontSize * 1.2

    // 根据缩放级别限制最大可见标签数
    const maxVisibleLabels = this.currentZoom < 12 ? 200 : this.currentZoom < 16 ? 1000 : 3000

    // 记录已占用的标签位置，用于碰撞检测
    const occupiedPositions: L.LatLng[] = []

    // 按优先级顺序创建标签
    for (const candidate of candidates) {
      // 碰撞检测
      let isOverlapping = false
      for (const occPos of occupiedPositions) {
        const p1 = map.latLngToContainerPoint(candidate.latLng)
        const p2 = map.latLngToContainerPoint(occPos)
        const dist = Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2))

        if (dist < minDistance) {
          isOverlapping = true
          break
        }
      }

      if (isOverlapping) continue

      // 限制最大显示标签数
      if (this.labelMarkers.size >= maxVisibleLabels) break

      // 创建标签图标
      const labelContent = this._getLabelContent(candidate.properties)
      const labelIcon = L.divIcon({
        className: 'mapinfo-label',
        html: `<div style="
            font-size: ${this.labelConfig.fontSize}px;
            color: ${this.labelConfig.color};
            font-weight: 500;
            white-space: nowrap;
            background-color: transparent;
            padding: 0;
            pointer-events: none;
            text-shadow: 0 1px 2px rgba(0,0,0,0.3);
          ">${labelContent}</div>`,
        iconSize: L.point(0, 0),
        iconAnchor: L.point(0, -5)
      })

      const labelMarker = L.marker(candidate.latLng, {
        icon: labelIcon,
        interactive: false
      } as any)

      labelMarker.addTo(map)
      const layerId = (candidate.layer as any)._leaflet_id || String(candidate.latLng.lat)
      this.labelMarkers.set(layerId, labelMarker)

      // 记录位置
      occupiedPositions.push(candidate.latLng)
    }

    if (IS_DEV) console.log('[MapInfoLayer] Created', this.labelMarkers.size, 'labels for layer type:', this.type, 'Zoom:', this.currentZoom)
  }

  /**
   * 计算标签优先级
   * P1-3 优化: 返回优先级分数（数值越大越优先）
   */
  private _calculateLabelPriority(properties: any, feature: GeoJSON.Feature): number {
    let priority = 0

    // 1. 名称前缀优先级（"A"开头最优先）
    const name = properties.name || properties.小区名称 || properties.CellName || ''
    if (name) {
      const firstChar = name.charAt(0).toUpperCase()
      if (firstChar === 'A') priority += 100
      else if (firstChar === 'B') priority += 80
      else if (firstChar === 'C') priority += 60
      else if (firstChar >= 'D' && firstChar <= 'F') priority += 40
      else if (firstChar >= 'G' && firstChar <= 'L') priority += 20
    }

    // 2. 点要素优先级略高于线面（因为通常更重要）
    if (feature.geometry?.type === 'Point') {
      priority += 10
    }

    // 3. 面积/长度优先级（较大的要素优先）
    if (properties.area) {
      priority += Math.min(Math.log(properties.area + 1) / 10, 20)
    }
    if (properties.length) {
      priority += Math.min(Math.log(properties.length + 1) / 10, 15)
    }

    // 4. 特殊标识优先级
    if (properties.isImportant || properties.重要性 === '高') {
      priority += 50
    }
    if (properties.isShared === '是' || properties.isShared === true) {
      priority += 5
    }

    return priority
  }

  /**
   * 移除所有标签
   */
  private _removeLabels(): void {
    this.labelMarkers.forEach((marker: any) => {
      try {
        const map = marker._map || this.currentMap
        if (map) {
          map.removeLayer(marker)
        }
      } catch (err) {
        console.warn('[MapInfoLayer] Failed to remove label:', err)
      }
    })
    this.labelMarkers.clear()
  }

  /**
   * 获取标签内容
   * @param properties 要素属性
   * @returns 标签文本
   */
  private _getLabelContent(properties: any): string {
    const requestedField = this.labelConfig.content

    // 1. 尝试直接获取请求的字段
    // 预定义字段的映射
    const fieldMapping: Record<string, string[]> = {
      'name': ['小区名称', 'Cell Name', 'Name', 'name', 'cellName', 'NAME', 'Name', '站点名称', 'zhLabel'],
      'siteId': ['基站ID', 'Site ID', 'eNodeB ID', 'siteId', 'enbId', 'ENBID', 'site_id'],
      'frequency': ['下行频点', 'DL Frequency', 'Frequency', 'frequency', 'dlFreq', 'freq'],
      'pci': ['PCI', 'physicalCellId', 'pci', 'Pci'],
      'tac': ['TAC', 'trackingAreaCode', 'tac', 'Tac'],
      'isShared': ['是否共享', 'Is Shared', 'Shared', 'isShared'],
      'coverageType': ['覆盖类型', 'Coverage Type', 'coverageType']
    }

    // 查找匹配的字段
    const possibleNames = fieldMapping[requestedField] || [requestedField]
    for (const propName of possibleNames) {
      // 1a. 直接在 properties 中查找
      if (properties[propName] !== undefined && properties[propName] !== null) {
        const val = String(properties[propName]).trim()
        if (val) return val
      }

      // 1b. 在嵌套的 properties 中查找 (地理化数据展平前或特殊结构)
      if (properties.properties && properties.properties[propName] !== undefined && properties.properties[propName] !== null) {
        const val = String(properties.properties[propName]).trim()
        if (val) return val
      }
    }

    // 2. 只返回配置的字段，不使用智能回退
    // 如果配置的字段没找到，返回空字符串，不显示默认标签
    // 这样可以避免标签重复显示，只显示用户配置的标签内容

    return ''
  }
}

/**
 * MapInfo 图层管理器
 */
export class MapInfoLayerManager {
  private layers: Map<string, MapInfoLayer> = new Map()
  private map: L.Map | null = null

  constructor() { }

  /**
   * 调试方法：打印所有图层及其在地图上的状态
   */
  debugPrintLayers(): void {
    if (!IS_DEV) return
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
    if (IS_DEV) console.log('[MapInfoLayerManager] Adding layer:', layer.getId(), 'visible:', visible)
    this.layers.set(layer.getId(), layer)

    if (visible && this.map) {
      layer.addTo(this.map)
      if (IS_DEV) console.log('[MapInfoLayerManager] Layer added to map:', layer.getId())
    }
  }

  /**
   * 移除图层
   */
  removeLayer(layerId: string): void {
    if (IS_DEV) console.log('[MapInfoLayerManager] Removing layer:', layerId, 'existing layers:', Array.from(this.layers.keys()))
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
    if (IS_DEV) console.log('[MapInfoLayerManager] setLayerVisibility:', layerId, visible, 'existing layers:', Array.from(this.layers.keys()))
    if (IS_DEV) console.log('[MapInfoLayerManager] Map instance:', this.map ? 'exists' : 'NULL')

    // 调试：打印所有图层状态
    this.debugPrintLayers()

    const layer = this.layers.get(layerId)
    if (layer) {
      if (IS_DEV) console.log('[MapInfoLayerManager] Found layer:', layerId)
      if (this.map) {
        layer.setVisible(this.map, visible)
        if (IS_DEV) console.log('[MapInfoLayerManager] Layer visibility set, checking result...')
        // 验证：检查图层是否真的在地图上
        const geoJSONLayer = (layer as any).geoJSONLayer
        if (geoJSONLayer && this.map.hasLayer(geoJSONLayer)) {
          if (IS_DEV) console.log('[MapInfoLayerManager] ✓ Layer IS on map:', layerId)
        } else {
          if (IS_DEV) console.log('[MapInfoLayerManager] ✗ Layer NOT on map:', layerId)
        }

        // 再次打印状态以确认更改
        if (IS_DEV) console.log('[MapInfoLayerManager] After visibility change:')
        this.debugPrintLayers()
      } else {
        if (IS_DEV) console.log('[MapInfoLayerManager] Map instance is null!')
      }
    } else {
      if (IS_DEV) console.log('[MapInfoLayerManager] Layer not found:', layerId)
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
