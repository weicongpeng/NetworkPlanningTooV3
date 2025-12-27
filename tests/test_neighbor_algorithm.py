"""
邻区规划算法单元测试
"""
import pytest
from app.algorithms.neighbor_planning_service import (
    NeighborPlanningService,
    NeighborConfig,
    NetworkType,
    RelationType,
    SectorInfo
)


class TestNeighborPlanning:
    """邻区规划测试"""

    @pytest.fixture
    def sample_config(self):
        """示例配置"""
        return NeighborConfig(
            source_type=NetworkType.LTE,
            target_type=NetworkType.LTE,
            max_distance=10.0,
            max_neighbors=32
        )

    @pytest.fixture
    def sample_sites(self):
        """示例站点数据"""
        return [
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
                        "height": 30,
                        "pci": 0
                    }
                ]
            },
            {
                "id": "site2",
                "name": "站点2",
                "longitude": 116.4174,  # 相距约1公里
                "latitude": 39.9042,
                "networkType": "LTE",
                "sectors": [
                    {
                        "id": "sector2",
                        "name": "小区2",
                        "longitude": 116.4174,
                        "latitude": 39.9042,
                        "azimuth": 180,
                        "beamwidth": 65,
                        "height": 30,
                        "pci": 1
                    }
                ]
            }
        ]

    def test_neighbor_score_calculation(self, sample_config):
        """测试邻区得分计算"""
        service = NeighborPlanningService(sample_config)

        source = SectorInfo(
            id="sector1",
            site_id="site1",
            name="小区1",
            longitude=116.4074,
            latitude=39.9042,
            azimuth=0,
            beamwidth=65
        )

        target = SectorInfo(
            id="sector2",
            site_id="site2",
            name="小区2",
            longitude=116.4174,
            latitude=39.9042,
            azimuth=180,
            beamwidth=65
        )

        from app.algorithms.distance_calculator import DistanceCalculator
        distance = DistanceCalculator.calculate_distance(
            source.longitude, source.latitude,
            target.longitude, target.latitude
        )
        bearing = DistanceCalculator.calculate_bearing(
            source.longitude, source.latitude,
            target.longitude, target.latitude
        )

        score = service._calculate_neighbor_score(source, target, distance, bearing)

        assert score > 0

    @pytest.mark.asyncio
    async def test_neighbor_planning(self, sample_config, sample_sites):
        """测试邻区规划"""
        service = NeighborPlanningService(sample_config)
        result = await service.plan(sample_sites)

        assert result.status == "completed"
        assert result.total_sites == 2
        assert result.total_sectors == 2
        assert result.total_neighbors >= 2  # 至少应该有同站邻区

    @pytest.mark.asyncio
    async def test_run_neighbor_planning(self, sample_config, sample_sites):
        """测试邻区规划运行函数"""
        from app.algorithms.neighbor_planning_service import run_neighbor_planning

        result = await run_neighbor_planning(sample_config, sample_sites)

        assert result['status'] == 'completed'
        assert result['totalSites'] == 2
        assert len(result['results']) == 2

    def test_relation_type_detection(self, sample_config):
        """测试关系类型检测"""
        assert sample_config.source_type == NetworkType.LTE
        assert sample_config.target_type == NetworkType.LTE

        service = NeighborPlanningService(sample_config)
        assert service._get_relation_type() == RelationType.LTE_LTE
