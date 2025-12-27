/**
 * 地图工具栏组件
 */
import { Layers, MapPin, Navigation, Crosshair, Home } from 'lucide-react'

interface MapToolbarProps {
  viewMode: 'online' | 'offline'
  onViewModeChange: (mode: 'online' | 'offline') => void
  onRecenter: () => void
  onLocate: () => void
}

export function MapToolbar({
  viewMode,
  onViewModeChange,
  onRecenter,
  onLocate
}: MapToolbarProps) {
  return (
    <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2">
      {/* 视图模式切换 */}
      <div className="bg-card border border-border rounded-lg shadow-lg p-1">
        <button
          onClick={() => onViewModeChange('online')}
          className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
            viewMode === 'online'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-muted'
          }`}
        >
          <MapPin size={16} />
          在线地图
        </button>
        <button
          onClick={() => onViewModeChange('offline')}
          className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors mt-1 ${
            viewMode === 'offline'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-muted'
          }`}
        >
          <Layers size={16} />
          离线地图
        </button>
      </div>

      {/* 地图控制按钮 */}
      <div className="bg-card border border-border rounded-lg shadow-lg p-1">
        <button
          onClick={onRecenter}
          className="flex items-center justify-center w-10 h-10 rounded-md hover:bg-muted transition-colors"
          title="重新定位"
        >
          <Home size={18} />
        </button>
        <button
          onClick={onLocate}
          className="flex items-center justify-center w-10 h-10 rounded-md hover:bg-muted transition-colors mt-1"
          title="定位到当前位置"
        >
          <Crosshair size={18} />
        </button>
      </div>
    </div>
  )
}
