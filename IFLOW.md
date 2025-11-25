# iFlow CLI 项目上下文

## 项目概述

这是一个专业的无线网络规划工具，用于LTE和NR（5G）移动通信网络的规划设计。项目采用Python开发，提供完整的PCI规划、现网工参更新和邻区规划功能。

### 核心功能
1. **PCI规划** - 基于距离优先算法的智能PCI分配
2. **现网工参更新** - 从现网数据压缩包更新全量工参
3. **邻区规划** - 基于距离阈值的邻区关系生成
4. **许可证管理** - 基于加密算法的许可证控制

### 技术特性
- **双模支持**: 独立处理LTE（4G）和NR（5G）网络
- **mod30逻辑**: NR网络支持mod3和mod30双重约束
- **距离优先**: 确保最小PCI复用距离（默认3km）
- **智能回退**: 多级约束放松机制
- **向量化优化**: NumPy加速，性能提升3-5倍
- **模糊匹配**: 智能列名识别，兼容多种工参格式

## 技术栈

- **语言**: Python 3.7+
- **数据处理**: pandas, numpy
- **Excel操作**: openpyxl
- **数学计算**: math
- **加密**: cryptography, hashlib, hmac
- **GUI**: tkinter（许可证管理）

## 项目结构

```
D:\mycode\-PCI-\
├── NetworkPlanningTool_V1.py         # 主程序 - GUI版本（5318行）
├── planning_lte_nr_enhanced.py       # CLI版本 - 旧版本工具（4845行）
├── license_manager.py                # 许可证管理
├── license_generator.py              # 许可证生成
├── run.bat                           # CLI版本运行脚本
├── run_gui.bat                       # GUI版本运行脚本
├── *.md                              # 文档文件
├── 全量工参/                         # 工参文件目录
├── 待规划小区/                       # 规划输入目录
└── 输出文件/                         # 结果输出目录
```

## 运行方法

### GUI版本（推荐）
```bash
# Windows
run_gui.bat

# 或直接运行
python NetworkPlanningTool_V1.py
```

### CLI版本
```bash
# Windows
run.bat

# 或直接运行
python planning_lte_nr_enhanced.py
```

### 依赖安装
```bash
pip install pandas numpy openpyxl cryptography
```

### 交互式菜单（CLI版本）
程序启动后提供功能菜单：
1. PCI规划
2. 现网工参更新
3. 邻区规划
4. 退出

## 开发约定

### 代码规范
- **命名**: snake_case（函数/变量）, PascalCase（类）
- **类型提示**: 使用typing模块添加类型注解
- **文档字符串**: 类和方法必须包含docstring
- **错误处理**: 使用try-except块，提供清晰错误信息

### 关键规则
1. **表头保护**: DataFrame操作必须使用`df.loc[3:, ...]`（前3行为表头）
2. **时间戳格式**: 输出文件名使用`YYYYMMDD_HHMMSS`格式
3. **缓存管理**: PCI分配后必须清空相关缓存
4. **距离计算**: 使用Haversine公式，结果以公里为单位

### 数据约定
- **LTE列名**: eNodeBID, CellID, lat, lon, pci, earfcnDl
- **NR列名**: gNodeBID, CellID, lat, lon, pci, earfcnDl
- **合并键**: 
  - LTE: eNBId + cellLocalId
  - NR: MCC + MNC + gNodeBID + CellID

### 算法优先级
PCI分配优先级（从高到低）：
1. 最小复用距离
2. 同站模冲突避免
3. PCI分布均衡
4. 距离大小
5. PCI连续性
6. PCI数值（小值优先）

### 性能优化
- **向量化操作**: 优先使用NumPy向量化计算
- **缓存机制**: 距离、验证结果缓存
- **批量处理**: 避免循环调用，使用批量验证
- **内存管理**: 及时清理大型DataFrame

## 文件处理

### 输入文件
- **待规划小区**: `待规划小区/cell-tree-export-*.xlsx`
- **全量工参**: `全量工参/ProjectParameter_mongoose*.xlsx`
- **现网工参**: `BaselineLab_*.zip`

### 输出文件
- **PCI规划**: `输出文件/pci_planning_{network}_{distance}km_{mod}_{timestamp}.xlsx`
- **邻区规划**: `输出文件/neighbor_planning_{type}_{distance}km_{timestamp}.xlsx`
- **工参更新**: 带时间戳的工参文件

## 测试验证

### 单元测试要点
- 距离计算精度（对比已知坐标）
- 同站检测准确性（<0.01km）
- PCI约束验证
- 智能回退机制
- 缓存清理功能

### 集成测试场景
- 小型网络（<100小区）
- 中型网络（100-1000小区）
- 大型网络（>1000小区）
- LTE/NR混合网络
- 特殊场景（高速铁路、室内覆盖等）

## 常见问题

### 性能问题
- **症状**: 大规模网络处理速度慢
- **解决**: 确认向量化优化已启用，检查内存使用

### 数据匹配问题
- **症状**: 现网工参更新失败
- **解决**: 检查列名是否匹配，确认合并键正确

### PCI冲突
- **症状**: 规划结果存在PCI冲突
- **解决**: 检查复用距离设置，验证同站检测逻辑

## 维护说明

### 版本管理
- 主版本: 功能重大更新
- 次版本: 功能增强
- 修订版: Bug修复

### 文档更新
- README.md: 用户文档
- CLAUDE.md: 开发指南（英文）
- QWEN.md: 项目概述（英文）
- IFLOW.md: iFlow CLI上下文（本文件）

### 备份策略
- 工参文件: 保留最近7个版本
- 输出文件: 按项目归档
- 代码: Git版本控制

## 安全注意事项

### 许可证管理
- 使用加密算法保护许可证文件
- 基于HMAC的防篡改机制
- 过期日期验证

### 数据安全
- 工参文件包含敏感网络信息
- 输出文件需妥善保管
- 定期清理临时文件

## 联系信息

- **项目地址**: https://github.com/weicongpeng/-PCI-
- **维护者**: weicongpeng
- **最后更新**: 2025年11月
