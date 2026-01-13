#!/usr/bin/env python3
"""
测试自动放宽策略的透明标示
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


def test_automatic_relaxation():
    """测试自动放宽策略的透明标示"""

    # 创建测试配置 - 严格的距离约束
    config = PlanningConfig(network_type=NetworkType.LTE, distance_threshold=10.0)

    # 创建规划服务
    service = PCIPlanningService(config)

    # 创建多个小区，距离逐渐减小
    sectors = [
        SiteSectorInfo(
            id="sector_1",
            site_id="site_1",
            name="Sector 1",
            longitude=116.4074,
            latitude=39.9042,
            azimuth=0,
            pci=10,
            earfcn=3800,
        ),
        SiteSectorInfo(
            id="sector_2",
            site_id="site_2",
            name="Sector 2",
            longitude=116.4174,  # 约1km距离
            latitude=39.9042,
            azimuth=120,
            pci=None,
            earfcn=3800,
        ),
        SiteSectorInfo(
            id="sector_3",
            site_id="site_3",
            name="Sector 3",
            longitude=116.4274,  # 约2km距离
            latitude=39.9042,
            azimuth=240,
            pci=None,
            earfcn=3800,
        ),
    ]

    print("=== Test Automatic Constraint Relaxation ===")
    print(f"Original distance constraint: {config.distance_threshold}km")
    print(
        f"Automatic relaxation thresholds: {config.distance_threshold}km -> 2.0km -> 1.0km"
    )
    print()

    # 添加第一个小区的PCI
    service.assigned_pcis.append(
        (10, sectors[0].latitude, sectors[0].longitude, sectors[0].earfcn)
    )

    # 分配第二个小区（1km，需要自动放宽）
    print("=== Assignment 1: 1km distance ===")
    pci, distance, reason = service.assign_pci(sectors[1], sectors, 1)
    print(f"Assigned PCI: {pci}")
    print(f"Distance: {distance:.2f}km")
    print(f"Reason: {reason}")
    print()

    # 分配第三个小
    print("=== Assignment 2: 2km distance ===")
    pci, distance, reason = service.assign_pci(sectors[2], sectors, 2)
    print(f"Assigned PCI: {pci}")
    print(f"Distance: {distance:.2f}km")
    print(f"Reason: {reason}")
    print()

    print("=== Key Observations ===")
    print("1. The system should automatically relax distance constraints")
    print("2. Each relaxation should be clearly marked in the reason")
    print("3. Original constraint (10km) should always be shown")
    print("4. [VIOLATION] status indicates constraint breach")


if __name__ == "__main__":
    test_automatic_relaxation()
