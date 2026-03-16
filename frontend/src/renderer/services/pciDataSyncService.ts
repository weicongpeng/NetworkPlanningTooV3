/**
 * PCI数据同步服务
 *
 * 负责将PCI规划结果的新PCI同步到全量工参数据（内存中），
 * 并提供同频同PCI扇区查找功能。
 *
 * 数据流程：
 * 1. 从mapDataService获取全量工参数据
 * 2. 将PCI规划结果的新PCI同步到对应扇区
 * 3. 基于同步后的数据查找同频同PCI扇区
 */

import { mapDataService, RenderSectorData } from './mapDataService'

/**
 * 扇区唯一标识
 */
interface SectorKey {
  siteId: string
  sectorId: string
}

/**
 * PCI规划结果中的扇区数据
 */
interface PCIResultSector {
  siteId: string
  sectorId: string
  newPCI: number
  frequency: number | null
  earfcn: number | null
  ssb_frequency: number | null
  latitude: number | null
  longitude: number | null
  [key: string]: any
}

/**
 * PCI规划结果
 */
interface PCIPlanningResult {
  results: Array<{
    siteId: string
    siteName: string
    sectors: PCIResultSector[]
  }>
}

/**
 * 同步后的扇区数据（扩展RenderSectorData）
 */
interface SyncedSectorData extends RenderSectorData {
  /** 同步后的PCI（可能来自规划结果） */
  syncedPCI?: number
  /** 是否是规划结果中的扇区 */
  isPlannedSector: boolean
}

/**
 * 同频同PCI分组
 */
interface SamePCIGroup {
  pci: number
  frequency: number
  sectors: SyncedSectorData[]
}

/**
 * PCI数据同步服务类
 */
export class PCIDataSyncService {
  /** 全量工参原始数据（副本） */
  private fullParamsData: {
    lte: RenderSectorData[]
    nr: RenderSectorData[]
  } | null = null

  /** 同步后的数据 */
  private syncedData: {
    lte: SyncedSectorData[]
    nr: SyncedSectorData[]
  } | null = null

  /** PCI规划结果映射表 */
  private pciResultsMap = new Map<string, PCIResultSector>()

  /**
   * 初始化同步服务，加载全量工参数据
   */
  async initialize(): Promise<void> {
    try {
      // 从mapDataService获取全量工参数据（强制刷新缓存）
      const mapData = await mapDataService.getMapData(undefined, true)

      // 检查是否有数据
      if (!mapData.lteSectors.length && !mapData.nrSectors.length) {
        console.warn('[PCIDataSyncService] 未找到全量工参数据，初始化为空数据')
        this.fullParamsData = { lte: [], nr: [] }
        this.syncedData = { lte: [], nr: [] }
        return
      }

      // 创建数据副本（深拷贝）
      this.fullParamsData = {
        lte: JSON.parse(JSON.stringify(mapData.lteSectors)),
        nr: JSON.parse(JSON.stringify(mapData.nrSectors))
      }

      // 初始化同步数据
      this.syncedData = {
        lte: this.fullParamsData.lte.map(s => ({
          ...s,
          syncedPCI: s.pci,
          isPlannedSector: false
        })),
        nr: this.fullParamsData.nr.map(s => ({
          ...s,
          syncedPCI: s.pci,
          isPlannedSector: false
        }))
      }

      console.log('[PCIDataSyncService] 初始化完成', {
        lte: this.syncedData.lte.length,
        nr: this.syncedData.nr.length
      })
    } catch (error: any) {
      console.warn('[PCIDataSyncService] 初始化失败:', error?.message || error)
      // 初始化为空数据，不抛出错误
      this.fullParamsData = { lte: [], nr: [] }
      this.syncedData = { lte: [], nr: [] }
    }
  }

