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
    // 直接返回完整的响应数据，不自动解包
    // 保持与API签名一致：返回 ApiResponse<T>
    return response.data
  },
  (error) => {
    console.error('API Error:', error)

    // 处理错误响应，返回统一格式
    if (error.response) {
      const data = error.response.data
      // 兼容detail和message字段
      let message = error.message

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
    return apiClient.post('/license/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  }
}

// 数据管理API
export const dataApi = {
  // 上传工参文件
  uploadExcel: async (file: File, filePath?: string): Promise<ApiResponse<UploadResponse>> => {
    const formData = new FormData()
    formData.append('file', file)
    if (filePath) {
      formData.append('file_path', filePath)
    }
    return apiClient.post('/data/upload/excel', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  },

  // 上传地图文件
  uploadMap: async (file: File, filePath?: string): Promise<ApiResponse<UploadResponse>> => {
    const formData = new FormData()
    formData.append('file', file)
    if (filePath) {
      formData.append('file_path', filePath)
    }
    return apiClient.post('/data/upload/map', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
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
