# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

**NetworkPlanningTooV3** (网络规划工具 v3.0) 是一个用于电信网络规划的桌面应用程序。该工具支持地图可视化、邻区规划、PCI (物理小区标识) 规划和 TAC (跟踪区域码) 规划功能。

**架构模式**: Electron 桌面应用 + FastAPI 后端服务
- 可以作为独立的 Electron 桌面应用运行
- 前端也可以作为纯 Web 应用运行（`npm run dev:web`）

**主要功能**:
- **PCI 规划**: 物理小区标识规划，支持碰撞/混淆检测、模 3/模 30 约束
- **邻区规划**: 自动邻区关系规划，基于覆盖圆算法
- **TAC 规划**: 跟踪区域码规划，支持异 TAC 孤岛检测
- **地图可视化**: 支持在线/离线地图，工参数据和规划结果展示
- **地理化数据**: 支持上传 Excel/CSV/TXT/TAB/MIF 地理数据文件，自动识别点状/扇区图层

## 常用开发命令

### 快速启动

```bash
# Windows: Electron 桌面应用一键启动（推荐）
start_electron_app.bat

# 或者分别启动：
cd frontend && npm run dev
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

### 前端服务

```bash
cd frontend

# 首次运行需要安装依赖
npm install

# 开发模式（Electron + Vite，同时启动）
npm run dev

# 仅启动 Vite 开发服务器 (Web 模式，不启动 Electron)
npm run dev:web

# Electron 桌面应用模式
npm run build:electron  # 先编译 TypeScript
npm run dev:vite        # 启动 Vite
npm run dev:electron    # 启动 Electron

# 生产构建
npm run build           # 构建前端渲染进程 + Electron 主进程
npm run build:vite      # 仅构建 Vite

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
pytest                           # 运行所有测试
pytest -v                        # 详细输出
pytest tests/test_specific.py     # 运行单个测试文件
pytest -k "test_name"            # 运行匹配模式的测试
pytest -s                         # 显示 print 输出
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
│     │                      - dataStore (数据列表)            │
│     │                      - mapStore (地图状态)             │
│     │                      - licenseStore (许可证)           │
│     │                      - tacStore / tacPlanningStore     │
│     │                      - themeStore (主题)               │
│     └───────────────────────────────────────────────────────┘
                           │
                    HTTP REST API + WebSocket
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
│  API 端点 (api/v1/endpoints/) ──▶ 服务层 (services/)           │
│    - data.py      - data_service.py    - geo_data_service.py   │
│    - pci.py       - task_manager.py    - export_service.py     │
│    - neighbor.py  - mapinfo_service.py - tac_planning_service.py│
│    - tac.py       - license_service.py - geo_field_detector.py  │
│    - geo_data.py  - websocket_manager.py                        │
│    - map.py                                                    │
│                                     │                           │
│                                     ▼                           │
│                          算法层 (algorithms/)                    │
│                          - pci_planning_service_v2.py           │
│                          - neighbor_planning_v1_service.py      │
│                          - distance_calculator.py               │
│                                                                   │
│  数据存储: data/ (Excel + JSON 索引), outputs/, exports/        │
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
- 支持进度回调，前端通过 WebSocket (`websocket_manager.py`) 获取实时进度
- 任务状态: PENDING → PROCESSING → COMPLETED/FAILED

## 关键文件位置

### 后端核心文件

| 文件 | 说明 |
|------|------|
| `backend/main.py` | FastAPI 应用入口，Uvicorn 服务器配置，UTF-8 编码处理 |
| `backend/app/api/__init__.py` | 创建应用实例，配置 CORS |
| `backend/app/api/v1/__init__.py` | 路由注册 |
| `backend/app/core/config.py` | 应用配置（Settings 类） |
| `backend/app/models/schemas.py` | Pydantic 数据模型 |
| `backend/app/services/data_service.py` | 数据管理服务（单例） |
| `backend/app/services/task_manager.py` | 异步任务管理器（单例） |
| `backend/app/services/websocket_manager.py` | WebSocket 连接管理 |
| `backend/app/services/export_service.py` | 导出服务（Excel/CSV） |
| `backend/app/services/geo_data_service.py` | 地理数据处理服务 |
| `backend/app/services/tac_planning_service.py` | TAC 规划服务 |
| `backend/app/algorithms/pci_planning_service_v2.py` | PCI 规划算法 |
| `backend/app/algorithms/neighbor_planning_v1_service.py` | 邻区规划算法 |
| `backend/app/algorithms/distance_calculator.py` | 距离计算工具 |

### 后端 API 端点

| 文件 | 端点前缀 | 说明 |
|------|---------|------|
| `data.py` | `/api/v1/data` | 数据上传/管理/预览 |
| `pci.py` | `/api/v1/pci` | PCI 规划 |
| `neighbor.py` | `/api/v1/neighbor` | 邻区规划 |
| `tac.py` | `/api/v1/tac` | TAC 规划 |
| `geo_data.py` | `/api/v1/geo-data` | 地理化数据处理 |
| `map.py` | `/api/v1/map` | 地图服务 |
| `license.py` | `/api/v1/license` | 许可证管理 |
| `websocket.py` | `/ws` | WebSocket 连接 |