  /**
   * 设置PCI规划结果
   */
  setPCIResults(results: PCIPlanningResult): void {
    // 构建规划结果映射表
    this.pciResultsMap.clear()

    for (const site of results.results || []) {
      for (const sector of site.sectors || []) {
        // 规划结果中的sectorId可能是组合格式（如"540951_0"）或纯数字格式（如"0"）
        // 需要统一处理为 siteId_sectorId 格式
        let key: string
        const sectorIdStr = String(sector.sectorId).trim()
        
        // 如果sectorId已经包含siteId（组合格式），直接使用
        if (sectorIdStr.includes('_') && sectorIdStr.startsWith(String(site.siteId))) {
          key = sectorIdStr
        } else {
          // 否则拼接为 siteId_sectorId 格式
          key = this.getSectorKey(site.siteId, sector.sectorId)
        }
        
        this.pciResultsMap.set(key, {
          ...sector,
          siteId: site.siteId
        })
        
        console.log('[PCIDataSyncService] 规划结果映射', {
          siteId: site.siteId,
          sectorId: sector.sectorId,
          key,
          newPCI: sector.newPCI
        })
      }
    }

    console.log('[PCIDataSyncService] PCI规划结果已加载', {
      count: this.pciResultsMap.size
    })

    // 重新同步数据
    this.resyncData()
  }

  /**
   * 同步单个扇区的PCI
   * @returns 同步是否成功
   */
  syncSectorPCI(siteId: string, sectorId: string, newPCI: number): boolean {
    // sectorId可能是组合格式（如"540951_0"）或纯数字格式（如"0"）
    // 需要统一处理为 siteId_sectorId 格式
    let key: string
    const sectorIdStr = String(sectorId).trim()
    
    // 如果sectorId已经包含siteId（组合格式），直接使用
    if (sectorIdStr.includes('_') && sectorIdStr.startsWith(String(siteId))) {
      key = sectorIdStr
    } else {
      // 否则拼接为 siteId_sectorId 格式
      key = this.getSectorKey(siteId, sectorId)
    }
    
    const pciResult = this.pciResultsMap.get(key)

    if (!this.syncedData) {
      console.warn('[PCIDataSyncService] 数据未初始化')
      return false
    }

    let synced = false

    // 更新LTE或NR数据
    const updateSector = (sectors: SyncedSectorData[]) => {
      const sector = sectors.find(s => {
        // 尝试多种匹配方式，因为mapDataService中id的构建有优先级
        // id = `${siteId}_${cellId}`, 其中 cellId = sector.id || sector.cellId || sector.localCellId || sector.sectorId
        const sKey = this.getSectorKey(s.siteId || '', s.sectorId || '')
        if (sKey === key) return true

        // 也尝试直接用id字段匹配
        if (s.id === key) return true

        // 尝试其他匹配方式，增强可靠性
        if (s.id && key.includes('_')) {
          const parts = key.split('_')
          if (parts.length === 2) {
            // 尝试匹配站点ID和扇区ID的组合
            if (s.id.includes(parts[0]) && s.id.includes(parts[1])) {
              return true
            }
          }
        }

        return false
      })

      if (sector) {
        sector.syncedPCI = newPCI
        sector.isPlannedSector = true
        synced = true
        console.log('[PCIDataSyncService] 成功同步扇区PCI', {
          siteId,
          inputSectorId: sectorId,
          key,
          newPCI,
          matchedSectorId: sector.id,
          sectorName: sector.name
        })
      }
    }

    updateSector(this.syncedData.lte)
    updateSector(this.syncedData.nr)

    // 同时更新映射表（用于后续查找）
    if (pciResult) {
      pciResult.newPCI = newPCI
      this.pciResultsMap.set(key, pciResult)
    }

    if (!synced) {
      console.warn('[PCIDataSyncService] 未找到匹配的扇区，同步失败', {
        siteId,
        sectorId,
        key
      })
    }

    return synced
  }

