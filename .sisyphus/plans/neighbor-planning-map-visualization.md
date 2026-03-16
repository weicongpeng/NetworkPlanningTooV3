# 邻区规划地理化展示功能开发规范

## 需求概述

为邻区规划模块添加地图可视化功能，参考 PCI 规划的地理化展示设计，实现源小区和目标小区的地图展示。

## 功能需求

### FR-1: 地图布局
**优先级**: P0 (必须有)

邻区规划页面应采用与 PCI 规划相同的两列布局：
- **左列**：规划参数 + 规划结果列表（占屏幕 40-60%）
- **右列**：地图窗口（占屏幕 40-60%）
- **分隔**：两列之间应有明显的视觉分隔，但不一定需要可调整的分隔条

**验收标准**:
- ✅ 地图窗口和结果列表同时可见
- ✅ 布局响应式：屏幕宽度 < 1024px 时垂直堆叠
- ✅ 地图窗口最小高度：400px

### FR-2: 结果列表交互
**优先级**: P0 (必须有)

当用户点击邻区规划结果列表中的源小区行时：
1. 地图应自动移动和缩放以显示源小区和所有目标小区
2. 源小区扇区渲染为红色（#FF0000，不透明度 80%，边框 2px）
3. 目标小区扇区渲染为蓝色（#0000FF，不透明度 60%，边框 1px）
4. 其他小区不显示或渲染为半透明（不透明度 20%）

**验收标准**:
- ✅ 点击源小区行时，地图在 500ms 内响应
- ✅ 地图中心移动到源小区位置
- ✅ 地图缩放级别调整为 13-15（确保所有目标小区可见）
- ✅ 源小区颜色正确渲染为红色
- ✅ 目标小区颜色正确渲染为蓝色
- ✅ 未选中的小区半透明显示

### FR-3: 扇区渲染逻辑
**优先级**: P0 (必须有)

邻区规划模式下的扇区渲染应使用与 PCI 规划相同的渲染基础设施，但使用不同的颜色配置：

**颜色配置**:
```typescript
const neighborPlanningColors = {
  sourceCell: {
    fillColor: '#FF0000',  // 红色
    fillOpacity: 0.8,
    color: '#CC0000',      // 深红色边框
    weight: 2
  },
  targetCell: {
    fillColor: '#0000FF',  // 蓝色
    fillOpacity: 0.6,
    color: '#0000CC',      // 深蓝色边框
    weight: 1
  },
  otherCell: {
    fillColor: '#CCCCCC',  // 灰色
    fillOpacity: 0.2,
    color: '#999999',
    weight: 0.5
  }
}
```

**验收标准**:
- ✅ 源小区使用红色配置
- ✅ 目标小区使用蓝色配置
- ✅ 其他小区使用灰色半透明配置
- ✅ 扇区形状和方向正确（与 PCI 规划一致）

### FR-4: 性能要求
**优先级**: P1 (重要)

**性能指标**:
- 首次渲染时间：< 2 秒（50 个扇区）
- 增量更新时间：< 500ms（切换源小区）
- 内存使用：< 200MB（包含地图瓦片）
- 帧率：> 30fps（平移和缩放时）

**优化策略**:
- 当目标小区数量 > 50 时，应用聚合策略
- 缩放级别 < 10 时，使用圆点标记代替扇区多边形
- 使用虚拟滚动处理大型结果列表

**验收标准**:
- ✅ 渲染 100 个目标小区时帧率不低于 30fps
- ✅ 切换源小区时地图更新在 500ms 内完成
- ✅ 内存使用不超过 200MB

### FR-5: 兼容性保证
**优先级**: P0 (必须有)

**要求**:
- PCI 规划功能保持不变
- 地图浏览功能保持不变
- 模式切换时正确清理状态

**验收标准**:
- ✅ PCI 规划的地图显示和交互功能正常
- ✅ 地图浏览的图层控制和标签功能正常
- ✅ 切换模块时无内存泄漏
- ✅ 回归测试套件通过

## 非功能性需求

### NFR-1: 可维护性
- 代码复用：使用与 PCI 规划相同的渲染基础设施
- 配置化：颜色配置应易于修改
- 模块化：邻区规划特定的逻辑应独立封装

