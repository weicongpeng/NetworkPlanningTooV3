# Tasks

- [x] Task 1: 添加选中要素状态管理
  - [x] SubTask 1.1: 创建 selectedFeaturesRef 用于存储选中要素的属性数据
  - [x] SubTask 1.2: 创建 selectedIdsRef 用于存储选中要素的ID集合

- [x] Task 2: 修改选择函数以保存选中状态
  - [x] SubTask 2.1: 修改 selectFeaturesAtPoint 函数，将选中结果保存到 Ref 而非直接复制
  - [x] SubTask 2.2: 修改 selectFeaturesInCircle 函数，将选中结果保存到 Ref 而非直接复制
  - [x] SubTask 2.3: 修改 selectFeaturesInPolygon 函数，将选中结果保存到 Ref 而非直接复制

- [x] Task 3: 实现 Ctrl+C 复制功能
  - [x] SubTask 3.1: 在键盘事件处理中添加 Ctrl+C 监听
  - [x] SubTask 3.2: 当按下 Ctrl+C 时，从 selectedFeaturesRef 获取数据并复制到剪贴板

- [x] Task 4: 实现退出框选模式时清除状态
  - [x] SubTask 4.1: 在退出框选模式时清除 selectedFeaturesRef 和 selectedIdsRef
  - [x] SubTask 4.2: 在退出框选模式时调用 clearSelectionHighlight 清除高亮

- [x] Task 5: 验证功能
  - [x] SubTask 5.1: 运行 TypeScript 类型检查
  - [ ] SubTask 5.2: 验证点选功能：选中后高亮，Ctrl+C 复制成功
  - [ ] SubTask 5.3: 验证圆形选择功能：选中后高亮，Ctrl+C 复制成功
  - [ ] SubTask 5.4: 验证多边形选择功能：选中后高亮，Ctrl+C 复制成功
  - [ ] SubTask 5.5: 验证退出框选模式后高亮清除

# Task Dependencies
- [Task 2] depends on [Task 1]
- [Task 3] depends on [Task 1]
- [Task 4] depends on [Task 1]
- [Task 5] depends on [Task 2, Task 3, Task 4]
