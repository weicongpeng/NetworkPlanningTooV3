# 地图标签显示优化总结

## 优化日期
2026-01-24

## 优化内容

### 1. 去除标签背景

**文件**: `frontend/src/renderer/components/Map/SectorRendererSVG.tsx`

**修改**: 删除了标签的白色描边效果（`text-shadow`），使标签更加简洁清爽。

```typescript
// 修改前：大量 text-shadow 白色描边
text-shadow:
  -1px -1px 0 #ffffff,
  1px -1px 0 #ffffff,
  ...

// 修改后：去除描边，只保留文字
background-color: transparent;
padding: 0;
margin: 0;
```

**效果**: 标签现在只显示纯文字，没有白色背景/描边，更加简洁。

---

### 2. 标签紧贴扇区边缘显示

**文件**: `frontend/src/renderer/components/Map/SectorRendererSVG.tsx`

**修改**: `_createSectorLabel` 方法中的标签定位逻辑

将标签偏移量从8米大幅减少到0.5米，使标签几乎紧贴扇区边缘：

```typescript
// 修改前：8米偏移
const labelDistance = sectorRadius + 8  // 只添加8米的固定偏移

// 修改后：0.5米偏移（几乎紧贴）
const labelDistance = sectorRadius + 0.5  // 只添加0.5米的极小偏移，标签几乎紧贴扇区
```

**标签中心对齐**:
- CSS使用 `transform: translate(-50%, -50%)` 确保标签中心对齐到计算位置
- Leaflet iconAnchor 设置为 `[0, 0]` 配合CSS实现居中
- 标签中心点（而非左边缘）对齐到扇区边缘

**效果**: 标签紧贴扇区外边缘显示，中心对齐，无多余间距。

---

### 3. 同一位置多扇区智能显示

**文件**: `frontend/src/renderer/components/Map/SectorRendererSVG.tsx`

**新增方法**: `_getMaxLabelsPerLocation()`

根据 zoom 级别返回每个位置最多显示的标签数：

```typescript
private _getMaxLabelsPerLocation(): number {
  const zoom = this.currentZoom
  if (zoom <= 10) return 1  // zoom较小时只显示1个标签
  if (zoom <= 12) return 2  // 中等zoom显示2个标签
  if (zoom <= 14) return 3  // 较大zoom显示3个标签
  return 99  // zoom很大时显示所有标签
}
```

**修改**: `_renderSectorsOptimized` 方法
- 使用 `_groupSectorsByLocation()` 按位置分组扇区
- 根据 `maxLabelsPerLocation` 限制每个位置显示的标签数量

**效果**:
- Zoom 小时：同一位置只显示 1 个标签，避免重叠
- Zoom 增大：逐步显示更多标签（2个 → 3个 → 全部）
- 标签使用圆形分布，不会重叠

---

### 4. 渲染逻辑优化

**文件**: `frontend/src/renderer/components/Map/SectorRendererSVG.tsx`

**修改内容**:

#### 位置分组代替站点分组
```typescript
// 修改前：按站点ID和网络类型分组
const groupedSectors = new Map<string, RenderSectorData[]>()
const key = `${sector.siteId || 'unknown'}-${sector.networkType}`

// 修改后：按物理位置（经纬度）分组
const locationGroups = this._groupSectorsByLocation(sectorsToRender)
```

#### 标签显示逻辑优化
```typescript
// 根据zoom级别控制同一位置显示的标签数量
const shouldRenderThisLabel = i < maxLabelsPerLocation

if (shouldRenderThisLabel) {
  // 使用圆形分布：传入该扇区在位置组中的索引
  const label = this._createSectorLabel(
    sector,
    i,
    Math.min(locationSectors.length, maxLabelsPerLocation)
  )
}
```

---

### 5. 新增类属性

**文件**: `frontend/src/renderer/components/Map/SectorRendererSVG.tsx`

```typescript
// 位置分组缓存 - 用于同一位置的扇区分组
private locationGroupsCache: {
  groups: Map<string, RenderSectorData[]>
  timestamp: number
} | null = null
```

---

## 技术要点

1. **位置分组算法**: 使用经纬度保留4位小数作为位置键（约11米精度）
2. **圆形分布**: 使用 `_fastDestination()` 方法计算标签在圆周上的位置
3. **动态半径**: 标签分布半径根据 zoom 级别动态调整（30米基准 × zoom系数）
4. **渐进显示**: 根据zoom级别逐步增加显示的标签数量（1→2→3→全部）
5. **性能优化**: 缓存位置分组结果，避免重复计算

---

## 测试建议

1. **背景去除测试**:
   - 打开地图浏览，上传工参数据
   - 开启标签显示
   - 验证标签没有白色描边，只显示纯文字

2. **圆形分布测试**:
   - 展开 LTE/NR 图层，显示标签
   - 观察同一位置多个扇区的标签是否均匀分布
   - 标签应该围绕扇区呈圆形分布，而不是都堆在一侧

3. **Zoom级别测试**:
   - Zoom = 10: 同一位置只显示 1 个标签
   - Zoom = 12: 同一位置显示 2 个标签
   - Zoom = 14: 同一位置显示 3 个标签
   - Zoom > 14: 显示所有标签

4. **标签不重叠测试**:
   - 在各个 zoom 级别下，验证标签不会重叠
   - 标签之间应该有足够的间距

---

## 视觉效果对比

### 修改前
- ❌ 标签有白色描边，显得厚重
- ❌ 标签都向右偏移，重叠在一起
- ❌ 同一位置显示所有标签，严重重叠

### 修改后
- ✅ 标签只有纯文字，简洁清爽
- ✅ 标签围绕扇区均匀分布
- ✅ Zoom小时只显示1个标签，避免重叠
- ✅ Zoom增大时逐步显示更多标签
- ✅ 标签之间不会重叠
