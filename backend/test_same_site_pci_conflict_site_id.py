"""
测试同站点不同 site_id 导致的 PCI 冲突问题

根本原因：当两个小区的经纬度相同但 site_id 不同时，
它们不会被分组到同一个站点，导致可能分配相同的 PCI。
"""

import asyncio
from app.algorithms.pci_planning_service_v2 import (
    PlanningConfig,
    run_pci_planning,
)
from app.models.schemas import NetworkType


async def test_different_site_id_same_location():
    """测试：同站但 site_id 不同的情况"""
    print("=" * 60)
    print("测试：同站但 site_id 不同的情况")
    print("=" * 60)

    # 创建测试数据：3 个小区在同一位置，但 site_id 不同
    sites_data = [
        {
            "id": "site_001",  # 不同的 site_id
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
                    "pci": None,
                    "earfcn": 1850,
                },
            ],
        },
        {
            "id": "site_002",  # 不同的 site_id
            "name": "Test_Site_002",
            "networkType": "LTE",
            "longitude": 116.4074,  # 相同的经纬度
            "latitude": 39.9042,
            "sectors": [
                {
                    "id": "cell_002",
                    "name": "Cell_002",
                    "longitude": 116.4074,
                    "latitude": 39.9042,
                    "azimuth": 120,
                    "beamwidth": 65,
                    "height": 30,
                    "pci": None,
                    "earfcn": 1850,
                },
            ],
        },
        {
            "id": "site_003",  # 不同的 site_id
            "name": "Test_Site_003",
            "networkType": "LTE",
            "longitude": 116.4074,  # 相同的经纬度
            "latitude": 39.9042,
            "sectors": [
                {
                    "id": "cell_003",
                    "name": "Cell_003",
                    "longitude": 116.4074,
                    "latitude": 39.9042,
                    "azimuth": 240,
                    "beamwidth": 65,
                    "height": 30,
                    "pci": None,
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
    print(f"  总站点数：{result['totalSites']}")
    print(f"  总小区数：{result['totalSectors']}")

    print("\n各小区 PCI 分配:")
    all_pcis = []
    for site in result["results"]:
        print(f"\n站点 {site['siteName']} (id={site['siteId']}):")
        for sector in site["sectors"]:
            pci = sector["newPCI"]
            all_pcis.append(pci)
            print(f"  {sector['sectorName']}: PCI={pci}, earfcn={sector['earfcn']}")

    print(f"\n所有 PCI 列表：{all_pcis}")

    # 检查冲突
    if len(all_pcis) != len(set(all_pcis)):
        print(f"\n[CONFLICT] 检测到 PCI 冲突！重复的 PCI: {all_pcis}")
        from collections import Counter
        counter = Counter(all_pcis)
        for pci, count in counter.items():
            if count > 1:
                print(f"  PCI {pci} 重复 {count} 次")
    else:
        print(f"\n[OK] 无 PCI 冲突")


async def test_same_site_id_different_format():
    """测试：site_id 格式不一致的情况"""
    print("\n" + "=" * 60)
    print("测试：site_id 格式不一致的情况")
    print("=" * 60)

    # 创建测试数据：site_id 格式不一致
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
                    "pci": None,
                    "earfcn": 1850,
                },
                {
                    "id": "site_001_cell_002",  # 不同的 ID 格式（带前缀）
                    "name": "Cell_002",
                    "longitude": 116.4074,
                    "latitude": 39.9042,
                    "azimuth": 120,
                    "beamwidth": 65,
                    "height": 30,
                    "pci": None,
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
            all_pcis.append(pci)
            print(f"  {sector['sectorName']}: PCI={pci}")

    print(f"\n所有 PCI 列表：{all_pcis}")

    if len(all_pcis) != len(set(all_pcis)):
        print(f"\n[CONFLICT] 检测到 PCI 冲突!")
    else:
        print(f"\n[OK] 无 PCI 冲突")


if __name__ == "__main__":
    print("PCI 同站冲突 - site_id 问题测试")
    print("=" * 60)

    asyncio.run(test_different_site_id_same_location())
    asyncio.run(test_same_site_id_different_format())

    print("\n" + "=" * 60)
    print("测试完成")
