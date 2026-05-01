---
status: fix_applied
trigger: 调整后，导入的LTE数据为空和NR小区数据正常，但是NR小区PCI规划时还是提示待规划小区文件为空，请核查判断逻辑
created: 2026-05-01T00:00:00+08:00
updated: 2026-05-01T01:30:00+08:00
---

# Debug Session: nr-pci-target-cells-empty

## Symptoms

1. **Expected behavior**: 导入只有NR小区数据的待规划小区文件后，能正常进行NR PCI规划
2. **Actual behavior**: NR PCI规划时提示"待规划小区文件为空"
3. **Error messages**: "待规划小区文件为空"
4. **Timeline**: 上一次修复（target-cells-nr-only-issue）后出现的新问题
5. **Reproduction**:
   - 准备一个只有NR小区数据、LTE为空的待规划小区文件
   - 导入文件
   - 尝试进行NR PCI规划
   - 收到"待规划小区文件为空"错误

## Current Focus

**Status**: 修复已应用，等待用户验证

**root_cause**: `data_service.py` 中解析 `target_cells` 类型文件时，使用大小写敏感的方式判断 sheet 名称（`if network in sheet_names`），而文件分类时使用大小写不敏感判断。当 Excel 中 sheet 名称为小写（如 "nr"）时，文件会被正确分类为 `target_cells`，但解析时找不到对应的 sheet，导致 `parsed_data` 为空字典 `{}`。后续 `get_data` 返回空字典，被 `task_manager.py` 判断为"待规划小区文件为空"。

## Evidence

- timestamp: 2026-05-01T00:00:00+08:00
  observation: 用户报告导入只有NR数据的文件后，PCI规划提示"待规划小区文件为空"
  source: 用户报告

- timestamp: 2026-05-01T00:30:00+08:00
  observation: 代码审查发现 `data_service.py` 第 1448-1449 行（修复前）使用大小写敏感判断 `if network in sheet_names`，而 `_classify_file` 使用大小写不敏感判断
  source: 代码审查

- timestamp: 2026-05-01T01:00:00+08:00
  observation: 确认 `task_manager.py` 第 703 行 `if not target_cells_data:` 对于空字典 `{}` 会返回 True
  source: 代码审查

## Resolution

**root_cause**: `data_service.py` 中解析 `target_cells` 类型文件时，使用大小写敏感的方式判断 sheet 名称。当 Excel 中 sheet 名称为小写（如 "nr"）时，文件会被正确分类，但解析时找不到对应的 sheet，导致 `parsed_data` 为空字典。

**fix**:
1. **修复 `data_service.py` 第 1446-1467 行**：使用大小写不敏感的方式查找实际的 sheet 名称，并传递正确的 sheet 名称给 `_parse_sheet_data`。这样无论 Excel 中的 sheet 名称是 "NR"、"nr" 还是 "Nr"，都能正确匹配。

2. **修复 `data_service.py` 第 3385-3391 行**：当从 `NR.json` 或 `LTE.json` 读取数据时，确保返回的字典键是大写的（"NR" 或 "LTE"），与 `network_type.value` 保持一致。

3. **添加数据验证**：在保存 `parsed_data` 前添加检查，如果数据为空则抛出明确的错误信息，便于调试。

**files_modified**:
- `D:\mycode\NetworkPlanningTooV3\backend\app\services\data_service.py`

**test_plan**:
1. 准备一个只有 "nr" sheet（小写）的待规划小区文件
2. 导入文件
3. 尝试进行 NR PCI 规划
4. 验证不再提示"待规划小区文件为空"
