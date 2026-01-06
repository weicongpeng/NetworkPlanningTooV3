"""
地图服务API端点
"""
from fastapi import APIRouter, HTTPException
from typing import Dict, Any
from app.models.schemas import OnlineMapConfig, OfflineMapConfig, MapData
from app.core.config import settings

router = APIRouter()


@router.get("/data", response_model=Dict[str, Any])
async def get_map_data() -> Dict[str, Any]:
    """获取地图数据 - 从已导入的Excel数据中聚合"""
    try:
        from app.services.data_service import data_service
        import json

        # 收集所有站点数据
        all_sites = []
        min_lat, max_lat = 90, -90
        min_lon, max_lon = 180, -180

        # 遍历所有已导入的数据
        for data_id, data_info in data_service.index.items():
            if data_info.get("type") != "excel":
                continue

            # 读取解析后的数据
            data_dir = settings.DATA_DIR / data_id
            data_file = data_dir / "data.json"

            if data_file.exists():
                with open(data_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)

                    # 处理两种可能的JSON结构
                    # 1. {"LTE": [...], "NR": [...]} - 按网络类型分组
                    # 2. [...] - 直接的站点数组
                    sites_to_add = []
                    if isinstance(data, dict):
                        # 按网络类型分组的情况
                        for network_type in ['LTE', 'NR']:
                            if network_type in data:
                                sites_to_add.extend(data[network_type])
                    elif isinstance(data, list):
                        # 直接是数组的情况
                        sites_to_add = data

                    all_sites.extend(sites_to_add)

                    # 添加坐标验证日志
                    for site in sites_to_add:
                        site_name = site.get('name', 'unknown')
                        site_lat = site.get('latitude')
                        site_lng = site.get('longitude')
                        print(f"[MAP_DATA] 站点: {site_name}, 坐标: ({site_lat}, {site_lng})")
                        if 'sectors' in site and isinstance(site['sectors'], list):
                            for idx, sector in enumerate(site['sectors']):
                                sector_name = sector.get('name', f'sector_{idx}')
                                sector_lat = sector.get('latitude')
                                sector_lng = sector.get('longitude')
                                has_own_coords = sector_lat is not None and sector_lng is not None
                                coord_match = (has_own_coords and
                                               abs(sector_lat - site_lat) < 0.0001 and
                                               abs(sector_lng - site_lng) < 0.0001)
                                print(f"  [SECTOR] {sector_name}: coords={sector_lat}, {sector_lng} "
                                      f"[{'与站点相同' if coord_match else '有独立坐标' if has_own_coords else '无坐标'}]")

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
                "success": True,
                "data": {
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
            }

        # 计算中心点和边界
        center_lat = (min_lat + max_lat) / 2
        center_lon = (min_lon + max_lon) / 2

        # 添加边界缓冲
        lat_buffer = (max_lat - min_lat) * 0.1
        lon_buffer = (max_lon - min_lon) * 0.1

        return {
            "success": True,
            "data": {
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
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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
