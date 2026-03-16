# 修复多边形框选双击后复制错误内容问题 Spec

## Why
多边形框选时，用户双击完成框选后，双击操作会同时选中文本，导致 Ctrl+C 复制的是选中的文本而不是扇区数据。

## What Changes
- 在双击完成多边形框选后，清除浏览器的文本选择状态

## Impact
- Affected specs: 地图工具页面框选功能
- Affected code: `frontend/src/renderer/components/Map/OnlineMap.tsx`

## Root Cause Analysis

### 问题分析
1. 用户在多边形框选模式下，双击完成框选
2. 双击事件触发了浏览器的默认文本选择行为
3. 双击位置的 DOM 元素（可能是图层控制面板的文字）被选中
4. 用户按 Ctrl+C 时，复制的是选中的文本，而不是扇区数据

## ADDED Requirements

### Requirement: 双击后清除文本选择
系统 SHALL 在双击完成多边形框选后清除浏览器的文本选择状态。

#### Scenario: 双击完成多边形框选
- **WHEN** 用户双击完成多边形框选
- **THEN** 清除浏览器当前的所有文本选择状态
- **AND** 确保 Ctrl+C 复制的是扇区数据

## MODIFIED Requirements
无

## REMOVED Requirements
无
