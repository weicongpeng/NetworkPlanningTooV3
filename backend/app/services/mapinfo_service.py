"""
MapInfo 文件解析服务

支持格式:
- .tab: MapInfo TAB 格式 (包含表头定义和数据)
- .mif: MapInfo Interchange Format (交换格式)
- .dat: 数据文件
"""
import os
import uuid
from typing import List, Dict, Any, Optional
from pathlib import Path
from dataclasses import dataclass
from enum import Enum


class GeometryType(Enum):
    """几何类型"""
    POINT = "point"
    LINE = "line"
    POLYGON = "polygon"
    UNKNOWN = "unknown"


@dataclass
class MapInfoFeature:
    """MapInfo 要素"""
    id: str
    type: GeometryType
    coordinates: List[Any]  # Point: [x, y], Line: [[x, y], ...], Polygon: [[[x, y], ...], ...]
    properties: Dict[str, Any]


@dataclass
class MapInfoLayer:
    """MapInfo 图层"""
    id: str
    name: str
    type: GeometryType
    features: List[MapInfoFeature]
    metadata: Dict[str, Any]


class MapInfoParser:
    """MapInfo 文件解析器"""

    @staticmethod
    def detect_file_type(filename: str) -> Optional[str]:
        """检测文件类型"""
        ext = os.path.splitext(filename)[1].lower()
        if ext in ['.tab', '.mif', '.dat']:
            return ext[1:]  # 返回不带点的扩展名
        return None

    @staticmethod
    def parse_file(file_path: Path) -> MapInfoLayer:
        """解析 MapInfo 文件"""
        ext = MapInfoParser.detect_file_type(file_path.name)

        if ext == 'mif':
            return MapInfoParser._parse_mif(file_path)
        elif ext == 'tab':
            return MapInfoParser._parse_tab(file_path)
        else:
            raise ValueError(f"不支持的文件格式: {ext}")

    @staticmethod
    def _parse_mif(file_path: Path) -> MapInfoLayer:
        """解析 MIF (MapInfo Interchange Format) 文件"""
        features = []
        geometry_type = GeometryType.UNKNOWN
        current_coords = []
        current_properties = {}

        with open(file_path, 'r', encoding='utf-8') as f:
            in_data_section = False

            for line in f:
                line = line.strip()
                if not line or line.startswith('\t'):  # 跳过空行和纯注释
                    continue

                # 检测是否进入数据段
                if line.upper() == 'DATA':
                    in_data_section = True
                    continue

                # 解析表头
                if not in_data_section:
                    if line.upper().startswith('VERSION'):
                        continue
                    elif line.upper().startswith('CHARSET'):
                        continue
                    elif line.upper().startswith('DELIMITER'):
                        continue
                    elif line.upper().startswith('COORDSYS'):
                        continue
                    elif line.upper().startswith('COLUMNS'):
                        continue
                    continue

                # 解析数据段
                line_upper = line.upper()

                # 点要素
                if line_upper == 'POINT':
                    # 读取下一行作为坐标
                    for coord_line in f:
                        coord_line = coord_line.strip()
                        if coord_line:
                            parts = coord_line.split()
                            if len(parts) >= 2:
                                try:
                                    x = float(parts[0])
                                    y = float(parts[1])
                                    features.append(MapInfoFeature(
                                        id=str(uuid.uuid4()),
                                        type=GeometryType.POINT,
                                        coordinates=[x, y],
                                        properties={}
                                    ))
                                    if geometry_type == GeometryType.UNKNOWN:
                                        geometry_type = GeometryType.POINT
                                except ValueError:
                                    pass
                            break

                # 线要素
                elif line_upper == 'LINE':
                    coords = []
                    for coord_line in f:
                        coord_line = coord_line.strip()
                        if coord_line.upper() == 'PLINE':
                            continue
                        if coord_line and not coord_line.upper().startswith('PEN'):
                            parts = coord_line.split()
                            if len(parts) >= 2:
                                try:
                                    x = float(parts[0])
                                    y = float(parts[1])
                                    coords.append([x, y])
                                except ValueError:
                                    continue
                            elif coord_line.upper() == 'PEN':
                                # 笔刷样式，跳过
                                continue
                            else:
                                if coords:
                                    break
                        else:
                            if coords:
                                break

                    if coords:
                        features.append(MapInfoFeature(
                            id=str(uuid.uuid4()),
                            type=GeometryType.LINE,
                            coordinates=coords,
                            properties={}
                        ))
                        if geometry_type == GeometryType.UNKNOWN:
                            geometry_type = GeometryType.LINE

                # 区域要素（多边形）
                elif line_upper == 'REGION' or line_upper.startswith('REGION'):
                    polygon_coords = []
                    current_ring = []

                    for coord_line in f:
                        coord_line = coord_line.strip()
                        if coord_line.upper() == 'PEN':
                            continue
                        if coord_line:
                            parts = coord_line.split()
                            if len(parts) >= 2:
                                try:
                                    x = float(parts[0])
                                    y = float(parts[1])
                                    current_ring.append([x, y])
                                except ValueError:
                                    continue
                            else:
                                # 可能是新的环或结束
                                if current_ring:
                                    polygon_coords.append(current_ring)
                                    current_ring = []
                        else:
                            # 空行表示结束
                            if current_ring:
                                polygon_coords.append(current_ring)
                                current_ring = []
                            if polygon_coords and not coord_line:
                                break

                    if polygon_coords:
                        features.append(MapInfoFeature(
                            id=str(uuid.uuid4()),
                            type=GeometryType.POLYGON,
                            coordinates=polygon_coords,
                            properties={}
                        ))
                        if geometry_type == GeometryType.UNKNOWN:
                            geometry_type = GeometryType.POLYGON

        # 如果没有检测到几何类型，根据要素判断
        if geometry_type == GeometryType.UNKNOWN and features:
            geometry_type = features[0].type

        return MapInfoLayer(
            id=str(uuid.uuid4()),
            name=file_path.stem,
            type=geometry_type,
            features=features,
            metadata={
                'source_file': str(file_path),
                'feature_count': len(features)
            }
        )

    @staticmethod
    def _parse_tab(file_path: Path) -> MapInfoLayer:
        """解析 TAB 格式文件"""
        features = []
        geometry_type = GeometryType.UNKNOWN

        # TAB 文件通常包含 .tab (定义) 和 .dat (数据)
        # 尝试读取对应的 .dat 文件
        dat_file = file_path.with_suffix('.dat')

        if not dat_file.exists():
            # 尝试同名的 .mif 文件
            mif_file = file_path.with_suffix('.mif')
            if mif_file.exists():
                return MapInfoParser._parse_mif(mif_file)
            else:
                raise ValueError(f"找不到对应的数据文件: {dat_file}")

        # 简单解析：假设是包含坐标的文本文件
        # 实际实现需要根据具体的 TAB 格式定义
        try:
            with open(dat_file, 'r', encoding='utf-8') as f:
                # 尝试解析为 CSV 格式
                import csv
                reader = csv.DictReader(f)

                for row in reader:
                    # 尝试找坐标字段
                    x, y = None, None
                    for key in row.keys():
                        key_upper = key.upper()
                        if key_upper in ['X', 'LON', 'LONGITUDE', '经度', 'EASTING']:
                            try:
                                x = float(row[key])
                            except (ValueError, TypeError):
                                pass
                        elif key_upper in ['Y', 'LAT', 'LATITUDE', '纬度', 'NORTHING']:
                            try:
                                y = float(row[key])
                            except (ValueError, TypeError):
                                pass

                    if x is not None and y is not None:
                        features.append(MapInfoFeature(
                            id=str(uuid.uuid4()),
                            type=GeometryType.POINT,
                            coordinates=[x, y],
                            properties=row
                        ))

            if features:
                geometry_type = GeometryType.POINT

        except Exception as e:
            # 如果 CSV 解析失败，尝试简单的坐标对解析
            with open(dat_file, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith('#'):
                        continue
                    parts = line.split()
                    if len(parts) >= 2:
                        try:
                            x = float(parts[0])
                            y = float(parts[1])
                            features.append(MapInfoFeature(
                                id=str(uuid.uuid4()),
                                type=GeometryType.POINT,
                                coordinates=[x, y],
                                properties={}
                            ))
                        except ValueError:
                            continue

            if features:
                geometry_type = GeometryType.POINT

        return MapInfoLayer(
            id=str(uuid.uuid4()),
            name=file_path.stem,
            type=geometry_type,
            features=features,
            metadata={
                'source_file': str(file_path),
                'feature_count': len(features)
            }
        )

    @staticmethod
    def parse_directory(dir_path: Path) -> List[MapInfoLayer]:
        """解析目录中的所有 MapInfo 文件"""
        layers = []

        # 查找所有 MIF 文件
        for mif_file in dir_path.glob('*.mif'):
            try:
                layer = MapInfoParser._parse_mif(mif_file)
                layers.append(layer)
            except Exception as e:
                print(f"[MapInfoParser] 解析失败 {mif_file.name}: {e}")
                continue

        # 查找所有 TAB 文件（如果找不到对应的 MIF）
        for tab_file in dir_path.glob('*.tab'):
            # 检查是否已经通过 MIF 解析
            mif_file = tab_file.with_suffix('.mif')
            if mif_file.exists():
                continue

            try:
                layer = MapInfoParser._parse_tab(tab_file)
                layers.append(layer)
            except Exception as e:
                print(f"[MapInfoParser] 解析失败 {tab_file.name}: {e}")
                continue

        return layers


def parse_mapinfo_files(upload_path: Path) -> List[Dict[str, Any]]:
    """
    解析上传的 MapInfo 文件

    返回图层元数据列表
    """
    layers = []

    if upload_path.is_file():
        # 单个文件
        try:
            layer = MapInfoParser.parse_file(upload_path)
            layers.append({
                "id": layer.id,
                "name": layer.name,
                "type": layer.type.value,
                "feature_count": len(layer.features),
                "metadata": layer.metadata
            })
        except Exception as e:
            print(f"[MapInfo] 解析文件失败 {upload_path}: {e}")

    elif upload_path.is_dir():
        # 目录，查找所有 MapInfo 文件
        mapinfo_layers = MapInfoParser.parse_directory(upload_path)
        for layer in mapinfo_layers:
            layers.append({
                "id": layer.id,
                "name": layer.name,
                "type": layer.type.value,
                "feature_count": len(layer.features),
                "metadata": layer.metadata
            })

    return layers


def get_layer_data(data_id: str, layer_id: str, data_dir: Path) -> Optional[Dict]:
    """
    获取图层数据

    返回 GeoJSON 格式的数据
    """
    # 查找对应的 MapInfo 文件
    for mif_file in data_dir.glob('*.mif'):
        try:
            layer = MapInfoParser._parse_mif(mif_file)
            if layer.id == layer_id:
                return _convert_to_geojson(layer)
        except Exception as e:
            print(f"[MapInfo] 解析失败 {mif_file}: {e}")
            continue

    return None


def _convert_to_geojson(layer: MapInfoLayer) -> Dict:
    """将 MapInfo 图层转换为 GeoJSON 格式"""
    features = []

    for feature in layer.features:
        geometry = {}
        if feature.type == GeometryType.POINT:
            geometry = {
                "type": "Point",
                "coordinates": feature.coordinates
            }
        elif feature.type == GeometryType.LINE:
            geometry = {
                "type": "LineString",
                "coordinates": feature.coordinates
            }
        elif feature.type == GeometryType.POLYGON:
            geometry = {
                "type": "Polygon",
                "coordinates": feature.coordinates
            }

        features.append({
            "type": "Feature",
            "geometry": geometry,
            "properties": feature.properties
        })

    return {
        "type": "FeatureCollection",
        "features": features,
        "metadata": {
            "name": layer.name,
            "layerType": layer.type.value
        }
    }
