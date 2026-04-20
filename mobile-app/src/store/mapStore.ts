import { create } from 'zustand';

interface MapState {
  backendIp: string;
  backendPort: number;
  isConnected: boolean;
  mapType: 'roadmap' | 'satellite';
  layers: {
    lte: { visible: boolean };
    nr: { visible: boolean };
  };
  setBackendInfo: (ip: string, port: number) => void;
  setConnected: (connected: boolean) => void;
  setMapType: (type: 'roadmap' | 'satellite') => void;
  toggleLayer: (type: 'lte' | 'nr') => void;
}

export const useMapStore = create<MapState>((set) => ({
  backendIp: '',
  backendPort: 8000,
  isConnected: false,
  mapType: 'roadmap',
  layers: {
    lte: { visible: true },
    nr: { visible: true },
  },
  setBackendInfo: (ip, port) => set({ backendIp: ip, backendPort: port }),
  setConnected: (connected) => set({ isConnected: connected }),
  setMapType: (type) => set({ mapType: type }),
  toggleLayer: (type) =>
    set((state) => ({
      layers: {
        ...state.layers,
        [type]: { visible: !state.layers[type].visible },
      },
    })),
}));
