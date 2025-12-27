"""
PCI规划服务 - 基于NetworkPlanningTool_V1.py的逻辑重构
"""
import math
from typing import List, Dict, Optional, Tuple, Callable, Awaitable
from dataclasses import dataclass, field
from enum import Enum
import asyncio

from app.algorithms.distance_calculator import DistanceCalculator, Point
from app.models.schemas import NetworkType


@dataclass
class PlanningConfig:
    """规划配置"""
    network_type: NetworkType
    distance_threshold: float = 3.0  # 距离阈值，单位：公里
    pci_modulus: int = 3  # PCI模数（3或30）
    inherit_modulus: bool = False  # 是否继承全量工参小区对应的模3或模30

    # PCI范围
    LTE_MIN_PCI = 0
    LTE_MAX_PCI = 503
    NR_MIN_PCI = 0
    NR_MAX_PCI = 1007


@dataclass
class SiteSectorInfo:
    """站点小区信息"""
    id: str
    site_id: str
    name: str
    longitude: float
    latitude: float
    azimuth: float
    beamwidth: float = 65.0
    height: float = 30.0
    pci: Optional[int] = None
    earfcn: Optional[float] = None  # 下行频点，用于判断同频


@dataclass
class SectorPlanningResult:
    """小区规划结果"""
    sector_id: str
    sector_name: str
    site_id: str
    original_pci: Optional[int]
    new_pci: int
    original_mod: Optional[int]
    new_mod: int
    earfcn: Optional[float]
    longitude: float
    latitude: float
    assignment_reason: str
    min_reuse_distance: float


@dataclass
class SitePlanningResult:
    """站点规划结果"""
    site_id: str
    site_name: str
    sectors: List[SectorPlanningResult]


@dataclass
class PCIPlanningResult:
    """PCI规划结果"""
    task_id: str
    status: str
    total_sites: int
    total_sectors: int
    total_collisions: int
    total_confusions: int
    sites: List[SitePlanningResult]
    progress: float = 0.0


