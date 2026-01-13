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
import { SECTOR_CONFIG, getCellCoverStyle, getSectorColor } from '../../config/sector-config'

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
  private mapInstance?: L.Map
  private currentZoom: number = 12
  private showLabels: boolean = false

  // 动画帧请求ID
  private _animRequestId: number | null = null

  // 频点可见性映射（用于过滤）
  private frequencyVisibility: Map<number, boolean> = new Map()

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
    this.mapInstance = map

    // 创建 FeatureGroup 来管理所有扇区多边形
    this.featureGroup = L.featureGroup()
    this.featureGroup.addTo(map)

    // 监听地图移动和缩放结束事件，重新渲染以显示新进入视口的扇区
    // moveend: 拖动结束或缩放结束时触发，用于视口裁剪和全量重绘
    map.on('moveend', this._render, this)

    // zoom: 缩放过程中持续触发，用于平滑更新扇区大小
    // 使用 bound 函数确保 this 上下文正确，并便于移除监听
    this._onZoom = this._onZoom.bind(this)
    map.on('zoom', this._onZoom, this)

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
    map.off('zoom', this._onZoom, this)

    // 取消挂起的动画帧
    if (this._animRequestId !== null) {
      L.Util.cancelAnimFrame(this._animRequestId)
      this._animRequestId = null
    }

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
    // 强制重绘
    if (!this.mapInstance) return
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
   * 设置频点可见性
   * @param frequency 频点值
   * @param visible 是否可见
   */
  setFrequencyVisibility(frequency: number, visible: boolean): void {
    this.frequencyVisibility.set(frequency, visible)
    this._render() // 重新渲染
  }

  /**
   * 获取指定屏幕位置的所有扇区数据
   * 用于处理重叠扇区点击
   */
  public getSectorsAt(clientX: number, clientY: number): RenderSectorData[] {
    const sectors: RenderSectorData[] = []
    const elements = document.elementsFromPoint(clientX, clientY)

    // 遍历所有元素，寻找属于本图层的扇区多边形
    for (const el of elements) {
      if (el.classList.contains('sector-polygon')) {
        // 通过寻找 FeatureGroup 中的对应 Layer 获取数据
        if (this.featureGroup) {
          this.featureGroup.eachLayer((layer: any) => {
            if (layer.getElement?.() === el && layer.sectorData) {
              sectors.push(layer.sectorData)
            }
          })
        }
      }
    }

    // 去重并返回
    return sectors.filter((v, i, a) => a.findIndex(t => t.id === v.id) === i)
  }

  /**
   * 批量设置频点可见性
   * @param visibilityMap 频点可见性映射
   */
  setFrequenciesVisibility(visibilityMap: Map<number, boolean>): void {
    this.frequencyVisibility = new Map(visibilityMap)
    this._render()
  }

  /**
   * 处理缩放事件：使用 requestAnimationFrame 节流
   */
  private _onZoom(): void {
    if (this._animRequestId !== null) return

    this._animRequestId = L.Util.requestAnimFrame(() => {
      this._updateSectorShapes()
      this._animRequestId = null
    }, this)
  }

  /**
   * 计算当前缩放级别下的扇区物理半径（米）
   * 策略：保持扇区的**视觉像素大小恒定**，无论地图如何缩放
   * 这样用户在缩放地图时，扇区看起来大小"不变"
   */
  private _calculateRadius(zoom: number, centerLat: number = 39.9): number {
    // 目标：室外扇区在屏幕上保持约 16 像素的半径
    // 室内扇区在屏幕上保持约 8 像素的半径（在户外扇区大小的一半）
    const TARGET_PIXEL_RADIUS_OUTDOOR = 16

    // 在Web Mercator投影中，每像素代表的米数公式：
    // metersPerPixel = 156543.03392 * Math.cos(lat * π/180) / 2^zoom
    // 其中 156543.03392 是赤道在zoom 0时的米/像素
    const METERS_PER_PIXEL_AT_EQUATOR_ZOOM_0 = 156543.03392
    const latRad = centerLat * Math.PI / 180
    const metersPerPixel = METERS_PER_PIXEL_AT_EQUATOR_ZOOM_0 * Math.cos(latRad) / Math.pow(2, zoom)

    // 物理半径 = 目标像素半径 × 每像素米数
    const physicalRadius = TARGET_PIXEL_RADIUS_OUTDOOR * metersPerPixel

    // 设置合理的上下限，避免极端情况
    // 最小5米（避免过小），最大5000米（避免过大影响性能）
    return Math.max(5, Math.min(5000, physicalRadius))
  }

  /**
   * 缩放过程中实时更新扇区形状
   */
  private _updateSectorShapes(): void {
    if (!this.mapInstance) return

    const currentZoom = this.mapInstance.getZoom()
    const mapCenter = this.mapInstance.getCenter()
    const outdoorRadius = this._calculateRadius(currentZoom, mapCenter.lat)
    const indoorRadius = outdoorRadius / 2

    // 遍历所有已渲染的扇区多边形并更新形状
    for (const [, polygon] of this.sectorPolygons.entries()) {
      const sector = (polygon as any).sectorData as RenderSectorData
      if (!sector) continue

      const coverStyle = getCellCoverStyle(sector.cell_cover_type, sector.networkType)
      const radius = coverStyle.isCircular ? indoorRadius : outdoorRadius

      const newLatLngs = this._generateSectorLatLngs(sector, radius)
      polygon.setLatLngs(newLatLngs)
    }
  }

  /**
   * 生成扇区坐标点数组
   */
  private _generateSectorLatLngs(sector: RenderSectorData, radius: number): L.LatLngExpression[] {
    const coverStyle = getCellCoverStyle(sector.cell_cover_type, sector.networkType)
    const centerLatLng = L.latLng(sector.displayLat, sector.displayLng)

    if (coverStyle.isCircular) {
      return this._generateCirclePoints(centerLatLng, radius)
    } else {
      const halfAngle = coverStyle.angle / 2
      const startAzimuth = sector.azimuth - halfAngle
      const endAzimuth = sector.azimuth + halfAngle

      const startPointLatLng = this._fastDestination(centerLatLng, startAzimuth, radius)
      const endPointLatLng = this._fastDestination(centerLatLng, endAzimuth, radius)

      return [
        [centerLatLng.lat, centerLatLng.lng],
        [startPointLatLng.lat, startPointLatLng.lng],
        ...this._generateArcPoints(centerLatLng, startAzimuth, endAzimuth, radius),
        [endPointLatLng.lat, endPointLatLng.lng],
        [centerLatLng.lat, centerLatLng.lng]
      ]
    }
  }

  /**
   * 渲染所有扇区
   */
  private _render(): void {
    if (!this.mapInstance || !this.featureGroup) return

    // 清空现有多边形和标签
    this.featureGroup.clearLayers()
    this.sectorPolygons.clear()
    this.sectorLabels.clear()

    // 获取当前地图的缩放级别，确保使用实时值
    const currentZoom = this.mapInstance.getZoom()
    const mapCenter = this.mapInstance.getCenter()

    // 预先计算当前半径（使用地图中心纬度）
    const outdoorRadius = this._calculateRadius(currentZoom, mapCenter.lat)
    const indoorRadius = outdoorRadius / 2

    // 获取当前视口边界，添加缓冲区以确保边缘附近的扇区也被渲染
    const bounds = this.mapInstance.getBounds()
    const latBuffer = (bounds.getNorth() - bounds.getSouth()) * 0.2
    const lngBuffer = (bounds.getEast() - bounds.getWest()) * 0.2
    const paddedBounds = L.latLngBounds(
      [bounds.getSouth() - latBuffer, bounds.getWest() - lngBuffer],
      [bounds.getNorth() + latBuffer, bounds.getEast() + lngBuffer]
    )

    // 筛选可见扇区
    const visibleSectors = this.sectors.filter(sector => {
      // 增加判断：如果经纬度无效则不渲染
      if (!sector.displayLat || !sector.displayLng) return false
      return paddedBounds.contains([sector.displayLat, sector.displayLng])
    })

    // 按频点过滤扇区
    const frequencyFilteredSectors = visibleSectors.filter(sector => {
      // 如果扇区没有频点信息，默认显示
      if (!sector.frequency) return true

      // 检查频点可见性
      const isVisible = this.frequencyVisibility.get(sector.frequency)
      // 如果没有设置该频点的可见性，默认为可见
      return isVisible === undefined || isVisible
    })

    // 按站点ID和网络类型分组扇区
    const groupedSectors = new Map<string, RenderSectorData[]>()

    for (const sector of frequencyFilteredSectors) {
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

        // 根据覆盖类型选择半径
        const radius = coverStyle.isCircular ? indoorRadius : outdoorRadius

        const polygon = this._createSectorPolygon(sector, radius)
        polygon.addTo(this.featureGroup)
        this.sectorPolygons.set(sector.id, polygon)

        // 渲染扇区标签（如果需要）
        if (this.showLabels) {
          // 当同一个物理站点扇区数大于3时，只显示一个扇区名字
          if (groupSectors.length <= 3 || i === 0) {
            const label = this._createSectorLabel(sector, i, groupSectors.length)
            label.addTo(this.featureGroup)
            this.sectorLabels.set(sector.id, label)
          }
        }
      }
    }
  }

  /**
   * 创建扇区多边形
   * 根据小区覆盖类型绘制不同形状：
   * - cell_cover_type = 1: 室外小区，扇形，半径60米，夹角40度，按方位角绘制
   * - cell_cover_type = 4: 室内小区，圆形，半径30米，忽略方位角
   */
  private _createSectorPolygon(sector: RenderSectorData, adjustedRadius?: number): L.Polygon {
    // 如果没有传入调整后的半径，则计算一个默认值 (避免 crash，但实际上应该总是传入)
    let radius = adjustedRadius
    if (!radius) {
      // Fallback: 使用默认缩放进行计算
      const currentZoom = this.mapInstance ? this.mapInstance.getZoom() : 12
      const centerLat = this.mapInstance ? this.mapInstance.getCenter().lat : sector.displayLat
      radius = this._calculateRadius(currentZoom, centerLat)
      if (getCellCoverStyle(sector.cell_cover_type, sector.networkType).isCircular) {
        radius = radius / 2
      }
    }

    // 使用提取的坐标生成方法
    const latLngs = this._generateSectorLatLngs(sector, radius)

    // 获取扇区颜色（基于频点或网络类型）
    const colors = getSectorColor(sector)
    const config = SECTOR_CONFIG[sector.networkType] // 仅用于opacity等其他配置

    // 创建多边形
    const polygon = L.polygon(latLngs, {
      color: config.strokeColor || '#000000', // 强制使用黑色细边框
      weight: config.strokeWidth || 0.5,
      opacity: 1,
      fillColor: colors.fillColor,
      fillOpacity: config.opacity, // 此时已为 1
      className: 'sector-polygon'
    })

    // 设置交互样式
    polygon.setStyle({
      className: 'sector-polygon'
    })

    // 绑定点击事件
    polygon.on('click', (e: L.LeafletMouseEvent) => {
      L.DomEvent.stopPropagation(e)
      e.target = polygon
      this.onClick?.(sector, e)
      console.log('[SectorRenderer] 扇区被点击:', sector.name, sector.networkType, 'cell_cover_type:', sector.cell_cover_type)
    })

      // 添加数据属性（用于调试）
      ; (polygon as any).sectorData = sector

    return polygon
  }

  /**
   * 生成弧线上的点
   * 在起点和终点之间生成多个点来模拟弧线
   * 使用更多点以获得更平滑的曲线边缘
   */
  private _generateArcPoints(
    center: L.LatLng,
    startAzimuth: number,
    endAzimuth: number,
    radius: number,
    numPoints: number = 60
  ): L.LatLng[] {
    const points: L.LatLng[] = []
    const angleStep = (endAzimuth - startAzimuth) / numPoints

    for (let i = 1; i < numPoints; i++) {
      const azimuth = startAzimuth + angleStep * i
      // 使用快速计算方法
      const point = this._fastDestination(center, azimuth, radius)
      points.push(point)
    }

    return points
  }

  /**
   * 创建扇区标签
   * 显示小区名称，使用简洁的文字样式，无边框
   * @param sector 扇区数据
   * @param labelIndex 标签在组内的索引
   * @param totalLabels 组内标签总数
   */
  private _createSectorLabel(sector: RenderSectorData, labelIndex: number, totalLabels: number): L.Marker {
    const centerLatLng = L.latLng(sector.displayLat, sector.displayLng)
    const config = SECTOR_CONFIG[sector.networkType]

    // 简化标签实现，避免复杂的HTML和样式
    const labelContent = sector.name || ''
    const strokeColor = config.strokeColor || '#333'

    // 根据标签索引计算偏移量，避免重叠
    let offsetLat = 0
    let offsetLng = 0

    if (totalLabels > 1) {
      // 计算标签偏移半径（根据扇区类型和缩放级别调整）
      const offsetRadius = this.currentZoom > 15 ? 25 : 20

      // 将标签沿圆周均匀分布
      const angleStep = 360 / totalLabels
      const angle = angleStep * labelIndex

      // 转换角度为弧度
      const angleRad = (angle * Math.PI) / 180

      // 计算偏移坐标
      offsetLat = Math.sin(angleRad) * offsetRadius
      offsetLng = Math.cos(angleRad) * offsetRadius
    }

    // 创建简洁的文字标签
    const labelIcon = L.divIcon({
      className: 'sector-label',
      html: `<div style="font-size: 10px; color: #000; font-weight: 500; white-space: nowrap;">${labelContent}</div>`,
      iconSize: L.point(0, 0),
      iconAnchor: L.point(0, 0),
      popupAnchor: L.point(0, 0)
    })

    // 创建标记并添加到地图
    // 使用L.map.latLngToLayerPoint和L.map.layerPointToLatLng来计算偏移后的位置
    let labelLatLng = centerLatLng
    if (offsetLat !== 0 || offsetLng !== 0) {
      // 将地理坐标转换为像素坐标
      const centerPoint = this.mapInstance!.latLngToLayerPoint(centerLatLng)
      // 添加偏移
      const offsetPoint = centerPoint.add(L.point(offsetLng, offsetLat))
      // 将像素坐标转换回地理坐标
      labelLatLng = this.mapInstance!.layerPointToLatLng(offsetPoint)
    }

    const marker = L.marker(labelLatLng, {
      icon: labelIcon,
      interactive: false,
      zIndexOffset: 1000
    })

    return marker
  }

  /**
   * 生成圆形上的点
   * 用于绘制室内小区的圆形覆盖范围
   * 使用更多点以获得更平滑的圆形边缘
   */
  private _generateCirclePoints(
    center: L.LatLng,
    radius: number,
    numPoints: number = 128
  ): L.LatLng[] {
    const points: L.LatLng[] = []
    const angleStep = 360 / numPoints

    // 从0度开始，顺时针生成完整的圆
    for (let i = 0; i <= numPoints; i++) {
      const azimuth = angleStep * i
      // 使用快速计算方法
      const point = this._fastDestination(center, azimuth, radius)
      points.push(point)
    }

    return points
  }

  /**
   * 快速计算终点坐标 (Flat-Earth Approximation)
   * 适用于小范围（<几百公里）的高性能计算，避免昂贵的反三角函数
   * 精度提示：在2300m范围内，误差极小，完全满足视觉需求
   */
  private _fastDestination(start: L.LatLng, azimuth: number, distance: number): L.LatLng {
    // 将角度转换为弧度
    const radAzimuth = azimuth * Math.PI / 180
    // 纬度的每米度数 (常量 approximation)
    const metersPerLatDegree = 111319.9
    // 经度的每米度数 (随纬度变化)
    const metersPerLngDegree = 111319.9 * Math.cos(start.lat * Math.PI / 180)

    const dLat = (distance * Math.cos(radAzimuth)) / metersPerLatDegree
    const dLng = (distance * Math.sin(radAzimuth)) / metersPerLngDegree

    return L.latLng(start.lat + dLat, start.lng + dLng)
  }


}

/**
 * 创建扇区 SVG 图层
 */
export function createSectorLayer(options: SectorLayerOptions): SectorSVGLayer {
  return new SectorSVGLayer(options)
}
