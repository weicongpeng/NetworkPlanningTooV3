# 网络规划工具 (Network Planning Tool V3)

一个基于Electron + React + FastAPI的网络规划工具，用于电信网络的PCI规划、邻区规划和地图可视化。

## 功能特性

### 📊 数据管理
- 上传、下载、预览Excel工参文件
- 支持多种工参格式
- 工参更新和对比

### 🗺️ 地图可视化
- 支持在线和离线地图
- 扇区可视化和信息展示
- MapInfo图层导入和管理
- 扇区标签点击和交互

### 📶 PCI规划
- PCI碰撞检测
- 智能PCI规划算法
- PCI规划结果导出

### 🔗 邻区规划
- 邻区关系分析
- 智能邻区规划
- 邻区规划结果导出

### 📄 许可证管理
- 许可证激活和验证
- 许可证状态查看

## 技术栈

### 前端
- **框架**: React 18
- **语言**: TypeScript
- **构建工具**: Vite
- **UI框架**: Tailwind CSS
- **地图库**: Leaflet
- **状态管理**: Zustand
- **容器**: Electron 28

### 后端
- **框架**: FastAPI
- **语言**: Python 3.10+
- **数据处理**: Pandas, NumPy
- **地理数据**: GeoPandas, Shapely
- **Excel处理**: openpyxl
- **API文档**: Swagger UI (自动生成)

### 部署
- **容器化**: Docker
- **构建脚本**: Shell脚本

## 项目结构

```
NetworkPlanningTooV3/
├── backend/                # 后端代码
│   ├── app/
│   │   ├── algorithms/     # 算法模块
│   │   ├── api/            # API接口
│   │   ├── core/           # 核心配置
│   │   ├── models/         # 数据模型
│   │   └── services/       # 业务服务
│   └── main.py             # 后端入口
├── frontend/               # 前端代码
│   ├── src/
│   │   ├── renderer/       # React渲染代码
│   │   └── test/           # 测试代码
│   └── package.json        # 前端依赖
├── scripts/                # 构建脚本
├── shared/                 # 共享类型定义
├── tests/                  # 测试代码
└── uploads/                # 上传文件目录
```

## 安装和运行

### 环境要求

#### 前端
- Node.js 18+
- npm 9+

#### 后端
- Python 3.10+
- pip 23+

### 安装步骤

#### 1. 克隆项目

```bash
git clone <项目仓库地址>
cd NetworkPlanningTooV3
```

#### 2. 安装后端依赖

```bash
cd backend
pip install -r requirements.txt
```

#### 3. 安装前端依赖

```bash
cd frontend
npm install
```

### 运行项目

#### 开发模式

1. **启动后端服务**

```bash
cd backend
python main.py
```

后端服务将运行在 `http://127.0.0.1:8000`

2. **启动前端应用**

```bash
cd frontend
npm run dev
```

前端应用将启动Electron窗口，同时Vite开发服务器运行在 `http://127.0.0.1:5173`

#### 生产构建

1. **构建前端**

```bash
cd frontend
npm run build
```

2. **构建后端**

```bash
cd backend
# 可以使用Docker构建
```

## API文档

后端服务启动后，可以通过以下地址访问API文档：

- Swagger UI: http://127.0.0.1:8000/docs
- ReDoc: http://127.0.0.1:8000/redoc

## 主要API端点

### 数据管理
- `POST /api/v1/data/upload/excel` - 上传Excel工参文件
- `GET /api/v1/data/list` - 获取数据列表
- `GET /api/v1/data/{data_id}/preview` - 预览数据
- `DELETE /api/v1/data/{data_id}` - 删除数据

### 地图管理
- `POST /api/v1/map/upload` - 上传地图文件
- `GET /api/v1/map/layers` - 获取图层列表

### PCI规划
- `POST /api/v1/pci/plan` - 执行PCI规划
- `GET /api/v1/pci/result` - 获取PCI规划结果

### 邻区规划
- `POST /api/v1/neighbor/plan` - 执行邻区规划
- `GET /api/v1/neighbor/result` - 获取邻区规划结果

### 许可证管理
- `POST /api/v1/license/activate` - 激活许可证
- `GET /api/v1/license/status` - 获取许可证状态

## 核心算法

### PCI规划算法
- 基于距离的PCI碰撞检测
- 智能PCI分配算法
- 支持PCI规划版本管理

### 邻区规划算法
- 基于距离和方位角的邻区关系分析
- 智能邻区推荐算法
- 邻区规划结果优化

## 开发指南

### 前端开发

1. 启动Vite开发服务器：
   ```bash
   npm run dev:vite
   ```

2. 启动Electron开发：
   ```bash
   npm run dev:electron
   ```

3. 运行前端测试：
   ```bash
   npm run test
   ```

4. 代码 lint：
   ```bash
   npm run lint
   ```

### 后端开发

1. 启动开发服务器：
   ```bash
   python main.py
   ```

2. 运行后端测试：
   ```bash
   pytest
   ```

3. 代码格式化：
   ```bash
   black .
   ```

## 部署说明

### Docker部署

1. 构建后端镜像：
   ```bash
   docker build -t network-planning-tool-backend -f backend/Dockerfile .
   ```

2. 构建前端镜像：
   ```bash
   docker build -t network-planning-tool-frontend -f frontend/Dockerfile .
   ```

3. 使用docker-compose运行：
   ```bash
   docker-compose up -d
   ```

### 本地部署

1. 运行后端服务：
   ```bash
   cd backend
   python main.py
   ```

2. 运行前端应用：
   ```bash
   cd frontend
   npm run start
   ```

## 测试

### 单元测试
```bash
# 后端单元测试
cd backend
pytest

# 前端单元测试
cd frontend
npm run test
```

### 集成测试
```bash
cd tests
pytest integration/
```

## 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

## 许可证

MIT License

## 联系方式

如有问题或建议，请联系项目团队。

---

**版本**: 3.0.0
**更新日期**: 2026-01-06
**开发团队**: Network Planning Team