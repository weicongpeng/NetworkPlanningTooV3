# 网络规划工具 v2.0 - 手动启动指南

## 启动前准备

### 1. 检查环境

确保已安装以下软件：

**Python 3.11+**
- 下载地址: https://www.python.org/downloads/
- 安装时务必勾选 "Add Python to PATH"
- 验证: 打开CMD运行 `python --version`

**Node.js 18+**
- 下载地址: https://nodejs.org/
- 验证: 打开CMD运行 `node --version`

### 2. 首次运行配置

#### 配置后端

```cmd
# 打开CMD，进入项目目录
cd D:\mycode\NetworkPlanningTooV2

# 进入后端目录
cd backend

# 创建虚拟环境
python -m venv venv

# 激活虚拟环境
venv\Scripts\activate

# 升级pip
python -m pip install --upgrade pip

# 安装依赖（如果遇到GDAL安装失败，请看下面的解决方案）
pip install -r requirements.txt

# 退出虚拟环境（暂时不退出）
```

**GDAL安装问题解决方案**：

如果pip安装GDAL失败，使用预编译的wheel文件：

```cmd
# 先安装其他依赖
pip install fastapi uvicorn python-multipart pandas openpyxl pydantic

# GDAL可以从以下地址下载预编译的wheel文件:
# https://www.lfd.uci.edu/~gohlke/pythonlibs/#gdal
# 下载对应Python版本的.whl文件后运行:
# pip install 下载的文件名.whl
```

#### 配置前端

```cmd
# 打开新的CMD窗口，进入项目目录
cd D:\mycode\NetworkPlanningTooV2

# 进入前端目录
cd frontend

# 安装依赖（首次运行需要几分钟）
npm install

# 如果npm下载慢，使用国内镜像:
npm config set registry https://registry.npmmirror.com
npm install
```

## 启动服务

### 方法一：使用启动脚本（推荐）

直接双击运行 `start.bat` 或在CMD中运行：

```cmd
cd D:\mycode\NetworkPlanningTooV2
start.bat
```

### 方法二：手动启动

**启动后端服务**：

```cmd
# CMD窗口1
cd D:\mycode\NetworkPlanningTooV2\backend
venv\Scripts\activate
python main.py
```

后端启动成功后，会看到类似以下输出：
```
INFO:     Started server process [xxxx]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://127.0.0.1:8000
```

**启动前端服务**：

```cmd
# CMD窗口2
cd D:\mycode\NetworkPlanningTooV2\frontend
npm run dev
```

前端启动成功后，会看到类似以下输出：
```
  VITE v5.0.0  ready in xxx ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

### 访问应用

打开浏览器访问: http://localhost:5173

API文档地址: http://127.0.0.1:8000/docs

## 常见问题

### 1. 端口被占用

**错误信息**: `Address already in use`

**解决方案**:
```cmd
# 查找占用8000端口的进程
netstat -ano | findstr :8000
# 结束进程（将xxxx替换为实际的PID）
taskkill /PID xxxx /F
```

### 2. npm install失败

**解决方案**:
```cmd
# 清除缓存
npm cache clean --force

# 使用国内镜像
npm config set registry https://registry.npmmirror.com

# 删除node_modules后重试
rmdir /s /q node_modules
npm install
```

### 3. pip install超时

**解决方案**:
```cmd
# 使用国内镜像源
pip install -i https://pypi.tuna.tsinghua.edu.cn/simple -r requirements.txt

# 或者永久配置
pip config set global.index-url https://pypi.tuna.tsinghua.edu.cn/simple
```

### 4. 找不到模块

**错误信息**: `ModuleNotFoundError: No module named 'xxx'`

**解决方案**:
```cmd
# 确保已激活虚拟环境
cd backend
venv\Scripts\activate

# 验证Python路径
where python

# 应该显示: D:\mycode\NetworkPlanningTooV2\backend\venv\Scripts\python.exe
```

### 5. 启动脚本闪退

**解决方案**:
1. 先运行 `diagnose.bat` 进行环境诊断
2. 查看错误信息窗口
3. 根据错误信息手动安装缺失的依赖

## 开发模式

### 仅启动后端（开发API）

```cmd
cd backend
venv\Scripts\activate
python main.py
```

### 仅启动前端（开发UI）

```cmd
cd frontend
npm run dev
```

### 运行测试

```cmd
# 后端测试
cd backend
venv\Scripts\activate
pytest

# 前端测试
cd frontend
npm test
```

### 构建前端

```cmd
cd frontend
npm run build
```

### 构建Electron应用

```cmd
cd frontend
npm run build:electron
```

## 目录结构

```
NetworkPlanningTooV2/
├── backend/          # 后端代码
│   ├── venv/         # Python虚拟环境（自动创建）
│   ├── app/          # 应用代码
│   └── main.py       # 后端入口
├── frontend/         # 前端代码
│   ├── node_modules/  # npm依赖（自动创建）
│   └── src/          # 源代码
├── uploads/          # 上传文件目录（自动创建）
├── outputs/          # 输出文件目录（自动创建）
├── data/             # 数据存储目录（自动创建）
├── start.bat         # Windows启动脚本
└── diagnose.bat      # 环境诊断脚本
```

## 获取帮助

如果遇到问题：

1. 先运行 `diagnose.bat` 进行环境诊断
2. 查看各个服务窗口的错误信息
3. 检查Python和Node.js版本是否符合要求
4. 确保所有依赖都已正确安装

## 停止服务

在各个服务窗口按 `Ctrl+C` 停止服务。

如需完全清理：
```cmd
# 停止所有Python进程
taskkill /F /IM python.exe

# 停止所有Node进程
taskkill /F /IM node.exe
```
