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

// 创建axios实例
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 300000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// 创建专门用于文件上传的 axios 实例（不设置默认 Content-Type）
const uploadClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 300000
})

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
  // 上传工参文件
  uploadExcel: async (file: File | null, filePath?: string): Promise<ApiResponse<UploadResponse>> => {
    const formData = new FormData()
    if (file) {
      formData.append('file', file)
    }
    if (filePath) {
      formData.append('file_path', filePath)
    }
    // 使用 uploadClient 发送，让 axios 自动设置 multipart/form-data 的 Content-Type
    return uploadClient.post('/data/upload/excel', formData)
  },

  /** 上传地图文件并保存到服务器 */
  uploadMap: async (file: File | null, filePath?: string): Promise<ApiResponse<any>> => {
    const formData = new FormData()
    if (file) {
      formData.append('file', file)
    }
    if (filePath) {
      formData.append('file_path', filePath)
    }
    // 使用 uploadClient 发送，让 axios 自动设置 multipart/form-data 的 Content-Type
    return uploadClient.post('/data/upload/map', formData)
  },

  /** 删除数据 */
  deleteData: async (dataId: string): Promise<boolean> => {
    try {
      const res = await apiClient.delete<ApiResponse<{ success: boolean }>>(`/data/${dataId}`)
      // Axios interceptor should have returned res.data, but to be safe:
      return (res as any).success || (res.data as any)?.success || false
    } catch (error) {
      console.error('Delete data error:', error)
      return false
    }
  },

  // 获取数据列表
  list: async (): Promise<ApiResponse<DataItem[]>> => {
    return apiClient.get('/data/list')
  },

  // 删除数据
  delete: async (id: string): Promise<ApiResponse<{ success: boolean }>> => {
    return apiClient.delete(`/data/${id}`)
  },

  // 获取数据详情
  get: async (id: string): Promise<ApiResponse<any>> => {
    return apiClient.get(`/data/${id}`)
  },

  // 工参更新
  updateParameters: async (fullParamId: string, currentParamId: string): Promise<ApiResponse<{ success: boolean; message: string; newFileId: string }>> => {
    return apiClient.post('/data/update-parameters', { fullParamId, currentParamId })
  },

  // 导入点数据
  importPoints: async (filePath: string): Promise<ApiResponse<any[]>> => {
    return apiClient.post('/data/import-points', { file_path: filePath })
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
  }
}

export default apiClient
