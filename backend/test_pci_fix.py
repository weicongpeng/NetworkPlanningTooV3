#!/usr/bin/env python3
"""
测试PCI规划修复效果
"""
import sys
import os
import asyncio

# 添加项目根目录到Python路径
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.algorithms.pci_planning_service_v2 import PCIPlanningService, PlanningConfig
from app.models.schemas import NetworkType


async def test_lte_pci_planning():
    """测试LTE PCI规划"""
    print("=== 测试LTE PCI规划 ===")
    
    # 创建规划配置
    config = PlanningConfig(
        network_type=NetworkType.LTE,
        distance_threshold=3.0,
        pci_modulus=3,
        inherit_modulus=False
    )
    
    # 创建PCI规划服务
    service = PCIPlanningService(config)
    
    # 模拟站点数据
    sites_data = [
        {
            "id": "site1",
            "name": "test_site_1",
            "networkType": "LTE",
            "sectors": [
                {
                    "id": "site1_sector1",
                    "name": "test_sector_1",
                    "longitude": 113.0,
                    "latitude": 23.0,
                    "azimuth": 0,
                    "earfcn": 1800.0,
                    "pci": None
                },
                {
                    "id": "site1_sector2",
                    "name": "test_sector_2",
                    "longitude": 113.0,
                    "latitude": 23.0,
                    "azimuth": 120,
                    "earfcn": 1800.0,
                    "pci": None
                },
                {
                    "id": "site1_sector3",
                    "name": "test_sector_3",
                    "longitude": 113.0,
                    "latitude": 23.0,
                    "azimuth": 240,
                    "earfcn": 1800.0,
                    "pci": None
                }
            ]
        },
        {
            "id": "site2",
            "name": "test_site_2",
            "networkType": "LTE",
            "sectors": [
                {
                    "id": "site2_sector1",
                    "name": "test_sector_4",
                    "longitude": 113.1,
                    "latitude": 23.1,
                    "azimuth": 0,
                    "earfcn": 1800.0,
                    "pci": None
                }
            ]
        }
    ]
    
    # 执行规划
    result = await service.plan(sites_data)
    
    # 验证结果
    print(f"规划完成，共 {result.total_sites} 个站点，{result.total_sectors} 个小区")
    print(f"碰撞数: {result.total_collisions}, 混淆数: {result.total_confusions}")
    
    # 检查每个小区的PCI
    all_pcis = []
    for site in result.sites:
        print(f"\n站点 {site.site_id} ({site.site_name}):")
        site_pcis = []
        for sector in site.sectors:
            pci = sector.new_pci
            all_pcis.append(pci)
            site_pcis.append(pci)
            print(f"  小区 {sector.sector_id}: PCI={pci}, 模3={pci%3}, 最小复用距离={sector.min_reuse_distance:.2f}km")
        
        # 检查同站点模3值是否错开
        site_mods = [pci % 3 for pci in site_pcis]
        if len(set(site_mods)) == len(site_pcis):
            print(f"  ✅ 同站点模3值已错开: {site_mods}")
        else:
            print(f"  ❌ 同站点模3值重复: {site_mods}")
    
    # 检查是否有PCI为-1的情况
    if any(pci == -1 for pci in all_pcis):
        print("\n❌ 发现PCI=-1的情况!")
    else:
        print("\n✅ 所有PCI值正常，没有出现-1!")
    
    # 检查最小复用距离
    min_distances = [sector.min_reuse_distance for site in result.sites for sector in site.sectors]
    if min_distances:
        print(f"最小复用距离范围: {min(min_distances):.2f}km - {max(min_distances):.2f}km")
        print("✅ 最小复用距离计算正常!")
    
    return result


