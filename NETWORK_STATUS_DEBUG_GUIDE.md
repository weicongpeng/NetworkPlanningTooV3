# 网络异常提示调试指南 (V4)

## 关键调试日志

现在代码中添加了详细的调试日志。打开浏览器控制台（F12）后，你应该看到以下日志：

### 正常初始化
```
[OnlineMap] networkError 状态变化: {visible: false, message: "", canRetry: false}
[OnlineMap] 初始化网络检测逻辑
```

### 网络断开时（应该看到）
```
[OnlineMap] 浏览器检测到网络断开
[OnlineMap] 浏览器系统检测到网络断开，立即显示错误
[OnlineMap] networkError 状态变化: {visible: true, message: "网络连接已断开，请检查网络设置", canRetry: true}
[NetworkStatusAlert] Render called, visible: true, message: 网络连接已断开，请检查网络设置
[NetworkStatusAlert] Rendering alert component
```

### 网络恢复时（应该看到）
```
[OnlineMap] 浏览器检测到网络恢复
[OnlineMap] networkError 状态变化: {visible: false, message: "网络连接已断开...", canRetry: true}
[NetworkStatusAlert] Render called, visible: false, message: ...
[NetworkStatusAlert] Returning null (not visible)
```

## 快速验证步骤

### 步骤 1: 确认代码已更新

打开浏览器控制台（F12），检查是否有以下日志：
```
[OnlineMap] networkError 状态变化: {visible: false, ...}
[OnlineMap] 初始化网络检测逻辑
```

如果没有看到这些日志，说明**代码没有更新**，需要：
1. 停止 Vite 开发服务器（Ctrl+C）
2. 清除 Vite 缓存：`rm -rf node_modules/.vite`（Windows: `rmdir /s /q node_modules\.vite`）
3. 重新启动：`npm run dev:web`
4. **硬刷新**浏览器：Ctrl+Shift+R（清除缓存刷新）

### 步骤 2: 测试断网检测

**方法 A：使用 DevTools Network 面板**
1. 打开 DevTools（F12）
2. 切换到 **Network** 面板
3. 勾选 **"Offline"** 复选框
4. 刷新页面（F5）

**预期日志**：
```
[OnlineMap] 初始化网络检测逻辑
[OnlineMap] 瓦片开始加载
[OnlineMap] 浏览器检测到网络断开
[OnlineMap] 浏览器系统检测到网络断开，立即显示错误
[OnlineMap] networkError 状态变化: {visible: true, ...}
[NetworkStatusAlert] Render called, visible: true, ...
[NetworkStatusAlert] Rendering alert component
```

**预期结果**：应该立即（< 0.5 秒）显示错误提示框

**方法 B：使用系统断网**
1. 断开 WiFi 或网线
2. 刷新页面

**预期日志**（如果浏览器 offline 事件未触发）：
```
[OnlineMap] 初始化网络检测逻辑
[OnlineMap] 瓦片开始加载
[OnlineMap] 瓦片加载失败 (连续失败:1/3, ...)
[OnlineMap] 瓦片加载失败 (连续失败:2/3, ...)
[OnlineMap] 瓦片加载失败 (连续失败:3/3, ...)
[OnlineMap] 触发检测条件1: 连续3个瓦片失败
[OnlineMap] 连续 3 个瓦片加载失败，显示网络错误
[OnlineMap] networkError 状态变化: {visible: true, ...}
```

**预期结果**：3 秒内应该显示错误提示（超时检测）

### 步骤 3: 控制台诊断命令

在浏览器控制台运行以下命令：

```javascript
// 检查 React 组件状态
console.log('Network error state:', document.querySelector('[class*="NetworkStatus"]'))

// 检查是否有 z-index 遮挡问题
const alert = document.querySelector('[class*="NetworkStatus"]')
if (alert) {
  console.log('Alert found:', alert)
  console.log('Alert computed style:', window.getComputedStyle(alert))
} else {
  console.error('NetworkStatusAlert 组件未找到！')
}

// 检查 Leaflet 瓦片图层
const mapContainer = document.querySelector('.leaflet-container')
console.log('Map container exists:', !!mapContainer)

// 检查网络状态
console.log('Browser online status:', navigator.onLine)

// 手动触发网络错误测试（调试用）
console.log('Testing network error display...')
```

### 步骤 4: 检查 CSS 问题

错误提示可能被 CSS 隐藏了。在控制台运行：

```javascript
// 查找所有 fixed 定位的元素
const fixedElements = Array.from(document.querySelectorAll('*')).filter(el => {
  const style = window.getComputedStyle(el)
  return style.position === 'fixed' && style.zIndex >= 9999
})
console.log('Fixed elements with high z-index:', fixedElements)

// 检查 NetworkStatusAlert 的样式
const alerts = Array.from(document.querySelectorAll('*')).filter(el => {
  return el.textContent.includes('网络连接异常') || el.textContent.includes('网络连接已断开')
})
console.log('Network error elements found:', alerts.length)
alerts.forEach((el, i) => {
  console.log(`Alert ${i}:`, el, window.getComputedStyle(el))
})
```

