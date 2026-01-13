/**
 * 图层控制组件 - 树形结构版本
 *
 * 功能:
 * - 树形层级结构展示图层
 * - 支持展开/折叠节点
 * - 在线地图子项：平面地图/卫星地图切换
 * - 工参扇区图: LTE/NR子图层
 * - 图层文件: 外部导入的MapInfo文件
 */
import { useState, useEffect, useRef } from 'react'
import { ChevronDown, ChevronRight, Map, Folder, File, Globe, X, Satellite, Signal, Zap } from 'lucide-react'
import { NetworkType } from '../../config/sector-config'

/**
 * 扇形图标组件
 */
const SectorIcon = ({ color }: { color: string }) => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M7 12L2 5.5C3.5 3.5 10.5 3.5 12 5.5L7 12Z"
      stroke={color}
      strokeWidth="1.5"
      strokeLinejoin="round"
      fill={color}
      fillOpacity="0.2"
    />
  </svg>
)

/**
 * 树节点类型
 */
type TreeNodeType = 'root' | 'sector-group' | 'layer-files' | 'sector-layer' | 'sector-label' | 'layer-file' | 'map-type' | 'frequency' | 'custom-group' | 'custom-layer' | 'point-file-label'

/**
 * 扇区图层选项
 */
export interface SectorLayerOption {
  id: string
  label: string
  type: NetworkType
  visible: boolean
  icon: string
  color: string
}

/**
 * 图层文件选项
 */
export interface LayerFileOption {
  id: string
  name: string
  type: 'point' | 'line' | 'polygon'
  visible: boolean
  dataId: string
  sourceType?: 'mapinfo' | 'excel'
}

/**
 * 自定义图层控制选项 (点/线/面)
 */
export interface CustomLayerOption {
  id: string
  name: string
  type: 'point' | 'line' | 'polygon'
  visible: boolean
}

/**
 * 地图类型选项
 */
export interface MapTypeOption {
  id: 'roadmap' | 'satellite'
  label: string
  visible: boolean
}

/**
 * 频点选项
 */
export interface FrequencyOption {
  frequency: number
  color: string
  strokeColor: string
  visible: boolean
  networkType: NetworkType
}

/**
 * 树节点接口
 */
export interface TreeNode {
  id: string
  type: TreeNodeType
  label: string
  expanded?: boolean
  children?: TreeNode[]
  // 扇区图层专用
  sectorLayer?: SectorLayerOption
  // 扇区标签专用
  sectorLabel?: {
    layerId: string
    visible: boolean
  }
  // 点文件标签专用
  pointFileLabel?: {
    fileId: string
    visible: boolean
  }
  // 图层文件专用
  layerFile?: LayerFileOption
  // 地图类型专用
  mapType?: MapTypeOption
  // 频点专用
  frequency?: FrequencyOption
  // 自定义图层专用
  customLayer?: CustomLayerOption
  // 单选
  radio?: boolean
}

/**
 * 图层控制组件属性
 */
export interface LayerControlProps {
  /** 扇区图层选项 */
  sectors?: SectorLayerOption[]
  /** 外部图层文件 (MapInfo) */
  layerFiles?: LayerFileOption[]
  /** 点图层文件 (Excel) */
  pointFiles?: LayerFileOption[]
  /** 图层可见性变化回调 */
  onSectorToggle?: (layerId: string, visible: boolean) => void
  /** 扇区标签可见性变化回调 */
  onSectorLabelToggle?: (layerId: string, visible: boolean) => void
  /** 图层文件可见性变化回调 */
  onLayerFileToggle?: (fileId: string, visible: boolean) => void
  /** 地图类型变化回调 */
  onMapTypeChange?: (type: 'roadmap' | 'satellite') => void
  /** 当前地图类型 */
  mapType?: 'roadmap' | 'satellite'
  /** 当前扇区标签可见性 */
  sectorLabelVisibility?: Record<string, boolean>
  /** 当前点文件标签可见性 */
  pointFileLabelVisibility?: Record<string, boolean>
  /** 点文件标签可见性变化回调 */
  onPointFileLabelToggle?: (fileId: string, visible: boolean) => void
  /** 频点列表（按网络类型分组） */
  frequencies?: { lte: FrequencyOption[]; nr: FrequencyOption[] }
  /** 频点可见性变化回调 */
  onFrequencyToggle?: (networkType: NetworkType, frequency: number, visible: boolean) => void
  /** 自定义图层 */
  customLayers?: CustomLayerOption[]
  /** 自定义图层可见性变化回调 */
  onCustomLayerToggle?: (layerId: string, visible: boolean) => void
  /** 移除图层文件回调 */
  onLayerFileRemove?: (fileId: string) => void
  /** 移除自定义图层回调 */
  onCustomLayerRemove?: (layerId: string) => void
}

