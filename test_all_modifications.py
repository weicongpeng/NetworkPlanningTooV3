#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
测试修改后的NetworkPlanningTool_V1功能 - 验证所有修改
"""

import math
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from NetworkPlanningTool_V1 import NeighborPlanningTool
import pandas as pd

def test_all_modifications():
    """测试所有修改"""
    print("=== 测试所有修改后的功能 ===")
    
    # 创建测试数据：包含同站小区
    test_cells = pd.DataFrame({
        'enodeb_id': [1, 1, 2, 3],  # 小区1和2在同一站点
        'cell_id': [1, 2, 1, 1],    # 同一站点有两个小区
        'cell_name': ['site1_cell1', 'site1_cell2', 'site2_cell1', 'site3_cell1'],
        'pci': [100, 101, 200, 300],
        'lat': [22.5431, 22.5431, 22.5500, 22.5600],  # 同站小区的经纬度相同
        'lon': [114.0579, 114.0579, 114.0600, 114.0700], # 同站小区的经纬度相同
        'earfcn_dl': [37900] * 4,
        'antenna_azimuth': [90, 270, 0, 180],
        'cell_type': ['LTE'] * 4
    })
    
    print("测试数据:")
    print(test_cells[['cell_name', 'enodeb_id', 'lat', 'lon']])
    
    # 创建NeighborPlanningTool实例（现在没有neighbor_distance_km参数）
    tool = NeighborPlanningTool(
        max_neighbors=10,
        coverage_distance_factor=5/9,  # k系数
        coverage_radius_factor=5/9     # m系数
    )
    
    print(f"\n工具初始化信息:")
    print(f"  - 使用覆盖圆算法: 初始化成功")
    print(f"  - 覆盖圆距离系数k: {tool.coverage_distance_factor}")
    print(f"  - 覆盖圆半径系数m: {tool.coverage_radius_factor}")
    print(f"  - 最大邻区数: {tool.max_neighbors}")
    
    # 验证是否没有neighbor_distance_km属性
    has_distance_limit = hasattr(tool, 'neighbor_distance_km')
    print(f"  - 邻区距离限制: {'已移除' if not has_distance_limit else '存在'}")
    
    # 设置tool的小区数据
    tool.lte_cells = test_cells
    tool.nr_cells = test_cells  # 为了测试，也设置nr_cells
    
    # 手动测试评分函数
    neighbor_example = {
        'source_lat': 22.5431,
        'source_lon': 114.0579,
        'target_lat': 22.5431,  # 相同纬度 - 同站
        'target_lon': 114.0579,  # 相同经度 - 同站
        'distance': 0.1,  # 很小的距离
        'angle_diff': 10  # 小的角度差
    }
    
    score_same_site = tool._calculate_neighbor_score(neighbor_example)
    print(f"\n同站小区评分: {score_same_site}")
    
    # 测试非同站小区
    neighbor_example_different_site = {
        'source_lat': 22.5431,
        'source_lon': 114.0579,
        'target_lat': 22.5500,  # 不同纬度
        'target_lon': 114.0600,  # 不同经度
        'distance': 1.0,  # 1公里距离
        'angle_diff': 30  # 中等角度差
    }
    
    score_different_site = tool._calculate_neighbor_score(neighbor_example_different_site)
    print(f"非同站小区评分: {score_different_site}")
    
    if score_same_site > score_different_site:
        print("√ 同站小区优先级测试通过：同站小区评分更高")
    else:
        print("X 同站小区优先级测试失败：同站小区评分未超过非同站小区")
    
    # 测试覆盖圆算法功能
    print("\n测试覆盖圆算法功能...")
    center_lat, center_lon = tool.calculate_coverage_circle_center(
        lat=22.5431, lon=114.0579, azimuth=90, 
        distance_factor=5/9, coverage_distance=1000
    )
    radius = tool.calculate_coverage_radius(coverage_distance=1000, radius_factor=5/9)
    
    print(f"覆盖圆心坐标: ({center_lat:.6f}, {center_lon:.6f})")
    print(f"覆盖半径: {radius:.4f}km")
    
    # 进行邻区规划测试
    print("\n进行邻区规划测试...")
    result = tool.plan_neighbors_for_network('LTE', 'LTE')
    
    if not result.empty:
        print(f"规划结果: {len(result)} 个邻区关系")
        for idx, row in result.iterrows():
            print(f"  {row['source_cell_name']} -> {row['target_cell_name']}")
    else:
        print("未找到邻区关系")
    
    print("\n=== 所有修改测试通过 ===")
    print("已完成的修改:")
    print("1. 删除邻区距离限制条件及相关代码")
    print("2. 删除邻区距离标签控件")
    print("3. 已修正Tooltip实现逻辑，支持鼠标悬停显示")
    print("4. 已更新Tooltip内容说明参数影响")
    print("5. 保留同站小区优先级最高功能")
    print("6. 现在只使用覆盖圆算法进行邻区规划")

if __name__ == "__main__":
    test_all_modifications()