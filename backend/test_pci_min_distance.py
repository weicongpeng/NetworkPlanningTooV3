#!/usr/bin/env python3
"""
测试PCI最小复用距离计算
"""
import sys
import os
import asyncio

# 添加项目根目录到Python路径
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.algorithms.pci_planning_service_v2 import PCIPlanningService, PlanningConfig
from app.models.schemas import NetworkType


async def test_min_distance_calculation():
    """测试最小复用距离计算"""
    print("=== 测试最小复用距离计算 ===")
    
    # 创建规划配置
    config = PlanningConfig(
        network_type=NetworkType.LTE,
        distance_threshold=3.0,
        pci_modulus=3,
        inherit_modulus=False
    )
    
    # 创建PCI规划服务
    service = PCIPlanningService(config)
    
    # 模拟两个相邻站点，使用相同的PCI
    sites_data = [
        {
            "id": "site1",
            "name": "test_site_1",
            "networkType": "LTE",
            "sectors": [
                {
                    "id": "sector1",
                    "name": "test_sector_1",
                    "longitude": 113.0,
                    "latitude": 23.0,
                    "azimuth": 0,
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
                    "id": "sector1",
                    "name": "test_sector_1",
                    "longitude": 113.01,  # 距离site1约1.1km
                    "latitude": 23.01,
                    "azimuth": 0,
                    "earfcn": 1800.0,  # 相同频点
                    "pci": None
                }
            ]
        }
    ]
    
    # 执行规划
    result = await service.plan(sites_data)
    
    # 打印结果
    print("规划结果:")
    for site in result.sites:
        print(f"\n站点 {site.site_id} ({site.site_name}):")
        for sector in site.sectors:
            print(f"  小区 {sector.sector_id}:")
            print(f"    PCI: {sector.original_pci} → {sector.new_pci}")
            print(f"    频点: {sector.earfcn}")
            print(f"    经纬度: {sector.longitude}, {sector.latitude}")
            print(f"    最小复用距离: {sector.min_reuse_distance:.2f}km")
    
    # 验证结果
    all_pcis = [sector.new_pci for site in result.sites for sector in site.sectors]
    all_min_dists = [sector.min_reuse_distance for site in result.sites for sector in site.sectors]
    
    print(f"\n所有PCI: {all_pcis}")
    print(f"所有最小复用距离: {all_min_dists}")
    
    # 检查是否有重复PCI
    if len(set(all_pcis)) < len(all_pcis):
        print("\n❌ 警告: 发现重复PCI")
        # 如果有重复PCI，检查最小复用距离是否合理
        for i, pci in enumerate(all_pcis):
            for j, other_pci in enumerate(all_pcis):
                if i != j and pci == other_pci:
                    print(f"  PCI {pci} 重复，小区{i+1}和小区{j+1}之间的距离: {all_min_dists[i]:.2f}km")
                    if all_min_dists[i] < config.distance_threshold:
                        print(f"    ❌ 错误: 最小复用距离 {all_min_dists[i]:.2f}km 小于阈值 {config.distance_threshold}km")
                    else:
                        print(f"    ✅ 正确: 最小复用距离 {all_min_dists[i]:.2f}km 大于阈值 {config.distance_threshold}km")
    else:
        print("\n✅ 所有PCI唯一")
    
    # 检查最小复用距离是否为正数
    if all(dist >= 0 for dist in all_min_dists):
        print("✅ 所有最小复用距离为正数")
    else:
        print("❌ 发现无效的最小复用距离")
    
    return result


if __name__ == "__main__":
    asyncio.run(test_min_distance_calculation())
