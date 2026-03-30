import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { Play, Download, Loader2, AlertCircle, CheckCircle2, FileSpreadsheet, Search, GripVertical } from 'lucide-react'
import { tacApi } from '../services/api'
import { useTACStore } from '../store/tacStore'
import { OnlineMap } from '../components/Map/OnlineMap'
import { TACLegend } from '../components/Map/TACLegend'
import { tacDataSyncService } from '../services/tacDataSyncService'
import { tacColorMapper } from '../utils/tacColors'
import type { OnlineMapRef } from '../components/Map/OnlineMap'
import { mapDataService } from '../services/mapDataService'
import { DATA_REFRESH_EVENT } from '../store/dataStore'
import { useTranslation } from 'react-i18next'

// 虚拟滚动配置
const ITEM_HEIGHT = 48 // 每行高度
const VISIBLE_COUNT = 20 // 可见行数
const BUFFER_COUNT = 5 // 缓冲行数

// TAC核查表格列配置
const COLUMNS = [
  { key: 'firstGroup', label: '运营商/厂家', defaultWidth: 100 },
  { key: 'siteId', label: '站点ID', defaultWidth: 80 },
  { key: 'siteName', label: '站点名称', defaultWidth: 150 },
  { key: 'sectorId', label: '小区ID', defaultWidth: 70 },
  { key: 'sectorName', label: '小区名称', defaultWidth: 200 },
  { key: 'networkType', label: '网络类型', defaultWidth: 70 },
  { key: 'longitude', label: '经度', defaultWidth: 90 },
  { key: 'latitude', label: '纬度', defaultWidth: 90 },
  { key: 'tac', label: '图层TAC', defaultWidth: 70 },
  { key: 'existingTac', label: '现网TAC', defaultWidth: 70 },
  { key: 'tacConsistent', label: 'TAC是否一致', defaultWidth: 80 },
  { key: 'isSingularity', label: 'TAC是否插花', defaultWidth: 90 },
  { key: 'suggestedTac', label: 'TAC建议值', defaultWidth: 100 },
  { key: 'matched', label: '匹配状态', defaultWidth: 70 }
] as const

// TAC值标准化辅助函数（去除空格、前导零）
const normalizeTac = (tac: string): string => {
  return tac.toString().trim().replace(/^0+/, '') || '0'
}
interface TACResultData {
  taskId: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: number
  networkType?: 'LTE' | 'NR'
  totalCells: number
  matchedCells: number
  unmatchedCells: number
  mismatchedCells: number
  mismatchedRate: number
  singularityCount?: number  // TAC插花数量
  results: any[]
  startTime: string
  endTime?: string
  error?: string
  exportPath?: string
}

const MAX_ERRORS = 5

