#!/usr/bin/env python3
"""
简单测试PCI规划修复效果
"""
import sys
import os
import asyncio

# 添加项目根目录到Python路径
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.algorithms.pci_planning_service_v2 import PCIPlanningService, PlanningConfig
from app.models.schemas import NetworkType


async def test_pci_fix():
    """测试PCI规划修复效果"""
    print("=== 测试PCI规划修复效果 ===")
    
    # 测试场景1: LTE规划，验证无-1值
    print("\n1. 测试LTE PCI规划:")
    config_lte = PlanningConfig(
        network_type=NetworkType.LTE,
        distance_threshold=3.0,
        pci_modulus=3,
        inherit_modulus=False
    )
    service_lte = PCIPlanningService(config_lte)
    
    # 简单站点数据
    sites_lte = [
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
                }
            ]
        }
    ]
    
    result_lte = await service_lte.plan(sites_lte)
    lte_pcis = [sector.new_pci for site in result_lte.sites for sector in site.sectors]
    lte_min_dists = [sector.min_reuse_distance for site in result_lte.sites for sector in site.sectors]
    
    print(f"   LTE规划PCI结果: {lte_pcis}")
    print(f"   LTE规划最小复用距离: {lte_min_dists}")
    
    if any(pci == -1 for pci in lte_pcis):
        print("   ❌ 失败: 发现PCI=-1")
    else:
        print("   ✅ 成功: 无PCI=-1值")
    
    if all(dist >= 0 for dist in lte_min_dists):
        print("   ✅ 成功: 最小复用距离计算正常")
    else:
        print("   ❌ 失败: 最小复用距离计算异常")
    
    # 测试场景2: NR规划，验证双重约束
    print("\n2. 测试NR PCI规划:")
    config_nr = PlanningConfig(
        network_type=NetworkType.NR,
        distance_threshold=3.0,
        pci_modulus=30,
        inherit_modulus=False
    )
    service_nr = PCIPlanningService(config_nr)
    
    sites_nr = [
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
    
    result_nr = await service_nr.plan(sites_nr)
    nr_pcis = [sector.new_pci for site in result_nr.sites for sector in site.sectors]
    nr_min_dists = [sector.min_reuse_distance for site in result_nr.sites for sector in site.sectors]
    
    print(f"   NR规划PCI结果: {nr_pcis}")
    print(f"   NR规划最小复用距离: {nr_min_dists}")
    
    if any(pci == -1 for pci in nr_pcis):
        print("   ❌ 失败: 发现PCI=-1")
    else:
        print("   ✅ 成功: 无PCI=-1值")
    
    # 检查NR的双重约束
    nr_mods = [(pci % 3, pci % 30) for pci in nr_pcis]
    print(f"   NR PCI模值: {nr_mods}")
    
    # 测试场景3: 边界条件，验证智能回退
    print("\n3. 测试边界条件:")
    config_boundary = PlanningConfig(
        network_type=NetworkType.LTE,
        distance_threshold=10.0,  # 很大的距离阈值，强制触发回退策略
        pci_modulus=3,
        inherit_modulus=False
    )
    service_boundary = PCIPlanningService(config_boundary)
    
    # 多个相邻站点，触发冲突
    sites_boundary = [
        {
            "id": f"site{i}",
            "name": f"test_site_{i}",
            "networkType": "LTE",
            "sectors": [
                {
                    "id": f"site{i}_sector1",
                    "name": f"test_sector_{i}_1",
                    "longitude": 113.0 + i * 0.001,
                    "latitude": 23.0 + i * 0.001,
                    "azimuth": 0,
                    "earfcn": 1800.0,
                    "pci": None
                }
            ]
        } for i in range(5)
    ]
    
    result_boundary = await service_boundary.plan(sites_boundary)
    boundary_pcis = [sector.new_pci for site in result_boundary.sites for sector in site.sectors]
    
    print(f"   边界条件PCI结果: {boundary_pcis}")
    
    if any(pci == -1 for pci in boundary_pcis):
        print("   ❌ 失败: 边界条件下出现PCI=-1")
    else:
        print("   ✅ 成功: 边界条件下无PCI=-1值")
    
    # 总结
    print("\n=== 测试总结 ===")
    all_pcis = lte_pcis + nr_pcis + boundary_pcis
    if any(pci == -1 for pci in all_pcis):
        print("❌ 测试失败: 发现PCI=-1值")
        return False
    else:
        print("✅ 测试成功: 所有场景下无PCI=-1值")
        print(f"   共测试 {len(all_pcis)} 个小区，所有PCI值正常")
        return True


if __name__ == "__main__":
    success = asyncio.run(test_pci_fix())
    sys.exit(0 if success else 1)
