# 移除在线地图主动网络检测功能

## 决定

由于添加在线地图网络检测后导致地图窗口非常卡顿，**完全移除主动网络检测功能**。

## 移除的内容

### 1. 主动 API 检测（删除）
```typescript
// ❌ 删除
const checkMapAPIConnection = async () => { ... }
let networkCheckIntervalId: NodeJS.Timeout | null = null
let isCheckingNetwork = false
const performNetworkCheck = async () => { ... }
const startNetworkChecking = () => { ... }
const stopNetworkChecking = () => { ... }
```

### 2. 恢复模式（删除）
```typescript
// ❌ 删除
let recoveryCheckIntervalId: NodeJS.Timeout | null = null
const startRecoveryModeChecking = () => { ... }
```

### 3. 大量日志输出（删除）
```typescript
// ❌ 删除
console.log('[OnlineMap] 开始检测地图 API 连接...')
console.log('[OnlineMap] API 连接检测成功')
console.log('[OnlineMap] 地图 API 连接正常')
console.log('[OnlineMap] [恢复模式]开始检测...')
// ... 等等
```

## 保留的功能

### 1. 浏览器网络状态监听（保留）
```typescript
// ✅ 保留：仅依赖系统级事件，无性能影响
const handleOnline = () => {
  console.log('[OnlineMap] 浏览器检测到网络恢复')
  hasNetworkErrorRef.current = false
  if (networkError.visible) {
    setNetworkError(prev => ({ ...prev, visible: false }))
  }
}

const handleOffline = () => {
  console.log('[OnlineMap] 浏览器检测到网络断开')
  hasNetworkErrorRef.current = true
  setNetworkError({
    visible: true,
    message: '网络连接已断开，请检查网络设置',
    canRetry: true
  })
}

window.addEventListener('online', handleOnline)
window.addEventListener('offline', handleOffline)
```

### 2. NetworkStatusAlert 组件（保留）
```typescript
// ✅ 保留：用于显示网络状态提示
<NetworkStatusAlert
  visible={networkError.visible}
  message={networkError.message}
  onRetry={networkError.canRetry ? retryInitMap : undefined}
  onDismiss={() => setNetworkError({ ...networkError, visible: false })}
/>
```

### 3. 相关 Ref（保留）
- `hasNetworkErrorRef.current` - 跟踪网络错误状态
- `hasLoadedAnyTileRef.current` - 跟踪瓦片加载状态
- `networkEventListenersRef.current` - 事件监听器引用

## 性能改善

| 指标 | 删除前 | 删除后 | 改善 |
|------|--------|--------|------|
| HTTP 请求 | 每 10 秒 | 0 | 100% ↓ |
| 定时器 | 1 个 | 0 | 100% ↓ |
| 控制台日志 | 每次检测 1-3 条 | 仅事件触发时 1 条 | 95% ↓ |
| CPU 占用 | 持续检测 | 事件驱动 | 显著降低 |
| 网络流量 | 持续请求 | 0 | 100% ↓ |

## 预期行为

### 场景 1：浏览器 online/offline 事件

**触发方式**：
- DevTools → Network → 勾选/取消 "Offline"（**注意**：不一定触发）
- 系统断开/连接 WiFi 或网线（**推荐**）

**行为**：
```
断网 → offline 事件触发 → 立即显示错误提示 ✓
联网 → online 事件触发 → 立即清除错误提示 ✓
```

### 场景 2：DevTools Offline 模式

**注意**：DevTools 的 Offline 模式**不一定触发**浏览器的 offline 事件，这是浏览器的限制。

**测试建议**：
1. 使用系统断网测试（断开 WiFi 或网线）
2. 或者刷新页面来检查网络状态

### 场景 3：地图服务器临时故障

**行为**：不再检测，地图可能显示空白瓦片，但不弹出提示。

**用户操作**：用户可以手动刷新页面来恢复。

## 关键日志（简化后）

### 初始化
无日志（静默启动）

### 网络断开
```
[OnlineMap] 浏览器检测到网络断开
```

### 网络恢复
```
[OnlineMap] 浏览器检测到网络恢复
```

## 修改的文件

- `frontend/src/renderer/components/Map/OnlineMap.tsx`
  - 移除 `checkMapAPIConnection()` 函数
  - 移除 `performNetworkCheck()` 函数
  - 移除 `startNetworkChecking()` 函数
  - 移除 `stopNetworkChecking()` 函数
  - 移除 `startRecoveryModeChecking()` 函数
  - 移除所有网络检测定时器
  - 移除大部分检测日志
  - 保留浏览器 online/offline 事件监听
  - 保留 NetworkStatusAlert 组件使用
  - 更新 cleanup 函数

## 替代方案

如果用户怀疑网络问题，可以：
1. **刷新页面**（F5 或 Ctrl+R）
2. **查看浏览器控制台**是否有网络错误
3. **检查 DevTools Network 面板**的请求状态

## 总结

**删除原因**：主动网络检测导致严重的性能问题（卡顿）

**当前方案**：仅依赖浏览器系统级网络事件（online/offline），零性能开销

**权衡**：
- ❌ 失去了主动检测能力
- ❌ DevTools Offline 模式可能不触发事件
- ✅ 地图操作完全流畅
- ✅ 零性能开销
- ✅ 简化的代码和逻辑
