# Tasks
- [x] Task 1: 修复缩放过程中高亮不持续显示问题
  - [x] SubTask 1.1: 在 SectorRendererSVG 的 zoom 事件中保持高亮
  - [x] SubTask 1.2: 使用 requestAnimationFrame 确保高亮在缩放时持续
- [x] Task 2: 修复 Shift+点击时的自动缩放问题
  - [x] SubTask 2.1: 在点击事件中阻止默认的缩放行为
  - [x] SubTask 2.2: 确保 Shift+点击不触发地图缩放
- [x] Task 3: 实现图层文件点选功能
  - [x] SubTask 3.1: 检查 MapInfoLayer 点击处理逻辑
  - [x] SubTask 3.2: 添加点选高亮样式支持
- [x] Task 4: 实现地理化数据点选功能
  - [x] SubTask 4.1: 检查地理化数据渲染方式
  - [x] SubTask 4.2: 添加点选事件处理
- [x] Task 5: 将拖拽工具独立出来
  - [x] SubTask 5.1: 从框选模式中解绑拖拽工具
  - [x] SubTask 5.2: 在菜单栏创建独立的拖拽工具按钮
  - [x] SubTask 5.3: 确保拖拽不影响已选元素状态

# Task Dependencies
- Task 1 和 Task 2 可以并行执行
- Task 3 和 Task 4 可以并行执行
- Task 5 独立执行
