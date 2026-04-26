# Tasks
- [x] Task 1: 添加打点模式状态到 mapStore
  - [x] SubTask 1.1: 在 mapStore.ts 中添加 markerMode 状态字段
  - [x] SubTask 1.2: 添加 toggleMarkerMode、setCoordinateMode 等操作函数
- [x] Task 2: 修改 SearchBar 坐标模式行为
  - [x] SubTask 2.1: 坐标模式激活时，向父组件发送坐标模式状态变化事件
  - [x] SubTask 2.2: 确保坐标搜索定位时生成标记点
- [x] Task 3: 修改地图点击逻辑
  - [x] SubTask 3.1: 修改 index.tsx 中的 handleMapPress 函数，添加模式优先级判断
  - [x] SubTask 3.2: 在 MapView.tsx 中传递坐标模式和打点模式状态到 WebView
  - [x] SubTask 3.3: 在 WebView 中根据模式处理地图点击事件
- [x] Task 4: 修改测距显示逻辑
  - [x] SubTask 4.1: 修改 MapView.tsx 中 WebView 的 updateMeasurePoints 函数
  - [x] SubTask 4.2: 实现累计距离计算和标签显示
  - [x] SubTask 4.3: 添加"起点"和"总长"特殊标记
- [x] Task 5: 添加打点模式按钮到地图界面
  - [x] SubTask 5.1: 在 index.tsx 中添加打点模式切换按钮
  - [x] SubTask 5.2: 实现打点模式下的地图点击处理逻辑
- [x] Task 6: 更新 MeasureControl 组件显示
  - [x] SubTask 6.1: 修改测距进行中的距离显示
  - [x] SubTask 6.2: 确保 UI 与新的累计距离显示一致

# Task Dependencies
- [Task 2] depends on [Task 1]
- [Task 3] depends on [Task 1]
- [Task 4] depends on [Task 3]
- [Task 5] depends on [Task 1]
- [Task 6] depends on [Task 4]
