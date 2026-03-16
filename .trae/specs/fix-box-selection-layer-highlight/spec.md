# 修复框选功能在"基站"和"图层文件"图层上无法高亮显示问题 Spec

## Why
用户报告框选"基站"（LTE/NR扇区）和"图层文件"下的图层（扇区类型）时，无法高亮显示圈选区域，但"地理化数据"图层可以正常高亮显示。

## What Changes
- 排查扇区图层（LTE/NR 和图层文件中的扇区类型）框选高亮无法显示的根本原因
- 修复高亮逻辑确保所有类型的扇区图层都能正确高亮

## Impact
- Affected specs: 地图工具页面框选功能
- Affected code: 
  - `frontend/src/renderer/components/Map/SectorRendererSVG.tsx` - 主要修改

## Root Cause Analysis

### 问题分析
经过深入代码分析，发现问题的根本原因如下：

1. **_forceRenderSectorsById 方法的缩放级别限制**
   - 原代码在缩放级别 <= 6 时直接返回，不渲染任何扇区
   - 这导致选中扇区在高缩放级别下无法被强制渲染到地图上

2. **_render 方法在低缩放级别下清空所有扇区**
   - 当地图缩放级别 <= 6 时，`_render` 方法会清空所有已渲染的扇区（`sectorPolygons` 和 `siteMarkers`）
   - 这导致之前选中的扇区在低缩放级别下被移除，高亮效果消失

3. **为什么"地理化数据"图层可以正常高亮**
   - "地理化数据"图层使用 `MapInfoLayer` 类
   - `MapInfoLayer.setSelectionHighlight` 直接遍历所有 GeoJSON 要素并应用高亮样式
   - 没有缩放级别的限制，始终遍历所有要素

### 解决方案
1. 移除 `_forceRenderSectorsById` 方法中的缩放级别检查（`currentZoom <= 6`）
2. 修改 `_render` 方法，在低缩放级别下保留选中的扇区用于高亮显示

## ADDED Requirements

### Requirement: 扇区图层框选高亮
系统 SHALL 在框选"基站"图层（LTE/NR扇区）时正确高亮显示选中的扇区。

#### Scenario: 圆形框选基站图层
- **WHEN** 用户使用圆形框选工具圈选基站图层
- **THEN** 选中的扇区边缘应渲染为红色高亮（#ff0000，宽度3）

#### Scenario: 多边形框选基站图层
- **WHEN** 用户使用多边形框选工具圈选基站图层
- **THEN** 选中的扇区边缘应渲染为红色高亮

### Requirement: 图层文件扇区类型高亮
系统 SHALL 在框选"图层文件"下的扇区类型图层时正确高亮显示选中的扇区。

#### Scenario: 框选图层文件扇区类型
- **WHEN** 用户框选图层文件中包含扇区数据的图层
- **THEN** 选中的扇区应正确高亮显示

## MODIFIED Requirements
无

## REMOVED Requirements
无
