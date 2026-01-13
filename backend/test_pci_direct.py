#!/usr/bin/env python3
"""
直接测试PCI分配方法
"""
import sys
import os

# 添加项目根目录到Python路径
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.algorithms.pci_planning_service_v2 import PCIPlanningService, PlanningConfig, SiteSectorInfo
from app.models.schemas import NetworkType


def test_pci_assignment():
    """直接测试PCI分配"""
    print("=== 直接测试PCI分配 ===")
    
    # 创建规划配置
    config = PlanningConfig(
        network_type=NetworkType.LTE,
        distance_threshold=3.0,
        pci_modulus=3,
        inherit_modulus=False
    )
    
    # 创建PCI规划服务
    service = PCIPlanningService(config)
    
    # 创建测试小区
    sector = SiteSectorInfo(
        id="test_sector",
        site_id="test_site",
        name="test_sector_1",
        longitude=113.0,
        latitude=23.0,
        azimuth=0,
        beamwidth=65,
        height=30,
        pci=None,
        earfcn=1800.0
    )
    
    # 测试PCI分配
    assigned_pci, reason, min_distance = service.assign_pci(sector, [sector], 0)
    
    print(f"分配的PCI: {assigned_pci}")
    print(f"分配原因: {reason}")
    print(f"最小复用距离: {min_distance:.2f}km")
    
    # 检查结果
    if assigned_pci == -1:
        print("❌ 失败: PCI=-1")
        return False
    else:
        print("✅ 成功: PCI值正常")
        
    if min_distance >= 0:
        print("✅ 成功: 最小复用距离计算正常")
    else:
        print("❌ 失败: 最小复用距离计算异常")
        return False
    
    # 测试边界条件：尝试分配多个PCI
    print("\n=== 测试多个PCI分配 ===")
    all_pcis = []
    for i in range(10):
        # 创建新的小区，位置略有不同
        new_sector = SiteSectorInfo(
            id=f"test_sector_{i}",
            site_id=f"test_site_{i}",
            name=f"test_sector_{i}_1",
            longitude=113.0 + i * 0.01,
            latitude=23.0 + i * 0.01,
            azimuth=0,
            beamwidth=65,
            height=30,
            pci=None,
            earfcn=1800.0
        )
        
        pci, reason, dist = service.assign_pci(new_sector, [new_sector], i)
        all_pcis.append(pci)
        print(f"小区{i}: PCI={pci}, 距离={dist:.2f}km")
    
    # 检查是否有-1值
    if any(pci == -1 for pci in all_pcis):
        print("❌ 失败: 发现PCI=-1值")
        return False
    else:
        print("✅ 成功: 所有PCI值正常")
        return True


if __name__ == "__main__":
    success = test_pci_assignment()
    sys.exit(0 if success else 1)
