# 修复从PCI规划切换到地图浏览时的图层控制状态问题

## 问题描述

### 当前行为
当用户从PCI规划功能切换到地图浏览模块时：
1. 地图窗口自动加载了PCI规划地图视窗加载的扇区数据
2. 地图浏览页面的图层控制面板显示不一致：
   - **扇区总开关（LTE扇区/NR扇区）**：未勾选 ✅ 符合预期
   - **频点级开关复选框**：全部勾选 ❌ 不符合逻辑

### 期望行为
切换到地图浏览模块时：
- 图层总开关：关闭
- 频点级开关：全部关闭
- 地图窗口：不自动加载任何扇区数据（清空显示）

## 根本原因分析

### 数据流分析

**MapPage组件的状态初始化流程：**

1. **图层状态初始化**（第141行附近）：
```typescript
const [layers, setLayers] = useState<LayerOption[]>(createDefaultLayers())
// LTE扇区: visible: false
// NR扇区: visible: false
```

2. **从PCI规划切换到地图浏览时**：
   - OnlineMap组件的 `mode` 从 `'pci-planning'` 切换到 `'default'`
   - 触发 `loadSectorData(true)` 重新加载扇区数据
   - `sectorDataCache` 状态更新（第272-275行）
   
3. **频点扫描和初始化**（第533-597行的useEffect）：
```typescript
// 第566行：LTE频点初始化
visible: true, // 默认开启

// 第581行：NR频点初始化
visible: true, // 默认开启
```

### 问题根源

**核心问题**：频点初始化时使用了硬编码的 `visible: true`，没有检查对应的扇区总开关状态。

**导致的后果**：
- 扇区总开关 `visible: false`
- 频点开关 `visible: true`
- 逻辑不一致，用户界面显示混乱

### 代码位置

**文件**: `frontend/src/renderer/pages/MapPage.tsx`

**关键代码段**：
- 第141行：`layers` 状态初始化
- 第272-275行：`sectorDataCache` 状态定义
- 第533-597行：频点扫描和初始化逻辑
  - 第566行：LTE频点 `visible: true`
  - 第581行：NR频点 `visible: true`
- 第597行：useEffect依赖数组（只有 `[sectorDataCache.lte, sectorDataCache.nr]`）

## 修复方案

### 方案概述

修改频点初始化逻辑，使其根据扇区总开关的状态来设置频点可见性。

### 修改步骤

#### 步骤1：修改LTE频点初始化（第566行）

**修改前**：
```typescript
visible: true, // 默认开启，用户可以通过图层控制关闭
```

**修改后**：
```typescript
// 获取LTE扇区图层总开关状态
const lteLayerVisible = layers.find(l => l.id === 'lte-sectors')?.visible ?? false

visible: lteLayerVisible, // 根据扇区总开关状态设置
```

#### 步骤2：修改NR频点初始化（第581行）

**修改前**：
```typescript
visible: true, // 默认开启，用户可以通过图层控制关闭
```

**修改后**：
```typescript
// 获取NR扇区图层总开关状态
const nrLayerVisible = layers.find(l => l.id === 'nr-sectors')?.visible ?? false

visible: nrLayerVisible, // 根据扇区总开关状态设置
```

#### 步骤3：添加依赖（第597行）

**修改前**：
```typescript
}, [sectorDataCache.lte, sectorDataCache.nr])
```

**修改后**：
```typescript
}, [sectorDataCache.lte, sectorDataCache.nr, layers])
```

**说明**：添加 `layers` 依赖，确保当图层总开关状态变化时，频点可见性也能正确同步。

### 完整代码修改

```typescript
// 第533-597行的完整修改后代码：

useEffect(() => {
  const extractFrequencies = () => {
    const lteFreqCountMap = new Map<number, number>()
    const nrFreqCountMap = new Map<number, number>()

    // 扫描LTE扇区频点并统计小区数量
    sectorDataCache.lte.forEach(sector => {
      if (sector.frequency && sector.frequency > 0) {
        const currentCount = lteFreqCountMap.get(sector.frequency) || 0
        lteFreqCountMap.set(sector.frequency, currentCount + 1)
      }
    })

    // 扫描NR扇区频点并统计小区数量
    sectorDataCache.nr.forEach(sector => {
      if (sector.frequency && sector.frequency > 0) {
        const currentCount = nrFreqCountMap.get(sector.frequency) || 0
        nrFreqCountMap.set(sector.frequency, currentCount + 1)
      }
    })

    // 清除旧的颜色映射
    frequencyColorMapper.clear()

    // 【新增】获取扇区图层总开关状态
    const lteLayerVisible = layers.find(l => l.id === 'lte-sectors')?.visible ?? false
    const nrLayerVisible = layers.find(l => l.id === 'nr-sectors')?.visible ?? false

    // 为LTE频点生成颜色和小区数量
    const lteFrequencies: FrequencyOption[] = Array.from(lteFreqCountMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([freq, count]) => {
        const colorObj = frequencyColorMapper.getColor(freq, 'LTE')
        return {
          frequency: freq,
          color: colorObj.color,
          strokeColor: colorObj.strokeColor,
          visible: lteLayerVisible, // 【修改】根据扇区总开关状态设置
          networkType: 'LTE' as const,
          count: count
        }
      })

    // 为NR频点生成颜色和小区数量
    const nrFrequencies: FrequencyOption[] = Array.from(nrFreqCountMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([freq, count]) => {
        const colorObj = frequencyColorMapper.getColor(freq, 'NR')
        return {
          frequency: freq,
          color: colorObj.color,
          strokeColor: colorObj.strokeColor,
          visible: nrLayerVisible, // 【修改】根据扇区总开关状态设置
          networkType: 'NR' as const,
          count: count
        }
      })

    setFrequencies({
      lte: lteFrequencies,
      nr: nrFrequencies
    })
  }

  // 只在数据加载完成后扫描
  if (sectorDataCache.lte.length > 0 || sectorDataCache.nr.length > 0) {
    extractFrequencies()
  }
}, [sectorDataCache.lte, sectorDataCache.nr, layers]) // 【修改】添加layers依赖
```

