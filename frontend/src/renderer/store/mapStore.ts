import { create } from 'zustand'

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
}

export const useMapStore = create<MapState>((set) => ({
  locationPoints: [],
  addLocationPoint: (point) => {
    set((state) => ({
      locationPoints: [...state.locationPoints, point]
    }))
  },
  clearLocationPoints: () => {
    set({ locationPoints: [] })
  }
}))
