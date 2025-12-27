import { create } from 'zustand'
import { licenseApi } from '../services/api'
import type { LicenseStatus, ApiResponse } from '@shared/types'

interface LicenseState {
  status: LicenseStatus | null
  loading: boolean
  error: string | null
  fetchStatus: () => Promise<void>
  activate: (licenseKey: string) => Promise<boolean>
  upload: (file: File) => Promise<boolean>
}

export const useLicenseStore = create<LicenseState>((set, get) => ({
  status: null,
  loading: false,
  error: null,

  fetchStatus: async () => {
    set({ loading: true, error: null })
    try {
      const response: ApiResponse<LicenseStatus> = await licenseApi.getStatus()
      set({ status: response.data, loading: false })
    } catch (error: any) {
      set({
        error: error.message || '获取许可证状态失败',
        loading: false
      })
    }
  },

  activate: async (licenseKey: string) => {
    set({ loading: true, error: null })
    try {
      const response: ApiResponse<{ success: boolean }> = await licenseApi.activate(licenseKey)
      if (response.success) {
        await get().fetchStatus()
        return true
      }
      set({ loading: false, error: '激活失败' })
      return false
    } catch (error: any) {
      set({
        error: error.message || '激活失败',
        loading: false
      })
      return false
    }
  },

  upload: async (file: File) => {
    set({ loading: true, error: null })
    try {
      const response: ApiResponse<{ success: boolean }> = await licenseApi.upload(file)
      if (response.success) {
        await get().fetchStatus()
        return true
      }
      set({ loading: false, error: '上传失败' })
      return false
    } catch (error: any) {
      set({
        error: error.message || '上传失败',
        loading: false
      })
      return false
    }
  }
}))
