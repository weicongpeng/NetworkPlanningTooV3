# 点选功能规格说明

## Why
用户需要在地图工具页面的框选下拉菜单中添加点选功能，允许通过单击鼠标逐个选中图层元素，支持多选并显示选中状态。

## What Changes
- 在框选下拉菜单中添加"点选"选项（位于圆形工具上方）
- 添加新的 selectionMode 类型：`'point'`
- 实现点选模式下的元素选中逻辑
- 支持按住 Shift 键进行多选
- 选中元素显示阴影效果（与框选相同的高亮样式）
- 点选模式下禁用：点击显示属性、悬停显示小区名

## Impact
- Affected specs: 框选功能（selectionManager）
- Affected code:
  - `frontend/src/renderer/services/selectionManager.ts`
  - `frontend/src/renderer/pages/MapPage.tsx`
  - `frontend/src/renderer/components/Map/OnlineMap.tsx`
  - `frontend/src/renderer/components/Map/SectorRendererSVG.tsx`

## ADDED Requirements
### Requirement: 点选模式
系统应提供点选功能，允许用户通过点击单个选择图层元素。

#### Scenario: 单选模式
- **WHEN** 用户从框选菜单选择"点选"工具，未按下 Shift 键
- **THEN** 鼠标点击地图上的扇区元素时，取消之前的选择并选中当前点击的元素，被选中元素显示红色边框阴影

#### Scenario: 多选模式
- **WHEN** 用户选择"点选"工具，按住 Shift 键同时点击多个扇区元素
- **THEN** 依次选中所有点击的元素，形成多选集合，所有选中元素显示红色边框阴影

#### Scenario: 清除选择
- **WHEN** 用户在点选模式下点击地图空白区域（无扇区）
- **THEN** 清除所有已选中的元素

#### Scenario: 禁用原有交互
- **WHEN** 用户处于点选模式
- **THEN** 鼠标点击扇区不显示属性弹窗，鼠标悬停不显示小区名称

## MODIFIED Requirements
### Requirement: selectionMode 类型扩展
将 selectionMode 类型从 `'none' | 'circle' | 'polygon'` 扩展为 `'none' | 'circle' | 'polygon' | 'point'`

### Requirement: 框选菜单项顺序
将菜单项顺序调整为：点选 → 圆形 → 多边形
