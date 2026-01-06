/**
 * 扇区渲染器 - 智能LOD版本
 *
 * 优化策略：
 * - zoom < 12: 站点级别 - 每个物理站点显示为一个圆点
 * - zoom 12-15: 混合级别 - 重要站点显示扇区，其他显示圆点
 * - zoom > 15: 扇区级别 - 显示所有扇区
 *
 * 确保全部扇区可见且位置准确
 *
 * 修复：使用 Leaflet 的 CSS transform 来正确跟随地图移动和缩放
 */
import L from 'leaflet'
import { RenderSectorData } from '../../services/mapDataService'
import { SECTOR_CONFIG, getCellCoverStyle } from '../../config/sector-config'

/**
 * 扇区图层配置
 */
interface SectorLayerOptions extends L.LayerOptions {
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
 * 站点聚类
 */
interface SiteCluster {
  siteId: string
  lat: number
  lng: number
  sectors: RenderSectorData[]
  lteCount: number
  nrCount: number
}

/**
 * 扇区Canvas图层 - 智能LOD版本
 *
 * 使用简单重绘策略，确保位置准确
 */
export class SectorCanvasLayer extends L.Layer {
  private sectors: RenderSectorData[] = []
  private onClick?: (sector: RenderSectorData, event: L.LeafletMouseEvent) => void
  private canvas?: HTMLCanvasElement
  private ctx?: CanvasRenderingContext2D
  private _map?: L.Map
  private currentZoom: number = 12
  private showLabels: boolean = false

  // 站点聚类缓存
  private siteClusters: SiteCluster[] = []

  constructor(options: SectorLayerOptions) {
    super()
    this.sectors = options.sectors
    this.onClick = options.onClick
    this.currentZoom = options.zoom
    this.showLabels = options.showLabels ?? false
  }

  /**
   * Leaflet 图层生命周期：添加到地图
   */
  onAdd(map: L.Map): this {
    this._map = map

    // 创建 Canvas 元素
    this.canvas = L.DomUtil.create('canvas', 'leaflet-zoom-animated') as HTMLCanvasElement
    this.ctx = this.canvas.getContext('2d')!

    // 设置 Canvas 样式 - 确保使用 Leaflet 的 transform 系统
    const size = map.getSize()
    this.canvas.width = size.x
    this.canvas.height = size.y
    this.canvas.style.pointerEvents = 'auto'
    this.canvas.style.position = 'absolute'

    // 添加到地图的 overlayPane
    map.getPanes().overlayPane.appendChild(this.canvas)

    // 绑定事件
    map.on('move', this._reset, this)
    map.on('moveend', this._reset, this)
    map.on('resize', this._resize, this)
    map.on('zoom', this._reset, this)
    L.DomEvent.on(this.canvas, 'click', this._handleClick, this)

    // 计算站点聚类
    this.calculateSiteClusters()

    // 初始绘制
    this._reset()

    return this
  }

  /**
   * Leaflet 图层生命周期：从地图移除
   */
  onRemove(map: L.Map): this {
    if (this.canvas) {
      map.getPanes().overlayPane.removeChild(this.canvas)
    }
    map.off('move', this._reset, this)
    map.off('moveend', this._reset, this)
    map.off('resize', this._resize, this)
    map.off('zoom', this._reset, this)
    L.DomEvent.off(this.canvas, 'click', this._handleClick, this)

    return this
  }

  /**
   * 更新扇区数据
   */
  updateSectors(sectors: RenderSectorData[]): void {
    this.sectors = sectors
    this.calculateSiteClusters()
    this._reset()
  }

  /**
   * 更新缩放级别
   */
  updateZoom(zoom: number): void {
    this.currentZoom = zoom
    this._reset()
  }

  /**
   * 调整 Canvas 大小
   */
  private _resize = (): void => {
    if (!this._map || !this.canvas) return

    const size = this._map.getSize()
    this.canvas.width = size.x
    this.canvas.height = size.y
    this._reset()
  }

