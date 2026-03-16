# 修复框选时扇区图层没有高亮问题 Spec

## Why
框选时，基站扇区图层（LTE/NR）没有高亮显示选中区域，但地理化数据图层可以正常高亮。

## What Changes
- 将扇区图层相关的 layerVisibility.lte/nr 替换为 layerVisibilityRef.current.lte/nr

## Impact
- Affected specs: 地图工具页面框选功能
- Affected code: `frontend/src/renderer/components/Map/OnlineMap.tsx`

## Root Cause Analysis

### 问题分析
之前的修复只更新了 `performCircleSelection` 和 `performPolygonSelection` 函数，但扇区图层添加到地图的逻辑仍然使用 `layerVisibility.lte` 而不是 `layerVisibilityRef.current.lte`。

当图层控制面板勾选 LTE/NR 图层时：
1. `layerVisibilityRef.current.lte` 已更新为 true（正确）
2. 但扇区图层添加到地图时使用的是 `layerVisibility.lte`（可能还是旧值 false）
3. 导致扇区图层没有被添加到地图上

此外，即使扇区图层被添加到地图，如果 `lteSectorLayerRef.current` 为 null，高亮也不会被应用。

## ADDED Requirements

### Requirement: 扇区图层高亮显示
系统 SHALL 在框选时正确高亮显示选中的扇区。

## MODIFIED Requirements
无

## REMOVED Requirements
无
