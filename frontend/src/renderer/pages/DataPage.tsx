import { useState, useEffect } from 'react'
import { Upload, FileSpreadsheet, Trash2, Download, Loader2, AlertCircle } from 'lucide-react'
import { useDataStore } from '../store/dataStore'
import type { DataItem } from '@shared/types'

export function DataPage() {
  const [previewData, setPreviewData] = useState<any>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const { items, loading, error, fetchList, uploadExcel, uploadMap, deleteItem } = useDataStore()

  useEffect(() => {
    fetchList()
  }, [fetchList])

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, type: 'excel' | 'map') => {
    const file = event.target.files?.[0]
    if (!file) return

    const uploadFn = type === 'excel' ? uploadExcel : uploadMap
    const success = await uploadFn(file)
    if (success) {
      // 重置input
      event.target.value = ''
    }
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-8">数据管理</h1>

      {/* 错误提示 */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-red-700">
          <AlertCircle size={20} />
          <span>{error}</span>
          <button onClick={() => fetchList()} className="ml-auto text-sm underline">重试</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* 文件上传 */}
        <div className="bg-card p-6 rounded-lg border border-border">
          <h2 className="text-xl font-semibold mb-4">导入数据</h2>

          <div className="space-y-4">
            <UploadArea
              title="全量工参"
              accept=".xlsx,.xls"
              onUpload={(e) => handleFileUpload(e, 'excel')}
              loading={loading}
              icon={<FileSpreadsheet size={32} />}
            />
            <UploadArea
              title="待规划小区"
              accept=".xlsx,.xls"
              onUpload={(e) => handleFileUpload(e, 'excel')}
              loading={loading}
              icon={<FileSpreadsheet size={32} />}
            />
            <UploadArea
              title="现网工参"
              accept=".zip"
              onUpload={(e) => handleFileUpload(e, 'map')}
              loading={loading}
              icon={<Upload size={32} />}
            />
          </div>
        </div>

        {/* 数据列表 */}
        <div className="bg-card p-6 rounded-lg border border-border">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">已导入数据</h2>
            <button
              onClick={fetchList}
              className="text-sm text-primary hover:underline"
            >
              刷新
            </button>
          </div>

          {items.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              暂无数据，请先导入
            </p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {items.map((item) => (
                <div
                  key={item.id}
                  className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedId === item.id
                      ? 'bg-primary/10 border-primary'
                      : 'bg-muted border-border hover:bg-muted/80'
                  }`}
                  onClick={() => setSelectedId(item.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {item.type === 'excel' ? (
                        <FileSpreadsheet size={16} className="text-green-600" />
                      ) : (
                        <Upload size={16} className="text-blue-600" />
                      )}
                      <span className="truncate font-medium">{item.name}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {item.type === 'excel' && item.metadata?.siteCount
                        ? `${item.metadata.siteCount}个基站, ${item.metadata.sectorCount}个小区`
                        : `${item.type}文件`}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        // 预览功能
                        setSelectedId(item.id)
                      }}
                      className="p-2 hover:bg-background rounded"
                      title="预览"
                    >
                      <Download size={16} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteItem(item.id)
                      }}
                      className="p-2 hover:bg-background rounded text-red-500"
                      title="删除"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 数据预览 */}
      <div className="mt-8 bg-card p-6 rounded-lg border border-border">
        <h2 className="text-xl font-semibold mb-4">数据预览</h2>
        {!selectedId ? (
          <p className="text-muted-foreground text-center py-8">
            请选择数据查看预览
          </p>
        ) : (
          <DataPreview dataId={selectedId} />
        )}
      </div>
    </div>
  )
}

function DataPreview({ dataId }: { dataId: string }) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      setError(null)
      try {
        const response = await fetch(`/api/v1/data/${dataId}`)
        const result = await response.json()
        // 后端返回 { success: true, data: ... }
        setData(result.success ? result.data : null)
      } catch (err) {
        console.error('Failed to fetch data:', err)
        setError('加载数据失败')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [dataId])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="animate-spin" />
        <span className="ml-2 text-muted-foreground">加载中...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-16 text-red-500">
        <AlertCircle size={20} className="mr-2" />
        <span>{error}</span>
      </div>
    )
  }

  if (!data) {
    return <p className="text-muted-foreground text-center py-8">无法加载数据</p>
  }

  return (
    <div>
      <p className="text-sm text-muted-foreground mb-4">
        共 {Array.isArray(data) ? data.length : 0} 个基站
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left p-2">基站ID</th>
              <th className="text-left p-2">基站名称</th>
              <th className="text-left p-2">网络类型</th>
              <th className="text-left p-2">经度</th>
              <th className="text-left p-2">纬度</th>
              <th className="text-left p-2">小区数</th>
            </tr>
          </thead>
          <tbody>
            {Array.isArray(data) && data.slice(0, 50).map((site: any) => (
              <tr key={site.id} className="border-b hover:bg-muted/50">
                <td className="p-2">{site.id}</td>
                <td className="p-2">{site.name}</td>
                <td className="p-2">{site.networkType}</td>
                <td className="p-2">{site.longitude?.toFixed(6)}</td>
                <td className="p-2">{site.latitude?.toFixed(6)}</td>
                <td className="p-2">{site.sectors?.length || 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function UploadArea({
  title,
  accept,
  onUpload,
  icon,
  loading = false
}: {
  title: string
  accept: string
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
  icon: React.ReactNode
  loading?: boolean
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{title}</label>
      <label className={`flex flex-col items-center justify-center w-full h-16 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
        loading
          ? 'border-muted bg-muted/50 cursor-not-allowed'
          : 'border-border hover:border-primary'
      }`}>
        <div className="flex flex-row items-center justify-center gap-3 w-full px-3 text-muted-foreground">
          {loading ? (
            <Loader2 className="animate-spin" size={16} />
          ) : (
            <span className="flex-shrink-0">{icon}</span>
          )}
          <p className="text-xs flex-1 text-center">
            {loading ? '上传中...' : `点击上传 ${accept}`}
          </p>
        </div>
        <input
          type="file"
          className="hidden"
          accept={accept}
          onChange={onUpload}
          disabled={loading}
        />
      </label>
    </div>
  )
}
