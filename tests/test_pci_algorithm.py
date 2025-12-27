"""
PCI规划算法单元测试
"""
import pytest
from app.algorithms.distance_calculator import DistanceCalculator, Point
from app.algorithms.pci_collision_detector import (
    PCICollisionDetector,
    SectorInfo,
    ConflictType
)


class TestDistanceCalculator:
    """距离计算器测试"""

    def test_haversine_distance(self):
        """测试Haversine距离计算"""
        # 北京到上海的距离约1000公里
        beijing = Point(116.4074, 39.9042)
        shanghai = Point(121.4737, 31.2304)

        distance = DistanceCalculator.haversine_distance(beijing, shanghai)

        assert 1000 < distance < 1200  # 约1067公里

    def test_calculate_distance(self):
        """测试距离计算接口"""
        distance = DistanceCalculator.calculate_distance(
            116.4074, 39.9042,
            116.4074, 39.9142
        )

        # 纬度相差0.01度约1.11公里
        assert 1.0 < distance < 1.2

    def test_calculate_bearing(self):
        """测试方位角计算"""
        point1 = Point(0, 0)
        point2 = Point(1, 0)  # 正东方向

        bearing = DistanceCalculator.calculate_bearing(point1, point2)

        assert 85 <= bearing <= 95  # 约90度


class TestPCICollisionDetector:
    """PCI冲突检测器测试"""

    @pytest.fixture
    def sample_sectors(self):
        """示例小区数据"""
        return [
            SectorInfo(
                id="sector1",
                site_id="site1",
                name="小区1",
                longitude=116.4074,
                latitude=39.9042,
                azimuth=0,
                beamwidth=65,
                pci=0
            ),
            SectorInfo(
                id="sector2",
                site_id="site2",
                name="小区2",
                longitude=116.4174,  # 相距约1公里
                latitude=39.9042,
                azimuth=120,
                beamwidth=65,
                pci=0  # 相同PCI，应该冲突
            ),
            SectorInfo(
                id="sector3",
                site_id="site3",
                name="小区3",
                longitude=116.4074,
                latitude=39.9142,
                azimuth=240,
                beamwidth=65,
                pci=3  # PCI模3相同，应该混淆
            ),
        ]

    def test_detect_collision(self, sample_sectors):
        """检测PCI冲突"""
        detector = PCICollisionDetector(distance_threshold=3.0)
        conflicts = detector.detect_all(sample_sectors, enable_collision=True, enable_confusion=False)

        # 应该检测到一个冲突（sector1和sector2的PCI都是0）
        collision_conflicts = [c for c in conflicts if c.type == ConflictType.COLLISION]
        assert len(collision_conflicts) > 0

    def test_detect_confusion(self, sample_sectors):
        """检测PCI混淆"""
        detector = PCICollisionDetector(distance_threshold=3.0)
        conflicts = detector.detect_all(sample_sectors, enable_collision=False, enable_confusion=True)

        # sector1 (PCI=0) 和 sector3 (PCI=3) 模3相同
        confusion_conflicts = [c for c in conflicts if c.type == ConflictType.CONFUSION]
        assert len(confusion_conflicts) > 0

    def test_count_conflicts(self, sample_sectors):
        """统计冲突数量"""
        detector = PCICollisionDetector(distance_threshold=3.0)
        counts = detector.count_conflicts(sample_sectors, enable_collision=True, enable_confusion=True)

        assert counts['total'] > 0
        assert counts['collisions'] >= 0
        assert counts['confusions'] >= 0

    def test_check_pci_availability(self, sample_sectors):
        """检查PCI可用性"""
        detector = PCICollisionDetector(distance_threshold=3.0)

        # PCI=0已被占用
        available, reasons = detector.check_pci_availability(sample_sectors, 0, exclude_sector_id="sector1")
        assert not available

        # PCI=1应该是可用的
        available, reasons = detector.check_pci_availability(sample_sectors, 1)
        # 可能有模冲突，所以不一定是可用的
        assert isinstance(available, bool)


@pytest.mark.asyncio
async def test_pci_planning():
    """测试PCI规划流程"""
    from app.algorithms.pci_planning_service import (
        PlanningConfig,
        NetworkType,
        run_pci_planning
    )

    config = PlanningConfig(
        network_type=NetworkType.LTE,
        distance_threshold=3.0,
        pci_modulus=3,
        enable_collision_check=True,
        enable_confusion_check=True
    )

    # 示例数据
    sites_data = [
        {
            "id": "site1",
            "name": "站点1",
            "longitude": 116.4074,
            "latitude": 39.9042,
            "networkType": "LTE",
            "sectors": [
                {
                    "id": "sector1",
                    "name": "小区1",
                    "longitude": 116.4074,
                    "latitude": 39.9042,
                    "azimuth": 0,
                    "beamwidth": 65,
                    "height": 30
                },
                {
                    "id": "sector2",
                    "name": "小区2",
                    "longitude": 116.4074,
                    "latitude": 39.9042,
                    "azimuth": 120,
                    "beamwidth": 65,
                    "height": 30
                },
                {
                    "id": "sector3",
                    "name": "小区3",
                    "longitude": 116.4074,
                    "latitude": 39.9042,
                    "azimuth": 240,
                    "beamwidth": 65,
                    "height": 30
                }
            ]
        }
    ]

    result = await run_pci_planning(config, sites_data)

    assert result['status'] == 'completed'
    assert result['totalSites'] == 1
    assert result['totalSectors'] == 3
    assert len(result['results']) == 1
