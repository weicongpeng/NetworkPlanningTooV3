import axios from 'axios'
import type {
  ApiResponse,
  LicenseStatus,
  NeighborConfig,
  NeighborResult,
  PCIConfig,
  PCIResult,
  UploadResponse,
  DataItem,
  TaskProgress
} from '@shared/types'

const API_BASE_URL = '/api/v1'

// 开发环境下的直接后端 URL（绕过 Vite 代理的 multipart/form-data 问题）
// 使用环境变量配置
const DEV_BACKEND_URL = import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:8000/api/v1`

// 检测是否是开发环境
const isDev = import.meta.env.DEV

console.log('[API] Environment:', { isDev, API_BASE_URL, DEV_BACKEND_URL })

// 创建axios实例
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 300000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// 创建专门用于文件上传的 axios 实例（不设置默认 Content-Type）
// 在开发环境中直接访问后端，避免 Vite 代理的 multipart/form-data 问题
const uploadClient = axios.create({
  baseURL: isDev ? DEV_BACKEND_URL : API_BASE_URL,
  timeout: 300000
})

// uploadClient 请求拦截器 - 用于调试
uploadClient.interceptors.request.use(
  (config) => {
    console.log('[uploadClient Request]', {
      url: config.url,
      method: config.method,
      headers: config.headers,
      dataType: config.data instanceof FormData ? 'FormData' : typeof config.data,
      // 如果是 FormData，打印 entries
      formDataEntries: config.data instanceof FormData
        ? Array.from(config.data.entries()).map(([key, value]) => [
            key,
            value instanceof File ? `File(${value.name}, ${value.size} bytes, ${value.type})` : value
          ])
        : 'N/A'
    })
    // 不要修改 Content-Type，让 axios 自动处理 FormData
    return config
  },
  (error) => {
    console.error('[uploadClient Request Error]', error)
    return Promise.reject(error)
  }
)

// 请求拦截器
apiClient.interceptors.request.use(
  (config) => {
    // 可以在这里添加token等
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// 响应拦截器
apiClient.interceptors.response.use(
  (response) => {
    // 对于二进制响应类型，直接返回完整的响应对象
    // 因为此时response.data已经是Blob或ArrayBuffer对象，不需要再解包
    if (response.request.responseType === 'blob' || response.request.responseType === 'arraybuffer') {
      return response
    }
    // 对于其他响应类型，返回response.data
    // 保持与API签名一致：返回 ApiResponse<T>
    return response.data
  },
  (error) => {
    console.error('API Error:', error)

    // 处理错误响应，返回统一格式
    if (error.response) {
      // 兼容detail和message字段
      let message = error.message

      // 对于二进制响应类型，我们无法解析错误信息
      if (error.response.request.responseType === 'blob' || error.response.request.responseType === 'arraybuffer') {
        return Promise.reject(new Error(message))
      }

      const data = error.response.data
      if (data) {
        // 后端FastAPI使用detail字段
        if (typeof data === 'string') {
          message = data
        } else if (data.detail) {
          message = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail)
        } else if (data.message) {
          message = data.message
        }
      }

      // 返回标准错误对象
      const errorObj = {
        success: false,
        message: message || '请求失败',
        code: error.response.status
      }
      return Promise.reject(errorObj)
    } else if (error.request) {
      // 请求已发送但没有收到响应
      return Promise.reject({
        success: false,
        message: '网络连接失败，请检查后端服务是否启动',
        code: 0
      })
    }

    // 其他错误
    return Promise.reject({
      success: false,
      message: error.message || '未知错误',
      code: -1
    })
  }
)

// 为 uploadClient 添加相同的响应拦截器
uploadClient.interceptors.response.use(
  (response) => {
    return response.data
  },
  (error) => {
    console.error('Upload API Error:', error)

    // 处理错误响应，返回统一格式
    if (error.response) {
      let message = error.message

      const data = error.response.data
      if (data) {
        if (typeof data === 'string') {
          message = data
        } else if (data.detail) {
          message = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail)
        } else if (data.message) {
          message = data.message
        }
      }

      const errorObj = {
        success: false,
        message: message || '请求失败',
        code: error.response.status
      }
      return Promise.reject(errorObj)
    } else if (error.request) {
      return Promise.reject({
        success: false,
        message: '网络连接失败，请检查后端服务是否启动',
        code: 0
      })
    }

    return Promise.reject({
      success: false,
      message: error.message || '未知错误',
      code: -1
    })
  }
)

// 许可证API
export const licenseApi = {
  // 获取许可证状态
  getStatus: async (): Promise<ApiResponse<LicenseStatus>> => {
    return apiClient.get('/license/status')
  },

  // 激活许可证
  activate: async (licenseKey: string): Promise<ApiResponse<{ success: boolean }>> => {
    return apiClient.post('/license/activate', { license_key: licenseKey })
  },

  // 上传许可证文件
  upload: async (file: File): Promise<ApiResponse<{ success: boolean }>> => {
    const formData = new FormData()
    formData.append('file', file)
    // 使用 uploadClient 发送
    return uploadClient.post('/license/upload', formData)
  }
}

// 数据管理API
export const dataApi = {
  // 上传工参文件 - 使用 axios 上传客户端
  uploadExcel: async (file: File | null, filePath?: string): Promise<ApiResponse<UploadResponse>> => {
    console.log('[uploadExcel] START - file:', file, 'filePath:', filePath)

    // 验证输入
    if (!file) {
      console.error('[uploadExcel] ERROR: file is null or undefined!')
      throw new Error('请选择要上传的文件')
    }

    const formData = new FormData()

    // 确保文件被正确添加
    formData.append('file', file)
    console.log('[uploadExcel] Added file to FormData:', {
      name: file.name,
      size: file.size,
      type: file.type
    })

    if (filePath && filePath !== 'undefined' && filePath !== 'null') {
      formData.append('file_path', filePath)
      console.log('[uploadExcel] Added file_path:', filePath)
    } else {
      console.log('[uploadExcel] Skipping file_path (not provided or invalid)')
    }

    // 验证 FormData
    const formDataEntries = Array.from(formData.entries())
    console.log('[uploadExcel] FormData entries:', formDataEntries.map(([key, value]) => [
      key,
      value instanceof File ? `File(${value.name}, ${value.size}b)` : value
    ]))

    // 在开发环境中，使用完整的后端 URL 绕过 Vite 代理
    const uploadUrl = isDev ? `${DEV_BACKEND_URL}/data/upload/excel` : '/api/v1/data/upload/excel'
    console.log('[uploadExcel] Upload URL:', uploadUrl, '(isDev:', isDev, ')')

    // 使用 axios uploadClient 发送请求
    // 不设置 Content-Type，让 axios 自动设置正确的 multipart/form-data 头（包括 boundary）
    const response = await uploadClient.post(uploadUrl, formData)

    console.log('[uploadExcel] Response status:', response.status)

    // 安全地访问响应头
    if (response.headers) {
      try {
        console.log('[uploadExcel] Response headers:', JSON.stringify(response.headers))
      } catch (e) {
        console.log('[uploadExcel] Response headers:', '(无法序列化)')
      }
    }

    // axios 响应拦截器已经返回了 response.data，所以 response 直接就是数据
    const result = response
    console.log('[uploadExcel] Success response:', result)
    return result
  },

  /** 上传地图文件并保存到服务器 - 使用原生 fetch API */
  uploadMap: async (file: File | null, filePath?: string): Promise<ApiResponse<any>> => {
    console.log('[uploadMap] START - file:', file, 'filePath:', filePath)

    // 验证输入
    if (!file) {
      console.error('[uploadMap] ERROR: file is null or undefined!')
      throw new Error('请选择要上传的文件')
    }

    const formData = new FormData()

    // 确保文件被正确添加
    formData.append('file', file)
    console.log('[uploadMap] Added file to FormData:', {
      name: file.name,
      size: file.size,
      type: file.type
    })

    if (filePath && filePath !== 'undefined' && filePath !== 'null') {
      formData.append('file_path', filePath)
      console.log('[uploadMap] Added file_path:', filePath)
    } else {
      console.log('[uploadMap] Skipping file_path (not provided or invalid)')
    }

    // 验证 FormData
    const formDataEntries = Array.from(formData.entries())
    console.log('[uploadMap] FormData entries:', formDataEntries.map(([key, value]) => [
      key,
      value instanceof File ? `File(${value.name}, ${value.size}b)` : value
    ]))

    // 使用原生 fetch API 发送请求
    const url = `${API_BASE_URL}/data/upload/map`
    console.log('[uploadMap] Sending fetch request to:', url)

    const response = await fetch(url, {
      method: 'POST',
      body: formData,
    })

    console.log('[uploadMap] Response status:', response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[uploadMap] Error response:', errorText)
      throw new Error(`上传失败: ${response.status} ${errorText}`)
    }

    const result = await response.json()
    console.log('[uploadMap] Success response:', result)
    return result
  },

  /** 上传地理化数据文件 */
  uploadGeoData: async (file: File | null, filePath?: string): Promise<ApiResponse<any>> => {
    console.log('[uploadGeoData] START - file:', file, 'filePath:', filePath)

    // 验证输入
    if (!file) {
      console.error('[uploadGeoData] ERROR: file is null or undefined!')
      throw new Error('请选择要上传的文件')
    }

    const formData = new FormData()

    // 确保文件被正确添加
    formData.append('file', file)
    console.log('[uploadGeoData] Added file to FormData:', {
      name: file.name,
      size: file.size,
      type: file.type
    })

    if (filePath && filePath !== 'undefined' && filePath !== 'null') {
      formData.append('file_path', filePath)
      console.log('[uploadGeoData] Added file_path:', filePath)
    } else {
      console.log('[uploadGeoData] Skipping file_path (not provided or invalid)')
    }

    // 验证 FormData
    const formDataEntries = Array.from(formData.entries())
    console.log('[uploadGeoData] FormData entries:', formDataEntries.map(([key, value]) => [
      key,
      value instanceof File ? `File(${value.name}, ${value.size}b)` : value
    ]))

    // 在开发环境中，使用完整的后端 URL 绕过 Vite 代理
    const uploadUrl = isDev ? `${DEV_BACKEND_URL}/data/upload/geo` : '/api/v1/data/upload/geo'
    console.log('[uploadGeoData] Upload URL:', uploadUrl, '(isDev:', isDev, ')')

    // 使用 uploadClient 发送请求
    const response = await uploadClient.post(uploadUrl, formData)
    console.log('[uploadGeoData] Success response:', response)
    return response
  },

  // 获取数据列表（支持分页，支持绕过缓存）
  list: async (page: number = 1, pageSize: number = 50, cacheBust: boolean = false): Promise<ApiResponse<DataItem[]> & { total?: number }> => {
    const cacheParam = cacheBust ? `&_t=${Date.now()}` : ''
    return apiClient.get(`/data/list?page=${page}&page_size=${pageSize}${cacheParam}`)
  },

  // 删除数据
  delete: async (id: string, force: boolean = false): Promise<ApiResponse<{ success: boolean }>> => {
    return apiClient.delete(`/data/${id}${force ? '?force=true' : ''}`)
  },

  /** 删除数据（内部方法，支持强制删除） */
  deleteData: async (dataId: string, force: boolean = false): Promise<boolean> => {
    try {
      const res = await apiClient.delete<ApiResponse<{ success: boolean }>>(`/data/${dataId}${force ? '?force=true' : ''}`)
      // Axios interceptor should have returned res.data, but to be safe:
      return (res as any).success || (res.data as any)?.success || false
    } catch (error) {
      console.error('Delete data error:', error)
      return false
    }
  },

  // 获取数据详情
  get: async (id: string): Promise<ApiResponse<any>> => {
    return apiClient.get(`/data/${id}`)
  },

  // 工参更新
  updateParameters: async (fullParamId: string, currentParamId: string): Promise<ApiResponse<{ newFileId: string; newFileName: string; savedToOriginal: boolean }>> => {
    return apiClient.post('/data/update-parameters', { fullParamId, currentParamId })
  },

  // 导入点数据
  importPoints: async (filePath: string): Promise<ApiResponse<any[]>> => {
    return apiClient.post('/data/import-points', { file_path: filePath })
  },

  // 下载模板
  downloadTemplate: async (templateType: 'full_params' | 'target_cells'): Promise<void> => {
    const url = `/data/template/${templateType}`

    // 强制使用 Fetch + Blob 模式，这种方式在 Electron 和浏览器中最稳定
    const response = await fetch(url)
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)

    const blob = await response.blob()
    if (blob.size === 0) throw new Error('文件内容为空')

    // 直接根据templateType设置文件名
    let filename = 'template.xlsx'
    if (templateType === 'full_params') {
      filename = 'ProjectParameter_mongoose.xlsx'
    } else if (templateType === 'target_cells') {
      filename = 'cell-tree-export.xlsx'
    }

    // 从响应头获取文件名作为备选（如果CORS允许的话）
    const contentDisposition = response.headers.get('content-disposition')
    console.log('[Template Download] Content-Disposition header:', contentDisposition)

    if (contentDisposition) {
      // 尝试多种文件名解析方式
      // 1. 标准 filename 格式: filename="filename"
      let filenameMatch = contentDisposition.match(/filename="([^"]+)"/i)
      if (filenameMatch) {
        filename = filenameMatch[1]
        console.log('[Template Download] Parsed filename from header (standard):', filename)
      } else {
        // 2. 简单 filename 格式: filename=filename
        filenameMatch = contentDisposition.match(/filename=([^;]+)/i)
        if (filenameMatch) {
          filename = filenameMatch[1]
          console.log('[Template Download] Parsed filename from header (simple):', filename)
        }
      }
    }

    console.log('[Template Download] Final filename:', filename, 'Blob size:', blob.size)

    const blobUrl = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = blobUrl
    link.setAttribute('download', filename)
    document.body.appendChild(link)
    link.click()

    // 清理
    setTimeout(() => {
      document.body.removeChild(link)
      window.URL.revokeObjectURL(blobUrl)
    }, 100)

    console.log('[Template Download] Success:', filename)
  },

  // 获取工参数据的列名
  getColumns: async (dataId: string, networkType?: 'LTE' | 'NR'): Promise<ApiResponse<{ columns: string[]; networkType?: string; total: number }>> => {
    const params = networkType ? `?network_type=${networkType}` : ''
    return apiClient.get(`/data/${dataId}/columns${params}`)
  },

  // 清理无效索引
  cleanupIndex: async (): Promise<ApiResponse<{ removed: number; items: Array<{ id: string; name: string; reason: string }> }>> => {
    return apiClient.post('/data/cleanup/index')
  }
}

// PCI规划API
export const pciApi = {
  // 开始规划
  plan: async (config: PCIConfig): Promise<ApiResponse<{ taskId: string; message: string }>> => {
    return apiClient.post('/pci/plan', config)
  },

  // 获取规划进度
  getProgress: async (taskId: string): Promise<ApiResponse<TaskProgress>> => {
    return apiClient.get(`/pci/progress/${taskId}`)
  },

  // 获取规划结果
  getResult: async (taskId: string): Promise<ApiResponse<PCIResult>> => {
    return apiClient.get(`/pci/result/${taskId}`)
  },

  // 导出结果
  export: async (taskId: string, format: 'xlsx' | 'csv'): Promise<Blob> => {
    const response = await apiClient.get(`/pci/export/${taskId}`, {
      responseType: 'blob',
      params: { format }
    })
    // 注意：对于blob响应，响应拦截器会返回完整的响应对象，而不是response.data
    // 因此需要直接访问response.data获取Blob对象
    return response.data  // Blob直接返回data
  },

  // 应用到工参
  applyToParams: async (taskId: string): Promise<ApiResponse<{ message: string; updatedCount: number }>> => {
    return apiClient.post(`/pci/apply-to-params/${taskId}`)
  }
}

// TAC核查API
export const tacApi = {
  // 开始核查
  plan: async (config: any): Promise<ApiResponse<{ taskId: string; message: string }>> => {
    return apiClient.post('/tac/plan', config)
  },

  // 获取核查进度
  getProgress: async (taskId: string): Promise<ApiResponse<TaskProgress>> => {
    return apiClient.get(`/tac/progress/${taskId}`)
  },

  // 获取核查结果
  getResult: async (taskId: string): Promise<ApiResponse<any>> => {
    return apiClient.get(`/tac/result/${taskId}`)
  },

  // 导出核查结果
  export: async (taskId: string, format: 'xlsx' | 'csv'): Promise<Blob> => {
    const response = await apiClient.get(`/tac/export/${taskId}`, {
      responseType: 'blob',
      params: { format }
    })
    return response.data
  }
}

// TAC规划API
export const tacPlanningApi = {
  // 开始规划
  plan: async (config: any): Promise<ApiResponse<{ taskId: string; message: string }>> => {
    return apiClient.post('/tac/planning/plan', config)
  },

  // 获取规划进度
  getProgress: async (taskId: string): Promise<ApiResponse<TaskProgress>> => {
    return apiClient.get(`/tac/planning/progress/${taskId}`)
  },

  // 获取规划结果
  getResult: async (taskId: string): Promise<ApiResponse<any>> => {
    return apiClient.get(`/tac/planning/result/${taskId}`)
  },

  // 导出规划结果
  export: async (taskId: string, format: 'xlsx' | 'csv'): Promise<Blob> => {
    const response = await apiClient.get(`/tac/planning/export/${taskId}`, {
      responseType: 'blob',
      params: { format }
    })
    return response.data
  }
}

// 邻区规划API
export const neighborApi = {
  // 开始规划
  plan: async (config: NeighborConfig): Promise<ApiResponse<{ taskId: string; message: string }>> => {
    return apiClient.post('/neighbor/plan', config)
  },

  // 获取规划进度
  getProgress: async (taskId: string): Promise<ApiResponse<TaskProgress>> => {
    return apiClient.get(`/neighbor/progress/${taskId}`)
  },

  // 获取规划结果
  getResult: async (taskId: string): Promise<ApiResponse<NeighborResult>> => {
    return apiClient.get(`/neighbor/result/${taskId}`)
  },

  // 导出结果
  export: async (taskId: string, format: 'xlsx' | 'csv'): Promise<Blob> => {
    const response = await apiClient.get(`/neighbor/export/${taskId}`, {
      responseType: 'blob',
      params: { format }
    })
    // 注意：对于blob响应，响应拦截器会返回完整的响应对象，而不是response.data
    // 因此需要直接访问response.data获取Blob对象
    return response.data  // Blob直接返回data
  }
}

// 地图API
export const mapApi = {
  // 获取地图数据
  getData: async (): Promise<ApiResponse<any>> => {
    return apiClient.get('/map/data')
  },

  // 获取在线地图配置
  getOnlineConfig: async (): Promise<ApiResponse<any>> => {
    return apiClient.get('/map/online-config')
  },

  // 获取离线地图路径
  getOfflinePath: async (): Promise<ApiResponse<{ path: string }>> => {
    return apiClient.get('/map/offline-path')
  },

  // 清除地图缓存
  clearCache: async (): Promise<ApiResponse<any>> => {
    return apiClient.post('/map/cache/clear')
  }
}

// 图层文件API
export const layerApi = {
  // 获取数据集的图层文件列表
  getLayers: async (dataId: string): Promise<ApiResponse<any>> => {
    return apiClient.get(`/data/${dataId}/layers`)
  },

  // 获取图层要素数据
  getLayerData: async (dataId: string, layerId: string): Promise<ApiResponse<any>> => {
    return apiClient.get(`/data/${dataId}/layers/${layerId}/data`)
  },

  // 获取图层的字段名列表
  getLayerColumns: async (dataId: string, layerId: string): Promise<ApiResponse<{ fields: string[]; layerId: string; total: number }>> => {
    return apiClient.get(`/data/${dataId}/layers/${layerId}/columns`)
  }
}

export default apiClient