  /**
   * 重新同步所有数据
   */
  private resyncData(): void {
    if (!this.syncedData || !this.fullParamsData) {
      console.warn('[PCIDataSyncService] 数据未初始化，跳过重新同步')
      return
    }

    console.log('[PCIDataSyncService] 开始重新同步所有数据')

    // 重置同步数据
    this.syncedData.lte = this.fullParamsData.lte.map(s => ({
      ...s,
      syncedPCI: s.pci,
      isPlannedSector: false
    }))
    this.syncedData.nr = this.fullParamsData.nr.map(s => ({
      ...s,
      syncedPCI: s.pci,
      isPlannedSector: false
    }))

    console.log('[PCIDataSyncService] 重置同步数据完成', {
      lteCount: this.syncedData.lte.length,
      nrCount: this.syncedData.nr.length
    })

    // 应用所有PCI规划结果
    let appliedCount = 0
    for (const [key, pciResult] of this.pciResultsMap) {
      const success = this.syncSectorPCI(pciResult.siteId, pciResult.sectorId, pciResult.newPCI)
      if (success) {
        appliedCount++
      }
    }

    console.log('[PCIDataSyncService] 重新同步完成', {
      totalResults: this.pciResultsMap.size,
      appliedCount: appliedCount
    })
  }

  /**
   * 查找同频同PCI的所有扇区（排除规划结果中的扇区）
   * 
   * 应用到工参后的关键变化：
   * - 应用前：全量工参中规划结果扇区的PCI是originalPCI，syncedPCI更新为newPCI后，查找newPCI只找到规划结果扇区
   * - 应用后：全量工参中规划结果扇区的PCI已更新为newPCI，查找newPCI会找到规划结果扇区+背景工参中原本PCI就是newPCI的扇区
   * 
   * 解决方案：排除规划结果中的扇区（isPlannedSector === true），只返回背景工参中的同频同PCI扇区
   * 
   * @param pci PCI值
   * @param frequency 频点值
   * @param siteId 可选，用于从规划结果中获取频点
   * @param sectorId 可选，用于从规划结果中获取频点
   * @param networkType 可选，按网络类型过滤（'LTE' 或 'NR'）
   */
  findSameFrequencyPCI(pci: number, frequency: number | null, siteId?: string, sectorId?: string, networkType?: string): SyncedSectorData[] {
    if (!this.syncedData) {
      console.warn('[PCIDataSyncService] 数据未初始化')
      return []
    }

    // 根据网络类型过滤数据
    let allSectors: SyncedSectorData[]
    if (networkType === 'LTE') {
      allSectors = this.syncedData.lte
    } else if (networkType === 'NR') {
      allSectors = this.syncedData.nr
    } else {
      // 未指定网络类型，搜索所有扇区
      allSectors = [...this.syncedData.lte, ...this.syncedData.nr]
    }
    
    console.log('[PCIDataSyncService] 按网络类型过滤查找同频同PCI扇区', {
      networkType,
      totalSectorsToSearch: allSectors.length,
      lteCount: this.syncedData.lte.length,
      nrCount: this.syncedData.nr.length
    })

    // 如果frequency为null，尝试从规划结果中获取
    let effectiveFrequency = frequency
    if (frequency === null && siteId && sectorId) {
      // sectorId可能是组合格式（如"540951_0"）或纯数字格式（如"0"）
      // 需要统一处理为 siteId_sectorId 格式
      let key: string
      const sectorIdStr = String(sectorId).trim()
      
      // 如果sectorId已经包含siteId（组合格式），直接使用
      if (sectorIdStr.includes('_') && sectorIdStr.startsWith(String(siteId))) {
        key = sectorIdStr
      } else {
        // 否则拼接为 siteId_sectorId 格式
        key = this.getSectorKey(siteId, sectorId)
      }
      
      const pciResult = this.pciResultsMap.get(key)
      if (pciResult) {
        effectiveFrequency = pciResult.frequency || pciResult.earfcn || pciResult.ssb_frequency || null
        console.log('[PCIDataSyncService] 从规划结果中获取频点', {
          siteId,
          sectorId,
          key,
          frequency: effectiveFrequency
        })
      }
    }

    // 查找同频同PCI的扇区（排除规划结果中的扇区）
    const result = allSectors.filter(sector => {
      // 关键：排除规划结果中的扇区，只查找背景工参中的扇区
      // 这样可以确保应用到工参前后的行为一致
      if (sector.isPlannedSector) {
        return false
      }

      // 使用同步后的PCI
      if (sector.syncedPCI !== pci) {
        return false
      }

      // 如果频点仍然为null，只匹配PCI（记录警告）
      if (effectiveFrequency === null) {
        console.warn('[PCIDataSyncService] 频点为null，只匹配PCI，可能包含非同频扇区', {
          sectorId: sector.id,
          sectorName: sector.name,
          pci: sector.syncedPCI
        })
        return true
      }

      // 匹配频点（支持多种频点字段）
      const sectorFreq = sector.frequency || sector.earfcn || sector.ssbFrequency
      return sectorFreq === effectiveFrequency
    })

    console.log('[PCIDataSyncService] 查找同频同PCI（排除规划结果扇区）', {
      pci,
      inputFrequency: frequency,
      effectiveFrequency,
      count: result.length,
      firstFew: result.slice(0, 5).map(s => ({ 
        id: s.id, 
        name: s.name, 
        syncedPCI: s.syncedPCI,
        frequency: s.frequency || s.earfcn || s.ssbFrequency,
        isPlannedSector: s.isPlannedSector
      }))
    })

    return result
  }

