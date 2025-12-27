import { create } from 'zustand'
import { dataApi } from '../services/api'
import type { DataItem, ApiResponse } from '@shared/types'

interface DataState {
  items: DataItem[]
  loading: boolean
  error: string | null
  fetchList: () => Promise<void>
  uploadExcel: (file: File) => Promise<boolean>
  uploadMap: (file: File) => Promise<boolean>
  deleteItem: (id: string) => Promise<boolean>
}

export const useDataStore = create<DataState>((set, get) => ({
  items: [],
  loading: false,
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

  uploadExcel: async (file: File) => {
    set({ loading: true, error: null })
    try {
      await dataApi.uploadExcel(file)
      await get().fetchList()
      set({ loading: false })
      return true
    } catch (error: any) {
      set({
        error: error.message || '上传失败',
        loading: false
      })
      return false
    }
  },

  uploadMap: async (file: File) => {
    set({ loading: true, error: null })
    try {
      await dataApi.uploadMap(file)
      await get().fetchList()
      set({ loading: false })
      return true
    } catch (error: any) {
      set({
        error: error.message || '上传失败',
        loading: false
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
  }
}))
