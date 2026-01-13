#!/usr/bin/env python3
"""
测试新的透明返回信息功能
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


def test_transparent_return_messages():
    """测试透明返回信息的生成"""

    # 创建测试配置
    config = PlanningConfig(network_type=NetworkType.LTE, distance_threshold=3.0)

    # 创建规划服务
    service = PCIPlanningService(config)

    # 创建多个测试小区来模拟不同场景
    sectors = [
        SiteSectorInfo(
            id="sector_1",
            site_id="site_1",
            name="Sector 1",
            longitude=116.4074,
            latitude=39.9042,
            azimuth=0,
            pci=100,
            earfcn=3800,  # 同频
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

    print("=== Test Transparent Return Messages ===\n")

    # 手动分配第一个小区的PCI
    service.assigned_pcis.append(
        (100, sectors[0].latitude, sectors[0].longitude, sectors[0].earfcn)
    )

    # 测试第二个小区（距离约1km，不满足3km约束）
    print("Test Case: Sector at 1km distance (violates 3km constraint)")
    pci, distance, reason = service.assign_pci(sectors[1], sectors, 1)
    print(f"Assigned PCI: {pci}")
    print(f"Actual Distance: {distance:.2f}km")
    print(f"Assignment Reason: {reason}")
    print()

    print("=== Key Features ===")
    print("1. Check mark indicates satisfaction of original constraint (>=3km)")
    print("2. Cross mark indicates violation of original constraint (<3km)")
    print("3. Return message clearly shows original constraint and actual distance")
    print("4. Automatic constraint relaxation is transparently indicated")


if __name__ == "__main__":
    test_transparent_return_messages()
