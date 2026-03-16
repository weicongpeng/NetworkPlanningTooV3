## 修复方案

修改 `frontend/src/renderer/services/pciDataSyncService.ts` 中的 `findSameFrequencyPCI` 函数：

### 问题
当 `frequency === null` 时，只匹配PCI而不检查频点，导致所有相同PCI的扇区都被匹配。

### 修复逻辑
1. 当传入的frequency为null时，尝试从规划结果映射表中获取该扇区的频点信息
2. 如果规划结果中也没有频点信息，则只匹配PCI（保持原有行为，但添加警告日志）
3. 如果有频点信息，则严格匹配频点

### 代码修改
```typescript
findSameFrequencyPCI(pci: number, frequency: number | null, siteId?: string, sectorId?: string): SyncedSectorData[] {
  // ...
  
  // 如果frequency为null，尝试从规划结果中获取
  let effectiveFrequency = frequency
  if (frequency === null && siteId && sectorId) {
    const key = this.getSectorKey(siteId, sectorId)
    const pciResult = this.pciResultsMap.get(key)
    if (pciResult) {
      effectiveFrequency = pciResult.frequency || pciResult.earfcn || pciResult.ssb_frequency || null
    }
  }

  const result = allSectors.filter(sector => {
    if (sector.syncedPCI !== pci) {
      return false
    }

    // 如果频点仍然为null，只匹配PCI（记录警告）
    if (effectiveFrequency === null) {
      console.warn('[PCIDataSyncService] 频点为null，只匹配PCI，可能包含非同频扇区')
      return true
    }

    // 匹配频点
    const sectorFreq = sector.frequency || sector.earfcn || sector.ssbFrequency
    return sectorFreq === effectiveFrequency
  })
  // ...
}
```

### 同时修改调用处
在 `PCIPage.tsx` 中调用时传入 siteId 和 sectorId：
```typescript
const samePCISectors = pciDataSyncService.findSameFrequencyPCI(newPCI, frequency, siteId, sectorId)
```