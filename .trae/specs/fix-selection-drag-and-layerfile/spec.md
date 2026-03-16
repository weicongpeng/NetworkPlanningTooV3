# 框选功能与拖拽工具互斥及图层文件框选修复 Spec

## Why
当前框选功能存在以下问题：
1. 框选功能和拖拽工具不能同时激活，用户需要重新选择圈选工具才能继续圈选
2. 图层控制面板的"图层文件"（MapInfoLayer）框选功能未实现，点选、圆形或多边形均无法框选图层要素

## What Changes
- 框选功能和拖拽工具可以同时激活，拖拽时保持已圈选的区域和绘制的圈选图形状态
- 修复 MapInfoLayer 的框选功能，确保点选、圆形、多边形都能正确框选图层要素

## Impact
- Affected code: `frontend/src/renderer/components/Map/OnlineMap.tsx`, `frontend/src/renderer/pages/MapPage.tsx`

## ADDED Requirements

### Requirement: 框选与拖拽工具可同时激活
系统 SHALL 允许框选功能和拖拽工具同时激活。

#### Scenario: 拖拽时保持圈选状态
- **GIVEN** 用户已激活框选功能并圈选了要素
- **WHEN** 用户点击拖拽工具拖拽地图
- **THEN** 已圈选的区域和绘制的圈选图形状态保持不变

#### Scenario: 拖拽后继续圈选
- **GIVEN** 用户已激活框选功能并拖拽了地图
- **WHEN** 用户完成拖拽后
- **THEN** 可以继续进行圈选操作，无需重新选择圈选工具

### Requirement: 图层文件框选功能
系统 SHALL 支持对图层控制面板的"图层文件"进行框选操作。

#### Scenario: 点选图层文件要素
- **GIVEN** 图层文件已加载并可见
- **WHEN** 用户使用点选功能点击图层文件要素
- **THEN** 该要素被选中并高亮

#### Scenario: 圆形框选图层文件要素
- **GIVEN** 图层文件已加载并可见
- **WHEN** 用户使用圆形框选功能框选图层文件要素
- **THEN** 圆形范围内的要素被选中并高亮

#### Scenario: 多边形框选图层文件要素
- **GIVEN** 图层文件已加载并可见
- **WHEN** 用户使用多边形框选功能框选图层文件要素
- **THEN** 多边形范围内的要素被选中并高亮

### Requirement: 框选模式下禁用图层元素点击功能
系统 SHALL 在框选模式下禁用图层元素的点击功能，避免与框选功能冲突。

#### Scenario: 框选模式下点击图层元素不触发属性面板
- **GIVEN** 用户已激活框选功能
- **WHEN** 用户点击图层文件元素
- **THEN** 不显示元素属性面板，而是执行框选操作
