"""
测试距离阈值参数是否正确接收和应用
"""

import asyncio
from app.algorithms.pci_planning_service_v2 import PlanningConfig, run_pci_planning
from app.models.schemas import NetworkType


async def test_distance_threshold_1km():
    """测试1km距离阈值"""
    config = PlanningConfig(
        network_type=NetworkType.LTE,
        distance_threshold=1.0,  # 1km
        pci_modulus=3,
        inherit_modulus=False,
        pci_range=(0, 100),  # 限制范围以便观察复用距离
    )

    # 模拟数据：两个距离0.8km的小区
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
    print(f"测试: 距离阈值 = 1km")
    print("=" * 60)
    for site in result["results"]:
        for sector in site["sectors"]:
            print(f"小区 {sector['sectorName']}:")
            print(f"  新PCI: {sector['newPCI']}")
            print(f"  分配原因: {sector.get('assignmentReason', 'N/A')}")
            if "minReuseDistance" in sector:
                print(f"  最小复用距离: {sector['minReuseDistance']:.2f}km")
                if sector["minReuseDistance"] < 1.0:
                    print(f"  ❌ 警告: 复用距离 < 1km (阈值违规!)")
                else:
                    print(f"  ✅ 复用距离 >= 1km (符合阈值)")
            print()

    return result


async def test_distance_threshold_5km():
    """测试5km距离阈值"""
    config = PlanningConfig(
        network_type=NetworkType.LTE,
        distance_threshold=5.0,  # 5km
        pci_modulus=3,
        inherit_modulus=False,
        pci_range=(0, 100),  # 限制范围以便观察复用距离
    )

    # 使用相同的测试数据
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
    print(f"测试: 距离阈值 = 5km")
    print("=" * 60)
    for site in result["results"]:
        for sector in site["sectors"]:
            print(f"小区 {sector['sectorName']}:")
            print(f"  新PCI: {sector['newPCI']}")
            print(f"  分配原因: {sector.get('assignmentReason', 'N/A')}")
            if "minReuseDistance" in sector:
                print(f"  最小复用距离: {sector['minReuseDistance']:.2f}km")
                if sector["minReuseDistance"] < 5.0:
                    print(f"  ❌ 警告: 复用距离 < 5km (阈值违规!)")
                else:
                    print(f"  ✅ 复用距离 >= 5km (符合阈值)")
            print()

    return result


async def main():
    print("测试距离阈值是否正确应用\n")

    # 测试1km阈值
    print("\n" + "=" * 60)
    print("第1个测试: 距离阈值 = 1km")
    print("=" * 60)
    result_1km = await test_distance_threshold_1km()

    print("\n" + "=" * 60)
    print("第2个测试: 距离阈值 = 5km")
    print("=" * 60)
    result_5km = await test_distance_threshold_5km()

    # 比较
    print("\n" + "=" * 60)
    print("对比分析")
    print("=" * 60)

    pci1_1km = result_1km["results"][0]["sectors"][0]["newPCI"]
    pci2_1km = result_1km["results"][1]["sectors"][0]["newPCI"]
    distance1_1km = result_1km["results"][0]["sectors"][0]["minReuseDistance"]

    pci1_5km = result_5km["results"][0]["sectors"][0]["newPCI"]
    pci2_5km = result_5km["results"][1]["sectors"][0]["newPCI"]
    distance1_5km = result_5km["results"][0]["sectors"][0]["minReuseDistance"]

    print(f"1km阈值测试:")
    print(f"  扇准PCI: {pci1_1km}")
    print(f"  复用距离: {distance1_1km:.2f}km")
    print(f"  是否满足 >= 1km: {'✅' if distance1_1km >= 1.0 else '❌'}")

    print(f"\n5km阈值测试:")
    print(f"  标准PCI: {pci1_5km}")
    print(f"  复用距离: {distance1_5km:.2f}km")
    print(f"  是否满足 >= 5km: {'✅' if distance1_5km >= 5.0 else '❌'}")

    if pci1_1km == pci1_5km and distance1_1km == distance1_5km:
        print("\n❌ 问题确认: 两个测试的PCI和复用距离完全相同！")
        print("   这证明距离阈值没有正确应用。")
    else:
        print("\n✅ 距离阈值应用正确!")


if __name__ == "__main__":
    asyncio.run(main())
