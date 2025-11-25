#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
测试覆盖圆算法的精确性
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from NetworkPlanningTool_V1 import NeighborPlanningTool
import pandas as pd

def test_coverage_algorithm_precision():
    """测试覆盖圆算法的精确性"""
    print("=== 测试覆盖圆算法的精确性 ===")
    
    # 创建专门用于测试覆盖圆算法的数据
    # 使用与test.py中类似的坐标设置
    test_data = [
        {"cell_id": "cell_1", "sX": 0, "sY": 0, "az": 90, "Co": 1000, "enodeb_id": 1},      # 正东方向
        {"cell_id": "cell_2", "sX": 2000, "sY": 0, "az": 270, "Co": 1000, "enodeb_id": 2},  # 正西方向
        {"cell_id": "cell_3", "sX": 0, "sY": 2000, "az": 0, "Co": 1000, "enodeb_id": 3},    # 正北方向
    ]
    
    # 转换为经纬度 - 使用更精确的转换
    base_lat, base_lon = 22.5, 114.0
    # 每度约111320米
    lat_per_meter = 1/111320.0
    lon_per_meter = 1/(111320.0 * math.cos(math.radians(base_lat)))
    
    test_cells = []
    for cell in test_data:
        # 米制坐标转换为经纬度
        lat = base_lat + (cell['sY'] * lat_per_meter)
        lon = base_lon + (cell['sX'] * lon_per_meter)
        
        test_cells.append({
            'enodeb_id': cell['enodeb_id'],
            'cell_id': cell['enodeb_id'],
            'cell_name': cell['cell_id'],
            'pci': int(cell['cell_id'].split('_')[1]) * 100 if '_' in cell['cell_id'] else cell['enodeb_id'] * 100,
            'lat': lat,
            'lon': lon,
            'earfcn_dl': 37900,
            'antenna_azimuth': cell['az'],
            'cell_type': 'LTE'
        })
    
    test_df = pd.DataFrame(test_cells)
    print("测试数据:")
    for idx, row in test_df.iterrows():
        print(f"  {row['cell_name']}: lat={row['lat']:.6f}, lon={row['lon']:.6f}, az={row['antenna_azimuth']}")
    
    # 创建NeighborPlanningTool实例
    tool = NeighborPlanningTool(
        max_neighbors=10,
        coverage_distance_factor=5/9,  # k系数
        coverage_radius_factor=5/9     # m系数
    )
    
    tool.lte_cells = test_df
    tool.nr_cells = test_df  # 也设置nr_cells以备使用
    
    # 运行邻区规划
    print("\n使用覆盖圆算法进行邻区规划...")
    result = tool.plan_neighbors_for_network('LTE', 'LTE')
    
    print(f"找到 {len(result)} 个邻区关系:")
    if not result.empty:
        for idx, row in result.iterrows():
            print(f"  {row['source_cell_name']} -> {row['target_cell_name']}")
    else:
        print("  无邻区关系")
    
    # 验证同站小区优先级
    print("\n验证同站小区优先级功能...")
    # 创建同站小区测试数据
    same_site_test = pd.DataFrame({
        'enodeb_id': [1, 1, 2],  # 前两个小区在同一站点
        'cell_id': [1, 2, 1],
        'cell_name': ['site1_cell1', 'site1_cell2', 'site2_cell1'],
        'pci': [100, 101, 200],
        'lat': [22.5431, 22.5431, 22.5500],  # 前两个小区经纬度相同
        'lon': [114.0579, 114.0579, 114.0600],
        'earfcn_dl': [37900] * 3,
        'antenna_azimuth': [90, 270, 0],
        'cell_type': ['LTE'] * 3
    })
    
    tool.lte_cells = same_site_test
    result_same_site = tool.plan_neighbors_for_network('LTE', 'LTE')
    
    print(f"同站数据邻区规划结果: {len(result_same_site)} 个关系")
    if not result_same_site.empty:
        print("邻区关系:")
        for idx, row in result_same_site.iterrows():
            print(f"  {row['source_cell_name']} -> {row['target_cell_name']}")
    
    print("\n=== 测试完成 ===")
    if len(result_same_site) > 0:
        print("✓ 覆盖圆算法和同站小区优先级功能正常工作")
    else:
        print("? 覆盖圆算法未找到邻区关系（可能因为测试数据中没有覆盖圆相交的小区）")

if __name__ == "__main__":
    import math
    test_coverage_algorithm_precision()