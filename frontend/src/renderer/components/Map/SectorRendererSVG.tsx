/**
 * 扇区渲染器 - SVG版本（使用 L.Polygon）
 *
 * 特点：
 * - 使用 Leaflet 内置的 L.Polygon 绘制扇区
 * - 始终显示扇区，无需根据缩放级别切换显示模式
 * - Leaflet 自动处理坐标转换、缩放和定位
 * - 原生 Leaflet 事件处理点击和悬停
 * - 支持不同小区覆盖类型的渲染（室内圆形/室外扇形）
 * - 支持扇区标签显示/隐藏
 */
import L from 'leaflet'
import { RenderSectorData } from '../../services/mapDataService'
import { SECTOR_CONFIG, getCellCoverStyle } from '../../config/sector-config'

/**
 * 扇区图层配置
 */
export interface SectorLayerOptions extends L.LayerOptions {
  /** 扇区数据 */
  sectors: RenderSectorData[]
  /** 点击回调 */
  onClick?: (sector: RenderSectorData, event: L.LeafletMouseEvent) => void
  /** 当前缩放级别 */
  zoom: number
  /** 是否显示扇区标签 */
  showLabels?: boolean
}

/**
 * 扇区 SVG 图层（使用 L.Polygon 实现）
 *
 * 继承 L.Layer，每个扇区是一个独立的 L.Polygon 对象
 */
export class SectorSVGLayer extends L.Layer {
  private sectors: RenderSectorData[] = []
  private onClick?: (sector: RenderSectorData, event: L.LeafletMouseEvent) => void
  private _map?: L.Map
  private currentZoom: number = 12
  private showLabels: boolean = false

  // 扇区多边形映射
  private sectorPolygons = new Map<string, L.Polygon>()
  // 扇区标签映射
  private sectorLabels = new Map<string, L.DivIcon | L.Marker>()

  // 聚合图层
  private featureGroup?: L.FeatureGroup

  constructor(options: SectorLayerOptions) {
    super()
    this.sectors = options.sectors
    this.onClick = options.onClick
    this.currentZoom = options.zoom
    this.showLabels = options.showLabels || false
  }

  /**
   * Leaflet 图层生命周期：添加到地图
   */
  onAdd(map: L.Map): this {
    this._map = map

    // 创建 FeatureGroup 来管理所有扇区多边形
    this.featureGroup = L.featureGroup()
    this.featureGroup.addTo(map)

    // 监听地图移动和缩放结束事件，重新渲染以显示新进入视口的扇区
    map.on('moveend', this._render, this)
    map.on('zoomend', this._render, this)

    // 渲染所有扇区
    this._render()

    return this
  }

  /**
   * Leaflet 图层生命周期：从地图移除
   */
  onRemove(map: L.Map): this {
    // 移除事件监听
    map.off('moveend', this._render, this)
    map.off('zoomend', this._render, this)

    if (this.featureGroup) {
      map.removeLayer(this.featureGroup)
      this.featureGroup = undefined
    }

    this.sectorPolygons.clear()
    this.sectorLabels.clear()
    return this
  }

  /**
   * 更新扇区数据
   */
  updateSectors(sectors: RenderSectorData[]): void {
    this.sectors = sectors
    this._render()
  }

  /**
   * 更新缩放级别
   */
  updateZoom(zoom: number): void {
    this.currentZoom = zoom
    // 需要重绘以显示新进入视口的扇区
    this._render()
  }

  /**
   * 更新标签显示状态
   */
  updateShowLabels(showLabels: boolean): void {
    this.showLabels = showLabels
    this._render()
  }

