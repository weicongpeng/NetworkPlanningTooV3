# 修复圆形和多边形框选扇区高亮显示问题 Spec

## Why
用户报告框选工具中的点选功能已实现选中扇区后高亮显示，但是圆形和多边形框选对已选中的扇区没有高亮显示。需要确保框选（圆形和多边形）与点选保持一致的高亮效果。

## What Changes
- 排查圆形和多边形框选后扇区高亮不显示的根本原因
- 确保框选后选中的扇区能够被强制渲染并应用高亮样式
- 保持与点选高亮颜色一致（红色 #ff0000，宽度 3）

## Impact
- Affected specs: 地图工具页面框选功能
- Affected code:
  - `frontend/src/renderer/components/Map/SectorRendererSVG.tsx` - 主要修改
  - `frontend/src/renderer/components/Map/OnlineMap.tsx` - 可能需要调整调用顺序

## Root Cause Analysis

### 问题分析
经过代码分析，发现问题的根本原因：

1. **getSectorsInCircle/getSectorsInPolygon 从原始数据查询**
   - 这两个方法从 `this.sectors`（原始扇区数据）查询，而非从已渲染的扇区
   - 返回的扇区可能尚未渲染到地图上

2. **setSelectionHighlight 调用时机问题**
   - 框选完成后先调用 `applySelectionHighlight`
   - `applySelectionHighlight` 调用 `setSelectionHighlight(ids)`
   - `setSelectionHighlight` 会遍历 `this.sectors` 查找匹配的扇区并强制渲染

3. **_render 方法在低缩放级别下的处理**
   - 当 zoom <= 6 时，`_render` 会清除非选中的扇区
   - 然后调用 `_forceRenderSectorsById` 强制渲染选中的扇区

### 可能的根本原因
1. `setSelectionHighlight` 中调用 `_forceRenderSectorsById` 时，可能存在缩放级别限制
2. 强制渲染创建扇区后，高亮样式可能没有正确应用
3. ID 匹配逻辑可能存在问题

## ADDED Requirements

### Requirement: 圆形框选扇区高亮
系统 SHALL 在圆形框选扇区时正确高亮显示选中的扇区，与点选高亮效果一致。

#### Scenario: 圆形框选基站图层
- **WHEN** 用户使用圆形框选工具圈选基站图层
- **THEN** 选中的扇区边缘应渲染为红色高亮（#ff0000，宽度3）

#### Scenario: 圆形框选后缩放地图
- **WHEN** 用户圆形框选扇区后缩放地图
- **THEN** 选中扇区的高亮效果应保持，直到清除选择

### Requirement: 多边形框选扇区高亮
系统 SHALL 在多边形框选扇区时正确高亮显示选中的扇区，与点选高亮效果一致。

#### Scenario: 多边形框选基站图层
- **WHEN** 用户使用多边形框选工具圈选基站图层
- **THEN** 选中的扇区边缘应渲染为红色高亮（#ff0000，宽度3）

#### Scenario: 多边形框选后缩放地图
- **WHEN** 用户多边形框选扇区后缩放地图
- **THEN** 选中扇区的高亮效果应保持，直到清除选择

## MODIFIED Requirements
无

## REMOVED Requirements
无
