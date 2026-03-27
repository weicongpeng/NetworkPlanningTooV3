"""
地理化数据解析服务
支持 Excel、CSV、TXT 格式的地理化数据导入
"""

import re
import math
import pandas as pd
from pathlib import Path
from typing import Dict, Any, List, Tuple, Optional
import json

from app.services.geo_field_detector import GeoFieldDetector
from app.utils.coordinate_transformer import CoordinateTransformer


class GeoDataService:
    """地理化数据解析服务"""

    def __init__(self):
        self.detector = GeoFieldDetector()

    def parse_geo_data(self, file_path: str, filename: str) -> Dict[str, Any]:
        """
        解析地理化数据文件

        Args:
            file_path: 文件路径
            filename: 文件名

        Returns:
            解析结果字典：
            {
                'geometryType': 'point' or 'sector',
                'fields': {...},  # 检测到的字段映射
                'data': [...],    # 解析后的数据列表
                'pointCount': n   # 数据点数量
            }
        """
        # 1. 读取文件
        df = self._read_file(file_path)
        if df.empty:
            raise ValueError(f"文件「{filename}」为空或格式不正确")

        # 2. 字段检测
        fields = self.detector.detect_fields(df)

        # 检查必需字段
        if not fields.get("longitude") or not fields.get("latitude"):
            supported_fields = self.detector.get_supported_field_names()
            lon_fields = ", ".join(supported_fields["longitude"][:5])
            lat_fields = ", ".join(supported_fields["latitude"][:5])

            raise ValueError(
                f"❌ 文件「{filename}」未找到必需的经纬度字段\n\n"
                f"📋 检测到的列：{', '.join(df.columns.tolist()[:10])}\n\n"
                f"✅ 支持的经度字段：{lon_fields} 等\n"
                f"✅ 支持的纬度字段：{lat_fields} 等\n\n"
                f"💡 提示：请确保表格包含经度和纬度列，字段名可以是中文或英文"
            )

        # 3. 验证坐标
        is_valid, error_msg = self.detector.validate_coordinates(
            df, fields["longitude"], fields["latitude"]
        )
        if not is_valid:
            raise ValueError(f"❌ 文件「{filename}」坐标验证失败\n\n{error_msg}")

        # 4. 如果有方位角，验证方位角
        azimuth_col = fields.get("azimuth")
        if azimuth_col:
            is_valid, error_msg = self.detector.validate_azimuth(df, azimuth_col)
            if not is_valid:
                raise ValueError(f"❌ 文件「{filename}」方位角验证失败\n\n{error_msg}")
            print(
                f"[GeoDataService] 检测到方位角列「{azimuth_col}」，文件将被识别为扇区图层"
            )
        else:
            print(f"[GeoDataService] 未检测到方位角列，文件将被识别为点状图层")

        # 5. 根据 geometry_type 选择提取方式
        geometry_type = fields["geometry_type"]

        # 如果是 WKT 多边形数据，先检查 WKT 字段
        if geometry_type == "polygon":
            wkt_col = fields.get("wkt")
            if wkt_col:
                # 验证WKT数据
                wkt_count = df[wkt_col].notna().sum()
                print(
                    f"[GeoDataService] 检测到WKT列「{wkt_col}」，共 {wkt_count} 条多边形数据"
                )
            else:
                print(f"[GeoDataService] 未检测到WKT列，降级为点状图层")
                geometry_type = "point"

        # 根据几何类型提取数据
        if geometry_type == "polygon":
            geo_data = self._extract_polygon_data(df, fields)
        else:
            geo_data = self._extract_data(df, fields)

        # 验证提取结果
        if len(geo_data) == 0:
            raise ValueError(
                f"❌ 文件「{filename}」未能提取到有效数据\n\n"
                f"💡 可能原因：\n"
                f"  • 所有行的经纬度都为空\n"
                f"  • 坐标值格式不正确\n"
                f"  • 数据被过滤（如非数值类型）"
            )

        return {
            "geometryType": geometry_type,
            "fields": fields,
            "data": geo_data,
            "pointCount": len(geo_data),
        }

    def _read_file(self, file_path: str) -> pd.DataFrame:
        """
        根据扩展名读取文件

        Args:
            file_path: 文件路径

        Returns:
            数据框

        Raises:
            ValueError: 文件格式不支持或读取失败
        """
        path = Path(file_path)
        ext = path.suffix.lower()

        if ext in [".xlsx", ".xls"]:
            # Excel 文件
            try:
                return pd.read_excel(path)
            except Exception as e:
                raise ValueError(f"Excel 文件读取失败：{str(e)}")
        elif ext == ".csv":
            # CSV 文件，尝试多种编码
            last_error = None
            for encoding in ["gbk", "utf-8", "utf-8-sig"]:
                try:
                    return pd.read_csv(path, encoding=encoding)
                except UnicodeDecodeError:
                    continue
                except Exception as e:
                    last_error = e
                    if "encoding" not in str(e).lower():
                        raise
            raise ValueError(
                f"❌ CSV 文件编码不支持\n\n"
                f"💡 支持的编码：UTF-8、GBK\n"
                f"💡 建议：用记事本打开文件，另存为 UTF-8 编码"
            )
        elif ext == ".txt":
            # TXT 文件，尝试多种分隔符
            last_error = None
            for sep in [",", "\t", ";", " ", "|"]:
                try:
                    df = pd.read_csv(path, sep=sep, encoding="gbk")
                    if len(df.columns) > 1:
                        return df
                except Exception as e:
                    last_error = e
            raise ValueError(
                f"❌ TXT 文件格式无法识别\n\n"
                f"💡 支持的分隔符：逗号、制表符、分号、空格、竖线\n"
                f"💡 建议：确保文件使用统一的分隔符"
            )
        else:
            raise ValueError(
                f"❌ 不支持的文件格式（.{ext}）\n\n"
                f"💡 支持的格式：.xlsx、.xls、.csv、.txt"
            )

    def _extract_data(
        self, df: pd.DataFrame, fields: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """
        提取并转换坐标数据

        Args:
            df: 数据框
            fields: 检测到的字段映射

        Returns:
            解析后的数据列表
        """
        result = []
        lon_col = fields["longitude"]
        lat_col = fields["latitude"]
        azi_col = fields.get("azimuth")
        beam_col = fields.get("beamwidth")
        cover_col = fields.get("cell_cover_type")
        name_col = fields.get("name")

        for idx, row in df.iterrows():
            try:
                # 提取并转换坐标
                lon = float(row[lon_col])
                lat = float(row[lat_col])

                # WGS84 -> GCJ02 坐标转换
                gcj_lat, gcj_lon = CoordinateTransformer.wgs84_to_gcj02(lat, lon)

                # 基础坐标数据（作为元数据放在根部）
                point = {
                    "longitude": lon,
                    "latitude": lat,
                    "displayLng": gcj_lon,
                    "displayLat": gcj_lat,
                    "properties": {},
                }

                # 提取名称（如果存在，则作为快捷访问放在根部，但保留原始列在 properties 中）
                if name_col and pd.notna(row[name_col]):
                    point["name"] = str(row[name_col])
                else:
                    point["name"] = f"点_{idx + 1}"

                # 提取方位角（如果存在，作为快捷访问放在根部）
                # 注意：输入数据中的方位角是弧度单位，需要转换为度数用于前端渲染
                if azi_col and pd.notna(row[azi_col]):
                    try:
                        azimuth_radians = float(row[azi_col])
                        # 弧度转度数: degrees = radians * (180 / π)
                        azimuth_degrees = azimuth_radians * (180 / math.pi)
                        point["azimuth"] = azimuth_degrees % 360
                    except (ValueError, TypeError):
                        pass

                # 提取波束宽度
                if beam_col and pd.notna(row[beam_col]):
                    try:
                        beam_val = float(row[beam_col])
                        point["beamwidth"] = max(5, min(120, beam_val))
                    except (ValueError, TypeError):
                        point["beamwidth"] = 65

                # 提取覆盖类型
                if cover_col and pd.notna(row[cover_col]):
                    try:
                        cover_val = str(row[cover_col]).lower()
                        if "indoor" in cover_val or "室内" in cover_val or cover_val == "4":
                            point["cell_cover_type"] = 4
                        elif "outdoor" in cover_val or "室外" in cover_val or cover_val == "1":
                            point["cell_cover_type"] = 1
                        else:
                            point["cell_cover_type"] = int(float(row[cover_col]))
                    except (ValueError, TypeError):
                        point["cell_cover_type"] = 1

                # 保存「所有」原始字段到 properties，不再排除已检测字段
                # 这样做是为了保证标签设置下拉框能看到原始列名（如“小区名称”、“小区方位角”）
                for col in df.columns:
                    val = row[col]
                    if pd.notna(val):
                        # 排除掉转换后的内部字段名，防止混淆
                        if col not in ["displayLng", "displayLat"]:
                            point["properties"][col] = val

                result.append(point)
            except (ValueError, TypeError):
                # 跳过无效数据行
                continue

        return result

    def _parse_wkt(self, wkt_str: str) -> Tuple[bool, str, List[Tuple[float, float]]]:
        """
        解析WKT字符串为坐标点列表

        Args:
            wkt_str: WKT格式字符串，如 'POLYGON ((lng lat, lng lat, ...))'

        Returns:
            (是否成功, 错误信息, 坐标点列表 [(lng, lat), ...])
        """
        if not wkt_str or not isinstance(wkt_str, str):
            return False, "WKT为空", []

        wkt_str = wkt_str.strip()
        wkt_upper = wkt_str.upper()

        # 检查是否为 POLYGON 格式
        if not wkt_upper.startswith('POLYGON'):
            return False, f"不支持的WKT类型: {wkt_str[:50]}...", []

        try:
            # 找到第一个左括号和对应的右括号
            # POLYGON ((lng lat, lng lat, ...))
            start = wkt_str.find('(')
            if start == -1:
                return False, "WKT格式无法解析：未找到左括号", []

            # 找到对应的右括号（从内向外匹配）
            paren_count = 0
            end = start
            for i in range(start, len(wkt_str)):
                if wkt_str[i] == '(':
                    paren_count += 1
                elif wkt_str[i] == ')':
                    paren_count -= 1
                    if paren_count == 0:
                        end = i
                        break

            coords_str = wkt_str[start + 1:end].strip()
            if not coords_str:
                return False, "WKT坐标为空", []

            # 检查是否有外环/内环 (MULTI-RING)
            # 格式: ((lng lat, ...), (lng lat, ...))
            outer_coords = coords_str
            if coords_str.startswith('(') and coords_str.endswith(')'):
                # 提取外环（第一个括号内的内容）
                inner_start = coords_str.find('(')
                inner_end = coords_str.rfind(')')
                if inner_start != -1 and inner_end != -1:
                    outer_coords = coords_str[inner_start + 1:inner_end].strip()

            # 分割坐标对
            # 坐标对之间用逗号分隔
            points: List[Tuple[float, float]] = []

            # 先尝试按逗号分割
            coord_pairs = outer_coords.split(',')

            for pair_str in coord_pairs:
                pair_str = pair_str.strip()
                if not pair_str:
                    continue

                # 解析坐标对 (lng lat)
                # 支持多种分隔符：空格
                coords = pair_str.split()

                if len(coords) >= 2:
                    try:
                        lng = float(coords[0])
                        lat = float(coords[1])
                        points.append((lng, lat))
                    except ValueError:
                        continue

            if len(points) < 3:
                return False, f"WKT点数不足（需要至少3个点）: {len(points)}", []

            return True, "", points

        except Exception as e:
            return False, f"WKT解析失败: {str(e)}", []

    def _extract_polygon_data(
        self, df: pd.DataFrame, fields: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """
        提取多边形数据

        Returns:
            [{
                "name": "多边形名称",
                "wkt": "POLYGON ((...))",
                "coordinates": [[lng, lat], ...],
                "properties": {...}
            }]
        """
        result = []
        wkt_col = fields.get("wkt")
        name_col = fields.get("name")

        for idx, row in df.iterrows():
            try:
                wkt_val = row[wkt_col] if wkt_col else None
                if not wkt_val or pd.isna(wkt_val):
                    continue

                # 解析WKT
                success, error_msg, coords = self._parse_wkt(str(wkt_val))
                if not success:
                    print(f"[GeoDataService] 第{idx+1}行WKT解析失败: {error_msg}")
                    continue

                # 提取名称
                name = str(row[name_col]) if name_col and pd.notna(row[name_col]) else f"多边形_{idx+1}"

                polygon = {
                    "name": name,
                    "wkt": str(wkt_val),
                    "coordinates": coords,
                    "properties": {}
                }

                # 提取所有原始字段到properties
                for col in df.columns:
                    val = row[col]
                    if pd.notna(val):
                        if col not in ["coordinates", "displayLng", "displayLat"]:
                            polygon["properties"][col] = val

                result.append(polygon)
            except Exception as e:
                print(f"[GeoDataService] 第{idx+1}行处理失败: {e}")
                continue

        return result
