"""
测试已有 PCI 小区的冲突问题

场景：某些小区已经有 PCI，新加入的小区可能与已有 PCI 冲突
"""

import asyncio
from app.algorithms.pci_planning_service_v2 import (
    PlanningConfig,
    run_pci_planning,
)
from app.models.schemas import NetworkType


async def test_existing_pci_conflict():
    """测试：已有 PCI 的小区导致冲突"""
    print("=" * 60)
    print("测试：已有 PCI 的小区导致冲突")
    print("=" * 60)

    # 创建测试数据：2 个小区已有 PCI，1 个小区待规划
    sites_data = [
        {
            "id": "site_001",
            "name": "Test_Site_001",
            "networkType": "LTE",
            "longitude": 116.4074,
            "latitude": 39.9042,
            "sectors": [
                {
                    "id": "cell_001",
                    "name": "Cell_001",
                    "longitude": 116.4074,
                    "latitude": 39.9042,
                    "azimuth": 0,
                    "beamwidth": 65,
                    "height": 30,
                    "pci": 100,  # 已有 PCI
                    "earfcn": 1850,
                },
                {
                    "id": "cell_002",
                    "name": "Cell_002",
                    "longitude": 116.4074,
                    "latitude": 39.9042,
                    "azimuth": 120,
                    "beamwidth": 65,
                    "height": 30,
                    "pci": 100,  # 已有 PCI（与 cell_001 相同，这是冲突的）
                    "earfcn": 1850,
                },
                {
                    "id": "cell_003",
                    "name": "Cell_003",
                    "longitude": 116.4074,
                    "latitude": 39.9042,
                    "azimuth": 240,
                    "beamwidth": 65,
                    "height": 30,
                    "pci": None,  # 待规划
                    "earfcn": 1850,
                },
            ],
        },
    ]

    config = PlanningConfig(
        network_type=NetworkType.LTE,
        distance_threshold=3.0,
        pci_modulus=3,
    )

    def progress_callback(progress: float):
        pass

    result = await run_pci_planning(
        config=config,
        sites_data=sites_data,
        progress_callback=progress_callback,
    )

    print("\n规划结果:")
    all_pcis = []
    for site in result["results"]:
        print(f"\n站点 {site['siteName']}:")
        for sector in site["sectors"]:
            pci = sector["newPCI"]
            original_pci = sector["originalPCI"]
            all_pcis.append(pci)
            print(f"  {sector['sectorName']}: original_pci={original_pci}, new_pci={pci}")

    print(f"\n所有 PCI 列表：{all_pcis}")

    if len(all_pcis) != len(set(all_pcis)):
        print(f"\n[CONFLICT] 检测到 PCI 冲突!")
    else:
        print(f"\n[OK] 无 PCI 冲突")


async def test_existing_pci_different_values():
    """测试：已有不同 PCI 的小区"""
    print("\n" + "=" * 60)
    print("测试：已有不同 PCI 的小区")
    print("=" * 60)

    # 创建测试数据：2 个小区已有不同的 PCI，1 个小区待规划
    sites_data = [
        {
            "id": "site_001",
            "name": "Test_Site_001",
            "networkType": "LTE",
            "longitude": 116.4074,
            "latitude": 39.9042,
            "sectors": [
                {
                    "id": "cell_001",
                    "name": "Cell_001",
                    "longitude": 116.4074,
                    "latitude": 39.9042,
                    "azimuth": 0,
                    "beamwidth": 65,
                    "height": 30,
                    "pci": 100,  # 已有 PCI
                    "earfcn": 1850,
                },
                {
                    "id": "cell_002",
                    "name": "Cell_002",
                    "longitude": 116.4074,
                    "latitude": 39.9042,
                    "azimuth": 120,
                    "beamwidth": 65,
                    "height": 30,
                    "pci": 101,  # 已有 PCI（与 cell_001 不同）
                    "earfcn": 1850,
                },
                {
                    "id": "cell_003",
                    "name": "Cell_003",
                    "longitude": 116.4074,
                    "latitude": 39.9042,
                    "azimuth": 240,
                    "beamwidth": 65,
                    "height": 30,
                    "pci": None,  # 待规划
                    "earfcn": 1850,
                },
            ],
        },
    ]

    config = PlanningConfig(
        network_type=NetworkType.LTE,
        distance_threshold=3.0,
        pci_modulus=3,
    )

    def progress_callback(progress: float):
        pass

    result = await run_pci_planning(
        config=config,
        sites_data=sites_data,
        progress_callback=progress_callback,
    )

    print("\n规划结果:")
    all_pcis = []
    for site in result["results"]:
        print(f"\n站点 {site['siteName']}:")
        for sector in site["sectors"]:
            pci = sector["newPCI"]
            original_pci = sector["originalPCI"]
            all_pcis.append(pci)
            print(f"  {sector['sectorName']}: original_pci={original_pci}, new_pci={pci}")

    print(f"\n所有 PCI 列表：{all_pcis}")

    if len(all_pcis) != len(set(all_pcis)):
        print(f"\n[CONFLICT] 检测到 PCI 冲突!")
    else:
        print(f"\n[OK] 无 PCI 冲突")