## 常见问题排查

### Q1: 没有 "[OnlineMap] 初始化网络检测逻辑" 日志

**原因**：代码没有更新或缓存问题

**解决方法**：
```bash
# 1. 停止 Vite（Ctrl+C）
# 2. 清除缓存并重启
rm -rf node_modules/.vite  # Windows: rmdir /s /q node_modules\.vite
npm run dev:web

# 3. 浏览器硬刷新
# Ctrl + Shift + R (Windows/Linux)
# Cmd + Shift + R (Mac)
```

### Q2: 有日志但没有显示提示框

**原因**：CSS 或 z-index 问题

**解决方法**：
1. 在控制台运行上面的 "检查 CSS 问题" 诊断命令
2. 检查是否有其他元素遮挡
3. 检查 NetworkStatusAlert 组件的 z-index 值

### Q3: DevTools Offline 模式没有触发 offline 事件

**原因**：DevTools 的 Offline 模式有时不会触发浏览器的 offline 事件

**解决方法**：
1. 依赖瓦片加载失败检测（应该有 `[OnlineMap] 瓦片加载失败` 日志）
2. 依赖 3 秒超时检测（应该有 `[OnlineMap] 超时检测` 日志）
3. 或者使用系统断网（断开 WiFi/网线）测试

### Q4: 日志显示正常但提示框不可见

**检查**：
```javascript
// 检查元素是否在 DOM 中
const alert = document.querySelector('[class*="NetworkStatus"]')
console.log('Alert in DOM:', !!alert)
console.log('Alert display:', alert ? window.getComputedStyle(alert).display : 'N/A')
console.log('Alert visibility:', alert ? window.getComputedStyle(alert).visibility : 'N/A')
```

## 预期的完整日志序列

### 场景 1：正常加载（网络正常）

```
[OnlineMap] 初始化网络检测逻辑
[OnlineMap] 瓦片开始加载
[OnlineMap] 瓦片加载成功 (连续失败:0, 最近成功:1, 最近失败:0)
[OnlineMap] 瓦片加载成功 (连续失败:0, 最近成功:2, 最近失败:0)
...
[OnlineMap] 所有瓦片加载完成
```

### 场景 2：断开网络（DevTools Offline）

```
[OnlineMap] 初始化网络检测逻辑
[OnlineMap] 瓦片开始加载
[OnlineMap] 浏览器检测到网络断开
[OnlineMap] 浏览器系统检测到网络断开，立即显示错误
```

### 场景 3：断开网络（瓦片失败检测）

```
[OnlineMap] 初始化网络检测逻辑
[OnlineMap] 瓦片开始加载
[OnlineMap] 瓦片加载失败 (连续失败:1/3, 最近成功:0, 最近失败:1)
[OnlineMap] 当前失败率: 100%
[OnlineMap] 瓦片加载失败 (连续失败:2/3, 最近成功:0, 最近失败:2)
[OnlineMap] 当前失败率: 100%
[OnlineMap] 瓦片加载失败 (连续失败:3/3, 最近成功:0, 最近失败:3)
[OnlineMap] 当前失败率: 100%
[OnlineMap] 触发检测条件1: 连续3个瓦片失败
[OnlineMap] 连续 3 个瓦片加载失败，显示网络错误
```

### 场景 4：超时检测（兜底）

```
[OnlineMap] 初始化网络检测逻辑
[OnlineMap] 瓦片开始加载
...（3秒内没有任何瓦片加载成功）
[OnlineMap] 超时检测：3秒内没有任何瓦片加载成功
```

## 如果问题仍然存在

请提供以下信息：

1. **控制台完整日志**（复制所有 `[OnlineMap]` 开头的日志）
2. **浏览器版本**：Chrome/Firefox/Edge 版本号
3. **测试方法**：DevTools Offline 还是系统断网
4. **NetworkStatusAlert 组件检查结果**：
   ```javascript
   console.log(document.querySelector('[class*="NetworkStatus"]'))
   ```
5. **截图**：控制台日志和页面显示

## 手动触发错误提示（测试用）

如果需要测试提示框样式是否正确，可以在控制台运行：

```javascript
// 找到 React fiber 并触发状态更新（仅用于调试）
// 这是一个 hack，仅用于验证组件是否能正常渲染
setTimeout(() => {
  const alert = document.createElement('div')
  alert.className = 'fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999]'
  alert.innerHTML = '<div class="rounded-xl border border-rose-500/30 bg-rose-950/95 backdrop-blur-md px-6 py-4 text-white">测试网络异常提示</div>'
  document.body.appendChild(alert)
  console.log('Test alert added. Should be visible at bottom center.')
}, 100)
```
