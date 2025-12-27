/**
 * 地图浏览页面
 */
import { useState, useEffect, useRef } from 'react'
import { Upload, Loader2, AlertCircle, MapIcon } from 'lucide-react'
import { OnlineMap, OfflineMap, LayerControl, MapToolbar } from '../components/Map'
import { mapApi } from '../services/api'
import type { MapData } from '@shared/types'

interface Layer {
  id: string
  name: string
  type: 'sites' | 'sectors' | 'coverage' | 'neighbors' | 'conflicts'
  visible: boolean
  color?: string
}

export function MapPage() {
  const [viewMode, setViewMode] = useState<'online' | 'offline'>('online')
  const [mapData, setMapData] = useState<MapData | null>(null)
  const [offlinePath, setOfflinePath] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showUpload, setShowUpload] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 图层状态
  const [layers, setLayers] = useState<Layer[]>([
    { id: 'sites', name: '基站位置', type: 'sites', visible: true },
    { id: 'sectors', name: '小区扇区', type: 'sectors', visible: true },
    { id: 'coverage', name: '覆盖范围', type: 'coverage', visible: false },
    { id: 'neighbors', name: '邻区连线', type: 'neighbors', visible: false },
    { id: 'conflicts', name: 'PCI冲突', type: 'conflicts', visible: false, color: '#ef4444' }
  ])

  // 加载地图数据
  useEffect(() => {
    loadMapData()
    loadOfflinePath()
  }, [])

  const loadMapData = async () => {
    try {
      setLoading(true)
      const response = await mapApi.getData()
      setMapData(response.data)
    } catch (err: any) {
      setError(err.message || '加载地图数据失败')
    } finally {
      setLoading(false)
    }
  }

  const loadOfflinePath = async () => {
    try {
      const response = await mapApi.getOfflinePath()
      setOfflinePath(response.data?.path || '')
    } catch (err) {
      console.error('加载离线地图路径失败:', err)
    }
  }

  const handleToggleLayer = (layerId: string) => {
    setLayers(prev =>
      prev.map(layer =>
        layer.id === layerId
          ? { ...layer, visible: !layer.visible }
          : layer
      )
    )
  }

  const handleRecenter = () => {
    // 重新定位到地图中心
    window.location.reload()
  }

  const handleLocate = () => {
    // 定位到用户当前位置
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          console.log('当前位置:', position.coords)
        },
        (error) => {
          console.error('获取位置失败:', error)
        }
      )
    }
  }

  const handleMapUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setUploading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/v1/map/upload', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        throw new Error('上传失败')
      }

      const result = await response.json()
      if (result.success) {
        // 刷新地图数据
        await loadMapData()
        setShowUpload(false)
      } else {
        throw new Error(result.message || '上传失败')
      }
    } catch (err: any) {
      setError(err.message || '上传地图文件失败')
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <Loader2 className="animate-spin" size={32} />
        <p className="text-muted-foreground">加载地图数据中...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* 地图工具栏 */}
      <div className="h-16 bg-card border-b border-border flex items-center justify-between px-6 flex-shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold">地图浏览</h1>
          <div className="text-sm text-muted-foreground">
            {mapData?.sites.length ? `基站数: ${mapData.sites.length}` : '暂无数据'}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* 地图文件上传按钮 */}
          <button
            onClick={() => setShowUpload(!showUpload)}
            className="flex items-center gap-2 px-3 py-1.5 bg-secondary text-secondary-foreground rounded-lg hover:bg-muted transition-colors text-sm"
          >
            <Upload size={16} />
            导入地图文件
          </button>
        </div>
      </div>

      {/* 地图文件上传区域 */}
      {showUpload && (
        <div className="bg-card border-b border-border p-4 flex-shrink-0">
          <div className="max-w-md">
            <h3 className="text-sm font-medium mb-2">导入MapInfo兼容格式文件</h3>
            <p className="text-xs text-muted-foreground mb-3">
              支持格式: .tab, .dat, .map, .id, .zip
            </p>
            <label className="flex items-center justify-center w-full h-20 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary transition-colors">
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".tab,.dat,.map,.id,.zip"
                onChange={handleMapUpload}
                disabled={uploading}
              />
              <div className="flex flex-col items-center justify-center text-muted-foreground">
                {uploading ? (
                  <>
                    <Loader2 className="animate-spin mb-1" size={20} />
                    <p className="text-xs">上传中...</p>
                  </>
                ) : (
                  <>
                    <Upload size={24} className="mb-1" />
                    <p className="text-sm">点击选择文件</p>
                  </>
                )}
              </div>
            </label>
          </div>

          {/* 错误提示 */}
          {error && (
            <div className="mt-3 flex items-center gap-2 text-sm text-red-500 bg-red-50 p-2 rounded">
              <AlertCircle size={16} />
              <span>{error}</span>
              <button
                onClick={() => setError(null)}
                className="ml-auto text-red-500 hover:text-red-700"
              >
                ×
              </button>
            </div>
          )}
        </div>
      )}

      {/* 无数据提示 */}
      {!mapData || mapData.sites.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-4">
          <MapIcon size={64} className="text-muted-foreground opacity-50" />
          <p className="text-muted-foreground">暂无地图数据</p>
          <div className="text-sm text-muted-foreground">
            <p>请先在"数据管理"中导入工参数据</p>
            <p>或点击上方"导入地图文件"导入MapInfo格式地图</p>
          </div>
        </div>
      ) : (
        /* 地图容器 */
        <div className="flex-1 relative min-h-0">
          {/* 图层控制 */}
          <LayerControl
            layers={layers}
            onToggleLayer={handleToggleLayer}
          />

          {/* 地图工具栏 */}
          <MapToolbar
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            onRecenter={handleRecenter}
            onLocate={handleLocate}
          />

          {/* 地图内容 */}
          {viewMode === 'online' ? (
            <OnlineMap
              data={{
                sites: mapData.sites,
                center: mapData.center,
                bounds: mapData.bounds
              }}
              showSites={layers.find(l => l.type === 'sites')?.visible || false}
              showSectors={layers.find(l => l.type === 'sectors')?.visible || false}
              showCoverage={layers.find(l => l.type === 'coverage')?.visible || false}
              showNeighbors={layers.find(l => l.type === 'neighbors')?.visible || false}
              showConflicts={layers.find(l => l.type === 'conflicts')?.visible || false}
            />
          ) : (
            <OfflineMap
              data={{
                sites: mapData.sites,
                center: mapData.center
              }}
              offlinePath={offlinePath}
            />
          )}
        </div>
      )}
    </div>
  )
}
