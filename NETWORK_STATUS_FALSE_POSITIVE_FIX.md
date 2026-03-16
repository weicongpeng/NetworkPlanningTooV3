# 网络异常提示误报问题修复

## 问题

网络正常时也弹出了异常提示框。

## 根本原因

之前的逻辑是：**第一个瓦片失败就立即显示错误提示**

这导致在网络正常的情况下，如果偶尔有瓦片加载失败（这是正常现象），就会立即显示错误提示。

## 解决方案

### 使用计数器而非布尔标志

```typescript
// 新逻辑：使用计数器统计成功和失败的瓦片数量
let successfulTiles = 0  // 成功加载的瓦片数量
let failedTiles = 0      // 失败的瓦片数量

// 瓦片加载成功
tileLayer.on('tileload', () => {
  successfulTiles++

  // 只有当成功数量 > 失败数量时才认为网络正常
  if (successfulTiles > failedTiles && hasNetworkErrorRef.current) {
    // 清除错误提示
  }
})

// 瓦片加载失败
tileLayer.on('tileerror', () => {
  failedTiles++

  // 只有连续失败 3 个以上瓦片且没有任何成功时才显示错误
  if (failedTiles >= 3 && successfulTiles === 0 && !hasShownError) {
    // 显示错误提示
  }
})
```

### 关键改进

1. **容错机制**：个别瓦片失败不会立即触发提示
2. **比例判断**：只有失败明显多于成功时才认为有问题
3. **快速恢复**：只要有一个瓦片加载成功，就开始清除提示

## 预期行为

### ✅ 网络正常
- 瓦片成功：大部分瓦片成功加载
- 瓦片失败：偶尔有瓦片失败（被忽略）
- 结果：**不显示错误提示**

### ⚠️ 网络异常
- 瓦片成功：0
- 瓦片失败：连续 3 个以上
- 结果：**显示错误提示**

### 🔁 网络恢复
- 从异常状态开始
- 有瓦片加载成功
- 结果：**立即清除提示**

## 修改的文件

- `frontend/src/renderer/components/Map/OnlineMap.tsx`
  - 移除布尔标志 `tileLoadFailed` / `tileLoadSuccess`
  - 添加计数器 `successfulTiles` / `failedTiles`
  - 优化判断逻辑：失败 >= 3 且成功 == 0 时才提示
