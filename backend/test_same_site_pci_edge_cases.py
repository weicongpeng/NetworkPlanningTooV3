"""
测试同站点 PCI 冲突的边界情况

重点测试：
1. 频点为 0 的情况
2. 频点字段缺失的情况
3. 不同频点格式的情况
"""

import asyncio
from typing import List, Dict
from app.algorithms.pci_planning_service_v2 import (
    PCIPlanningService,
    PlanningConfig,
    SiteSectorInfo,
)
from app.models.schemas import NetworkType


def test_same_frequency_with_zero_earfcn():
    """测试频点为 0 的情况"""
    print("=" * 60)
    print("测试：频点为 0 的情况")
    print("=" * 60)

    # 创建频点为 0 的测试数据（LTE 中 earfcn=0 是有效值）
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
                    "earfcn": 0,  # 频点为 0（有效值）
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
                    "earfcn": 0,  # 频点为 0（同频）
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
                    "earfcn": 0,  # 频点为 0（同频）
                },
            ],
        },
    ]

    config = PlanningConfig(
        network_type=NetworkType.LTE,
        distance_threshold=3.0,
        pci_modulus=3,
    )

    service = PCIPlanningService(config)

    # 解析数据
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

    # 测试频点判断
    print("\n测试 _is_same_frequency 方法:")
    print(f"  _is_same_frequency(0, 0) = {service._is_same_frequency(0, 0)}")
    print(f"  _is_same_frequency(0, None) = {service._is_same_frequency(0, None)}")
    print(f"  _is_same_frequency(None, None) = {service._is_same_frequency(None, None)}")
    print(f"  _is_same_frequency_or_unknown(0, 0) = {service._is_same_frequency_or_unknown(0, 0)}")
    print(f"  _is_same_frequency_or_unknown(0, None) = {service._is_same_frequency_or_unknown(0, None)}")
    print(f"  _is_same_frequency_or_unknown(None, None) = {service._is_same_frequency_or_unknown(None, None)}")

    # 模拟 PCI 分配
    print("\n模拟 PCI 分配:")
    for i, sector in enumerate(all_sectors):
        print(f"\n[{i+1}] 分配 {sector.id} (earfcn={sector.earfcn}):")

        available_pcis = service.get_available_pcis(
            sector.latitude,
            sector.longitude,
            sector.earfcn,
            sector.id,
            all_sectors,
            preferred_mod=None,
        )

        if available_pcis:
            assigned_pci, min_distance = available_pcis[0]
            service.assigned_pcis.append(
                (assigned_pci, sector.latitude, sector.longitude, sector.earfcn)
            )
            print(f"  分配 PCI={assigned_pci}")
        else:
            print(f"  [ERROR] 没有可用 PCI!")

    # 检查结果
    print("\n最终结果:")
    for pci, lat, lon, earfcn in service.assigned_pcis:
        print(f"  PCI={pci}, earfcn={earfcn}")

    pcis = [p[0] for p in service.assigned_pcis]
    if len(pcis) != len(set(pcis)):
        print(f"\n[CONFLICT] 同站点 PCI 冲突：{pcis}")
    else:
        print(f"\n[OK] 无冲突，PCI: {pcis}")


def test_missing_earfcn():
    """测试频点缺失的情况"""
    print("\n" + "=" * 60)
    print("测试：频点缺失 (None) 的情况")
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
                    "earfcn": None,  # 频点缺失
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
                    "earfcn": None,  # 频点缺失
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
                    "earfcn": None,  # 频点缺失
                },
            ],
        },
    ]

    config = PlanningConfig(
        network_type=NetworkType.LTE,
        distance_threshold=3.0,
        pci_modulus=3,
    )

    service = PCIPlanningService(config)

    all_sectors: List[SiteSectorInfo] = []
    for site in sites_data:
        for sector_data in site["sectors"]:
            all_sectors.append(
                SiteSectorInfo(
                    id=sector_data["id"],
                    site_id=site["id"],
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

    print("\n模拟 PCI 分配 (earfcn=None):")
    for i, sector in enumerate(all_sectors):
        print(f"\n[{i+1}] 分配 {sector.id} (earfcn={sector.earfcn}):")

        available_pcis = service.get_available_pcis(
            sector.latitude,
            sector.longitude,
            sector.earfcn,
            sector.id,
            all_sectors,
            preferred_mod=None,
        )

        if available_pcis:
            assigned_pci, min_distance = available_pcis[0]
            service.assigned_pcis.append(
                (assigned_pci, sector.latitude, sector.longitude, sector.earfcn)
            )
            print(f"  分配 PCI={assigned_pci}")
        else:
            print(f"  [ERROR] 没有可用 PCI!")

    print("\n最终结果:")
    pcis = [p[0] for p in service.assigned_pcis]
    if len(pcis) != len(set(pcis)):
        print(f"  [CONFLICT] PCI 冲突：{pcis}")
    else:
        print(f"  [OK] PCI: {pcis}")


def test_mixed_earfcn():
    """测试混合频点情况（部分有值，部分为 None）"""
    print("\n" + "=" * 60)
    print("测试：混合频点情况")
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
                    "earfcn": 1850,  # 有频点
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
                    "earfcn": None,  # 无频点
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
                    "earfcn": 1850,  # 有频点（与 cell_001 同频）
                },
            ],
        },
    ]

    config = PlanningConfig(
        network_type=NetworkType.LTE,
        distance_threshold=3.0,
        pci_modulus=3,
    )

    service = PCIPlanningService(config)

    all_sectors: List[SiteSectorInfo] = []
    for site in sites_data:
        for sector_data in site["sectors"]:
            all_sectors.append(
                SiteSectorInfo(
                    id=sector_data["id"],
                    site_id=site["id"],
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

    print("\n模拟 PCI 分配 (混合频点):")
    for i, sector in enumerate(all_sectors):
        print(f"\n[{i+1}] 分配 {sector.id} (earfcn={sector.earfcn}):")

        available_pcis = service.get_available_pcis(
            sector.latitude,
            sector.longitude,
            sector.earfcn,
            sector.id,
            all_sectors,
            preferred_mod=None,
        )

        if available_pcis:
            assigned_pci, min_distance = available_pcis[0]
            service.assigned_pcis.append(
                (assigned_pci, sector.latitude, sector.longitude, sector.earfcn)
            )
            print(f"  分配 PCI={assigned_pci}")
        else:
            print(f"  [ERROR] 没有可用 PCI!")

    print("\n最终结果:")
    for pci, lat, lon, earfcn in service.assigned_pcis:
        print(f"  PCI={pci}, earfcn={earfcn}")

    pcis = [p[0] for p in service.assigned_pcis]
    if len(pcis) != len(set(pcis)):
        print(f"\n[CONFLICT] PCI 冲突：{pcis}")
    else:
        print(f"\n[OK] PCI: {pcis}")


if __name__ == "__main__":
    print("PCI 同站冲突边界情况测试")
    print("=" * 60)

    test_same_frequency_with_zero_earfcn()
    test_missing_earfcn()
    test_mixed_earfcn()

    print("\n" + "=" * 60)
    print("测试完成")
