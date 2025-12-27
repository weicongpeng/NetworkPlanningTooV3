"""
PCI冲突检测器
"""
from typing import List, Dict, Tuple, Set
from dataclasses import dataclass
from enum import Enum


class ConflictType(str, Enum):
    """冲突类型"""
    COLLISION = "collision"  # PCI冲突（相同PCI）
    CONFUSION = "confusion"  # PCI混淆（PCI模3/模30相同）


@dataclass
class PCIConflict:
    """PCI冲突信息"""
    type: ConflictType
    sector1: str  # 小区ID
    sector2: str  # 小区ID
    pci: int
    distance: float  # 距离，单位：公里
    reason: str


@dataclass
class SectorInfo:
    """小区信息"""
    id: str
    site_id: str
    name: str
    longitude: float
    latitude: float
    azimuth: float
    beamwidth: float
    pci: int


class PCICollisionDetector:
    """PCI冲突检测器"""

    def __init__(self, distance_threshold: float = 3.0):
        """
        初始化检测器

        Args:
            distance_threshold: 距离阈值，单位：公里
        """
        self.distance_threshold = distance_threshold

    def detect_all(
        self,
        sectors: List[SectorInfo],
        enable_collision: bool = True,
        enable_confusion: bool = True
    ) -> List[PCIConflict]:
        """
        检测所有PCI冲突

        Args:
            sectors: 小区列表
            enable_collision: 是否检测PCI冲突
            enable_confusion: 是否检测PCI混淆

        Returns:
            冲突列表
        """
        conflicts = []

        for i in range(len(sectors)):
            for j in range(i + 1, len(sectors)):
                sector1 = sectors[i]
                sector2 = sectors[j]

                # 计算距离
                from app.algorithms.distance_calculator import DistanceCalculator, Point
                distance = DistanceCalculator.calculate_distance(
                    sector1.longitude, sector1.latitude,
                    sector2.longitude, sector2.latitude
                )

                # 只检查距离阈值内的小区
                if distance > self.distance_threshold:
                    continue

                # 检测PCI冲突
                if enable_collision and sector1.pci == sector2.pci:
                    conflicts.append(PCIConflict(
                        type=ConflictType.COLLISION,
                        sector1=sector1.id,
                        sector2=sector2.id,
                        pci=sector1.pci,
                        distance=distance,
                        reason=f"小区{sector1.name}和{sector2.name}使用相同PCI={sector1.pci}"
                    ))

                # 检测PCI混淆（模3）
                if enable_confusion:
                    if sector1.pci % 3 == sector2.pci % 3:
                        conflicts.append(PCIConflict(
                            type=ConflictType.CONFUSION,
                            sector1=sector1.id,
                            sector2=sector2.id,
                            pci=sector1.pci,
                            distance=distance,
                            reason=f"小区{sector1.name}和{sector2.name}的PCI模3相同({sector1.pci % 3})"
                        ))

        return conflicts

    def detect_collision(self, sectors: List[SectorInfo], pci: int) -> List[str]:
        """
        检测哪些小区与指定PCI冲突

        Args:
            sectors: 小区列表
            pci: 要检测的PCI

        Returns:
            冲突的小区ID列表
        """
        conflicts = []
        for sector in sectors:
            if sector.pci == pci:
                conflicts.append(sector.id)
        return conflicts

    def detect_confusion(self, sectors: List[SectorInfo], pci: int, modulus: int = 3) -> List[str]:
        """
        检测哪些小区与指定PCI混淆

        Args:
            sectors: 小区列表
            pci: 要检测的PCI
            modulus: 模数（3或30）

        Returns:
            混淆的小区ID列表
        """
        confusions = []
        for sector in sectors:
            if sector.pci % modulus == pci % modulus:
                confusions.append(sector.id)
        return confusions

    def check_pci_availability(
        self,
        sectors: List[SectorInfo],
        pci: int,
        exclude_sector_id: str = None,
        modulus: int = 3,
        target_longitude: float = None,
        target_latitude: float = None
    ) -> Tuple[bool, List[str]]:
        """
        检查PCI是否可用

        Args:
            sectors: 小区列表
            pci: 要检查的PCI
            exclude_sector_id: 排除的小区ID（用于检查当前小区）
            modulus: 模数
            target_longitude: 目标经度
            target_latitude: 目标纬度

        Returns:
            (是否可用, 冲突原因列表)
        """
        reasons = []

        # 过滤掉排除的小区
        check_sectors = [s for s in sectors if s.id != exclude_sector_id]

        for sector in check_sectors:
            # 计算距离
            from app.algorithms.distance_calculator import DistanceCalculator
            distance = DistanceCalculator.calculate_distance(
                target_longitude if target_longitude is not None else sector.longitude,
                target_latitude if target_latitude is not None else sector.latitude,
                sector.longitude,
                sector.latitude
            )

            # 超过距离阈值的不检查
            if distance > self.distance_threshold:
                continue

            # 检查冲突
            if sector.pci == pci:
                reasons.append(f"与小区{sector.name}PCI冲突")
                continue

            # 检查混淆
            if sector.pci % modulus == pci % modulus:
                reasons.append(f"与小区{sector.name}PCI模{modulus}混淆")

        return len(reasons) == 0, reasons

    def get_available_pci_range(
        self,
        sectors: List[SectorInfo],
        min_pci: int = 0,
        max_pci: int = 503,
        modulus: int = 3,
        target_longitude: float = None,
        target_latitude: float = None
    ) -> List[int]:
        """
        获取可用的PCI列表

        Args:
            sectors: 小区列表
            min_pci: 最小PCI值
            max_pci: 最大PCI值（LTE: 503, NR: 1007）
            modulus: 模数
            target_longitude: 目标经度（用于距离检查）
            target_latitude: 目标纬度（用于距离检查）

        Returns:
            可用的PCI列表
        """
        available = []
        occupied = set()

        # 收集已占用的PCI
        for sector in sectors:
            occupied.add(sector.pci)

        # 检查每个PCI
        for pci in range(min_pci, max_pci + 1):
            if pci not in occupied:
                # 检查模冲突
                has_conflict = False
                for sector in sectors:
                    if sector.pci % modulus == pci % modulus:
                        # 需要检查距离（只检查同模数的）
                        from app.algorithms.distance_calculator import DistanceCalculator
                        distance = DistanceCalculator.calculate_distance(
                            target_longitude if target_longitude is not None else sector.longitude,
                            target_latitude if target_latitude is not None else sector.latitude,
                            sector.longitude,
                            sector.latitude
                        )
                        if distance <= self.distance_threshold:
                            has_conflict = True
                            break

                if not has_conflict:
                    available.append(pci)

        return available

    def count_conflicts(
        self,
        sectors: List[SectorInfo],
        enable_collision: bool = True,
        enable_confusion: bool = True
    ) -> Dict[str, int]:
        """
        统计冲突数量

        Args:
            sectors: 小区列表
            enable_collision: 是否统计PCI冲突
            enable_confusion: 是否统计PCI混淆

        Returns:
            统计结果字典
        """
        conflicts = self.detect_all(sectors, enable_collision, enable_confusion)

        collision_count = sum(1 for c in conflicts if c.type == ConflictType.COLLISION)
        confusion_count = sum(1 for c in conflicts if c.type == ConflictType.CONFUSION)

        return {
            "total": len(conflicts),
            "collisions": collision_count,
            "confusions": confusion_count
        }
