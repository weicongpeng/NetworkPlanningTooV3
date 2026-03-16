"""
地理化数据修复诊断脚本

用于测试 data_service.get_data() 方法是否正确返回地理化数据
"""

import sys
import json
from pathlib import Path

# 添加 backend 目录到路径
backend_dir = Path(__file__).parent / "backend"
sys.path.insert(0, str(backend_dir))

from app.services.data_service import data_service
from app.core.config import settings

def test_get_data():
    """测试 get_data 方法"""
    print("=" * 60)
    print("地理化数据修复诊断")
    print("=" * 60)

    # 获取所有数据
    print("\n1. 获取数据列表...")
    items = data_service.list_data()
    print(f"   总数据数量: {len(items)}")

    # 找到地理化数据
    geo_data_items = [item for item in items if item.get('fileType') == 'geo_data']
    print(f"   地理化数据数量: {len(geo_data_items)}")

    if not geo_data_items:
        print("\n❌ 没有找到地理化数据，请先上传测试数据")
        return

    # 测试第一个地理化数据
    test_item = geo_data_items[0]
    data_id = test_item['id']
    print(f"\n2. 测试数据: {test_item['name']}")
    print(f"   ID: {data_id}")
    print(f"   几何类型: {test_item.get('geometryType', 'unknown')}")

    # 调用 get_data
    print(f"\n3. 调用 get_data('{data_id}')...")
    try:
        result = data_service.get_data(data_id)

        if result is None:
            print("   ❌ 返回 None")
            return

        print(f"   ✅ 成功返回数据")
        print(f"\n4. 数据结构分析:")

        # 检查数据类型
        if isinstance(result, dict):
            print(f"   数据类型: dict")
            print(f"   字段列表: {list(result.keys())}")

            # 检查是否有 default 字段
            if 'default' in result:
                print(f"   ✅ 包含 'default' 字段")
                default_data = result['default']
                print(f"   'default' 类型: {type(default_data)}")

                if isinstance(default_data, list):
                    print(f"   'default' 长度: {len(default_data)}")
                    if len(default_data) > 0:
                        print(f"   第一条数据: {json.dumps(default_data[0], ensure_ascii=False, indent=2)}")
                else:
                    print(f"   ⚠️  'default' 不是列表类型")

            else:
                print(f"   ❌ 不包含 'default' 字段")
                print(f"   实际数据: {json.dumps(result, ensure_ascii=False, indent=2)[:200]}...")

        elif isinstance(result, list):
            print(f"   数据类型: list")
            print(f"   列表长度: {len(result)}")
            print(f"   ❌ 数据应该是字典格式，包含 'default' 字段")
            if len(result) > 0:
                print(f"   第一条数据: {json.dumps(result[0], ensure_ascii=False, indent=2)}")

        else:
            print(f"   数据类型: {type(result)}")
            print(f"   ❌ 未知的数据类型")

    except Exception as e:
        print(f"   ❌ 发生错误: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()

    print("\n" + "=" * 60)
    print("诊断完成")
    print("=" * 60)

if __name__ == "__main__":
    test_get_data()
