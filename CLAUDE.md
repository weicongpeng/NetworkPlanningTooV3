# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

**NetworkPlanningTooV2** (网络规划工具 v2.0) 是一个用于电信网络规划的桌面应用程序。该工具支持地图可视化、邻区规划和 PCI (物理小区标识) 规划功能。

**架构模式**: Electron 桌面应用 + FastAPI 后端服务
- 可以作为独立的 Electron 桌面应用运行
- 前端也可以作为纯 Web 应用运行（`npm run dev:web`）

## 常用开发命令

### 快速启动

```bash
# Windows: 一键启动所有服务（推荐）
start_app.bat

# 或者手动分步启动（见下方）
```

### 后端服务 (FastAPI)

```bash
cd backend

# 首次运行需要创建虚拟环境
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt

# 启动后端服务
python main.py
```

**后端服务地址**: http://127.0.0.1:8000
**API 文档**: http://127.0.0.1:8000/docs

### 前端服务

```bash
cd frontend

# 首次运行需要安装依赖
npm install

# Electron 桌面应用模式 (开发)
npm run dev

# 仅启动 Vite 开发服务器 (Web 模式)
npm run dev:web

# 生产构建
npm run build

# 编译 Electron TypeScript
npm run build:electron
```

**前端开发服务器**: http://localhost:5173

### 测试

```bash
# 后端测试
cd backend
venv\Scripts\activate
pytest

# 前端测试
cd frontend
npm test
```

## 高层架构

### 整体架构图

```
┌─────────────────────────────────────────────────────────────┐
│                         Electron 主进程                       │
│  (frontend/electron/main.ts - 窗口生命周期、IPC 通信)          │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                      React 渲染进程                           │
│   (Vite 开发服务器 / 生产构建 - frontend/src/renderer/)      │
│                                                               │
│  页面组件 (pages/) ──▶ API 服务层 (services/api.ts)          │
│                          │                                    │
│                          ▼                                    │
│                    状态存储 (store/Zustand)                   │
└──────────────────────────┬──────────────────────────────────┘
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
│                                     │                            │
│                                     ▼                            │
│                          算法层 (algorithms/)                    │
│                          - pci_planning_service_v2.py           │
│                          - neighbor_planning_service_v2.py      │
│                          - pci_collision_detector.py            │
│                          - distance_calculator.py               │
│                                                                   │
│  数据存储: data/ (Excel), uploads/ (地图), outputs/ (结果)       │
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
| `frontend/electron/main.ts` | Electron 主进程入口 |
| `frontend/electron/preload.ts` | 预加载脚本，安全 API 暴露 |
| `frontend/src/renderer/main.tsx` | React 入口 |
| `frontend/src/renderer/App.tsx` | React 根组件，路由配置 |
| `frontend/src/renderer/services/api.ts` | Axios API 封装 |
| `frontend/src/renderer/store/licenseStore.ts` | 许可证状态管理 (Zustand) |
| `frontend/src/renderer/store/dataStore.ts` | 数据状态管理 (Zustand) |
| `frontend/vite.config.ts` | Vite 配置（代理、别名） |

### 共享类型

| 文件 | 说明 |
|------|------|
| `shared/types.ts` | 前后端共享的 TypeScript 类型定义 |

### 配置文件

| 文件 | 说明 |
|------|------|
| `frontend/package.json` | 前端依赖和脚本 |
| `backend/requirements.txt` | 后端 Python 依赖 |
| `frontend/vite.config.ts` | Vite 构建配置 |
| `start_app.bat` | Windows 一键启动脚本 |

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
- FastAPI 0.115 + Uvicorn
- Pandas + NumPy + OpenPyXL (数据处理)
- GeoPandas + GDAL + Shapely (地理空间)
- Pydantic (数据验证)
- asyncio (异步任务)

### 前端
- React 18 + TypeScript 5
- Electron 28 (桌面封装)
- Vite 5 (构建工具)
- TailwindCSS + shadcn/ui (UI)
- Zustand (状态管理)
- Axios (HTTP 客户端)
- Leaflet + React Leaflet (地图)

## 开发注意事项

1. **Electron 启动流程**: 需要先编译 TypeScript (`npm run build:electron`)，然后启动 Vite，最后启动 Electron
2. **数据格式**: 新的 Excel 数据按网络类型 (LTE/NR) 分表存储在 `data/` 目录
3. **异步任务**: 所有规划任务通过 `task_manager` 异步执行，前端通过进度接口或 WebSocket 获取状态
4. **类型同步**: 前后端共享类型在 `shared/types.ts`，修改后需同步更新

## 故障排除

- **端口占用**: `netstat -ano | findstr :8000` 查找并结束占用进程
- **GDAL 安装失败**: 使用预编译 wheel 文件或从非官方源安装
- **npm install 慢**: 使用国内镜像 `npm config set registry https://registry.npmmirror.com`
- **pip install 超时**: 使用清华源 `pip config set global.index-url https://pypi.tuna.tsinghua.edu.cn/simple`
