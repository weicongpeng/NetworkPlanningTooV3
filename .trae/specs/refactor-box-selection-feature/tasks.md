# Tasks

- [x] Task 1: 创建 SelectionManager 服务类
  - [x] SubTask 1.1: 创建 selectionManager.ts 文件，定义 SelectionManager 类
  - [x] SubTask 1.2: 实现框选状态管理（选中要素、选中模式、选中形状）
  - [x] SubTask 1.3: 实现圆形框选算法（getSectorsInCircle）
  - [x] SubTask 1.4: 实现多边形框选算法（getSectorsInPolygon）
  - [x] SubTask 1.5: 实现 TSV 格式化和剪贴板复制功能
  - [x] SubTask 1.6: 实现事件发布订阅机制，支持框选状态变化通知

- [x] Task 2: 重构 OnlineMap 组件中的框选逻辑
  - [x] SubTask 2.1: 将框选相关的状态迁移到 SelectionManager
  - [x] SubTask 2.2: 重构圆形框选绘制逻辑，使用 mousedown/mouseup 事件
  - [x] SubTask 2.3: 重构多边形框选绘制逻辑，支持点击添加顶点、双击/右键完成
  - [x] SubTask 2.4: 优化框选模式的地图拖拽工具逻辑
  - [x] SubTask 2.5: 集成 SelectionManager 处理框选结果

- [x] Task 3: 优化 SectorRendererSVG 的高亮渲染
  - [x] SubTask 3.1: 优化 setSelectionHighlight 方法，确保高亮效果稳定
  - [x] SubTask 3.2: 添加 _forceRenderSectorsById 方法，强制渲染选中但不在视口的扇区
  - [x] SubTask 3.3: 优化 _updateSectorStyles 方法中的框选高亮逻辑
  - [x] SubTask 3.4: 确保高亮扇区在图层顶层显示

- [x] Task 4: 增强 Ctrl+C 复制功能
  - [x] SubTask 4.1: 优化复制逻辑，检查输入焦点和文本选择状态
  - [x] SubTask 4.2: 添加复制成功/失败的 Toast 提示替代 alert
  - [x] SubTask 4.3: 确保 TSV 格式与 Excel 完全兼容

- [x] Task 5: 优化 MapPage 组件的框选状态管理
  - [x] SubTask 5.1: 使用 SelectionManager 统一管理框选状态
  - [x] SubTask 5.2: 优化图层可见性切换时的框选模式检查
  - [x] SubTask 5.3: 优化清除按钮功能，同时清除框选状态

- [x] Task 6: 添加用户反馈和视觉提示
  - [x] SubTask 6.1: 添加框选完成后的扇区数量提示
  - [x] SubTask 6.2: 优化框选模式下的光标样式
  - [x] SubTask 6.3: 添加框选区域的视觉反馈（圆形半径显示、多边形顶点标记）

- [x] Task 7: 测试和验证
  - [x] SubTask 7.1: 测试圆形框选功能
  - [x] SubTask 7.2: 测试多边形框选功能
  - [x] SubTask 7.3: 测试 Ctrl+C 复制功能
  - [x] SubTask 7.4: 测试框选模式退出和清除功能
  - [x] SubTask 7.5: 测试地图拖拽工具在框选模式下的行为

# Task Dependencies
- [Task 2] depends on [Task 1]
- [Task 3] depends on [Task 1]
- [Task 4] depends on [Task 1]
- [Task 5] depends on [Task 1]
- [Task 6] depends on [Task 2, Task 3]
- [Task 7] depends on [Task 1, Task 2, Task 3, Task 4, Task 5, Task 6]
