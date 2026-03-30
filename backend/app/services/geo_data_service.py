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

        # 🔴 早期调试：打印 DataFrame 信息
        print(f"[GeoDataService] 🔴🔴🔴 ===== DataFrame 信息 =====")
        print(f"[GeoDataService] 🔴🔴🔴 文件名: {filename}")
        print(f"[GeoDataService] 🔴🔴🔴 行数: {len(df)}, 列数: {len(df.columns)}")
        print(f"[GeoDataService] 🔴🔴🔴 原始列名: {list(df.columns)}")
        print(
            f"[GeoDataService] 🔴🔴🔴 列类型: {[df[col].dtype for col in df.columns]}"
        )
        print(f"[GeoDataService] 🔴🔴🔴 前3行数据:\n{df.head(3).to_string()}")
        print(f"[GeoDataService] 🔴🔴🔴 ==========================")

        # 2. 字段检测
        fields = self.detector.detect_fields(df)

        # 检查是否为多边形数据（POLYGON列包含所有坐标信息，不需要单独的经纬度列）
        if fields.get("geometry_type") == "polygon" and fields.get("polygon"):
            # 多边形数据：只需要POLYGON列，跳过经纬度检查
            print(
                f"[GeoDataService] 检测到POLYGON列「{fields['polygon']}」，使用POLYGON格式解析坐标"
            )
            # 验证POLYGON数据
            polygon_count = df[fields["polygon"]].notna().sum()
            if polygon_count == 0:
                raise ValueError(
                    f"❌ 文件「{filename}」POLYGON列为空\n\n"
                    f"💡 请确保POLYGON列包含有效的坐标数据（格式：经度 纬度,经度 纬度,...）"
                )
            print(
                f"[GeoDataService] 检测到POLYGON列「{fields['polygon']}」，共 {polygon_count} 条多边形数据"
            )
        elif not fields.get("longitude") or not fields.get("latitude"):
            # 点/扇区数据：必须要有经纬度列
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
        else:
            # 3. 验证坐标（仅对点/扇区数据）
            is_valid, error_msg = self.detector.validate_coordinates(
                df, fields["longitude"], fields["latitude"]
            )
            if not is_valid:
                raise ValueError(f"❌ 文件「{filename}」坐标验证失败\n\n{error_msg}")

        # 4. 如果有方位角且不是多边形数据，验证方位角
        azimuth_col = fields.get("azimuth")
        geometry_type = fields["geometry_type"]
        if geometry_type != "polygon":
            if azimuth_col:
                is_valid, error_msg = self.detector.validate_azimuth(df, azimuth_col)
                if not is_valid:
                    raise ValueError(
                        f"❌ 文件「{filename}」方位角验证失败\n\n{error_msg}"
                    )
                print(
                    f"[GeoDataService] 检测到方位角列「{azimuth_col}」，文件将被识别为扇区图层"
                )
            else:
                print(f"[GeoDataService] 未检测到方位角列，文件将被识别为点状图层")

        # 5. 根据 geometry_type 选择提取方式
        geometry_type = fields["geometry_type"]

        # 如果是 POLYGON 多边形数据，先检查 POLYGON 字段
        if geometry_type == "polygon":
            polygon_col = fields.get("polygon")
            if polygon_col:
                # 验证POLYGON数据
                polygon_count = df[polygon_col].notna().sum()
                print(
                    f"[GeoDataService] 检测到POLYGON列「{polygon_col}」，共 {polygon_count} 条多边形数据"
                )
            else:
                print(f"[GeoDataService] 未检测到POLYGON列，降级为点状图层")
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
                # 注意：输入数据中的方位角是角度单位（0-360度）
                if azi_col and pd.notna(row[azi_col]):
                    try:
                        azimuth = float(row[azi_col])
                        point["azimuth"] = azimuth % 360
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
                        if (
                            "indoor" in cover_val
                            or "室内" in cover_val
                            or cover_val == "4"
                        ):
                            point["cell_cover_type"] = 4
                        elif (
                            "outdoor" in cover_val
                            or "室外" in cover_val
                            or cover_val == "1"
                        ):
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

    def _parse_polygon(self, polygon_str: str) -> Tuple[bool, str, List[List[float]]]:
        """
        使用正则表达式解析POLYGON字符串为坐标点列表（已转换WGS84→GCJ02）
        格式：经度 纬度, 经度 纬度, ...
        例如：114.652216 23.645610, 114.652022 23.645609, 114.652000 23.645700

        Args:
            polygon_str: POLYGON格式字符串

        Returns:
            (是否成功, 错误信息, 坐标点列表 [[lat, lng], ...])  # 已转换GCJ02，[lat, lng]顺序
        """
        print(f"[_parse_polygon] 使用正则表达式解析 POLYGON: {polygon_str[:100]}...")

        if not polygon_str or not isinstance(polygon_str, str):
            print(f"[_parse_polygon] POLYGON为空或非字符串")
            return False, "POLYGON为空或非字符串", []

        polygon_str = polygon_str.strip()

        try:
            # 使用正则表达式匹配 "lng lat" 模式
            pattern = r"(\d+\.\d+)\s+(\d+\.\d+)"
            matches = re.findall(pattern, polygon_str)

            print(f"[_parse_polygon] 正则匹配到 {len(matches)} 个坐标对")

            if len(matches) < 3:
                print(
                    f"[_parse_polygon] POLYGON点数不足（需要至少3个点）: {len(matches)}"
                )
                return False, f"POLYGON点数不足（需要至少3个点）: {len(matches)}", []

            # 转换为 [[lat, lng], ...] 格式，并进行 WGS84→GCJ02 转换
            path: List[List[float]] = []
            for lng_str, lat_str in matches:
                lng = float(lng_str)
                lat = float(lat_str)
                # WGS84→GCJ02 转换
                gcj_lat, gcj_lng = CoordinateTransformer.wgs84_to_gcj02(lat, lng)
                path.append([gcj_lat, gcj_lng])  # Leaflet positions 需要 [lat, lng]
                print(
                    f"[_parse_polygon] 坐标转换: WGS84({lat}, {lng}) -> GCJ02({gcj_lat}, {gcj_lng})"
                )

            print(f"[_parse_polygon] POLYGON解析成功，返回 {len(path)} 个点")
            return True, "", path

        except Exception as e:
            import traceback

            traceback.print_exc()
            return False, f"POLYGON解析失败: {str(e)}", []

    def _extract_polygon_data(
        self, df: pd.DataFrame, fields: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """
        提取多边形数据

        Returns:
            [{
                "name": "多边形名称",
                "path": [[lat, lng], ...],  # 已转换GCJ02，直接用于Leaflet
                "properties": {...}
            }]
        """
        print(f"[_extract_polygon_data] 开始提取，共 {len(df)} 行数据")
        result = []
        polygon_col = fields.get("polygon")
        name_col = fields.get("name")
        print(f"[_extract_polygon_data] POLYGON列: {polygon_col}, 名称列: {name_col}")

        for idx, row in df.iterrows():
            try:
                polygon_val = row[polygon_col] if polygon_col else None
                if not polygon_val or pd.isna(polygon_val):
                    print(f"[_extract_polygon_data] 第{idx + 1}行: POLYGON值为空，跳过")
                    continue

                print(
                    f"[_extract_polygon_data] 第{idx + 1}行 POLYGON: {str(polygon_val)[:80]}..."
                )

                # 解析POLYGON（现已返回已转换的 [[lat, lng], ...]）
                success, error_msg, path = self._parse_polygon(str(polygon_val))
                if not success:
                    print(
                        f"[_extract_polygon_data] 第{idx + 1}行POLYGON解析失败: {error_msg}"
                    )
                    continue

                print(
                    f"[_extract_polygon_data] 第{idx + 1}行解析成功，坐标数: {len(path)}"
                )

                # 提取名称
                name = (
                    str(row[name_col])
                    if name_col and pd.notna(row[name_col])
                    else f"多边形_{idx + 1}"
                )

                polygon = {
                    "name": name,
                    "path": path,  # 已转换的坐标，直接用于Leaflet positions
                    "properties": {},
                }

                # 提取所有原始字段到properties
                for col in df.columns:
                    val = row[col]
                    if pd.notna(val):
                        if col not in [
                            "path",
                            "coordinates",
                            "displayLng",
                            "displayLat",
                            polygon_col,
                        ]:
                            polygon["properties"][col] = val

                result.append(polygon)
                print(
                    f"[_extract_polygon_data] 已添加第{idx + 1}个多边形，当前总数: {len(result)}"
                )
            except Exception as e:
                print(f"[_extract_polygon_data] 第{idx + 1}行处理失败: {e}")
                continue

        print(f"[_extract_polygon_data] 完成，共提取 {len(result)} 个多边形")
        return result
