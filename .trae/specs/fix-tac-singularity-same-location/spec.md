# TAC插花检测同位置小区标记修复规格

## Why
TAC核查结果中，同位置（相同经纬度）的多个小区只有其中一个被标记为插花小区，这不符合业务要求。相同位置的小区应该具有一致的TAC状态，因为它们在物理上是同一个位置的不同扇区/小区。

从用户提供的截图可以看到：
- "河源-H-河源万家兴百货-274269-4-1-OF-L9" 被标记为插花小区（TAC是否插花=是）
- 但同位置的其他小区（如5-1、6-1等，经纬度完全相同）却没有被标记为插花

## What Changes
- 修改 `check_tac_singularity` 方法，在检测插花时，将同位置（相同经纬度）的其他小区视为"自身"的一部分进行排除
- 确保同位置的所有小区在插花检测时具有一致的判断结果

## Impact
- 受影响文件: `backend/app/services/tac_planning_service.py`
- 受影响方法: `check_tac_singularity`
- 受影响功能: TAC核查结果的插花检测

## ADDED Requirements
### Requirement: 同位置小区插花检测一致性
The system SHALL ensure that all cells at the same location (same longitude and latitude) have consistent TAC singularity marking.

#### Scenario: 同位置多小区插花检测
- **GIVEN** 多个小区位于相同经纬度位置
- **WHEN** 执行TAC插花检测
- **THEN** 这些同位置的小区应该被统一处理，要么全部标记为插花，要么全部不标记

## MODIFIED Requirements
无

## REMOVED Requirements
无
