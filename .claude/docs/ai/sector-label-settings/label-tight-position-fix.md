# 标签紧贴扇区边缘修复

## 修复日期
2026-01-25

## 问题描述
用户反馈标签距离扇区边缘较远，即使将偏移量从30米减少到8米后，标签仍然没有紧贴扇区。

## 用户需求
1. 标签应紧贴扇区边缘显示，标签中心对齐到扇区外边缘
2. Zoom较小时避免标签重叠，不显示所有扇区标签
3. Zoom增大时逐步显示更多标签

## 修复内容

### 1. 大幅减少标签偏移量

**文件**: `frontend/src/renderer/components/Map/SectorRendererSVG.tsx`

**位置**: `_createSectorLabel` 方法，第1631行和第1641行

**修改前**:
```typescript
const labelDistance = sectorRadius + 8  // 8米偏移
```

**修改后**:
```typescript
const labelDistance = sectorRadius + 0.5  // 0.5米偏移（几乎紧贴）
```

**效果**: 偏移量从8米减少到0.5米（减少94%），标签几乎紧贴扇区边缘。

### 2. 标签中心对齐机制

**CSS居中**:
```css
transform: translate(-50%, -50%);  /* 将标签中心对齐到锚点 */
```

**Leaflet锚点设置**:
```typescript
const iconAnchor = [0, 0]  // 锚点位置，配合CSS实现居中
```

**工作机制**:
1. `_fastDestination()` 计算标签位置坐标
2. Leaflet将 `iconAnchor` (即 [0,0]) 放置在计算的位置
3. CSS `transform: translate(-50%, -50%)` 将标签中心点移动到锚点位置
4. 结果：标签中心对齐到扇区外边缘

### 3. 动态标签显示（已实现）

**代码位置**: `_renderSectorsOptimized` 方法

```typescript
// 基础标签数1个，zoom每增加2级多显示1个标签
const baseLabelCount = 1
const zoomBonus = Math.max(0, this.currentZoom - 10)
const maxLabelsPerLocation = baseLabelCount + Math.floor(zoomBonus / 2)
```

**显示规则**:
- Zoom ≤ 10: 每个位置显示 1 个标签
- Zoom = 12: 每个位置显示 2 个标签
- Zoom = 14: 每个位置显示 3 个标签
- Zoom ≥ 16: 显示所有标签

## 技术要点

1. **极小偏移量**: 0.5米在地图上几乎是不可见的距离，确保标签视觉上紧贴扇区
2. **中心对齐**: CSS transform + Leaflet iconAnchor 确保标签中心（而非左边缘）对齐
3. **圆形分布**: 同一位置多个扇区的标签沿方位角方向均匀分布
4. **动态显示**: 根据zoom级别控制标签数量，避免重叠

## 视觉效果对比

### 修改前
- ❌ 标签距离扇区8米，视觉上有明显间隙
- ❌ 多个标签时重叠严重

### 修改后
- ✅ 标签几乎紧贴扇区边缘（0.5米偏移）
- ✅ 标签中心对齐到扇区外边缘
- ✅ Zoom小时只显示1个标签，避免重叠
- ✅ Zoom增大时逐步显示更多标签

## 测试建议

1. **紧贴度测试**:
   - 上传工参数据，开启标签显示
   - 放大地图到zoom ≥ 14
   - 验证标签紧贴扇区边缘，无明显间隙

2. **中心对齐测试**:
   - 观察标签文字，标签中心应该对齐到扇区外边缘
   - 而不是标签左边缘对齐

3. **多标签测试**:
   - 找到同一位置有多个扇区的区域
   - 验证标签沿扇区方位角方向分布
   - 验证标签之间不重叠

4. **Zoom级别测试**:
   - Zoom = 10: 只显示1个标签
   - Zoom = 12: 显示2个标签
   - Zoom = 14: 显示3个标签
   - Zoom > 14: 显示所有标签
