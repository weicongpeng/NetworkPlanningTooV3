# Checklist - PCI规划NR网络报错修复

## 代码实现检查

- [x] `_resolve_input_datasets` 方法中添加了 `self._data_prep_cache.clear()` 调用
- [x] 代码修改位置正确（在 `try` 块开始处，`data_service.reload_index()` 之前）
- [x] 代码风格与项目规范一致

## 功能验证检查

- [x] 启动后端服务没有报错
- [x] 日志中没有异常堆栈信息
- [x] 测试用例通过 (7 passed)