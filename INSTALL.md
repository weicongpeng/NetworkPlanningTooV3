# Network Planning Tool - Installation Guide

## 快速安装

### Windows 用户

运行自动安装脚本：
```bash
install_dependencies.bat
```

### 手动安装

1. **安装核心依赖**
```bash
pip install pandas numpy openpyxl cryptography
```

2. **安装地图可视化支持（可选）**

选择以下任一方案：

**方案 1：PyQt5（推荐）**
```bash
pip install PyQt5 PyQtWebEngine
```

**方案 2：PySide6**
```bash
pip install PySide6
```

## 依赖清单

### 核心依赖（必需）

| 包名 | 版本要求 | 用途 |
|------|----------|------|
| pandas | >=1.5.0 | 数据处理和分析 |
| numpy | >=1.20.0 | 数值计算 |
| openpyxl | >=3.0.0 | Excel 文件读写 |
| cryptography | >=3.4.0 | 许可证加密 |

### 可选依赖（地图可视化）

| 包名 | 版本要求 | 用途 |
|------|----------|------|
| PyQt5 | >=5.15.0 | GUI 框架 |
| PyQtWebEngine | >=5.15.0 | Web 引擎（地图渲染） |
| PySide6 | >=6.0.0 | PyQt 的替代方案 |

### 内置依赖

| 包名 | 说明 |
|------|------|
| tkinter | GUI 框架（Python 自带） |

## 使用 pip 安装

### 从 requirements.txt 安装

```bash
pip install -r requirements.txt
```

### 仅安装核心依赖

如果不需要地图可视化功能，只安装核心依赖即可：

```bash
pip install pandas numpy openpyxl cryptography
```

## 验证安装

运行以下命令验证所有依赖是否正确安装：

```bash
python -c "import pandas, numpy, openpyxl, cryptography; print('✓ Core dependencies OK')"
```

检查 PyQt5/PySide6 是否可用：

```bash
python -c "try:
    from PyQt5.QtWidgets import QApplication
    print('✓ PyQt5 available')
except ImportError:
    try:
        from PySide6.QtWidgets import QApplication
        print('✓ PySide6 available')
    except ImportError:
        print('✗ No GUI framework available')
"
```

## 运行应用

安装完成后，运行主程序：

```bash
python NetworkPlanningTool_V1.py
```

或使用批处理文件：

```bash
run_gui.bat
```

## 故障排除

### 问题 1：Permission denied

**错误信息**：ERROR: Could not install packages due to an OSError: [Errno 13] Permission denied

**解决方案**：
```bash
pip install --user <package_name>
```

### 问题 2：PyQt5 安装失败

**解决方案**：尝试安装 PySide6 替代方案

```bash
pip uninstall PyQt5 PyQtWebEngine
pip install PySide6
```

### 问题 3：Python 版本不兼容

**PyQt5**：支持 Python 3.6+
**PySide6**：支持 Python 3.8-3.12

检查 Python 版本：
```bash
python --version
```

### 问题 4：网络超时

如果 pip 安装超时，可以尝试使用国内镜像源：

```bash
pip install -i https://pypi.tuna.tsinghua.edu.cn/simple/ pandas numpy openpyxl cryptography
```

## 项目结构

安装完成后的目录结构：

```
NetworkPlanningTool/
├── requirements.txt              # 依赖清单
├── install_dependencies.bat      # Windows 自动安装脚本
├── NetworkPlanningTool_V1.py     # 主程序
├── license_generator.py          # 许可证生成器
├── run_gui.bat                   # GUI 启动脚本
├── run_license.bat               # 许可证工具启动脚本
└── ...
```

## 下一步

安装完成后，请参考以下文档：
- `README.md` - 用户使用指南
- `CLAUDE.md` - 开发者指南
