# 地图工具页面框选功能重构 Spec

## Why
当前框选功能存在以下问题：
1. 框选逻辑分散在多个组件中，代码耦合度高，难以维护
2. 选中扇区的高亮渲染逻辑与扇区渲染器深度耦合
3. 复制功能(Ctrl+C)的实现不够健壮，缺乏用户反馈
4. 框选状态管理分散，缺乏统一的状态管理

需要重构以提升代码可维护性、用户体验和功能扩展性。

## What Changes
- 重构框选功能模块，将框选逻辑从 OnlineMap 组件中抽离到独立的 SelectionManager 类
- 优化选中扇区的红色高亮渲染逻辑，确保高亮效果稳定可靠
- 增强 Ctrl+C 复制功能，添加复制成功/失败的视觉反馈
- 统一框选状态管理，使用单一数据源管理框选状态

## Impact
- Affected specs: 地图工具页面框选功能
- Affected code:
  - `frontend/src/renderer/components/Map/OnlineMap.tsx` - 主要修改
  - `frontend/src/renderer/components/Map/SectorRendererSVG.tsx` - 高亮渲染优化
  - `frontend/src/renderer/pages/MapPage.tsx` - 状态管理优化
  - 新增 `frontend/src/renderer/services/selectionManager.ts` - 框选管理服务

## ADDED Requirements

### Requirement: 框选工具菜单
系统 SHALL 提供框选工具菜单，包含圆形和多边形两种框选模式。

#### Scenario: 用户选择框选工具
- **WHEN** 用户点击菜单栏的"框选"按钮
- **THEN** 显示下拉菜单，包含"圆形"和"多边形"两个选项
- **AND** 选择任一选项后进入对应的框选模式
- **AND** 菜单自动收起

#### Scenario: 框选模式前置检查
- **WHEN** 用户尝试进入框选模式
- **AND** 当前没有可见的图层
- **THEN** 显示提示"请先在图层控制面板开启需要圈选的图层"
- **AND** 不进入框选模式

#### Scenario: 多图层限制
- **WHEN** 用户尝试进入框选模式
- **AND** 当前有多个可见图层（多于1个）
- **THEN** 显示提示"当前显示图层多于1个，请先在图层控制面板关闭冗余图层，确保只显示一个目标图层再进行圈选"
- **AND** 不进入框选模式

### Requirement: 圆形框选功能
系统 SHALL 支持圆形框选，用户可通过拖拽绘制圆形区域来选择扇区。

#### Scenario: 绘制圆形框选区域
- **WHEN** 用户处于圆形框选模式
- **AND** 用户在地图上按下鼠标左键并拖拽
- **THEN** 系统绘制一个以起点为圆心、拖拽距离为半径的圆形区域
- **AND** 实时显示圆形边框和半径数值

#### Scenario: 完成圆形框选
- **WHEN** 用户释放鼠标左键
- **THEN** 系统识别圆形区域内的所有扇区
- **AND** 选中的扇区边缘渲染为红色高亮
- **AND** 显示选中扇区数量提示

### Requirement: 多边形框选功能
系统 SHALL 支持多边形框选，用户可通过点击绘制多边形区域来选择扇区。

#### Scenario: 绘制多边形框选区域
- **WHEN** 用户处于多边形框选模式
- **AND** 用户在地图上点击
- **THEN** 系统添加一个多边形顶点
- **AND** 实时显示多边形边框

#### Scenario: 完成多边形框选
- **WHEN** 用户双击或右键点击
- **THEN** 系统闭合多边形并识别区域内的所有扇区
- **AND** 选中的扇区边缘渲染为红色高亮
- **AND** 显示选中扇区数量提示

### Requirement: 选中扇区红色高亮渲染
系统 SHALL 对框选选中的扇区渲染红色高亮边框。

#### Scenario: 应用选中高亮
- **WHEN** 框选完成并识别到选中的扇区
- **THEN** 所有选中扇区的边缘渲染为红色高亮（color: #ff0000, weight: 3）
- **AND** 高亮效果在地图缩放/移动后保持
- **AND** 选中扇区自动置于图层顶层

#### Scenario: 清除选中高亮
- **WHEN** 用户右键点击地图
- **OR** 用户点击"清除"按钮
- **THEN** 清除所有选中扇区的高亮效果
- **AND** 恢复扇区原始样式

### Requirement: Ctrl+C 复制功能
系统 SHALL 支持 Ctrl+C 快捷键复制选中扇区的属性数据到剪贴板。

#### Scenario: 复制选中数据
- **WHEN** 用户按下 Ctrl+C
- **AND** 当前有选中的扇区
- **THEN** 系统将选中扇区的属性数据格式化为 TSV 格式
- **AND** 复制到系统剪贴板
- **AND** 显示"已成功复制 N 条数据到剪贴板"提示

#### Scenario: 无选中数据时复制
- **WHEN** 用户按下 Ctrl+C
- **AND** 当前没有选中的扇区
- **THEN** 不执行复制操作
- **AND** 保留用户可能正在进行的文本选择

#### Scenario: 输入框焦点时复制
- **WHEN** 用户按下 Ctrl+C
- **AND** 焦点在输入框或文本区域
- **THEN** 不执行扇区数据复制
- **AND** 保留输入框的默认复制行为

### Requirement: 框选模式退出
系统 SHALL 支持多种方式退出框选模式。

#### Scenario: Esc 键退出
- **WHEN** 用户按下 Esc 键
- **THEN** 退出框选模式
- **AND** 保留当前选中状态和高亮

#### Scenario: 右键清除选中
- **WHEN** 用户右键点击地图
- **AND** 当前有选中的扇区
- **THEN** 清除选中状态和高亮
- **AND** 保持框选模式

### Requirement: 地图拖拽工具
系统 SHALL 在框选模式下提供地图拖拽工具。

#### Scenario: 启用拖拽工具
- **WHEN** 用户处于框选模式
- **AND** 用户点击"拖拽"按钮
- **THEN** 启用地图拖拽功能
- **AND** 光标变为手形
- **AND** 此时点击地图不会绘制框选区域

#### Scenario: 禁用拖拽工具
- **WHEN** 用户再次点击"拖拽"按钮
- **THEN** 禁用地图拖拽功能
- **AND** 光标变为十字
- **AND** 恢复框选绘制功能

## MODIFIED Requirements

### Requirement: 图层可见性控制
在框选模式下，系统 SHALL 限制只能显示一个图层。

#### Scenario: 框选模式下切换图层
- **WHEN** 用户处于框选模式
- **AND** 用户尝试开启新的图层
- **AND** 当前已有其他图层可见
- **THEN** 显示提示"框选模式下只能圈选一个图层"
- **AND** 阻止图层切换

## REMOVED Requirements
无移除的需求。
