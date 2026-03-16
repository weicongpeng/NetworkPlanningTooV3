# 修复框选功能无法选中扇区问题 Spec

## Why
重构后框选功能无法选中扇区，始终提示"所选区域内未发现任何要素"。

## What Changes
- 使用 useRef 存储 layerVisibility，确保 performCircleSelection/performPolygonSelection 始终获取最新值
- 移除之前的 useEffect 方案（因为 useEffect 在渲染后执行，无法保证时序）

## Impact
- Affected specs: 地图工具页面框选功能
- Affected code: `frontend/src/renderer/components/Map/OnlineMap.tsx`

## Root Cause Analysis

### 问题分析
1. **MapPage.tsx** 中 `initialLayerVisibility` 是动态计算的
2. **OnlineMap.tsx** 中使用 `useState` 存储 `layerVisibility`
3. **关键问题**：添加的 `useEffect` 是在渲染后执行，而 `performCircleSelection` 的闭包中捕获的是旧的 `layerVisibility` 值
4. React 的 useEffect 时序问题：即使 useEffect 更新了 state，useCallback 中的闭包仍然使用的是创建时的旧值

### 解决方案
使用 `useRef` 来存储 `layerVisibility`，这样可以在回调中始终获取最新的值：
```typescript
const layerVisibilityRef = useRef(layerVisibility)
layerVisibilityRef.current = layerVisibility
```

## ADDED Requirements

### Requirement: 确保框选使用最新的图层可见性
系统 SHALL 在执行框选时使用最新的图层可见性状态。

## MODIFIED Requirements
无

## REMOVED Requirements
无