export function TACPage() {
  const { t } = useTranslation()
  const { taskId, config, result, setTaskId, setConfig, setResult, clearTAC } = useTACStore()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const taskResult = result as TACResultData | null

  // 插花检测配置状态
  const [singularityConfig, setSingularityConfig] = useState({
    searchRadius: 1500,
    singularityThreshold: 0.5,
  })

  // 地图相关状态
  const mapRef = useRef<OnlineMapRef>(null)
  const [isLegendVisible, setIsLegendVisible] = useState(true)
  const [selectedSectorKey, setSelectedSectorKey] = useState<string | null>(null)

  // 页面加载时检查任务是否仍然存在，如果不存在则清除状态
  useEffect(() => {
    const checkTaskExists = async () => {
      if (taskId && result?.status === 'processing') {
        try {
          await tacApi.getProgress(taskId)
          // 如果任务存在，不进行任何操作，轮询 useEffect 会继续处理
        } catch (err: any) {
          // 如果任务不存在（404）或其他错误，清除状态
          console.log('任务已不存在，清除TAC状态')
          clearTAC()
          setError(null)
        }
      }
    }

    checkTaskExists()
  }, [])

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const errorCountRef = useRef(0)
  const isPollingActiveRef = useRef(false)

  // 轮询任务进度 - 统一管理轮询生命周期
  useEffect(() => {
    // 如果没有任务ID或任务已完成，不启动轮询
    if (!taskId || taskResult?.status === 'completed' || taskResult?.status === 'failed') {
      return
    }

    // 避免重复启动轮询
    if (isPollingActiveRef.current) {
      return
    }

    isPollingActiveRef.current = true

    // 每2秒轮询一次任务进度
    pollingIntervalRef.current = setInterval(async () => {
      // 检查任务是否已完成
      if (taskResult?.status === 'completed' || taskResult?.status === 'failed') {
        stopPolling()
        return
      }

      try {
        const response = await tacApi.getProgress(taskId)
        if (response.success && response.data) {
          setResult({
            ...response.data,
            exportPath: taskResult?.exportPath
          })

          // 任务完成或失败，停止轮询
          if (response.data.status === 'completed' || response.data.status === 'failed') {
            stopPolling()
          }
        }
      } catch (err: any) {
        errorCountRef.current++
        console.error('轮询TAC核查进度失败:', err)

        // 如果任务不存在（404），清除状态并停止轮询
        if (err.code === 404 || err.message?.includes('任务不存在')) {
          stopPolling()
          clearTAC()
          setError(null)
          console.log('任务已不存在，已清除TAC状态')
          return
        }

        // 连续失败5次则停止轮询
        if (errorCountRef.current >= MAX_ERRORS) {
          stopPolling()
          setError(t('tac.getProgressFailed') || '获取任务进度失败，请刷新页面重试')
        }
      }
    }, 2000)

    // 统一的停止轮询函数
    function stopPolling() {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
        pollingIntervalRef.current = null
      }
      isPollingActiveRef.current = false
    }

    // 组件卸载或依赖变化时清理
    return () => {
      stopPolling()
    }
  }, [taskId, taskResult?.status, setResult, clearTAC])

  // 初始化TAC数据同步服务
  useEffect(() => {
    const initMapServices = async () => {
      try {
        await tacDataSyncService.initialize()
        // 初始化完成后刷新地图数据
        if (mapRef.current) {
          await mapRef.current.refreshData()
        }
      } catch (error) {
        console.error('Failed to initialize TAC services:', error)
      }
    }

    // 监听数据刷新事件（当在其他页面上传新工参时）
    const handleDataRefresh = async () => {
      console.log('[TACPage] 收到数据刷新事件，正在重新初始化...')
      try {
        // 1. 清除前端地图数据缓存
        mapDataService.clearCache()
        console.log('[TACPage] 已清除前端地图数据缓存')

        // 2. 清除后端地图数据缓存
        await mapApi.clearCache()
        console.log('[TACPage] 已清除后端地图数据缓存')

        // 3. 重新初始化TAC数据同步服务，获取最新全量工参数据
        await initMapServices()
        console.log('[TACPage] 数据同步服务已重新初始化')
      } catch (error) {
        console.warn('[TACPage] 数据刷新失败:', error)
      }
    }

    window.addEventListener(DATA_REFRESH_EVENT, handleDataRefresh)

    initMapServices()

    return () => {
      window.removeEventListener(DATA_REFRESH_EVENT, handleDataRefresh)
    }
  }, [])

  // TAC结果加载后同步到数据服务，并触发地图全量加载
  useEffect(() => {
    if (taskResult?.status === 'completed' && taskResult.results) {
      console.log('[TACPage] 任务完成，同步数据并初始化地图')
      const taskNetworkType = taskResult.networkType || config?.networkType || 'LTE'

      // 预加载所有TAC颜色，确保图例能立即显示
      const uniqueTACs = new Set<string>()
      taskResult.results.forEach((cell: any) => {
        if (cell.tac) uniqueTACs.add(String(cell.tac))
        if (cell.existingTac) uniqueTACs.add(String(cell.existingTac))
      })
      console.log('[TACPage] 预加载TAC颜色', { count: uniqueTACs.size, networkType: taskNetworkType })
      uniqueTACs.forEach(tac => {
        tacColorMapper.getColor(tac, taskNetworkType)
      })

      tacDataSyncService.setTACResults({
        results: taskResult.results,
        singularityCount: taskResult.singularityCount || 0
      })

      // 任务完成，通知地图加载TAC同步后的全量数据
      // 传入 null 表示不进行具体的小区过滤（显示全部），但传入网络类型只加载该网络类型
      if (mapRef.current) {
        console.log('[TACPage] 加载TAC地图数据', { networkType: taskNetworkType })
        mapRef.current.setSectorIdWhitelist(null, 'tac-check', taskNetworkType)
      }
    }
  }, [taskResult?.status, taskResult?.results])

  // 地图扇区点击处理
  const handleMapSectorClick = (sector: any) => {
    console.log('Map sector clicked:', sector)
  }

  // 结果行点击处理
  const handleResultRowClick = (cell: any) => {
    const siteId = cell.siteId
    const sectorId = cell.sectorId

    // 更新选中状态（用于表格高亮）
    const sectorKey = `${siteId}-${sectorId}`
    setSelectedSectorKey(sectorKey)

    // 查找同步后的扇区
    const syncedSector = tacDataSyncService.findSector(siteId, sectorId)
    if (!syncedSector) {
      console.warn('[TACPage] 未找到同步后的扇区:', siteId, sectorId)
      return
    }

    // 简化：只设置高亮模式和跳转地图，不设置白名单
    const cellNetworkType = cell.networkType || taskResult?.networkType || 'LTE'
    mapRef.current?.setTACHighlightMode({
      selectedId: syncedSector.id,
      isSingularity: cell.isSingularity,
      tacValue: cell.existingTac || cell.tac,
      networkType: cellNetworkType
    })

    // 跳转地图到该小区位置
    const coords = [syncedSector.displayLat || syncedSector.latitude, syncedSector.displayLng || syncedSector.longitude]
    mapRef.current?.flyTo(coords as [number, number], 16, 0)

    console.log('[TACPage] 点击结果行，跳转地图', {
      siteId,
      sectorId,
      coords,
      tac: cell.existingTac || cell.tac,
      isSingularity: cell.isSingularity
    })
  }

  const handleStartPlanning = async () => {
    if (!config?.networkType) {
      setError(t('tac.selectNetworkType') || '请选择网络类型')
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)
    clearTAC()
    errorCountRef.current = 0

    try {
      // 构建完整的TAC配置（包含插花检测配置）
      const fullConfig = {
        networkType: config!.networkType,
        enableSingularityCheck: true,
        singularityConfig: singularityConfig,
      }

      const response = await tacApi.plan(fullConfig)
      if (response.success && response.data) {
        const newTaskId = response.data.taskId
        setTaskId(newTaskId)

        // 初始获取任务状态
        const progressResponse = await tacApi.getProgress(newTaskId)
        if (progressResponse.success && progressResponse.data) {
          setResult(progressResponse.data)
        }
      } else {
        setError(response.message || (t('tac.startFailed') || '启动TAC核查任务失败'))
      }
    } catch (err: any) {
      console.error('启动TAC核查失败:', err)
      setError(err.message || (t('tac.startFailed') || '启动TAC核查任务失败'))
    } finally {
      setLoading(false)
    }
  }

  const handleExport = async (format: 'xlsx' | 'csv' = 'xlsx') => {
    if (!taskId) return

    try {
      const blob = await tacApi.export(taskId, format)

      // 创建下载链接
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url

      // 生成文件名（使用核查结果中的网络类型，实时获取本地时间戳）
      const networkType = taskResult?.networkType || config?.networkType || 'LTE'
      const currentTime = new Date()
      console.log('[TAC Export] Current time (UTC):', currentTime.toISOString())

      // 使用本地时间而不是UTC时间
      const year = currentTime.getFullYear()
      const month = String(currentTime.getMonth() + 1).padStart(2, '0')
      const day = String(currentTime.getDate()).padStart(2, '0')
      const hours = String(currentTime.getHours()).padStart(2, '0')
      const minutes = String(currentTime.getMinutes()).padStart(2, '0')
      const seconds = String(currentTime.getSeconds()).padStart(2, '0')
      const timestamp = `${year}${month}${day}${hours}${minutes}${seconds}`

      console.log('[TAC Export] Generated timestamp (local time):', timestamp)
      const filename = `TAC核查结果_${networkType}_${timestamp}.${format}`
      console.log('[TAC Export] Generated filename:', filename)

      link.download = filename
      document.body.appendChild(link)
      link.click()

      // 清理
      setTimeout(() => {
        document.body.removeChild(link)
        window.URL.revokeObjectURL(url)
      }, 100)

      // 记录导出路径
      setResult((prev: TACResultData | null) => prev ? { ...prev, exportPath: filename } : null)
    } catch (err: any) {
      console.error('导出失败:', err)
      setError((t('tac.exportFailed') || '导出失败:') + (err.message || (t('tac.unknownError') || '未知错误')))
    }
  }

  const getNetworkTypeLabel = (type: 'LTE' | 'NR') => {
    return type === 'LTE' ? '4G LTE' : '5G NR'
  }

  // 搜索功能状态
  const [searchEnabled, setSearchEnabled] = useState(false)
  const [searchFilters, setSearchFilters] = useState({
    firstGroup: '',
    siteId: '',
    siteName: '',
    sectorId: '',
    sectorName: '',
    networkType: '',
    longitude: '',
    latitude: '',
    tac: '',
    existingTac: '',
    tacConsistent: '',
    isSingularity: '',
    suggestedTac: '',
    matched: ''
  })
  const [filteredResults, setFilteredResults] = useState<any[]>([])

  // 列宽状态
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(
    Object.fromEntries(COLUMNS.map(col => [col.key, col.defaultWidth]))
  )

  // 列宽拖拽状态
  const [resizingColumn, setResizingColumn] = useState<string | null>(null)
  const resizingStartX = useRef<number>(0)
  const resizingStartWidth = useRef<number>(0)

  // 处理列宽拖拽开始
  const handleResizeStart = useCallback((columnKey: string, startX: number) => {
    setResizingColumn(columnKey)
    resizingStartX.current = startX
    resizingStartWidth.current = columnWidths[columnKey]
    document.body.classList.add('resizing-column')
  }, [columnWidths])

  // 处理列宽拖拽中
  const handleResizeMove = useCallback((clientX: number) => {
    if (resizingColumn) {
      const deltaX = clientX - resizingStartX.current
      const newWidth = Math.max(50, resizingStartWidth.current + deltaX) // 最小宽度50px
      setColumnWidths(prev => ({
        ...prev,
        [resizingColumn]: newWidth
      }))
    }
  }, [resizingColumn])

  // 处理列宽拖拽结束
  const handleResizeEnd = useCallback(() => {
    setResizingColumn(null)
    document.body.classList.remove('resizing-column')
  }, [])

  // 全局鼠标事件监听
  useEffect(() => {
    if (resizingColumn) {
      const handleMouseMove = (e: MouseEvent) => {
        handleResizeMove(e.clientX)
      }
      const handleMouseUp = () => {
        handleResizeEnd()
      }
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [resizingColumn, handleResizeMove, handleResizeEnd])

  // 处理搜索过滤
  useEffect(() => {
    if (taskResult?.status === 'completed' && taskResult.results) {
      if (searchEnabled) {
        const filtered = taskResult.results.filter(cell => {
          return (
            String(cell.firstGroup || '').toLowerCase().includes(searchFilters.firstGroup.toLowerCase()) &&
            String(cell.siteId || '').toLowerCase().includes(searchFilters.siteId.toLowerCase()) &&
            String(cell.siteName || '').toLowerCase().includes(searchFilters.siteName.toLowerCase()) &&
            String(cell.sectorId || '').toLowerCase().includes(searchFilters.sectorId.toLowerCase()) &&
            String(cell.sectorName || '').toLowerCase().includes(searchFilters.sectorName.toLowerCase()) &&
            String(cell.networkType || '').toLowerCase().includes(searchFilters.networkType.toLowerCase()) &&
            String(cell.longitude?.toString() || '').includes(searchFilters.longitude) &&
            String(cell.latitude?.toString() || '').includes(searchFilters.latitude) &&
            String(cell.tac || '').toLowerCase().includes(searchFilters.tac.toLowerCase()) &&
            String(cell.existingTac || '').toLowerCase().includes(searchFilters.existingTac.toLowerCase()) &&
            ((cell.tac && cell.existingTac) ?
              (normalizeTac(String(cell.tac)) === normalizeTac(String(cell.existingTac)) ? '是' : '否').includes(searchFilters.tacConsistent)
              : ''.includes(searchFilters.tacConsistent)
            ) &&
            (cell.isSingularity ? '是' : '否').includes(searchFilters.isSingularity) &&
            String(cell.suggestedTac || '').toLowerCase().includes(searchFilters.suggestedTac.toLowerCase()) &&
            (cell.matched ? '已匹配' : '未匹配').includes(searchFilters.matched)
          )
        })
        setFilteredResults(filtered)
      } else {
        setFilteredResults(taskResult.results)
      }
    }
  }, [taskResult, searchEnabled, searchFilters])

  // 处理搜索输入变化
  const handleSearchChange = (field: string, value: string) => {
    setSearchFilters(prev => ({
      ...prev,
      [field]: value
    }))
  }

  // 虚拟滚动状态
  const [scrollTop, setScrollTop] = useState(0)
  const tableContainerRef = useRef<HTMLDivElement>(null)

  // 计算虚拟滚动的可见数据
  const virtualData = useMemo(() => {
    const startIndex = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - BUFFER_COUNT)
    const endIndex = Math.min(
      filteredResults.length,
      Math.ceil((scrollTop + VISIBLE_COUNT * ITEM_HEIGHT) / ITEM_HEIGHT) + BUFFER_COUNT
    )
    return {
      startIndex,
      endIndex,
      visibleData: filteredResults.slice(startIndex, endIndex),
      totalHeight: filteredResults.length * ITEM_HEIGHT,
      offsetY: startIndex * ITEM_HEIGHT
    }
  }, [scrollTop, filteredResults])

  // 处理滚动事件
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop)
  }, [])

  // 重置滚动位置当过滤结果变化时
  useEffect(() => {
    setScrollTop(0)
    if (tableContainerRef.current) {
      tableContainerRef.current.scrollTop = 0
    }
  }, [filteredResults])

  return (
    <div className="h-full flex flex-col p-4 min-h-0">
      {/* 页面标题 */}
      <h1 className="text-3xl font-bold mb-6 shrink-0">{t('tac.title') || 'TAC核查'}</h1>

      {/* 配置区域 */}
      <div className="bg-card p-4 rounded-lg border border-border mb-6 shrink-0">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* 网络类型选择 */}
          <div className="lg:col-span-3">
            <label className="block text-sm font-semibold mb-2 text-foreground">{t('tac.networkType') || '网络类型'}</label>
            <div className="flex gap-2">
              <label className="flex items-center gap-2 cursor-pointer px-3 py-1.5 rounded-md border border-border hover:bg-muted/50 transition-colors flex-1 justify-center">
                <input
                  type="radio"
                  name="networkType"
                  value="LTE"
                  checked={config?.networkType === 'LTE'}
                  onChange={(e) => setConfig({ networkType: e.target.value as 'LTE' | 'NR' })}
                  disabled={loading || taskResult?.status === 'processing'}
                  className="w-3 h-3 text-primary"
                />
                <span className="text-sm font-medium">4G LTE</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer px-3 py-1.5 rounded-md border border-border hover:bg-muted/50 transition-colors flex-1 justify-center">
                <input
                  type="radio"
                  name="networkType"
                  value="NR"
                  checked={config?.networkType === 'NR'}
                  onChange={(e) => setConfig({ networkType: e.target.value as 'LTE' | 'NR' })}
                  disabled={loading || taskResult?.status === 'processing'}
                  className="w-3 h-3 text-primary"
                />
                <span className="text-sm font-medium">5G NR</span>
              </label>
            </div>
          </div>

          {/* TAC插花检测配置 - 横向布局 */}
          <div className="lg:col-span-4">
            <label className="text-sm font-semibold text-foreground mb-2">
              {t('tac.singularityDetection') || 'TAC插花检测'}
            </label>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <label className="text-xs text-foreground whitespace-nowrap">{t('tac.searchRadius') || '搜索半径(米):'}</label>
                <input
                  type="number"
                  value={singularityConfig.searchRadius}
                  onChange={(e) => setSingularityConfig(prev => ({ ...prev, searchRadius: Number(e.target.value) }))}
                  className="w-24 px-2 py-1 text-sm border border-purple-200/50 rounded-md bg-purple-50/30 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20 transition-all text-center"
                  min={100}
                  max={5000}
                  step={100}
                />
              </div>
              <div className="flex items-center gap-1.5">
                <label className="text-xs text-foreground whitespace-nowrap">{t('tac.singularityThreshold') || '异TAC阈值(%):'}</label>
                <input
                  type="number"
                  value={Math.round(singularityConfig.singularityThreshold * 100)}
                  onChange={(e) => setSingularityConfig(prev => ({ ...prev, singularityThreshold: Number(e.target.value) / 100 }))}
                  className="w-24 px-2 py-1 text-sm border border-purple-200/50 rounded-md bg-purple-50/30 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20 transition-all text-center"
                  min={50}
                  max={95}
                  step={5}
                />
              </div>
            </div>
          </div>

          {/* 说明文字 - 删除第三行 */}
          <div className="lg:col-span-3">
            <div className="h-full px-3 py-2 bg-blue-500/5 border border-blue-500/20 rounded-lg">
              <div className="flex items-start gap-2">
                <FileSpreadsheet size={12} className="flex-shrink-0 mt-0.5 text-blue-500" />
                <div className="space-y-0.5">
                  <p className="text-[10px] text-foreground leading-relaxed">{t('tac.importTacLayerTip') || '• 需导入TAC图层(4G_TAC.zip/5G_TAC.zip)'}</p>
                  <p className="text-[10px] text-foreground leading-relaxed">{t('tac.importParamsTip') || '• 需导入全量工参(ProjectParameter_mongoose)'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* 开始核查按钮 */}
          <div className="lg:col-span-2 flex items-end">
            <button
              onClick={handleStartPlanning}
              disabled={loading || taskResult?.status === 'processing'}
              className="w-full px-3 py-2 bg-blue-400 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm font-medium transition-colors"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" size={16} />
                  <span>{t('tac.starting') || '启动中...'}</span>
                </>
              ) : taskResult?.status === 'processing' ? (
                <>
                  <Loader2 className="animate-spin" size={16} />
                  <span>{t('tac.checking') || '核查中...'}</span>
                </>
              ) : (
                <>
                  <Play size={16} />
                  <span>{t('tac.startCheck') || '开始核查'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-2 shrink-0">
          <AlertCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-red-500 text-sm font-medium">{t('tac.failed') || '核查失败'}</p>
            <p className="text-red-600 text-xs">{error}</p>
          </div>
        </div>
      )}

      {/* 核查结果 */}
      {taskResult && (
        <div className="bg-card p-5 rounded-lg border border-border flex-1 min-h-0 flex flex-col overflow-hidden">
          {/* 标题行 + 统计卡片 */}
          <div className="mb-4 shrink-0">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                {taskResult.status === 'completed' ? (
                  <CheckCircle2 size={20} className="text-green-500" />
                ) : taskResult.status === 'failed' ? (
                  <AlertCircle size={20} className="text-red-500" />
                ) : (
                  <Loader2 size={20} className="animate-spin text-primary" />
                )}
                <h2 className="text-lg font-semibold">{t('tac.checkResult') || '核查结果'}</h2>
                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  {getNetworkTypeLabel(taskResult?.networkType || config?.networkType || 'LTE')}
                </span>
              </div>

              {taskResult.status === 'completed' && (
                <button
                  onClick={() => handleExport('xlsx')}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-400 text-white rounded-md hover:bg-blue-500 transition-colors text-sm"
                >
                  <Download size={14} />
                  <span>{t('tac.export') || '导出'}</span>
                </button>
              )}
            </div>

            {/* 统计卡片 - 紧凑横向排列 */}
            <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
              <div className="px-2.5 py-1.5 bg-muted/50 rounded-md">
                <p className="text-[10px] text-muted-foreground">{t('tac.networkType') || '网络类型'}</p>
                <p className="text-sm font-semibold">{taskResult.networkType || '-'}</p>
              </div>
              <div className="px-2.5 py-1.5 bg-muted/50 rounded-md">
                <p className="text-[10px] text-muted-foreground">{t('tac.totalCells') || '总小区'}</p>
                <p className="text-sm font-semibold">{taskResult.totalCells || 0}</p>
              </div>
              <div className="px-2.5 py-1.5 bg-green-500/10 border border-green-500/20 rounded-md">
                <p className="text-[10px] text-green-600">{t('tac.matched') || '匹配成功'}</p>
                <p className="text-sm font-semibold text-green-600">{taskResult.matchedCells || 0}</p>
              </div>
              <div className="px-2.5 py-1.5 bg-orange-500/10 border border-orange-500/20 rounded-md">
                <p className="text-[10px] text-orange-600">{t('tac.unmatched') || '未匹配'}</p>
                <p className="text-sm font-semibold text-orange-600">{taskResult.unmatchedCells || 0}</p>
              </div>
              <div className="px-2.5 py-1.5 bg-red-500/10 border border-red-500/20 rounded-md">
                <p className="text-[10px] text-red-600">{t('tac.tacMismatch') || 'TAC错配'}</p>
                <p className="text-sm font-semibold text-red-600">{taskResult.mismatchedCells || 0}</p>
              </div>
              <div className="px-2.5 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-md">
                <p className="text-[10px] text-blue-600">{t('tac.mismatchRate') || '错配率'}</p>
                <p className="text-sm font-semibold text-blue-600">
                  {taskResult.matchedCells > 0
                    ? ((taskResult.mismatchedCells / taskResult.matchedCells) * 100).toFixed(1)
                    : '0'}
                  %
                </p>
              </div>
              <div className="px-2.5 py-1.5 bg-purple-500/10 border border-purple-500/20 rounded-md">
                <p className="text-[10px] text-purple-600">{t('tac.singularity') || 'TAC插花'}</p>
                <p className="text-sm font-semibold text-purple-600">{taskResult.singularityCount || 0}</p>
              </div>
              <div className="px-2.5 py-1.5 bg-muted/50 rounded-md">
                <p className="text-[10px] text-muted-foreground">{t('tac.matchRate') || '匹配率'}</p>
                <p className="text-sm font-semibold">
                  {taskResult.totalCells > 0
                    ? ((taskResult.matchedCells / taskResult.totalCells) * 100).toFixed(1)
                    : '0'}
                  %
                </p>
              </div>
            </div>
          </div>

          {/* 任务状态 */}
          <div className="mb-4 shrink-0">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium">{t('tac.progress') || '核查进度'}</span>
              <span className="text-xs text-muted-foreground">
                {taskResult.status === 'completed'
                  ? (t('tac.completed') || '已完成')
                  : taskResult.status === 'failed'
                    ? (t('tac.failed') || '失败')
                    : taskResult.status === 'processing'
                      ? (t('tac.processing') || '进行中')
                      : (t('tac.waiting') || '等待中')} ({taskResult.progress}%)
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-1.5">
              <div
                className={`h-1.5 rounded-full transition-all duration-300 ${taskResult.status === 'completed'
                    ? 'bg-green-500'
                    : taskResult.status === 'failed'
                      ? 'bg-red-500'
                      : 'bg-primary'
                  }`}
                style={{ width: `${taskResult.progress}%` }}
              />
            </div>
          </div>

          {/* 两栏布局：结果表格 + 地图 */}
          <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0 overflow-hidden">
            {/* 左列：结果表格 */}
            <div className="flex flex-col flex-1 min-w-0 min-h-0 w-1/2">
              {/* 任务错误信息 */}
              {taskResult.status === 'failed' && taskResult.error && (
                <div className="mb-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertCircle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-red-600">{taskResult.error}</p>
                  </div>
                </div>
              )}

              {/* 详细结果表格 */}
              {taskResult.status === 'completed' && taskResult.results && (
                <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                  <div className="flex justify-end mb-3 shrink-0">
                    <button
                      onClick={() => setSearchEnabled(!searchEnabled)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors text-sm ${searchEnabled
                          ? 'bg-blue-400 text-white hover:bg-blue-500'
                          : 'bg-muted hover:bg-muted/80'
                        }`}
                    >
                      <Search size={16} />
                      {t('tac.search') || '搜索'}
                    </button>
                  </div>
                  <div
                    ref={tableContainerRef}
                    onScroll={handleScroll}
                    className="overflow-x-auto overflow-y-auto flex-1 min-h-0"
                  >
                    <table className="w-full text-xs border-collapse table-fixed">
                      <thead className="sticky top-0 z-20 bg-background border-b border-border shadow-sm">
                        <tr>
                          {COLUMNS.map((column) => (
                            <th
                              key={column.key}
                              className="text-left p-2 font-medium bg-background z-20 relative group border-r border-border"
                              style={{ width: `${columnWidths[column.key]}px`, minWidth: `${columnWidths[column.key]}px` }}
                            >
                              <span className="block pr-3">{t(`tac.column.${column.key}`) || column.label}</span>
                              {searchEnabled && (
                                <input
                                  type="text"
                                  value={searchFilters[column.key as keyof typeof searchFilters]}
                                  onChange={(e) => handleSearchChange(column.key, e.target.value)}
                                  placeholder={t('tac.search') || '搜索'}
                                  className="mt-1 w-full p-1 border border-border rounded text-[10px] bg-white dark:bg-slate-800"
                                />
                              )}
                              {/* 拖拽手柄 */}
                              <div
                                className={`table-resize-handle ${resizingColumn === column.key ? 'resizing' : ''}`}
                                onMouseDown={(e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  handleResizeStart(column.key, e.clientX)
                                }}
                              >
                                <GripVertical size={12} className="opacity-0 group-hover:opacity-40 text-muted-foreground absolute right-0.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        <tr style={{ height: `${virtualData.offsetY}px` }}>
                          <td colSpan={COLUMNS.length}></td>
                        </tr>
                        {virtualData.visibleData.map((cell, index) => {
                          const actualIndex = virtualData.startIndex + index
                          const sectorKey = `${cell.siteId}-${cell.sectorId}`
                          const isSelected = sectorKey === selectedSectorKey
                          return (
                            <tr
                              key={`${cell.sectorId}-${actualIndex}`}
                              className={`border-b hover:bg-muted/50 cursor-pointer ${isSelected ? 'bg-blue-50/50 dark:bg-blue-900/20' : ''
                                }`}
                              style={{ height: `${ITEM_HEIGHT}px` }}
                              onClick={() => handleResultRowClick(cell)}
                            >
                              {COLUMNS.map((column) => {
                                const width = columnWidths[column.key]
                                let cellContent: any
                                let cellClassName = 'p-2 border-r border-border'

                                switch (column.key) {
                                  case 'firstGroup':
                                    cellContent = cell.firstGroup || '-'
                                    cellClassName += ' truncate'
                                    break
                                  case 'siteId':
                                    cellContent = cell.siteId
                                    cellClassName += ' font-mono truncate'
                                    break
                                  case 'siteName':
                                    cellContent = cell.siteName
                                    cellClassName += ' truncate'
                                    break
                                  case 'sectorId':
                                    cellContent = cell.sectorId
                                    cellClassName += ' font-mono truncate'
                                    break
                                  case 'sectorName':
                                    cellContent = cell.sectorName
                                    cellClassName += ' truncate'
                                    break
                                  case 'networkType':
                                    cellContent = (
                                      <span className={`px-1.5 py-0.5 rounded text-[10px] ${cell.networkType === 'LTE'
                                          ? 'bg-blue-500/10 text-blue-600'
                                          : 'bg-purple-500/10 text-purple-600'
                                        }`}>
                                        {cell.networkType}
                                      </span>
                                    )
                                    break
                                  case 'longitude':
                                    cellContent = cell.longitude?.toFixed(6)
                                    cellClassName += ' font-mono truncate'
                                    break
                                  case 'latitude':
                                    cellContent = cell.latitude?.toFixed(6)
                                    cellClassName += ' font-mono truncate'
                                    break
                                  case 'tac':
                                    cellContent = cell.tac || '-'
                                    cellClassName += ' font-mono truncate'
                                    break
                                  case 'existingTac':
                                    cellContent = cell.existingTac || '-'
                                    cellClassName += ' font-mono truncate'
                                    break
                                  case 'tacConsistent':
                                    cellContent = cell.tac && cell.existingTac ? (
                                      <span className={`px-1.5 py-0.5 rounded text-[10px] ${normalizeTac(String(cell.tac)) === normalizeTac(String(cell.existingTac))
                                          ? 'bg-green-500/10 text-green-600'
                                          : 'bg-red-500/10 text-red-600'
                                        }`}>
                                        {normalizeTac(String(cell.tac)) === normalizeTac(String(cell.existingTac)) ? (t('tac.yes') || '是') : (t('tac.no') || '否')}
                                      </span>
                                    ) : (
                                      <span className="px-2 py-1 bg-muted/50 text-muted-foreground rounded">
                                        -
                                      </span>
                                    )
                                    break
                                  case 'isSingularity':
                                    cellContent = cell.existingTac && cell.existingTac !== '-' ? (
                                      cell.isSingularity ? (
                                        <span className="px-2 py-1 bg-purple-500/10 text-purple-600 rounded">
                                          {t('tac.yes') || '是'}
                                        </span>
                                      ) : (
                                        <span className="px-2 py-1 bg-muted/50 text-muted-foreground rounded">
                                          {t('tac.no') || '否'}
                                        </span>
                                      )
                                    ) : (
                                      <span className="px-2 py-1 bg-muted/50 text-muted-foreground rounded">
                                        -
                                      </span>
                                    )
                                    break
                                  case 'suggestedTac':
                                    cellContent = cell.existingTac && cell.existingTac !== '-' && cell.suggestedTac ? (
                                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${cell.isSingularity
                                          ? 'bg-purple-500/10 text-purple-600'
                                          : 'bg-blue-500/10 text-blue-600'
                                        }`}>
                                        {cell.suggestedTac}
                                      </span>
                                    ) : (
                                      <span className="px-2 py-1 bg-muted/50 text-muted-foreground rounded">
                                        -
                                      </span>
                                    )
                                    break
                                  case 'matched':
                                    cellContent = cell.matched ? (
                                      <span className="px-2 py-1 bg-green-500/10 text-green-600 rounded">
                                        {t('tac.matched') || '已匹配'}
                                      </span>
                                    ) : (
                                      <span className="px-2 py-1 bg-orange-500/10 text-orange-600 rounded">
                                        {t('tac.unmatched') || '未匹配'}
                                      </span>
                                    )
                                    break
                                  default:
                                    cellContent = null
                                }

                                return (
                                  <td
                                    key={column.key}
                                    className={cellClassName}
                                    style={{ width: `${width}px`, minWidth: `${width}px`, maxWidth: `${width}px` }}
                                  >
                                    {cellContent}
                                  </td>
                                )
                              })}
                            </tr>
                          )
                        })}
                        <tr style={{ height: `${virtualData.totalHeight - virtualData.offsetY - virtualData.visibleData.length * ITEM_HEIGHT}px` }}>
                          <td colSpan={COLUMNS.length}></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 导出路径提示 */}
              {taskResult?.exportPath && (
                <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-sm">
                  <div className="flex items-center gap-2">
                    <Download size={16} className="text-blue-500 flex-shrink-0" />
                    <span className="text-blue-600">
                      {t('tac.exportedFile') || '已导出文件:'} <span className="font-mono">{taskResult.exportPath}</span>
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* 右列：地图窗口 */}
            <div className="flex flex-col flex-1 min-w-0 min-h-0 w-1/2">
              <div className="bg-card rounded-lg border border-border p-3 flex-1 flex flex-col relative min-h-0">
                <OnlineMap
                  ref={mapRef}
                  mode="tac-check"
                  onSectorClick={handleMapSectorClick}
                />
                <TACLegend
                  visible={isLegendVisible}
                  onToggleVisible={() => setIsLegendVisible(!isLegendVisible)}
                  networkType={taskResult?.networkType || config?.networkType || 'LTE'}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
