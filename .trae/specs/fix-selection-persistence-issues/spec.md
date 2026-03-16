# 框选功能BUG修复 Spec

## Why
当前框选功能存在以下问题：
1. 点选后切换到拖拽工具会清除选中状态和高亮
2. Shift+点选时地图会自动放大（双击放大未正确禁用）
3. Shift+点选需要点击两次才高亮
4. 圆形选择后拖拽地图会清除选中状态
5. 多边形双击完成有时不生效，需要多次双击

## What Changes
- 点选模式下切换工具不清除选中状态，只在退出点选模式时清除
- 确保点选模式下禁用双击放大
- 修复 Shift+点选第一次点击就高亮的逻辑
- 圆形/多边形选择后拖拽地图不清除选中状态
- 多边形双击自动闭合到起点

## Impact
- Affected code: `frontend/src/renderer/components/Map/OnlineMap.tsx`

## ADDED Requirements

### Requirement: 选中状态持久化
系统 SHALL 在框选模式下保持选中状态，直到用户主动退出框选模式。

#### Scenario: 切换工具不清除选中
- **GIVEN** 用户在点选模式下已选中若干要素
- **WHEN** 用户点击菜单栏的拖拽工具
- **THEN** 已选中的要素保持高亮状态

#### Scenario: 拖拽地图不清除选中
- **GIVEN** 用户在圆形/多边形模式下已选中若干要素
- **WHEN** 用户拖拽地图
- **THEN** 已选中的要素保持高亮状态

### Requirement: 多边形双击自动闭合
系统 SHALL 在多边形双击时自动闭合到起点。

#### Scenario: 双击自动闭合
- **GIVEN** 用户在多边形模式下已绘制至少3个点
- **WHEN** 用户双击完成绘制
- **THEN** 系统自动将最后一个点连接到起点形成闭合多边形

## MODIFIED Requirements

### Requirement: 点选模式禁用双击放大
系统 SHALL 在点选模式下禁用双击放大功能。

**原有行为**：Shift+点选时地图会放大
**修改后**：点选模式下双击放大被禁用

### Requirement: Shift+点选立即高亮
系统 SHALL 在 Shift+点选时第一次点击就显示高亮。

**原有行为**：需要点击两次才高亮
**修改后**：第一次点击就立即高亮
