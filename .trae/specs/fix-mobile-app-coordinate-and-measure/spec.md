# Fix Mobile APP Coordinate & Measure Features Spec

## Why
手机APP中存在两个影响用户体验的问题：
1. "坐标"搜索模式与地图点击操作存在冲突，坐标激活时应该只影响坐标定位和打点功能，不应干扰其他地图操作
2. 测距功能需要依次显示从起点到每个点的累计距离，而不是段间距离，且起点标记为"起点"，终点标记为"总长"

## What Changes
- 修改坐标模式行为：激活坐标模式时，地图点击生成带经纬度的标记点，不触发其他交互
- 添加"打点"模式：只有激活打点模式后才能在地图上打点并标记
- 修改测距标签：显示累计距离而非段间距离
- 添加起点和终点的特殊标签："起点"和"总长"
- 更新WebView中地图的点击逻辑，区分不同模式下的点击行为

## Impact
- Affected specs: 地图交互、测距功能、坐标定位功能
- Affected code: 
  - `mobile-app/app/(tabs)/index.tsx` - 主地图页面
  - `mobile-app/src/components/Map/MapView.tsx` - WebView地图组件
  - `mobile-app/src/components/Search/SearchBar.tsx` - 搜索栏组件
  - `mobile-app/src/components/Measure/MeasureControl.tsx` - 测距控制组件
  - `mobile-app/src/store/mapStore.ts` - 状态管理
  - `mobile-app/src/components/Marker/MarkerList.tsx` - 标记列表组件

## ADDED Requirements

### Requirement: 坐标模式地图点击行为
当"坐标"搜索模式激活时，地图点击应生成带经纬度的标记点并显示坐标提示，但不影响其他功能操作

#### Scenario: 坐标模式下单击地图
- **WHEN** 用户在坐标模式下点击地图任意位置
- **THEN** 在该位置生成标记点，显示经纬度坐标
- **AND** 不触发其他地图交互（如扇区选择等）

#### Scenario: 坐标模式下输入经纬度定位
- **WHEN** 用户在搜索框输入符合格式的经纬度（如"113.123,23.456"）
- **THEN** 地图定位到该坐标位置
- **AND** 在该位置生成一个标记点

### Requirement: 测距累计距离显示
测距功能应显示从起点到每个点的累计距离值，起点标记为"起点"，终点标记为"总长"

#### Scenario: 测距时显示累计距离
- **WHEN** 用户添加测距点
- **THEN** 每个点显示从起点到该点的累计距离
- **AND** 起点显示"起点"标签
- **AND** 最后一个点显示"总长"标签

## MODIFIED Requirements

### Requirement: 地图点击事件处理
修改地图点击事件的优先级和模式判断逻辑

- **当前**: 测距模式优先，其他模式点击地图显示坐标
- **修改后**: 
  1. 测距模式激活时 → 添加测距点
  2. 打点模式激活时 → 添加标记点
  3. 坐标模式激活时 → 添加坐标标记点并显示坐标
  4. 其他模式 → 正常地图交互（扇区选择等）

### Requirement: 测距标签渲染
修改WebView中测距标签的渲染逻辑

- **当前**: 显示段间距离
- **修改后**: 显示累计距离，起点和终点有特殊标记

## REMOVED Requirements

### Requirement: 坐标模式与地图点击冲突
**Reason**: 坐标模式不应阻止正常的地图交互
**Migration**: 通过添加模式判断逻辑，确保坐标模式只在需要时生效
