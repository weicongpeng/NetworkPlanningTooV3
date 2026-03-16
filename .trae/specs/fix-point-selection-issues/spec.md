# 点选功能修复 Spec

## Why
点选功能存在以下问题需要修复：
1. 缩放过程中高亮样式不会始终显示，只在缩放结束后瞬间显示
2. 按 Shift 点选多个元素时，地图会自动缩放
3. 图层文件和地理化数据的点选功能未实现
4. 拖拽工具与框选功能捆绑，需要独立出来

## What Changes
- 修复缩放过程中高亮不持续显示的问题
- 修复 Shift+点击时的自动缩放问题
- 为图层文件和地理化数据实现点选功能
- 将拖拽工具从框选模式中独立出来

## Impact
- Affected code:
  - `frontend/src/renderer/components/Map/SectorRendererSVG.tsx`
  - `frontend/src/renderer/components/Map/OnlineMap.tsx`
  - `frontend/src/renderer/components/Map/MapInfoLayer.tsx`
  - `frontend/src/renderer/pages/MapPage.tsx`

## ADDED Requirements
### Requirement: 高亮持续显示
在地图缩放过程中，点选的高亮样式应始终保持可见。

#### Scenario: 缩放时高亮持续
- **WHEN** 用户在点选模式下缩放地图
- **THEN** 高亮样式在整个缩放过程中持续显示

### Requirement: 禁用自动缩放
按 Shift 点击时不应触发地图自动缩放。

#### Scenario: Shift+点击无缩放
- **WHEN** 用户按 Shift 键点击扇区进行多选
- **THEN** 地图不进行任何缩放操作

### Requirement: 图层点选功能
图层文件和地理化数据应支持点选功能。

#### Scenario: 点选图层要素
- **WHEN** 用户选择点选工具后点击图层要素
- **THEN** 要素被选中并显示高亮

### Requirement: 独立拖拽工具
拖拽工具应作为独立工具存在，不与框选功能捆绑。

#### Scenario: 独立拖拽
- **WHEN** 用户选择拖拽工具
- **THEN** 地图可以拖拽，且不影响已选中的元素、标记等状态
