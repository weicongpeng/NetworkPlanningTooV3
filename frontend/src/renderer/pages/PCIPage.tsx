import { useState, useEffect, useRef } from 'react'
import { Play, Download, Settings, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import { pciApi } from '../services/api'
import type { ApiResponse } from '@shared/types'

interface PCIResultData {
  taskId: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: number
  totalSites: number
  totalSectors: number
  collisions: number
  confusions: number
  results?: any[]
  startTime: string
  endTime?: string
}

const MAX_ERRORS = 5

export function PCIPage() {
  const [config, setConfig] = useState({
    networkType: 'LTE',
    distanceThreshold: 3.0,
    inheritModulus: false,  // 新增：是否继承全量工参模数
    useMod3: true,          // LTE时可用
    useMod30: false         // NR时可用
  })
  const [taskResult, setTaskResult] = useState<PCIResultData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [taskId, setTaskId] = useState<string | null>(null)

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
        const response: ApiResponse<any> = await pciApi.getProgress(taskId)
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
                const resultResponse: ApiResponse<any> = await pciApi.getResult(taskId)
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
          setError(`获取进度失败 (${errorCountRef.current}/${MAX_ERRORS})，正在重试...`)
        }
      }
    }, 1000)

    return clearPolling
  }, [taskId])

  const handleRunPCI = async () => {
    setError(null)
    setTaskResult(null)
    setLoading(true)
    errorCountRef.current = 0

    // 确定PCI模数
    const pciModulus = config.networkType === 'LTE' ? 3 : 30

    try {
      const response: ApiResponse<{ taskId: string; message: string }> = await pciApi.plan({
        networkType: config.networkType as 'LTE' | 'NR',
        distanceThreshold: config.distanceThreshold,
        pciModulus: pciModulus,
        inheritModulus: config.inheritModulus
      })

      if (response.success && response.data) {
        setTaskId(response.data.taskId)
        setTaskResult({
          taskId: response.data.taskId,
          status: 'pending',
          progress: 0,
          totalSites: 0,
          totalSectors: 0,
          collisions: 0,
          confusions: 0,
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
      const blob = await pciApi.export(taskId, 'xlsx')
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `pci_result_${taskId}.xlsx`
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
      <h1 className="text-3xl font-bold mb-8">PCI规划</h1>

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
                label="网络类型"
                value={config.networkType}
                options={['LTE', 'NR']}
                onChange={(value) => {
                  setConfig({
                    ...config,
                    networkType: value,
                    // 切换网络类型时自动调整模数选项
                    useMod3: value === 'LTE',
                    useMod30: value === 'NR'
                  })
                }}
                disabled={isRunning}
              />

              <ConfigInput
                label="距离阈值(km)"
                type="number"
                value={config.distanceThreshold}
                onChange={(value) =>
                  setConfig({
                    ...config,
                    distanceThreshold: parseFloat(value) || 0
                  })
                }
                disabled={isRunning}
                min={0.1}
                max={50}
                step={0.1}
              />

              {/* 继承模数选项 */}
              <div className="flex items-center justify-between py-2">
                <label className="text-sm">继承全量工参模数</label>
                <input
                  type="checkbox"
                  checked={config.inheritModulus}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      inheritModulus: e.target.checked
                    })
                  }
                  className="w-4 h-4"
                  disabled={isRunning}
                />
              </div>

              {/* 模3选项 - 仅LTE可用 */}
              <div className={`flex items-center justify-between py-2 ${config.networkType === 'NR' ? 'opacity-50' : ''}`}>
                <label className="text-sm">
                  使用模3 (LTE)
                  {config.networkType === 'NR' && <span className="text-xs text-muted-foreground ml-2">(NR不可用)</span>}
                </label>
                <input
                  type="checkbox"
                  checked={config.useMod3}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      useMod3: e.target.checked
                    })
                  }
                  className="w-4 h-4"
                  disabled={isRunning || config.networkType === 'NR'}
                />
              </div>

              {/* 模30选项 - 仅NR可用 */}
              <div className={`flex items-center justify-between py-2 ${config.networkType === 'LTE' ? 'opacity-50' : ''}`}>
                <label className="text-sm">
                  使用模30 (NR)
                  {config.networkType === 'LTE' && <span className="text-xs text-muted-foreground ml-2">(LTE不可用)</span>}
                </label>
                <input
                  type="checkbox"
                  checked={config.useMod30}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      useMod30: e.target.checked
                    })
                  }
                  className="w-4 h-4"
                  disabled={isRunning || config.networkType === 'LTE'}
                />
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  onClick={handleRunPCI}
                  disabled={loading || isRunning}
                  className="flex-1 flex items-center justify-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
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
              </div>

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
                  <div className="mt-4 overflow-x-auto max-h-96">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-background">
                        <tr className="border-b">
                          <th className="text-left p-2">基站ID</th>
                          <th className="text-left p-2">基站名称</th>
                          <th className="text-left p-2">小区ID</th>
                          <th className="text-left p-2">小区名称</th>
                          <th className="text-left p-2">原PCI</th>
                          <th className="text-left p-2">新PCI</th>
                          <th className="text-left p-2">原模</th>
                          <th className="text-left p-2">新模</th>
                          <th className="text-left p-2">分配原因</th>
                        </tr>
                      </thead>
                      <tbody>
                        {taskResult.results.slice(0, 100).map((site: any) =>
                          site.sectors.map((sector: any, idx: number) => (
                            <tr key={`${site.siteId}-${sector.sectorId}`} className="border-b hover:bg-muted/50">
                              {idx === 0 && (
                                <>
                                  <td className="p-2" rowSpan={site.sectors.length}>{site.siteId}</td>
                                  <td className="p-2" rowSpan={site.sectors.length}>{site.siteName}</td>
                                </>
                              )}
                              <td className="p-2">{sector.sectorId}</td>
                              <td className="p-2">{sector.sectorName}</td>
                              <td className="p-2">{sector.originalPCI ?? '-'}</td>
                              <td className="p-2 font-semibold">{sector.newPCI}</td>
                              <td className="p-2">{sector.originalMod ?? '-'}</td>
                              <td className="p-2">{sector.newMod ?? '-'}</td>
                              <td className="p-2 text-xs text-muted-foreground max-w-xs truncate" title={sector.assignmentReason}>
                                {sector.assignmentReason}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
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
            <div className="grid grid-cols-2 gap-4 mt-6">
              <StatCard title="基站总数" value={taskResult.totalSites || 0} />
              <StatCard title="小区总数" value={taskResult.totalSectors || 0} />
            </div>
          )}
        </div>
      </div>
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