/**
 * 图层控制组件 - 树形结构
 */
export function LayerControl({
  sectors = [],
  layerFiles = [],
  pointFiles = [],
  onSectorToggle,
  onSectorLabelToggle,
  onLayerFileToggle,
  onMapTypeChange,
  mapType = 'roadmap',
  sectorLabelVisibility = {},
  pointFileLabelVisibility = {},
  onPointFileLabelToggle,
  frequencies = { lte: [], nr: [] },
  onFrequencyToggle,
  customLayers = [],
  onCustomLayerToggle,
  onLayerFileRemove,
  onCustomLayerRemove
}: LayerControlProps) {
  // 用户手动切换的展开节点ID集合
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(new Set(['root', 'sector-group', 'custom-group']))

  // 构建树形结构
  const buildTree = (): TreeNode[] => {
    const isExpanded = (id: string, defaultExpanded: boolean) => {
      return expandedNodeIds.has(id) || (defaultExpanded && !expandedNodeIds.has(`collapse-${id}`))
    }

    return [
      {
        id: 'root',
        type: 'root',
        label: '图层控制',
        expanded: isExpanded('root', true),
        children: [
          // 工参扇区图分组
          {
            id: 'sector-group',
            type: 'sector-group',
            label: '工参扇区图',
            expanded: isExpanded('sector-group', true),
            children: sectors.map(sector => {
              // 获取该网络类型的频点列表
              const freqList = sector.type === 'LTE' ? frequencies.lte : frequencies.nr

              return {
                id: sector.id,
                type: 'sector-layer' as TreeNodeType,
                label: sector.label,
                sectorLayer: sector,
                expanded: isExpanded(sector.id, false),
                sectorLabel: {
                  layerId: sector.id,
                  visible: sectorLabelVisibility[sector.id] || false
                },
                // 添加频点子节点
                children: freqList.map(freq => ({
                  id: `${sector.id}-freq-${freq.frequency}`,
                  type: 'frequency' as TreeNodeType,
                  label: `${freq.frequency}`, // 删除 MHz 单位
                  frequency: freq
                }))
              }
            })
          },
          // 图层文件分组 (MapInfo)
          ...(layerFiles.length > 0 ? [
            {
              id: 'layer-files',
              type: 'layer-files' as TreeNodeType,
              label: '图层文件',
              expanded: isExpanded('layer-files', true),
              children: layerFiles.map(file => ({
                id: file.id,
                type: 'layer-file' as TreeNodeType,
                label: file.name,
                layerFile: file
              }))
            }
          ] : []),
          // 创建点图文件分组 (Excel)
          {
            id: 'custom-group',
            type: 'custom-group' as TreeNodeType,
            label: '创建点图文件',
            expanded: isExpanded('custom-group', true),
            children: [
              // 优先显示 pointFiles，为每个文件添加标签子项
              ...pointFiles.map(file => ({
                id: file.id,
                type: 'layer-file' as TreeNodeType,
                label: file.name,
                layerFile: file,
                children: [
                  {
                    id: `${file.id}-label`,
                    type: 'point-file-label' as TreeNodeType,
                    label: '属性标签',
                    pointFileLabel: {
                      fileId: file.id,
                      visible: pointFileLabelVisibility[file.id] || false
                    }
                  }
                ]
              })),
              // 兼容旧的 customLayers (如果有)
              ...customLayers.map(layer => ({
                id: layer.id,
                type: 'custom-layer' as TreeNodeType,
                label: layer.name,
                customLayer: layer
              }))
            ]
          }
        ]
      }
    ]
  }

  const [tree, setTree] = useState<TreeNode[]>(buildTree())

  // 当外部数据变化时更新树
  useEffect(() => {
    setTree(buildTree())
  }, [sectors, layerFiles, pointFiles, mapType, sectorLabelVisibility, pointFileLabelVisibility, frequencies, customLayers])

  /**
   * 切换节点展开状态
   */
  const toggleNode = (nodeId: string) => {
    setExpandedNodeIds(prev => {
      const next = new Set(prev)
      if (next.has(nodeId)) {
        next.delete(nodeId)
        // 记录用户显式折叠了原本默认展开的项
        next.add(`collapse-${nodeId}`)
      } else {
        next.add(nodeId)
        next.delete(`collapse-${nodeId}`)
      }
      return next
    })
  }

  // 当展开状态集合变化时，也触发树的重绘
  useEffect(() => {
    setTree(buildTree())
  }, [expandedNodeIds])


  /**
   * 处理扇区图层切换
   */
  const handleSectorToggle = (layerId: string, visible: boolean) => {
    onSectorToggle?.(layerId, visible)
  }

  /**
   * 处理图层文件切换
   */
  const handleLayerFileToggle = (fileId: string, visible: boolean) => {
    onLayerFileToggle?.(fileId, visible)
  }

  /**
   * 处理地图类型切换
   */// 地图类型变化事件
  const handleMapTypeChange = (type: 'roadmap' | 'satellite') => {
    console.log('[LayerControl] Map type change:', type)
    onMapTypeChange?.(type)
  }

  // 添加显示/隐藏状态管理
  const [isVisible, setIsVisible] = useState(true)

  // 控件悬停状态
  const [isControlHovered, setIsControlHovered] = useState(false)

  // 面板引用
  const panelRef = useRef<HTMLDivElement>(null)

  // 面板宽度状态
  const [panelWidth, setPanelWidth] = useState(220)
  const isResizing = useRef(false)
  const startX = useRef(0)
  const startWidth = useRef(0)

  // 计算控件的水平位置 - 控件右侧与面板左侧对齐
  const controlRight = isVisible ? `${panelWidth}px` : '0px' // 面板显示时在面板外侧对齐，隐藏时贴窗口右边缘

  // 开始调整大小
  const startResize = (e: React.MouseEvent) => {
    isResizing.current = true
    startX.current = e.clientX
    startWidth.current = panelWidth
    
    document.addEventListener('mousemove', doResize)
    document.addEventListener('mouseup', stopResize)
    document.body.style.userSelect = 'none' // 防止拖动时选中文本
  }

  // 执行调整大小
  const doResize = (e: MouseEvent) => {
    if (!isResizing.current) return
    // 面板在右侧，向左拖动（X减小）增加宽度
    const delta = startX.current - e.clientX
    const newWidth = Math.max(200, Math.min(500, startWidth.current + delta))
    setPanelWidth(newWidth)
  }

  // 停止调整大小
  const stopResize = () => {
    isResizing.current = false
    document.removeEventListener('mousemove', doResize)
    document.removeEventListener('mouseup', stopResize)
    document.body.style.userSelect = ''
  }

  // 全局右键菜单状态
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, nodeId: string, type: string } | null>(null)

  // 处理右键点击
  const handleContextMenu = (e: React.MouseEvent, node: TreeNode) => {
    // 只有图层文件和自定义图层支持右键卸载
    if (node.type === 'layer-file' || node.type === 'custom-layer') {
      e.preventDefault()
      e.stopPropagation()
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        nodeId: node.id,
        type: node.type
      })
    }
  }

  // 关闭右键菜单
  useEffect(() => {
    const handleGlobalClick = () => setContextMenu(null)
    if (contextMenu) {
      window.addEventListener('click', handleGlobalClick)
    }
    return () => window.removeEventListener('click', handleGlobalClick)
  }, [contextMenu])

  return (
    <>
      <style>{`
        /* 隐藏面板滚动条 */
        .layer-control::-webkit-scrollbar {
          display: none; /* Chrome/Safari/Opera */
        }
        .layer-control {
          -ms-overflow-style: none; /* IE/Edge */
          scrollbar-width: none; /* Firefox */
        }
        /* 隐藏地图容器滚动条 */
        .map-container::-webkit-scrollbar {
          display: none;
        }
        .map-container {
          -ms-overflow-style: none;
          scrollbar-width: none;
          overflow: hidden !important;
        }
      `}</style>
      {/* 显示/隐藏控件 - 融合在面板左侧边缘中部，始终可见 */}
      <div
        onClick={() => setIsVisible(!isVisible)}
        onMouseEnter={() => setIsControlHovered(true)}
        onMouseLeave={() => setIsControlHovered(false)}
        style={{
          position: 'absolute',
          top: '50%', // 使用 50% 定位到面板垂直中心
          transform: isControlHovered ? 'translateY(-50%) scale(1.15)' : 'translateY(-50%)', // 悬停时放大
          right: controlRight,
          zIndex: 1001,
          backgroundColor: isControlHovered ? 'rgba(59, 130, 246, 0.95)' : 'rgba(245, 245, 245, 0.95)', // 悬停时变蓝色
          backdropFilter: 'blur(8px)',
          borderRadius: '6px',
          boxShadow: isControlHovered ? '0 4px 12px rgba(59, 130, 246, 0.4)' : '0 2px 8px rgba(0, 0, 0, 0.15)', // 悬停时阴影变强
          width: '28px',
          height: '28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          fontSize: '14px',
          color: isControlHovered ? '#ffffff' : '#3b82f6', // 悬停时文字变白色
          fontWeight: 'bold',
          border: isControlHovered ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid rgba(0, 0, 0, 0.1)',
          transition: isResizing.current ? 'none' : 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)', // 使用缓动函数
        }}
      >
        ⇋
      </div>

      {/* 图层控制面板 - 顶部拉伸至窗口顶部 */}
      <div
        ref={panelRef}
        className="layer-control"
        style={{
          position: 'absolute',
          top: '0px', // 拉伸至窗口顶部
          right: isVisible ? '0px' : `-${panelWidth}px`,
          zIndex: 1000,
          backgroundColor: 'rgba(245, 245, 245, 0.95)', // 偏灰色的背景
          backdropFilter: 'blur(8px)',
          borderRadius: '0 0 0 16px',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
          width: `${panelWidth}px`,
          minWidth: '200px',
          height: '100vh', // 纵向布满整个窗口高度
          overflowY: 'auto', // 启用纵向滚动
          overflowX: 'hidden',
          fontSize: '13px',
          border: '1px solid rgba(0, 0, 0, 0.1)',
          borderRight: 'none',
          borderTop: 'none',
          padding: '4px',
          transition: isResizing.current ? 'none' : 'all 0.3s ease',
        }}
      >
        {/* 拖动调整手柄 */}
        <div
          onMouseDown={startResize}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: '6px',
            cursor: 'ew-resize',
            zIndex: 10,
            backgroundColor: 'transparent',
          }}
          title="拖动调整宽度"
        />

        {/* 渲染树 */}
        {tree.map(rootNode => (
          <TreeNodeComponent
            key={rootNode.id}
            node={rootNode}
            level={0}
            onToggle={toggleNode}
            onSectorToggle={handleSectorToggle}
            onSectorLabelToggle={onSectorLabelToggle}
            onLayerFileToggle={handleLayerFileToggle}
            onMapTypeChange={handleMapTypeChange}
            onFrequencyToggle={onFrequencyToggle}
            onCustomLayerToggle={onCustomLayerToggle}
            onLayerFileRemove={onLayerFileRemove}
            onCustomLayerRemove={onCustomLayerRemove}
            onPointFileLabelToggle={onPointFileLabelToggle}
            onContextMenu={handleContextMenu}
            mapType={mapType}
          />
        ))}
      </div>

      {/* 右键菜单 - 放在面板外部以避免被裁剪或出现滚动条 */}
      {contextMenu && (
        <div
          style={{
            position: 'fixed',
            left: contextMenu.x,
            top: contextMenu.y,
            zIndex: 10000,
            backgroundColor: 'white',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            border: '1px solid #e2e8f0',
            padding: '4px',
            minWidth: '100px'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              if (contextMenu.type === 'layer-file') {
                onLayerFileRemove?.(contextMenu.nodeId)
              } else if (contextMenu.type === 'custom-layer') {
                onCustomLayerRemove?.(contextMenu.nodeId)
              }
              setContextMenu(null)
            }}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 12px',
              fontSize: '12px',
              color: '#ef4444',
              cursor: 'pointer',
              border: 'none',
              backgroundColor: 'transparent',
              textAlign: 'left',
              borderRadius: '4px'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#fff1f2')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <X size={14} />
            <span>卸载图层</span>
          </button>
        </div>
      )}
    </>
  )
}

