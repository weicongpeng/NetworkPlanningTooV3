# 网络监测性能优化

## 问题描述

添加地图 API 连接监测后，地图窗口非常卡顿。

## 根本原因

1. **频繁的 HTTP 请求**：每 1 秒（恢复模式）和 5 秒（正常模式）发送请求
2. **过多的日志输出**：每次检测都输出多条日志
3. **立即启动检测**：页面加载时立即开始检测，影响初始化性能

## 性能优化方案

### 1. 降低检测频率

```typescript
// 之前
const CHECK_INTERVAL = 5000  // 5 秒
const RECOVERY_CHECK_INTERVAL = 1000  // 1 秒（恢复模式）

// 优化后
const CHECK_INTERVAL = 10000  // 10 秒
// 移除恢复模式，统一使用 10 秒间隔
```

### 2. 移除大部分日志

```typescript
// 之前：每次检测都输出日志
console.log('[OnlineMap] 开始检测地图 API 连接...')
console.log('[OnlineMap] API 连接检测成功')
console.log('[OnlineMap] 地图 API 连接正常')

// 优化后：只在关键时刻输出日志
// 初始化、错误切换、网络恢复时才输出
console.log('[OnlineMap] 初始化网络监测（性能优化版）')
console.warn('[OnlineMap] 地图服务连接失败')
console.log('[OnlineMap] 网络已恢复，清除提示')
```

### 3. 延迟启动检测

```typescript
// 之前：立即启动
startNetworkChecking()

// 优化后：延迟 3 秒启动
setTimeout(() => {
  performNetworkCheck()
  networkCheckIntervalId = setInterval(performNetworkCheck, CHECK_INTERVAL)
}, 3000)
```

### 4. 简化 fetch 请求

```typescript
// 之前：复杂 URL 构建
const timestamp = Date.now()
const testTileUrl = savedState.mapLayerType === 'satellite'
  ? `https://webst02.is.autonavi.com/appmaptile?style=6&x=${Math.floor(Math.random() * 1000)}...`
  : `https://webrd02.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8...`

// 优化后：固定 URL
await fetch(`https://webrd02.is.autonavi.com/appmaptile?style=8&x=100&y=100&z=10&_t=${Date.now()}`, {
  method: 'HEAD',
  mode: 'no-cors',
  cache: 'no-store'
})
```

### 5. 减少超时时间

```typescript
// 之前：3 秒超时
const timeoutId = setTimeout(() => controller.abort(), 3000)

// 优化后：2 秒超时
const timeoutId = setTimeout(() => controller.abort(), 2000)
```

### 6. 简化错误处理

```typescript
// 之前：详细日志
} catch (error) {
  console.warn('[OnlineMap] API 连接检测失败:', error)
  return false
}

// 优化后：静默模式
} catch {
  return false
}
```

## 优化后的检测流程

```
页面加载
  ↓
等待 3 秒（避免初始化卡顿）
  ↓
第一次 API 检测（静默）
  ↓
每 10 秒检测一次（低频率）
  ↓
检测到错误 → 显示提示 → 继续每 10 秒检测
  ↓
检测到恢复 → 清除提示
```

## 性能对比

| 指标 | 优化前 | 优化后 | 改善 |
|------|--------|--------|------|
| 检测间隔（正常） | 5 秒 | 10 秒 | 50% ↓ |
| 检测间隔（错误后） | 1 秒 | 10 秒 | 90% ↓ |
| 控制台日志 | 每次检测 3-5 条 | 仅关键时刻 1 条 | 90% ↓ |
| 初始化延迟 | 0 秒 | 3 秒 | 避免卡顿 |
| 请求超时 | 3 秒 | 2 秒 | 更快响应 |

## 权衡说明

### 牺牲的功能
- ❌ 恢复模式（1 秒快速检测）
- ❌ 详细的检测日志
- ❌ 随机瓦片坐标（避免缓存）

### 保留的功能
- ✅ API 连接检测（仍然有效）
- ✅ 浏览器 online/offline 事件监听（最快响应）
- ✅ 错误提示显示和清除
- ✅ 自动重试功能

### 预期行为变化

| 场景 | 优化前 | 优化后 |
|------|--------|--------|
| 浏览器 offline 事件 | < 0.1 秒 | < 0.1 秒（相同） |
| DevTools Offline 取消 | 1 秒 | 10 秒（较慢） |
| 系统断网后恢复 | 1-5 秒 | 10 秒（较慢） |
| 页面加载性能 | 卡顿 | 流畅 |

## 关键日志

### 初始化
```
[OnlineMap] 初始化网络监测（性能优化版）
```

### 检测到错误
```
[OnlineMap] 地图服务连接失败
```

### 网络恢复
```
[OnlineMap] 网络已恢复，清除提示
```

## 修改的代码

- `frontend/src/renderer/components/Map/OnlineMap.tsx`
  - 移除 `recoveryCheckIntervalId` 恢复模式定时器
  - 移除 `startRecoveryModeChecking()` 函数
  - 移除 `RECOVERY_CHECK_INTERVAL` 常量
  - 移除大部分检测日志
  - 将 `CHECK_INTERVAL` 从 5000 改为 10000
  - 添加延迟启动机制（3 秒）
  - 简化 `checkMapAPIConnection()` 函数
  - 更新 `handleOnline` 和 `handleOffline` 函数

## 推荐测试方法

由于 DevTools Offline 取消后不会触发 online 事件，现在**推荐使用系统断网**来测试：

1. 断开 WiFi 或网线
2. 观察错误提示显示（最多 10 秒）
3. 重新连接 WiFi 或网线
4. 观察提示清除（最多 10 秒）

如果需要更快的响应，可以手动刷新页面来立即检测网络状态。
