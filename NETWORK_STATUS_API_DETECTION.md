# 网络异常提示修复 V5 - API 连接状态检测

## 问题描述

用户反馈：网络断开后仍然无法准确提示。之前基于瓦片加载事件的方法不够可靠。

## 新的解决方案：API 连接状态检测

### 核心原理

**不再依赖 Leaflet 瓦片事件**，改为直接检测地图 API 的连接状态：

```typescript
// 定期检测高德地图 API 是否可达
const checkMapAPIConnection = async (): Promise<boolean> => {
  try {
    // 使用高德地图的一个瓦片 URL 进行检测
    const testTileUrl = 'https://webrd02.is.autonavi.com/appmaptile?...&x=512&y=256&z=10'

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000) // 5秒超时

    await fetch(testTileUrl + '&t=' + Date.now(), {
      method: 'HEAD',
      mode: 'no-cors', // 跨域请求，只能检测是否能连接
      signal: controller.signal
    })

    clearTimeout(timeoutId)
    return true // 不抛出错误说明能连接
  } catch (error) {
    return false // 任何错误都认为无法连接
  }
}
```

### 检测流程

```
┌─────────────────────────────────────────────────────────────────┐
│                    API 连接状态检测流程                          │
└─────────────────────────────────────────────────────────────────┘

1. 组件挂载
   ↓
2. 启动定期检测（每 5 秒）
   ↓
3. 检测高德地图 API 连接
   ├─ 成功 → consecutiveAPIFailures = 0
   │         清除错误提示（如果有）
   │
   └─ 失败 → consecutiveAPIFailures++
            └─ 连续失败 ≥ 2 次 → 显示错误提示

4. 浏览器网络状态监听（辅助）
   ├─ online 事件 → 立即清除提示 + 重新检测
   └─ offline 事件 → 立即显示提示

5. 组件卸载
   └→ 清理定时器和事件监听器
```

### 关键参数

| 参数 | 值 | 说明 |
|------|---|------|
| `CHECK_INTERVAL` | 5000ms | 检测间隔：每 5 秒检测一次 |
| `MAX_API_FAILURES` | 2 | 连续失败 2 次才显示错误（避免误报） |
| `API_TIMEOUT` | 5000ms | 单次检测超时时间 |
| `testTileUrl` | z=10, x=512, y=256 | 测试瓦片坐标（固定选择一个常见瓦片） |

### 为什么选择这个方法

| 方法 | 优点 | 缺点 |
|------|------|------|
| **瓦片事件监听**（旧方法） | 原生、实时 | 不可靠：个别瓦片失败是正常现象 |
| **API 连接检测**（新方法） | ✅ 直接检测服务可用性<br>✅ 避免瓦片级别的误报<br>✅ 可控的检测间隔 | ⚠️ 有 5 秒延迟 |
| **浏览器 offline 事件** | ✅ 立即响应 | ⚠️ DevTools Offline 可能不触发 |

**新方法结合了 API 检测（主）+ 浏览器事件（辅）**，兼顾可靠性和响应速度。

## 预期行为

### 场景 1：网络正常

```
[OnlineMap] 启动定期网络检测
[OnlineMap] 开始检测地图 API 连接...
[OnlineMap] API 连接检测成功
[OnlineMap] 地图 API 连接正常
... (每 5 秒重复)
```

**结果**：不显示任何提示 ✓

### 场景 2：网络断开（系统断网）

```
[OnlineMap] 开始检测地图 API 连接...
[OnlineMap] API 连接检测失败: AbortError: Failed to fetch
[OnlineMap] 地图 API 连接失败 (1/2)
... (5 秒后)
[OnlineMap] 开始检测地图 API 连接...
[OnlineMap] API 连接检测失败: AbortError: Failed to fetch
[OnlineMap] 地图 API 连接失败 (2/2)
[OnlineMap] 连续 API 检测失败，显示网络错误
[OnlineMap] networkError 状态变化: {visible: true, ...}
```

**结果**：最多 10 秒内显示提示 ✓

### 场景 3：网络断开（DevTools Offline）

```
[OnlineMap] 浏览器检测到网络断开
[OnlineMap] 浏览器系统检测到网络断开，立即显示错误
[OnlineMap] networkError 状态变化: {visible: true, ...}
```

**结果**：立即（< 0.5 秒）显示提示 ✓

### 场景 4：网络恢复

```
[OnlineMap] 浏览器检测到网络恢复
[OnlineMap] 开始检测地图 API 连接...
[OnlineMap] API 连接检测成功
[OnlineMap] API 连接恢复，清除错误提示
[OnlineMap] networkError 状态变化: {visible: false, ...}
```

**结果**：立即清除提示 ✓

## 测试验证步骤

### 步骤 1：确认代码已更新