### 前端核心文件

| 文件 | 说明 |
|------|------|
| `frontend/electron/main.ts` | Electron 主进程入口，窗口管理，自动启动后端 |
| `frontend/electron/preload.ts` | 预加载脚本，安全 API 暴露 |
| `frontend/src/renderer/main.tsx` | React 入口 |
| `frontend/src/renderer/App.tsx` | React 根组件，路由配置 |
| `frontend/src/renderer/components/Layout/MainLayout.tsx` | 主布局组件 |
| `frontend/src/renderer/services/api.ts` | Axios API 封装（含 uploadClient 专用上传实例） |
| `frontend/src/renderer/store/taskStore.ts` | 任务进度状态管理 (Zustand) |
| `frontend/src/renderer/store/dataStore.ts` | 数据列表状态管理 (Zustand) |
| `frontend/src/renderer/store/mapStore.ts` | 地图状态管理 (Zustand) |
| `frontend/src/renderer/store/licenseStore.ts` | 许可证状态管理 (Zustand) |
| `frontend/src/renderer/store/tacStore.ts` | TAC 状态管理 (Zustand) |
| `frontend/src/renderer/store/tacPlanningStore.ts` | TAC 规划状态管理 (Zustand) |
| `frontend/src/renderer/store/themeStore.ts` | 主题状态管理 (Zustand) |
| `frontend/src/renderer/pages/PCIPage.tsx` | PCI 规划页面 |
| `frontend/src/renderer/pages/NeighborPage.tsx` | 邻区规划页面 |
| `frontend/src/renderer/pages/TACPage.tsx` | TAC 页面 |
| `frontend/src/renderer/pages/TACPlanningPage.tsx` | TAC 规划页面 |
| `frontend/src/renderer/pages/MapPage.tsx` | 地图页面 |
| `frontend/src/renderer/pages/DataPage.tsx` | 数据管理页面 |
| `frontend/src/renderer/pages/HomePage.tsx` | 首页 |
| `frontend/src/renderer/pages/LicensePage.tsx` | 许可证页面 |
| `frontend/src/renderer/pages/NetworkStatusDemo.tsx` | 网络状态演示页面 |
| `frontend/src/renderer/components/Map/` | 地图相关组件 (OnlineMap, OfflineMap, SectorRenderer, LayerControl) |

### 共享类型

| 文件 | 说明 |
|------|------|
| `shared/types.ts` | 前后端共享的 TypeScript 类型定义 |

## 数据流与关键模式

### 文件上传流程

```
用户选择文件 → Electron IPC 获取文件路径
→ POST /api/v1/data/upload/excel
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

**地理数据支持格式**: Excel (.xlsx), CSV (.csv), TXT (.txt), TAB (.tab), MIF (.mif)

**数据索引**: `data/index.json` 存储所有上传文件的元数据

## API 端点结构

| 模块 | 前缀 | 主要端点 |
|------|------|---------|
| 许可证 | `/api/v1/license` | `/status`, `/activate`, `/upload` |
| 数据管理 | `/api/v1/data` | `/upload/excel`, `/upload/map`, `/upload/geo`, `/list`, `/{id}`, `/update-parameters`, `/{id}/preview` |
| PCI 规划 | `/api/v1/pci` | `/plan`, `/progress/{id}`, `/result/{id}`, `/export/{id}` |
| 邻区规划 | `/api/v1/neighbor` | `/plan`, `/progress/{id}`, `/result/{id}`, `/export/{id}` |
| TAC 规划 | `/api/v1/tac` | `/plan`, `/planning/plan`, `/progress/{id}`, `/result/{id}`, `/export/{id}` |
| 地理数据 | `/api/v1/geo-data` | `/upload`, `/list`, `/{id}`, `/{id}/preview` |
| 地图服务 | `/api/v1/map` | `/data`, `/online-config`, `/offline-path` |
| WebSocket | `/ws` | 实时进度推送连接 |

## 关键开发模式

### 前端 API 服务模式

`frontend/src/renderer/services/api.ts` 使用双客户端模式：

```typescript
// 普通 API 请求
const apiClient = axios.create({
  baseURL: '/api/v1',
  timeout: 300000,
  headers: { 'Content-Type': 'application/json' }
})

// 文件上传专用（开发环境直接访问后端）
const uploadClient = axios.create({
  baseURL: isDev ? 'http://localhost:8000/api/v1' : '/api/v1',
  timeout: 300000
})

