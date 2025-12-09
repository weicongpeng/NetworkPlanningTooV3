# NetworkPlanningTool

NetworkPlanningTool是一个专为LTE和NR(5G)网络设计的综合性PCI(物理小区识别码)规划工具，提供图形界面(GUI)和命令行界面(CLI)两种使用方式。工具支持PCI规划、网络参数更新和邻区规划，并采用先进的距离约束规划算法和双模约束机制。

## 项目概述

NetworkPlanningTool是一款专业的电信网络规划工具，主要用于：
- **PCI规划**：支持LTE（mod3约束）和NR（mod30约束）网络的物理小区识别码规划
- **邻区规划**：基于覆盖圆算法的邻区关系规划，支持多种网络类型组合
- **网络参数更新**：从现网工参压缩包更新全量工参文件

### 核心特性

1. **多网络支持**：同时支持LTE和NR(5G)网络规划
2. **智能约束**：高级距离约束规划算法和双模约束机制
3. **许可证验证**：内置加密验证机制保护软件授权
4. **GUI界面**：直观的图形用户界面便于操作
5. **批量处理**：支持批量数据处理和规划

## 系统架构

### 主要组件

1. **LTENRPCIPlanner**：LTE/NR PCI规划核心类
   - 实现距离优先的PCI分配算法
   - 支持mod3和mod30约束
   - 智能降级策略处理复杂场景

2. **NeighborPlanningTool**：邻区规划工具类
   - 基于覆盖圆算法的邻区发现
   - 支持NR-to-NR、LTE-to-LTE、NR-to-LTE规划
   - 智能扇区分部选择算法

3. **NetworkParameterUpdater**：网络参数更新工具
   - 支持压缩包格式的参数更新源
   - 模糊列匹配功能
   - 数据保护机制

4. **PCIGUIApp**：图形用户界面应用
   - 基于tkinter的GUI框架
   - 分页式功能界面
   - 实时进度反馈

### 许可证管理系统

- **LicenseManager**：验证许可证的完整性和有效期
- **LicenseGenerator**：生成加密的许可证文件
- 使用Fernet加密和HMAC签名验证防止篡改

## 文件结构

```
NetworkPlanningTool/
├── NetworkPlanningTool_V1.py          # 主GUI应用
├── license_manager.py                 # 许可证验证系统（在主文件中实现）
├── license_generator.py               # 许可证生成工具
├── license.dat                        # 许可证文件
├── run_gui.bat                        # Windows GUI启动器
├── install_dependencies.bat           # 依赖安装脚本
├── requirements.txt                   # Python依赖列表
├── 全量工参/                          # 网络参数文件
│   └── ProjectParameter_mongoose*.xlsx
├── 待规划小区/                        # 待规划小区数据
│   └── cell-tree-export-*.xlsx
└── 输出文件/                          # 输出文件
    ├── pci_planning_*.xlsx
    ├── neighbor_planning_*.xlsx
    └── ProjectParameter_mongoose_updated_*.xlsx
```

## 依赖管理

### Python依赖

- `pandas` >= 1.5.0 - 数据处理
- `numpy` >= 1.20.0 - 数值计算
- `openpyxl` >= 3.0.0 - Excel文件处理
- `cryptography` >= 3.4.0 - 许可证加密
- `PyQt5` >= 5.15.0 - GUI界面（可选）

### 安装依赖

```bash
pip install pandas numpy openpyxl cryptography PyQt5
```

或使用安装脚本：
```bash
install_dependencies.bat
```

## 使用方法

### 运行应用

1. **GUI模式**：
   - 双击 `run_gui.bat`
   - 或执行 `python NetworkPlanningTool_V1.py`

2. **许可证验证**：
   - 启动时自动验证 `license.dat` 文件
   - 无效许可证会显示错误信息并退出

### 三种主要功能

1. **PCI规划**：
   - 支持LTE网络 mod3约束 (PCI范围: 0-503)
   - 支持NR网络 双重约束 mod3 AND mod30 (PCI范围: 0-1007)
   - 智能冲突解决策略（3.0km→2.0km回退）
   - 同站点避让功能

2. **邻区规划**：
   - 基于覆盖圆算法的邻区关系计算
   - 支持三种规划类型：NR-to-NR、LTE-to-LTE、NR-to-LTE
   - 可配置的邻区发现距离和最大邻区数

3. **参数更新**：
   - 从现网工参压缩包更新全量工参
   - 模糊列名匹配功能
   - 自动保护表头行（索引0-2）

## 核心算法

### PCI规划算法

1. **约束检查**：按优先级验证mod3/mod30约束
2. **距离验证**：检查同频同PCI小区的复用距离
3. **冲突解决**：智能回退策略处理冲突
4. **缓存优化**：距离和PCI有效性缓存

### 邻区规划算法

1. **覆盖圆计算**：基于方位角和覆盖距离计算覆盖圆
2. **相交检测**：检测覆盖圆是否相交
3. **同站点检查**：10米内视为同站点
4. **距离排序**：按覆盖圆中心距离排序

## 开发规范

### 代码风格

- 使用中文注释和变量名（符合项目规范）
- 遵循Python PEP 8编码规范
- 模块化设计，功能分离

### 测试

- 暂无自动化测试套件
- 通过GUI界面进行功能验证

### 配置参数

#### PCI规划参数
- LTE PCI范围：0-503
- NR PCI范围：0-1007
- 复用距离：3.0km（初始）→ 2.0km（回退）
- 同站点阈值：0.01km（10米）

#### 邻区规划参数
- k系数：5/9（覆盖圆距离系数）
- m系数：5/9（覆盖半径系数）
- 最大邻区数：32

## 故障排除

### 常见问题

1. **许可证验证失败**：
   - 检查 `license.dat` 文件是否存在
   - 验证文件是否被篡改

2. **缺少输入文件**：
   - 验证目录结构：`全量工参/`, `待规划小区/`
   - 检查文件名格式是否匹配

3. **PCI规划冲突**：
   - 工具使用智能回退策略
   - 查看控制台输出的约束回退信息

### 联系方式

- 邮箱：weicongpeng1@163.com
- 电话：15220958556