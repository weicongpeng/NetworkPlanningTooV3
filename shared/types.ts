// 通用API响应类型
export interface ApiResponse<T = any> {
  success: boolean
  data: T
  message?: string
  code?: number
}

// 许可证相关类型
export interface LicenseStatus {
  valid: boolean
  expiryDate: string
  licensee: string
  licenseKey?: string
  features?: string[]
}

export interface LicenseInfo {
  licenseKey: string
  licensee: string
  expiryDate: string
  features: string[]
  signature: string
}

// 数据管理相关类型
export interface DataItem {
  id: string
  name: string
  type: 'excel' | 'map'
  size: number
  uploadDate: string
  status: 'processing' | 'ready' | 'error'
  metadata?: Record<string, any>
  originalPath?: string
  fileType?: 'full_params' | 'current_params'
}

export interface UploadResponse {
  id: string
  name: string
  status: string
}

export interface SiteData {
  id: string
  name: string
  longitude: number
  latitude: number
  networkType: 'LTE' | 'NR'
  pci?: number
  earfcn?: number
  arfcn?: number
  sectors: SectorData[]
}

export interface SectorData {
  id: string
  siteId: string
  name: string
  longitude: number
  latitude: number
  azimuth: number
  beamwidth: number
  height: number
  pci?: number
  earfcn?: number
  arfcn?: number
  cell_cover_type?: number  // 小区覆盖类型: 1=室外小区, 4=室内小区
}

// PCI规划相关类型
export interface PCIRange {
  min: number
  max: number
}

export interface PCIConfig {
  networkType: 'LTE' | 'NR'
  distanceThreshold: number
  pciModulus: 3 | 30
  inheritModulus: boolean
  pciRange?: PCIRange
  enableCollisionCheck?: boolean
  enableConfusionCheck?: boolean
  customRules?: PCIRule[]
}

export interface PCIRule {
  condition: string
  pciRange: [number, number]
  priority: number
}

export interface PCIResult {
  taskId: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: number
  totalSites: number
  totalSectors: number
  collisions: number
  confusions: number
  results: SitePCIResult[]
  startTime: string
  endTime?: string
}

export interface SitePCIResult {
  siteId: string
  siteName: string
  sectors: SectorPCIResult[]
  conflicts?: PCIConflict[]
}

export interface SectorPCIResult {
  sectorId: string
  sectorName: string
  originalPCI?: number
  newPCI: number
  originalMod?: number
  newMod?: number
  earfcn?: number
  longitude?: number
  latitude?: number
  assignmentReason?: string
  minReuseDistance?: number
  collisionCount?: number
  confusionCount?: number
}

export interface PCIConflict {
  type: 'collision' | 'confusion'
  sector1: string
  sector2: string
  pci: number
}

// 邻区规划相关类型
export interface NeighborConfig {
  sourceType: 'LTE' | 'NR'
  targetType: 'LTE' | 'NR'
  maxDistance: number
  maxNeighbors: number
  customRules?: NeighborRule[]
}

export interface NeighborRule {
  condition: string
  action: 'add' | 'remove'
  priority: number
}

export interface NeighborResult {
  taskId: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: number
  totalSites: number
  totalSectors: number
  totalNeighbors: number
  avgNeighbors: number
  results: SiteNeighborResult[]
  startTime: string
  endTime?: string
}

export interface SiteNeighborResult {
  siteId: string
  siteName: string
  sectors: SectorNeighborResult[]
  totalNeighbors?: number
}

export interface SectorNeighborResult {
  sectorId: string
  sectorName: string
  neighbors: NeighborRelation[]
  neighborCount?: number
}

export interface NeighborRelation {
  sourceSector: string
  sourceSectorName?: string
  targetSector: string
  targetSectorName?: string
  targetSite: string
  targetSiteName?: string
  distance: number
  bearing?: number
  relationType: 'LTE-LTE' | 'LTE-NR' | 'NR-LTE' | 'NR-NR'
}

// 地图相关类型
export interface MapData {
  sites: SiteData[]
  bounds: MapBounds
  center: MapCenter
}

export interface MapBounds {
  north: number
  south: number
  east: number
  west: number
}

export interface MapCenter {
  latitude: number
  longitude: number
}

export interface OnlineMapConfig {
  provider: 'openstreetmap' | 'gaode' | 'baidu'
  apiKey?: string
  style: string
}

export interface OfflineMapConfig {
  path: string
  format: 'mbtiles' | 'xyz'
  minZoom: number
  maxZoom: number
}

// 任务进度相关类型
export interface TaskProgress {
  taskId: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: number
  message?: string
  error?: string
}

// WebSocket消息类型
export interface WSMessage {
  type: 'task_progress' | 'task_complete' | 'task_error' | 'data_update'
  data: any
}

export interface TaskProgressMessage extends WSMessage {
  type: 'task_progress'
  data: TaskProgress
}

export interface TaskCompleteMessage extends WSMessage {
  type: 'task_complete'
  data: {
    taskId: string
    result: any
  }
}

export interface TaskErrorMessage extends WSMessage {
  type: 'task_error'
  data: {
    taskId: string
    error: string
  }
}

// 图层相关类型
export interface Layer {
  id: string
  name: string
  type: 'sites' | 'sectors' | 'coverage' | 'neighbors' | 'conflicts'
  visible: boolean
  opacity: number
  style?: LayerStyle
}

export interface LayerStyle {
  color: string
  fillColor: string
  strokeWidth: number
  radius?: number
}