// Blob 下载
const response = await apiClient.get('/api/download', { responseType: 'blob' })
return response.data  // 直接返回 blob
```

### 添加新的 API 端点

1. 在 `backend/app/api/v1/endpoints/` 创建新的端点文件
2. 在 `backend/app/api/v1/__init__.py` 注册路由
3. 在 `shared/types.ts` 添加对应的 TypeScript 类型
4. 在 `frontend/src/renderer/services/api.ts` 添加 API 调用函数

### 前端状态管理模式

- 使用 Zustand 创建 store (`frontend/src/renderer/store/`)
- 遵循现有模式：定义 state、actions、selectors
- 在组件中使用 `useXxxStore()` hook 获取状态和方法

### 后端编码处理（Windows GBK 兼容）

所有错误消息必须进行 GBK 安全处理：

```python
# 错误处理模式
try:
    result = operation()
except Exception as e:
    safe_detail = str(e).encode("gbk", "replace").decode("gbk")
    raise HTTPException(status_code=400, detail=safe_detail)
```

### CPU 密集型操作异步处理

使用 `run_in_threadpool` 处理 pandas/geopandas 操作：

```python
from fastapi.concurrency import run_in_threadpool

# CPU 密集型操作
result = await run_in_threadpool(heavy_pandas_operation, df)
```

## 代码风格指南

### 前端导入顺序

```typescript
// 1. 外部库
import React from 'react'
import { Shield } from 'lucide-react'

// 2. 内部模块 (@/ 别名)
import { apiClient } from '@/services/api'
import { useDataStore } from '@/store/dataStore'

// 3. 类型导入 (始终使用 'type' 关键字)
import type { ApiResponse, DataItem } from '@shared/types'
```

### 后端导入顺序

```python
# 1. 标准库
import asyncio
from typing import List, Optional
from pathlib import Path

# 2. 第三方
from fastapi import APIRouter, HTTPException
import pandas as pd

# 3. 内部
from app.models.schemas import DataItem
from app.services.data_service import data_service
```

### 命名约定

| 位置 | 组件/类 | 函数/变量 | 常量 | 文件 |
|------|---------|----------|------|------|
| 前端 | PascalCase | camelCase | UPPER_SNAKE_CASE | kebab-case |
| 后端 | PascalCase | snake_case | UPPER_SNAKE_CASE | snake_case |

## 多语言约束（关键）

应用支持中英文切换（语言控件位于配置管理页面底部），**所有前端开发必须遵守以下规则**：

1. **UI 文本必须用 `t()` 翻译函数**，不得硬编码中文字符串作为显示文本
2. **`useTranslation()` 必须在 React 组件内部调用**，不能放在模块顶层
3. **子函数组件（如 `UploadArea`、`DataPreview`）如需翻译，必须在自己的函数体内调用 `useTranslation()`**，不得依赖父组件传入的 `t`
4. **日期格式化必须根据 `i18n.language` 动态设置 locale**：`i18n.language === 'en' ? 'en-US' : 'zh-CN'`，不得硬编码 `'zh-CN'`
5. **搜索/过滤逻辑不得依赖翻译文本**：用布尔值或原始数据比较，不用 `t()` 返回值比较
6. **翻译文件 key 必须同步**：`locales/zh.json` 和 `locales/en.json` 两者必须同步，新增 key 必须同时添加

## 开发注意事项

1. **Electron 启动流程**: 需要先编译 TypeScript (`npm run build:electron`)，然后启动 Vite，最后启动 Electron
2. **数据格式**: 新的 Excel 数据按网络类型 (LTE/NR) 分表存储在 `data/` 目录
3. **异步任务**: 所有规划任务通过 `task_manager` 异步执行，前端通过 WebSocket 获取实时进度
4. **类型同步**: 前后端共享类型在 `shared/types.ts`，修改后需同步更新
5. **编码问题**: 后端已配置 UTF-8 编码处理（main.py），但涉及中文输出时仍需注意 GBK 安全处理
6. **GDAL 依赖**: 地图功能依赖 GDAL，Windows 安装可能需要预编译 wheel 文件
7. **端口占用**: 后端默认 8000，前端默认 5173，修改需同步更新 Vite 代理配置
8. **API 环境**: 开发环境使用 `VITE_API_URL` 环境变量直接连接后端

## 故障排除

- **端口占用**: `netstat -ano | findstr :8000` 查找并结束占用进程
- **GDAL 安装失败**: 使用预编译 wheel 文件或从非官方源安装
- **npm install 慢**: 使用国内镜像 `npm config set registry https://registry.npmmirror.com`
- **pip install 超时**: 使用清华源 `pip config set global.index-url https://pypi.tuna.tsinghua.edu.cn/simple`
- **Electron 窗口空白**: 检查 Vite 是否已启动（访问 http://localhost:5173），查看 Electron 开发者工具控制台错误
- **后端编码错误**: 确保 `PYTHONIOENCODING=utf-8` 环境变量已设置（main.py 已配置）
- **地图不显示**: 检查高德地图 API Key 配置（config.py），确保网络可访问高德服务
- **文件上传失败**: 检查开发环境下 `VITE_API_URL` 环境变量配置
