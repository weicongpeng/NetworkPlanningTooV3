# 网络规划工具 V3 - Code Wiki

## 目录

- [1. 项目概述](#1-项目概述)
- [2. 技术栈](#2-技术栈)
- [3. 项目结构](#3-项目结构)
- [4. 整体架构](#4-整体架构)
- [5. 后端架构](#5-后端架构)
- [6. 前端架构](#6-前端架构)
- [7. Electron桌面应用](#7-electron桌面应用)
- [8. 核心算法](#8-核心算法)
- [9. 关键数据模型](#9-关键数据模型)
- [10. 依赖关系](#10-依赖关系)
- [11. 移动端APP](#11-移动端app)
- [12. 项目运行方式](#12-项目运行方式)
- [13. API端点参考](#13-api端点参考)
- [14. 开发指南](#14-开发指南)

---

## 1. 项目概述

**网络规划工具 V3 (Network Planning Tool V3)** 是一个用于电信网络规划的桌面应用程序，主要面向通信工程师和网络规划人员。它提供以下核心功能：

| 功能模块 | 说明 |
|---------|------|
| **数据管理** | 上传/下载/预览Excel工参文件，支持全量工参和待规划小区文件的管理，支持工参更新对比 |
| **地图可视化** | 在线/离线地图，支持高德地图、OpenStreetMap、卫星地图，扇区可视化、MapInfo图层导入、地理化数据渲染 |
| **PCI规划** | 物理小区标识(PCI)智能分配，支持LTE/NR网络，碰撞检测，模3/模30冲突避免 |
| **邻区规划** | 基于覆盖圆算法的智能邻区推荐，支持LTE-LTE/NR-NR/NR-LTE三种规划类型 |
| **TAC规划/核查** | 跟踪区码(TAC)区域匹配与插花检测，支持图层点在面内匹配算法 |
| **许可证管理** | 许可证激活、验证、过期检查、系统时间回退检测 |

---

## 2. 技术栈

### 前端
| 技术 | 版本 | 用途 |
|------|------|------|
| React | 18.2 | UI框架 |
| TypeScript | 5.3 | 类型安全 |
| Vite | 5.0 | 构建工具 |
| Electron | 28.0 | 桌面应用容器 |
| Leaflet | 1.9 | 地图渲染 |
| Zustand | 4.4 | 状态管理 |
| Tailwind CSS | 3.3 | CSS框架 |
| Radix UI | - | 无头组件库 |
| react-i18next | - | 国际化 |

### 后端
| 技术 | 版本 | 用途 |
|------|------|------|
| FastAPI | 0.115 | Web框架 |
| Python | 3.10+ | 编程语言 |
| Pandas | 2.2+ | 数据处理 |
| NumPy | 1.26+ | 数值计算 |
| GeoPandas | 1.0+ | 地理数据处理 |
| Shapely | 2.0+ | 几何运算 |
| openpyxl | 3.1 | Excel处理 |
| pydantic | 2.9 | 数据验证 |
| websockets | 14.0 | 实时通信 |

### 移动端
| 技术 | 版本 | 用途 |
|------|------|------|
| Expo | ~52.0 | React Native开发框架 |
| React Native | 0.76.9 | 移动端UI框架 |
| TypeScript | 5.x | 类型安全 |
| react-native-amap3d | ^3.2.4 | 高德3D地图SDK |
| expo-location | - | GPS定位服务 |
| expo-speech | - | TTS语音播报 |
| WebView(react-native-webview) | - | 内嵌高德JS API地图 |
| Zustand | ^5.0.12 | 状态管理(带AsyncStorage持久化) |
| expo-navigation | - | 路线规划 |
| expo-file-system | - | 文件下载/缓存 |
| expo-sharing | - | 文件分享对话框 |

---

## 3. 项目结构

```
NetworkPlanningTooV3/
├── backend/                    # 后端 (FastAPI)
│   ├── main.py                 # 后端入口，启动uvicorn服务
│   ├── requirements.txt        # Python依赖
│   ├── app/
│   │   ├── __init__.py
│   │   ├── core/               # 核心配置
│   │   │   ├── config.py       # 全局配置(服务器/CORS/目录/密钥)
│   │   │   └── exceptions.py   # 自定义异常
│   │   ├── models/
│   │   │   └── schemas.py      # Pydantic数据模型(请求/响应)
│   │   ├── api/
│   │   │   └── v1/
│   │   │       ├── __init__.py # 路由注册
│   │   │       └── endpoints/  # API端点
│   │   │           ├── data.py       # 数据管理API
│   │   │           ├── geo_data.py   # 地理化数据API
│   │   │           ├── license.py    # 许可证API
│   │   │           ├── map.py        # 地图服务API
│   │   │           ├── neighbor.py   # 邻区规划API
│   │   │           ├── pci.py        # PCI规划API
│   │   │           ├── tac.py        # TAC规划API
│   │   │           ├── websocket.py  # WebSocket推送
│   │   │           └── system.py     # 系统信息API
│   │   ├── services/           # 业务服务层
│   │   │   ├── data_service.py         # 数据管理服务
│   │   │   ├── task_manager.py         # 异步任务管理器
│   │   │   ├── license_service.py      # 许可证服务
│   │   │   ├── tac_planning_service.py # TAC规划服务
│   │   │   ├── export_service.py       # 结果导出服务
│   │   │   ├── mapinfo_service.py      # MapInfo文件解析
│   │   │   ├── geo_data_service.py     # 地理化数据解析
│   │   │   ├── geo_field_detector.py   # 地理字段检测
│   │   │   ├── coordinate_transformer.py # 坐标转换(WGS84↔GCJ02)
│   │   │   ├── hardware_fingerprint.py  # 硬件指纹生成
│   │   │   ├── layer_type_config.py     # 图层类型配置
│   │   │   └── websocket_manager.py     # WebSocket连接管理
│   │   ├── algorithms/         # 核心算法层
│   │   │   ├── pci_planning_v1_service.py      # PCI规划算法
│   │   │   ├── neighbor_planning_v1_service.py # 邻区规划算法
│   │   │   ├── pci_collision_detector.py       # PCI碰撞检测
│   │   │   └── distance_calculator.py          # 距离计算工具
│   │   └── utils/              # 工具模块
│   └── tests/                  # 后端测试
├── frontend/                   # 前端 (React + Electron)
│   ├── package.json            # Node依赖
│   ├── electron/               # Electron主进程
│   │   ├── main.ts             # Electron入口，管理窗口/生命周期
│   │   └── preload.ts          # 预加载脚本，安全桥接
│   ├── src/
│   │   └── renderer/           # React渲染进程
│   │       ├── App.tsx         # 路由配置
│   │       ├── main.tsx        # React入口
│   │       ├── i18n.ts         # 国际化配置
│   │       ├── config/
│   │       │   └── sector-config.ts  # 扇区颜色/样式配置
│   │       ├── locales/        # 语言文件(zh/en)
│   │       ├── pages/          # 页面组件
│   │       ├── components/     # 通用组件
│   │       │   ├── Layout/     # 布局组件
│   │       │   │   └── MainLayout.tsx  # 主布局(侧边栏+内容)
│   │       │   └── Map/        # 地图组件
│   │       │       ├── OnlineMap.tsx    # 在线地图(高德/OSM)
│   │       │       ├── OfflineMap.tsx   # 离线地图
│   │       │       ├── GeoDataLayer.tsx # 地理化数据图层
│   │       │       ├── MapInfoLayer.tsx # MapInfo图层
│   │       │       ├── LayerControl.tsx # 图层控制面板
│   │       │       ├── MapToolbar.tsx   # 地图工具栏
│   │       │       ├── SectorInfoPanel.tsx # 扇区信息面板
│   │       │       ├── PCILegend.tsx    # PCI图例
│   │       │       ├── TACLegend.tsx    # TAC图例
│   │       │       └── NeighborLegend.tsx # 邻区图例
│   │       └── stores/         # Zustand状态存储
│   └── electron-builder.json   # Electron打包配置
├── mobile-app/                 # 移动端APP (Expo + React Native)
│   ├── package.json            # Node依赖
│   ├── app.json                # 应用配置
│   ├── App.tsx                 # 应用入口
│   ├── app/                    # Expo路由页面
│   │   ├── _layout.tsx         # 根布局(SafeArea+Navigation)
│   │   └── (tabs)/             # Tab导航组
│   │       ├── _layout.tsx     # Tab导航配置(4个Tab)
│   │       ├── index.tsx       # 主地图页(地图工具Tab)
│   │       ├── data.tsx        # 数据管理Tab
│   │       ├── favorites.tsx   # 收藏Tab
│   │       └── settings.tsx    # 设置Tab
│   └── src/
│       ├── components/         # 可复用组件
│       │   ├── Map/
│       │   │   ├── MapView.tsx         # WebView高德地图核心组件
│       │   │   ├── SectorInfoPanel.tsx # 底部扇区信息面板
│       │   │   └── LayerControl.tsx    # 图层控制按钮
│       │   ├── Marker/
│       │   │   └── MarkerList.tsx      # 打点列表
│       │   ├── Navigation/
│       │   │   ├── NavControl.tsx      # 导航触发按钮
│       │   │   └── NavigationPanel.tsx # 导航面板(设置+实时导航)
│       │   ├── Search/
│       │   │   └── SearchBar.tsx       # 多模式搜索栏
│       │   └── Measure/
│       │       └── MeasureControl.tsx  # 测距控制(桩)
│       ├── services/
│       │   ├── api.ts                  # 后端API服务(axios+动态URL)
│       │   ├── navigationService.ts    # 导航引擎(GPS+路线规划+TTS)
│       │   └── navi.ts                 # 遗留导航兼容层
│       ├── store/
│       │   └── mapStore.ts             # Zustand全局状态(带AsyncStorage持久化)
│       └── utils/
│           ├── config.ts               # 后端地址配置(自定义/环境/LAN发现/localhost)
│           └── coordinate.ts           # WGS84↔GCJ02坐标转换
├── uploads/                    # 上传文件目录(运行时)
├── outputs/                    # 导出文件目录(运行时)
├── data/                       # 数据索引目录(运行时)
├── licenses/                   # 许可证目录(运行时)
└── docs/                       # 文档
```

---

## 4. 整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        Electron 桌面壳                            │
│  ┌──────────────────────┐        ┌─────────────────────────────┐ │
│  │   渲染进程 (React)     │◄──────►│    主进程 (Electron)         │ │
│  │   • Vite Dev Server   │  IPC   │    • 窗口管理               │ │
│  │   • 页面路由           │◄──────►│    • 后端进程管理           │ │
│  │   • 地图渲染(Leaflet)  │        │    • 文件对话框             │ │
│  │   • Zustand状态       │        │    • GPU加速配置            │ │
│  └──────────────────────┘        └─────────────────────────────┘ │
│                                    │                              │
│                                    ▼                              │
│                          ┌──────────────────┐                     │
│                          │ FastAPI 后端服务   │                     │
│                          │ :8000             │                     │
│                          └────────┬─────────┘                     │
│                                   │                               │
└───────────────────────────────────┼───────────────────────────────┘
                                    │
          ┌─────────────────────────┼─────────────────────────┐
          │                         │                         │
          ▼                         ▼                         ▼
┌──────────────────┐      ┌──────────────────┐      ┌──────────────────┐
│ 数据管理服务      │      │ 算法引擎          │      │ 许可证服务        │
│ • Excel解析       │      │ • PCI规划         │      │ • 激活/验证      │
│ • MapInfo解析     │      │ • 邻区规划        │      │ • 硬件指纹       │
│ • 地理化数据      │      │ • TAC规划         │      │ • 过期检查       │
└──────────────────┘      └──────────────────┘      └──────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                     移动端APP (Expo)                              │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  React Native UI 层                                           ││
│  │  • Tab导航(地图/数据/收藏/设置)                                ││
│  │  • 搜索栏/扇区信息/导航面板/打点列表                          ││
│  │  • Zustand状态管理                                            ││
│  └──────────────────────┬──────────────────────────────────────┘│
│                         │                                        │
│                         ▼                                        │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  WebView 高德地图 (AMap JS API v2.0)                         ││
│  │  • WGS84→GCJ02坐标转换                                       ││
│  │  • 扇区渲染(Polygon/Circle) + 命中检测(射线法)               ││
│  │  • 测距/标记/路线/地理化数据渲染                              ││
│  │  • GPS定位 + 实时导航                                        ││
│  └──────────────────────┬──────────────────────────────────────┘│
│                         │                                        │
└─────────────────────────┼────────────────────────────────────────┘
                          │ HTTP REST API
                          ▼
              ┌──────────────────────┐
              │  FastAPI 后端服务     │ (与桌面端共享同一后端)
              │  :8000               │
              └──────────────────────┘
```

**通信方式:**
- 桌面前端 ↔ 后端: RESTful API (HTTP) + WebSocket (实时推送)
- 移动端 ↔ 后端: RESTful API (HTTP)
- 渲染进程 ↔ 主进程: Electron IPC
- 主进程 ↔ 后端: 子进程spawn启动

---

## 5. 后端架构

### 5.1 分层架构

```
┌─────────────────────────────────────────────────┐
│  API Endpoints  (app/api/v1/endpoints/)         │
│  • 接收HTTP请求，参数验证                        │
│  • 调用服务层，返回响应                           │
└────────────────────┬────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────┐
│  Services  (app/services/)                      │
│  • 业务逻辑处理                                  │
│  • 数据持久化、文件IO                            │
│  • 任务管理、许可证管理                          │
└────────────────────┬────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────┐
│  Algorithms  (app/algorithms/)                  │
│  • 核心规划算法                                  │
│  • PCI分配、邻区选择、TAC匹配                    │
│  • 距离计算、几何运算                            │
└─────────────────────────────────────────────────┘
```

### 5.2 核心服务

#### DataService (数据管理服务)
- **文件**: [data_service.py](file:///d:/mycode/NetworkPlanningTooV3/backend/app/services/data_service.py)
- **职责**: 管理Excel工参文件的上传、解析、查询、删除
- **关键方法**:
  - `upload_excel()` - 上传Excel并解析为结构化站点/小区数据
  - `get_data(data_id)` - 获取数据（带内存缓存）
  - `update_parameters()` - 工参更新，合并现网数据到全量工参
  - `_scan_uploads_directory()` - 后台扫描uploads目录重建索引

#### TaskManager (任务管理器)
- **文件**: [task_manager.py](file:///d:/mycode/NetworkPlanningTooV3/backend/app/services/task_manager.py)
- **职责**: 管理PCI/邻区/TAC异步任务的创建、执行、进度追踪
- **关键特性**:
  - 支持任务持久化到磁盘，后端重启后可恢复历史记录
  - 数据准备优化：O(1)索引查找替代O(n)嵌套循环
  - 支持前端选中小区直接规划，跳过待规划文件
- **关键方法**:
  - `create_pci_task()` / `create_neighbor_task()` / `create_tac_task()` - 创建规划任务
  - `get_task_progress()` / `get_task_result()` - 查询任务状态
  - `export_result()` - 导出结果为xlsx/csv

#### LicenseService (许可证服务)
- **文件**: [license_service.py](file:///d:/mycode/NetworkPlanningTooV3/backend/app/services/license_service.py)
- **职责**: 许可证加密验证、激活、过期检查
- **安全机制**:
  - Fernet对称加密 + HMAC-SHA256签名
  - 硬件指纹绑定（CPU/主板/MAC）
  - 系统时间回退检测

#### TACPlanningService (TAC规划服务)
- **文件**: [tac_planning_service.py](file:///d:/mycode/NetworkPlanningTooV3/backend/app/services/tac_planning_service.py)
- **职责**: TAC区域匹配与插花检测
- **算法**:
  - 点在面内匹配：读取TAC图层(.TAB)构建STRtree空间索引，小区坐标与TAC多边形匹配
  - 插花检测：BallTree空间索引 + 距离加权投票算法

### 5.3 配置系统

**文件**: [config.py](file:///d:/mycode/NetworkPlanningTooV3/backend/app/core/config.py)

通过 `pydantic-settings` 从环境变量/.env文件读取配置，支持热更新：

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `NPT_HOST` | `0.0.0.0` | 服务监听地址 |
| `NPT_PORT` | `8000` | 服务端口 |
| `NPT_CORS_ORIGINS` | `http://localhost:5173,...` | CORS允许的来源 |
| `NPT_LICENSE_SECRET_KEY` | (内置) | 许可证加密密钥 |
| `NPT_MAX_TASKS` | `10` | 最大并发任务数 |
| `NPT_TASK_TIMEOUT` | `3600` | 任务超时(秒) |
| `DEFAULT_PCI_DISTANCE_THRESHOLD` | `3.0` | PCI复用距离(km) |
| `DEFAULT_NEIGHBOR_MAX_COUNT` | `32` | 每小区最大邻区数 |

---

## 6. 前端架构

### 6.1 页面路由

```
/                  → HomePage (首页仪表盘)
/data              → DataPage (数据管理: 上传/列表/预览)
/pci               → PCIPage (PCI规划: 配置/执行/结果)
/neighbor          → NeighborPage (邻区规划: 配置/执行/结果)
/tac               → TACPage (TAC核查: 执行/结果/插花分析)
/tac-planning      → TACPlanningPage (TAC规划: 数据驱动型)
/map               → MapPage (地图可视化: 在线/离线/图层)
/license           → LicensePage (许可证管理)
```

### 6.2 状态管理

使用 **Zustand** 进行全局状态管理，主要store包括：

| Store | 职责 |
|-------|------|
| `useAuthStore` | 许可证状态、授权检查 |
| `useDataStore` | 上传的数据列表、当前选中数据 |
| `useMapStore` | 地图中心点、缩放级别、图层可见性 |
| `usePCIStore` | PCI规划配置、结果 |
| `useNeighborStore` | 邻区规划配置、结果 |
| `useWebSocketStore` | WebSocket连接状态、任务订阅 |

### 6.3 地图组件体系

```
MapPage
├── MapToolbar (工具栏: 图层切换/框选/点选/多边形选择)
├── OnlineMap / OfflineMap (地图容器)
│   ├── GeoDataLayer (地理化数据渲染: 点/扇区/多边形)
│   ├── MapInfoLayer (MapInfo导入图层)
│   ├── SectorInfoPanel (点击扇区弹出信息面板)
│   ├── PCILegend (PCI规划结果图例)
│   ├── TACLegend (TAC规划结果图例)
│   └── NeighborLegend (邻区规划结果图例)
└── LayerControl (图层控制面板)
```

**地图特性**:
- Leaflet + react-leaflet 作为地图渲染引擎
- 支持高德地图(需API Key)、OpenStreetMap、卫星地图
- 扇区渲染：自定义Leaflet DivIcon + Canvas绘制扇形
- 框选/点选/多边形选择：Leaflet.draw 插件
- 坐标转换：WGS84 ↔ GCJ02 (高德坐标)

### 6.4 国际化

支持中文(zh)和英文(en)双语，通过 `react-i18next` 实现：
- 语言文件位于 `src/renderer/locales/`
- 侧边栏导航、页面标题、表单标签均已国际化

---

## 7. Electron桌面应用

### 7.1 主进程 (main.ts)

**文件**: [main.ts](file:///d:/mycode/NetworkPlanningTooV3/frontend/electron/main.ts)

**核心职责**:
1. **窗口管理**: 创建BrowserWindow，1400x900，支持暗色主题
2. **后端进程管理**: 生产环境通过 `spawn` 启动Python FastAPI后端，开发环境跳过(由外部启动)
3. **IPC通信**: 提供文件对话框、文件读取等原生能力桥接
4. **GPU加速**: 启用GPU光栅化、零拷贝、4线程光栅、4GB内存限制
5. **后端健康检查**: 启动后轮询 `:8000/docs` 等待后端就绪(最长10s)

### 7.2 预加载脚本 (preload.ts)

**职责**: 在安全隔离的context中暴露 `window.electronAPI` 给渲染进程，支持：
- `appVersion` / `appPath` / `isDev` - 应用信息
- `openFile` / `saveFile` / `selectDirectory` - 文件对话框
- `readFile` - 文件读取

### 7.3 开发/生产模式

| 特性 | 开发模式 | 生产模式 |
|------|---------|---------|
| 前端URL | `http://127.0.0.1:5173` | 加载本地 `dist-renderer/index.html` |
| 后端启动 | 外部启动(由bat脚本) | Electron内spawn启动 |
| DevTools | 自动打开 | 关闭 |
| 后端路径 | `../backend` | `resources/app/backend` |

---

## 8. 核心算法

### 8.1 PCI规划算法

**文件**: [pci_planning_v1_service.py](file:///d:/mycode/NetworkPlanningTooV3/backend/app/algorithms/pci_planning_v1_service.py)

**类**: `LTENRPCIPlanner`

**算法流程** (6阶段优先级递进):

```
阶段1: 满足模值约束 + 复用距离约束 (最优)
  ↓ 失败
阶段2: 推荐mod3 + 降低复用距离要求
  ↓ 失败
阶段3: 不使用特定模值 + 保持复用距离
  ↓ 失败
阶段4: 不使用特定模值 + 逐步降低复用距离
  ↓ 失败
阶段5: 遍历所有PCI，选择满足同站约束的最佳PCI
  ↓ 失败
阶段6: 兜底方案，选择距离最大的PCI
```

**核心约束**:
1. **硬约束**: 同站同频小区不能使用相同PCI (任何阶段都不能违反)
2. **模值约束**: LTE模3，NR模30+模3双约束
3. **复用距离**: 同频同PCI小区间距离 ≥ 阈值(默认3km)
4. **分布均衡**: 优选复用距离接近阈值的PCI

**关键方法**:
- `assign_pci()` - 单小区PCI分配 (6阶段策略)
- `get_reuse_compliant_pcis()` - 获取满足约束的PCI列表
- `find_pci_conflicts()` - 查找同频PCI冲突
- `get_same_site_cells()` - 识别同站点小区 (ID+经纬度匹配)

**性能优化**:
- 按频点预分组 (`all_cells_by_freq`)，缩小搜索范围
- 向量化距离计算 (Haversine公式)
- 规划完成后重新计算准确的最小复用距离

### 8.2 邻区规划算法

**文件**: [neighbor_planning_v1_service.py](file:///d:/mycode/NetworkPlanningTooV3/backend/app/algorithms/neighbor_planning_v1_service.py)

**类**: `NeighborPlanner`

**筛选流程** (4步骤):

```
步骤1: 距离优先 (强制邻区)
  • 室外-室外: 300米内
  • 室分-室外/室外-室分: 160米内
  ↓
步骤2: 覆盖圆相交判断
  • 计算各小区覆盖圆圆心和半径
  • 判断覆盖圆是否相交
  ↓
步骤3: 站间距筛选
  • 距离 < 1.8 × 平均站间距
  • 站间距计算排除室分小区
  ↓
步骤4: 兜底补充 (站点稀疏时)
  • 候选邻区 < 4个时触发
  • 补充距离 ≤ 平均站间距的小区
```

**评分函数**:
- 对打邻区 (目标小区背向与主小区方位角差小): 额外加分
- 内向邻区: 评分打折
- 距离越近评分越高
- 方向角匹配度越好评分越高

**关键方法**:
- `plan_neighbors_for_cell()` - 单小区邻区规划 (4步筛选)
- `calculate_coverage_circle_center()` - 覆盖圆圆心计算
- `calculate_site_spacing()` - 站间距计算 (取最近5个室外站平均)
- `calculate_neighbor_score()` - 邻区评分

### 8.3 TAC规划算法

**文件**: [tac_planning_service.py](file:///d:/mycode/NetworkPlanningTooV3/backend/app/services/tac_planning_service.py)

**类**: `TACPlanningService`

**两种模式**:
1. **核查模式** (`plan_tac`): 基于现网工参，匹配TAC图层 + 插花检测
2. **规划模式** (`plan_tac_for_list`): 基于待规划小区清单，匹配TAC区域

**匹配算法**:
- 读取TAC图层文件 (.TAB格式)
- 构建 STRtree 空间索引加速查询
- 小区坐标与TAC多边形进行点在面内匹配

**插花检测** (`check_tac_singularity`):
- 构建BallTree空间索引
- 搜索半径内(默认1.5km)邻区TAC加权投票
- 异常TAC判定: 与周围大多数不同的小区

---

## 9. 关键数据模型

### 9.1 数据结构

```
SiteData (站点)
├── id: string          # 站点ID
├── name: string        # 站点名称
├── longitude: number   # 经度
├── latitude: number    # 纬度
├── networkType: "LTE" | "NR"
├── pci?: number
├── earfcn?: number
└── sectors: SectorData[]

SectorData (小区)
├── id: string          # 小区ID
├── siteId: string      # 所属站点ID
├── name: string        # 小区名称
├── longitude: number   # 经度
├── latitude: number    # 纬度
├── azimuth: number     # 方位角
├── pci?: number        # PCI
├── earfcn?: number     # 频点
├── cell_cover_type: 1|4 # 1=室外, 4=室内
└── is_shared?: string  # 是否共享
```

### 9.2 规划配置模型

**PCIConfig**:
| 字段 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `networkType` | `LTE`/`NR` | - | 网络类型 |
| `distanceThreshold` | float | 3.0 | 复用距离(km) |
| `pciModulus` | int | 3 | PCI模数 |
| `inheritModulus` | bool | false | 继承原模值 |
| `pciRange` | `{min,max}` | null | 自定义PCI范围 |
| `enableTACPlanning` | bool | false | 同步TAC规划 |
| `selectedCellIds` | `string[]` | null | 选中小区ID |

**NeighborConfig**:
| 字段 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `planningType` | string | "LTE-LTE" | 规划类型 |
| `maxNeighbors` | int | 32 | 每小区最大邻区数 |
| `coverageDistanceFactor` | float | 0.56 | 覆盖圆距离系数 |
| `coverageRadiusFactor` | float | 0.56 | 覆盖圆半径系数 |
| `selectedCellIds` | `string[]` | null | 选中小区ID |

### 9.3 任务状态流转

```
PENDING → PROCESSING → COMPLETED
                      → FAILED
```

---

## 10. 依赖关系

### 10.1 模块依赖图

```
main.py
└── app/api/__init__.py (create_app)
    ├── app/api/v1/__init__.py (api_router)
    │   ├── endpoints/data.py ──► data_service
    │   ├── endpoints/pci.py ───► task_manager ──► pci_planning_v1_service
    │   ├── endpoints/neighbor.py ─► task_manager ──► neighbor_planning_v1_service
    │   ├── endpoints/tac.py ───► task_manager ──► tac_planning_service
    │   ├── endpoints/map.py ───► data_service, mapinfo_service
    │   ├── endpoints/license.py ─► license_service
    │   ├── endpoints/geo_data.py ─► geo_data_service
    │   └── endpoints/websocket.py ─► websocket_manager
    └── app/core/config.py (settings)
```

### 10.2 后端依赖 (requirements.txt)

```
fastapi==0.115.0          # Web框架
uvicorn[standard]==0.32.0 # ASGI服务器
pandas>=2.2.0             # 数据处理
numpy>=1.26.3             # 数值计算
geopandas>=1.0.1          # 地理数据
shapely>=2.0.6            # 几何运算
openpyxl==3.1.2           # Excel读写
pydantic==2.9.0           # 数据验证
pydantic-settings==2.6.0  # 配置管理
cryptography==43.0.1      # 加密(许可证)
aiofiles==24.1.0          # 异步文件IO
websockets==14.0          # WebSocket
python-multipart==0.0.12  # 文件上传
pytest==8.3.0             # 测试
```

### 10.3 前端依赖 (package.json)

```
react ^18.2.0                    # UI框架
react-router-dom ^6.20.0         # 路由
axios ^1.6.0                     # HTTP客户端
zustand ^4.4.0                   # 状态管理
leaflet ^1.9.4                   # 地图库
react-leaflet ^4.2.1             # React地图组件
@radix-ui/*                      # 无头UI组件
lucide-react ^0.294.0            # 图标库
tailwindcss ^3.3.6               # CSS框架
electron ^28.0.0                 # 桌面容器
electron-builder ^24.9.0         # 打包工具
```

---

## 11. 移动端APP

### 11.1 概述

移动端APP是一个基于 **Expo + React Native** 的跨平台移动应用，应用名称为"**工参地图**"，包名为 `com.networkplanning.mobile`，目前仅支持 **Android** 平台。它与桌面端**共享同一个 FastAPI 后端**，提供了地图查看、小区搜索、测距、导航、打点收藏等核心功能的移动端实现。

### 11.2 页面导航

应用采用 **Expo Router** 基于文件的路由系统，底部包含4个Tab：

| Tab | 路由 | 图标 | 说明 |
|-----|------|------|------|
| 地图工具 | `app/(tabs)/index.tsx` | 🗺️ | 主地图页面，包含地图渲染、搜索、测距、导航、图层控制等核心功能 |
| 数据管理 | `app/(tabs)/data.tsx` | 📊 | 数据上传/下载/预览管理 |
| 收藏 | `app/(tabs)/favorites.tsx` | ⭐ | 查看和管理收藏的小区/标记 |
| 设置 | `app/(tabs)/settings.tsx` | ⚙️ | 后端地址配置、应用设置 |

### 11.3 核心组件

#### MapView (WebView高德地图核心组件)

**文件**: [mobile-app/src/components/Map/MapView.tsx](file:///d:/mycode/NetworkPlanningTooV3/mobile-app/src/components/Map/MapView.tsx)

采用 **WebView + 高德地图 JS API v2.0** 方案，而非原生高德地图SDK。地图在一个内嵌的HTML页面中渲染，通过 `postMessage` 与React Native层通信。

**核心特性**:

| 特性 | 实现方式 |
|------|---------|
| 扇区渲染 | 室外小区使用 Polygon 绘制扇形，室内小区(`cell_cover_type=4`)使用 Circle 绘制 |
| 坐标系转换 | HTML模板内置 WGS84→GCJ02 转换函数，后端返回的WGS84坐标在WebView中自动转换 |
| 点击命中检测 | 使用**射线法**(Ray Casting Algorithm)进行多边形命中判断，室外扇区容错半径120米 |
| 触摸事件处理 | DOM `touchend` 事件区分 tap/drag/longpress，避免移动端AMap overlay click不可靠问题 |
| 标记渲染 | 自定义DivIcon，支持站点/小区不同样式，带名称标签 |
| 测距功能 | 点击地图添加测距点，显示距离线段和总距离 |
| 搜索标记 | 搜索结果的临时标记(黄色星标) |
| 路线显示 | 导航路线Polyline + 起点/终点/途经点标记 |
| 用户位置 | 蓝色圆点标记实时GPS位置 |
| TAB图层 | 通过后端 `loadMobileRenderData` 预处理的GeoJSON数据，支持Point/LineString/Polygon/MultiPolygon |
| 地理化数据 | GeoJSON格式渲染，支持自定义样式(颜色/描边/填充) |
| Auto-fit | 5秒无操作自动恢复定位视图，通过 `startAutoFit()`/`stopAutoFit()` 控制 |
| 卫星图层 | 通过高德地图 `Satellite` 图层切换 |

**MapView Ref接口**:
```
moveCamera(lat, lng, zoom)        // 移动相机到指定位置
addRoute(coords)                   // 添加导航路线
clearRoute()                       // 清除路线
updateUserLocation(lat, lng)       // 更新用户GPS位置
fitRouteBounds()                   // 自动缩放适应路线边界
startAutoFit() / stopAutoFit()    // 控制自动恢复定位
injectJavaScript(code)            // 注入任意JS代码
```

#### SectorInfoPanel (底部扇区信息面板)

**文件**: [mobile-app/src/components/Map/SectorInfoPanel.tsx](file:///d:/mycode/NetworkPlanningTooV3/mobile-app/src/components/Map/SectorInfoPanel.tsx)

Modal底部弹出面板，显示选中小区的详细信息：
- 基本信息：名称、站点ID、小区ID、经纬度
- 射频参数：方位角(azimuth)、波束宽度(beamwidth)、高度(height)
- 网络参数：PCI、TAC、频率、EARFCN、SSB、MCC/MNC
- 覆盖类型：`cell_cover_type` (1=室外, 4=室内)
- 共享标识：`is_shared`
- 提供**复制剪贴板**功能

#### NavigationPanel (导航面板)

**文件**: [mobile-app/src/components/Navigation/NavigationPanel.tsx](file:///d:/mycode/NetworkPlanningTooV3/mobile-app/src/components/Navigation/NavigationPanel.tsx)

支持两种状态：

1. **设置模式**: 选择出行方式(驾车/步行/骑行)、显示起点/终点、路线预览(距离/时长)、"开始导航"按钮
2. **导航中模式**: 实时显示剩余距离、已用时间、预计剩余时间、下一步指令，支持折叠/展开(`LayoutAnimation`)

#### SearchBar (多模式搜索栏)

**文件**: [mobile-app/src/components/Search/SearchBar.tsx](file:///d:/mycode/NetworkPlanningTooV3/mobile-app/src/components/Search/SearchBar.tsx)

支持三种搜索模式，通过300ms防抖优化：

| 模式 | 搜索源 | 说明 |
|------|--------|------|
| 地点 | 高德POI API (通过后端代理) | 搜索兴趣点、地址、建筑物等 |
| 小区 | 后端 `/search-parameter` API | 按名称/ID/PCI/TAC等参数搜索小区 |
| 坐标 | 本地解析 | 解析经纬度坐标，支持多种格式 |

结果通过 `FlatList` 下拉列表展示。

#### MarkerList (打点列表)

**文件**: [mobile-app/src/components/Marker/MarkerList.tsx](file:///d:/mycode/NetworkPlanningTooV3/mobile-app/src/components/Marker/MarkerList.tsx)

显示所有已放置的打点标记，每个标记支持：
- 点击编辑名称
- 收藏/取消收藏 (☆/★)
- 导航到此标记
- 删除标记

### 11.4 状态管理

**文件**: [mobile-app/src/store/mapStore.ts](file:///d:/mycode/NetworkPlanningTooV3/mobile-app/src/store/mapStore.ts)

使用 **Zustand** + `persist` 中间件实现全局状态管理，收藏数据通过 **AsyncStorage** 持久化。

**核心状态**:

| 状态 | 类型 | 说明 |
|------|------|------|
| `backendIp` | string | 后端服务地址 |
| `mapType` | string | 地图类型(roadmap/satellite) |
| `layers` | object | 图层可见性(lte/nr/tab/geoData) |
| `lteSectors` | array | LTE小区列表 |
| `nrSectors` | array | NR小区列表 |
| `selectedSector` | object | 当前选中小区(触发SectorInfoPanel) |
| `markers` | array | 打点标记列表 |
| `favorites` | array | 收藏列表(持久化) |
| `measurePoints` | array | 测距点列表 |
| `measureTotalDistance` | number | 测距总距离(米) |
| `measureFinished` | boolean | 测距是否完成 |
| `searchMarker` | object | 搜索结果标记 |
| `focusLocation` | object | 焦点位置(搜索后定位) |
| `pendingNavi` | object | 待导航目标(触发NavigationPanel) |
| `isNavigating` | boolean | 是否正在导航中 |
| `userLocation` | object | 用户实时GPS位置 |
| `connectionInfo` | object | 后端连接信息 |
| `isMarkerMode` | boolean | 是否处于打点模式 |
| `isCoordinateMode` | boolean | 是否处于坐标输入模式 |

**核心Action**:
- `setBackendIp()` / `connectBackend()` - 后端地址设置与连接
- `loadSectors(dataId)` - 加载扇区数据(调用 `api.getMobileRenderData`)
- `toggleLayer()` - 切换图层可见性
- `addMarker()` / `removeMarker()` / `clearMarkers()` - 打点管理
- `addFavorite()` / `removeFavorite()` / `clearFavorites()` - 收藏管理
- `addMeasurePoint()` / `clearMeasurePoints()` - 测距管理
- `setSelectedSector()` - 选中小区
- `setPendingNavi()` - 设置待导航目标
- `resetMap()` - 重置地图状态

### 11.5 API服务

**文件**: [mobile-app/src/services/api.ts](file:///d:/mycode/NetworkPlanningTooV3/mobile-app/src/services/api.ts)

封装所有后端API调用，支持**运行时动态切换后端地址**(每次请求从AsyncStorage读取最新地址)：

| 方法 | API端点 | 说明 |
|------|---------|------|
| `getSystemInfo()` | `GET /system/info` | 获取系统信息 |
| `getMobileRenderData(dataId)` | `GET /map/mobile-render-data` | 获取移动端渲染数据(含扇区+TAB图层预处理) |
| `searchParameter(dataId, keyword)` | `POST /search-parameter` | 按参数搜索小区 |
| `searchPlace(keyword, city)` | `POST /map/direction` | 地点搜索(通过高德API代理) |
| `downloadData(dataId, type)` | `GET /download/{dataId}/{type}` | 下载数据文件到本地缓存 |
| `shareData(dataId)` | `POST /share/{dataId}` | 分享数据(调用系统分享面板) |
| `getDataPreview(dataId)` | `GET /data/{dataId}/preview` | 数据预览 |
| `deleteData(dataId)` | `DELETE /data/{dataId}` | 删除数据 |

### 11.6 后端地址自动发现机制

**文件**: [mobile-app/src/utils/config.ts](file:///d:/mycode/NetworkPlanningTooV3/mobile-app/src/utils/config.ts)

支持四级优先级自动发现后端地址：

```
1. 自定义地址 (AsyncStorage存储的用户设置)
      ↓ (未设置)
2. 环境变量 (REACT_NATIVE_BACKEND_URL)
      ↓ (未设置)
3. LAN IP自动发现 (Expo dev server hostUri)
      ↓ (不可用)
4. localhost 回退 (http://10.0.2.2:8000 - Android模拟器)
```

提供 `testConnection(url)` 工具函数，连接时自动尝试 `http` 和 `https` 两种协议。

### 11.7 导航引擎

**文件**: [mobile-app/src/services/navigationService.ts](file:///d:/mycode/NetworkPlanningTooV3/mobile-app/src/services/navigationService.ts)

核心导航引擎，提供完整的实时导航功能：

| 功能 | 实现 |
|------|------|
| GPS定位 | `expo-location` 获取权限 + 实时位置追踪 |
| 路线规划 | 通过后端代理调用高德路径规划API |
| 步骤进度追踪 | 计算用户位置与路线polyline的最近点，判断是否到达下一个导航步骤 |
| TTS语音播报 | `expo-speech` 播放步骤指令(转弯、直行、到达等) |
| 到达检测 | 距离目的地 < 50米时判定为到达 |
| 状态快照 | 支持回调订阅导航状态变化(设置中/导航中/已到达) |

### 11.8 坐标系处理

**文件**: [mobile-app/src/utils/coordinate.ts](file:///d:/mycode/NetworkPlanningTooV3/mobile-app/src/utils/coordinate.ts)

| 转换方向 | 算法 |
|---------|------|
| WGS84 → GCJ02 | 标准中国GPS偏移算法(基于椭球体参数) |
| GCJ02 → WGS84 | 5次迭代近似逆解算法 |

**使用场景**:
- 后端返回的小区坐标为 **WGS84**，在 WebView 中转换为 GCJ02 后叠加到高德地图
- GPS定位获取的为 **GCJ02**(iOS) 或 **WGS84**(Android)，根据平台做相应转换
- 导航路线坐标为 **GCJ02**，直接使用

### 11.9 与桌面端的关系

| 维度 | 桌面端 | 移动端 |
|------|--------|--------|
| 后端服务 | 共享同一FastAPI后端(:8000) | 共享同一FastAPI后端(:8000) |
| 地图引擎 | Leaflet(React) | WebView + 高德地图JS API |
| 状态管理 | Zustand(多个store) | Zustand(统一mapStore) |
| 扇区渲染 | Canvas + Leaflet DivIcon | HTML Polygon/Circle + 命中检测 |
| 坐标预处理 | 前端直接转换 | WebView内JS转换 |
| 数据渲染 | 前端渲染TAB/GeoJSON | 后端预处理(`loadMobileRenderData`)后渲染 |
| 核心算法 | 本地执行(PCI/邻区/TAC规划) | 无规划功能，仅数据查看 |

### 11.10 构建和部署

**开发模式**:
```bash
cd mobile-app
npm install
npx expo start          # 启动Expo dev server
npx expo run:android    # 在Android模拟器/真机上运行
```

**生产构建**(EAS Build):
```bash
eas build --platform android --profile production
```

**应用配置** ([app.json](file:///d:/mycode/NetworkPlanningTooV3/mobile-app/app.json)):
- 应用名称: "工参地图"
- 包名: `com.networkplanning.mobile`
- 平台: Android only
- 权限: `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`
- 高德地图Key: 通过环境变量或config配置

---

## 12. 项目运行方式

### 12.1 环境要求

| 组件 | 要求 |
|------|------|
| Node.js | 18+ |
| npm | 9+ |
| Python | 3.10+ |
| pip | 23+ |
| 操作系统 | Windows (主要支持), 可选Linux/macOS |

### 11.2 安装步骤

```bash
# 1. 安装后端依赖
cd backend
pip install -r requirements.txt

# 2. 安装前端依赖
cd frontend
npm install
```

### 11.3 开发模式

**启动后端**:
```bash
cd backend
python main.py
# 服务运行在 http://127.0.0.1:8000
# API文档: http://127.0.0.1:8000/docs
```

**启动前端**:
```bash
cd frontend
npm run dev
# Vite开发服务器: http://127.0.0.1:5173
# Electron窗口自动启动
```

**拆分启动** (推荐调试):
```bash
# 终端1: 启动Vite
npm run dev:vite

# 终端2: 启动Electron
npm run dev:electron
```

### 11.4 生产构建

```bash
# 1. 构建前端
cd frontend
npm run build

# 2. 后端可直接运行
cd backend
python main.py

# 或使用Docker
docker build -t npt-backend -f backend/Dockerfile .
docker build -t npt-frontend -f frontend/Dockerfile .
```

### 11.5 Electron打包

```bash
cd frontend
# 构建Electron可执行文件
npx electron-builder
```

### 11.6 目录结构(运行时)

运行后自动创建以下目录:
```
uploads/    # 用户上传的Excel/MapInfo文件
outputs/    # 规划结果导出文件
data/       # 数据索引(index.json)
licenses/   # 许可证文件
exports/    # 额外导出目录
```

---

## 13. API端点参考

### 13.1 数据管理 `/api/v1/data`

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/upload/excel` | 上传Excel工参 |
| POST | `/upload/map` | 上传MapInfo文件 |
| GET | `/list` | 获取数据列表(分页) |
| GET | `/{data_id}/preview` | 预览数据 |
| DELETE | `/{data_id}` | 删除数据 |
| POST | `/update` | 工参更新 |
| GET | `/template/{type}` | 下载模板文件 |

### 13.2 PCI规划 `/api/v1/pci`

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/plan` | 启动PCI规划任务 |
| GET | `/progress/{task_id}` | 获取任务进度 |
| GET | `/result/{task_id}` | 获取规划结果 |
| POST | `/export/{task_id}` | 导出结果 |
| POST | `/cancel/{task_id}` | 取消任务 |
| POST | `/apply/{task_id}` | 应用到工参 |

### 13.3 邻区规划 `/api/v1/neighbor`

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/plan` | 启动邻区规划 |
| GET | `/progress/{task_id}` | 获取进度 |
| GET | `/result/{task_id}` | 获取结果 |
| POST | `/export/{task_id}` | 导出结果 |

### 13.4 TAC规划 `/api/v1/tac`

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/plan` | 启动TAC核查 |
| POST | `/planning` | 启动TAC规划(数据驱动) |
| GET | `/progress/{task_id}` | 获取进度 |
| GET | `/result/{task_id}` | 获取结果 |
| POST | `/export/{task_id}` | 导出结果 |

### 13.5 地图服务 `/api/v1/map`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/data` | 获取地图数据(边界框筛选) |
| GET | `/cells` | 获取小区列表 |
| GET | `/online-config` | 获取在线地图配置 |
| POST | `/direction` | 路径规划(高德代理) |

### 13.6 许可证 `/api/v1/license`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/status` | 获取许可证状态 |
| POST | `/upload` | 上传许可证文件 |
| POST | `/activate` | 密钥激活 |
| GET | `/check` | 有效性检查 |

### 13.7 WebSocket `/api/v1/ws/tasks`

**协议**:
- 连接: `ws://host:8000/api/v1/ws/tasks`
- 订阅: `{"action": "subscribe", "task_id": "xxx"}`
- 取消: `{"action": "unsubscribe", "task_id": "xxx"}`
- 心跳: `{"action": "ping"}`
- 响应: `{"action": "progress", "task_id": "xxx", "data": {...}}`

---

## 14. 开发指南

### 14.1 添加新的规划功能

1. **定义数据模型**: 在 `schemas.py` 中添加 Pydantic 模型
2. **实现算法**: 在 `algorithms/` 中编写核心逻辑
3. **创建服务**: 在 `services/` 中封装业务逻辑
4. **注册任务**: 在 `task_manager.py` 中添加任务类型
5. **创建API端点**: 在 `endpoints/` 中添加路由
6. **前端页面**: 在 `pages/` 中创建React页面

### 14.2 测试

```bash
# 后端测试
cd backend
pytest

# 前端类型检查
cd frontend
npm run type-check

# 前端lint
npm run lint
```

### 14.3 编码规范

- **后端**: 使用 pydantic 进行数据验证，async/await 处理异步操作
- **前端**: TypeScript 严格模式，React 函数组件 + Hooks
- **命名**: 后端 snake_case，前端 camelCase
- **错误处理**: 后端使用自定义异常类，前端使用 toast 提示

### 14.4 调试技巧

- 后端热重载: `main.py` 默认开启 `reload=True`
- 前端DevTools: Electron开发模式自动打开Chrome DevTools
- API文档: 访问 `http://127.0.0.1:8000/docs` 使用Swagger UI
- 日志: 后端使用 `logging` 模块，前端使用 `console.log`