class PCIPlanningService:
    """PCI规划服务 - 简化版本，匹配V1代码逻辑"""

    def __init__(self, config: PlanningConfig):
        self.config = config

        # 设置PCI范围
        if self.config.network_type == NetworkType.LTE:
            self.pci_range = list(range(0, 504))  # LTE: 0-503
            self.mod_value = 3
        else:
            self.pci_range = list(range(0, 1008))  # NR: 0-1007
            self.mod_value = 30

        # 存储已分配的PCI（包含位置信息）
        self.assigned_pcis = []  # List of (pci, longitude, latitude, earfcn)

    def _get_pci_range(self) -> Tuple[int, int]:
        """获取PCI范围"""
        if self.config.network_type == NetworkType.LTE:
            return self.LTE_MIN_PCI, self.LTE_MAX_PCI
        else:
            return self.NR_MIN_PCI, self.NR_MAX_PCI

    def calculate_distance(self, lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """计算两点之间的距离（公里）"""
        return DistanceCalculator.calculate_distance(lon1, lat1, lon2, lat2)

    def get_same_site_sectors(self, target_lat: float, target_lon: float,
                             exclude_sector_id: str, all_sectors: List[SiteSectorInfo]) -> List[SiteSectorInfo]:
        """获取同站点的其他小区"""
        tolerance = 0.0001  # 约10米精度
        same_site = []
        for sector in all_sectors:
            if sector.id == exclude_sector_id:
                continue
            if (abs(sector.latitude - target_lat) < tolerance and
                abs(sector.longitude - target_lon) < tolerance):
                same_site.append(sector)
        return same_site

    def check_same_site_mod_conflict(self, candidate_pci: int, target_lat: float, target_lon: float,
                                    exclude_sector_id: str, all_sectors: List[SiteSectorInfo]) -> bool:
        """检查同站点模值冲突"""
        candidate_mod = candidate_pci % self.mod_value
        same_site_sectors = self.get_same_site_sectors(target_lat, target_lon, exclude_sector_id, all_sectors)

        # 统计同站点已有的模值
        existing_mods = set()
        for sector in same_site_sectors:
            if sector.pci is not None and sector.pci >= 0:
                existing_mods.add(sector.pci % self.mod_value)

        # 如果候选模值已存在，返回有冲突
        return candidate_mod in existing_mods

    def validate_pci_reuse_distance(self, candidate_pci: int, target_lat: float, target_lon: float,
                                    target_earfcn: Optional[float], exclude_sector_id: str,
                                    all_sectors: List[SiteSectorInfo]) -> Tuple[bool, float]:
        """验证PCI是否满足复用距离要求

        只检查同频同PCI的小区
        """
        min_distance = float('inf')

        for assigned in self.assigned_pcis:
            pci, lat, lon, earfcn = assigned
            if pci != candidate_pci:
                continue
            # 只检查同频小区
            if target_earfcn is not None and earfcn is not None:
                if abs(target_earfcn - earfcn) > 0.1:  # 频点不同
                    continue
            # 计算距离
            dist = self.calculate_distance(target_lat, target_lon, lat, lon)
            if dist < min_distance:
                min_distance = dist

        # 检查是否满足最小复用距离
        is_valid = min_distance >= self.config.distance_threshold
        return is_valid, min_distance

    def get_available_pcis(self, target_lat: float, target_lon: float,
                          target_earfcn: Optional[float], exclude_sector_id: str,
                          all_sectors: List[SiteSectorInfo],
                          preferred_mod: Optional[int] = None) -> List[Tuple[int, float]]:
        """获取可用的PCI列表，按距离排序

        Returns:
            List of (pci, min_distance) tuples
        """
        available_pcis = []

        # 如果指定了模值，只检查该模值的PCI
        if preferred_mod is not None:
            candidate_pcis = [pci for pci in self.pci_range if pci % self.mod_value == preferred_mod]
        else:
            candidate_pcis = self.pci_range

        # 检查每个候选PCI
        for pci in candidate_pcis:
            # 检查同站点模值冲突
            if self.check_same_site_mod_conflict(pci, target_lat, target_lon, exclude_sector_id, all_sectors):
                continue  # 跳过有冲突的PCI

            # 检查复用距离
            is_valid, min_distance = self.validate_pci_reuse_distance(
                pci, target_lat, target_lon, target_earfcn, exclude_sector_id, all_sectors
            )

            if is_valid:
                available_pcis.append((pci, min_distance))

        # 按距离排序（优先选择距离接近阈值的PCI，避免浪费PCI资源）
        available_pcis.sort(key=lambda x: x[1], reverse=True)

        return available_pcis

    def assign_pci(self, sector: SiteSectorInfo, all_sectors: List[SiteSectorInfo],
                   sector_index: int) -> Tuple[int, str, float]:
        """为单个小区分配PCI

        Returns:
            (assigned_pci, reason, min_distance)
        """
        # 获取原PCI的模值
        original_pci = sector.pci
        preferred_mod = None

        # 如果启用了继承模数，且原PCI有效，则使用原PCI的模值
        if self.config.inherit_modulus and original_pci is not None and original_pci >= 0:
            preferred_mod = original_pci % self.mod_value

        # 获取可用PCI列表
        available_pcis = self.get_available_pcis(
            sector.latitude, sector.longitude, sector.earfcn, sector.id, all_sectors, preferred_mod
        )

        if available_pcis:
            # 选择距离最近阈值的一个（避免浪费PCI）
            assigned_pci, min_distance = available_pcis[0]
            if self.config.inherit_modulus and preferred_mod is not None:
                reason = f"继承模{preferred_mod}分配，最小复用距离={min_distance:.2f}km"
            else:
                reason = f"成功分配，最小复用距离={min_distance:.2f}km"

            # 记录已分配的PCI
            self.assigned_pcis.append((assigned_pci, sector.latitude, sector.longitude, sector.earfcn))

            return assigned_pci, reason, min_distance
        else:
            # 没有可用PCI，分配失败
            # 尝试放宽模值约束
            available_pcis = self.get_available_pcis(
                sector.latitude, sector.longitude, sector.earfcn, sector.id, all_sectors, None
            )
            if available_pcis:
                assigned_pci, min_distance = available_pcis[0]
                if self.config.inherit_modulus:
                    reason = f"继承模数失败，放宽模值约束后分配，最小复用距离={min_distance:.2f}km"
                else:
                    reason = f"放宽模值约束后分配，最小复用距离={min_distance:.2f}km"
                self.assigned_pcis.append((assigned_pci, sector.latitude, sector.longitude, sector.earfcn))
                return assigned_pci, reason, min_distance

            # 完全失败，返回-1
            return -1, "无可用的PCI", 0.0

    async def plan(
        self,
        sites_data: List[Dict],
        progress_callback: Optional[Callable[[float], Awaitable[None]]] = None
    ) -> PCIPlanningResult:
        """
        执行PCI规划

        Args:
            sites_data: 站点数据列表，每个站点包含sectors数组
            progress_callback: 进度回调函数

        Returns:
            规划结果
        """
        task_id = f"pci_{int(asyncio.get_event_loop().time())}"

        print(f"[PCI规划] 开始规划，任务ID: {task_id}")
        print(f"[PCI规划] 输入数据类型: {type(sites_data)}, 长度: {len(sites_data) if sites_data else 0}")

        # 调试：打印输入数据
        if sites_data:
            print(f"[PCI规划] 第一个站点数据: {sites_data[0] if len(sites_data) > 0 else 'empty'}")

        # 解析数据
        all_sectors = []
        for site in sites_data:
            site_id = site.get('id', '')
            site_name = site.get('name', '')
            network_type = site.get('networkType', 'LTE')
            sectors = site.get('sectors', [])
            print(f"[PCI规划] 处理站点 {site_id}, 小区数: {len(sectors)}")

            for sector_data in sectors:
                all_sectors.append(SiteSectorInfo(
                    id=sector_data.get('id', f"{site_id}_{sector_data.get('id', '')}"),
                    site_id=site_id,
                    name=sector_data.get('name', f"{site_name}_{sector_data.get('id', '')}"),
                    longitude=sector_data.get('longitude', 0),
                    latitude=sector_data.get('latitude', 0),
                    azimuth=sector_data.get('azimuth', 0),
                    beamwidth=sector_data.get('beamwidth', 65),
                    height=sector_data.get('height', 30),
                    pci=sector_data.get('pci'),
                    earfcn=sector_data.get('earfcn')
                ))

        total_sectors = len(all_sectors)
        print(f"[PCI规划] 解析完成: 总计 {len(sites_data)} 个站点, {total_sectors} 个小区")
        total_sites = len(sites_data)

        # 按站点分组
        site_sectors: Dict[str, List[SiteSectorInfo]] = {}
        for sector in all_sectors:
            if sector.site_id not in site_sectors:
                site_sectors[sector.site_id] = []
            site_sectors[sector.site_id].append(sector)

        # 规划结果
        site_results: List[SitePlanningResult] = []

        # 为每个小区分配PCI
        processed = 0
        total_collisions = 0
        total_confusions = 0

        for site_id, sectors in site_sectors.items():
            sector_results: List[SectorPlanningResult] = []
            site_name = sectors[0].site_id if sectors else site_id

            # 按方位角排序
            sectors.sort(key=lambda s: s.azimuth)

            for i, sector in enumerate(sectors):
                # 分配PCI
                preferred_mod = i % self.mod_value  # 同站点使用不同的模值
                assigned_pci, reason, min_distance = self.assign_pci(sector, all_sectors, processed)

                # 计算模值
                original_pci = sector.pci
                original_mod = original_pci % self.mod_value if original_pci is not None and original_pci >= 0 else None
                new_mod = assigned_pci % self.mod_value if assigned_pci >= 0 else None

                sector_results.append(SectorPlanningResult(
                    sector_id=sector.id,
                    sector_name=sector.name,
                    site_id=site_id,
                    original_pci=original_pci,
                    new_pci=assigned_pci,
                    original_mod=original_mod,
                    new_mod=new_mod if new_mod is not None else 0,
                    earfcn=sector.earfcn,
                    longitude=sector.longitude,
                    latitude=sector.latitude,
                    assignment_reason=reason,
                    min_reuse_distance=min_distance
                ))

                # 更新小区的PCI（用于后续小区的冲突检测）
                sector.pci = assigned_pci

                processed += 1
                if progress_callback:
                    await progress_callback(processed / total_sectors * 100)

            site_results.append(SitePlanningResult(
                site_id=site_id,
                site_name=site_name,
                sectors=sector_results
            ))

        return PCIPlanningResult(
            task_id=task_id,
            status="completed",
            total_sites=total_sites,
            total_sectors=total_sectors,
            total_collisions=total_collisions,
            total_confusions=total_confusions,
            sites=site_results,
            progress=100.0
        )


async def run_pci_planning(
    config: PlanningConfig,
    sites_data: List[Dict],
    progress_callback: Optional[Callable[[float], Awaitable[None]]] = None
) -> Dict:
    """
    运行PCI规划

    Args:
        config: 规划配置
        sites_data: 站点数据
        progress_callback: 进度回调

    Returns:
        规划结果字典
    """
    service = PCIPlanningService(config)
    result = await service.plan(sites_data, progress_callback)

    # 转换为前端需要的格式
    results = []
    for site in result.sites:
        site_data = {
            "siteId": site.site_id,
            "siteName": site.site_name,
            "sectors": []
        }

        for sector in site.sectors:
            site_data["sectors"].append({
                "sectorId": sector.sector_id,
                "sectorName": sector.sector_name,
                "originalPCI": sector.original_pci,
                "newPCI": sector.new_pci,
                "originalMod": sector.original_mod,
                "newMod": sector.new_mod,
                "earfcn": sector.earfcn,
                "longitude": sector.longitude,
                "latitude": sector.latitude,
                "assignmentReason": sector.assignment_reason,
                "minReuseDistance": sector.min_reuse_distance
            })

        results.append(site_data)

    return {
        "taskId": result.task_id,
        "status": result.status,
        "progress": result.progress,
        "totalSites": result.total_sites,
        "totalSectors": result.total_sectors,
        "collisions": result.total_collisions,
        "confusions": result.total_confusions,
        "results": results
    }