### NFR-2: 可测试性
- 单元测试：颜色分类逻辑
- 集成测试：地图交互功能
- 视觉回归测试：截图对比

### NFR-3: 可访问性
- 结果列表行可通过键盘导航
- 地图交互支持键盘快捷键（可选）

## 数据结构

### 邻区规划结果数据结构
```typescript
interface NeighborResultData {
  taskId: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: number
  totalSites: number
  totalSectors: number
  totalNeighbors: number
  avgNeighbors: number
  results?: NeighborSiteResult[]
  startTime: string
  endTime?: string
}

interface NeighborSiteResult {
  siteId: string
  siteName?: string
  managedElementId?: string
  sectors: NeighborSectorResult[]
}

interface NeighborSectorResult {
  sectorId: string
  sectorName: string
  frequency?: number
  earfcn?: number
  ssb_frequency?: number
  originalPCI?: number
  newPCI?: number
  neighbors: NeighborInfo[]
  // 新增：用于地图渲染
  latitude: number
  longitude: number
  azimuth: number
  beamwidth: number
  cell_cover_type?: number
  networkType: 'LTE' | 'NR'
}

interface NeighborInfo {
  targetSectorId: string
  targetSectorName: string
  targetSiteId: string
  targetLatitude: number
  targetLongitude: number
  targetFrequency?: number
  targetNetworkType: 'LTE' | 'NR'
  // ... 其他邻区属性
}
```

### 地图渲染模式扩展
```typescript
// 在 SectorRendererSVG.tsx 中扩展渲染模式
type RenderMode = 'default' | 'pci-planning' | 'neighbor-planning'

// 邻区规划高亮配置
interface NeighborHighlightConfig {
  sourceSectorId: string          // 源小区 ID
  targetSectorIds: Set<string>    // 目标小区 ID 集合
  sourceColor: string             // 源小区颜色
  targetColor: string             // 目标小区颜色
}
```

## 实施计划

### 阶段 1: 基础布局和地图集成
**工作量**: 2-3 小时

1. **修改 NeighborPage.tsx 布局**
   - 参考 PCIPage.tsx 的两列布局
   - 添加 OnlineMap 组件到右列
   - 创建 mapRef 引用

2. **添加地图组件导入**
   ```typescript
   import { OnlineMap, type OnlineMapRef } from '../components/Map/OnlineMap'
   const mapRef = useRef<OnlineMapRef>(null)
   ```

3. **创建邻区数据同步服务**
   - 参考 pciDataSyncService.ts
   - 创建 neighborDataSyncService.ts
   - 管理邻区规划结果和选中状态

### 阶段 2: 扇区渲染模式扩展
**工作量**: 3-4 小时

1. **扩展 SectorRendererSVG 渲染模式**
   - 添加 `'neighbor-planning'` 到 RenderMode 类型
   - 实现 `setNeighborHighlight()` 方法
   - 添加 `neighborHighlightConfig` 状态

2. **实现颜色分类逻辑**
   ```typescript
   private _classifySectorForNeighborPlanning(
     sector: RenderSectorData
   ): 'source' | 'target' | 'other' {
     const config = this.neighborHighlightConfig
     if (!config) return 'other'

     if (sector.id === config.sourceSectorId) return 'source'
     if (config.targetSectorIds.has(sector.id)) return 'target'
     return 'other'
   }
   ```

3. **更新样式应用逻辑**
   - 在 `_updateSectorStyles` 中添加邻区规划分支
   - 应用相应的颜色配置

### 阶段 3: 结果列表交互
**工作量**: 2-3 小时

1. **添加行点击处理**
   - 在结果表格的 `<tr>` 添加 `onClick` 事件
   - 实现 `handleResultRowClick` 方法

