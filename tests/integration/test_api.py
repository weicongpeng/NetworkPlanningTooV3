"""
API集成测试
"""
import pytest
from fastapi.testclient import TestClient

from app.api import create_app

app = create_app()
client = TestClient(app)


class TestLicenseAPI:
    """许可证API测试"""

    def test_get_license_status(self):
        """测试获取许可证状态"""
        response = client.get("/api/v1/license/status")
        assert response.status_code == 200
        data = response.json()
        assert "success" in data
        assert "data" in data


class TestDataAPI:
    """数据管理API测试"""

    def test_list_data(self):
        """测试获取数据列表"""
        response = client.get("/api/v1/data/list")
        assert response.status_code == 200
        data = response.json()
        assert "success" in data
        assert "data" in data


class TestPCIAPI:
    """PCI规划API测试"""

    def test_pci_plan_requires_data(self):
        """测试PCI规划需要先导入数据"""
        response = client.post(
            "/api/v1/pci/plan",
            json={
                "networkType": "LTE",
                "distanceThreshold": 3.0,
                "pciModulus": 3,
                "enableCollisionCheck": True,
                "enableConfusionCheck": True
            }
        )
        # 应该返回错误或创建任务
        assert response.status_code in [200, 400]


class TestNeighborAPI:
    """邻区规划API测试"""

    def test_neighbor_plan_requires_data(self):
        """测试邻区规划需要先导入数据"""
        response = client.post(
            "/api/v1/neighbor/plan",
            json={
                "sourceType": "LTE",
                "targetType": "LTE",
                "maxDistance": 10.0,
                "maxNeighbors": 32
            }
        )
        # 应该返回错误或创建任务
        assert response.status_code in [200, 400]


class TestMapAPI:
    """地图服务API测试"""

    def test_get_map_data(self):
        """测试获取地图数据"""
        response = client.get("/api/v1/map/data")
        assert response.status_code == 200
        data = response.json()
        assert "success" in data
        assert "data" in data

    def test_get_online_config(self):
        """测试获取在线地图配置"""
        response = client.get("/api/v1/map/online-config")
        assert response.status_code == 200
        data = response.json()
        assert "success" in data
