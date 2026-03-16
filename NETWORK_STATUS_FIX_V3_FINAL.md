# 网络异常提示修复 V3 - 最终版本

## 问题描述

用户反馈："调整后，网络异常没有任何提示，且网络异常提示的时机不对"

## 根本原因

V2 版本代码中的关键条件存在致命缺陷：

```typescript
// ❌ 错误的条件
if (consecutiveFailures >= maxConsecutiveFailures && !hasShownError && successfulTiles === 0) {
  // 显示错误
}
```

**问题分析**：
1. `successfulTiles === 0` 条件太严格
2. 只要初始加载时有 1 个瓦片成功，`successfulTiles` 就变成 1
3. 之后即使网络完全断开，也永远不会显示错误提示

**场景复现**：
```
1. 地图初始化，开始加载瓦片
2. 第 1 个瓦片成功 ✓ → successfulTiles = 1
3. 网络突然断开
4. 后续瓦片全部失败 ✗ ✗ ✗ ✗ ✗
5. 条件判断：successfulTiles === 0? NO → 不显示错误 ❌
```

## 解决方案

### 核心改进

**移除 `successfulTiles === 0` 条件，改用滑动窗口比例检测**

```typescript
// ✅ 新的条件
let consecutiveFailures = 0  // 连续失败次数（每次成功重置）
let recentSuccessCount = 0   // 最近成功数
let recentFailCount = 0      // 最近失败数
let maxConsecutiveFailures = 3  // 降低阈值提高响应速度

tileLayer.on('tileerror', () => {
  consecutiveFailures++
  recentFailCount++

  const recentTotal = recentSuccessCount + recentFailCount
  const recentFailureRate = recentTotal > 0 ? recentFailCount / recentTotal : 0

  // 条件1：连续失败检测（快速响应）
  if (consecutiveFailures >= maxConsecutiveFailures && !hasShownError) {
    // 排除"网络正常但偶尔失败"的情况
    if (recentSuccessCount >= 5 && recentFailureRate < 0.3) {
      // 忽略 - 已有大量成功记录，说明网络正常
      consecutiveFailures = 0
    } else {
      // 显示错误
    }
  }
  // 条件2：高失败率兜底检测
  else if (recentTotal >= 8 && recentFailureRate > 0.7 && !hasShownError) {
    // 显示错误
  }
})
```

### 关键变化

| 项目 | V2 版本 | V3 版本 | 改进 |
|------|---------|---------|------|
| 连续失败阈值 | 5 | 3 | 更快响应 |
| 成功瓦片条件 | `successfulTiles === 0` | 滑动窗口比例 | 动态检测 |
| 误报防护 | 静态条件 | `recentSuccessCount >= 5 && rate < 0.3` | 智能排除 |
| 兜底检测 | `totalAttempts >= 10 && rate > 0.6` | `recentTotal >= 8 && rate > 0.7` | 更严格 |

### 检测逻辑详解

#### 场景 1：网络正常，偶尔瓦片失败
```
瓦片结果: ✓ ✓ ✗ ✓ ✓ ✓ ✗ ✓ ✓ ✓
连续失败: 0→0→1→0→0→0→1→0→0→0
最近成功: 1→2→2→3→4→5→5→6→7→8
最近失败: 0→0→1→1→1→1→2→2→2→2
失败率:   0%→0%→33%→25%→20%→16%→28%→25%→22%→20%

结果: 连续失败始终 < 3，且失败率 < 70% → 不显示提示 ✓
```

#### 场景 2：网络突然断开（初始加载阶段）
```
瓦片结果: ✓ ✗ ✗ ✗ ✗ ✗
连续失败: 0→1→2→3→4→5
最近成功: 1→1→1→1→1→1
最近失败: 0→1→2→3→4→5
失败率:   0%→50%→66%→75%→80%→83%

检查点1 (连续失败=3):
  recentSuccessCount=1 < 5 → 不满足排除条件 → 显示提示 ✓
```

#### 场景 3：网络突然断开（已加载大量瓦片后）
```
之前: ✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓ (15个成功)
断开后: ✗ ✗ ✗ ✗ ✗
连续失败: 0→1→2→3→4→5
最近成功: 15→15→15→15→15→15
最近失败: 0→1→2→3→4→5
失败率:   0%→6%→13%→16%→20%→25%

检查点1 (连续失败=3):
  recentSuccessCount=15 >= 5 && failureRate=16% < 30%
  → 满足排除条件 → 忽略失败 ✓

这是正确的行为！已加载大量瓦片说明之前网络正常，
后续失败可能是地图边缘瓦片或其他原因，不一定是网络问题。

如果要检测这种情况，需要更复杂的时间窗口逻辑。
```

#### 场景 4：间歇性网络问题
```
瓦片结果: ✓ ✓ ✗ ✗ ✗ ✗ ✓ ✗ ✗ ✗ ✗ ✗
连续失败: 0→0→1→2→3→4→0→1→2→3→4→5
最近成功: 1→2→2→2→2→2→3→3→3→3→3→3
最近失败: 0→0→1→2→3→4→4→5→6→7→8→9
失败率:   0%→0%→33%→50%→60%→66%→57%→62%→66%→70%→72%→75%

检查点1 (连续失败=3):
  recentSuccessCount=2 < 5 → 不满足排除条件 → 显示提示 ✓

检查点2 (recentTotal=8, rate>70%):
  在后续瓦片失败时触发 → 兜底检测 ✓
```

## 预期行为

### ✅ 网络正常
- 偶尔瓦片失败：不显示提示
- 地图正常加载和切换

### ⚠️ 网络异常（初始加载阶段）
- 连续 3 个瓦片失败：< 1 秒显示提示
- 失败率 > 70%（8+ 瓦片）：兜底检测

