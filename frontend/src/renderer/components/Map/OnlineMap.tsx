/**
 * 在线地图组件 - 使用OpenStreetMap + Leaflet
 */
import { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'

interface SiteData {
  id: string
  name: string
  longitude: number
  latitude: number
  networkType: 'LTE' | 'NR'
  sectors: SectorData[]
}

interface SectorData {
  id: string
  name: string
  longitude: number
  latitude: number
  azimuth: number
  beamwidth: number
  pci?: number
}

interface MapData {
  sites: SiteData[]
  center: {
    latitude: number
    longitude: number
  }
  bounds: {
    north: number
    south: number
    east: number
    west: number
  }
}

interface OnlineMapProps {
  data: MapData
  showSites: boolean
  showSectors: boolean
  showCoverage: boolean
  showNeighbors: boolean
  showConflicts: boolean
}

export function OnlineMap({
  data,
  showSites,
  showSectors
}: OnlineMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const [loading, setLoading] = useState(true)
  const leafletRef = useRef<any>(null)

  // 初始化Leaflet地图
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

    const initMap = async () => {
      try {
        setLoading(true)
        await loadLeaflet()

        const L = leafletRef.current

        // 创建地图实例
        const map = L.map(mapRef.current).setView(
          [data.center.latitude, data.center.longitude],
          12
        )

        // 添加OpenStreetMap图层
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 19
        }).addTo(map)

        mapInstanceRef.current = map

        // 绘制站点和小区
        drawMarkers(map)
        setLoading(false)
      } catch (error) {
        console.error('初始化地图失败:', error)
        setLoading(false)
      }
    }

    initMap()

    return () => {
      // 清理
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [data.center])

  // 当数据或显示选项变化时重新绘制
  useEffect(() => {
    if (mapInstanceRef.current && leafletRef.current) {
      clearMarkers()
      drawMarkers(mapInstanceRef.current)

      // 自适应显示范围
      if (data.sites.length > 0) {
        const L = leafletRef.current
        const bounds = L.latLngBounds(
          data.sites.map(site => [site.latitude, site.longitude])
        )
        mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50] })
      }
    }
  }, [data, showSites, showSectors])

  const clearMarkers = () => {
    markersRef.current.forEach(marker => {
      mapInstanceRef.current.removeLayer(marker)
    })
    markersRef.current = []
  }

  const drawMarkers = (map: any) => {
    const L = leafletRef.current

    data.sites.forEach(site => {
      if (showSites) {
        // 站点标记
        const marker = L.marker([site.latitude, site.longitude], {
          title: site.name
        }).addTo(map)

        // 信息窗口
        const popupContent = `
          <div style="padding: 10px; min-width: 200px;">
            <h3 style="margin: 0 0 10px 0; font-size: 16px;">${site.name}</h3>
            <p style="margin: 5px 0;"><strong>类型:</strong> ${site.networkType}</p>
            <p style="margin: 5px 0;"><strong>经度:</strong> ${site.longitude.toFixed(6)}</p>
            <p style="margin: 5px 0;"><strong>纬度:</strong> ${site.latitude.toFixed(6)}</p>
            <p style="margin: 5px 0;"><strong>扇区数:</strong> ${site.sectors.length}</p>
          </div>
        `
        marker.bindPopup(popupContent)

        markersRef.current.push(marker)
      }

      if (showSectors) {
        // 小区标记
        site.sectors.forEach(sector => {
          // 根据网络类型选择颜色
          const color = site.networkType === 'LTE' ? '#3b82f6' : '#10b981'

          const marker = L.circleMarker([sector.latitude, sector.longitude], {
            radius: 6,
            fillColor: color,
            color: '#fff',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.9
          }).addTo(map)

          const popupContent = `
            <div style="padding: 10px; min-width: 200px;">
              <h3 style="margin: 0 0 10px 0; font-size: 16px;">${sector.name}</h3>
              <p style="margin: 5px 0;"><strong>PCI:</strong> ${sector.pci || '未分配'}</p>
              <p style="margin: 5px 0;"><strong>方位角:</strong> ${sector.azimuth}°</p>
              <p style="margin: 5px 0;"><strong>波束宽度:</strong> ${sector.beamwidth}°</p>
            </div>
          `
          marker.bindPopup(popupContent)

          markersRef.current.push(marker)

          // 绘制扇区方向指示线
          const bearing = (sector.azimuth - 90) * (Math.PI / 180)
          const lineLength = 0.005 // 约500米
          const endLat = sector.latitude + Math.sin(bearing) * lineLength
          const endLng = sector.longitude + Math.cos(bearing) * lineLength

          const directionLine = L.polyline(
            [
              [sector.latitude, sector.longitude],
              [endLat, endLng]
            ],
            {
              color: color,
              weight: 2,
              opacity: 0.8,
              dashArray: '5, 5'
            }
          ).addTo(map)

          markersRef.current.push(directionLine)
        })
      }
    })
  }

  return (
    <div
      ref={mapRef}
      style={{ height: '100%', width: '100%' }}
      className="relative"
    >
      {/* 加载提示 */}
      {loading && (
        <div className="absolute top-4 left-4 z-[1000] bg-white/90 backdrop-blur px-4 py-2 rounded-lg shadow flex items-center gap-2">
          <Loader2 className="animate-spin" size={16} />
          <span className="text-sm">加载地图中...</span>
        </div>
      )}

      {/* 数据统计 */}
      {!loading && (
        <div className="absolute top-4 left-4 z-[1000] bg-white/90 backdrop-blur px-3 py-2 rounded-lg shadow text-sm">
          <div><strong>基站数:</strong> {data.sites.length}</div>
          <div className="text-xs text-gray-500 mt-1">
            使用 OpenStreetMap 数据
          </div>
        </div>
      )}
    </div>
  )
}
