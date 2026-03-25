# Tasks - PCI规划NR网络报错修复

## 任务列表

- [x] 任务1: 修复 TaskManager 缓存清除问题

### 任务1: 修复 TaskManager 缓存清除问题

**描述**: 在 `_resolve_input_datasets` 方法中调用 `data_service.reload_index()` 后，必须清除 `TaskManager._data_prep_cache` 缓存，确保获取最新的数据文件引用。

**变更文件**:
- `backend/app/services/task_manager.py`

**具体修改**:
1. 在 `_resolve_input_datasets` 方法的 `try` 块开始处（`data_service.reload_index()` 之前），添加 `self._data_prep_cache.clear()` 调用

**验证**:
1. 启动后端服务
2. 检查日志确认没有错误
3. 如果有测试用例，运行测试验证

---

## 任务依赖

无依赖关系，可以直接执行。