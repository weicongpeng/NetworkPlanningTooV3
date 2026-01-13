# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

**NetworkPlanningTooV3** (网络规划工具 v3.0) 是一个用于电信网络规划的桌面应用程序。该工具支持地图可视化、邻区规划和 PCI (物理小区标识) 规划功能。

**架构模式**: Electron 桌面应用 + FastAPI 后端服务
- 可以作为独立的 Electron 桌面应用运行
- 前端也可以作为纯 Web 应用运行（`npm run dev:web`）

## 常用开发命令

### 快速启动

```bash
# Windows: Electron 桌面应用一键启动（推荐）
start_electron_app.bat

# 这个脚本会按顺序执行：
# 1. 编译 Electron TypeScript
# 2. 启动后端服务 (新窗口)
# 3. 启动 Vite 开发服务器 (新窗口)
# 4. 启动 Electron 应用 (新窗口)
```

### 后端服务 (FastAPI)

```bash
cd backend

# 首次运行需要创建虚拟环境
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt

# 启动后端服务（开发模式，支持热重载）
python main.py

# 单次运行（不使用 reload）
uvicorn app.api:create_app --host 127.0.0.1 --port 8000
```

**后端服务地址**: http://127.0.0.1:8000
**API 文档**: http://127.0.0.1:8000/docs
**健康检查**: http://127.0.0.1:8000/health

### 前端服务

```bash
cd frontend

# 首次运行需要安装依赖
npm install

# 仅启动 Vite 开发服务器 (Web 模式，不启动 Electron)
npm run dev:web

# Electron 桌面应用模式（需要先编译 TypeScript）
npm run build:electron  # 编译 Electron 主进程代码
npm run dev:vite        # 启动 Vite（在另一个窗口）
npm run dev:electron    # 启动 Electron（等待 Vite 就绪后）

# 生产构建
npm run build           # 构建前端渲染进程 + Electron 主进程

# 单独编译 Electron TypeScript
npm run build:electron

# 代码检查
npm run lint            # ESLint 检查
npm run type-check      # TypeScript 类型检查
```

**前端开发服务器**: http://localhost:5173

### 测试

```bash
# 后端测试
cd backend
venv\Scripts\activate
pytest                   # 运行所有测试
pytest -v               # 详细输出
pytest tests/test_specific.py  # 运行单个测试文件

# 前端测试
cd frontend
npm test                # 运行测试（需要配置测试框架）
```

## 高层架构

### 整体架构图

```
┌─────────────────────────────────────────────────────────────┐
│                         Electron 主进程                       │
│  (frontend/electron/main.ts - 窗口生命周期、IPC 通信)          │
│  - 自动启动后端 Python 进程                                    │
│  - 文件对话框处理                                              │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                      React 渲染进程                           │
│   (Vite 开发服务器 / 生产构建 - frontend/src/renderer/)      │
│                                                               │
│  页面组件 (pages/) ──▶ API 服务层 (services/api.ts)          │
│     │                              │                         │
│     │                              ▼                         │
│     │                    状态存储 (store/Zustand)             │
│     │                      - taskStore (任务进度)             │
│     │                      - dataStore (数据列表)             │
│     │                      - mapStore (地图状态)              │
│     │                      - licenseStore (许可证)            │
│     │                                                    │
│     └─────────────────────────────────────────────────────┘
                           │
                    HTTP REST API
                           │
                    ┌──────┴──────┐
                    │             │
                    ▼             ▼
              Vite Proxy     WebSocket
              (/api → 8000)   (/ws → 8000)
                    │             │
                    └──────┬──────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                      FastAPI 后端服务                           │
│                      (backend/app/)                             │
│                                                                   │
│  API 端点 (api/v1/endpoints/) ──▶ 服务层 (services/)            │
│    - data.py                      - data_service.py             │
│    - pci.py                       - task_manager.py             │
│    - neighbor.py                  - mapinfo_service.py          │
│    - map.py                       - license_service.py          │
│                                     │                            │
│                                     ▼                            │
│                          算法层 (algorithms/)                    │
│                          - pci_planning_service_v2.py           │
│                          - neighbor_planning_service_v2.py      │
│                          - pci_collision_detector.py            │
│                          - distance_calculator.py               │
│                                                                   │
│  数据存储: data/ (Excel + JSON 索引), outputs/ (结果)            │
│                                                                   │
│  编码处理: main.py 启动时配置 UTF-8 编码（解决 Windows GBK 问题） │
└─────────────────────────────────────────────────────────────────┘
```

### 分层架构

| 层级 | 位置 | 职责 |
|------|------|------|
| **API 层** | `backend/app/api/v1/endpoints/` | 处理 HTTP 请求/响应，参数验证 |
| **服务层** | `backend/app/services/` | 业务逻辑，数据管理，异步任务管理 |
| **算法层** | `backend/app/algorithms/` | 核心规划算法（PCI、邻区） |
| **数据层** | `backend/app/services/data_service.py` | 文件存储、Excel 解析、数据索引 |

### 异步任务处理

**关键组件**: `backend/app/services/task_manager.py`

