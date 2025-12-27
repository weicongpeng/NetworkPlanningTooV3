# 项目结构说明

## 完整目录结构

```
NetworkPlanningTooV2/
├── frontend/                          # 前端代码 (Electron + React + TypeScript)
│   ├── electron/                     # Electron主进程代码
│   │   ├── main.ts                   # 主进程入口
│   │   ├── preload.ts                # 预加载脚本
│   │   └── tsconfig.json             # TypeScript配置
│   │
│   ├── src/                          # 源代码
│   │   └── renderer/                 # React渲染进程
│   │       ├── components/           # UI组件
│   │       │   └── Layout/
│   │       │       └── MainLayout.tsx    # 主布局组件
│   │       │
│   │       ├── pages/                # 页面组件
│   │       │   ├── HomePage.tsx      # 首页
│   │       │   ├── DataPage.tsx      # 数据管理页
│   │       │   ├── PCIPage.tsx       # PCI规划页
│   │       │   ├── NeighborPage.tsx  # 邻区规划页
│   │       │   ├── MapPage.tsx       # 地图浏览页
│   │       │   └── LicensePage.tsx   # 许可证管理页
│   │       │
│   │       ├── services/             # API服务层
│   │       │   └── api.ts            # Axios API封装
│   │       │
│   │       ├── store/                # 状态管理(Zustand)
│   │       │   ├── licenseStore.ts   # 许可证状态
│   │       │   └── dataStore.ts      # 数据状态
│   │       │
│   │       ├── main.tsx              # React入口
│   │       ├── App.tsx               # 根组件
│   │       └── index.css             # 全局样式
│   │
│   ├── public/                       # 静态资源
│   │   └── index.html                # HTML模板
│   │
│   ├── package.json                  # npm依赖配置
│   ├── vite.config.ts                # Vite配置
│   ├── tsconfig.json                 # TypeScript配置
│   ├── tailwind.config.js            # TailwindCSS配置
│   ├── postcss.config.js             # PostCSS配置
│   ├── electron-builder.json         # Electron打包配置
│   ├── .eslintrc.js                  # ESLint配置
│   └── .gitignore                    # Git忽略文件
│
├── backend/                          # 后端代码 (Python FastAPI)
│   ├── app/                          # 应用代码
│   │   ├── api/                      # API路由
│   │   │   ├── __init__.py           # 路由注册
│   │   │   └── v1/                   # API v1版本
│   │   │       ├── __init__.py
│   │   │       └── endpoints/        # API端点
│   │   │           ├── license.py    # 许可证API
│   │   │           ├── data.py       # 数据管理API
│   │   │           ├── pci.py        # PCI规划API
│   │   │           ├── neighbor.py   # 邻区规划API
│   │   │           └── map.py        # 地图服务API
│   │   │
│   │   ├── core/                     # 核心配置
│   │   │   └── config.py             # 应用配置
│   │   │
│   │   ├── models/                   # 数据模型
│   │   │   └── schemas.py            # Pydantic模型
│   │   │
│   │   ├── services/                 # 业务服务层
│   │   │   ├── license_service.py    # 许可证服务
│   │   │   ├── data_service.py       # 数据管理服务
│   │   │   └── task_manager.py       # 任务管理器
│   │   │
│   │   └── __init__.py
│   │
│   ├── main.py                       # FastAPI应用入口
│   ├── requirements.txt              # Python依赖
│   ├── Dockerfile                    # Docker镜像配置
│   ├── .env.example                  # 环境变量示例
│   └── .gitignore                    # Git忽略文件
│
├── shared/                           # 前后端共享类型定义
│   └── types.ts                      # TypeScript类型定义
│
├── tests/                            # 测试代码
│   └── integration/                  # 集成测试
│       ├── test_api.py               # API测试
│       └── test_frontend.py          # 前端测试
│
├── scripts/                          # 构建和部署脚本
│   ├── build-backend.sh              # 后端构建脚本
│   ├── build-frontend.sh             # 前端构建脚本
│   ├── run-tests.sh                  # 运行测试脚本
│   └── package.sh                    # 打包脚本
│
├── docs/                             # 文档目录
│
├── uploads/                          # 上传文件目录
├── outputs/                          # 输出文件目录
├── data/                             # 数据存储目录
├── licenses/                         # 许可证目录
│
├── docker-compose.yml                # Docker Compose配置
├── README.md                         # 项目说明文档
├── IMPLEMENTATION_PLAN.md            # 实施计划
├── PROJECT_STRUCTURE.md              # 本文件
└── .gitignore                        # 项目级Git忽略
```

## 关键文件说明

### 前端核心文件

| 文件 | 说明 |
|------|------|
| `electron/main.ts` | Electron主进程，管理窗口生命周期和后端进程 |
| `electron/preload.ts` | 预加载脚本，暴露安全的API给渲染进程 |
| `src/renderer/App.tsx` | React根组件，配置路由 |
| `src/renderer/services/api.ts` | API服务层，封装所有后端请求 |
| `vite.config.ts` | Vite配置，包括代理设置 |

### 后端核心文件

| 文件 | 说明 |
|------|------|
| `main.py` | FastAPI应用入口 |
| `app/api/__init__.py` | 创建应用实例，配置CORS |
| `app/core/config.py` | 应用配置管理 |
| `app/services/license_service.py` | 许可证业务逻辑 |
| `app/services/data_service.py` | 数据管理业务逻辑 |
| `app/services/task_manager.py` | 异步任务管理 |

### 共享类型

| 文件 | 说明 |
|------|------|
| `shared/types.ts` | 前后端共享的TypeScript类型定义 |

## 数据流

```
┌─────────────────┐     HTTP/WebSocket     ┌─────────────────┐
│                 │ ◄────────────────────► │                 │
│   Frontend      │                        │    Backend      │
│  (Electron +    │                        │   (FastAPI)     │
│   React)        │                        │                 │
└─────────────────┘                        └─────────────────┘
       │                                            │
       │                                            │
       ▼                                            ▼
┌─────────────────┐                        ┌─────────────────┐
│   Zustand       │                        │  Pandas/        │
│   Stores        │                        │  GeoPandas      │
└─────────────────┘                        └─────────────────┘
```

## 开发工作流

1. **启动后端**: `cd backend && python main.py`
2. **启动前端**: `cd frontend && npm run dev`
3. **启动Electron**: `cd frontend && npm run dev` (自动启动所有服务)

## 技术栈总结

### 前端
- **框架**: Electron 28 + React 18
- **语言**: TypeScript 5
- **构建工具**: Vite 5
- **样式**: TailwindCSS + shadcn/ui
- **状态管理**: Zustand
- **HTTP客户端**: Axios
- **路由**: React Router

### 后端
- **框架**: FastAPI 0.115
- **服务器**: Uvicorn
- **数据处理**: Pandas + GeoPandas
- **数据验证**: Pydantic
- **异步**: asyncio

### 通信
- **REST API**: 前后端主要通信方式
- **WebSocket**: 实时任务进度推送