控制台应该显示：
```
[OnlineMap] 初始化 API 连接状态检测
[OnlineMap] 启动定期网络检测
[OnlineMap] 开始检测地图 API 连接...
```

### 步骤 2：测试系统断网（最可靠）

1. 断开 WiFi 或网线
2. 观察控制台

**预期日志**：
```
[OnlineMap] API 连接检测失败: AbortError: Failed to fetch
[OnlineMap] 地图 API 连接失败 (1/2)
[OnlineMap] API 连接检测失败: AbortError: Failed to fetch
[OnlineMap] 地图 API 连接失败 (2/2)
[OnlineMap] 连续 API 检测失败，显示网络错误
[NetworkStatusAlert] Render called, visible: true, ...
```

**预期结果**：最多 10 秒内显示提示框

### 步骤 3：测试网络恢复

1. 重新连接 WiFi 或网线
2. 观察控制台

**预期日志**：
```
[OnlineMap] 浏览器检测到网络恢复
[OnlineMap] 开始检测地图 API 连接...
[OnlineMap] API 连接检测成功
[OnlineMap] API 连接恢复，清除错误提示
[NetworkStatusAlert] Render called, visible: false, ...
```

**预期结果**：立即清除提示框

### 步骤 4：测试 DevTools Offline（快速）

1. F12 → Network → 勾选 "Offline"
2. 刷新页面

**预期结果**：立即显示提示（通过浏览器 offline 事件）

## 代码变更

### 移除的代码（瓦片事件监听）

```typescript
// ❌ 移除：不再监听瓦片加载事件
tileLayer.on('tileload', ...)
tileLayer.on('tileerror', ...)
tileLayer.on('loading', ...)
tileLayer.on('load', ...)

// ❌ 移除：不再使用瓦片级别的计数器
let consecutiveFailures = 0
let recentSuccessCount = 0
let recentFailCount = 0
```

### 新增的代码（API 连接检测）

```typescript
// ✅ 新增：API 连接检测函数
const checkMapAPIConnection = async (): Promise<boolean> => { ... }

// ✅ 新增：定期检测逻辑
let networkCheckIntervalId: NodeJS.Timeout | null = null
let consecutiveAPIFailures = 0
const MAX_API_FAILURES = 2
const CHECK_INTERVAL = 5000

// ✅ 新增：检测执行函数
const performNetworkCheck = async () => { ... }

// ✅ 新增：启动/停止检测函数
const startNetworkChecking = () => { ... }
const stopNetworkChecking = () => { ... }

// ✅ 改进：清理函数包含停止检测
networkEventListenersRef.current = {
  handleOnline,
  handleOffline,
  cleanup: () => {
    stopNetworkChecking()
    window.removeEventListener('online', handleOnline)
    window.removeEventListener('offline', handleOffline)
  }
}
```

## 优势

| 对比项 | 瓦片事件方法（旧） | API 检测方法（新） |
|--------|-------------------|-------------------|
| 可靠性 | ⚠️ 不可靠 | ✅ 可靠 |
| 误报率 | 🔴 高 | 🟢 低 |
| 检测延迟 | 🟢 快（< 1 秒） | 🟡 中等（5-10 秒） |
| 系统断网 | ❌ 可能无法检测 | ✅ 能检测 |
| DevTools Offline | ⚠️ 不一定触发 | ✅ 触发 offline 事件 |
| 代码复杂度 | 🔴 高（复杂判断） | 🟢 低（简单逻辑） |

## 注意事项

1. **DevTools Offline 模式**：优先通过浏览器 offline 事件检测，立即响应
2. **系统断网**：通过 API 检测，最多 10 秒显示提示
3. **网络恢复**：通过 online 事件 + API 检测双重确认
4. **清理资源**：组件卸载时自动清理定时器和监听器

## 修改的文件

- `frontend/src/renderer/components/Map/OnlineMap.tsx`
  - 移除所有瓦片事件监听器
  - 添加 API 连接检测逻辑
  - 添加定期检测机制
  - 更新网络事件监听器类型定义
  - 改进清理逻辑

## 调试日志

所有检测相关的日志前缀：
- `[OnlineMap] 初始化 API 连接状态检测` - 初始化
- `[OnlineMap] 启动定期网络检测` - 启动检测
- `[OnlineMap] 开始检测地图 API 连接...` - 开始检测
- `[OnlineMap] API 连接检测成功` - 检测成功
- `[OnlineMap] API 连接检测失败: ...` - 检测失败
- `[OnlineMap] 地图 API 连接失败 (N/2)` - 失败计数
- `[OnlineMap] 连续 API 检测失败，显示网络错误` - 触发提示
- `[OnlineMap] API 连接恢复，清除错误提示` - 清除提示