- 使用 `asyncio` 处理长时间运行的规划任务
- `TaskManager` 管理任务生命周期（创建、执行、进度追踪、完成）
- 支持进度回调，前端通过 WebSocket 获取实时进度
- 任务状态: PENDING → PROCESSING → COMPLETED/FAILED

**重要**: 后端启动时配置了 UTF-8 编码以解决 Windows 下的中文显示问题（`backend/main.py:8-48`）

## 关键文件位置

### 后端核心文件

| 文件 | 说明 |
|------|------|
| `backend/main.py` | FastAPI 应用入口，Uvicorn 服务器配置 |
| `backend/app/api/__init__.py` | 创建应用实例，配置 CORS |
| `backend/app/api/v1/__init__.py` | 路由注册 |
| `backend/app/core/config.py` | 应用配置（Settings 类） |
| `backend/app/models/schemas.py` | Pydantic 数据模型 |
| `backend/app/services/data_service.py` | 数据管理服务（单例） |
| `backend/app/services/task_manager.py` | 异步任务管理器（单例） |
| `backend/app/algorithms/pci_planning_service_v2.py` | PCI 规划算法 |
| `backend/app/algorithms/neighbor_planning_service_v2.py` | 邻区规划算法 |

### 前端核心文件

| 文件 | 说明 |
|------|------|
| `frontend/electron/main.ts` | Electron 主进程入口，窗口管理，自动启动后端 |
| `frontend/electron/preload.ts` | 预加载脚本，安全 API 暴露 |
| `frontend/src/renderer/main.tsx` | React 入口 |
| `frontend/src/renderer/App.tsx` | React 根组件，路由配置 |
| `frontend/src/renderer/services/api.ts` | Axios API 封装，统一的错误处理 |
| `frontend/src/renderer/store/taskStore.ts` | 任务进度状态管理 (Zustand) |
| `frontend/src/renderer/store/dataStore.ts` | 数据列表状态管理 (Zustand) |
| `frontend/src/renderer/store/mapStore.ts` | 地图状态管理 (Zustand) |
| `frontend/src/renderer/store/licenseStore.ts` | 许可证状态管理 (Zustand) |
| `frontend/src/renderer/pages/` | 页面组件 (HomePage, DataPage, PCIPage, NeighborPage, MapPage, LicensePage) |
| `frontend/src/renderer/components/Map/` | 地图相关组件 (OnlineMap, OfflineMap, SectorRenderer, LayerControl) |
| `frontend/vite.config.ts` | Vite 配置（代理、别名、构建输出） |
| `frontend/package.json` | 前端依赖和脚本 |
| `frontend/start-electron-dev.bat` | Electron 启动脚本（带 Vite 端口检测） |

### 共享类型

| 文件 | 说明 |
|------|------|
| `shared/types.ts` | 前后端共享的 TypeScript 类型定义 |

### 配置文件

| 文件 | 说明 |
|------|------|
| `frontend/package.json` | 前端依赖和脚本 |
| `backend/requirements.txt` | 后端 Python 依赖 |
| `frontend/vite.config.ts` | Vite 构建配置（代理、路径别名、构建输出） |
| `backend/app/core/config.py` | 后端配置（Settings 类，包含 API Key、目录路径等） |
| `start_electron_app.bat` | Windows 一键启动脚本（Electron 模式） |
| `frontend/start-electron-dev.bat` | Electron 启动脚本（带 Vite 端口检测） |

## 数据流与关键模式

### 文件上传流程

```
用户选择文件 → Electron IPC 获取文件路径
→ POST /api/v1/data/upload
→ data_service 处理文件
→ Pandas 解析 Excel（支持 LTE/NR 分表）
→ 存储到 data/ 目录
→ 更新内存索引
```

### PCI 规划流程

```
用户配置 → POST /api/v1/pci/plan
→ task_manager.create_pci_task()
→ asyncio.create_task(_run_pci_task)
→ pci_planning_service_v2 执行算法
→ progress_callback 更新进度
→ WebSocket 推送进度到前端
→ 完成后存储结果
```

### 数据结构说明

**Excel 数据支持两种格式**:
1. **新格式（推荐）**: `{ "LTE": [...], "NR": [...] }` - 按 LTE/NR 网络类型分表
2. **旧格式**: `[...]` - 扁平列表，每条记录包含 `networkType` 字段

**数据文件类型识别** (data_service.py):
- `full_params`: 包含 "LTE Project Parameters" 和 "NR Project Parameters" 工作表
- `target_cells`: 包含 "LTE" 和 "NR" 工作表
- `default`: 其他格式

**数据索引**: `data/index.json` 存储所有上传文件的元数据，包括文件类型、上传时间、状态等。

## API 端点结构

| 模块 | 前缀 | 主要端点 |
|------|------|---------|
| 许可证 | `/api/v1/license` | `/status`, `/activate`, `/upload` |
| 数据管理 | `/api/v1/data` | `/upload/excel`, `/upload/map`, `/list`, `/{id}`, `/update-parameters` |
| PCI 规划 | `/api/v1/pci` | `/plan`, `/progress/{id}`, `/result/{id}`, `/export/{id}` |
| 邻区规划 | `/api/v1/neighbor` | `/plan`, `/progress/{id}`, `/result/{id}`, `/export/{id}` |
| 地图服务 | `/api/v1/map` | `/data`, `/online-config`, `/offline-path` |

