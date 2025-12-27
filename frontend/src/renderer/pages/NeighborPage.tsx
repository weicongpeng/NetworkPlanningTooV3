import { useState, useEffect, useRef } from 'react'
import { Play, Download, Settings, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import { neighborApi } from '../services/api'
import type { ApiResponse } from '@shared/types'

interface NeighborResultData {
  taskId: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: number
  totalSites: number
  totalSectors: number
  totalNeighbors: number
  avgNeighbors: number
  results?: any[]
  startTime: string
  endTime?: string
}

const MAX_ERRORS = 5

export function NeighborPage() {
  const [config, setConfig] = useState({
    planningType: 'LTE-LTE',  // 新增：邻区规划类型
    maxDistance: 3.0,         // 默认值改为3km
    maxNeighbors: 32
  })
  const [taskResult, setTaskResult] = useState<NeighborResultData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [taskId, setTaskId] = useState<string | null>(null)

  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null)
  const [selectedSectorId, setSelectedSectorId] = useState<string | null>(null)

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const errorCountRef = useRef(0)

  // 轮询任务进度
  useEffect(() => {
    const clearPolling = () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
        pollingIntervalRef.current = null
      }
    }

    if (!taskId || taskResult?.status === 'completed' || taskResult?.status === 'failed') {
      clearPolling()
      return
    }

    clearPolling()

    pollingIntervalRef.current = setInterval(async () => {
      try {
        const response: ApiResponse<any> = await neighborApi.getProgress(taskId)
        errorCountRef.current = 0

        if (response.success && response.data) {
          const data = response.data
          setTaskResult({
            ...data,
            startTime: data.created_at || taskResult?.startTime || new Date().toISOString()
          })

          if (data.status === 'completed') {
            clearPolling()
            setTimeout(async () => {
              try {
                const resultResponse: ApiResponse<any> = await neighborApi.getResult(taskId)
                if (resultResponse.success && resultResponse.data) {
                  setTaskResult(resultResponse.data)
                } else {
                  setError(resultResponse.message || '获取规划结果失败')
                }
              } catch (err: any) {
                setError('获取规划结果失败: ' + (err.message || err.toString?.() || '未知错误'))
              }
            }, 100)
          } else if (data.status === 'failed') {
            clearPolling()
            setError(data.message || data.error || '规划任务失败')
          }
        } else {
          setError(response.message || '获取进度失败')
        }
      } catch (err: any) {
        errorCountRef.current++
        console.error('Failed to get progress:', err)

        if (errorCountRef.current >= MAX_ERRORS) {
          clearPolling()
          setError('无法连接到服务器，请检查网络连接或后端服务状态')
        } else {
          setError(`获取进度失败 (${errorCountRef.current}/{MAX_ERRORS})，正在重试...`)
        }
      }
    }, 1000)

    return clearPolling
  }, [taskId])

  const handleRunNeighbor = async () => {
    setError(null)
    setTaskResult(null)
    setLoading(true)
    errorCountRef.current = 0

    // 解析规划类型
    const [sourceType, targetType] = config.planningType.split('-') as ['LTE' | 'NR', 'LTE' | 'NR']

    try {
      const response: ApiResponse<{ taskId: string; message: string }> = await neighborApi.plan({
        sourceType,
        targetType,
        maxDistance: config.maxDistance,
        maxNeighbors: config.maxNeighbors
      })

      if (response.success && response.data) {
        setTaskId(response.data.taskId)
        setTaskResult({
          taskId: response.data.taskId,
          status: 'pending',
          progress: 0,
          totalSites: 0,
          totalSectors: 0,
          totalNeighbors: 0,
          avgNeighbors: 0,
          startTime: new Date().toISOString()
        })
      } else {
        setError(response.message || '启动规划任务失败')
      }
    } catch (err: any) {
      setError(err.message || '启动规划任务失败')
    } finally {
      setLoading(false)
    }
  }

  const handleExport = async () => {
    if (!taskId) return

    try {
      const blob = await neighborApi.export(taskId, 'xlsx')
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `neighbor_result_${taskId}.xlsx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (err: any) {
      setError('导出失败: ' + (err.message || '未知错误'))
    }
  }

  const isRunning = taskResult?.status === 'pending' || taskResult?.status === 'processing'

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-8">邻区规划</h1>

      {/* 错误提示 */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-red-700">
          <AlertCircle size={20} />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-sm underline">关闭</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* 配置面板 */}
        <div className="lg:col-span-1">
          <div className="bg-card p-6 rounded-lg border border-border">
            <div className="flex items-center gap-2 mb-6">
              <Settings size={20} />
              <h2 className="text-xl font-semibold">规划参数</h2>
            </div>

            <div className="space-y-4">
              <ConfigSelect
                label="邻区规划类型"
                value={config.planningType}
                options={['LTE-LTE', 'NR-NR', 'NR-LTE']}
                onChange={(value) => setConfig({ ...config, planningType: value })}
                disabled={isRunning}
              />

              <ConfigInput
                label="最大距离(km)"
                type="number"
                value={config.maxDistance}
                onChange={(value) =>
                  setConfig({ ...config, maxDistance: parseFloat(value) || 0 })
                }
                disabled={isRunning}
                min={0.1}
                max={100}
                step={0.1}
              />

              <ConfigInput
                label="最大邻区数"
                type="number"
                value={config.maxNeighbors}
                onChange={(value) =>
                  setConfig({ ...config, maxNeighbors: parseInt(value) || 32 })
                }
                disabled={isRunning}
                min={1}
                max={128}
              />

              <button
                onClick={handleRunNeighbor}
                disabled={loading || isRunning}
                className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin" size={16} />
                    启动中...
                  </>
                ) : isRunning ? (
                  <>
                    <Loader2 className="animate-spin" size={16} />
                    规划中...
                  </>
                ) : (
                  <>
                    <Play size={16} />
                    开始规划
                  </>
                )}
              </button>

              {/* 进度条 */}
              {isRunning && taskResult && (
                <div className="mt-4">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span>规划进度</span>
                    <span>{taskResult.progress.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full transition-all duration-300"
                      style={{ width: `${taskResult.progress}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {taskResult.status === 'pending' ? '任务等待中...' : '正在规划...'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 结果展示 */}
        <div className="lg:col-span-2">
          <div className="bg-card p-6 rounded-lg border border-border">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold">规划结果</h2>
              {taskResult?.status === 'completed' && (
                <button
                  onClick={handleExport}
                  className="flex items-center gap-2 px-4 py-2 bg-secondary rounded-lg hover:bg-muted transition-colors"
                >
                  <Download size={16} />
                  导出结果
                </button>
              )}
            </div>

            {!taskResult ? (
              <div className="text-center py-16 text-muted-foreground">
                <Settings size={48} className="mx-auto mb-4 opacity-50" />
                <p>配置参数后点击"开始规划"查看结果</p>
                <p className="text-xs mt-2">需要先上传"全量工参"和"待规划小区"文件</p>
              </div>
            ) : taskResult.status === 'failed' ? (
              <div className="text-center py-16 text-red-500">
                <AlertCircle size={48} className="mx-auto mb-4" />
                <p className="font-semibold">规划任务失败</p>
              </div>
            ) : taskResult.status === 'completed' ? (
              <div>
                <div className="flex items-center justify-center py-8 text-green-600">
                  <CheckCircle2 size={48} className="mr-3" />
                  <span className="text-xl font-semibold">规划完成</span>
                </div>

                {/* 结果表格 */}
                {taskResult.results && taskResult.results.length > 0 && (
                  <div className="mt-4">
                    <div className="mb-4">
                      <label className="text-sm font-medium mb-2 block">选择基站查看邻区详情:</label>
                      <select
                        value={selectedSiteId || ""}
                        onChange={(e) => {
                          setSelectedSiteId(e.target.value || null)
                          setSelectedSectorId(null)
                        }}
                        className="px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="">-- 选择基站 --</option>
                        {taskResult.results.map((site: any) => (
                          <option key={site.siteId} value={site.siteId}>
                            {site.siteName} ({site.siteId})
                          </option>
                        ))}
                      </select>
                    </div>

                    <NeighborTable
                      results={taskResult.results}
                      selectedSiteId={selectedSiteId}
                      selectedSectorId={selectedSectorId}
                      onSelectSite={setSelectedSiteId}
                      onSelectSector={setSelectedSectorId}
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-16 text-muted-foreground">
                <Loader2 className="animate-spin mx-auto mb-4" size={48} />
                <p>规划进行中，请稍候...</p>
              </div>
            )}
          </div>

          {/* 统计信息 */}
          {taskResult && taskResult.status !== 'pending' && (
            <div className="grid grid-cols-4 gap-4 mt-6">
              <StatCard title="基站总数" value={taskResult.totalSites || 0} />
              <StatCard title="小区总数" value={taskResult.totalSectors || 0} />
              <StatCard title="邻区关系" value={taskResult.totalNeighbors || 0} />
              <StatCard title="平均邻区数" value={taskResult.avgNeighbors || 0} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function NeighborTable({
  results,
  selectedSiteId,
  selectedSectorId,
  onSelectSite,
  onSelectSector
}: {
  results: any[]
  selectedSiteId: string | null
  selectedSectorId: string | null
  onSelectSite: (siteId: string | null) => void
  onSelectSector: (sectorId: string | null) => void
}) {
  if (!selectedSiteId) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>请选择一个基站查看邻区详情</p>
      </div>
    )
  }

  const selectedSite = results.find((s: any) => s.siteId === selectedSiteId)
  if (!selectedSite) return null

  return (
    <div className="space-y-4">
      {/* 小区列表 */}
      <div>
        <h3 className="text-sm font-medium mb-2">小区列表:</h3>
        <div className="flex flex-wrap gap-2 mb-4">
          {selectedSite.sectors.map((sector: any) => (
            <button
              key={sector.sectorId}
              onClick={() => onSelectSector(
                selectedSectorId === sector.sectorId ? null : sector.sectorId
              )}
              className={`px-3 py-1 rounded-lg border text-sm transition-colors ${
                selectedSectorId === sector.sectorId
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background border-border hover:bg-muted'
              }`}
            >
              {sector.sectorName} ({sector.neighborCount || sector.neighbors?.length || 0})
            </button>
          ))}
        </div>
      </div>

      {/* 邻区详情 */}
      {selectedSectorId && (
        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-background">
              <tr className="border-b">
                <th className="text-left p-2">目标小区</th>
                <th className="text-left p-2">目标基站</th>
                <th className="text-left p-2">距离(km)</th>
                <th className="text-left p-2">方位角(°)</th>
                <th className="text-left p-2">关系类型</th>
              </tr>
            </thead>
            <tbody>
              {selectedSite.sectors
                .find((s: any) => s.sectorId === selectedSectorId)
                ?.neighbors?.map((neighbor: any, idx: number) => (
                  <tr key={idx} className="border-b hover:bg-muted/50">
                    <td className="p-2">{neighbor.targetSectorName}</td>
                    <td className="p-2">{neighbor.targetSiteName}</td>
                    <td className="p-2">{neighbor.distance}</td>
                    <td className="p-2">{neighbor.bearing}</td>
                    <td className="p-2">
                      <span className={`px-2 py-1 rounded text-xs ${
                        neighbor.relationType === 'LTE-LTE' ? 'bg-blue-100 text-blue-700' :
                        neighbor.relationType === 'NR-NR' ? 'bg-purple-100 text-purple-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {neighbor.relationType}
                      </span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function ConfigSelect({
  label,
  value,
  options,
  onChange,
  disabled = false
}: {
  label: string
  value: string
  options: string[]
  onChange: (value: string) => void
  disabled?: boolean
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-2">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  )
}

function ConfigInput({
  label,
  type,
  value,
  onChange,
  disabled = false,
  min,
  max,
  step = 1
}: {
  label: string
  type: string
  value: number | string
  onChange: (value: string) => void
  disabled?: boolean
  min?: number
  max?: number
  step?: number
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-2">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        min={min}
        max={max}
        step={step}
        className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
      />
    </div>
  )
}

function StatCard({ title, value }: { title: string; value: string | number }) {
  return (
    <div className="bg-card p-4 rounded-lg border border-border text-center">
      <p className="text-sm text-muted-foreground mb-1">{title}</p>
      <p className="text-2xl font-bold text-primary">{value}</p>
    </div>
  )
}