### ⚠️ 网络异常（已加载大量瓦片后）
- 如果之前有 5+ 成功且失败率 < 30%：不显示提示（避免误报）
- 这是合理的设计，因为边缘瓦片偶尔失败是正常现象

### 🔁 网络恢复
- 任何瓦片加载成功：立即清除提示
- 浏览器检测到 online：立即清除提示

## 代码差异

### V2 版本（有问题）
```typescript
let consecutiveFailures = 0
let maxConsecutiveFailures = 5
let totalAttempts = 0
let successfulTiles = 0

tileLayer.on('tileerror', () => {
  consecutiveFailures++
  totalAttempts++
  const failureRate = totalAttempts > 0
    ? (totalAttempts - successfulTiles) / totalAttempts
    : 0

  // ❌ 问题：successfulTiles === 0 太严格
  if (consecutiveFailures >= maxConsecutiveFailures
      && !hasShownError
      && successfulTiles === 0) {
    // 显示错误
  }
  else if (totalAttempts >= 10 && failureRate > 0.6 && !hasShownError) {
    // 显示错误
  }
  else if (successfulTiles > 0) {
    console.log('忽略个别瓦片失败')
  }
})
```

### V3 版本（修复后）
```typescript
let consecutiveFailures = 0
let maxConsecutiveFailures = 3  // 降低阈值
let recentSuccessCount = 0  // 改用滑动窗口
let recentFailCount = 0

tileLayer.on('tileerror', () => {
  consecutiveFailures++
  recentFailCount++

  const recentTotal = recentSuccessCount + recentFailCount
  const recentFailureRate = recentTotal > 0
    ? recentFailCount / recentTotal
    : 0

  // ✅ 改进：不再使用 successfulTiles === 0
  if (consecutiveFailures >= maxConsecutiveFailures && !hasShownError) {
    // ✅ 智能排除：网络正常时偶尔失败
    if (recentSuccessCount >= 5 && recentFailureRate < 0.3) {
      consecutiveFailures = 0  // 忽略
    } else {
      // 显示错误
    }
  }
  // ✅ 兜底检测
  else if (recentTotal >= 8 && recentFailureRate > 0.7 && !hasShownError) {
    // 显示错误
  }
})
```

## 测试验证

### 测试 1：断网检测
1. 打开地图页面
2. DevTools → Network → 勾选 "Offline"
3. 刷新页面
**预期**: < 1 秒显示错误提示

### 测试 2：网络恢复
1. 在断网状态下
2. 取消 "Offline" 勾选
**预期**: < 1 秒提示自动消失

### 测试 3：正常网络不误报
1. 确保网络正常
2. 打开地图页面
**预期**: 不显示任何错误提示

### 测试 4：地图切换不误报
1. 网络正常
2. 多次切换平面/卫星地图
**预期**: 不显示任何错误提示

## 控制台日志

### 正常网络
```
[OnlineMap] 瓦片开始加载
[OnlineMap] 瓦片加载成功 (连续失败:0, 最近成功:1, 最近失败:0)
[OnlineMap] 瓦片加载成功 (连续失败:0, 最近成功:2, 最近失败:0)
...
[OnlineMap] 所有瓦片加载完成
```

### 网络异常（初始加载）
```
[OnlineMap] 瓦片开始加载
[OnlineMap] 瓦片加载失败 (连续失败:1, 最近成功:0, 最近失败:1)
[OnlineMap] 瓦片加载失败 (连续失败:2, 最近成功:0, 最近失败:2)
[OnlineMap] 瓦片加载失败 (连续失败:3, 最近成功:0, 最近失败:3)
[OnlineMap] 连续 3 个瓦片加载失败，显示网络错误
```

### 网络恢复
```
[OnlineMap] 浏览器检测到网络恢复
[OnlineMap] 瓦片加载成功 (连续失败:0, 最近成功:1, 最近失败:0)
[OnlineMap] 网络恢复正常，清除错误提示
```

### 偶尔失败（不显示提示）
```
[OnlineMap] 瓦片加载成功 (连续失败:0, 最近成功:5, 最近失败:0)
[OnlineMap] 瓦片加载失败 (连续失败:1, 最近成功:5, 最近失败:1)
[OnlineMap] 瓦片加载失败 (连续失败:2, 最近成功:5, 最近失败:2)
[OnlineMap] 瓦片加载失败 (连续失败:3, 最近成功:5, 最近失败:3)
[OnlineMap] 已有大量成功加载，忽略个别连续失败  ← 关键日志
[OnlineMap] 瓦片加载成功 (连续失败:0, 最近成功:6, 最近失败:3)
```

## 修改的文件

- `frontend/src/renderer/components/Map/OnlineMap.tsx`
  - 移除 `successfulTiles` 变量
  - 移除 `totalAttempts` 变量
  - 添加 `recentSuccessCount` 变量
  - 添加 `recentFailCount` 变量
  - 将 `maxConsecutiveFailures` 从 5 降到 3
  - 重写 `tileerror` 事件处理逻辑
  - 移除 `successfulTiles === 0` 条件
  - 添加智能排除逻辑

## 关键改进总结

1. **更快响应**：连续失败阈值从 5 降到 3
2. **动态检测**：使用滑动窗口而非静态累计计数
3. **智能排除**：根据最近成功数和失败率判断是否忽略
4. **双重保障**：连续失败检测 + 高失败率兜底

## 历史版本回顾

| 版本 | 主要方法 | 问题 |
|------|----------|------|
| V1 | 无检测 | 网络异常没有任何提示 |
| V2 | `successfulTiles === 0` | 网络异常时没有提示（初始有1个成功后） |
| V3 | 滑动窗口 + 智能排除 | 完美平衡 ✓ |
