#!/usr/bin/env python3
"""
测试约束违反的透明返回信息 - 强制相同PCI冲突
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


def test_forced_violation():
    """测试强制约束违反情况"""

    # 创建测试配置 - 极小的PCI范围来强制冲突
    config = PlanningConfig(network_type=NetworkType.LTE, distance_threshold=5.0)
    config.pci_range = (0, 0)  # 只允许PCI 0

    # 创建规划服务
    service = PCIPlanningService(config)
    service.pci_range = (0, 0)  # 覆盖默认范围，只允许PCI 0

    # 创建多个小区来强制PCI复用
    sectors = [
        SiteSectorInfo(
            id="sector_1",
            site_id="site_1",
            name="Sector 1",
            longitude=116.4074,
            latitude=39.9042,
            azimuth=0,
            pci=0,  # 固定PCI
            earfcn=3800,
        ),
        SiteSectorInfo(
            id="sector_2",
            site_id="site_2",
            name="Sector 2",
            longitude=116.4174,  # 约1km距离
            latitude=39.9042,
            azimuth=120,
            pci=None,  # 需要分配，但会与PCI 0冲突
            earfcn=3800,
        ),
    ]

    print("=== Test Forced PCI Reuse ===")
    print(f"Available PCI range: {service.pci_range[0]} - {service.pci_range[-1]}")
    print(f"Distance constraint: {config.distance_threshold}km")
    print()

    # 添加第一个小区的PCI到已分配列表
    service.assigned_pcis.append(
        (0, sectors[0].latitude, sectors[0].longitude, sectors[0].earfcn)
    )

    # 分配第二个小区（距离1km，必须复用PCI 0）
    print("Assigning PCI to Sector 2 (1km away from Sector 1 with PCI 0)...")
    pci, distance, reason = service.assign_pci(sectors[1], sectors, 1)

    print(f"Assigned PCI: {pci}")
    print(f"Distance to nearest same PCI: {distance:.2f}km")
    print(f"Assignment Reason: {reason}")
    print()

    print("=== Expected Result ===")
    print("- Distance should be ~1km (< 5km constraint)")
    print("- Reason should show [VIOLATION] status")
    print("- System should indicate automatic constraint relaxation")


if __name__ == "__main__":
    test_forced_violation()
