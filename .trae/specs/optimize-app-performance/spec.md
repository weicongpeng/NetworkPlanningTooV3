# 应用性能优化规格文档

## Why
当前 Network Planning Tool V3 桌面应用在启动和加载数据时存在严重的性能问题，用户体验卡顿明显。主要问题包括：后端全量数据加载无分页、文件IO阻塞、无缓存机制、前端串行请求等。本优化旨在显著提升应用启动速度和数据加载流畅度。

## What Changes
- **后端API优化**: 添加分页支持、实现数据缓存、优化文件IO操作
- **前端加载优化**: 并行请求、虚拟滚动、持久化缓存
- **数据服务优化**: 延迟扫描、索引缓存、异步处理
- **地图渲染优化**: 视口内数据加载、LOD策略改进

## Impact
- 受影响模块: backend/app/api/, backend/app/services/, frontend/src/renderer/
- 关键文件: data_service.py, map.py, dataStore.ts, MapPage.tsx

## ADDED Requirements

### Requirement: 后端数据分页支持
系统 SHALL 为数据列表和地图数据接口提供分页支持。

#### Scenario: 数据列表分页
- **GIVEN** 用户请求数据列表
- **WHEN** 调用 `/data/list` 接口并传入 page 和 page_size 参数
- **THEN** 返回指定页的数据和总数量，而非全量数据

#### Scenario: 地图数据分页
- **GIVEN** 用户查看地图
- **WHEN** 调用 `/map/data` 接口
- **THEN** 支持按视口边界筛选数据，减少传输量

### Requirement: 后端数据缓存机制
系统 SHALL 实现数据缓存，避免重复文件IO。

#### Scenario: 索引缓存
- **GIVEN** 数据服务初始化
- **WHEN** 扫描上传目录后
- **THEN** 索引数据缓存到内存，后续请求直接使用缓存

#### Scenario: 数据文件缓存
- **GIVEN** 请求数据详情
- **WHEN** 数据文件已加载过
- **THEN** 从缓存返回，不重新读取文件

### Requirement: 前端并行数据加载
系统 SHALL 并行加载多个数据源，减少等待时间。

#### Scenario: 图层数据并行加载
- **GIVEN** 进入地图页面
- **WHEN** 需要加载多个图层文件
- **THEN** 使用 Promise.all 并行请求，而非串行

### Requirement: 前端持久化缓存
系统 SHALL 使用 IndexedDB 缓存地图数据，减少重复请求。

#### Scenario: 地图数据缓存
- **GIVEN** 地图数据已加载过
- **WHEN** 在缓存有效期内再次请求
- **THEN** 从 IndexedDB 读取，不发起网络请求

### Requirement: 延迟目录扫描
系统 SHALL 延迟或异步化上传目录扫描操作。

#### Scenario: 服务启动优化
- **GIVEN** 后端服务启动
- **WHEN** 初始化 DataService
- **THEN** 不立即扫描目录，改为按需扫描或异步扫描

## MODIFIED Requirements

### Requirement: 数据列表接口
**原实现**: 一次性返回所有数据项
**新实现**: 
```python
@router.get("/list", response_model=Dict[str, Any])
async def list_data(page: int = 1, page_size: int = 50) -> Dict[str, Any]:
    items = data_service.list_data(page, page_size)
    total = data_service.get_total_count()
    return {"success": True, "data": items, "total": total}
```

### Requirement: 地图数据接口
**原实现**: 加载所有 full_params 类型数据
**新实现**: 
- 支持 bbox 参数筛选视口内数据
- 添加缓存机制，避免重复读取文件
- 使用 run_in_threadpool 包裹文件IO

### Requirement: 图层数据加载
**原实现**: for循环串行加载
**新实现**: 
```typescript
const results = await Promise.all(
  mapItems.map(item => layerApi.getLayers(item.id))
)
```

## REMOVED Requirements

### Requirement: 冗余日志输出
**原因**: 生产环境打印大量调试日志影响性能
**迁移**: 移除或降低日志级别

### Requirement: 启动时全量目录扫描
**原因**: 阻塞服务启动，用户体验差
**迁移**: 改为按需扫描或后台异步扫描