  /**
   * 渲染所有扇区
   */
  private _render(): void {
    if (!this._map || !this.featureGroup) return

    // 清空现有多边形和标签
    this.featureGroup.clearLayers()
    this.sectorPolygons.clear()
    this.sectorLabels.clear()

    // 获取当前视口边界，添加缓冲区以确保边缘附近的扇区也被渲染
    const bounds = this._map.getBounds()
    const latBuffer = (bounds.getNorth() - bounds.getSouth()) * 0.2
    const lngBuffer = (bounds.getEast() - bounds.getWest()) * 0.2
    const paddedBounds = L.latLngBounds(
      [bounds.getSouth() - latBuffer, bounds.getWest() - lngBuffer],
      [bounds.getNorth() + latBuffer, bounds.getEast() + lngBuffer]
    )

    // 筛选可见扇区
    const visibleSectors = this.sectors.filter(sector => {
      return paddedBounds.contains([sector.displayLat, sector.displayLng])
    })

    // 按站点ID和网络类型分组扇区
    const groupedSectors = new Map<string, RenderSectorData[]>()
    
    for (const sector of visibleSectors) {
      const key = `${sector.siteId || 'unknown'}-${sector.networkType}`
      if (!groupedSectors.has(key)) {
        groupedSectors.set(key, [])
      }
      groupedSectors.get(key)!.push(sector)
    }
    
    // 渲染每个组内的扇区，处理同站多扇区重叠问题
    for (const [groupKey, groupSectors] of groupedSectors.entries()) {
      // 按扇区ID排序，确保渲染顺序一致
      groupSectors.sort((a, b) => {
        const aId = a.sectorId || ''
        const bId = b.sectorId || ''
        return aId.localeCompare(bId)
      })
      
      // 渲染每个扇区
      for (let i = 0; i < groupSectors.length; i++) {
        const sector = groupSectors[i]
        const coverStyle = getCellCoverStyle(sector.cell_cover_type, sector.networkType)
        
        // 只有同站点同网络类型的扇区才需要调整半径（因为它们可能完全重叠）
        let adjustedRadius = coverStyle.radius
        if (groupSectors.length > 1) {
          // 计算调整系数
          let radiusReduction: number
          
          // 室分小区（圆形）扩大半径差，使用20%的递减系数
          if (coverStyle.isCircular) {
            radiusReduction = 0.2 * i // 室分小区半径差扩大至原来的两倍
          } else {
            radiusReduction = 0.1 * i // 室外小区保持原来的10%递减系数
          }
          
          // 确保半径不小于原半径的30%
          adjustedRadius = Math.max(coverStyle.radius * (1 - radiusReduction), coverStyle.radius * 0.3)
        }
        
        const polygon = this._createSectorPolygon(sector, adjustedRadius)
        polygon.addTo(this.featureGroup)
        this.sectorPolygons.set(sector.id, polygon)
        
        // 渲染扇区标签（如果需要）
        if (this.showLabels) {
          const label = this._createSectorLabel(sector)
          label.addTo(this.featureGroup)
          this.sectorLabels.set(sector.id, label)
        }
      }
    }

    // console.log(`[SectorSVGLayer] 渲染了 ${this.sectorPolygons.size} 个扇区`)
  }

  /**
   * 创建扇区多边形
   * 根据小区覆盖类型绘制不同形状：
   * - cell_cover_type = 1: 室外小区，扇形，半径60米，夹角40度，按方位角绘制
   * - cell_cover_type = 4: 室内小区，圆形，半径30米，忽略方位角
   */
  private _createSectorPolygon(sector: RenderSectorData, adjustedRadius?: number): L.Polygon {
    const config = SECTOR_CONFIG[sector.networkType]
    // 传递networkType参数，获取正确的覆盖样式
    const coverStyle = getCellCoverStyle(sector.cell_cover_type, sector.networkType)
    const centerLatLng = L.latLng(sector.displayLat, sector.displayLng)

    let latLngs: L.LatLngExpression[]
    // 使用调整后的半径，如果没有则使用默认半径
    const radius = adjustedRadius || coverStyle.radius

    if (coverStyle.isCircular) {
      // 室内小区：绘制圆形
      latLngs = this._generateCirclePoints(centerLatLng, radius)
    } else {
      // 室外小区：绘制扇形
      // 只在调试模式下输出，避免日志过多
      const halfAngle = coverStyle.angle / 2

      // 计算扇区弧线的起点和终点
      // 方位角：正北为0度，顺时针增加
      const startAzimuth = sector.azimuth - halfAngle
      const endAzimuth = sector.azimuth + halfAngle

      const startPointLatLng = this._destination(centerLatLng, startAzimuth, radius)
      const endPointLatLng = this._destination(centerLatLng, endAzimuth, radius)

      // 构建扇形多边形坐标数组（地理坐标）
      latLngs = [
        [centerLatLng.lat, centerLatLng.lng], // 中心
        [startPointLatLng.lat, startPointLatLng.lng], // 起点
        // 在两点之间添加多个点来模拟弧线
        ...this._generateArcPoints(centerLatLng, startAzimuth, endAzimuth, radius),
        [endPointLatLng.lat, endPointLatLng.lng], // 终点
        [centerLatLng.lat, centerLatLng.lng]  // 回到中心（闭合）
      ]
    }

    // 创建多边形
    const polygon = L.polygon(latLngs, {
      color: config.strokeColor || '#2563eb',
      weight: config.strokeWidth || 1,
      opacity: 1,
      fillColor: config.color,
      fillOpacity: config.opacity,
      className: 'sector-polygon'
    })

    // 设置交互样式
    polygon.setStyle({
      className: 'sector-polygon'
    })

    // 绑定点击事件
    polygon.on('click', (e: L.LeafletMouseEvent) => {
      // 阻止事件冒泡到地图，确保扇区点击只显示扇区属性，不触发测量
      L.DomEvent.stopPropagation(e)
      // 添加扇区数据到事件
      e.target = polygon
      this.onClick?.(sector, e)
      console.log('[SectorRenderer] 扇区被点击:', sector.name, sector.networkType, 'cell_cover_type:', sector.cell_cover_type)
    })

    // 移除悬停效果，仅保留点击事件

    // 添加数据属性（用于调试）
    ;(polygon as any).sectorData = sector

    return polygon
  }

