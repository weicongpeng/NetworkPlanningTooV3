# NetworkPlanningTool

[![Python](https://img.shields.io/badge/Python-3.7+-blue.svg)](https://www.python.org/)
[![License](https://img.shields.io/badge/License-Proprietary-red.svg)](#许可证管理)
[![Platform](https://img.shields.io/badge/Platform-Windows-lightgrey.svg)](#运行应用程序)

NetworkPlanningTool是一个专为LTE和NR(5G)网络设计的综合性PCI(物理小区识别码)规划工具，提供图形界面(GUI)和命令行界面(CLI)两种使用方式。工具支持PCI规划、网络参数更新和邻区规划，并采用先进的距离约束规划算法和双模约束机制。

## ✨ 主要功能

### 🔢 PCI规划
- **LTE网络**: 支持mod3约束 (PCI范围: 0-503)
- **NR网络**: 支持双重约束 mod3 AND mod30 (PCI范围: 0-1007)
- **智能冲突解决**: 采用3.0km→2.0km智能回退策略
- **同站点避让**: 自动避免同站点PCI冲突 (<10米)
- **距离优先级**: 相同频率和相同PCI的小区必须保持最小复用距离

### 📡 邻区规划
- **三种规划类型**: NR-to-NR、LTE-to-LTE、NR-to-LTE
- **覆盖圆算法**: 基于几何圆相交的邻区关系计算
  - 覆盖圆中心: 距离站点 `k×Co` (k=5/9)
  - 覆盖半径: `m×Co` (m=5/9)
- **距离阈值**: 可配置的邻区发现距离
- **最大邻区数**: 每小区默认最多32个邻区

### 🔄 网络参数更新
- **批量更新**: 支持压缩包格式的参数更新源
- **模糊列匹配**: 智能识别兼容的列名格式
- **数据保护**: 自动保护表头行(索引0-2)
- **时间戳选择**: 自动选择最新时间戳的文件

## 📋 系统要求

- **操作系统**: Windows
- **Python版本**: 3.7 或更高版本
- **内存**: 建议 4GB 以上
- **磁盘空间**: 至少 500MB 可用空间

## 🚀 快速开始

### 安装依赖

```bash
pip install pandas numpy openpyxl tkinter cryptography
```

### 运行应用

#### GUI版本 (推荐)

```bash
python NetworkPlanningTool_V1.py
```

或使用Windows批处理文件：

```bash
run_gui.bat
```

#### CLI版本 (传统)

```bash
python planning_lte_nr_enhanced.py
```

或使用Windows批处理文件：

```bash
run.bat
```

### 测试

```bash
python test.py  # 测试邻区规划算法覆盖率
```

## 📁 输入文件要求

### PCI规划输入 (`待规划小区/`)

**文件格式**: `cell-tree-export-*.xlsx`

**必需列**:
- 小区标识
- 坐标信息 (经纬度)
- 频点信息
- 扇区信息

> 支持模糊列名匹配 (例如: "物理小区识别码"会自动匹配相关列名)

### 网络参数 (`全量工参/`)

**文件格式**: `ProjectParameter_mongoose*.xlsx`

**重要说明**:
- **前3行** (索引0-2) 为表头，**严禁修改**
- 数据从第4行开始 (索引3)
- 文件名时间戳格式: `YYYYMMDDHHMMSS` (14位数字)

### 参数更新源

**文件格式**: `BaselineLab_*.zip` (压缩包)

**内容**:
- LTE_SDR/LTE_ITBBU在线参数文件
- NR在线参数文件

> 系统会自动解压并选择时间戳最新的文件

## 📤 输出文件

所有输出文件保存在 `输出文件/` 目录，文件名包含时间戳: `YYYYMMDD_HHMMSS`

### PCI规划输出

**文件名**: `pci_planning_YYYYMMDD_HHMMSS.xlsx`

**包含内容**:
- 分配的PCI值
- 冲突解决详情
- 约束满足状态
- 回退信息记录

### 邻区规划输出

**文件名**: `neighbor_planning_YYYYMMDD_HHMMSS.xlsx`

**包含内容**:
- NR-NR邻区关系
- LTE-LTE邻区关系
- NR-LTE邻区关系
- 基于距离的邻区关系详情

### 更新参数输出

**文件名**: `ProjectParameter_mongoose_updated_YYYYMMDD_HHMMSS.xlsx`

**包含内容**:
- 原始表头行 (0-2)
- 更新的参数数据
- 新增小区统计信息

## 🎯 使用示例

### 1. 启动应用

双击运行 `run_gui.bat` 或在命令行执行:

```bash
python NetworkPlanningTool_V1.py
```

### 2. 许可证验证

应用启动时会自动验证许可证:
- 许可证文件: `license.dat`
- 无效许可证会显示错误信息并退出

### 3. 选择功能模块

- **PCI规划**: 导入待规划小区数据，进行PCI分配
- **参数更新**: 更新网络参数配置
- **邻区规划**: 生成邻区关系表

### 4. 查看结果

在 `输出文件/` 目录查看生成的Excel文件

## 📚 核心算法

### PCI规划算法

1. **约束检查**: 按优先级验证mod3/mod30约束
2. **距离验证**: 检查同频同PCI小区的复用距离
3. **冲突解决**: 采用智能回退策略
   - 初始复用距离: 3.0km
   - 回退复用距离: 2.0km
4. **缓存优化**: 清除距离和PCI有效性缓存

### 邻区规划算法

1. **覆盖圆计算**: 基于方位角和覆盖距离计算覆盖圆
2. **相交检测**: 检查覆盖圆是否相交
3. **同站点检查**: <0.01km (10米) 视为同站点
4. **距离排序**: 按覆盖圆中心距离排序

## 🔧 目录结构

```
NetworkPlanningTool/
├── NetworkPlanningTool_V1.py          # 主GUI应用
├── planning_lte_nr_enhanced.py        # 传统CLI应用
├── license_manager.py                 # 许可证验证系统
├── license_generator.py               # 许可证生成工具
├── license.dat                        # 许可证文件
├── run_gui.bat                        # Windows GUI启动器
├── run.bat                            # Windows CLI启动器
├── test.py                            # 测试脚本
├── 全量工参/                          # 网络参数文件
│   └── ProjectParameter_mongoose*.xlsx
├── 待规划小区/                        # 待规划小区数据
│   └── cell-tree-export-*.xlsx
└── 输出文件/                          # 输出文件
    ├── pci_planning_*.xlsx
    ├── neighbor_planning_*.xlsx
    └── ProjectParameter_mongoose_updated_*.xlsx
```

## ⚙️ 配置参数

### PCI规划参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| LTE PCI范围 | 0-503 | LTE网络PCI范围 |
| NR PCI范围 | 0-1007 | NR网络PCI范围 |
| 复用距离 | 3.0km | 初始复用距离 |
| 回退距离 | 2.0km | 回退复用距离 |
| 同站点阈值 | 0.01km | 10米，视为同站点 |

### 邻区规划参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| k系数 | 5/9 | 距离系数 |
| m系数 | 5/9 | 覆盖半径系数 |
| 最大邻区数 | 32 | 每小区最大邻区数 |

## 🛠️ 开发与测试

### 运行测试

```bash
python test.py
```

### 代码架构

#### 主要组件

- **NetworkPlanningTool_V1.py**: 主GUI应用
  - 基于tkinter的图形界面
  - 启动时许可证验证
  - 三个功能模块的线程化执行
  - 实时进度报告

- **planning_lte_nr_enhanced.py**: 传统CLI应用
  - 交互式菜单系统
  - 批处理能力

- **license_manager.py**: 许可证管理
  - Fernet加密 + HMAC签名验证
  - 许可证过期检查
  - 篡改检测

#### 核心类

- **NetworkParameterUpdater**: 网络参数更新器
  - 处理压缩数据存档
  - 模糊列匹配
  - 保护表头行 (索引0-2)

- **NeighborPlanningTool**: 邻区规划工具
  - 基于距离的邻区发现
  - 三种规划类型支持
  - 最大邻区数控制

- **LTENRPCIPlanner**: LTE/NR PCI规划器
  - 先进约束处理
  - 距离优先级: 同频同PCI必须保持最小复用距离
  - NR双模约束 (mod3 AND mod30)
  - 智能回退策略
  - 同站点冲突避让

## 🐛 故障排除

### 常见问题

#### 许可证验证失败
- 检查 `license.dat` 文件是否存在
- 验证文件是否被篡改
- **联系方式**: weicongpeng1@163.com 或 15220958556

#### 缺少输入文件
- 验证目录结构: `全量工参/`, `待规划小区/`
- 检查文件名格式是否匹配
- 确保Excel文件未损坏或加密

#### PCI规划冲突
- 工具使用智能回退: 3.0km → 2.0km
- 查看控制台输出的约束回退信息
- 检查频率和模约束设置
- 审查同站点小区 (<10米) 冲突

#### 参数更新问题
- 确保 `BaselineLab_*.zip` 包含有效的Excel文件
- 检查文件名时间戳格式 (14位数字)
- 验证表头行 (0-2) 完整性
- 确认模糊列匹配找到必需列

#### GUI无响应
- 操作在后台线程中运行以保持响应性
- 查看控制台输出了解进度
- 大型数据集可能需要几分钟处理
- 监控大型文件 (>100MB) 的内存使用情况

## 📄 许可证管理

本软件包含许可证验证系统，在使用前必须完成许可证验证：

- **许可证文件**: `license.dat`
- **联系方式**: weicongpeng1@163.com 或 15220958556
- **验证机制**: 应用启动时自动验证
- **安全特性**: Fernet加密 + HMAC签名验证 + 篡改检测

## 📞 支持与反馈

- **邮箱**: weicongpeng1@163.com
- **电话**: 15220958556

## 📝 更新日志

### v1.0
- 初始版本发布
- 支持LTE和NR网络的PCI规划
- 实现GUI和CLI双界面
- 添加邻区规划功能
- 实现网络参数更新功能

---

**注意**: 本软件为专有软件，仅限授权用户使用。使用前请确保已获得有效许可证。