## 测试计划

### 测试场景

#### 场景1：从PCI规划切换到地图浏览（主要验证场景）

**步骤**：
1. 启动应用，进入PCI规划功能
2. 在PCI规划地图中加载并显示一些扇区
3. 点击侧边栏的"地图浏览"菜单，切换到地图浏览模块
4. 观察图层控制面板的状态
5. 观察地图窗口的显示内容

**预期结果**：
- 图层控制面板：
  - LTE扇区总开关：未勾选 ❌
  - NR扇区总开关：未勾选 ❌
  - 所有LTE频点复选框：未勾选 ❌
  - 所有NR频点复选框：未勾选 ❌
- 地图窗口：不显示任何扇区数据（只有底图）

#### 场景2：地图浏览模块的图层控制功能

**步骤**：
1. 进入地图浏览模块（确保初始状态所有开关都是关闭的）
2. 勾选LTE扇区总开关
3. 观察频点开关和地图显示

**预期结果**：
- LTE扇区总开关：勾选 ✅
- 所有LTE频点复选框：自动勾选 ✅
- 地图窗口：显示LTE扇区数据 ✅
- NR扇区和频点：保持关闭 ❌

**步骤4**：
4. 取消勾选LTE扇区总开关
5. 观察频点开关和地图显示

**预期结果**：
- LTE扇区总开关：未勾选 ❌
- 所有LTE频点复选框：自动取消勾选 ❌
- 地图窗口：不显示LTE扇区数据 ✅

**步骤5**：
5. 重新勾选LTE扇区总开关
6. 手动取消勾选某个频点
7. 观察地图显示

**预期结果**：
- LTE扇区总开关：勾选 ✅
- 部分频点勾选，部分未勾选 ✅
- 地图窗口：只显示勾选频点的扇区 ✅

**步骤6**：
8. 取消勾选LTE扇区总开关
9. 再次勾选LTE扇区总开关

**预期结果**：
- LTE扇区总开关：勾选 ✅
- **所有LTE频点复选框应该重新全部勾选** ✅（总开关是快捷方式）

#### 场景3：地图浏览和PCI规划来回切换

**步骤**：
1. 在地图浏览模块中，勾选LTE扇区，调整频点显示
2. 切换到PCI规划模块
3. 在PCI规划中进行一些操作
4. 切换回地图浏览模块
5. 观察图层控制状态

**预期结果**：
- 地图浏览模块的状态应该重置为初始状态：
  - 所有开关未勾选 ❌
  - 地图窗口清空 ✅
- **不应该**保留之前的频点开关状态（因为每次切换都重新初始化）

### 回归测试

确保修改不影响以下功能：
1. 工参数据加载
2. 频点颜色映射
3. 扇区标签显示
4. 扇区搜索定位
5. 其他图层文件加载
6. 自定义图层功能

## 风险评估

### 低风险 ✅

- 修改仅涉及UI状态初始化逻辑
- 不修改数据加载逻辑
- 不修改地图渲染逻辑
- 不修改其他功能模块

### 潜在影响

1. **用户体验改变**：
   - 用户从PCI规划切换到地图浏览时，之前显示的扇区会消失
   - 需要手动勾选扇区总开关才能显示扇区
   - **这是符合预期的行为改进**

2. **现有行为兼容性**：
   - 当前行为本身就是bug，修复后行为更符合逻辑
   - 不会破坏用户的工作流程

## 验收标准

✅ 从PCI规划切换到地图浏览时，图层总开关和所有频点开关全部关闭  
✅ 地图窗口不显示任何扇区数据  
✅ 图层控制功能正常工作（总开关控制频点开关）  
✅ 频点开关可以单独控制扇区显示  
✅ 地图浏览和PCI规划来回切换时，状态正确重置  
✅ 不影响其他地图浏览功能  

## 实施时间估算

- **代码修改**：10分钟
- **测试验证**：20分钟
- **总计**：30分钟

## 相关文件

- `frontend/src/renderer/pages/MapPage.tsx`（主要修改文件）
- `frontend/src/renderer/components/Map/LayerControl.tsx`（参考文件）
- `frontend/src/renderer/components/Map/OnlineMap.tsx`（参考文件）

## 参考资料

- AGENTS.md - 项目技术栈和代码规范
- CLAUDE.md - 开发工作流程指南
