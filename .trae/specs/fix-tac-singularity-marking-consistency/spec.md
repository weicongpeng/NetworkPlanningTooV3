# TAC插花标记阶段同位置小区一致性修复规格

## Why
之前的修复解决了 `check_tac_singularity` 方法中邻区筛选的问题（同位置小区在统计邻区TAC时排除彼此），但没有解决标记阶段的问题。

当前问题：
1. 同位置的小区有不同的 `sectorId`，在筛选阶段都会被加入 `mismatched_cells`
2. `check_tac_singularity` 对每个小区单独检测插花状态
3. 在标记阶段，`singularity_ids` 只包含被检测为插花的小区ID
4. 结果是：同位置的小区可能只有一个被标记为插花，其他同位置小区没有被标记

## What Changes
- 修改 `plan_tac` 方法中的标记阶段逻辑
- 当检测到某个位置（相同经纬度）的任意一个小区是插花时，该位置的所有小区都应该被标记为插花
- 或者，同位置的小区应该只被检测一次，然后统一标记结果

## Impact
- 受影响文件: `backend/app/services/tac_planning_service.py`
- 受影响方法: `plan_tac` 中的标记阶段（第626-682行）
- 受影响功能: TAC核查结果的插花标记

## ADDED Requirements
### Requirement: 同位置小区插花标记一致性
The system SHALL ensure that when any cell at a location is marked as TAC singularity, all other cells at the same location (same longitude and latitude) SHALL also be marked as singularity.

#### Scenario: 同位置多小区插花标记
- **GIVEN** 多个小区位于相同经纬度位置
- **WHEN** 其中任意一个小区被检测为插花
- **THEN** 该位置的所有小区都应该被标记为插花

## MODIFIED Requirements
无

## REMOVED Requirements
无