  /**
   * 根据siteId和sectorId查找扇区
   */
  findSector(siteId: string, sectorId: string): SyncedSectorData | null {
    if (!this.syncedData) {
      return null
    }

    // sectorId可能是组合格式（如"540951_0"）或纯数字格式（如"0"）
    // 需要统一处理为 siteId_sectorId 格式
    let key: string
    const sectorIdStr = String(sectorId).trim()
    
    // 如果sectorId已经包含siteId（组合格式），直接使用
    if (sectorIdStr.includes('_') && sectorIdStr.startsWith(String(siteId))) {
      key = sectorIdStr
    } else {
      // 否则拼接为 siteId_sectorId 格式
      key = this.getSectorKey(siteId, sectorId)
    }
    
    const allSectors = [...this.syncedData.lte, ...this.syncedData.nr]

    return allSectors.find(s => {
      // 尝试多种匹配方式
      const sKey = this.getSectorKey(s.siteId || '', s.sectorId || '')
      if (sKey === key) return true

      // 也尝试直接用id字段匹配
      if (s.id === key) return true

      return false
    }) || null
  }

  /**
   * 获取同步后的数据
   */
  getSyncedData(): {
    lte: SyncedSectorData[]
    nr: SyncedSectorData[]
  } | null {
    return this.syncedData
  }

  /**
   * 获取更新后的完整PCI数据，供扇区图层使用
   * 确保返回的数据中每个扇区都使用同步后的PCI值
   */
  getUpdatedPCIData(): {
    lte: RenderSectorData[]
    nr: RenderSectorData[]
  } | null {
    if (!this.syncedData) {
      console.warn('[PCIDataSyncService] 数据未初始化，无法获取更新后的PCI数据')
      return null
    }

    console.log('[PCIDataSyncService] 获取更新后的完整PCI数据')

    // 转换同步后的数据，确保每个扇区都使用同步后的PCI值
    const updatedLTE = this.syncedData.lte.map(sector => ({
      ...sector,
      // 优先使用同步后的PCI值，然后使用原始pci字段
      pci: sector.syncedPCI !== undefined ? sector.syncedPCI : sector.pci
    }))

    const updatedNR = this.syncedData.nr.map(sector => ({
      ...sector,
      // 优先使用同步后的PCI值，然后使用原始pci字段
      pci: sector.syncedPCI !== undefined ? sector.syncedPCI : sector.pci
    }))

    console.log('[PCIDataSyncService] 获取更新后的PCI数据完成', {
      lteCount: updatedLTE.length,
      nrCount: updatedNR.length
    })

    return {
      lte: updatedLTE,
      nr: updatedNR
    }
  }

  /**
   * 清除所有同步数据
   */
  clear(): void {
    this.fullParamsData = null
    this.syncedData = null
    this.pciResultsMap.clear()
    console.log('[PCIDataSyncService] 数据已清除')
  }

  /**
   * 生成扇区唯一标识
   */
  private getSectorKey(siteId: string, sectorId: string): string {
    return `${siteId}_${sectorId}`
  }
}

// 单例导出
export const pciDataSyncService = new PCIDataSyncService()
