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

export interface MeasurePoint {
  lat: number;
  lng: number;
}

function calculateTotalDistance(points: MeasurePoint[]): number {
  if (points.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    total += getDistance(points[i].lat, points[i].lng, points[i + 1].lat, points[i + 1].lng);
  }
  return total;
}

function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c * 1000; // meters
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
