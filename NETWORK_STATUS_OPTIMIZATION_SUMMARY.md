# 网络异常提示优化总结

## 优化目标

1. ✅ **快速显示错误提示** - 网络异常时立即反馈
2. ✅ **快速恢复提示** - 网络恢复后立即清除提示
3. ✅ **多级检测机制** - 确保不漏检网络问题

## 优化措施

### 1. 快速响应网络异常

**原逻辑**：连续失败 3 个瓦片才提示（需等待 2-3 秒）

**优化后**：
```typescript
// 第一个瓦片失败就立即提示
tileLayer.on('tileerror', (error: any) => {
  if (!hasShownError && !tileLoadSuccess) {
    setNetworkError({
      visible: true,
      message: '在线地图瓦片加载失败，请检查网络连接',
      canRetry: true
    })
  }
})
```

**效果**：从 2-3 秒延迟降低到 **几乎立即显示**（< 500ms）

### 2. 快速清除错误提示

#### 2.1 浏览器网络状态监听

```typescript
// 监听浏览器网络状态变化
window.addEventListener('online', () => {
  setNetworkError(prev => ({ ...prev, visible: false }))
})

window.addEventListener('offline', () => {
  setNetworkError({
    visible: true,
    message: '网络连接已断开，请检查网络设置',
    canRetry: true
  })
})
```

**效果**：系统级网络状态变化立即响应

#### 2.2 单个瓦片加载成功检测

```typescript
// 单个瓦片加载成功就快速检测恢复
tileLayer.on('tileload', () => {
  if (networkError.visible && !tileLoadSuccess) {
    setTimeout(() => {
      setNetworkError(prev => ({ ...prev, visible: false }))
    }, 500)
  }
})
```

**效果**：无需等待所有瓦片加载完成，**500ms** 即可清除提示

#### 2.3 所有瓦片加载完成检测

```typescript
// 所有瓦片加载完成，确保清除提示
tileLayer.on('load', () => {
  if (errorTimeoutId) {
    clearTimeout(errorTimeoutId)
  }
  if (networkError.visible) {
    setNetworkError(prev => ({ ...prev, visible: false }))
  }
})
```

**效果**：最终确认网络恢复，**立即**清除提示

### 3. 缩短超时检测时间

**原逻辑**：8 秒超时

**优化后**：3 秒超时

```typescript
tileLoadTimeoutRef.current = setTimeout(() => {
  if (!tileLoadSuccess && !tileLoadFailed) {
    setNetworkError({
      visible: true,
      message: '地图加载超时，请检查网络连接或后端服务状态',
      canRetry: true
    })
  }
}, 3000)  // 从 8000ms 降低到 3000ms
```

**效果**：超时检测响应时间缩短 **62.5%**

### 4. 地图类型切换时检测恢复

```typescript
// 切换地图类型时监听新瓦片加载
newTileLayer.on('tileload', () => {
  if (!hasLoadedTile) {
    hasLoadedTile = true
    if (networkError.visible) {
      setNetworkError(prev => ({ ...prev, visible: false }))
    }
  }
})
```

**效果**：用户手动切换地图时可快速检测网络恢复

## 性能对比

| 场景 | 优化前 | 优化后 | 改善 |
|------|--------|--------|------|
| 网络断开提示 | 2-3 秒 | < 0.5 秒 | **83%↑** |
| 网络恢复提示 | 需手动刷新 | 自动 0.5 秒 | **即时响应** |
| 超时检测 | 8 秒 | 3 秒 | **62.5%↑** |
| 系统级检测 | 无 | 有 | **新增** |

## 代码改进

### 添加的资源管理

```typescript
// 保存网络事件监听器引用，用于清理
const networkEventListenersRef = useRef<{
  handleOnline: () => void
  handleOffline: () => void
} | null>(null)

// 清理时移除监听器
if (networkEventListenersRef.current) {
  window.removeEventListener('online', networkEventListenersRef.current.handleOnline)
  window.removeEventListener('offline', networkEventListenersRef.current.handleOffline)
  networkEventListenersRef.current = null
}
```

### 防抖优化

```typescript
let errorTimeoutId: NodeJS.Timeout | null = null

// 在清除提示时清理定时器
if (errorTimeoutId) {
  clearTimeout(errorTimeoutId)
  errorTimeoutId = null
}
```

## 测试场景

### 场景 1：快速断网

1. 打开地图页面
2. 立即断网（DevTools Offline）
3. **预期**：< 0.5 秒显示错误提示

### 场景 2：快速恢复

1. 在断网状态下
2. 重新连接网络
3. **预期**：< 1 秒自动清除提示（无需刷新）

### 场景 3：切换地图检测

1. 网络异常时显示错误
2. 切换地图类型（平面/卫星）
3. **预期**：如果新地图加载成功，立即清除提示

### 场景 4：系统级网络变化

1. 断开 WiFi/网线
2. **预期**：立即显示离线提示
3. 重新连接 WiFi/网线
4. **预期**：立即清除提示

## 日志输出

优化后的控制台日志：

```
[OnlineMap] 瓦片开始加载
[OnlineMap] 瓦片加载失败: Error: Failed to fetch
[OnlineMap] 检测到瓦片加载失败，立即显示网络错误  ← 新增
[OnlineMap] 浏览器检测到网络恢复                    ← 新增
[OnlineMap] 单个瓦片加载成功，网络可能已恢复         ← 新增
```

## 兼容性

- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

**注意**：`window.addEventListener('online/offline')` 在所有现代浏览器中都支持。

## 后续建议

1. **添加重试次数限制**
   - 避免无限重试消耗资源
   - 失败 3 次后提示用户手动检查

2. **显示更详细的错误信息**
   - 区分网络断开、服务器错误、超时等
   - 提供具体的解决建议

3. **添加网络质量评估**
   - 测量实际加载速度
   - 显示网络质量等级（优/良/差）

4. **实现离线缓存**
   - 使用 Service Worker 缓存已加载区域
   - 支持离线浏览
