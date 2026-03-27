"""
地理化数据字段检测器
智能识别 Excel/CSV/TXT 文件中的经纬度、方位角等字段
"""

import re
import math
import pandas as pd
from typing import Dict, Optional, Tuple, List


class GeoFieldDetector:
    """地理化数据字段检测器"""

    # 字段匹配模式表
    FIELD_PATTERNS = {
        "longitude": [
            "经度",
            "longitude",
            "lng",
            "lon",
            "long",
            "LONGITUDE",
            "LNG",
            "LON",
            "LONG",
            "Coord_X",
            "X",
            "经度x",
            "lngx",
            "longx",
        ],
        "latitude": [
            "纬度",
            "latitude",
            "lat",
            "LATITUDE",
            "LAT",
            "Coord_Y",
            "Y",
            "纬度y",
            "laty",
            "laty",
        ],
        "azimuth": [
            "方位角",
            "azimuth",
            "azi",
            "azim",
            "AZIMUTH",
            "AZI",
            "AZIM",
            "方向角",
            "方向",
            "Angle",
            "角度",
            "azimuth_angle",
            "azimuthangle",
            "azi_angle",
            "bearing",
            "direction",
            "heading",
            "azimuthangle",
            "directionangle",
            "bearing_angle",
            "扇区方向",
            "扇区方位",
            "天线方位",
            "天线方向",
            "azimuth_",
            "azi_",
            "direction_",
            "bearing_",
        ],
        "beamwidth": [
            "波束宽度",
            "beamwidth",
            "beam_width",
            "beamwidth",
            "BEAMWIDTH",
            "BEAM_WIDTH",
            "水平波束角",
            "水平波束宽度",
            "水平波束",
            "波束角",
            "beamangle",
            "beam_angle",
            "覆盖角度",
            "覆盖角度",
            "扇区角度",
            "扇区宽度",
            "sectorwidth",
            "sector_width",
        ],
        "cell_cover_type": [
            "覆盖类型",
            "cell_cover_type",
            "cell_cover_type",
            "CELL_COVER_TYPE",
            "CELL_COVER_TYPE",
            "小区覆盖类型",
            "小区类型",
            "覆盖类型",
            "indoor",
            "outdoor",
            "is_indoor",
        ],
        "name": [
            "名称",
            "name",
            "小区名",
            "站名",
            "NAME",
            "SiteName",
            "CellName",
            "站点名称",
            "小区名称",
            "cell_name",
            "site_name",
            "小区标识",
            "站点标识",
            "cellid",
            "siteid",
        ],
        "wkt": [
            "wkt",
            "WKT",
            "geometry",
            "geom",
            "shape",
            "shape_wkt",
            "wkt_geometry",
            "地理范围",
            "多边形",
            "polygon",
            "POLYGON",
            "边界",
            "范围",
        ],
    }

    def detect_fields(self, df: pd.DataFrame) -> Dict[str, Optional[str]]:
        """
        检测 DataFrame 中的地理字段

        Args:
            df: 要检测的数据框

        Returns:
            包含检测结果的字典：
            {
                'longitude': '经度列名' or None,
                'latitude': '纬度列名' or None,
                'azimuth': '方位角列名' or None,
                'name': '名称列名' or None,
                'geometry_type': 'point' or 'sector'
            }
        """
        detected = {}
        columns = [str(col).strip() for col in df.columns]

        # 对每个字段类型进行匹配
        for field_name, patterns in self.FIELD_PATTERNS.items():
            for col in columns:
                col_lower = col.lower()
                # 使用正则表达式进行模糊匹配
                if any(re.search(p, col_lower, re.IGNORECASE) for p in patterns):
                    detected[field_name] = col
                    break

            # 如果没有找到匹配，设置为 None
            if field_name not in detected:
                detected[field_name] = None

        # 确定几何类型优先级：polygon > sector > point
        if detected.get("wkt"):
            detected["geometry_type"] = "polygon"
        elif detected.get("azimuth"):
            detected["geometry_type"] = "sector"
        else:
            detected["geometry_type"] = "point"

        return detected

    def validate_coordinates(
        self, df: pd.DataFrame, lon_col: str, lat_col: str
    ) -> Tuple[bool, str]:
        """
        验证坐标数据的有效性

        Args:
            df: 数据框
            lon_col: 经度列名
            lat_col: 纬度列名

        Returns:
            (是否有效, 错误信息)
        """
        # 尝试将列转换为数值类型
        lon_values = pd.to_numeric(df[lon_col], errors="coerce")
        lat_values = pd.to_numeric(df[lat_col], errors="coerce")

        # 验证坐标范围
        valid_mask = (
            lon_values.between(-180, 180)
            & lat_values.between(-90, 90)
            & lon_values.notna()
            & lat_values.notna()
        )

        valid_count = valid_mask.sum()

        if valid_count == 0:
            return False, self._format_coordinate_error(df, lon_col, lat_col)

        if valid_count < len(df) * 0.5:
            return False, f"有效数据少于50%（{valid_count}/{len(df)}），请检查数据质量"

        return True, ""

    def _format_coordinate_error(
        self, df: pd.DataFrame, lon_col: str, lat_col: str
    ) -> str:
        """格式化友好的坐标错误信息"""
        # 检查前几行的数据
        sample_size = min(5, len(df))
        samples = []
        for idx in range(sample_size):
            lon_val = df.iloc[idx][lon_col]
            lat_val = df.iloc[idx][lat_col]
            samples.append(f"第{idx + 1}行: 经度={lon_val}, 纬度={lat_val}")

        sample_info = "\n".join(samples)

        return (
            "没有检测到有效的经纬度数据。请确保：\n"
            "1. 经度范围：-180 ~ 180\n"
            "2. 纬度范围：-90 ~ 90\n"
            "3. 坐标值为数字格式\n\n"
            f"示例数据：\n{sample_info}\n\n"
            f"检测到的列：经度[{lon_col}]，纬度[{lat_col}]"
        )

    def validate_azimuth(self, df: pd.DataFrame, azi_col: str) -> Tuple[bool, str]:
        """
        验证方位角数据的有效性

        Args:
            df: 数据框
            azi_col: 方位角列名

        Returns:
            (是否有效, 错误信息)
        """
        azi_values = pd.to_numeric(df[azi_col], errors="coerce")

        # 方位角范围：0 到 2π（弧度）
        valid_mask = azi_values.between(0, 2 * math.pi) & azi_values.notna()
        valid_count = valid_mask.sum()

        if valid_count == 0:
            return (
                False,
                f"没有有效的方位角数据。请检查列「{azi_col}」中的值是否在 0 到 2π（弧度）范围内",
            )

        if valid_count < len(df) * 0.5:
            return False, f"有效方位角数据少于50%（{valid_count}/{len(df)}）"

        return True, ""

    def get_supported_field_names(self) -> Dict[str, List[str]]:
        """
        获取支持的字段名列表，用于错误提示

        Returns:
            字段类型到支持名称的映射
        """
        return self.FIELD_PATTERNS
