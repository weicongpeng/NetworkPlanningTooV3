"""
测试地理化数据 API 端点
"""

import requests
import pandas as pd
import tempfile
import os

BASE_URL = "http://localhost:8000/api/v1"


def test_upload_geo_data():
    """测试上传地理化数据"""
    print("=" * 60)
    print("测试地理化数据上传 API")
    print("=" * 60)

    # 创建测试数据
    test_data = pd.DataFrame({
        '站点名称': ['站点A', '站点B', '站点C'],
        '经度': [116.404, 121.474, 113.264],
        '纬度': [39.915, 31.230, 23.129],
        '方位角': [0, 90, 180]
    })

    # 保存到临时文件
    with tempfile.NamedTemporaryFile(mode='w', suffix='.xlsx', delete=False) as f:
        temp_path = f.name
        test_data.to_excel(temp_path, index=False)

    try:
        # 准备上传
        url = f"{BASE_URL}/data/upload/geo"

        with open(temp_path, 'rb') as f:
            files = {'file': ('test_geo_data.xlsx', f, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')}

            print(f"\n发送请求到: {url}")
            print(f"文件名: test_geo_data.xlsx")

            response = requests.post(url, files=files, timeout=30)

            print(f"\n状态码: {response.status_code}")
            print(f"响应内容: {response.text[:500]}...")

            if response.status_code == 200:
                result = response.json()
                if result.get('success'):
                    data = result.get('data', {})
                    print(f"\n✅ 上传成功！")
                    print(f"  数据ID: {data.get('id')}")
                    print(f"  文件名: {data.get('name')}")
                    print(f"  几何类型: {data.get('geometryType')}")
                    print(f"  数据点数: {data.get('pointCount')}")
                else:
                    print(f"\n❌ 上传失败: {result}")
            else:
                print(f"\n❌ 请求失败: {response.status_code}")
                try:
                    error = response.json()
                    print(f"错误详情: {error}")
                except:
                    print(f"错误内容: {response.text}")

    except Exception as e:
        print(f"\n❌ 测试失败: {e}")
        import traceback
        traceback.print_exc()
    finally:
        # 清理临时文件
        if os.path.exists(temp_path):
            os.unlink(temp_path)

    print("\n" + "=" * 60)


def test_upload_point_data():
    """测试上传点状数据（无方位角）"""
    print("\n测试点状数据上传")

    test_data = pd.DataFrame({
        '名称': ['点A', '点B', '点C'],
        'lng': [116.404, 121.474, 113.264],
        'lat': [39.915, 31.230, 23.129]
    })

    with tempfile.NamedTemporaryFile(mode='w', suffix='.xlsx', delete=False) as f:
        temp_path = f.name
        test_data.to_excel(temp_path, index=False)

    try:
        url = f"{BASE_URL}/data/upload/geo"

        with open(temp_path, 'rb') as f:
            files = {'file': ('point_data.xlsx', f, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')}
            response = requests.post(url, files=files, timeout=30)

            if response.status_code == 200:
                result = response.json()
                if result.get('success'):
                    data = result.get('data', {})
                    print(f"✅ 点状数据上传成功")
                    print(f"  几何类型: {data.get('geometryType')}")
                    print(f"  数据点数: {data.get('pointCount')}")
                    assert data.get('geometryType') == 'point', "应该是 point 类型"
            else:
                print(f"❌ 点状数据上传失败: {response.status_code}")
    except Exception as e:
        print(f"❌ 测试失败: {e}")
    finally:
        if os.path.exists(temp_path):
            os.unlink(temp_path)


def test_upload_csv_data():
    """测试上传 CSV 数据"""
    print("\n测试 CSV 数据上传")

    test_data = pd.DataFrame({
        'name': ['Location1', 'Location2'],
        'longitude': [116.404, 121.474],
        'latitude': [39.915, 31.230]
    })

    with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
        temp_path = f.name
        test_data.to_csv(temp_path, index=False, encoding='utf-8')

    try:
        url = f"{BASE_URL}/data/upload/geo"

        with open(temp_path, 'rb') as f:
            files = {'file': ('test_data.csv', f, 'text/csv')}
            response = requests.post(url, files=files, timeout=30)

            if response.status_code == 200:
                result = response.json()
                if result.get('success'):
                    print(f"✅ CSV 数据上传成功")
                    data = result.get('data', {})
                    print(f"  数据点数: {data.get('pointCount')}")
            else:
                print(f"❌ CSV 上传失败: {response.status_code}")
                try:
                    error = response.json()
                    print(f"  错误: {error.get('detail')}")
                except:
                    pass
    except Exception as e:
        print(f"❌ 测试失败: {e}")
    finally:
        if os.path.exists(temp_path):
            os.unlink(temp_path)


def test_upload_invalid_data():
    """测试上传无效数据（缺少经纬度）"""
    print("\n测试无效数据上传")

    test_data = pd.DataFrame({
        '名称': ['A', 'B', 'C'],
        '其他列': [1, 2, 3]
    })

    with tempfile.NamedTemporaryFile(mode='w', suffix='.xlsx', delete=False) as f:
        temp_path = f.name
        test_data.to_excel(temp_path, index=False)

    try:
        url = f"{BASE_URL}/data/upload/geo"

        with open(temp_path, 'rb') as f:
            files = {'file': ('invalid.xlsx', f, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')}
            response = requests.post(url, files=files, timeout=30)

            if response.status_code == 400:
                print(f"✅ 正确拒绝了无效数据")
                try:
                    error = response.json()
                    print(f"  错误信息: {str(error.get('detail'))[:100]}...")
                except:
                    print(f"  错误信息: {response.text[:100]}...")
            else:
                print(f"❌ 应该返回 400，实际返回: {response.status_code}")
    except Exception as e:
        print(f"❌ 测试失败: {e}")
    finally:
        if os.path.exists(temp_path):
            os.unlink(temp_path)


if __name__ == '__main__':
    print("\n" + "=" * 60)
    print("地理化数据 API 测试")
    print("=" * 60)
    print(f"后端地址: {BASE_URL}")
    print("请确保后端服务已启动！")
    print("=" * 60)

    try:
        # 测试健康检查
        response = requests.get(f"{BASE_URL.replace('/api/v1', '')}/health", timeout=5)
        if response.status_code == 200:
            print("✅ 后端服务正常")
        else:
            print("❌ 后端服务异常")
            exit(1)
    except Exception as e:
        print(f"❌ 无法连接到后端服务: {e}")
        print("请先启动后端：cd backend && python main.py")
        exit(1)

    # 运行测试
    test_upload_geo_data()
    test_upload_point_data()
    test_upload_csv_data()
    test_upload_invalid_data()

    print("\n" + "=" * 60)
    print("所有测试完成")
    print("=" * 60)
