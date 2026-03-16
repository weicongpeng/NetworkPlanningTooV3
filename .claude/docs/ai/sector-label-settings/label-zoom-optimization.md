# 标签显示Zoom级别优化

## 优化日期
2026-01-25

## 问题描述
用户反馈当zoom小于18时，字体重叠严重，显示太多扇区标签并无实际意义。需要调整策略，在保证标签不重叠的情况下显示部分标签。

## 优化目标
1. **zoom < 18**: 严格限制标签数量，确保不重叠
2. **zoom >= 18**: 可以显示更多标签，但仍需控制上限
3. **标签位置**: 始终紧贴扇区（中部对齐）

## 优化内容

### 1. 更保守的标签显示策略

**文件**: `frontend/src/renderer/components/Map/SectorRendererSVG.tsx`

**方法**: `_getMaxLabelsPerLocation()`

**修改前**:
```typescript
private _getMaxLabelsPerLocation(): number {
  if (this.currentZoom <= 15) return 1
  return 100 // 高zoom下不限制
}
```

**修改后**:
```typescript
private _getMaxLabelsPerLocation(): number {
  // 保守的标签显示策略，确保不重叠
  const zoom = this.currentZoom

  if (zoom < 14) return 1      // 低zoom：只显示1个
  if (zoom < 16) return 2      // 中低zoom：显示2个
  if (zoom < 18) return 3      // 中zoom：显示3个
  if (zoom < 20) return 5      // 中高zoom：显示5个
  return 8                     // 高zoom：最多显示8个，仍然控制上限
}
```

### 2. 清理动态计算代码

**位置**: `_renderSectorsOptimized` 方法中的标签渲染逻辑

**修改前**:
```typescript
// 动态计算当前zoom下可以显示的标签数量
const baseLabelCount = 1
const zoomBonus = Math.max(0, this.currentZoom - 10)
const maxLabelsPerLocation = baseLabelCount + Math.floor(zoomBonus / 2)
```

**修改后**:
```typescript
// 使用统一的策略方法
const maxLabelsPerLocation = this._getMaxLabelsPerLocation()
```

## 显示策略表

| Zoom范围 | 每位置最多显示标签数 | 说明 |
|---------|-------------------|------|
| < 14    | 1个标签 | 低zoom，只显示最重要标签 |
| 14-15   | 2个标签 | 中低zoom，显示少量标签 |
| 16-17   | 3个标签 | 中zoom，适度显示 |
| 18-19   | 5个标签 | 中高zoom，显示更多但仍控制 |
| >= 20   | 8个标签 | 高zoom，最多8个（避免过于密集） |

## 技术要点

1. **保守策略**: 相比之前的"每2级zoom增加1个标签"，新策略更加保守
2. **硬上限**: 即使zoom很大，也限制最多显示8个标签，避免密集区域重叠
3. **渐进显示**: 标签数量随zoom平滑增加，而非线性增长
4. **位置分组**: 同一物理位置的扇区共享标签配额

## 对比分析

### 修改前
- zoom 10: 1个标签
- zoom 12: 2个标签
- zoom 14: 3个标签
- zoom 16: 4个标签
- zoom 18: 5个标签
- zoom >= 20: 无限制（可能导致重叠）

### 修改后
- zoom < 14: 1个标签（更严格）
- zoom 14-15: 2个标签（延迟增加）
- zoom 16-17: 3个标签（保持不变）
- zoom 18-19: 5个标签（适度增加）
- zoom >= 20: 8个标签（硬上限，避免重叠）

## 预期效果

1. **低zoom (< 14)**: 同一位置只显示1个标签，完全避免重叠
2. **中zoom (14-17)**: 逐步显示2-3个标签，仍然保持清晰
3. **高zoom (18+)**: 显示更多标签（5-8个），但仍有上限控制
4. **标签位置**: 始终紧贴扇区边缘（0.5米偏移）

## 测试建议

1. **低zoom测试**:
   - 设置zoom = 10-13
   - 验证同一位置只显示1个标签
   - 验证标签之间不重叠

2. **中zoom测试**:
   - 设置zoom = 14-17
   - 验证标签数量符合策略表
   - 验证标签仍然清晰可读

3. **高zoom测试**:
   - 设置zoom = 18-20
   - 验证可以显示更多标签（5-8个）
   - 验证即使zoom很大，也不会超过8个标签上限

4. **密集区域测试**:
   - 找到扇区密集的区域
   - 在各个zoom级别下验证标签不重叠
   - 验证标签始终紧贴扇区边缘
