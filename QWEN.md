# 网络规划工具 V3 (Network Planning Tool V3) - 开发上下文

## 项目概述

这是一个基于 Electron + React + FastAPI 的电信网络规划工具，主要用于网络的 PCI 规划、邻区规划和地图可视化。该工具提供了一个完整的桌面应用程序，具有现代化的用户界面和强大的后端处理能力。

### 核心功能
- **数据管理**: Excel 工参文件的上传、下载、预览和对比
- **地图可视化**: 在线/离线地图支持，扇区可视化，MapInfo 图层管理
- **PCI 规划**: PCI 碰撞检测，智能规划算法
- **邻区规划**: 邻区关系分析，智能规划
- **许可证管理**: 许可证激活和验证

### 技术栈
- **前端**: React 18, TypeScript, Vite, Tailwind CSS, Electron 28
- **后端**: FastAPI (Python 3.10+), Pandas, GeoPandas, Shapely
- **地图**: Leaflet, GeoJSON
- **状态管理**: Zustand
- **UI 组件**: Radix UI, Lucide React

## 项目结构

```
NetworkPlanningTooV3/
├── backend/                # FastAPI 后端
│   ├── app/
│   │   ├── algorithms/     # 核心算法模块
│   │   ├── api/            # API 接口定义
│   │   ├── core/           # 核心配置
│   │   ├── models/         # 数据模型
│   │   └── services/       # 业务逻辑服务
│   └── main.py             # 后端入口文件
├── frontend/               # Electron + React 前端
│   ├── src/
│   │   ├── renderer/       # React 渲染进程代码
│   │   └── test/           # 测试代码
│   └── package.json        # 前端依赖配置
├── scripts/                # 构建和部署脚本
├── shared/                 # 前后端共享类型定义
├── tests/                  # 测试代码
├── uploads/                # 用户上传文件目录
├── outputs/                # 输出文件目录
├── data/                   # 数据文件目录
├── licenses/               # 许可证文件目录
├── 待规划小区/             # 特定数据目录
├── 全量工参/               # 特定数据目录
└── 输出文件/               # 特定输出目录
```

## 开发环境设置

### 后端 (Python)
1. 导航到 `backend` 目录
2. 安装依赖: `pip install -r requirements.txt`
3. 启动服务: `python main.py` (监听 127.0.0.1:8000)

关键依赖包括:
- FastAPI 0.115.0
- Uvicorn 0.32.0
- Pandas 2.2.0
- GeoPandas 1.0.1
- GDAL 3.8.4
- Shapely 2.0.6

### 前端 (Node.js)
1. 导航到 `frontend` 目录
2. 安装依赖: `npm install`
3. 启动开发模式: `npm run dev`

关键依赖包括:
- React 18.2.0
- Electron 28.0.0
- Vite 5.0.0
- Leaflet 1.9.4
- Zustand 4.4.0

## 运行项目

### 开发模式
使用批处理脚本启动整个应用:
```bash
start_electron_app.bat
```

这将:
1. 编译 Electron TypeScript 代码
2. 启动后端 FastAPI 服务 (端口 8000)
3. 启动 Vite 开发服务器 (端口 5173)
4. 启动 Electron 应用

### Docker 部署
使用 docker-compose 同时运行前后端:
```bash
docker-compose up -d
```

## API 端点

后端提供 RESTful API 接口:
- **Swagger UI**: http://127.0.0.1:8000/docs
- **ReDoc**: http://127.0.0.1:8000/redoc

主要 API 分组:
- `/api/v1/data/*` - 数据管理
- `/api/v1/map/*` - 地图管理
- `/api/v1/pci/*` - PCI 规划
- `/api/v1/neighbor/*` - 邻区规划
- `/api/v1/license/*` - 许可证管理

## 核心概念

### 数据模型
- **工参数据**: 电信基站参数，包括经纬度、方位角、频段等
- **地理化数据**: 经过地理处理的数据，用于地图可视化
- **规划结果**: PCI 和邻区规划的输出结果

### 算法模块
- **PCI 规划算法**: 基于距离的碰撞检测和智能分配
- **邻区规划算法**: 基于距离和方位角的邻区关系分析

### 地图可视化
- 使用 Leaflet 实现地图展示
- 支持 GeoJSON 格式的地理数据
- 提供扇区可视化和交互功能

## 开发注意事项

### Windows 编码问题
后端 `main.py` 文件中包含了专门的编码处理代码，以解决 Windows 下的 GBK 编码问题。在开发过程中需要注意编码一致性。

### 数据处理
由于涉及大量地理数据处理，后端使用了 GeoPandas 和 Shapely 库。这些库依赖 GDAL，在安装时可能需要特殊处理。

### 前后端通信
前端通过 Axios 与后端 FastAPI 服务进行通信，使用 JSON 格式交换数据。

## 测试

### 后端测试
```bash
cd backend
pytest
```

### 前端测试
```bash
cd frontend
npm run test
```

## 部署

项目支持多种部署方式:
1. **本地部署**: 直接运行后端服务和前端应用
2. **Docker 部署**: 使用 docker-compose 同时部署前后端
3. **Electron 打包**: 将前端打包为桌面应用

## 特殊文件和脚本

- `diagnose_geo_data_fix.py`: 用于诊断地理化数据修复问题的脚本
- `start_electron_app.bat`: Windows 下启动完整应用的批处理脚本
- `install-skills.bat`: 安装各种 AI 技能的批处理脚本
- `docker-compose.yml`: Docker 容器编排配置