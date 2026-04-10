# Roadmap: 地图工具功能增强

## Phase 1: 地图定位/抓取控件改造
- **Status**: Not Started
- **Goal**: 改造定位控件为"位置"下拉菜单，包含定位和坐标抓取两个子功能，支持WGS84坐标系输出

### Deliverables
1. 控件标题从"定位"改为"位置"
2. "位置"下拉菜单包含"定位"和"抓取"两个选项
3. 定位功能保持原有行为（输入经纬度跳转）
4. 抓取功能：点击地图获取WGS84经纬度并弹出供复制
5. 坐标纠偏（GCJ-02 -> WGS84）— 已有 `CoordinateTransformer.gcj02ToWgs84`

### Technical Context
- **地图库**: Leaflet + react-leaflet，瓦片源为高德地图（GCJ-02坐标系）
- **定位按钮**: `MapPage.tsx:1208-1217` — `<button>` 标签，文本 `{t('map.location') || '定位'}`
- **定位弹窗**: `MapPage.tsx:1453-1522` — 经纬度输入模态框
- **坐标转换**: `utils/coordinate.ts` — `CoordinateTransformer` 已有 `gcj02ToWgs84(lat, lng)` 方法
- **地图交互**: `OnlineMap.tsx` 暴露 `flyTo`, `addLocationMarker` 等方法
- **国际化**: 必须使用 `t()` 翻译函数，同步 `locales/zh.json` 和 `locales/en.json`

### Key Files
- `frontend/src/renderer/pages/MapPage.tsx` — 定位按钮UI、弹窗、地图事件处理
- `frontend/src/renderer/components/Map/OnlineMap.tsx` — Leaflet地图组件，需要暴露坐标抓取接口
- `frontend/src/renderer/utils/coordinate.ts` — 坐标转换工具（已有GCJ02→WGS84）
- `frontend/src/renderer/store/mapStore.ts` — 地图状态管理
- `frontend/src/renderer/i18n/locales/zh.json` — 中文翻译
- `frontend/src/renderer/i18n/locales/en.json` — 英文翻译

---
