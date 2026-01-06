import { create } from 'zustand'
import { dataApi } from '../services/api'
import type { DataItem, ApiResponse } from '@shared/types'
import { useTaskStore } from './taskStore'

interface DataState {
  items: DataItem[]
  loading: boolean
  uploadingType: string | null
  error: string | null
  fetchList: () => Promise<void>
  uploadExcel: (file: File, context?: string) => Promise<boolean>
  uploadMap: (file: File, context?: string) => Promise<boolean>
  deleteItem: (id: string) => Promise<boolean>
  updateParameters: (fullParamId: string, currentParamId: string) => Promise<boolean>
  // 新增：获取工参更新任务的状态
  getUpdateTaskStatus: () => 'idle' | 'running' | 'completed' | 'failed'
}

export const useDataStore = create<DataState>((set, get) => ({
  items: [],
  loading: false,
  uploadingType: null,
  error: null,

  fetchList: async () => {
    set({ loading: true, error: null })
    try {
      const response: ApiResponse<DataItem[]> = await dataApi.list()
      set({ items: response.data || [], loading: false })
    } catch (error: any) {
      set({
        error: error.message || '获取数据列表失败',
        loading: false
      })
    }
  },

  uploadExcel: async (file: File, context: string = 'excel') => {
    set({ loading: true, uploadingType: context, error: null })
    try {
      // 获取文件全路径 (仅在Electron环境下有效)
      let filePath = (file as any).path;

      // 尝试使用暴露的 electronAPI (更安全/新版推荐方式)
      // 修复：添加 await 等待 Promise 解析
      if (!filePath && (window as any).electronAPI?.getFilePath) {
          try {
              filePath = await (window as any).electronAPI.getFilePath(file);
              console.log('Got file path from electronAPI:', filePath);
          } catch (e) {
              console.warn('Failed to get path via electronAPI:', e);
          }
      }

      console.log('Upload Excel:', file.name, 'Path:', filePath);

      await dataApi.uploadExcel(file, filePath)
      await get().fetchList()
      set({ loading: false, uploadingType: null })
      return true
    } catch (error: any) {
      set({
        error: error.message || '上传失败',
        loading: false,
        uploadingType: null
      })
      return false
    }
  },

  uploadMap: async (file: File, context: string = 'map') => {
    set({ loading: true, uploadingType: context, error: null })
    try {
      let filePath = (file as any).path;
      
      if (!filePath && (window as any).electronAPI?.getFilePath) {
          try {
              // 修复：添加 await 等待 Promise 解析
              filePath = await (window as any).electronAPI.getFilePath(file);
              console.log('Got file path from electronAPI:', filePath);
          } catch (e) {
              console.warn('Failed to get path via electronAPI:', e);
          }
      }
      
      console.log('Upload Map:', file.name, 'Path:', filePath);

      await dataApi.uploadMap(file, filePath)
      await get().fetchList()
      set({ loading: false, uploadingType: null })
      return true
    } catch (error: any) {
      set({
        error: error.message || '上传失败',
        loading: false,
        uploadingType: null
      })
      return false
    }
  },

  deleteItem: async (id: string) => {
    set({ loading: true, error: null })
    try {
      await dataApi.delete(id)
      await get().fetchList()
      set({ loading: false })
      return true
    } catch (error: any) {
      set({
        error: error.message || '删除失败',
        loading: false
      })
      return false
    }
  },

  updateParameters: async (fullParamId: string, currentParamId: string) => {
    set({ loading: true, error: null })

    // 生成任务ID用于全局跟踪
    const taskId = `param_update_${fullParamId}_${currentParamId}`

    try {
      // 在全局任务store中开始任务
      useTaskStore.getState().startTask(taskId, 'parameter_update', '正在更新工参...')

      const response = await dataApi.updateParameters(fullParamId, currentParamId)
      await get().fetchList()

      // 任务完成
      useTaskStore.getState().completeTask(taskId)

      set({ loading: false })
      return response
    } catch (error: any) {
      // 任务失败
      useTaskStore.getState().failTask(taskId, error.message || '工参更新失败')

      set({
        error: error.message || '工参更新失败',
        loading: false
      })
      return { success: false, message: error.message || '工参更新失败', data: null }
    }
  },

  // 获取工参更新任务的状态（从全局任务store中获取）
  getUpdateTaskStatus: () => {
    // 检查是否有正在运行的 parameter_update 类型任务
    const runningTasks = useTaskStore.getState().getRunningTasks()
    const hasUpdateTask = runningTasks.some(task => task.type === 'parameter_update')
    return hasUpdateTask ? 'running' : 'idle'
  }
}))
