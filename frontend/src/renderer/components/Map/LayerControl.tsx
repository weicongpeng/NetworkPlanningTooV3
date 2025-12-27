/**
 * 图层控制组件
 */
import { useState } from 'react'
import { Layers, Eye, EyeOff } from 'lucide-react'

interface Layer {
  id: string
  name: string
  type: 'sites' | 'sectors' | 'coverage' | 'neighbors' | 'conflicts'
  visible: boolean
  color?: string
}

interface LayerControlProps {
  layers: Layer[]
  onToggleLayer: (layerId: string) => void
}

export function LayerControl({ layers, onToggleLayer }: LayerControlProps) {
  return (
    <div className="absolute top-4 left-4 z-[1000] w-64 bg-card border border-border rounded-lg shadow-lg">
      <div className="flex items-center gap-2 p-3 border-b border-border">
        <Layers size={18} />
        <h3 className="font-semibold text-sm">图层控制</h3>
      </div>

      <div className="p-2 space-y-1 max-h-96 overflow-y-auto">
        {layers.map(layer => (
          <button
            key={layer.id}
            onClick={() => onToggleLayer(layer.id)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-md hover:bg-muted transition-colors"
          >
            <div className="flex items-center gap-2">
              {layer.color && (
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: layer.color }}
                />
              )}
              <span className="text-sm">{layer.name}</span>
            </div>
            {layer.visible ? (
              <Eye size={16} className="text-primary" />
            ) : (
              <EyeOff size={16} className="text-muted-foreground" />
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
