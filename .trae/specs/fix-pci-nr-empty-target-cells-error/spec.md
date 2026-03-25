# PCI规划NR网络报错修复规格

## 问题描述

用户在选择NR网络类型执行PCI规划时，系统报错"任务失败: 待规划小区文件为空"。

## 根本原因分析

### 错误触发路径

错误消息"待规划小区文件为空"仅在 [task_manager.py:559](file:///d:\mycode\NetworkPlanningTooV3\backend\app\services\task_manager.py#L559) 处抛出：

```python
if not target_cells_data:
    raise ValueError("待规划小区文件为空")
```

### 可能原因

#### 原因1：TaskManager缓存未清理

在 [task_manager.py:97](file:///d:\mycode\NetworkPlanningTooV3\backend\app\services\task_manager.py#L97) 中：
```python
self._data_prep_cache: Dict[str, Any] = {}
```

`_resolve_input_datasets` 方法在 [task_manager.py:118](file:///d:\mycode\NetworkPlanningTooV3\backend\app\services\task_manager.py#L118) 使用缓存：
```python
cache_key = f"datasets_{network_type_str}"
if cache_key in self._data_prep_cache:
    return self._data_prep_cache[cache_key]
```

**问题**：当用户上传新的待规划小区文件后，`_data_prep_cache` 不会自动失效，导致系统继续使用旧的（可能已被删除的）数据文件ID。

#### 原因2：数据文件ID变更

用户上传新文件时，会生成新的UUID作为 `data_id`。旧的缓存条目仍然指向旧文件的 `data_id`，该文件可能已被新上传的文件覆盖或删除。

#### 原因3：索引重新加载不一致

在 [task_manager.py:122](file:///d:\mycode\NetworkPlanningTooV3\backend\app\services\task_manager.py#L122) 调用 `data_service.reload_index()`，但 `_data_prep_cache` 缓存没有被清除。

## 修复方案

### 修复策略

在调用 `reload_index()` 后，必须同步清除 `TaskManager._data_prep_cache` 缓存。

### 代码变更

**文件**: `backend/app/services/task_manager.py`

1. **修改 `_resolve_input_datasets` 方法** - 在 `reload_index()` 后清除缓存：

```python
def _resolve_input_datasets(
    self, network_type_str: str
) -> Dict[str, Any]:
    """
    一次性确定待规划小区和全量工参文件
    """
    # 清除旧缓存，确保获取最新数据文件引用
    self._data_prep_cache.clear()  # <-- 新增此行
    
    try:
        data_service.reload_index()
        data_items = data_service.list_data()
        # ... 其余代码保持不变
```

### 影响范围

- **受影响的功能**: PCI规划任务创建
- **受影响文件**:
  - [task_manager.py](file:///d:\mycode\NetworkPlanningTooV3\backend\app\services\task_manager.py)

## 验证方案

1. 上传待规划小区文件和全量工参文件
2. 选择NR网络类型执行PCI规划
3. 验证不再出现"待规划小区文件为空"错误

## 附加调试增强

为了更清楚地诊断问题，建议在关键位置添加更详细的日志：

1. 在抛出"待规划小区文件为空"前，记录 `target_cells_item` 的 ID 和名称
2. 记录 `target_cells_data` 的实际内容（如果是 dict，记录其 keys）