async def test_pci_zero_conflict():
    """测试：已有 PCI 为 0 的情况"""
    print("\n" + "=" * 60)
    print("测试：已有 PCI 为 0 的情况")
    print("=" * 60)

    # 创建测试数据：小区已有 PCI 为 0
    sites_data = [
        {
            "id": "site_001",
            "name": "Test_Site_001",
            "networkType": "LTE",
            "longitude": 116.4074,
            "latitude": 39.9042,
            "sectors": [
                {
                    "id": "cell_001",
                    "name": "Cell_001",
                    "longitude": 116.4074,
                    "latitude": 39.9042,
                    "azimuth": 0,
                    "beamwidth": 65,
                    "height": 30,
                    "pci": 0,  # PCI 为 0（有效值）
                    "earfcn": 1850,
                },
                {
                    "id": "cell_002",
                    "name": "Cell_002",
                    "longitude": 116.4074,
                    "latitude": 39.9042,
                    "azimuth": 120,
                    "beamwidth": 65,
                    "height": 30,
                    "pci": 0,  # PCI 为 0（与 cell_001 相同）
                    "earfcn": 1850,
                },
                {
                    "id": "cell_003",
                    "name": "Cell_003",
                    "longitude": 116.4074,
                    "latitude": 39.9042,
                    "azimuth": 240,
                    "beamwidth": 65,
                    "height": 30,
                    "pci": None,  # 待规划
                    "earfcn": 1850,
                },
            ],
        },
    ]

    config = PlanningConfig(
        network_type=NetworkType.LTE,
        distance_threshold=3.0,
        pci_modulus=3,
    )

    def progress_callback(progress: float):
        pass

    result = await run_pci_planning(
        config=config,
        sites_data=sites_data,
        progress_callback=progress_callback,
    )

    print("\n规划结果:")
    all_pcis = []
    for site in result["results"]:
        print(f"\n站点 {site['siteName']}:")
        for sector in site["sectors"]:
            pci = sector["newPCI"]
            original_pci = sector["originalPCI"]
            all_pcis.append(pci)
            print(f"  {sector['sectorName']}: original_pci={original_pci}, new_pci={pci}")

    print(f"\n所有 PCI 列表：{all_pcis}")

    if len(all_pcis) != len(set(all_pcis)):
        print(f"\n[CONFLICT] 检测到 PCI 冲突!")
    else:
        print(f"\n[OK] 无 PCI 冲突")


if __name__ == "__main__":
    print("PCI 同站冲突 - 已有 PCI 问题测试")
    print("=" * 60)

    asyncio.run(test_existing_pci_conflict())
    asyncio.run(test_existing_pci_different_values())
    asyncio.run(test_pci_zero_conflict())

    print("\n" + "=" * 60)
    print("测试完成")
