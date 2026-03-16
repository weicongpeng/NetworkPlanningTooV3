# 网络恢复提示框未及时关闭 - 最终修复

## 问题描述

从用户截图可以看出：
1. DevTools Offline 模式被取消后，浏览器的 `online` 事件**没有被触发**
2. 完全依赖 API 检测来发现网络恢复
3. 但 API 检测间隔是 5 秒，太慢了
4. 用户需要等待 5+ 秒才能看到提示框消失

## 解决方案：双模式检测机制

### 核心改进

当错误提示显示时，自动切换到**恢复模式**，检测频率从 5 秒提高到 1 秒。

```
正常模式：每 5 秒检测一次（低频率，节省资源）
  ↓
检测到网络错误
  ↓
显示错误提示 + 切换到恢复模式
  ↓
恢复模式：每 1 秒检测一次（高频率，快速响应）
  ↓
检测到网络恢复
  ↓
清除提示 + 切换回正常模式
```

### 代码变化

#### 1. 添加恢复模式定时器

```typescript
let networkCheckIntervalId: NodeJS.Timeout | null = null      // 正常模式定时器
let recoveryCheckIntervalId: NodeJS.Timeout | null = null     // 恢复模式定时器
const CHECK_INTERVAL = 5000        // 正常模式：5 秒
const RECOVERY_CHECK_INTERVAL = 1000  // 恢复模式：1 秒
```

#### 2. 启动恢复模式检测

```typescript
const startRecoveryModeChecking = () => {
  // 清除现有的恢复模式定时器
  if (recoveryCheckIntervalId) {
    clearInterval(recoveryCheckIntervalId)
  }

  console.log('[OnlineMap] 启动恢复模式检测（1秒间隔）')

  // 立即执行一次检测
  performNetworkCheck(true)

  // 每 1 秒检测一次
  recoveryCheckIntervalId = setInterval(() => {
    performNetworkCheck(true)
  }, RECOVERY_CHECK_INTERVAL)
}
```

#### 3. 网络恢复时切换回正常模式

```typescript
if (isAPIConnected) {
  // 清除错误提示
  if (networkError.visible) {
    console.log('[OnlineMap] API 连接恢复，清除错误提示并切换到正常检测模式')
    setNetworkError(prev => ({ ...prev, visible: false }))

    // 停止恢复模式定时器
    if (recoveryCheckIntervalId) {
      clearInterval(recoveryCheckIntervalId)
      recoveryCheckIntervalId = null
      console.log('[OnlineMap] 切换回正常检测模式（5秒间隔）')
    }
  }
}
```

#### 4. handleOffline 也启动恢复模式

```typescript
const handleOffline = () => {
  // 显示错误提示
  setNetworkError({ visible: true, ... })

  // 启动恢复模式检测
  startRecoveryModeChecking()
}
```

### 优化 fetch 请求

```typescript
// 之前：可能有缓存问题
await fetch(testTileUrl + '&t=' + Date.now(), {
  method: 'HEAD',
  mode: 'no-cors',
  signal: controller.signal
})

// 修复后：禁用缓存 + 随机瓦片坐标
await fetch(testTileUrl, {
  method: 'GET',
  mode: 'no-cors',
  cache: 'no-store',  // 禁用缓存
  signal: controller.signal
})
```

### 超时时间优化

```typescript
// 之前：5 秒超时
const timeoutId = setTimeout(() => controller.abort(), 5000)

// 修复后：3 秒超时（更快检测）
const timeoutId = setTimeout(() => controller.abort(), 3000)
```

## 预期行为

### 场景 1：DevTools Offline 模式测试

```
1. 勾选 "Offline"
   ↓
[OnlineMap] 浏览器检测到网络断开
[OnlineMap] 显示错误提示
[OnlineMap] 启动恢复模式检测（1秒间隔）
   ↓
2. 取消 "Offline"
   ↓
[OnlineMap] [恢复模式]开始检测地图 API 连接...
[OnlineMap] [恢复模式]API 连接检测成功
[OnlineMap] [恢复模式]地图 API 连接正常
[OnlineMap] API 连接恢复，清除错误提示并切换到正常检测模式
[OnlineMap] 切换回正常检测模式（5秒间隔）
```