async def test_nr_pci_planning():
    """测试NR PCI规划"""
    print("\n\n=== 测试NR PCI规划 ===")
    
    # 创建规划配置
    config = PlanningConfig(
        network_type=NetworkType.NR,
        distance_threshold=3.0,
        pci_modulus=30,
        inherit_modulus=False
    )
    
    # 创建PCI规划服务
    service = PCIPlanningService(config)
    
    # 模拟站点数据
    sites_data = [
        {
            "id": "nr_site1",
            "name": "nr_test_site_1",
            "networkType": "NR",
            "sectors": [
                {
                    "id": "nr_site1_sector1",
                    "name": "nr_test_sector_1",
                    "longitude": 113.0,
                    "latitude": 23.0,
                    "azimuth": 0,
                    "earfcn": 3500.0,
                    "pci": None
                },
                {
                    "id": "nr_site1_sector2",
                    "name": "nr_test_sector_2",
                    "longitude": 113.0,
                    "latitude": 23.0,
                    "azimuth": 120,
                    "earfcn": 3500.0,
                    "pci": None
                }
            ]
        }
    ]
    
    # 执行规划
    result = await service.plan(sites_data)
    
    # 验证结果
    print(f"规划完成，共 {result.total_sites} 个站点，{result.total_sectors} 个小区")
    
    # 检查每个小区的PCI
    all_pcis = []
    for site in result.sites:
        print(f"\n站点 {site.site_id} ({site.site_name}):")
        site_pcis = []
        for sector in site.sectors:
            pci = sector.new_pci
            all_pcis.append(pci)
            site_pcis.append(pci)
            mod3 = pci % 3
            mod30 = pci % 30
            print(f"  小区 {sector.sector_id}: PCI={pci}, 模3={mod3}, 模30={mod30}, 最小复用距离={sector.min_reuse_distance:.2f}km")
        
        # 检查同站点模3和模30值是否错开
        site_mods3 = [pci % 3 for pci in site_pcis]
        site_mods30 = [pci % 30 for pci in site_pcis]
        
        if len(set(site_mods3)) == len(site_pcis):
            print(f"  ✅ 同站点模3值已错开: {site_mods3}")
        else:
            print(f"  ❌ 同站点模3值重复: {site_mods3}")
        
        if len(set(site_mods30)) == len(site_pcis):
            print(f"  ✅ 同站点模30值已错开: {site_mods30}")
        else:
            print(f"  ❌ 同站点模30值重复: {site_mods30}")
    
    # 检查是否有PCI为-1的情况
    if any(pci == -1 for pci in all_pcis):
        print("\n❌ 发现PCI=-1的情况!")
    else:
        print("\n✅ 所有PCI值正常，没有出现-1!")
    
    return result


async def test_pci_range_constraint():
    """测试PCI范围约束"""
    print("\n\n=== 测试PCI范围约束 ===")
    
    # 创建规划配置，限制PCI范围为10-20
    config = PlanningConfig(
        network_type=NetworkType.LTE,
        distance_threshold=3.0,
        pci_modulus=3,
        inherit_modulus=False,
        pci_range=(10, 20)
    )
    
    # 创建PCI规划服务
    service = PCIPlanningService(config)
    
    # 模拟站点数据
    sites_data = [
        {
            "id": "range_site1",
            "name": "range_test_site_1",
            "networkType": "LTE",
            "sectors": [
                {
                    "id": "range_site1_sector1",
                    "name": "range_test_sector_1",
                    "longitude": 113.0,
                    "latitude": 23.0,
                    "azimuth": 0,
                    "earfcn": 1800.0,
                    "pci": None
                },
                {
                    "id": "range_site1_sector2",
                    "name": "range_test_sector_2",
                    "longitude": 113.0,
                    "latitude": 23.0,
                    "azimuth": 120,
                    "earfcn": 1800.0,
                    "pci": None
                }
            ]
        }
    ]
    
    # 执行规划
    result = await service.plan(sites_data)
    
    # 验证结果
    print(f"规划完成，共 {result.total_sites} 个站点，{result.total_sectors} 个小区")
    
    # 检查PCI是否在指定范围内
    all_pcis = []
    for site in result.sites:
        for sector in site.sectors:
            pci = sector.new_pci
            all_pcis.append(pci)
            print(f"小区 {sector.sector_id}: PCI={pci}")
    
    # 检查是否所有PCI都在10-20范围内
    if all(10 <= pci <= 20 for pci in all_pcis):
        print("\n✅ 所有PCI都在指定范围内 (10-20)!")
    else:
        print(f"\n❌ 发现超出范围的PCI: {[pci for pci in all_pcis if not (10 <= pci <= 20)]}")
    
    return result


async def main():
    """主测试函数"""
    # 测试LTE PCI规划
    await test_lte_pci_planning()
    
    # 测试NR PCI规划  
    await test_nr_pci_planning()
    
    # 测试PCI范围约束
    await test_pci_range_constraint()
    
    print("\n\n=== 所有测试完成! ===")


if __name__ == "__main__":
    asyncio.run(main())
