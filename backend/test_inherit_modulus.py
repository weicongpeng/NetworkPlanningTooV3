"""
测试 inherit_modulus 配置对 PCI 分配的影响

问题：当 inherit_modulus=False 时，同站小区可能分配到相同模值的 PCI
"""

import asyncio
from app.algorithms.pci_planning_service_v2 import (
    PlanningConfig,
    run_pci_planning,
)
from app.models.schemas import NetworkType


async def test_inherit_modulus_false():
    """测试：inherit_modulus=False 的情况"""
    print("=" * 60)
    print("测试：inherit_modulus=False")
    print("=" * 60)

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

    # inherit_modulus=False（默认值）
    config = PlanningConfig(
        network_type=NetworkType.LTE,
        distance_threshold=3.0,
        pci_modulus=3,
        inherit_modulus=False,  # 不继承模数
    )

    def progress_callback(progress: float):
        pass

    result = await run_pci_planning(
        config=config,
        sites_data=sites_data,
        progress_callback=progress_callback,
    )

    print("\n规划结果 (inherit_modulus=False):")
    all_pcis = []
    all_mods = []
    for site in result["results"]:
        print(f"\n站点 {site['siteName']}:")
        for sector in site["sectors"]:
            pci = sector["newPCI"]
            mod = sector["newMod"]
            all_pcis.append(pci)
            all_mods.append(mod)
            print(f"  {sector['sectorName']}: PCI={pci}, mod={mod}")

    print(f"\n所有 PCI 列表：{all_pcis}")
    print(f"所有 mod 列表：{all_mods}")
    print(f"mod 去重后：{set(all_mods)}")

    if len(all_pcis) != len(set(all_pcis)):
        print(f"\n[CONFLICT] PCI 冲突!")
    elif len(set(all_mods)) == 1:
        print(f"\n[WARNING] 所有小区模值相同 (mod={all_mods[0]})!")
    else:
        print(f"\n[OK] 无 PCI 冲突，模值分布正常")


async def test_inherit_modulus_true():
    """测试：inherit_modulus=True 的情况"""
    print("\n" + "=" * 60)
    print("测试：inherit_modulus=True")
    print("=" * 60)

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
                    "pci": 100,  # 原有 PCI
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
                    "pci": 101,  # 原有 PCI
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
                    "pci": 102,  # 原有 PCI
                    "earfcn": 1850,
                },
            ],
        },
    ]

    # inherit_modulus=True
    config = PlanningConfig(
        network_type=NetworkType.LTE,
        distance_threshold=3.0,
        pci_modulus=3,
        inherit_modulus=True,  # 继承模数
    )

    def progress_callback(progress: float):
        pass

    result = await run_pci_planning(
        config=config,
        sites_data=sites_data,
        progress_callback=progress_callback,
    )

    print("\n规划结果 (inherit_modulus=True):")
    all_pcis = []
    all_mods = []
    for site in result["results"]:
        print(f"\n站点 {site['siteName']}:")
        for sector in site["sectors"]:
            pci = sector["newPCI"]
            original_pci = sector["originalPCI"]
            mod = sector["newMod"]
            all_pcis.append(pci)
            all_mods.append(mod)
            print(f"  {sector['sectorName']}: original_pci={original_pci}, new_pci={pci}, mod={mod}")

    print(f"\n所有 PCI 列表：{all_pcis}")
    print(f"所有 mod 列表：{all_mods}")
    print(f"mod 去重后：{set(all_mods)}")

    if len(all_pcis) != len(set(all_pcis)):
        print(f"\n[CONFLICT] PCI 冲突!")
    else:
        print(f"\n[OK] 无 PCI 冲突")


if __name__ == "__main__":
    print("PCI 同站冲突 - inherit_modulus 配置测试")
    print("=" * 60)

    asyncio.run(test_inherit_modulus_false())
    asyncio.run(test_inherit_modulus_true())

    print("\n" + "=" * 60)
    print("测试完成")
