# Tasks

- [x] Task 1: 添加图层可见性检查
  - [x] SubTask 1.1: 创建 layerVisibilityRef 用于在回调中获取最新的图层可见性状态
  - [x] SubTask 1.2: 修改 selectFeaturesAtPoint 函数，只选择可见图层的元素
  - [x] SubTask 1.3: 修改 selectFeaturesInCircle 函数，只选择可见图层的元素
  - [x] SubTask 1.4: 修改 selectFeaturesInPolygon 函数，只选择可见图层的元素

- [x] Task 2: 修复 Shift+点选第一次点击高亮问题
  - [x] SubTask 2.1: 检查 selectFeaturesAtPoint 函数中多选模式的逻辑
  - [x] SubTask 2.2: 确保第一次点击时立即应用高亮

- [x] Task 3: 框选模式禁用干扰功能
  - [x] SubTask 3.1: 禁用双击放大地图功能（doubleClickZoom）
  - [x] SubTask 3.2: 确保点击不显示属性面板（已有判断，需验证）
  - [x] SubTask 3.3: 确保悬浮不显示标签（需检查）

- [x] Task 4: 多边形框选改为不封闭线段预览
  - [x] SubTask 4.1: 修改多边形绘制时的预览线段，不自动闭合

- [x] Task 5: 点击空白区域取消选中
  - [x] SubTask 5.1: 在点选模式下，如果点击位置没有可见图层元素，清除已选中状态

- [x] Task 6: 验证功能
  - [x] SubTask 6.1: 运行 TypeScript 类型检查
  - [x] SubTask 6.2: 验证只选择可见图层元素
  - [x] SubTask 6.3: 验证 Shift+点选第一次点击高亮
  - [x] SubTask 6.4: 验证框选模式禁用双击放大
  - [x] SubTask 6.5: 验证点击空白区域取消选中

# Task Dependencies
- [Task 2] depends on [Task 1]
- [Task 5] depends on [Task 1]
- [Task 6] depends on [Task 1, Task 2, Task 3, Task 4, Task 5]
