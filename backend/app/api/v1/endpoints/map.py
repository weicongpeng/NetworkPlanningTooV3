"""
地图服务API端点
"""
from fastapi import APIRouter, HTTPException
from fastapi.concurrency import run_in_threadpool
from typing import Dict, Any, Optional, List
from app.models.schemas import OnlineMapConfig, OfflineMapConfig, MapData
from app.core.config import settings
import json
import time

router = APIRouter()

# 地图数据缓存
_map_data_cache: Optional[Dict[str, Any]] = None
_map_data_cache_time: float = 0
_map_data_cache_ttl: int = 300  # 缓存5分钟


def _filter_sites_by_bbox(sites: List[Dict], min_lat: float, max_lat: float, min_lon: float, max_lon: float) -> List[Dict]:
    """根据边界框筛选站点"""
    filtered = []
    for site in sites:
        lat = site.get('latitude', 0)
        lon = site.get('longitude', 0)
        if min_lat <= lat <= max_lat and min_lon <= lon <= max_lon:
            filtered.append(site)
    return filtered


@router.get("/data", response_model=Dict[str, Any])
async def get_map_data(
    min_lat: Optional[float] = None,
    max_lat: Optional[float] = None,
    min_lon: Optional[float] = None,
    max_lon: Optional[float] = None,
    limit: int = 10000
) -> Dict[str, Any]:
    """获取地图数据 - 从已导入的Excel数据中聚合
    
    优先级：
    1. 只读取fileType为"full_params"的数据（最新的全量工参）
    2. 忽略"full_params_backup"等备份文件
    
    参数:
    - min_lat/max_lat/min_lon/max_lon: 边界框筛选（可选）
    - limit: 最大返回站点数（默认10000）
    """
    try:
        from app.services.data_service import data_service
        global _map_data_cache, _map_data_cache_time

        # 检查缓存是否有效
        current_time = time.time()
        if _map_data_cache is None or (current_time - _map_data_cache_time) > _map_data_cache_ttl:
            # 缓存失效，重新加载数据
            _map_data_cache = await run_in_threadpool(_load_map_data_from_files, data_service)
            _map_data_cache_time = current_time

        all_sites = _map_data_cache.get("sites", [])
        bounds = _map_data_cache.get("bounds", {})
        center = _map_data_cache.get("center", {})

        # 如果提供了边界框参数，进行筛选
        if min_lat is not None and max_lat is not None and min_lon is not None and max_lon is not None:
            all_sites = _filter_sites_by_bbox(all_sites, min_lat, max_lat, min_lon, max_lon)

        # 限制返回数量
        if len(all_sites) > limit:
            all_sites = all_sites[:limit]

        return {
            "success": True,
            "data": {
                "sites": all_sites,
                "bounds": bounds,
                "center": center,
                "total": len(all_sites)
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def _load_map_data_from_files(data_service) -> Dict[str, Any]:
    """从文件加载地图数据（在线程池中运行）"""
    # 重新加载索引，确保获取最新的数据
    data_service.reload_index()

    # 收集所有站点数据
    all_sites = []
    min_lat, max_lat = 90, -90
    min_lon, max_lon = 180, -180

    # 遍历所有已导入的数据，但只处理full_params类型
    for data_id, data_info in data_service.index.items():
        file_name = data_info.get("name", "unknown")
        data_file_type = data_info.get("fileType", "unknown")

        # 只处理excel类型且fileType为full_params的数据
        if data_info.get("type") != "excel":
            continue
        
        # 关键：只读取最新的全量工参，忽略备份文件
        if data_file_type not in ["full_params", "target_cells"]:
            continue

        # 读取解析后的数据
        data_dir = settings.DATA_DIR / data_id
        data_file = data_dir / "data.json"

        if data_file.exists():
            with open(data_file, 'r', encoding='utf-8') as f:
                data = json.load(f)

                # 处理两种可能的JSON结构
                sites_to_add = []
                if isinstance(data, dict):
                    for network_type in ['LTE', 'NR']:
                        if network_type in data:
                            sites_to_add.extend(data[network_type])
                elif isinstance(data, list):
                    sites_to_add = data

                all_sites.extend(sites_to_add)

                # 更新边界
                for site in sites_to_add:
                    lat = site.get('latitude', 0)
                    lon = site.get('longitude', 0)
                    if 0 < lat < 90:
                        min_lat = min(min_lat, lat)
                        max_lat = max(max_lat, lat)
                    if 0 < lon < 180:
                        min_lon = min(min_lon, lon)
                        max_lon = max(max_lon, lon)

    # 如果没有数据，使用默认值
    if not all_sites:
        return {
            "sites": [],
            "bounds": {
                "north": settings.DEFAULT_MAP_CENTER[0] + 0.1,
                "south": settings.DEFAULT_MAP_CENTER[0] - 0.1,
                "east": settings.DEFAULT_MAP_CENTER[1] + 0.1,
                "west": settings.DEFAULT_MAP_CENTER[1] - 0.1
            },
            "center": {
                "latitude": settings.DEFAULT_MAP_CENTER[0],
                "longitude": settings.DEFAULT_MAP_CENTER[1]
            }
        }

    # 计算中心点和边界
    center_lat = (min_lat + max_lat) / 2
    center_lon = (min_lon + max_lon) / 2

    # 添加边界缓冲
    lat_buffer = (max_lat - min_lat) * 0.1
    lon_buffer = (max_lon - min_lon) * 0.1

    return {
        "sites": all_sites,
        "bounds": {
            "north": max_lat + lat_buffer,
            "south": max(0, min_lat - lat_buffer),
            "east": max_lon + lon_buffer,
            "west": max(0, min_lon - lon_buffer)
        },
        "center": {
            "latitude": center_lat,
            "longitude": center_lon
        }
    }


@router.post("/cache/clear", response_model=Dict[str, Any])
async def clear_map_cache() -> Dict[str, Any]:
    """清除地图数据缓存"""
    global _map_data_cache, _map_data_cache_time
    _map_data_cache = None
    _map_data_cache_time = 0
    return {"success": True, "message": "地图数据缓存已清除"}


@router.get("/online-config", response_model=Dict[str, Any])
async def get_online_config() -> Dict[str, Any]:
    """获取在线地图配置（高德地图）"""
    try:
        return {
            "success": True,
            "data": {
                "provider": "amap",
                "apiKey": settings.AMAP_API_KEY,
                "securityCode": settings.AMAP_SECURITY_CODE,
                "center": settings.DEFAULT_MAP_CENTER,
                "zoom": settings.DEFAULT_MAP_ZOOM
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/offline-path", response_model=Dict[str, Any])
async def get_offline_path() -> Dict[str, Any]:
    """获取离线地图路径"""
    try:
        # TODO: 从配置中获取离线地图路径
        return {
            "success": True,
            "data": {
                "path": ""
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/online-config", response_model=Dict[str, Any])
async def update_online_config(config: OnlineMapConfig) -> Dict[str, Any]:
    """更新在线地图配置"""
    try:
        # TODO: 保存在线地图配置
        return {
            "success": True,
            "message": "配置已保存"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/offline-path", response_model=Dict[str, Any])
async def update_offline_path(config: OfflineMapConfig) -> Dict[str, Any]:
    """更新离线地图路径"""
    try:
        # TODO: 保存离线地图路径
        return {
            "success": True,
            "message": "路径已保存"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
