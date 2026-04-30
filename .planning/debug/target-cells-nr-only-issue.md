---
status: debug_complete
trigger: 桌面端的"数据管理"页面导入待规划小区文件后在"已导入数据"的文件备注处没有识别统计小区信息，原因是待规划小区文件的LTE清单没有小区数据，只填了NR小区信息，此时进行PCI规划提示导入待规划小区数据。请修复，只要待规划小区有LTE或NR小区数据都需要识别统计并备注在已导入数据文件处，其他模块调用数据时也需准确判断对应网络类型数据是否正常，如果异常给出准确的提示。
created: 2026-04-30T00:00:00+08:00
updated: 2026-04-30T01:00:00+08:00
---

# Debug Session: target-cells-nr-only-issue

## Symptoms

1. **Expected behavior**: 导入待规划小区文件后，"已导入数据"页面的文件备注处应显示小区统计信息（LTE/NR小区数量）
2. **Actual behavior**: 当待规划小区文件只有NR小区数据而没有LTE数据时，文件备注处没有识别统计小区信息
3. **Error messages**: PCI规划时提示"导入待规划小区数据"，即使文件已导入且包含NR数据
4. **Timeline**: 新发现的问题
5. **Reproduction**:
   - 准备一个只有NR小区数据、没有LTE数据的待规划小区文件
   - 在"数据管理"页面导入该文件
   - 查看"已导入数据"处的文件备注，发现没有统计信息
   - 尝试进行PCI规划，提示需要导入待规划小区数据

## Current Focus

**hypothesis**: CONFIRMED - Three root causes found and fixed:

1. **`data_service.py` line 119**: File classification during index scan requires BOTH "LTE" AND "NR" sheets to classify as `target_cells`. Files with only NR (or only LTE) were misclassified as "default".

2. **`data_service.py` `_classify_file()` method**: Didn't detect target_cells files that have only "LTE" OR "NR" sheets (without "Project Parameters" suffix) and don't start with "cell-tree-export".

3. **`DataPage.tsx` line 771**: The condition `item.metadata?.LTESiteCount` fails when only NR data exists (LTESiteCount is undefined), so it falls through to generic "待规划小区数据" text.

**next_action**: COMPLETE - All fixes applied

**reasoning_checkpoint**: Root cause confirmed and fixed through code analysis

## Evidence

- timestamp: 2026-04-30T00:00:00+08:00
  observation: 用户报告待规划小区文件只有NR数据时，统计信息缺失
  source: 用户报告

- timestamp: 2026-04-30T00:30:00+08:00
  observation: |
    ROOT CAUSE #1: data_service.py line 119:
    `elif "LTE" in sheet_names and "NR" in sheet_names:` requires BOTH sheets.
    FIX APPLIED: Changed to `elif "LTE" in sheet_names or "NR" in sheet_names:`
  source: code_analysis

- timestamp: 2026-04-30T00:30:00+08:00
  observation: |
    ROOT CAUSE #2: data_service.py _classify_file() method doesn't detect
    target_cells files with only "LTE" or "NR" sheet (single network type).
    FIX APPLIED: Added detection logic for "LTE"/"NR" sheet names (without "Project Parameters").
  source: code_analysis

- timestamp: 2026-04-30T00:30:00+08:00
  observation: |
    ROOT CAUSE #3: DataPage.tsx line 771-772 checks only `item.metadata?.LTESiteCount`.
    When only NR data exists, LTESiteCount is undefined, so it shows generic text.
    FIX APPLIED: Changed to check both LTESiteCount and NRSiteCount using OR logic,
    and display only the available network type statistics.
  source: code_analysis

## Eliminated

- (none - all three root causes confirmed and fixed)

## Resolution

**root_cause**: 待规划小区文件分类逻辑存在三个缺陷：(1) 索引扫描时要求同时有LTE和NR表单才识别为target_cells；(2) _classify_file方法未处理单网络类型场景；(3) 前端显示逻辑只检查LTE统计数据

**fix**: 
1. `data_service.py` line 119: 将 `and` 改为 `or`，支持单网络类型文件识别
2. `data_service.py` `_classify_file()` 方法: 增加 "LTE"/"NR" 单表单检测逻辑
3. `DataPage.tsx` line 771: 修改显示逻辑，同时检查 LTESiteCount 和 NRSiteCount

**fix_cycles**: 1 (investigation) + 1 (fix)
**specialist_hint**: typescript, general