**预期结果**：最多 1 秒后提示框消失 ✓

### 场景 2：系统断网

```
网络断开
  ↓
[OnlineMap] API 连接检测失败 (1/2)
[OnlineMap] API 连接检测失败 (2/2)
[OnlineMap] 连续 API 检测失败，显示网络错误并切换到恢复检测模式
[OnlineMap] 启动恢复模式检测（1秒间隔）
  ↓
网络恢复
  ↓
[OnlineMap] [恢复模式]API 连接检测成功
[OnlineMap] API 连接恢复，清除错误提示并切换到正常检测模式
```

**预期结果**：最多 11 秒后提示框消失（5秒检测到错误 + 1秒恢复检测 + 5秒容错）

### 场景 3：浏览器 online 事件触发（最快）

```
网络恢复
  ↓
[OnlineMap] 浏览器检测到网络恢复
[OnlineMap] 立即清除错误提示并停止恢复模式
  ↓
提示框立即消失 ✓
```

**预期结果**：< 0.1 秒提示框消失 ✓

## 关键日志

### 恢复模式启动
```
[OnlineMap] 连续 API 检测失败，显示网络错误并切换到恢复检测模式
[OnlineMap] 启动恢复模式检测（1秒间隔）
```

### 恢复模式检测
```
[OnlineMap] [恢复模式]开始检测地图 API 连接...
[OnlineMap] [恢复模式]API 连接检测成功
[OnlineMap] [恢复模式]地图 API 连接正常
```

### 切换回正常模式
```
[OnlineMap] API 连接恢复，清除错误提示并切换到正常检测模式
[OnlineMap] 切换回正常检测模式（5秒间隔）
```

## 优势对比

| 方面 | 修复前 | 修复后 |
|------|--------|--------|
| 错误显示后检测频率 | 5 秒 | 1 秒 |
| 网络恢复响应时间 | 5-10 秒 | 1 秒 |
| 资源消耗（正常时） | 低 | 低（相同） |
| 资源消耗（错误时） | 低 | 中（可接受） |
| DevTools Offline 支持 | 差 | 优秀 |

## 测试验证步骤

### 最简单测试：DevTools Offline

1. F12 → Network → 勾选 "Offline"
2. 观察提示框显示
3. 取消 "Offline"
4. **最多 1 秒后提示框应该消失**

### 验证恢复模式日志

控制台应该显示：
```
[OnlineMap] 启动恢复模式检测（1秒间隔）
[OnlineMap] [恢复模式]开始检测地图 API 连接...
[OnlineMap] [恢复模式]API 连接检测成功
[OnlineMap] API 连接恢复，清除错误提示并切换到正常检测模式
[OnlineMap] 切换回正常检测模式（5秒间隔）
```

## 修改的文件

- `frontend/src/renderer/components/Map/OnlineMap.tsx`
  - 添加 `recoveryCheckIntervalId` 恢复模式定时器
  - 添加 `RECOVERY_CHECK_INTERVAL` 常量（1 秒）
  - 添加 `startRecoveryModeChecking()` 函数
  - 修改 `performNetworkCheck()` 接受 `isRecoveryMode` 参数
  - 优化 `checkMapAPIConnection()` fetch 请求
  - 更新 `handleOffline()` 启动恢复模式
  - 更新 `handleOnline()` 停止恢复模式

## 总结

通过**双模式检测机制**，实现了：
- ✅ 正常时低资源消耗（5 秒检测）
- ✅ 错误时快速响应（1 秒检测）
- ✅ 网络恢复后立即清除提示（< 1 秒）
- ✅ 支持 DevTools Offline 模式测试