  /**
   * 计算站点聚类
   * 按物理站点（相同siteId和相近坐标）分组扇区
   */
  private calculateSiteClusters(): void {
    const clusters = new Map<string, SiteCluster>()

    for (const sector of this.sectors) {
      // 使用站点ID和坐标作为聚类键
      const siteKey = `${sector.siteId || sector.id}`

      if (!clusters.has(siteKey)) {
        clusters.set(siteKey, {
          siteId: sector.siteId || sector.id,
          lat: sector.displayLat,
          lng: sector.displayLng,
          sectors: [],
          lteCount: 0,
          nrCount: 0
        })
      }

      const cluster = clusters.get(siteKey)!
      cluster.sectors.push(sector)
      if (sector.networkType === 'LTE') {
        cluster.lteCount++
      } else {
        cluster.nrCount++
      }
    }

    this.siteClusters = Array.from(clusters.values())
  }

  /**
   * 重置并重绘
   * 使用 Leaflet 的位置系统确保正确渲染
   */
  private _reset = (): void => {
    if (!this._map || !this.canvas || !this.ctx) return

    // 清空 Canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)

    // 更新 Canvas 位置和大小
    const size = this._map.getSize()
    const topLeft = this._map.containerPointToLayerPoint([0, 0])
    L.DomUtil.setPosition(this.canvas, topLeft)

    // 根据缩放级别选择渲染策略
    if (this.currentZoom < 12) {
      // 站点级别：显示圆点
      this._renderSiteDots()
    } else if (this.currentZoom < 15) {
      // 混合级别：重要站点显示扇区
      this._renderHybrid()
    } else {
      // 扇区级别：显示所有扇区
      this._renderAllSectors()
    }
  }

  /**
   * 渲染站点圆点（zoom < 12）
   */
  private _renderSiteDots(): void {
    if (!this._map || !this.ctx) return

    for (const cluster of this.siteClusters) {
      const point = this._map.latLngToContainerPoint([cluster.lat, cluster.lng])

      // 根据扇区数量计算圆点大小
      const totalSectors = cluster.sectors.length
      const radius = Math.min(6 + Math.log2(totalSectors) * 3, 18)

      // 绘制圆点
      this.ctx.beginPath()
      this.ctx.arc(point.x, point.y, radius, 0, Math.PI * 2)

      // 根据网络类型选择颜色
      if (cluster.lteCount > 0 && cluster.nrCount > 0) {
        // 混合站点：渐变色
        const gradient = this.ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, radius)
        gradient.addColorStop(0, '#3b82f6')
        gradient.addColorStop(1, '#10b981')
        this.ctx.fillStyle = gradient
      } else if (cluster.lteCount > 0) {
        this.ctx.fillStyle = '#3b82f6'
      } else {
        this.ctx.fillStyle = '#10b981'
      }

      this.ctx.fill()

      // 绘制边框
      this.ctx.strokeStyle = 'white'
      this.ctx.lineWidth = 2
      this.ctx.stroke()

      // 绘制扇区数量标签
      this.ctx.fillStyle = 'white'
      this.ctx.font = 'bold 10px sans-serif'
      this.ctx.textAlign = 'center'
      this.ctx.textBaseline = 'middle'
      this.ctx.fillText(totalSectors.toString(), point.x, point.y)
    }
  }

