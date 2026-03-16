"""
测试同站点同频小区 PCI 冲突问题

问题描述：PCI 规划结果中，同站点的多个同频小区被分配了相同的 PCI，这是不允许的。
"""

import asyncio
from typing import List, Dict
from app.algorithms.pci_planning_service_v2 import (
    PCIPlanningService,
    PlanningConfig,
    SiteSectorInfo,
)
from app.models.schemas import NetworkType


def create_test_data_same_site_same_frequency():
    """创建测试数据：同站点 3 个同频小区"""
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
                    "pci": None,  # 待规划
                    "earfcn": 1850,  # 同频
                },
                {
                    "id": "cell_002",
                    "name": "Cell_002",
                    "longitude": 116.4074,
                    "latitude": 39.9042,
                    "azimuth": 120,
                    "beamwidth": 65,
                    "height": 30,
                    "pci": None,
                    "earfcn": 1850,  # 同频
                },
                {
                    "id": "cell_003",
                    "name": "Cell_003",
                    "longitude": 116.4074,
                    "latitude": 39.9042,
                    "azimuth": 240,
                    "beamwidth": 65,
                    "height": 30,
                    "pci": None,
                    "earfcn": 1850,  # 同频
                },
            ],
        },
    ]
    return sites_data


def test_same_site_pci_assignment():
    """测试同站点 PCI 分配逻辑"""
    print("=" * 60)
    print("测试：同站点同频小区 PCI 分配")
    print("=" * 60)

    sites_data = create_test_data_same_site_same_frequency()

    # 创建规划服务
    config = PlanningConfig(
        network_type=NetworkType.LTE,
        distance_threshold=3.0,
        pci_modulus=3,
    )

    service = PCIPlanningService(config)

    # 创建 SiteSectorInfo 列表（模拟 plan 方法中的解析逻辑）
    all_sectors: List[SiteSectorInfo] = []
    for site in sites_data:
        site_id = site["id"]
        for sector_data in site["sectors"]:
            all_sectors.append(
                SiteSectorInfo(
                    id=sector_data["id"],
                    site_id=site_id,
                    name=sector_data["name"],
                    longitude=sector_data["longitude"],
                    latitude=sector_data["latitude"],
                    azimuth=sector_data["azimuth"],
                    beamwidth=sector_data["beamwidth"],
                    height=sector_data["height"],
                    pci=sector_data["pci"],
                    earfcn=sector_data["earfcn"],
                )
            )

    print(f"\n输入数据：{len(all_sectors)} 个小区")
    for sector in all_sectors:
        print(f"  - {sector.id}: lat={sector.latitude}, lon={sector.longitude}, earfcn={sector.earfcn}")

    # 测试 get_same_site_sectors 方法
    print("\n--- 测试 get_same_site_sectors ---")
    for i, sector in enumerate(all_sectors):
        same_site = service.get_same_site_sectors(
            sector.latitude, sector.longitude, sector.id, all_sectors
        )
        print(f"\n{sector.id} 的同站点小区:")
        for s in same_site:
            print(f"  - {s.id} (earfcn={s.earfcn}, pci={s.pci})")

    # 模拟 PCI 分配过程
    print("\n--- 模拟 PCI 分配过程 ---")

    for i, sector in enumerate(all_sectors):
        print(f"\n[{i+1}/{len(all_sectors)}] 分配 {sector.id}:")
        print(f"  当前位置：assigned_pcis={len(service.assigned_pcis)}")

        # 调用 get_available_pcis
        available_pcis = service.get_available_pcis(
            sector.latitude,
            sector.longitude,
            sector.earfcn,
            sector.id,
            all_sectors,
            preferred_mod=None,
        )

        print(f"  可用 PCI 数量：{len(available_pcis)}")
        if available_pcis:
            print(f"  前 5 个可用 PCI: {[(p, d) for p, d in available_pcis[:5]]}")

            # 分配第一个 PCI
            assigned_pci, min_distance = available_pcis[0]
            service.assigned_pcis.append(
                (assigned_pci, sector.latitude, sector.longitude, sector.earfcn)
            )
            print(f"  分配 PCI={assigned_pci}, min_distance={min_distance:.2f}km")
            print(f"  更新后 assigned_pcis={len(service.assigned_pcis)}")
        else:
            print(f"  错误：没有可用 PCI!")

    # 检查最终结果
    print("\n--- 最终检查结果 ---")
    print(f"assigned_pcis 列表:")
    for pci, lat, lon, earfcn in service.assigned_pcis:
        print(f"  PCI={pci}, earfcn={earfcn}, pos=({lat}, {lon})")

    # 检查是否有同站同 PCI
    print("\n检查同站同 PCI 冲突:")
    site_pcis: Dict[str, List[tuple]] = {}
    for pci, lat, lon, earfcn in service.assigned_pcis:
        key = f"{lat:.4f},{lon:.4f}"
        if key not in site_pcis:
            site_pcis[key] = []
        site_pcis[key].append((pci, earfcn))

    has_conflict = False
    for site_key, pci_list in site_pcis.items():
        print(f"\n站点 {site_key}:")
        pci_values = [p[0] for p in pci_list]
        if len(pci_values) != len(set(pci_values)):
            print(f"  [CONFLICT] PCI 列表：{pci_values}")
            # 找出重复的 PCI
            from collections import Counter
            counter = Counter(pci_values)
            for pci, count in counter.items():
                if count > 1:
                    print(f"     PCI {pci} 重复 {count} 次")
            has_conflict = True
        else:
            print(f"  [OK] 无冲突，PCI 列表：{pci_values}")

    if not has_conflict:
        print("\n[测试通过] 同站点小区分配了不同的 PCI!")


async def run_full_plan_test():
    """运行完整的规划流程测试"""
    print("\n" + "=" * 60)
    print("测试：完整规划流程 (run_pci_planning)")
    print("=" * 60)

    from app.algorithms.pci_planning_service_v2 import run_pci_planning

    sites_data = create_test_data_same_site_same_frequency()

    config = PlanningConfig(
        network_type=NetworkType.LTE,
        distance_threshold=3.0,
        pci_modulus=3,
    )

    def progress_callback(progress: float):
        print(f"进度：{progress:.1f}%")

    result = await run_pci_planning(
        config=config,
        sites_data=sites_data,
        progress_callback=progress_callback,
    )

    print("\n规划结果:")
    print(f"  总站点数：{result['totalSites']}")
    print(f"  总小区数：{result['totalSectors']}")
    print(f"  碰撞数：{result['collisions']}")
    print(f"  混淆数：{result['confusions']}")

    print("\n各小区 PCI 分配:")
    for site in result["results"]:
        print(f"\n站点 {site['siteName']}:")
        pcis = []
        for sector in site["sectors"]:
            pci = sector["newPCI"]
            pcis.append(pci)
            print(f"  {sector['sectorName']}: PCI={pci}, earfcn={sector['earfcn']}")

        # 检查冲突
        if len(pcis) != len(set(pcis)):
            print(f"  [CONFLICT] 同站点有相同 PCI: {pcis}")
        else:
            print(f"  [OK] 无冲突，PCI 列表：{pcis}")


if __name__ == "__main__":
    print("PCI 同站冲突诊断测试")
    print("=" * 60)

    # 测试 1：同站点 PCI 分配逻辑
    test_same_site_pci_assignment()

    # 测试 2：完整规划流程
    asyncio.run(run_full_plan_test())

    print("\n" + "=" * 60)
    print("测试完成")