## Vite 配置说明

`frontend/vite.config.ts`:
- **代理**: `/api` → `http://localhost:8000`, `/ws` → `ws://localhost:8000`
- **路径别名**: `@/` → `./src`, `@shared/` → `../shared`
- **构建输出**: `dist-renderer/` 目录

## 后端配置说明

`backend/app/core/config.py` (Settings 类):
- API 前缀: `/api/v1`
- CORS 源: `http://localhost:5173`
- 目录: `uploads/`, `outputs/`, `data/`, `licenses/`
- 高德地图 API Key 已配置
- PCI/邻区规划默认阈值

## 技术栈

### 后端
- FastAPI 0.115 + Uvicorn (Web 框架)
- Pandas 2.2 + NumPy 1.26 + OpenPyXL 3.1 (数据处理)
- GeoPandas 1.0 + GDAL 3.8 + Shapely 2.0 (地理空间)
- Pydantic 2.9 + Pydantic-Settings 2.6 (数据验证)
- asyncio + WebSocket 14.0 (异步任务和实时通信)
- python-jose + cryptography (许可证加密)

### 前端
- React 18 + TypeScript 5
- Electron 28 (桌面封装)
- Vite 5 (构建工具)
- React Router DOM 6 (路由)
- Zustand 4 (状态管理)
- Axios 1.6 (HTTP 客户端)
- Leaflet 1.9 + React Leaflet 4.2 (地图)
- Radix UI (无样式组件)
- TailwindCSS 3.3 (样式)
- Lucide React (图标)

**注意**: 前端支持双模式运行：
1. **Electron 桌面模式**: 完整功能，支持文件对话框
2. **Web 模式** (`npm run dev:web`): 纯浏览器运行，某些桌面功能受限

## 开发注意事项

1. **Electron 启动流程**: 需要先编译 TypeScript (`npm run build:electron`)，然后启动 Vite，最后启动 Electron
2. **数据格式**: 新的 Excel 数据按网络类型 (LTE/NR) 分表存储在 `data/` 目录
3. **异步任务**: 所有规划任务通过 `task_manager` 异步执行，前端通过进度接口或 WebSocket 获取状态
4. **类型同步**: 前后端共享类型在 `shared/types.ts`，修改后需同步更新
5. **编码问题**: 后端已配置 UTF-8 编码处理（main.py），但涉及中文输出时仍需注意
6. **GDAL 依赖**: 地图功能依赖 GDAL，Windows 安装可能需要预编译 wheel 文件
7. **端口占用**: 后端默认 8000，前端默认 5173，修改需同步更新 Vite 代理配置

## 关键开发模式

### 添加新的 API 端点

1. 在 `backend/app/api/v1/endpoints/` 创建新的端点文件
2. 在 `backend/app/api/v1/__init__.py` 注册路由
3. 在 `shared/types.ts` 添加对应的 TypeScript 类型
4. 在 `frontend/src/renderer/services/api.ts` 添加 API 调用函数

### 添加新的规划算法

1. 在 `backend/app/algorithms/` 创建算法服务文件
2. 实现异步函数 `run_xxx_planning(config, progress_callback)`
3. 在 `task_manager.py` 添加对应的任务创建方法
4. 在 `backend/app/api/v1/endpoints/` 创建对应的 API 端点

### 前端状态管理模式

- 使用 Zustand 创建 store (`frontend/src/renderer/store/`)
- 遵循现有模式：定义 state、actions、selectors
- 在组件中使用 `useXxxStore()` hook 获取状态和方法

## 故障排除

- **端口占用**: `netstat -ano | findstr :8000` 查找并结束占用进程
- **GDAL 安装失败**: 使用预编译 wheel 文件或从非官方源安装
- **npm install 慢**: 使用国内镜像 `npm config set registry https://registry.npmmirror.com`
- **pip install 超时**: 使用清华源 `pip config set global.index-url https://pypi.tuna.tsinghua.edu.cn/simple`
- **Electron 窗口空白**: 检查 Vite 是否已启动（访问 http://localhost:5173），查看 Electron 开发者工具控制台错误
- **后端编码错误**: 确保 `PYTHONIOENCODING=utf-8` 环境变量已设置（main.py 已配置）
- **地图不显示**: 检查高德地图 API Key 配置（config.py:47），确保网络可访问高德服务

## 项目版本

**当前版本**: V3.0.0
**主要变化**:
- 从 V2 升级到 V3
- 增强的编码支持（Windows UTF-8）
- 改进的数据索引和扫描机制
- 优化的 Electron 启动流程

## 相关文档

- **README.md**: 项目功能介绍、安装步骤、API 端点列表
- **shared/types.ts**: 前后端共享的类型定义（TypeScript）
- **backend/app/models/schemas.py**: 后端 Pydantic 数据模型
