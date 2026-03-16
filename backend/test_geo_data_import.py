"""
测试地理化数据导入功能
"""

import sys
import pandas as pd

# 设置 UTF-8 编码输出
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# 添加项目路径
sys.path.insert(0, '/d/mycode/NetworkPlanningTooV3/backend')

from app.services.geo_field_detector import GeoFieldDetector
from app.services.geo_data_service import GeoDataService


def test_field_detector():
    """测试字段检测器"""
    print("=" * 50)
    print("测试字段检测器")
    print("=" * 50)

    # 创建测试数据
    test_data = pd.DataFrame({
        '站点名称': ['站点A', '站点B', '站点C'],
        '经度': [116.404, 121.474, 113.264],
        '纬度': [39.915, 31.230, 23.129],
        '方位角': [0, 90, 180]
    })

    detector = GeoFieldDetector()
    fields = detector.detect_fields(test_data)

    print(f"检测结果:")
    print(f"  经度字段: {fields.get('longitude')}")
    print(f"  纬度字段: {fields.get('latitude')}")
    print(f"  方位角字段: {fields.get('azimuth')}")
    print(f"  名称字段: {fields.get('name')}")
    print(f"  几何类型: {fields.get('geometry_type')}")

    # 验证坐标
    is_valid, msg = detector.validate_coordinates(test_data, fields['longitude'], fields['latitude'])
    print(f"\n坐标验证: {'✅ 通过' if is_valid else '❌ 失败'}")
    if not is_valid:
        print(f"  错误: {msg}")

    # 验证方位角
    if fields.get('azimuth'):
        is_valid, msg = detector.validate_azimuth(test_data, fields['azimuth'])
        print(f"方位角验证: {'✅ 通过' if is_valid else '❌ 失败'}")
        if not is_valid:
            print(f"  错误: {msg}")

    print()


def test_geo_data_service():
    """测试地理化数据服务"""
    print("=" * 50)
    print("测试地理化数据服务")
    print("=" * 50)

    # 创建测试 Excel 文件
    import tempfile
    import os

    test_data = pd.DataFrame({
        '站点名称': ['站点A', '站点B', '站点C'],
        '经度': [116.404, 121.474, 113.264],
        '纬度': [39.915, 31.230, 23.129],
        '方位角': [0, 90, 180]
    })

    with tempfile.NamedTemporaryFile(mode='w', suffix='.xlsx', delete=False) as f:
        temp_path = f.name
        test_data.to_excel(temp_path, index=False)

    try:
        service = GeoDataService()
        result = service.parse_geo_data(temp_path, 'test_data.xlsx')

        print(f"解析结果:")
        print(f"  几何类型: {result['geometryType']}")
        print(f"  数据点数: {result['pointCount']}")
        print(f"  第一个点:")
        first_point = result['data'][0]
        print(f"    名称: {first_point['name']}")
        print(f"    原始坐标: ({first_point['longitude']}, {first_point['latitude']})")
        print(f"    显示坐标: ({first_point['displayLng']}, {first_point['displayLat']})")
        print(f"    方位角: {first_point['azimuth']}")

        print("\n✅ 服务测试通过")
    except Exception as e:
        print(f"\n❌ 服务测试失败: {e}")
        import traceback
        traceback.print_exc()
    finally:
        # 清理临时文件
        if os.path.exists(temp_path):
            os.unlink(temp_path)

    print()


def test_point_data():
    """测试点状数据（无方位角）"""
    print("=" * 50)
    print("测试点状数据")
    print("=" * 50)

    import tempfile
    import os

    test_data = pd.DataFrame({
        '名称': ['点A', '点B', '点C'],
        'lng': [116.404, 121.474, 113.264],
        'lat': [39.915, 31.230, 23.129]
    })

    with tempfile.NamedTemporaryFile(mode='w', suffix='.xlsx', delete=False) as f:
        temp_path = f.name
        test_data.to_excel(temp_path, index=False)

    try:
        service = GeoDataService()
        result = service.parse_geo_data(temp_path, 'point_data.xlsx')

        print(f"解析结果:")
        print(f"  几何类型: {result['geometryType']}")
        print(f"  数据点数: {result['pointCount']}")

        assert result['geometryType'] == 'point', "点状数据应该是 point 类型"
        assert result['pointCount'] == 3, "应该有 3 个点"

        print("\n✅ 点状数据测试通过")
    except Exception as e:
        print(f"\n❌ 点状数据测试失败: {e}")
        import traceback
        traceback.print_exc()
    finally:
        if os.path.exists(temp_path):
            os.unlink(temp_path)

    print()


def test_sector_data():
    """测试扇区数据（有方位角）"""
    print("=" * 50)
    print("测试扇区数据")
    print("=" * 50)

    import tempfile
    import os

    test_data = pd.DataFrame({
        'CellName': ['Cell1', 'Cell2', 'Cell3'],
        'longitude': [116.404, 121.474, 113.264],
        'latitude': [39.915, 31.230, 23.129],
        'azimuth': [0, 120, 240]
    })

    with tempfile.NamedTemporaryFile(mode='w', suffix='.xlsx', delete=False) as f:
        temp_path = f.name
        test_data.to_excel(temp_path, index=False)

    try:
        service = GeoDataService()
        result = service.parse_geo_data(temp_path, 'sector_data.xlsx')

        print(f"解析结果:")
        print(f"  几何类型: {result['geometryType']}")
        print(f"  数据点数: {result['pointCount']}")

        assert result['geometryType'] == 'sector', "扇区数据应该是 sector 类型"
        assert result['pointCount'] == 3, "应该有 3 个扇区"

        print("\n✅ 扇区数据测试通过")
    except Exception as e:
        print(f"\n❌ 扇区数据测试失败: {e}")
        import traceback
        traceback.print_exc()
    finally:
        if os.path.exists(temp_path):
            os.unlink(temp_path)

    print()


if __name__ == '__main__':
    print("\n" + "=" * 50)
    print("地理化数据功能测试")
    print("=" * 50 + "\n")

    test_field_detector()
    test_geo_data_service()
    test_point_data()
    test_sector_data()

    print("=" * 50)
    print("所有测试完成")
    print("=" * 50)
