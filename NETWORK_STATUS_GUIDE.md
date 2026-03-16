# 网络状态监测组件使用指南

## 概述

本项目新增了网络状态监测功能，用于优雅地处理在线地图加载时的网络异常情况。

## 组件说明

### 1. NetworkStatusIndicator

全功能的网络状态监测组件，提供实时网络状态显示和诊断信息。

**位置**: `frontend/src/renderer/components/Map/NetworkStatusIndicator.tsx`

**特性**:
- 实时网络状态监测（在线/离线/降级/检测中）
- 雷达扫描视觉效果（离线/降级时）
- 可展开的诊断信息面板
- 自动重试功能
- 延迟显示

**使用示例**:

```tsx
import { NetworkStatusIndicator } from '@/components/Map/NetworkStatusIndicator'

function MapPage() {
  return (
    <div>
      <NetworkStatusIndicator
        healthCheckUrl="/api/v1/health"
        checkInterval={30000}
        onStatusChange={(status) => {
          console.log('网络状态变化:', status)
        }}
      />
      {/* 其他地图组件 */}
    </div>
  )
}
```

### 2. NetworkStatusAlert

简化的网络状态警告组件，仅在出现问题时显示。已集成到 `OnlineMap` 组件中。

**特性**:
- 非阻塞式设计
- 雷达扫描背景效果
- 一键重试功能
- 可关闭

**自动触发场景**:
1. Leaflet 库加载失败
2. 高德地图瓦片加载失败
3. 后端 API 无响应
4. 网络连接超时

## 设计理念

### 航图雷达美学

- **视觉元素**: 雷达扫描效果、脉冲动画
- **颜色方案**:
  - 在线: 翠绿色 (emerald)
  - 离线: 玫瑰红 (rose)
  - 降级: 琥珀色 (amber)
  - 检测中: 天蓝色 (blue)
- **动效**: 平滑过渡 + 有意义的动画（如离线时的雷达扫描）

### 非阻塞式交互

- 提示框固定在顶部/底部，不影响地图操作
- 可随时关闭或重试
- 详细信息可展开/收起

## 已集成位置

### OnlineMap 组件

网络错误提示已自动集成到在线地图组件中：

```tsx
// OnlineMap.tsx
const [networkError, setNetworkError] = useState({
  visible: false,
  message: '',
  canRetry: false
})
```

当地图初始化失败时，会自动显示错误提示并提供重试选项。

## 错误类型识别

组件会自动识别以下错误类型：

1. **网络连接错误**: `Failed to fetch`, `NetworkError`, `网络`
   - 显示友好提示: "网络连接异常，请检查后端服务是否启动"

2. **地图服务错误**: 地图数据 API 失败
   - 显示: "后端正常，但地图数据加载失败"

3. **未知错误**: 其他异常
   - 显示具体的错误消息

## API 请求错误处理

项目的 API 服务层 (`frontend/src/renderer/services/api.ts`) 已包含统一的错误处理：

```typescript
// 响应拦截器
apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.request) {
      // 请求已发送但没有收到响应
      return Promise.reject({
        success: false,
        message: '网络连接失败，请检查后端服务是否启动',
        code: 0
      })
    }
    // ...
  }
)
```

## CSS 动画

网络状态指示器使用了以下自定义动画（定义在 `index.css`）：

```css
@keyframes radar-sweep {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

@keyframes status-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.8; transform: scale(0.95); }
}

@keyframes offline-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}
```

## 扩展使用

### 在其他页面中使用

如果你需要在其他页面（如 PCI 规划页）添加网络状态监测：

```tsx
import { NetworkStatusIndicator } from '@/components/Map/NetworkStatusIndicator'

function PCIPlanningPage() {
  const [networkStatus, setNetworkStatus] = useState('online')

  return (
    <div>
      <NetworkStatusIndicator
        onStatusChange={setNetworkStatus}
      />
      {/* 根据 networkStatus 禁用规划按钮等 */}
    </div>
  )
}
```

### 自定义样式

如果需要自定义样式，可以直接修改 `NetworkStatusIndicator.tsx` 中的样式类名，或者在全局 CSS 中覆盖：

```css
/* 自定义网络状态指示器位置 */
.network-status-indicator {
  top: 1rem !important;
  right: 1rem !important;
}
```

## 技术细节

### 状态检测逻辑

1. **后端健康检查**: `GET /api/v1/health`
2. **地图服务检查**: `GET /api/v1/map/data`
3. **延迟计算**: `performance.now()` 计算请求耗时

### 重试机制

- **自动重试**: 每 30 秒自动检查一次
- **手动重试**: 点击重试按钮立即重新检查
- **页面重载**: 严重错误时提供刷新页面选项

## 测试建议

### 测试网络错误提示

1. **关闭后端服务**: 应显示离线状态
2. **断开网络连接**: 应显示网络连接异常
3. **延迟模拟**: 使用 Chrome DevTools 模拟慢速网络
4. **API 失败**: 修改健康检查 URL 为无效地址

### 验证重试功能

1. 触发网络错误
2. 点击"重试"按钮
3. 验证是否重新检查网络状态
4. 验证网络恢复后状态是否更新

## 相关文件

- `frontend/src/renderer/components/Map/NetworkStatusIndicator.tsx` - 网络状态组件
- `frontend/src/renderer/components/Map/OnlineMap.tsx` - 在线地图组件（已集成）
- `frontend/src/renderer/index.css` - 动画定义
- `frontend/src/renderer/services/api.ts` - API 错误处理
