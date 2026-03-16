# 修复选择功能复制到剪贴板问题 Spec

## Why
当前地图工具的点选、圆形选择、多边形选择功能存在以下问题：
1. 选择完成后立即自动复制到剪贴板，而不是等待用户按 Ctrl+C
2. 没有保存选中要素的状态，导致无法支持用户主动复制
3. 高亮状态管理不完善，需要确保在框选模式下保持高亮

## What Changes
- 添加 `selectedFeaturesRef` 用于保存当前选中的要素属性
- 移除选择完成后的自动复制逻辑
- 添加 Ctrl+C 键盘事件监听，支持用户主动复制选中要素
- 确保高亮状态在框选模式下持续保持，直到退出框选模式
- 退出框选模式时清除高亮和选中状态

## Impact
- Affected code: `frontend/src/renderer/components/Map/OnlineMap.tsx`

## ADDED Requirements

### Requirement: 选中要素状态管理
系统 SHALL 维护当前选中要素的状态，包括要素ID集合和属性数据。

#### Scenario: 选择要素后保存状态
- **WHEN** 用户通过点选、圆形选择或多边形选择选中要素
- **THEN** 系统保存选中要素的ID集合和属性数据到 selectedFeaturesRef

#### Scenario: 退出框选模式时清除状态
- **WHEN** 用户退出框选模式
- **THEN** 系统清除 selectedFeaturesRef 中的数据并移除高亮

### Requirement: Ctrl+C 复制功能
系统 SHALL 支持用户通过 Ctrl+C 快捷键复制选中要素的属性信息到剪贴板。

#### Scenario: 框选模式下按 Ctrl+C
- **GIVEN** 用户处于框选模式且已选中要素
- **WHEN** 用户按下 Ctrl+C
- **THEN** 系统将选中要素的属性信息格式化为 Excel 兼容文本并复制到剪贴板

#### Scenario: 无选中要素时按 Ctrl+C
- **GIVEN** 用户处于框选模式但没有选中任何要素
- **WHEN** 用户按下 Ctrl+C
- **THEN** 系统不执行复制操作

### Requirement: 点选功能
系统 SHALL 支持点选图层元素，选中后保持高亮状态直到退出框选模式。

#### Scenario: 点选单个要素
- **GIVEN** 用户处于点选模式
- **WHEN** 用户点击地图上的要素
- **THEN** 系统选中该要素，应用高亮样式，并保存要素属性

#### Scenario: 点选多个重叠要素
- **GIVEN** 用户处于点选模式
- **WHEN** 用户点击的位置有多个重叠要素
- **THEN** 系统选中所有重叠要素，应用高亮样式，并保存所有要素属性

### Requirement: 圆形选择功能
系统 SHALL 支持通过绘制圆形框选范围内的图层元素，选中后保持高亮状态。

#### Scenario: 圆形框选要素
- **GIVEN** 用户处于圆形选择模式
- **WHEN** 用户在地图上绘制一个圆形区域
- **THEN** 系统选中圆内所有要素，应用高亮样式，并保存要素属性

### Requirement: 多边形选择功能
系统 SHALL 支持通过绘制多边形框选区域进行图层元素选择，选中后保持高亮状态。

#### Scenario: 多边形框选要素
- **GIVEN** 用户处于多边形选择模式
- **WHEN** 用户在地图上绘制一个多边形区域（双击完成）
- **THEN** 系统选中多边形内所有要素，应用高亮样式，并保存要素属性

## MODIFIED Requirements

### Requirement: 键盘事件处理
系统 SHALL 在框选模式下监听 Ctrl+C 快捷键进行复制操作。

**原有行为**：仅监听 Esc 退出框选模式
**修改后**：监听 Esc 退出框选模式，监听 Ctrl+C 复制选中要素
