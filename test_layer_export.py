#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
测试图层导出功能
用于验证扇区图层和点状图层是否能正确导出为MapInfo格式
"""

import os
import sys
import pandas as pd
import numpy as np

# 检查GeoPandas是否可用
GEOPANDAS_AVAILABLE = False
try:
    import geopandas as gpd
    from shapely.geometry import Point, Polygon
    GEOPANDAS_AVAILABLE = True
    print("[OK] GeoPandas 可用，将使用标准MapInfo格式导出")
except ImportError:
    print("[ERROR] GeoPandas 未安装，将使用兼容性模式导出")
    print("  建议安装GeoPandas以获得更好的MapInfo兼容性：")
    print("  pip install geopandas")

def test_sector_layer_export():
    """测试扇区图层导出"""
    print("\n=== 测试扇区图层导出 ===")

    # 模拟扇区数据
    sectors = []
    for i in range(3):
        # 生成扇区多边形坐标（简化版）
        center_lon = 116.3974 + i * 0.001
        center_lat = 39.9093 + i * 0.001
        azimuth = 60 + i * 120
        angle_deg = 65  # 扇区角度
        radius_m = 200  # 半径（米）

        # 计算扇区多边形点
        angle_rad = np.radians(angle_deg)
        azimuth_rad = np.radians(azimuth)
        start_angle = azimuth_rad - angle_rad / 2
        end_angle = azimuth_rad + angle_rad / 2

        points = []
        points.append((center_lon, center_lat))  # 中心点

        # 转换为度（近似）
        radius_deg = radius_m / 111320.0
        num_points = 10
        for j in range(num_points + 1):
            angle = start_angle + (end_angle - start_angle) * j / num_points
            dx = radius_deg * np.cos(angle)
            dy = radius_deg * np.sin(angle)
            points.append((center_lon + dx / np.cos(np.radians(center_lat)), center_lat + dy))

        points.append((center_lon, center_lat))  # 闭合多边形

        sectors.append({
            'name': f'扇区_{i+1}',
            'longitude': center_lon,
            'latitude': center_lat,
            'azimuth': azimuth,
            'polygon': points,
            'color': 'red' if i % 3 == 0 else 'green' if i % 3 == 1 else 'blue'
        })

    # 创建输出目录
    output_dir = "test_output"
    os.makedirs(output_dir, exist_ok=True)

    if GEOPANDAS_AVAILABLE:
        # 使用GeoPandas导出
        print("[INFO] 使用GeoPandas导出扇区图层...")
        data_list = []

        for sector in sectors:
            polygon_coords = sector['polygon']
            if polygon_coords[0] != polygon_coords[-1]:
                polygon_coords.append(polygon_coords[0])

            polygon = Polygon(polygon_coords)

            data_list.append({
                'name': sector['name'],
                'longitude': sector['longitude'],
                'latitude': sector['latitude'],
                'azimuth': sector['azimuth'],
                'color': sector['color'],
                'geometry': polygon
            })

        gdf = gpd.GeoDataFrame(data_list, crs='EPSG:4326')
        tab_file = os.path.join(output_dir, "test_sectors.tab")
        gdf.to_file(tab_file, driver='MapInfo File', encoding='utf-8')
        print(f"[OK] 扇区图层已导出到: {tab_file}")
    else:
        print("[INFO] GeoPandas不可用，跳过标准格式导出测试")

    return sectors

def test_point_layer_export():
    """测试点状图层导出"""
    print("\n=== 测试点状图层导出 ===")

    # 模拟点数据
    points = []
    for i in range(5):
        points.append({
            'name': f'点_{i+1}',
            'longitude': 116.3974 + i * 0.002,
            'latitude': 39.9093 + i * 0.002,
            'color': 'red' if i % 3 == 0 else 'green' if i % 3 == 1 else 'blue'
        })

    # 创建输出目录
    output_dir = "test_output"
    os.makedirs(output_dir, exist_ok=True)

    if GEOPANDAS_AVAILABLE:
        # 使用GeoPandas导出
        print("[INFO] 使用GeoPandas导出点状图层...")
        data_list = []

        for point in points:
            point_geom = Point(point['longitude'], point['latitude'])

            data_list.append({
                'name': point['name'],
                'longitude': point['longitude'],
                'latitude': point['latitude'],
                'color': point['color'],
                'geometry': point_geom
            })

        gdf = gpd.GeoDataFrame(data_list, crs='EPSG:4326')
        tab_file = os.path.join(output_dir, "test_points.tab")
        gdf.to_file(tab_file, driver='MapInfo File', encoding='utf-8')
        print(f"[OK] 点状图层已导出到: {tab_file}")
    else:
        print("[INFO] GeoPandas不可用，跳过标准格式导出测试")

    return points

def verify_tab_file(filepath):
    """验证TAB文件是否有效"""
    print(f"\n=== 验证文件: {filepath} ===")

    if not os.path.exists(filepath):
        print(f"[ERROR] 文件不存在: {filepath}")
        return False

    # 检查相关文件是否存在
    base_path = filepath[:-4]  # 移除.tab扩展名
    required_files = [filepath]  # TAB文件
    optional_files = [base_path + ext for ext in ['.dat', '.map', '.id']]

    print(f"基础文件: {filepath}")
    for ext in ['.dat', '.map', '.id']:
        file_path = base_path + ext
        desc = ext[1:] + "文件"
        if os.path.exists(file_path):
            size = os.path.getsize(file_path)
            print(f"  [OK] {desc}: {file_path} (大小: {size} 字节)")
        else:
            print(f"  [ERROR] {desc}: 缺失")

    # 尝试读取TAB文件头
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            header = f.read(200)
            if "!table" in header and "!version" in header:
                print("  [OK] TAB文件头格式正确")
            else:
                print("  [WARNING] TAB文件头格式可能不正确")
    except Exception as e:
        print(f"  [ERROR] 读取TAB文件时出错: {e}")
        return False

    return True

def main():
    """主测试函数"""
    print("图层导出功能测试")
    print("=" * 50)

    # 测试扇区图层
    sectors = test_sector_layer_export()

    # 测试点状图层
    points = test_point_layer_export()

    # 验证生成的文件
    if GEOPANDAS_AVAILABLE:
        print("\n=== 文件验证 ===")
        verify_tab_file("test_output/test_sectors.tab")
        verify_tab_file("test_output/test_points.tab")

    print("\n=== 测试完成 ===")
    print(f"输出目录: {os.path.abspath('test_output')}")

    if GEOPANDAS_AVAILABLE:
        print("\n[OK] 使用GeoPandas导出的图层文件应该可以在MapInfo中正常打开")
        print("  文件使用WGS84坐标系(EPSG:4326)，编码为UTF-8")
    else:
        print("\n[ERROR] GeoPandas未安装，无法生成标准MapInfo格式")
        print("  请安装GeoPandas: pip install geopandas")

if __name__ == "__main__":
    main()