# Tasks
- [x] Task 1: 更新 selectionManager.ts 添加 point 模式支持
  - [x] SubTask 1.1: 修改 SelectionMode 类型，添加 'point' 类型
  - [x] SubTask 1.2: 添加多选状态管理（支持 Shift+点击）
- [x] Task 2: 更新 MapPage.tsx 添加点选菜单选项
  - [x] SubTask 2.1: 在下拉菜单中添加"点选"选项（位于圆形上方）
  - [x] SubTask 2.2: 修改 handleSelectionModeChange 处理 point 模式
- [x] Task 3: 更新 OnlineMap.tsx 支持点选模式
  - [x] SubTask 3.1: 扩展 selectionMode prop 类型
  - [x] SubTask 3.2: 在 handleSectorClick 中处理 point 模式
  - [x] SubTask 3.3: 禁用 point 模式下的属性弹窗和悬停显示
  - [x] SubTask 3.4: 处理 Shift+点击多选逻辑
- [x] Task 4: 更新 SectorRendererSVG.tsx 支持点选高亮
  - [x] SubTask 4.1: 确保 point 模式使用与 circle/polygon 相同的阴影样式

# Task Dependencies
- Task 1 是 Task 2、3、4 的前置依赖
- Task 2、3、4 可以并行执行
