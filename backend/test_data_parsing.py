"""
测试数据解析功能
"""
import sys
from pathlib import Path

# 添加项目根目录到Python路径
ROOT_DIR = Path(__file__).parent
sys.path.insert(0, str(ROOT_DIR))

from app.services.data_service import data_service
from app.core.config import settings


def test_parse_excel():
    """测试Excel解析"""
    print("=" * 50)
    print("测试Excel数据解析功能")
    print("=" * 50)

    # 检查是否有已上传的Excel文件
    import json
    index_path = settings.DATA_DIR / "index.json"

    if not index_path.exists():
        print("错误: 没有找到数据索引文件")
        return

    with open(index_path, 'r', encoding='utf-8') as f:
        index = json.load(f)

    print(f"\n已导入的数据文件:")
    for data_id, info in index.items():
        if info.get('type') == 'excel':
            print(f"  - {info['name']} (ID: {data_id})")

            # 尝试读取原始Excel文件
            data_dir = settings.DATA_DIR / data_id
            original_file = data_dir / "original.xlsx"

            if original_file.exists():
                print(f"\n测试解析: {original_file}")
                try:
                    import pandas as pd
                    df = pd.read_excel(original_file, sheet_name=0)
                    print(f"  Excel行数: {len(df)}")
                    print(f"  Excel列名: {list(df.columns)}")

                    # 测试解析
                    result = data_service._parse_excel_data(df)
                    print(f"  解析结果: {len(result)} 个基站")

                    if result:
                        print(f"\n  第一个基站:")
                        site = result[0]
                        print(f"    ID: {site['id']}")
                        print(f"    名称: {site['name']}")
                        print(f"    经纬度: ({site['longitude']}, {site['latitude']})")
                        print(f"    网络类型: {site['networkType']}")
                        print(f"    小区数: {len(site['sectors'])}")

                        if site['sectors']:
                            sector = site['sectors'][0]
                            print(f"\n  第一个小区:")
                            print(f"    ID: {sector['id']}")
                            print(f"    名称: {sector['name']}")
                            print(f"    方位角: {sector.get('azimuth', 'N/A')}")
                            print(f"    PCI: {sector.get('pci', 'N/A')}")
                            print(f"    EARFCN: {sector.get('earfcn', 'N/A')}")
                    else:
                        print("  警告: 解析结果为空!")

                except Exception as e:
                    print(f"  错误: {e}")
                    import traceback
                    traceback.print_exc()

    print("\n" + "=" * 50)
    print("测试完成")
    print("=" * 50)


if __name__ == "__main__":
    test_parse_excel()