2. **实现地图交互逻辑**
   ```typescript
   const handleResultRowClick = (
     sourceSector: NeighborSectorResult
   ) => {
     // 1. 提取源小区和目标小区信息
     const sourceSectorId = `${sourceSector.siteId}-${sourceSector.sectorId}`
     const targetSectorIds = new Set(
       sourceSector.neighbors.map(n => `${n.targetSiteId}-${n.targetSectorId}`)
     )

     // 2. 调用地图组件设置高亮
     mapRef.current?.setNeighborHighlight({
       sourceSectorId,
       targetSectorIds,
       sourceColor: '#FF0000',
       targetColor: '#0000FF'
     })

     // 3. 移动地图到源小区位置
     mapRef.current?.flyTo(
       [sourceSector.latitude, sourceSector.longitude],
       14,  // 缩放级别
       { duration: 0.5 }  // 动画时长（秒）
     )
   }
   ```

### 阶段 4: 数据同步和状态管理
**工作量**: 2 小时

1. **创建邻区数据同步服务**
   ```typescript
   // services/neighborDataSyncService.ts
   class NeighborDataSyncService {
     private neighborResults: NeighborResultData | null = null
     private selectedSourceSector: NeighborSectorResult | null = null

     setNeighborResults(data: NeighborResultData) {
       this.neighborResults = data
     }

     getSelectedSourceSector(): NeighborSectorResult | null {
       return this.selectedSourceSector
     }

     setSelectedSourceSector(sector: NeighborSectorResult) {
       this.selectedSourceSector = sector
     }

     getTargetSectors(): RenderSectorData[] {
       if (!this.selectedSourceSector) return []
       // 返回目标小区数据
     }
   }
   ```

2. **集成到 OnlineMap 组件**
   - 添加 `setNeighborHighlight` 命令
   - 传递给 SectorRendererSVG

### 阶段 5: 测试和验证
**工作量**: 2-3 小时

1. **功能测试**
   - 验证源小区红色渲染
   - 验证目标小区蓝色渲染
   - 验证地图移动和缩放
   - 验证性能指标

2. **回归测试**
   - PCI 规划功能测试
   - 地图浏览功能测试
   - 模块切换测试

3. **性能测试**
   - 渲染时间测量
   - 内存使用监控
   - 帧率测试

## 技术风险和缓解措施

### 风险 1: 内存泄漏
**描述**: 模式切换时可能未正确清理状态

**缓解措施**:
- 在组件卸载时调用 `mapRef.current?.cleanup()`
- 在模式切换时调用 `mapRef.current?.clearNeighborHighlight()`
- 使用 Chrome DevTools 进行内存泄漏检测

### 风险 2: 性能问题
**描述**: 大量目标小区可能导致渲染缓慢

**缓解措施**:
- 实现扇区聚合策略（> 50 个目标小区）
- 缩放级别 < 10 时使用圆点标记
- 使用虚拟滚动处理大型结果列表

### 风险 3: 影响 PCI 规划功能
**描述**: 修改 SectorRendererSVG 可能影响 PCI 规划

**缓解措施**:
- 使用独立的配置对象，不共享状态
- 在渲染方法中明确区分三种模式
- 完整的回归测试套件

## 验收标准总结

### 功能验收
- ✅ 地图窗口正确显示在邻区规划页面
- ✅ 点击源小区行时地图正确响应
- ✅ 源小区渲染为红色
- ✅ 目标小区渲染为蓝色
- ✅ 地图移动和缩放正确

### 性能验收
- ✅ 首次渲染时间 < 2 秒
- ✅ 增量更新时间 < 500ms
- ✅ 内存使用 < 200MB
- ✅ 帧率 > 30fps

### 兼容性验收
- ✅ PCI 规划功能正常
- ✅ 地图浏览功能正常
- ✅ 无内存泄漏
- ✅ 回归测试通过

## 参考资料

### 相关文件
- `frontend/src/renderer/pages/PCIPage.tsx` - PCI 规划页面布局参考
- `frontend/src/renderer/pages/NeighborPage.tsx` - 邻区规划页面（待修改）
- `frontend/src/renderer/components/Map/OnlineMap.tsx` - 地图组件
- `frontend/src/renderer/components/Map/SectorRendererSVG.tsx` - 扇区渲染器
- `frontend/src/renderer/services/pciDataSyncService.ts` - PCI 数据同步服务参考

### 技术文档
- Leaflet.js 文档: https://leafletjs.com/
- React Leaflet 文档: https://react-leaflet.js.org/
- 项目 CLAUDE.md: 开发工作流程指南
