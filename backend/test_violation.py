#!/usr/bin/env python3
"""
测试约束违反的透明返回信息
"""

import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.algorithms.pci_planning_service_v2 import (
    PCIPlanningService,
    PlanningConfig,
    SiteSectorInfo,
)
from app.models.schemas import NetworkType


def test_constraint_violation():
    """测试约束违反情况的返回信息"""

    # 创建测试配置
    config = PlanningConfig(
        network_type=NetworkType.LTE, distance_threshold=5.0
    )  # 设置5km阈值

    # 创建规划服务
    service = PCIPlanningService(config)

    # 创建两个相距约1km的同频小区
    sectors = [
        SiteSectorInfo(
            id="sector_1",
            site_id="site_1",
            name="Sector 1",
            longitude=116.4074,
            latitude=39.9042,
            azimuth=0,
            pci=100,
            earfcn=3800,
        ),
        SiteSectorInfo(
            id="sector_2",
            site_id="site_2",
            name="Sector 2",
            longitude=116.4174,  # 约1km距离
            latitude=39.9042,
            azimuth=120,
            pci=None,  # 需要分配
            earfcn=3800,  # 同频
        ),
    ]

    print("=== Test Constraint Violation Scenario ===")
    print(f"Original distance constraint: {config.distance_threshold}km")
    print(f"Sector 1: PCI=100 at (116.4074, 39.9042)")
    print(f"Sector 2: Needs PCI at (116.4174, 39.9042) - about 1km away")
    print()

    # 手动添加第一个小区的PCI到已分配列表
    service.assigned_pcis.append(
        (100, sectors[0].latitude, sectors[0].longitude, sectors[0].earfcn)
    )

    # 分配第二个小区（应该违反5km约束）
    print("Assigning PCI to Sector 2...")
    pci, distance, reason = service.assign_pci(sectors[1], sectors, 1)

    print(f"Assigned PCI: {pci}")
    print(f"Distance to nearest same PCI: {distance:.2f}km")
    print(f"Assignment Reason: {reason}")
    print()

    print("=== Analysis ===")
    print("- The actual distance is much less than the 5km constraint")
    print("- The return message should clearly indicate this violation")
    print("- The system should have used automatic constraint relaxation")


if __name__ == "__main__":
    test_constraint_violation()