/**
 * 树节点组件属性接口
 */
interface TreeNodeComponentProps {
  node: TreeNode;
  level: number;
  onToggle: (nodeId: string) => void;
  onSectorToggle: (layerId: string, visible: boolean) => void;
  onSectorLabelToggle?: (layerId: string, visible: boolean) => void;
  onLayerFileToggle: (fileId: string, visible: boolean) => void;
  onMapTypeChange: (type: 'roadmap' | 'satellite') => void;
  onFrequencyToggle?: (networkType: NetworkType, frequency: number, visible: boolean) => void;
  onCustomLayerToggle?: (layerId: string, visible: boolean) => void;
  onLayerFileRemove?: (fileId: string) => void;
  onCustomLayerRemove?: (layerId: string) => void;
  onPointFileLabelToggle?: (fileId: string, visible: boolean) => void;
  onContextMenu: (e: React.MouseEvent, node: TreeNode) => void;
  mapType: 'roadmap' | 'satellite';
}

/**
 * 树节点组件
 */
function TreeNodeComponent({
  node,
  level,
  onToggle,
  onSectorToggle,
  onSectorLabelToggle,
  onLayerFileToggle,
  onMapTypeChange,
  onFrequencyToggle,
  onCustomLayerToggle,
  onLayerFileRemove,
  onCustomLayerRemove,
  onPointFileLabelToggle,
  onContextMenu,
  mapType
}: TreeNodeComponentProps) {
  const getIndent = () => {
    // 根据层级添加缩进：每级 16px
    const basePadding = 4
    const indentPerLevel = 16
    const paddingLeft = basePadding + (level * indentPerLevel)
    return { paddingLeft: `${paddingLeft}px` }
  }

  /**
   * 渲染树形连线
   */
  const renderTreeLines = () => {
    if (level === 0 || node.type === 'root') return null

    const lineColor = 'rgba(0, 0, 0, 0.15)'
    const lines = []

    // 为每个层级绘制竖线
    for (let i = 0; i < level; i++) {
      const leftPos = 4 + (i * 16) + 8 // 4px base + level * 16px + 8px center
      lines.push(
        <div
          key={`line-${i}`}
          style={{
            position: 'absolute',
            left: `${leftPos}px`,
            top: 0,
            bottom: 0,
            width: '1px',
            backgroundColor: lineColor,
            pointerEvents: 'none'
          }}
        />
      )
    }

    // 绘制当前节点的横线连接线
    const lastLineLeft = 4 + ((level - 1) * 16) + 8
    lines.push(
      <div
        key="horizontal-line"
        style={{
          position: 'absolute',
          left: `${lastLineLeft}px`,
          top: '50%',
          width: '8px',
          height: '1px',
          backgroundColor: lineColor,
          pointerEvents: 'none'
        }}
      />
    )

    return lines
  }

  const getNodeIcon = () => {
    // 根据需求，删除特定节点类型的图标，只保留文字
    switch (node.type) {
      case 'root':
        return null
      case 'map-type':
        if (node.mapType?.id === 'roadmap') return <Map size={14} color="#666" />
        if (node.mapType?.id === 'satellite') return <Satellite size={14} color="#666" />
        return null
      case 'sector-layer':
        if (node.sectorLayer?.type === 'LTE') return <SectorIcon color="#3b82f6" />
        if (node.sectorLayer?.type === 'NR') return <SectorIcon color="#10b981" />
        return <SectorIcon color="#666" />
      case 'sector-group':
        return <Map size={14} color="#666" />
      case 'layer-files':
        return <Folder size={14} color="#999" />
      case 'sector-label':
        return <span style={{ fontSize: '14px' }}>📝</span>
      case 'point-file-label':
        return <span style={{ fontSize: '14px' }}>🏷️</span>
      case 'layer-file':
        return <File size={12} color="#999" />
      case 'custom-group':
        return <Folder size={14} color="#3b82f6" />
      case 'custom-layer':
        return <File size={12} color="#3b82f6" />
      default:
        return null
    }
  }

  const isExpandable = node.children && node.children.length > 0
  const isExpanded = node.expanded

  const handleClick = () => {
    if (isExpandable) {
      onToggle(node.id)
    }
  }

  return (
    <div style={{ position: 'relative' }}>
      {/* 节点行 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          padding: '8px 10px',
          cursor: node.type === 'root' ? 'default' : (isExpandable ? 'pointer' : 'default'),
          userSelect: 'none',
          borderBottom: '1px solid rgba(0, 0, 0, 0.1)',
          backgroundColor: node.type === 'root' ? 'rgba(0, 0, 0, 0.08)' : 'transparent',
          borderRadius: '0',
          border: 'none',
          boxShadow: 'none',
          gap: node.type === 'frequency' ? '4px' : '6px', // 频点项间距更小
          height: node.type === 'frequency' ? '24px' : '32px', // 频点项行高更小
          lineHeight: node.type === 'frequency' ? '24px' : '32px',
          position: 'relative',
          ...getIndent()
        }}
        onClick={node.type === 'root' ? undefined : handleClick}
        onContextMenu={(e) => onContextMenu(e, node)}
        onMouseEnter={(e) => {
          if (node.type !== 'root' && isExpandable) {
            e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.05)'
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = node.type === 'root' ? 'rgba(0, 0, 0, 0.08)' : 'transparent'
        }}
      >
        {/* 树形连线 */}
        {renderTreeLines()}

        {/* 展开/折叠图标 - root 节点不显示 */}
        {node.type !== 'root' && (
          <>
            {isExpandable ? (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '16px' }}>
                {isExpanded ? (
                  <ChevronDown size={12} color="#999" />
                ) : (
                  <ChevronRight size={12} color="#999" />
                )}
              </span>
            ) : (
              <span style={{ width: '16px' }} />
            )}
          </>
        )}

        {/* 节点图标 */}
        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '16px' }}>
          {getNodeIcon()}
        </span>

        {/* 节点标签 */}
        <span
          title={node.label}
          style={{
            flex: 1,
            color: node.type === 'root' ? '#333' : '#666',
            fontWeight: (() => {
              // 根节点保持加粗
              if (node.type === 'root') return 500

              // 扇区图层
              if (node.type === 'sector-layer' && node.sectorLayer) {
                return node.sectorLayer.visible ? 600 : 400
              }

              // 图层文件
              if (node.type === 'layer-file' && node.layerFile) {
                return node.layerFile.visible ? 600 : 400
              }

              // 自定义图层
              if (node.type === 'custom-layer' && node.customLayer) {
                return node.customLayer.visible ? 600 : 400
              }

              // 频点
              if (node.type === 'frequency' && node.frequency) {
                return node.frequency.visible ? 600 : 400
              }

              // 点文件标签
              if (node.type === 'point-file-label' && node.pointFileLabel) {
                return node.pointFileLabel.visible ? 600 : 400
              }

              // 其他类型保持正常
              return 400
            })(),
            textAlign: node.type === 'root' ? 'center' : 'left',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}
        >
          {node.label}
        </span>

        {/* 地图类型子节点已隐藏，改用按钮组切换 */}
        {node.type === 'map-type' && false && node.mapType && (
          <MapTypeRadio
            option={node.mapType}
            onToggle={() => onMapTypeChange(node.mapType!.id)}
          />
        )}

        {/* 扇区图层 - 复选框 */}
        {node.type === 'sector-layer' && node.sectorLayer && (
          <SectorLayerCheckbox
            layer={node.sectorLayer}
            onToggle={(visible) => onSectorToggle(node.sectorLayer!.id, visible)}
            isChecked={node.sectorLayer.visible}
          />
        )}

        {/* 扇区标签 - 标签图标样式控件（如果是扇区图层节点且有标签配置） */}
        {node.type === 'sector-layer' && node.sectorLayer && node.sectorLabel && (
          <div
            onClick={(e) => {
              e.stopPropagation()
              // 使用可选链和空值合并操作符确保类型安全
              const currentVisible = node.sectorLabel?.visible ?? false
              const newVisible = !currentVisible
              const layerId = node.sectorLabel?.layerId ?? ''
              console.log('[LayerControl] Sector label toggle:', layerId, newVisible)
              onSectorLabelToggle?.(layerId, newVisible)
            }}
            style={{
              width: '20px',
              height: '20px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {/* 标签图标 - 显示为图1样式，不显示为图2样式 */}
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* 标签形状 */}
              <path
                d="M10 3L17 5V15L10 17L3 15V5L10 3Z"
                fill={node.sectorLabel.visible ? '#3b82f6' : '#e0e0e0'}
                stroke={node.sectorLabel.visible ? '#2563eb' : '#bdbdbd'}
                strokeWidth="1.5"
              />
              {/* 标签孔 */}
              <circle
                cx="10"
                cy="4.5"
                r="1.5"
                fill={node.sectorLabel.visible ? '#ffffff' : '#f5f5f5'}
                stroke={node.sectorLabel.visible ? '#2563eb' : '#bdbdbd'}
                strokeWidth="1.5"
              />
              {/* 标签上的线条 */}
              <line
                x1="7"
                y1="9"
                x2="13"
                y2="9"
                stroke={node.sectorLabel.visible ? '#ffffff' : '#bdbdbd'}
                strokeWidth="2"
                strokeLinecap="round"
              />
              <line
                x1="7"
                y1="12"
                x2="13"
                y2="12"
                stroke={node.sectorLabel.visible ? '#ffffff' : '#bdbdbd'}
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </div>
        )}

        {/* 图层文件 - 复选框 */}
        {node.type === 'layer-file' && node.layerFile && (
          <LayerFileCheckbox
            file={node.layerFile}
            onToggle={(visible) => onLayerFileToggle(node.layerFile!.id, visible)}
          />
        )}

        {/* 点文件标签 - 标签图标样式控件 */}
        {node.type === 'point-file-label' && node.pointFileLabel && (
          <div
            onClick={(e) => {
              e.stopPropagation()
              const currentVisible = node.pointFileLabel?.visible ?? false
              const newVisible = !currentVisible
              const fileId = node.pointFileLabel?.fileId ?? ''
              console.log('[LayerControl] Point file label toggle:', fileId, newVisible)
              onPointFileLabelToggle?.(fileId, newVisible)
            }}
            style={{
              width: '20px',
              height: '20px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {/* 标签图标 */}
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* 标签形状 */}
              <path
                d="M10 3L17 5V15L10 17L3 15V5L10 3Z"
                fill={node.pointFileLabel.visible ? '#3b82f6' : '#e0e0e0'}
                stroke={node.pointFileLabel.visible ? '#2563eb' : '#bdbdbd'}
                strokeWidth="1.5"
              />
              {/* 标签孔 */}
              <circle
                cx="10"
                cy="4.5"
                r="1.5"
                fill={node.pointFileLabel.visible ? '#ffffff' : '#f5f5f5'}
                stroke={node.pointFileLabel.visible ? '#2563eb' : '#bdbdbd'}
                strokeWidth="1.5"
              />
              {/* 标签上的线条 */}
              <line
                x1="7"
                y1="9"
                x2="13"
                y2="9"
                stroke={node.pointFileLabel.visible ? '#ffffff' : '#bdbdbd'}
                strokeWidth="2"
                strokeLinecap="round"
              />
              <line
                x1="7"
                y1="12"
                x2="13"
                y2="12"
                stroke={node.pointFileLabel.visible ? '#ffffff' : '#bdbdbd'}
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </div>
        )}

        {/* 频点 - 颜色方块 + 复选框 */}
        {node.type === 'frequency' && node.frequency && (
          <FrequencyCheckbox
            frequency={node.frequency}
            onToggle={(visible: boolean) => onFrequencyToggle?.(
              node.frequency!.networkType,
              node.frequency!.frequency,
              visible
            )}
          />
        )}

        {/* 自定义图层 - 复选框 */}
        {node.type === 'custom-layer' && node.customLayer && (
          <CustomLayerCheckbox
            layer={node.customLayer}
            onToggle={(visible: boolean) => onCustomLayerToggle?.(node.customLayer!.id, visible)}
          />
        )}
      </div>

      {/* 子节点 */}
      {isExpandable && isExpanded && node.children && (
        <div>
          {node.children.filter(child => child.type !== 'map-type').map(child => (
            <TreeNodeComponent
              key={child.id}
              node={child}
              level={level + 1}
              onToggle={onToggle}
              onSectorToggle={onSectorToggle}
              onSectorLabelToggle={onSectorLabelToggle}
              onLayerFileToggle={onLayerFileToggle}
              onMapTypeChange={onMapTypeChange}
              onFrequencyToggle={onFrequencyToggle}
              onCustomLayerToggle={onCustomLayerToggle}
              onLayerFileRemove={onLayerFileRemove}
              onCustomLayerRemove={onCustomLayerRemove}
              onPointFileLabelToggle={onPointFileLabelToggle}
              onContextMenu={onContextMenu}
              mapType={mapType}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * 地图类型单选按钮组件
 */
interface MapTypeRadioProps {
  option: MapTypeOption;
  onToggle: () => void;
}

/**
 * 地图类型单选按钮组件
 */
function MapTypeRadio({ option, onToggle }: MapTypeRadioProps) {
  return (
    <div
      onClick={onToggle}
      style={{
        width: '16px',
        height: '16px',
        border: option.visible ? '#3b82f6 solid 2px' : 'rgba(0, 0, 0, 0.2) solid 2px',
        borderRadius: '50%',
        backgroundColor: option.visible ? '#3b82f6' : 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        transition: 'all 0.2s ease'
      }}
    >
      {option.visible && (
        <div
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: 'white'
          }}
        />
      )}
    </div>
  );
}

/**
 * 扇区图层复选框组件
 */
interface SectorLayerCheckboxProps {
  layer: SectorLayerOption;
  onToggle: (visible: boolean) => void;
  isChecked?: boolean;
}

/**
 * 扇区图层复选框组件
 */
function SectorLayerCheckbox({ layer, onToggle, isChecked: externalChecked }: SectorLayerCheckboxProps) {
  const [isChecked, setIsChecked] = useState(externalChecked ?? layer.visible);

  useEffect(() => {
    setIsChecked(externalChecked ?? layer.visible);
  }, [layer.visible, externalChecked]);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newValue = !isChecked;
    setIsChecked(newValue);
    onToggle(newValue);
  };

  return (
    <div
      onClick={handleToggle}
      style={{
        width: '16px',
        height: '16px',
        marginLeft: '8px',
        border: isChecked ? `${layer.color} solid 2px` : 'rgba(0, 0, 0, 0.2) solid 2px',
        borderRadius: '5px',
        backgroundColor: isChecked ? layer.color : 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        transition: 'all 0.2s ease'
      }}
    >
      {isChecked && (
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M1 4L3.5 6.5L9 1"
            stroke="white"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </div>
  );
}

/**
 * 图层文件复选框组件
 */
interface LayerFileCheckboxProps {
  file: LayerFileOption;
  onToggle: (visible: boolean) => void;
}

/**
 * 图层文件复选框组件
 */
function LayerFileCheckbox({ file, onToggle }: LayerFileCheckboxProps) {
  const [isChecked, setIsChecked] = useState(file.visible);

  useEffect(() => {
    setIsChecked(file.visible);
  }, [file.visible]);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newValue = !isChecked;
    setIsChecked(newValue);
    onToggle(newValue);
  };

  const getFileColor = () => {
    switch (file.type) {
      case 'point': return '#f59e0b';
      case 'line': return '#8b5cf6';
      case 'polygon': return '#10b981';
      default: return '#6b7280';
    }
  };

  const color = getFileColor();

  return (
    <div
      onClick={handleToggle}
      style={{
        width: '16px',
        height: '16px',
        border: isChecked ? `${color} solid 2px` : 'rgba(0, 0, 0, 0.2) solid 2px',
        borderRadius: '5px',
        backgroundColor: isChecked ? color : 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        transition: 'all 0.2s ease'
      }}
    >
      {isChecked && (
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M1 4L3.5 6.5L9 1"
            stroke="white"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </div>
  );
}

/**
 * 频点复选框组件属性接口
 */
interface FrequencyCheckboxProps {
  frequency: FrequencyOption;
  onToggle: (visible: boolean) => void;
}

/**
 * 频点复选框组件
 * 显示频点颜色方块和复选框
 */
function FrequencyCheckbox({ frequency, onToggle }: FrequencyCheckboxProps) {
  const [isChecked, setIsChecked] = useState(frequency.visible);

  useEffect(() => {
    setIsChecked(frequency.visible);
  }, [frequency.visible]);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newValue = !isChecked;
    setIsChecked(newValue);
    onToggle(newValue);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      {/* 颜色方块 */}
      <div
        style={{
          width: '12px',
          height: '12px',
          backgroundColor: frequency.color,
          border: `1px solid ${frequency.strokeColor}`,
          borderRadius: '2px'
        }}
      />

      {/* 复选框 */}
      <div
        onClick={handleToggle}
        style={{
          width: '16px',
          height: '16px',
          border: isChecked ? `${frequency.color} solid 2px` : 'rgba(0, 0, 0, 0.2) solid 2px',
          borderRadius: '5px',
          backgroundColor: isChecked ? frequency.color : 'transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          transition: 'all 0.2s ease'
        }}
      >
        {isChecked && (
          <svg
            width="10"
            height="10"
            viewBox="0 0 10 10"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M1 4L3.5 6.5L9 1"
              stroke="white"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>
    </div>
  );
}

/**
 * 旧的图层选项接口（向后兼容）
 */
export interface LayerOption {
  id: string
  label: string
  type: NetworkType
  visible: boolean
  icon: string
  color: string
}

/**
 * 默认图层配置（向后兼容）
 */
export function createDefaultLayers(): LayerOption[] {
  return [
    {
      id: 'lte-sectors',
      label: 'LTE扇区',
      type: 'LTE',
      visible: false,
      icon: '📡',
      color: '#3b82f6'
    },
    {
      id: 'nr-sectors',
      label: 'NR扇区',
      type: 'NR',
      visible: false,
      icon: '📶',
      color: '#10b981'
    }
  ]
}

/**
 * 自定义图层复选框组件
 */
function CustomLayerCheckbox({ layer, onToggle }: { layer: CustomLayerOption; onToggle: (visible: boolean) => void }) {
  const [isChecked, setIsChecked] = useState(layer.visible);

  useEffect(() => {
    setIsChecked(layer.visible);
  }, [layer.visible]);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newValue = !isChecked;
    setIsChecked(newValue);
    onToggle(newValue);
  };

  const getColor = () => {
    switch (layer.type) {
      case 'point': return '#ef4444';
      case 'line': return '#3b82f6';
      case 'polygon': return '#10b981';
      default: return '#6b7280';
    }
  };

  const color = getColor();

  return (
    <div
      onClick={handleToggle}
      style={{
        width: '16px',
        height: '16px',
        border: isChecked ? `${color} solid 2px` : 'rgba(0, 0, 0, 0.2) solid 2px',
        borderRadius: '5px',
        backgroundColor: isChecked ? color : 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        transition: 'all 0.2s ease'
      }}
    >
      {isChecked && (
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  );
}