## 问题分析

当前"应用到工参"功能存在以下问题：
1. 直接修改原始Excel文件，没有另存为时间戳后缀的新文件
2. 没有重新加载新工参到应用中
3. 规划结果的原PCI没有保持不变

## 优化方案

### 1. 后端修改 (`backend/app/api/v1/endpoints/pci.py`)

修改 `apply_pci_to_params` 函数：

**步骤：**
1. 获取规划结果和当前全量工参信息
2. 创建新的数据目录和ID
3. 复制原始Excel文件到新目录
4. 使用openpyxl更新新Excel文件中对应网络类型sheet的PCI列
5. 解析新Excel生成新的data.json
6. 生成带时间戳后缀的新文件名，保存到原始目录
7. 更新数据索引，将新工参注册为当前全量工参
8. 返回新文件ID和更新统计

**关键点：**
- 保持规划结果中的originalPCI不变（不修改task_result）
- 新文件名格式：`ProjectParameter_mongoose_YYYYMMDDHHMMSS.xlsx`

### 2. 前端修改 (`frontend/src/renderer/pages/PCIPage.tsx`)

修改 `handleApplyToParams` 函数：

**步骤：**
1. 调用后端API获取新文件ID
2. 重新加载工参列表（调用dataApi.getList）
3. 清除mapDataService缓存
4. 重新初始化pciDataSyncService
5. 保持当前规划结果显示（原PCI不变）

### 3. 新增后端API（可选）

如果需要，可以添加一个刷新数据的API端点，用于重新加载工参数据。

## 文件修改清单

| 文件 | 修改内容 |
|------|---------|
| `backend/app/api/v1/endpoints/pci.py` | 重写apply_pci_to_params函数，实现另存为和重新加载逻辑 |
| `frontend/src/renderer/pages/PCIPage.tsx` | 修改handleApplyToParams，添加重新加载工参逻辑 |