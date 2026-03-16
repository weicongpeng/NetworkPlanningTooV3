# PCI规划添加TAC规划功能 Spec

## Why
用户在执行PCI规划时，往往需要同步规划所选网络小区的TAC值。目前TAC规划和PCI规划是独立的两个功能，用户需要分别执行两次规划任务，操作繁琐。通过将TAC规划功能集成到PCI规划中，可以一次性完成PCI和TAC的规划，提升工作效率。

## What Changes
- **前端**: 在PCI规划页面的规划参数栏添加"TAC规划"复选按钮
- **后端**: 修改PCI规划API，支持同时执行TAC规划
- **后端**: 复用现有的TAC规划服务逻辑，在PCI规划过程中同步计算TAC值
- **前端**: 规划结果列表添加"TAC规划值"列
- **前端**: 导出结果文件添加"TAC规划值"列

## Impact
- 受影响的前端文件:
  - `frontend/src/renderer/pages/PCIPage.tsx` - PCI规划页面
  - `frontend/src/shared/types.ts` - 类型定义
- 受影响的后端文件:
  - `backend/app/api/v1/endpoints/pci.py` - PCI API端点
  - `backend/app/algorithms/pci_planning_service_v2.py` - PCI规划服务
  - `backend/app/models/schemas.py` - 数据模型

## ADDED Requirements

### Requirement: TAC规划复选框
PCI规划参数配置区域 SHALL 提供"TAC规划"复选框，允许用户选择是否同步执行TAC规划。

#### Scenario: 用户勾选TAC规划
- **WHEN** 用户在PCI规划页面勾选"TAC规划"复选框
- **THEN** 系统 SHALL 在PCI规划执行时同步计算TAC值

#### Scenario: 用户未勾选TAC规划
- **WHEN** 用户未勾选"TAC规划"复选框
- **THEN** 系统 SHALL 仅执行PCI规划，不计算TAC值

### Requirement: 同步TAC规划执行
当用户勾选"TAC规划"时，PCI规划服务 SHALL 复用现有的TAC规划逻辑，为每个规划小区计算TAC值。

#### Scenario: PCI规划执行成功
- **GIVEN** 用户已勾选"TAC规划"
- **WHEN** PCI规划任务执行完成
- **THEN** 每个规划结果 SHALL 包含对应的TAC规划值

#### Scenario: TAC规划失败
- **GIVEN** 用户已勾选"TAC规划"
- **WHEN** TAC规划计算失败（如缺少TAC图层）
- **THEN** 系统 SHALL 记录警告日志，但PCI规划结果仍应返回，TAC值为null

### Requirement: 规划结果展示TAC值
PCI规划结果列表 SHALL 添加"TAC规划值"列，显示每个小区的TAC规划结果。

#### Scenario: 查看规划结果
- **WHEN** 用户查看PCI规划结果列表
- **THEN** 列表 SHALL 显示"TAC规划值"列
- **AND** 列值为该小区的TAC规划值或"-"

### Requirement: 导出结果包含TAC值
PCI规划结果导出文件 SHALL 包含"TAC规划值"列。

#### Scenario: 导出Excel文件
- **GIVEN** 用户已执行包含TAC规划的PCI规划任务
- **WHEN** 用户导出规划结果为Excel
- **THEN** Excel文件 SHALL 包含"TAC规划值"列

## MODIFIED Requirements

### Requirement: PCIConfig 配置模型
PCIConfig 模型 SHALL 添加 `enableTACPlanning` 布尔字段，用于控制是否启用TAC规划。

```python
class PCIConfig(BaseModel):
    networkType: NetworkType
    distanceThreshold: float
    pciModulus: int
    inheritModulus: bool
    pciRange: Optional[PCIRange]
    enableTACPlanning: bool = Field(default=False)  # 新增
```

### Requirement: SectorPCIResult 结果模型
SectorPCIResult 模型 SHALL 添加 `tac` 字段，用于存储TAC规划值。

```python
class SectorPCIResult(BaseModel):
    sectorId: str
    sectorName: str
    originalPCI: Optional[int]
    newPCI: int
    originalMod: Optional[int]
    newMod: Optional[int]
    earfcn: Optional[int]
    assignmentReason: Optional[str]
    minReuseDistance: Optional[float]
    minDistanceSectorName: Optional[str]
    tac: Optional[str] = None  # 新增：TAC规划值
```
