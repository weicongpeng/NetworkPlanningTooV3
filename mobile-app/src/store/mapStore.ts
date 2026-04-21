import { create } from 'zustand';

export interface SectorData {
  id: string;
  name: string;
  siteId?: string;
  sectorId?: string;
  latitude: number;
  longitude: number;
  networkType: 'LTE' | 'NR';
  frequency?: number;
  pci?: number;
  tac?: number;
}

export interface MarkerPoint {
  id: string;
  lat: number;
  lng: number;
  name: string;
  createdAt: number;
}

interface MapState {
  backendIp: string;
  backendPort: number;
  isConnected: boolean;
  mapType: 'roadmap' | 'satellite';
  layers: {
    lte: { visible: boolean };
    nr: { visible: boolean };
  };
  lteSectors: SectorData[];
  nrSectors: SectorData[];
  selectedSector: SectorData | null;
  markers: MarkerPoint[];
  addMarker: (lat: number, lng: number, name?: string) => void;
  removeMarker: (id: string) => void;
  clearMarkers: () => void;
  setBackendInfo: (ip: string, port: number) => void;
  setConnected: (connected: boolean) => void;
  setMapType: (type: 'roadmap' | 'satellite') => void;
  toggleLayer: (type: 'lte' | 'nr') => void;
  setSectors: (lte: SectorData[], nr: SectorData[]) => void;
  setSelectedSector: (sector: SectorData | null) => void;
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
  lteSectors: [],
  nrSectors: [],
  selectedSector: null,
  markers: [],
  addMarker: (lat, lng, name = '') => set((state) => ({
    markers: [...state.markers, { id: `marker-${Date.now()}`, lat, lng, name, createdAt: Date.now() }]
  })),
  removeMarker: (id) => set((state) => ({
    markers: state.markers.filter(m => m.id !== id)
  })),
  clearMarkers: () => set({ markers: [] }),
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
  setSectors: (lte, nr) => set({ lteSectors: lte, nrSectors: nr }),
  setSelectedSector: (sector) => set({ selectedSector: sector }),
}));
