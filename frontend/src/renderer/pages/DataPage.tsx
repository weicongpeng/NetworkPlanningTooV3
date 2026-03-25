import { useState, useEffect } from 'react'
import { Upload, FileSpreadsheet, Trash2, Download, Loader2, AlertCircle, RefreshCw, CheckCircle2, Layers, FileDown, MapPin, Navigation } from 'lucide-react'
import { useDataStore } from '../store/dataStore'
import { dataApi } from '../services/api'
import type { DataItem } from '@shared/types'
import { DATA_REFRESH_EVENT, triggerDataRefresh } from '../store/dataStore'
import { mapDataService } from '../services/mapDataService'
import { useTranslation } from 'react-i18next'

export function DataPage() {
  const { t } = useTranslation()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // 工参更新相关状态
  const [selectedFullParamId, setSelectedFullParamId] = useState<string>('')
  const [selectedCurrentParamId, setSelectedCurrentParamId] = useState<string>('')
  const [updateSuccess, setUpdateSuccess] = useState<string | null>(null)

  // 上传成功消息
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null)

  // 各上传项的状态
  const [uploadStatus, setUploadStatus] = useState<Record<string, 'idle' | 'success' | 'error'>>({
    full_params: 'idle',
    target_cells: 'idle',
    current_params: 'idle',
    map_layer: 'idle',
    geo_data: 'idle',
  })

  const {
    items,
    loading,
    uploadingType,
    isUpdating,
    error,
    fetchList,
    uploadExcel,
    uploadMap,
    uploadGeoData,
    deleteItem,
    updateParameters,
  } = useDataStore()

  // 初始化数据列表 + 监听跨页面刷新事件
  useEffect(() => {
    fetchList(1, 50)

    // 监听数据刷新事件（从其他页面触发，如PCI应用后）
    const handleDataRefresh = () => {
      console.log('[DataPage] 收到数据刷新事件，正在刷新列表...')
      fetchList(1, 50, true)  // 强制刷新，忽略缓存
    }

    window.addEventListener(DATA_REFRESH_EVENT, handleDataRefresh)

    return () => {
      window.removeEventListener(DATA_REFRESH_EVENT, handleDataRefresh)
    }
  }, []) // 修复：移除 fetchList 依赖，使用空依赖数组，避免事件监听器被反复移除/添加导致事件丢失

  const isDesktop = !!(window as any).electronAPI

  const handleDownloadTemplate = async (templateType: 'full_params' | 'target_cells') => {
    try {
      // 确定下载文件名
      const filename = templateType === 'full_params' ? 'ProjectParameter_mongoose.xlsx' : 'cell-tree-export.xlsx'
      const url = `/api/v1/data/template/${templateType}`

      console.log('[Template Download] Requesting:', templateType, 'as', filename)

      // 强制使用 Fetch + Blob 模式，这种方式在 Electron 和浏览器中最稳定
      const response = await fetch(url)
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)

      const blob = await response.blob()
      if (blob.size === 0) throw new Error('文件内容为空')

      console.log('[Template Download] Blob size:', blob.size)

      const blobUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = blobUrl
      link.setAttribute('download', filename) // 显式设置文件名
      document.body.appendChild(link)
      link.click()

      // 清理
      setTimeout(() => {
        document.body.removeChild(link)
        window.URL.revokeObjectURL(blobUrl)
      }, 100)

      console.log('[Template Download] Success:', filename)
    } catch (err: any) {
      console.error('[Template Download] Failed:', err)
      alert(`下载模板失败: ${err.message || '未知错误'}`)
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, type: 'excel' | 'map', context: string) => {
    const files = Array.from(event.target.files || [])
    if (files.length === 0) return

    // 详尽日志
    console.log('[Upload] Starting upload process')
    console.log('[Upload] Mode:', isDesktop ? 'Desktop' : 'Web Browser')
    console.log('[Upload] Files:', files.map(f => f.name).join(', '))
    console.log('[Upload] Type:', type, 'Context:', context)

    // 根据类型选择上传函数
    let uploadFn
    if (context === 'geo_data') {
      uploadFn = uploadGeoData
    } else {
      uploadFn = type === 'excel' ? uploadExcel : uploadMap
    }

    // 设置上传状态为进行中
    setUploadStatus(prev => ({ ...prev, [context]: 'idle' }))

    // 多选文件上传逻辑（仅用于图层文件）
    if (files.length > 1) {
      console.log('[Upload] Multiple files detected, processing sequentially')
      let allSuccess = true

      for (const file of files) {
        let filePath = (file as any).path

        if (!filePath && (window as any).electronAPI?.getFilePath) {
          try {
            filePath = await (window as any).electronAPI.getFilePath(file)
          } catch (e) {
            console.error('[Upload] Error getting path:', e)
          }
        }

        console.log('[Upload] Path Captured:', filePath || 'NULL (Browser Restriction)')

        const success = await uploadFn(file, filePath || undefined)
        if (!success) {
          allSuccess = false
        }
      }

      if (allSuccess) {
        event.target.value = ''
        setUploadStatus(prev => ({ ...prev, [context]: 'success' }))
        setTimeout(() => setUploadStatus(prev => ({ ...prev, [context]: 'idle' })), 3000)

        // 清除地图数据缓存，确保 pciDataSyncService 能获取到最新数据
        await mapDataService.clearCache()

        // 触发数据刷新事件，通知其他页面（PCI、邻区、TAC）重新加载数据
        triggerDataRefresh()
        console.log('[DataPage] 已触发数据刷新事件')
      } else {
        setUploadStatus(prev => ({ ...prev, [context]: 'error' }))
        setTimeout(() => setUploadStatus(prev => ({ ...prev, [context]: 'idle' })), 3000)
      }
    } else {
      // 单文件上传
      const file = files[0]

      let filePath = (file as any).path

      if (!filePath && (window as any).electronAPI?.getFilePath) {
        try {
          filePath = await (window as any).electronAPI.getFilePath(file)
        } catch (e) {
          console.error('[Upload] Error getting path:', e)
        }
      }

      console.log('[Upload] Path Captured:', filePath || 'NULL (Browser Restriction)')

      const success = await uploadFn(file, filePath || undefined)
      if (success) {
        event.target.value = ''
        setUploadStatus(prev => ({ ...prev, [context]: 'success' }))
        setTimeout(() => setUploadStatus(prev => ({ ...prev, [context]: 'idle' })), 3000)

        // 清除地图数据缓存，确保 pciDataSyncService 能获取到最新数据
        await mapDataService.clearCache()

        // 地理化数据上传成功提示
        if (context === 'geo_data') {
          setUploadSuccess(`✅ 地理化数据「${file.name}」上传成功！已导入 ${items.filter(i => i.fileType === 'geo_data').length + 1} 个数据文件`)
          setTimeout(() => setUploadSuccess(null), 3000)
        }

        // 触发数据刷新事件，通知其他页面（PCI、邻区、TAC）重新加载数据
        triggerDataRefresh()
        console.log('[DataPage] 已触发数据刷新事件')
      } else {
        setUploadStatus(prev => ({ ...prev, [context]: 'error' }))
        setTimeout(() => setUploadStatus(prev => ({ ...prev, [context]: 'idle' })), 3000)
      }
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

  const handleDelete = async (item: DataItem) => {
    const itemName = item.name || '未知文件'

    // 确认删除
    const confirmed = confirm(`确定要删除 "${itemName}" 吗？\n\n删除后将无法恢复，且会影响使用该数据的规划结果。`)
    if (!confirmed) return

    try {
      // 先尝试普通删除
      let result = await deleteItem(item.id)

      // 如果删除失败，询问是否强制删除
      if (!result) {
        const forceDelete = confirm(
          `删除失败：文件可能正在被其他程序使用。\n\n` +
          `是否要强制删除？\n` +
          `• 强制删除会从索引中移除该数据\n` +
          `• 部分文件可能需要手动清理\n` +
          `• 建议先关闭相关程序后再试`
        )

        if (forceDelete) {
          // 使用 dataApi 的强制删除
          result = await dataApi.delete(item.id, true)
          if (result?.success) {
            alert('已从索引中移除。如果后续遇到问题，请刷新页面或重新导入数据。')
            await fetchList(1, 50, true)
          } else {
            alert('强制删除失败。请尝试：\n1. 关闭所有 Excel 文件\n2. 重启应用后再试\n3. 手动删除 data 目录下的对应文件夹')
          }
        } else {
          alert('删除已取消。')
        }
      } else {
        await fetchList(1, 50, true)
      }
    } catch (err: any) {
      console.error('[Delete] Failed:', err)
      alert(`删除失败: ${err.message || '未知错误'}\n\n可能原因：\n• 文件正在被其他程序使用\n• 磁盘权限不足\n• 索引文件损坏`)
    }
  }

  const handleUpdateParameters = async () => {
     if (!selectedFullParamId || !selectedCurrentParamId) return

     setUpdateSuccess(null)
     try {
         const result = await updateParameters(selectedFullParamId, selectedCurrentParamId)
         console.log('Update parameters result:', result);
         if (result?.success) {
            await fetchList(1, 50);

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

  const handleCleanupIndex = async () => {
    const confirmed = confirm(
      '确定要清理无效索引吗？\n\n' +
      '这将会移除所有文件不存在但索引中仍然存在的记录。\n' +
      '此操作不会影响有效的数据文件。'
    )

    if (!confirmed) return

    try {
      const result = await dataApi.cleanupIndex()
      if (result?.success) {
        const removed = result.data?.removed || 0
        const items = result.data?.items || []

        if (removed > 0) {
          alert(`清理完成！已移除 ${removed} 个无效索引项：\n\n${items.map((i: any) => `• ${i.name}`).join('\n')}`)
        } else {
          alert('索引状态良好，没有发现无效项。')
        }

        await fetchList(1, 50, true)
      }
    } catch (err: any) {
      console.error('[Cleanup] Failed:', err)
      alert(`清理失败: ${err.message || '未知错误'}`)
    }
  }

  // 筛选文件列表
  const fullParamFiles = items.filter(i => i.fileType === 'full_params')
  const currentParamFiles = items.filter(i => i.type === 'map')

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">{t('data.title')}</h1>
        <div className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-2 ${
            isDesktop ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-yellow-100 text-yellow-700 border border-yellow-200'
        }`}>
            <div className={`w-2 h-2 rounded-full ${isDesktop ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'}`} />
            {isDesktop ? (t('data.desktopMode') || '桌面模式 (已连接 Electron)') : (t('data.browserMode') || '浏览器模式 (受限)')}
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-red-700">
          <AlertCircle size={20} />
          <span>{error}</span>
          <button onClick={() => fetchList(1, 50)} className="ml-auto text-sm underline">{t('data.retry') || '重试'}</button>
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
            aria-label={t('data.close') || '关闭'}
          >
            ✕
          </button>
        </div>
      )}

      {/* 上传成功提示 */}
      {uploadSuccess && (
        <div className="mb-6 p-4 bg-purple-50 border border-purple-200 rounded-lg flex items-center gap-3 text-purple-700">
          <CheckCircle2 size={20} className="shrink-0" />
          <span className="flex-grow">{uploadSuccess}</span>
          <button
            onClick={() => setUploadSuccess(null)}
            className="text-purple-700 hover:text-purple-900 transition-colors duration-200 p-1 hover:bg-purple-100 rounded-full"
            aria-label={t('data.close') || '关闭'}
          >
            ✕
          </button>
        </div>
      )}

      {!isDesktop && (
          <div className="mb-6 p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-700">
              {t('data.browserTip') || '提示：您当前正在使用浏览器访问。若要实现"更新后保存到原文件夹"，请运行 start_app.bat 使用桌面应用。'}
          </div>
      )}

      {/* 工具栏 */}
      <div className="mb-6 flex justify-between items-center">
        <div className="flex gap-2">
          <button
            onClick={() => fetchList(1, 50, true)}
            className="px-4 py-2 bg-card border border-border rounded-lg hover:bg-muted transition-colors flex items-center gap-2"
          >
            <RefreshCw size={16} />
            {t('common.refresh') || '刷新列表'}
          </button>
          <button
            onClick={handleCleanupIndex}
            className="px-4 py-2 bg-card border border-border rounded-lg hover:bg-muted transition-colors flex items-center gap-2"
            title={t('data.cleanIndexTip') || '清理无效的索引项（文件不存在但索引中仍然存在的记录）'}
          >
            <RefreshCw size={16} />
            {t('data.cleanIndex') || '清理索引'}
          </button>
        </div>
        <div className="text-sm text-muted-foreground">
          {t('data.dataCount', { count: items.length }) || `共 ${items.length} 条数据`}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-8">
            {/* 文件上传 */}
            <div className="bg-card p-3 rounded-lg border border-border">
            <h2 className="text-xl font-semibold mb-2">{t('data.importData') || '导入数据'}</h2>

             <div className="space-y-2">
                <div className="flex items-center gap-2">
                    <div className="flex-1">
                        <UploadArea
                            title={t('data.fullParams') || '全量工参'}
                            accept=".xlsx,.xls"
                            onUpload={(e) => handleFileUpload(e, 'excel', 'full_params')}
                            loading={loading && uploadingType === 'full_params'}
                            icon={<FileSpreadsheet size={20} />}
                            inline={true}
                            status={uploadStatus.full_params}
                        />
                    </div>
                    <div className="w-24">
                        <button
                            onClick={() => handleDownloadTemplate('full_params')}
                            className="w-full px-2 py-1.5 bg-blue-500 text-white rounded text-xs hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                            title={t('data.downloadTemplate') || '下载全量工参模板'}
                        >
                            <FileDown size={12} />
                            <span>{t('data.template') || '模板'}</span>
                        </button>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex-1">
                        <UploadArea
                            title={t('data.targetCells') || '待规划小区'}
                            accept=".xlsx,.xls"
                            onUpload={(e) => handleFileUpload(e, 'excel', 'target_cells')}
                            loading={loading && uploadingType === 'target_cells'}
                            icon={<FileSpreadsheet size={20} />}
                            inline={true}
                            status={uploadStatus.target_cells}
                        />
                    </div>
                    <div className="w-24">
                        <button
                            onClick={() => handleDownloadTemplate('target_cells')}
                            className="w-full px-2 py-1.5 bg-blue-500 text-white rounded text-xs hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                            title={t('data.downloadTemplate') || '下载待规划小区模板'}
                        >
                            <FileDown size={12} />
                            <span>{t('data.template') || '模板'}</span>
                        </button>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex-1">
                        <UploadArea
                            title="现网工参"
                            accept=".zip"
                            onUpload={(e) => handleFileUpload(e, 'map', 'current_params')}
                            loading={loading && uploadingType === 'current_params'}
                            icon={<Upload size={20} />}
                            inline={true}
                            description="中兴网管300脚本导出数据"
                            status={uploadStatus.current_params}
                        />
                    </div>
                    <div className="w-24">
                        {/* 现网工参不需要模板下载 */}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex-1">
                        <UploadArea
                            title="图层文件"
                            accept=".zip,.tab,.mif"
                            onUpload={(e) => handleFileUpload(e, 'map', 'map_layer')}
                            loading={loading && uploadingType === 'map_layer'}
                            icon={<Layers size={20} />}
                            multiple={true}
                            inline={true}
                            status={uploadStatus.map_layer}
                        />
                    </div>
                    <div className="w-24">
                        {/* 图层文件不需要模板下载 */}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex-1">
                        <UploadArea
                            title="地理化数据"
                            accept=".xlsx,.xls,.csv,.txt"
                            onUpload={(e) => handleFileUpload(e, 'excel', 'geo_data')}
                            loading={loading && uploadingType === 'geo_data'}
                            icon={<MapPin size={20} className="text-purple-600" />}
                            description="自动识别点状/扇区"
                            inline={true}
                            status={uploadStatus.geo_data}
                        />
                    </div>
                    <div className="w-24">
                        {/* 地理化数据不需要模板下载 */}
                    </div>
                </div>
            </div>
            </div>

            {/* 工参更新 */}
            <div className="bg-card p-3 rounded-lg border border-border -mt-6">
                <h2 className="text-xl font-semibold mb-2">工参更新</h2>
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
                        disabled={isUpdating || !selectedFullParamId || !selectedCurrentParamId}
                        className="w-full py-2 px-4 bg-blue-400 text-white rounded-md hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {isUpdating ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
                        {isUpdating ? '更新中...' : '开始更新'}
                    </button>
                </div>
            </div>
        </div>

        {/* 数据列表 */}
        <div className="bg-card p-6 rounded-lg border border-border h-full">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">已导入数据</h2>
            <button
              onClick={() => fetchList(1, 50, true)}
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
                      {/* 文件类型图标 */}
                      <div className={`p-1.5 rounded-md ${
                        item.fileType === 'geo_data' ? 'bg-purple-100' :
                        item.fileType === 'full_params' ? 'bg-blue-100' :
                        item.fileType === 'target_cells' ? 'bg-orange-100' :
                        item.type === 'excel' ? 'bg-green-100' :
                        item.type === 'map' ? 'bg-cyan-100' :
                        'bg-gray-100'
                      }`}>
                        {item.fileType === 'geo_data' ? (
                          item.geometryType === 'sector'
                            ? <Navigation size={16} className="text-purple-600" />
                            : <MapPin size={16} className="text-purple-600" />
                        ) : item.fileType === 'full_params' ? (
                          <FileSpreadsheet size={16} className="text-blue-600" />
                        ) : item.fileType === 'target_cells' ? (
                          <FileSpreadsheet size={16} className="text-orange-600" />
                        ) : item.type === 'excel' ? (
                          <FileSpreadsheet size={16} className="text-green-600" />
                        ) : item.subType === 'mapinfo' ? (
                          <Layers size={16} className="text-cyan-600" />
                        ) : (
                          <Upload size={16} className="text-gray-600" />
                        )}
                      </div>
                      <span className="truncate font-medium">{item.name}</span>
                      {/* 文件类型标签 */}
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                        item.fileType === 'geo_data'
                          ? 'bg-purple-100 text-purple-700'
                          : item.fileType === 'full_params'
                          ? 'bg-blue-100 text-blue-700'
                          : item.fileType === 'target_cells'
                          ? 'bg-orange-100 text-orange-700'
                          : item.fileType === 'current_params'
                          ? 'bg-indigo-100 text-indigo-700'
                          : item.subType === 'mapinfo'
                          ? 'bg-cyan-100 text-cyan-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}>
                        {item.fileType === 'geo_data'
                          ? (item.geometryType === 'sector' ? '扇区数据' : '地理化')
                          : item.fileType === 'full_params'
                          ? '全量工参'
                          : item.fileType === 'target_cells'
                          ? '待规划'
                          : item.fileType === 'current_params'
                          ? '现网工参'
                          : item.subType === 'mapinfo'
                          ? 'MapInfo'
                          : item.type === 'excel'
                          ? 'Excel'
                          : 'ZIP'}
                      </span>
                      {/* 路径记录状态 */}
                      {item.originalPath && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 flex items-center gap-0.5">
                          <CheckCircle2 size={10} />
                          已记录
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1.5 flex items-center gap-3">
                      <span>
                        {item.fileType === 'geo_data' ? (
                          <>
                            {item.geometryType === 'sector'
                              ? `${item.metadata?.pointCount || 0} 个扇区`
                              : `${item.metadata?.pointCount || 0} 个点`}
                          </>
                        ) : item.type === 'excel' ? (
                            item.metadata?.LTESiteCount
                                ? `LTE ${item.metadata.LTESiteCount}站/${item.metadata.LTESectorCount}小区 · NR ${item.metadata.NRSiteCount}站/${item.metadata.NRSectorCount}小区`
                                : (item.fileType === 'full_params'
                                    ? '全量工参数据'
                                    : (item.fileType === 'target_cells'
                                        ? '待规划小区数据'
                                        : (item.fileType === 'default' && item.metadata?.siteCount
                                            ? `${item.metadata.siteCount} 个基站`
                                            : 'Excel 数据')))
                        ) : (
                            item.type === 'map'
                                ? (item.subType === 'mapinfo'
                                    ? `${item.metadata?.layerCount || 0} 个图层`
                                    : '压缩文件')
                                : '未知类型'
                        )}
                      </span>
                      <span className="text-[10px] opacity-60">
                        {new Date(item.uploadDate).toLocaleDateString('zh-CN')}
                      </span>
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
                        handleDelete(item)
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
  loading = false,
  multiple = false,
  description,
  inline = false,
  status = 'idle'
}: {
  title: string
  accept: string
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
  icon: React.ReactNode
  loading?: boolean
  multiple?: boolean
  description?: string
  inline?: boolean
  status?: 'idle' | 'success' | 'error'
}) {
  // 根据状态获取边框颜色
  const getBorderClass = () => {
    if (loading) return 'border-muted bg-muted/50 cursor-not-allowed'
    if (status === 'success') return 'border-green-500 bg-green-50 hover:bg-green-100'
    if (status === 'error') return 'border-red-500 bg-red-50 hover:bg-red-100'
    return 'border-border hover:border-primary hover:bg-primary/5'
  }

  if (inline) {
    // 行内布局：标签和上传框在同一行
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium whitespace-nowrap w-20 text-right">{title}：</span>
        <label className={`flex-1 flex items-center justify-center h-8 border-2 border-dashed rounded cursor-pointer transition-all duration-200 ${getBorderClass()}`}>
          <div className="flex items-center gap-2 px-3 text-muted-foreground">
            {loading ? (
              <>
                <Loader2 className="animate-spin text-primary" size={14} />
                <p className="text-xs text-primary font-medium whitespace-nowrap">解析中...</p>
              </>
            ) : status === 'success' ? (
              <>
                <CheckCircle2 className="text-green-500" size={14} />
                <p className="text-xs text-green-600 font-medium whitespace-nowrap">上传成功</p>
              </>
            ) : status === 'error' ? (
              <>
                <AlertCircle className="text-red-500" size={14} />
                <p className="text-xs text-red-600 font-medium whitespace-nowrap">上传失败</p>
              </>
            ) : (
              <>
                <span className="flex-shrink-0">{icon}</span>
                <p className="text-xs whitespace-nowrap">
                  点击上传 {accept}
                </p>
                {description && (
                  <span className="text-[10px] text-muted-foreground ml-1 whitespace-nowrap hidden sm:inline">· {description}</span>
                )}
              </>
            )}
          </div>
          <input
            type="file"
            className="hidden"
            accept={accept}
            onChange={onUpload}
            disabled={loading}
            multiple={multiple}
          />
        </label>
      </div>
    )
  }

  // 默认布局（垂直布局）
  return (
    <div>
      <label className="block text-xs font-medium mb-0.5">{title}</label>
      <label className={`flex flex-col items-start justify-center w-full h-10 border-2 border-dashed rounded cursor-pointer transition-all duration-200 ${getBorderClass()}`}>
        <div className="flex flex-row items-center gap-3 w-full px-3 text-muted-foreground">
          {loading ? (
            <>
              <Loader2 className="animate-spin text-primary" size={16} />
              <p className="text-xs text-primary font-medium">解析中...</p>
            </>
          ) : status === 'success' ? (
            <>
              <CheckCircle2 className="text-green-500" size={16} />
              <p className="text-xs text-green-600 font-medium">上传成功</p>
            </>
          ) : status === 'error' ? (
            <>
              <AlertCircle className="text-red-500" size={16} />
              <p className="text-xs text-red-600 font-medium">上传失败</p>
            </>
          ) : (
            <>
              <span className="flex-shrink-0 transition-transform duration-200 group-hover:scale-110">{icon}</span>
              <p className="text-xs flex-1 text-center">
                点击上传 {accept}
              </p>
            </>
          )}
        </div>
        {description && !loading && status === 'idle' && (
          <p className="text-[10px] text-muted-foreground mt-1 px-2">{description}</p>
        )}
        <input
          type="file"
          className="hidden"
          accept={accept}
          onChange={onUpload}
          disabled={loading}
          multiple={multiple}
        />
      </label>
    </div>
  )
}
