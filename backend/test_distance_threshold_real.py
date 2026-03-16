"""
测试距离阈值在近距离小区上的实际效果
"""

import asyncio
from app.algorithms.pci_planning_service_v2 import PlanningConfig, run_pci_planning
from app.models.schemas import NetworkType


async def test_close_sites_same_1km():
    """测试近距离站点 - 1km阈值（不应允许相同PCI）"""
    config = PlanningConfig(
        network_type=NetworkType.LTE,
        distance_threshold=1.0,  # 1km - 相距0.8km的两个站点应该不能使用相同PCI
        pci_modulus=3,
        inherit_modulus=False,
        pci_range=(0, 20),  # 限制PCI范围
    )

    # 两个站点相距0.8km
    sites_data = [
        {
            "id": "site1",
            "name": "站点1",
            "longitude": 116.4074,
            "latitude": 39.9042,
            "networkType": "LTE",
            "sectors": [
                {
                    "id": "1",
                    "name": "扇区1",
                    "longitude": 116.4074,
                    "latitude": 39.9042,
                    "azimuth": 0,
                    "beamwidth": 65,
                    "height": 30,
                    "pci": None,
                    "earfcn": 1850.0,
                }
            ],
        },
        {
            "id": "site2",
            "name": "站点2",
            "longitude": 116.4174,  # 约0.8km
            "latitude": 39.9042,
            "networkType": "LTE",
            "sectors": [
                {
                    "id": "2",
                    "name": "扇区2",
                    "longitude": 116.4174,
                    "latitude": 39.9042,
                    "azimuth": 0,
                    "beamwidth": 65,
                    "height": 30,
                    "pci": None,
                    "earfcn": 1850.0,
                }
            ],
        },
    ]

    result = await run_pci_planning(config, sites_data)

    print("=" * 60)
    print("测试: 距离阈值 = 1km (站点间距约0.8km)")
    print("=" * 60)

    pci1 = result["results"][0]["sectors"][0]["newPCI"]
    pci2 = result["results"][1]["sectors"][0]["newPCI"]

    print(f"站点1 PCI: {pci1}")
    print(f"站点2 PCI: {pci2}")

    if pci1 == pci2:
        print("❌ 失败: 两个站点使用相同PCI（违反1km阈值）")
    else:
        print("✅ 正确: 两个站点使用不同PCI")

    return pci1, pci2


async def test_close_sites_5km():
    """测试近距离站点 - 5km阈值（可以允许相同PCI，因为0.8km < 5km）"""
    config = PlanningConfig(
        network_type=NetworkType.LTE,
        distance_threshold=5.0,  # 5km - 相距0.8km的两个站点可以使用相同PCI（如果模值不同）
        pci_modulus=3,
        inherit_modulus=False,
        pci_range=(0, 20),
    )

    # 相同的测试数据
    sites_data = [
        {
            "id": "site1",
            "name": "站点1",
            "longitude": 116.4074,
            "latitude": 39.9042,
            "networkType": "LTE",
            "sectors": [
                {
                    "id": "1",
                    "name": "扇区1",
                    "longitude": 116.4074,
                    "latitude": 39.9042,
                    "azimuth": 0,
                    "beamwidth": 65,
                    "height": 30,
                    "pci": None,
                    "earfcn": 1850.0,
                }
            ],
        },
        {
            "id": "site2",
            "name": "站点2",
            "longitude": 116.4174,
            "latitude": 39.9042,
            "networkType": "LTE",
            "sectors": [
                {
                    "id": "2",
                    "name": "扇区2",
                    "longitude": 116.4174,
                    "latitude": 39.9042,
                    "azimuth": 0,
                    "beamwidth": 65,
                    "height": 30,
                    "pci": None,
                    "earfcn": 1850.0,
                }
            ],
        },
    ]

    result = await run_pci_planning(config, sites_data)

    print("=" * 60)
    print("测试: 距离阈值 = 5km (站点间距约0.8km)")
    print("=" * 60)

    pci1 = result["results"][0]["sectors"][0]["newPCI"]
    pci2 = result["results"][1]["sectors"][0]["newPCI"]
    pci1_mod = pci1 % 3
    pci2_mod = pci2 % 3

    print(f"站点1: PCI={pci1}, Mod={pci1_mod}")
    print(f"站点2: PCI={pci2}, Mod={pci2_mod}")

    if pci1 == pci2:
        print("❌ 失败: 两个站点使用相同PCI（模值冲突）")
    elif pci1_mod == pci2_mod:
        print("❌ 失败: 两个站点PCI模值相同（Mod3冲突）")
    else:
        print("✅ 正确: 两个站点可以使用相同PCI（距离<5km，且模值不同）")

    return pci1, pci2


async def test_distance_threshold_parameter():
    """测试参数是否正确传递"""

    # 检查1km阈值
    config_1km = PlanningConfig(
        network_type=NetworkType.LTE, distance_threshold=1.0, pci_modulus=3
    )
    print(f"1km测试配置:")
    print(f"  network_type: {config_1km.network_type}")
    print(f"  distance_threshold: {config_1km.distance_threshold}")
    print(f"  pci_modulus: {config_1km.pci_modulus}")

    # 检查5km阈值
    config_5km = PlanningConfig(
        network_type=NetworkType.LTE, distance_threshold=5.0, pci_modulus=3
    )
    print(f"\n5km测试配置:")
    print(f"  network_type: {config_5km.network_type}")
    print(f"  distance_threshold: {config_5km.distance_threshold}")
    print(f"  pci_modulus: {config_5km.pci_modulus}")


async def main():
    print("测试距离阈值参数是否正确传递和应用\n")

    # 测试参数传递
    await test_distance_threshold_parameter()

    print("\n" + "=" * 80)
    print("场景测试: 距离阈值在近距离站点上的实际效果")
    print("=" * 80)

    # 测试1km阈值
    print("\n第1个测试: 距离阈值 = 1km")
    print("-" * 80)
    pci1_1km, pci2_1km = await test_close_sites_same_1km()

    # 测试5km阈值
    print("\n第2个测试: 距离阈值 = 5km")
    print("-" * 80)
    pci1_5km, pci2_5km = await test_close_sites_5km()

    # 对比分析
    print("\n" + "=" * 80)
    print("对比分析")
    print("=" * 80)
    print(f"1km阈值测试: PCI1={pci1_1km}, PCI2={pci2_1km}")
    print(f"5km阈值测试: PCI1={pci1_5km}, PCI2={pci2_5km}")

    if pci1_1km == pci2_1km and pci1_5km == pci2_5km:
        print("\n❌ 严重问题: 两个阈值测试的PCI分配完全相同！")
        print("   距离阈值参数没有影响PCI分配逻辑。")
        print("\n可能原因:")
        print("  1. 距离阈值只用于验证，不影响PCI分配策略")
        print("  2. 两个测试都使用了相同的规划算法（贪心算法按顺序分配）")
        print("   3. 小区顺序固定，第一个小区总是得到PCI 0，第二个得到PCI 1")
        print("\n建议修复:")
        print("  - 需要确保距离阈值影响PCI分配，而不仅仅是验证")
        print("  - 或者：在相同距离阈值下，PCI分配应该是相同的")
        print("  - 但在不同距离阈值下，允许使用不同的PCI")
    else:
        print("\n✅ 距离阈值有效: 1km和5km产生了不同的PCI分配结果")


if __name__ == "__main__":
    asyncio.run(main())
