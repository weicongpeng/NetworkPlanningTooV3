# 网络恢复后提示框未自动关闭 - 修复说明

## 问题描述

网络异常时能正确弹出提示框，但网络恢复正常后，提示框没有及时自动关闭。

## 根本原因

在 `performNetworkCheck` 函数中，清除提示的条件过于严格：

```typescript
// ❌ 问题代码
if (hasNetworkErrorRef.current && networkError.visible) {
  // 清除提示
}
```

**问题分析**：

1. 当浏览器检测到网络恢复时，`handleOnline` 事件被触发
2. `handleOnline` 首先设置 `hasNetworkErrorRef.current = false`
3. 然后调用 `performNetworkCheck()`
4. 但此时 `performNetworkCheck` 中的条件 `hasNetworkErrorRef.current && networkError.visible` 已经不满足
5. 因为 `hasNetworkErrorRef.current` 已经是 `false`
6. 导致提示框无法被清除

**时序图**：

```
网络恢复
  ↓
handleOnline 触发
  ↓
hasNetworkErrorRef.current = false  ← 第一步重置
  ↓
setNetworkError({ visible: false }) ← 第二步清除提示（可能被跳过）
  ↓
performNetworkCheck()
  ↓
检查条件: hasNetworkErrorRef.current && networkError.visible
  ↓
结果: false && true = false ← 条件不满足！
  ↓
提示框不会被清除 ❌
```

## 解决方案

### 1. 修复 `performNetworkCheck` 中的条件

**修改前**：
```typescript
if (hasNetworkErrorRef.current && networkError.visible) {
  // 清除提示
}
```

**修改后**：
```typescript
if (networkError.visible) {
  // 清除提示（不管 hasNetworkErrorRef.current 的值）
}
```

同时，在 API 连接成功时也重置 `hasNetworkErrorRef.current`：
```typescript
if (isAPIConnected) {
  consecutiveAPIFailures = 0
  hasNetworkErrorRef.current = false  // 重置标志

  // 只要有错误提示显示，就立即清除
  if (networkError.visible) {
    console.log('[OnlineMap] API 连接恢复，清除错误提示')
    setNetworkError(prev => ({ ...prev, visible: false }))
  }
}
```

### 2. 优化 `handleOnline` 的执行顺序

**修改前**：
```typescript
const handleOnline = () => {
  hasNetworkErrorRef.current = false  // 先重置标志
  consecutiveAPIFailures = 0
  if (networkError.visible) {
    setNetworkError(prev => ({ ...prev, visible: false }))
  }
  performNetworkCheck()
}
```

**修改后**：
```typescript
const handleOnline = () => {
  console.log('[OnlineMap] 浏览器检测到网络恢复')

  // 立即清除错误提示（优先级最高，放在最前面）
  if (networkError.visible) {
    console.log('[OnlineMap] 立即清除错误提示')
    setNetworkError(prev => ({ ...prev, visible: false }))
  }

  // 重置网络错误标志和计数器
  hasNetworkErrorRef.current = false
  consecutiveAPIFailures = 0

  // 立即执行一次检测以确认网络确实恢复
  console.log('[OnlineMap] 立即执行 API 检测确认网络状态')
  performNetworkCheck()
}
```

## 修复后的时序图

```
网络恢复
  ↓
handleOnline 触发
  ↓
检查 networkError.visible
  ↓
setNetworkError({ visible: false }) ← 立即清除提示 ✓
  ↓
hasNetworkErrorRef.current = false
  ↓
performNetworkCheck()
  ↓
API 检测成功
  ↓
检查条件: networkError.visible
  ↓
结果: false ← 已经被 handleOnline 清除，无需重复操作 ✓
```

## 双重保障机制

修复后，网络恢复的清除机制有**双重保障**：

### 保障 1：浏览器 online 事件（最快）
```typescript
const handleOnline = () => {
  // 立即清除提示
  if (networkError.visible) {
    setNetworkError(prev => ({ ...prev, visible: false }))
  }
}
```

### 保障 2：API 检测成功（兜底）
```typescript
const performNetworkCheck = async () => {
  const isAPIConnected = await checkMapAPIConnection()
  if (isAPIConnected) {
    // 如果提示仍然显示，清除它
    if (networkError.visible) {
      setNetworkError(prev => ({ ...prev, visible: false }))
    }
  }
}
```

## 预期行为

| 场景 | 响应时间 | 清除方式 |
|------|----------|----------|
| 浏览器检测到 online | < 0.1 秒 | handleOnline 直接清除 |
| API 检测成功 | 1-5 秒 | performNetworkCheck 清除 |
| 两种方式同时触发 | < 0.1 秒 | 不会重复清除（state 相同） |

## 测试验证

### 步骤 1：网络断开
1. DevTools → Network → 勾选 "Offline"
2. 观察控制台：`[OnlineMap] 浏览器检测到网络断开`
3. 确认提示框显示 ✓

### 步骤 2：网络恢复
1. DevTools → Network → 取消 "Offline"
2. 观察控制台：
```
[OnlineMap] 浏览器检测到网络恢复
[OnlineMap] 立即清除错误提示
[OnlineMap] 立即执行 API 检测确认网络状态
[OnlineMap] 开始检测地图 API 连接...
[OnlineMap] API 连接检测成功
[OnlineMap] 地图 API 连接正常
[OnlineMap] networkError 状态变化: {visible: false, ...}
[NetworkStatusAlert] Render called, visible: false, ...
[NetworkStatusAlert] Returning null (not visible)
```
3. 确认提示框立即消失 ✓

## 修改的代码

### 文件：`frontend/src/renderer/components/Map/OnlineMap.tsx`

**修改 1**：`performNetworkCheck` 函数
- 移除对 `hasNetworkErrorRef.current` 的检查
- 在 API 连接成功时重置 `hasNetworkErrorRef.current`
- 只要 `networkError.visible` 为 true 就清除提示

**修改 2**：`handleOnline` 函数
- 将清除提示的逻辑放在最前面
- 添加更多调试日志
- 明确执行顺序

## 总结

| 项目 | 修复前 | 修复后 |
|------|--------|--------|
| 清除条件 | `hasNetworkErrorRef.current && networkError.visible` | `networkError.visible` |
| handleOnline 顺序 | 先重置标志，后清除提示 | 先清除提示，后重置标志 |
| 调试日志 | 基础日志 | 详细的执行流程日志 |
| 可靠性 | 单一保障 | 双重保障（online 事件 + API 检测） |
