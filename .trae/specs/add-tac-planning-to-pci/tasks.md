# Tasks

- [x] Task 1: 修改后端数据模型，添加TAC规划相关字段
  - [x] SubTask 1.1: 修改PCIConfig模型，添加enableTACPlanning字段
  - [x] SubTask 1.2: 修改SectorPCIResult模型，添加tac字段

- [x] Task 2: 修改后端PCI规划服务，集成TAC规划功能
  - [x] SubTask 2.1: 在PCIPlanningService中集成TACPlanningService
  - [x] SubTask 2.2: 在plan方法中根据enableTACPlanning执行TAC规划
  - [x] SubTask 2.3: 将TAC规划结果合并到PCI规划结果中

- [x] Task 3: 修改后端PCI API端点，处理TAC规划配置
  - [x] SubTask 3.1: 修改/plan端点，传递enableTACPlanning参数
  - [x] SubTask 3.2: 修改/export端点，导出结果包含TAC列

- [x] Task 4: 修改前端类型定义
  - [x] SubTask 4.1: 修改shared/types.ts中的PCIConfig接口
  - [x] SubTask 4.2: 修改shared/types.ts中的SectorPCIResult接口

- [x] Task 5: 修改前端PCI规划页面
  - [x] SubTask 5.1: 在规划参数栏添加"TAC规划"复选框
  - [x] SubTask 5.2: 在规划结果列表添加"TAC规划值"列
  - [x] SubTask 5.3: 确保导出功能包含TAC值

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 2
- Task 5 depends on Task 4