  /**
   * 混合渲染（zoom 12-15）
   * 重要站点（扇区数>6）显示扇区，其他显示圆点
   */
  private _renderHybrid(): void {
    if (!this._map || !this.ctx) return

    for (const cluster of this.siteClusters) {
      const totalSectors = cluster.sectors.length

      if (totalSectors > 6) {
        // 重要站点：显示扇区
        for (const sector of cluster.sectors) {
          this._drawSingleSector(sector, true)
        }
      } else {
        // 普通站点：显示圆点
        const point = this._map.latLngToContainerPoint([cluster.lat, cluster.lng])
        const radius = Math.min(6 + Math.log2(totalSectors) * 3, 18)

        this.ctx.beginPath()
        this.ctx.arc(point.x, point.y, radius, 0, Math.PI * 2)

        if (cluster.lteCount > 0 && cluster.nrCount > 0) {
          const gradient = this.ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, radius)
          gradient.addColorStop(0, '#3b82f6')
          gradient.addColorStop(1, '#10b981')
          this.ctx.fillStyle = gradient
        } else if (cluster.lteCount > 0) {
          this.ctx.fillStyle = '#3b82f6'
        } else {
          this.ctx.fillStyle = '#10b981'
        }

        this.ctx.fill()
        this.ctx.strokeStyle = 'white'
        this.ctx.lineWidth = 2
        this.ctx.stroke()

        this.ctx.fillStyle = 'white'
        this.ctx.font = 'bold 10px sans-serif'
        this.ctx.textAlign = 'center'
        this.ctx.textBaseline = 'middle'
        this.ctx.fillText(totalSectors.toString(), point.x, point.y)
      }
    }
  }

  /**
   * 渲染所有扇区（zoom > 15）
   */
  private _renderAllSectors(): void {
    if (!this._map || !this.ctx) return

    for (const sector of this.sectors) {
      this._drawSingleSector(sector, true)
    }
  }

  /**
   * 绘制单个扇区
   *
   * 方位角：正北为0度，顺时针增加
   * Leaflet：0度为正东，顺时针
   *
   * 小区覆盖类型：
   * - cell_cover_type = 1: 室外小区，扇形，半径60米，夹角40度，按方位角绘制
   * - cell_cover_type = 4: 室内小区，圆形，半径30米，忽略方位角
   */
  private _drawSingleSector(sector: RenderSectorData, showStroke: boolean): void {
    if (!this._map || !this.ctx) return

    // 组合网络类型和覆盖类型配置
    const networkConfig = SECTOR_CONFIG[sector.networkType]
    const coverConfig = getCellCoverStyle(sector.cell_cover_type)

    const radius = coverConfig.radius
    const angle = coverConfig.angle
    const isCircular = coverConfig.isCircular

    // 计算扇区路径
    const latLng = L.latLng(sector.displayLat, sector.displayLng)
    const point = this._map.latLngToContainerPoint(latLng)

    // 将米转换为像素
    const metersPerPixel = this._map.containerPointToLatLng(point).distanceTo(
      this._map.containerPointToLatLng(L.point(point.x + 1, point.y))
    )
    const radiusPx = radius / metersPerPixel

    // 开始绘制路径
    this.ctx.beginPath()
    this.ctx.fillStyle = this._hexToRgba(networkConfig.color, networkConfig.opacity)

    if (isCircular) {
      // 室内小区：绘制圆形（忽略方位角）
      this.ctx.arc(point.x, point.y, radiusPx, 0, Math.PI * 2)
    } else {
      // 室外小区：绘制扇形（按方位角）
      // 方位角转换：地理方位角（正北0度）→ 数学角度（正东0度）
      const azimuthRad = (sector.azimuth - 90) * (Math.PI / 180)
      const startAngle = azimuthRad - (angle * Math.PI / 180) / 2
      const endAngle = azimuthRad + (angle * Math.PI / 180) / 2

      this.ctx.moveTo(point.x, point.y)
      this.ctx.arc(point.x, point.y, radiusPx, startAngle, endAngle)
      this.ctx.closePath()
    }

    // 填充
    this.ctx.fill()

    // 描边
    if (showStroke) {
      this.ctx.strokeStyle = networkConfig.strokeColor || '#2563eb'
      this.ctx.lineWidth = networkConfig.strokeWidth || 1
      this.ctx.stroke()
    }

    // 绘制扇区标签
    if (this.showLabels) {
      this.ctx.fillStyle = '#000000'
      this.ctx.font = '10px sans-serif'
      this.ctx.textAlign = 'center'
      this.ctx.textBaseline = 'middle'

      // 根据扇区类型确定标签位置
      if (isCircular) {
        // 室内圆形：在右侧显示标签
        const labelPoint = L.point(point.x + radiusPx + 10, point.y)
        this.ctx.fillText(sector.name || sector.id, labelPoint.x, labelPoint.y)
      } else {
        // 室外扇形：在扇区中心的延长线上显示标签
        const azimuthRad = (sector.azimuth - 90) * (Math.PI / 180)
        const labelX = point.x + Math.cos(azimuthRad) * (radiusPx + 10)
        const labelY = point.y + Math.sin(azimuthRad) * (radiusPx + 10)
        this.ctx.fillText(sector.name || sector.id, labelX, labelY)
      }
    }
  }

  /**
   * 处理点击事件
   */
  private _handleClick = (e: L.LeafletMouseEvent): void => {
    if (!this._map || !this.canvas) return

    const rect = this.canvas.getBoundingClientRect()
    const x = e.originalEvent.clientX - rect.left
    const y = e.originalEvent.clientY - rect.top

    // 根据缩放级别决定点击检测方式
    if (this.currentZoom < 12) {
      // 站点级别：检测圆点点击
      this._handleSiteDotClick(x, y, e)
    } else if (this.currentZoom < 15) {
      // 混合级别：先检测扇区，再检测圆点
      if (!this._handleSectorClick(x, y, e)) {
        this._handleSiteDotClick(x, y, e)
      }
    } else {
      // 扇区级别：检测扇区点击
      this._handleSectorClick(x, y, e)
    }
  }

  /**
   * 处理扇区点击
   */
  private _handleSectorClick(x: number, y: number, event: L.LeafletMouseEvent): boolean {
    if (!this._map) return false

    for (const sector of this.sectors) {
      if (this._isPointInSector(x, y, sector)) {
        this.onClick?.(sector, event)
        return true
      }
    }
    return false
  }

  /**
   * 处理站点圆点点击
   */
  private _handleSiteDotClick(x: number, y: number, event: L.LeafletMouseEvent): boolean {
    if (!this._map) return false

    for (const cluster of this.siteClusters) {
      const point = this._map.latLngToContainerPoint([cluster.lat, cluster.lng])
      const totalSectors = cluster.sectors.length
      const radius = Math.min(6 + Math.log2(totalSectors) * 3, 18)

      const dx = x - point.x
      const dy = y - point.y
      const distance = Math.sqrt(dx * dx + dy * dy)

      if (distance <= radius) {
        // 点击站点时，显示第一个扇区的信息
        const firstSector = cluster.sectors[0]
        this.onClick?.(firstSector, event)
        return true
      }
    }
    return false
  }

  /**
   * 判断点是否在扇区内
   *
   * 支持室内圆形（isCircular=true）和室外扇形（isCircular=false）
   */
  private _isPointInSector(x: number, y: number, sector: RenderSectorData): boolean {
    if (!this._map) return false

    const networkConfig = SECTOR_CONFIG[sector.networkType]
    const coverConfig = getCellCoverStyle(sector.cell_cover_type)

    const latLng = L.latLng(sector.displayLat, sector.displayLng)
    const center = this._map.latLngToContainerPoint(latLng)

    // 计算点到扇区中心的距离
    const dx = x - center.x
    const dy = y - center.y
    const distance = Math.sqrt(dx * dx + dy * dy)

    // 转换半径为像素
    const metersPerPixel = this._map.containerPointToLatLng(center).distanceTo(
      this._map.containerPointToLatLng(L.point(center.x + 1, center.y))
    )
    const radiusPx = coverConfig.radius / metersPerPixel

    // 距离检查
    if (distance > radiusPx) {
      return false
    }

    // 室内圆形：只需距离检查即可
    if (coverConfig.isCircular) {
      return true
    }

    // 室外扇形：需要角度检查
    let angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90 // 转换为地理方位角
    if (angle < 0) angle += 360

    const azimuth = sector.azimuth
    const halfAngle = coverConfig.angle / 2

    // 检查角度是否在扇区范围内
    const angleDiff = Math.abs(angle - azimuth)
    return angleDiff <= halfAngle || angleDiff >= 360 - halfAngle
  }

  /**
   * 颜色转换：Hex → RGBA
   */
  private _hexToRgba(hex: string, alpha: number): string {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }
}

/**
 * 创建扇区图层
 */
export function createSectorLayer(options: SectorLayerOptions): SectorCanvasLayer {
  return new SectorCanvasLayer(options)
}
