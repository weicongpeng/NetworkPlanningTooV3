import math
import numpy as np
import pandas as pd
from typing import Optional

class GeoUtils:
    """地理计算工具类"""
    
    @staticmethod
    def calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Haversine公式计算两点间距离(km)"""
        lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
        dlat = lat2 - lat1
        dlon = lon2 - lon1
        a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
        c = 2 * math.asin(math.sqrt(a))
        return 6371.0 * c

    @staticmethod
    def calculate_distances_vectorized(target_lat: float, target_lon: float,
                                     source_lats: np.ndarray, source_lons: np.ndarray) -> np.ndarray:
        """向量化批量计算距离"""
        target_lat_rad = math.radians(target_lat)
        target_lon_rad = math.radians(target_lon)
        source_lats_rad = np.radians(source_lats)
        source_lons_rad = np.radians(source_lons)

        dlat = source_lats_rad - target_lat_rad
        dlon = source_lons_rad - target_lon_rad
        a = np.sin(dlat/2)**2 + math.cos(target_lat_rad) * np.cos(source_lats_rad) * np.sin(dlon/2)**2
        c = 2 * np.arcsin(np.sqrt(a))
        return c * 6371.0

    @staticmethod
    def calculate_azimuth(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """计算方位角 (0-360度)"""
        lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
        dlon = lon2 - lon1
        y = math.sin(dlon) * math.cos(lat2)
        x = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(dlon)
        bearing = math.degrees(math.atan2(y, x))
        return (bearing + 360) % 360

    @staticmethod
    def calculate_coverage_circle_center(lat: float, lon: float, azimuth: float, 
                                       distance_factor: float, coverage_distance_m: float) -> tuple:
        """计算覆盖圆圆心"""
        azimuth_rad = math.radians(azimuth)
        d_s = distance_factor * coverage_distance_m / 1000.0 # km
        
        # 简易平面近似，小距离下误差可接受
        lat_delta = (d_s * math.cos(azimuth_rad)) / 111.0
        lon_delta = (d_s * math.sin(azimuth_rad)) / (111.0 * math.cos(math.radians(lat)))
        
        return lat + lat_delta, lon + lon_delta

class DataFrameUtils:
    """DataFrame处理工具"""
    
    @staticmethod
    def find_column_by_fuzzy_match(df: pd.DataFrame, keywords: list) -> Optional[str]:
        """模糊查找列名，支持列表中的任意关键词"""
        columns = df.columns
        for keyword in keywords:
            # 精确匹配
            if keyword in columns:
                return keyword
            # 包含匹配
            for col in columns:
                if keyword in str(col):
                    return col
        return None

    @staticmethod
    def normalize_columns(df: pd.DataFrame, network_type: str) -> pd.DataFrame:
        """标准化列名，适配业务逻辑"""
        df = df.copy()
        
        # 定义标准字段映射 (目标字段: [可能的源字段关键词列表])
        mappings = {
            'LTE': {
                'enodeb_id': ['eNodeB标识', 'eNodeB ID', 'eNBId'],
                'cell_id': ['小区标识', 'cellLocalId', 'CellID'],
                'cell_name': ['小区名称', 'userLabel', 'CellName'],
                'pci': ['物理小区识别码', 'PCI'],
                'lat': ['小区纬度', 'Latitude'],
                'lon': ['小区经度', 'Longitude'],
                'earfcn_dl': ['下行链路', 'earfcnDl', '频点'],
                'azimuth': ['天线方向角', 'Azimuth', 'azimuth']
            },
            'NR': {
                'enodeb_id': ['gNodeB标识', 'gNodeB ID', 'gNBId', 'gNodeBID'], # NR也统一叫enodeb_id方便内部处理
                'cell_id': ['小区标识', 'cellLocalId', 'CellID'],
                'cell_name': ['小区名称', 'CELL NAME', 'CellName'],
                'pci': ['物理小区识别码', 'PCI'],
                'lat': ['小区纬度', 'Latitude'],
                'lon': ['小区经度', 'Longitude'],
                'earfcn_dl': ['SSB频点', 'SSB Frequency', 'ssbFrequency'],
                'azimuth': ['天线方向角', 'Azimuth', 'azimuth']
            }
        }
        
        type_map = mappings.get(network_type, mappings['LTE'])
        
        for std_col, keywords in type_map.items():
            found_col = DataFrameUtils.find_column_by_fuzzy_match(df, keywords)
            if found_col:
                df.rename(columns={found_col: std_col}, inplace=True)
            else:
                # 如果是必须字段且没找到，可能需要在业务层处理，这里先不报错
                pass
                
        # 数据类型转换
        numeric_cols = ['enodeb_id', 'cell_id', 'pci', 'lat', 'lon', 'earfcn_dl', 'azimuth']
        for col in numeric_cols:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors='coerce')
                
        return df