import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { LabelSettings } from '../components/Map/LabelSettingsModal'

/**
 * 定位点接口
 */
export interface LocationPoint {
  id: string
  lng: number
  lat: number
}

interface MapState {
  locationPoints: LocationPoint[]
  addLocationPoint: (point: LocationPoint) => void
  clearLocationPoints: () => void
  // 标签设置映射 - 持久化
  labelSettingsMap: Record<string, LabelSettings>
  setLabelSettings: (layerId: string, settings: LabelSettings) => void
  getLabelSettings: (layerId: string) => LabelSettings | undefined
  clearLabelSettings: () => void
}

export const useMapStore = create<MapState>()(
  persist(
    (set, get) => ({
      locationPoints: [],
      addLocationPoint: (point) => {
        set((state) => ({
          locationPoints: [...state.locationPoints, point]
        }))
      },
      clearLocationPoints: () => {
        set({ locationPoints: [] })
      },
      // 标签设置相关状态
      labelSettingsMap: {},
      setLabelSettings: (layerId: string, settings: LabelSettings) => {
        set((state) => ({
          labelSettingsMap: {
            ...state.labelSettingsMap,
            [layerId]: settings
          }
        }))
      },
      getLabelSettings: (layerId: string) => {
        return get().labelSettingsMap[layerId]
      },
      clearLabelSettings: () => {
        set({ labelSettingsMap: {} })
      }
    }),
    {
      name: 'map-settings-storage', // localStorage key
      partialize: (state) => ({
        // 只持久化标签设置，不持久化 locationPoints（临时数据）
        labelSettingsMap: state.labelSettingsMap
      })
    }
  )
)
