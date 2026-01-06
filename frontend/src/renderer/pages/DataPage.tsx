import { useState, useEffect } from 'react'
import { Upload, FileSpreadsheet, Trash2, Download, Loader2, AlertCircle, RefreshCw, CheckCircle2 } from 'lucide-react'
import { useDataStore } from '../store/dataStore'
import { useTaskStore } from '../store/taskStore'
import type { DataItem } from '@shared/types'

export function DataPage() {
  const [previewData, setPreviewData] = useState<any>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // 工参更新相关状态
  const [selectedFullParamId, setSelectedFullParamId] = useState<string>('')
  const [selectedCurrentParamId, setSelectedCurrentParamId] = useState<string>('')
  const [updateSuccess, setUpdateSuccess] = useState<string | null>(null)
  // 全局任务状态 - 用于持久化显示运行中的任务
  const [globalTaskRunning, setGlobalTaskRunning] = useState(false)

  const {
    items,
    loading,
    uploadingType,
    error,
    fetchList,
    uploadExcel,
    uploadMap,
    deleteItem,
    updateParameters,
    getUpdateTaskStatus
  } = useDataStore()

  useEffect(() => {
    fetchList()
  }, [fetchList])

  // 检查全局任务状态，确保切换页面后仍能显示运行中的任务
  useEffect(() => {
    const checkTaskStatus = () => {
      const status = getUpdateTaskStatus()
      const isRunning = status === 'running'
      setGlobalTaskRunning(isRunning)
    }

    // 初始检查
    checkTaskStatus()

    // 定期检查任务状态（每秒）
    const interval = setInterval(checkTaskStatus, 1000)

    return () => clearInterval(interval)
  }, [getUpdateTaskStatus])

  const isDesktop = !!(window as any).electronAPI;

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, type: 'excel' | 'map', context: string) => {
    const file = event.target.files?.[0]
    if (!file) return

    // 详尽日志
    console.log('[Upload] Starting upload process');
    console.log('[Upload] Mode:', isDesktop ? 'Desktop' : 'Web Browser');
    
    let filePath = (file as any).path;
    
    if (!filePath && (window as any).electronAPI?.getFilePath) {
        try {
            filePath = (window as any).electronAPI.getFilePath(file);
        } catch (e) {
            console.error('[Upload] Error getting path:', e);
        }
    }
    
    console.log('[Upload] Path Captured:', filePath || 'NULL (Browser Restriction)');

    const uploadFn = type === 'excel' ? uploadExcel : uploadMap
    const success = await uploadFn(file, context)
    if (success) {
      event.target.value = ''
    }
  }

  const handleDownload = async (item: DataItem) => {
    try {
        console.log('[Download] Requesting:', item.id);
        const url = `/api/v1/data/${item.id}/download`;
        
        // 强制使用 Fetch + Blob 模式，这种方式在 Electron 和浏览器中最稳定
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const blob = await response.blob();
        if (blob.size === 0) throw new Error('文件内容为空');

        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.setAttribute('download', item.name); // 显式设置文件名
        document.body.appendChild(link);
        link.click();
        
        // 清理
        setTimeout(() => {
            document.body.removeChild(link);
            window.URL.revokeObjectURL(blobUrl);
        }, 100);
        
        console.log('[Download] Success');
    } catch (err: any) {
        console.error('[Download] Failed:', err);
        alert(`下载失败: ${err.message || '未知错误'}`);
    }
  }

  const handleUpdateParameters = async () => {
     if (!selectedFullParamId || !selectedCurrentParamId) return
     
     setUpdateSuccess(null)
     try {
         const result = await updateParameters(selectedFullParamId, selectedCurrentParamId)
         console.log('Update parameters result:', result);
         if (result?.success) {
             await fetchList();
             
             // 使用后端返回的新文件名
             const newFileName = result?.data?.newFileName;
             const savedToOriginal = result?.data?.savedToOriginal;
             const updatedItems = useDataStore.getState().items;
             const newFile = [...updatedItems].sort((a, b) => 
                 new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime()
             )[0];
             console.log('Newest file:', newFile);

             if (newFile?.originalPath && savedToOriginal) {
                 // 获取目录路径和文件名
                 const originalDir = newFile.originalPath.substring(0, newFile.originalPath.lastIndexOf('\\') + 1);
                 const fullPath = `${originalDir}${newFileName}`;
                 setUpdateSuccess(`更新成功！已保存至：\n${fullPath}`);
             } else if (newFile?.originalPath) {
                 // 如果没有保存到原始路径，显示系统内保存提示
                 setUpdateSuccess('更新成功！文件已保存在系统内 (由于未记录原路径，无法写回原文件夹)，请手动下载。');
             } else {
                 setUpdateSuccess('更新成功！文件已保存在系统内，请手动下载。');
             }
             
             setSelectedFullParamId('')
             setSelectedCurrentParamId('')
         }
     } catch (err: any) {
         console.error('Update failed:', err);
     }
   }

  // 筛选文件列表
  const fullParamFiles = items.filter(i => i.fileType === 'full_params')
  const currentParamFiles = items.filter(i => i.type === 'map')

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">数据管理</h1>
        <div className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-2 ${
            isDesktop ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-yellow-100 text-yellow-700 border border-yellow-200'
        }`}>
            <div className={`w-2 h-2 rounded-full ${isDesktop ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'}`} />
            {isDesktop ? '桌面模式 (已连接 Electron)' : '浏览器模式 (受限)'}
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-red-700">
          <AlertCircle size={20} />
          <span>{error}</span>
          <button onClick={() => fetchList()} className="ml-auto text-sm underline">重试</button>
        </div>
      )}
      
      {/* 成功提示 */}
      {updateSuccess && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3 text-green-700 whitespace-pre-wrap">
          <CheckCircle2 size={20} className="shrink-0" />
          <span className="flex-grow">{updateSuccess}</span>
          <button 
            onClick={() => setUpdateSuccess(null)}
            className="text-green-700 hover:text-green-900 transition-colors duration-200 p-1 hover:bg-green-100 rounded-full"
            aria-label="关闭"
          >
            ✕
          </button>
        </div>
      )}

      {!isDesktop && (
          <div className="mb-6 p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-700">
              提示：您当前正在使用浏览器访问。若要实现“更新后保存到原文件夹”，请运行 <strong>start_app.bat</strong> 使用桌面应用。
          </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-8">
            {/* 文件上传 */}
            <div className="bg-card p-6 rounded-lg border border-border">
            <h2 className="text-xl font-semibold mb-4">导入数据</h2>

            <div className="space-y-4">
                <UploadArea
                title="全量工参"
                accept=".xlsx,.xls"
                onUpload={(e) => handleFileUpload(e, 'excel', 'full_params')}
                loading={loading && uploadingType === 'full_params'}
                icon={<FileSpreadsheet size={32} />}
                />
                <UploadArea
                title="待规划小区"
                accept=".xlsx,.xls"
                onUpload={(e) => handleFileUpload(e, 'excel', 'target_cells')}
                loading={loading && uploadingType === 'target_cells'}
                icon={<FileSpreadsheet size={32} />}
                />
                <UploadArea
                title="现网工参"
                accept=".zip"
                onUpload={(e) => handleFileUpload(e, 'map', 'current_params')}
                loading={loading && uploadingType === 'current_params'}
                icon={<Upload size={32} />}
                />
            </div>
            </div>

            {/* 工参更新 */}
            <div className="bg-card p-6 rounded-lg border border-border">
                <h2 className="text-xl font-semibold mb-4">工参更新</h2>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">选择全量工参</label>
                        <select 
                            className="w-full p-2 border rounded-md bg-background"
                            value={selectedFullParamId}
                            onChange={(e) => setSelectedFullParamId(e.target.value)}
                        >
                            <option value="">请选择文件...</option>
                            {fullParamFiles.map(f => (
                                <option key={f.id} value={f.id}>
                                    {f.name} {f.originalPath ? '✓' : '(无路径)'}
                                </option>
                            ))}
                        </select>
                        <p className="text-[10px] text-muted-foreground mt-1">注：只有带 ✓ 的文件更新后才能自动保存到原目录</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">选择现网工参 (ZIP)</label>
                        <select 
                            className="w-full p-2 border rounded-md bg-background"
                            value={selectedCurrentParamId}
                            onChange={(e) => setSelectedCurrentParamId(e.target.value)}
                        >
                            <option value="">请选择文件...</option>
                            {currentParamFiles.map(f => (
                                <option key={f.id} value={f.id}>{f.name}</option>
                            ))}
                        </select>
                    </div>
                    <button
                        onClick={handleUpdateParameters}
                        disabled={(loading && !uploadingType) || globalTaskRunning || !selectedFullParamId || !selectedCurrentParamId}
                        className="w-full py-2 px-4 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {(loading && !uploadingType) || globalTaskRunning ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
                        {(loading && !uploadingType) || globalTaskRunning ? '更新中...' : '开始更新'}
                    </button>
                </div>
            </div>
        </div>

        {/* 数据列表 */}
        <div className="bg-card p-6 rounded-lg border border-border h-full">
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
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
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
                    <div className="text-xs text-muted-foreground mt-1 flex justify-between pr-4">
                      <span>
                        {item.type === 'excel' ? (
                            item.metadata?.LTESiteCount 
                                ? `LTE: ${item.metadata.LTESiteCount}站/${item.metadata.LTESectorCount}小区 | NR: ${item.metadata.NRSiteCount}站/${item.metadata.NRSectorCount}小区`
                                : (item.fileType === 'full_params' ? '全量工参' : '待规划小区')
                        ) : (
                            'ZIP文件'
                        )}
                      </span>
                      {item.originalPath && <span className="text-[10px] text-blue-500">已记录路径</span>}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDownload(item)
                      }}
                      className="p-2 hover:bg-background rounded text-primary"
                      title="下载"
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
  
  // 如果是文件列表（ZIP文件）
  if (data.files) {
      return (
          <div>
              <p className="text-sm text-muted-foreground mb-4">
                  包含 {data.files.length} 个文件
              </p>
              <div className="max-h-60 overflow-y-auto border rounded-md">
                  <ul className="divide-y">
                      {data.files.map((file: string, index: number) => (
                          <li key={index} className="p-2 text-sm hover:bg-muted/50">
                              {file}
                          </li>
                      ))}
                  </ul>
              </div>
          </div>
      )
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
