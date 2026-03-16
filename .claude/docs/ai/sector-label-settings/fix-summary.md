# 扇区标签设置修复总结

## 修复日期
2026-01-24

## 问题描述
1. 标签内容列表只有"小区名称"，缺少其他字段选项
2. 字体颜色和字体大小设置保存后不生效
3. 缺少扇区级别与频点级别标签的联动控制逻辑

## 修复内容

### 1. 字段映射修复

**文件**: `frontend/src/renderer/components/Map/LayerControl.tsx`

**问题**: 预定义字段映射不正确，没有包含全量工参中的中文列名。

**修复**: 更新了 `fieldNameMap`，添加了正确的中文列名映射：

```typescript
const fieldNameMap: Record<string, string[]> = {
  'name': ['小区名称', 'Cell Name', 'name', 'cellName'],
  // LTE使用eNodeB标识，NR使用gNodeB标识
  'siteId': ['基站ID', 'Site ID', 'eNodeB标识', 'gNodeB标识', 'siteId', 'enbId', 'gnbId'],
  // LTE使用下行链路的中心载频，NR使用填写SSB频点
  'frequency': ['下行频点', '下行链路的中心载频', '填写SSB频点', 'DL Frequency', 'Frequency', 'frequency', 'dlFreq', 'ssbFrequency'],
  'pci': ['PCI', '物理小区识别码', 'physicalCellId', 'pci'],
  'tac': ['TAC', '跟踪区码', 'trackingAreaCode', 'tac'],
  'isShared': ['是否共享', 'Is Shared', 'Shared', 'isShared', 'is_shared'],
  'coverageType': ['覆盖类型', '小区覆盖类型', 'Coverage Type', 'coverageType', 'cell_cover_type']
}
```

**映射关系说明**:
- 小区名称: `小区名称` → `name`
- 基站ID: LTE使用 `eNodeB标识`, NR使用 `gNodeB标识` → `siteId`
- 下行频点: LTE使用 `下行链路的中心载频`, NR使用 `填写SSB频点` → `frequency`
- PCI: `物理小区识别码` → `pci`
- TAC: `跟踪区码` → `tac`
- 是否共享: `是否共享` → `isShared`
- 覆盖类型: `小区覆盖类型` → `coverageType`

### 2. 标签内容获取增强

**文件**: `frontend/src/renderer/components/Map/SectorRendererSVG.tsx`

**问题**: `_getLabelContent` 方法没有正确处理从 `attributes` 中获取数据的情况。

**修复**: 更新了 `_getLabelContent` 方法，增强了字段获取逻辑：

- `siteId`: 优先从 `sector.siteId` 获取，否则从 `attributes` 中的 `eNodeB标识`/`gNodeB标识`/`基站ID` 获取
- `frequency`: 优先从 `sector.frequency` 获取，否则从 `sector.ssbFrequency` (NR) 或 `sector.earfcn` (LTE) 获取，最后尝试从 `attributes` 获取
- `isShared`: 从 `sector.is_shared` 或 `attributes['是否共享']` 获取
- `coverageType`: 从 `sector.cell_cover_type` 或 `attributes['小区覆盖类型']` 获取

### 3. 字体颜色和大小修复

**文件**: `frontend/src/renderer/components/Map/SectorRendererSVG.tsx`

**问题**: 虽然标签创建时使用了配置的颜色和字体大小，但当配置更新时，已存在的标签标记不会被更新。

**修复**: 在 `setSectorLabelConfig` 方法中添加了强制重新创建所有标签的逻辑：

```typescript
setSectorLabelConfig(config: SectorLabelConfig): void {
  this.labelConfig = config
  console.log('[SectorRenderer] 设置扇区标签配置', config)

  // 强制重新创建所有标签以应用新的配置
  // 移除所有现有标签标记
  for (const [, label] of this.sectorLabels) {
    if (this.featureGroup && this.featureGroup.hasLayer(label)) {
      this.featureGroup.removeLayer(label)
    }
  }
  this.sectorLabels.clear()

  // 重新渲染以更新标签
  this._render()
}
```

### 4. 扇区级别与频点级别联动控制

**文件**: `frontend/src/renderer/pages/MapPage.tsx`

**问题**: 缺少扇区级别与频点级别的联动控制逻辑。

**修复**: 更新了 `handleSectorLabelToggle` 函数，实现了联动逻辑：

```typescript
const handleSectorLabelToggle = useCallback((layerId: string, visible: boolean) => {
  const networkType = layerId === 'lte-sectors' ? 'LTE' : 'NR'

  // 更新本地状态
  setSectorLabelVisibility(prev => ({
    ...prev,
    [layerId]: visible
  }))

  // 联动更新频点标签状态
  setFrequencies(prev => {
    const networkTypeLower = networkType.toLowerCase() as 'lte' | 'nr'
    return {
      ...prev,
      [networkTypeLower]: prev[networkTypeLower].map(freq => ({
        ...freq,
        labelVisible: visible  // 同步所有频点的标签状态
      }))
    }
  })

  // 通知地图组件更新
  if (onlineMapRef.current) {
    const layerType = layerId === 'lte-sectors' ? 'lte' : 'nr'
    onlineMapRef.current.setSectorLabelVisibility(layerType, visible)

    // 更新所有频点的标签可见性
    const networkTypeLower = networkType.toLowerCase() as 'lte' | 'nr'
    frequencies[networkTypeLower].forEach(freq => {
      onlineMapRef.current?.setFrequencyLabelVisibility(networkType, freq.frequency, visible)
    })
  }
}, [frequencies])
```

**联动逻辑说明**:
- 扇区级别打开时：所有频点标签同步打开（但用户可以单独关闭某个频点）
- 扇区级别关闭时：所有频点标签同步关闭（但用户可以单独打开某个频点）
- 单独切换频点开关：不影响扇区级别的开关状态

## 测试建议

1. **标签内容测试**:
   - 右键点击 LTE/NR 图层，选择"标签设置"
   - 验证下拉列表中包含所有7个字段选项
   - 切换不同字段，验证地图上标签内容正确显示

2. **字体颜色和大小测试**:
   - 在标签设置中修改字体颜色
   - 保存后验证地图上标签颜色立即更新
   - 修改字体大小并验证生效

3. **联动控制测试**:
   - 打开扇区级别标签开关，验证所有频点标签同步打开
   - 单独关闭某个频点标签，验证该频点标签隐藏
   - 关闭扇区级别标签开关，验证所有频点标签同步关闭
   - 单独打开某个频点标签，验证该频点标签显示

## 技术要点

1. **字段映射**: 使用 `fieldNameMap` 将预定义字段值映射到实际的数据库列名（支持中英文）
2. **数据获取**: 优先从 `sector` 对象获取，回退到 `attributes` 对象
3. **强制更新**: 配置变化时清除标签缓存，强制重新创建
4. **状态同步**: 使用 `useCallback` 和依赖项确保状态正确同步