  /**
   * 生成弧线上的点
   * 在起点和终点之间生成多个点来模拟弧线
   */
  private _generateArcPoints(
    center: L.LatLng,
    startAzimuth: number,
    endAzimuth: number,
    radius: number,
    numPoints: number = 20
  ): L.LatLng[] {
    const points: L.LatLng[] = []
    const angleStep = (endAzimuth - startAzimuth) / numPoints

    for (let i = 1; i < numPoints; i++) {
      const azimuth = startAzimuth + angleStep * i
      const point = this._destination(center, azimuth, radius)
      points.push(point)
    }

    return points
  }

  /**
   * 生成圆形上的点
   * 用于绘制室内小区的圆形覆盖范围
   */
  /**
   * 创建扇区标签
   * 显示小区名称，使用简洁的文字样式，无边框
   */
  private _createSectorLabel(sector: RenderSectorData): L.Marker {
    const centerLatLng = L.latLng(sector.displayLat, sector.displayLng)
    const config = SECTOR_CONFIG[sector.networkType]
    
    // 简化标签实现，避免复杂的HTML和样式
    const labelContent = sector.name || ''
    const strokeColor = config.strokeColor || '#333'
    
    // 创建简洁的文字标签
    const labelIcon = L.divIcon({
      className: 'sector-label',
      html: `<div style="font-size: 10px; color: #000; font-weight: 500; white-space: nowrap; padding: 2px 4px; border-radius: 2px;">${labelContent}</div>`,
      iconSize: L.point(0, 0),
      iconAnchor: L.point(0, 0),
      popupAnchor: L.point(0, 0)
    })
    
    // 创建标记并添加到地图
    const marker = L.marker(centerLatLng, {
      icon: labelIcon,
      interactive: false,
      zIndexOffset: 1000
    })
    
    return marker
  }

  private _generateCirclePoints(
    center: L.LatLng,
    radius: number,
    numPoints: number = 64
  ): L.LatLng[] {
    const points: L.LatLng[] = []
    const angleStep = 360 / numPoints

    // 从0度开始，顺时针生成完整的圆
    for (let i = 0; i <= numPoints; i++) {
      const azimuth = angleStep * i
      const point = this._destination(center, azimuth, radius)
      points.push(point)
    }

    return points
  }

  /**
   * 计算从起点出发，沿指定方位角和距离到达的终点
   *
   * @param start 起点
   * @param azimuth 方位角（度，正北为0，顺时针）
   * @param distance 距离（米）
   */
  private _destination(start: L.LatLng, azimuth: number, distance: number): L.LatLng {
    const R = 6378137 // 地球半径（米）
    const brng = azimuth * Math.PI / 180
    const lat1 = start.lat * Math.PI / 180
    const lng1 = start.lng * Math.PI / 180

    const lat2 = Math.asin(
      Math.sin(lat1) * Math.cos(distance / R) +
      Math.cos(lat1) * Math.sin(distance / R) * Math.cos(brng)
    )

    const lng2 = lng1 + Math.atan2(
      Math.sin(brng) * Math.sin(distance / R) * Math.cos(lat1),
      Math.cos(distance / R) - Math.sin(lat1) * Math.sin(lat2)
    )

    return L.latLng(lat2 * 180 / Math.PI, lng2 * 180 / Math.PI)
  }
}

/**
 * 创建扇区 SVG 图层
 */
export function createSectorLayer(options: SectorLayerOptions): SectorSVGLayer {
  return new SectorSVGLayer(options)
}
