#!/usr/bin/env python3
"""
测试LTE网元ID匹配逻辑
"""

from app.services.data_service import data_service

print("开始测试LTE网元ID匹配逻辑...")

# 获取所有数据项
data_items = data_service.list_data()
print(f"找到 {len(data_items)} 个数据项")

# 查找全量工参文件
target_cells_data = None
full_params_data = None

for item in data_items:
    if item.type.value == "excel":
        filename = item.name.lower()
        print(f"检查数据项: {item.name} ({item.id})")
        
        if filename.startswith('cell-tree-export'):
            print(f"找到待规划小区文件: {item.name}")
            target_cells_data = data_service.get_data(item.id)
        elif filename.startswith('projectparameter_mongoose'):
            print(f"找到全量工参文件: {item.name}")
            full_params_data = data_service.get_data(item.id)
        
        if target_cells_data and full_params_data:
            print("已找到待规划小区文件和全量工参文件，退出循环")
            break

# 验证数据是否找到
if not target_cells_data:
    raise ValueError("未找到待规划小区文件")
if not full_params_data:
    raise ValueError("未找到全量工参文件")

# 检查全量工参中的LTE站点数据
print("\n检查全量工参中的LTE站点数据:")
lte_sites = []

if isinstance(full_params_data, dict):
    if "LTE" in full_params_data:
        lte_sites = full_params_data["LTE"]
        print(f"找到 {len(lte_sites)} 个LTE站点")
        # 打印前几个站点的详细信息
        print(f"\n前3个站点的详细信息:")
        for i, site in enumerate(lte_sites[:3]):
            print(f"站点 {i+1}:")
            print(f"  ID: {site.get('id')}")
            print(f"  名称: {site.get('name')}")
            print(f"  管理网元ID: {site.get('managedElementId')}")
            print(f"  所有字段: {list(site.keys())}")
            # 打印第一个小区的详细信息
            sectors = site.get('sectors', [])
            if sectors:
                sector = sectors[0]
                print(f"  第一个小区: {list(sector.keys())}")
                break
nelif isinstance(full_params_data, list):
    lte_sites = [site for site in full_params_data if site.get('networkType') == "LTE"]
    print(f"找到 {len(lte_sites)} 个LTE站点")

# 检查data_service的日志，查看列名匹配情况
print("\n查看data_service的日志输出，了解列名匹配情况:")
# 我们可以通过直接查看data_service的处理过程来了解列名匹配情况

# 创建一个简单的测试，直接调用_parse_full_params_dataframe函数
print("\n尝试直接解析全量工参文件，查看列名匹配情况:")
import pandas as pd
import openpyxl
from app.services.data_service import DataService

# 手动创建一个DataService实例并调用解析函数
# 注意：这需要访问原始Excel文件，所以我们需要找到文件路径
data_service_instance = DataService()

# 查找全量工参文件的实际路径
import os
from app.utils.file_utils import get_data_dir

# 获取全量工参文件的实际路径
full_params_item = None
for item in data_items:
    if item.name == "ProjectParameter_mongoose河源电联20260104111858.xlsx":
        full_params_item = item
        break

if full_params_item:
    # 获取文件路径
    data_dir = get_data_dir(full_params_item.id)
    excel_path = os.path.join(data_dir, "data.xlsx")
    
    if os.path.exists(excel_path):
        print(f"\n找到全量工参文件: {excel_path}")
        
        # 手动读取Excel文件，查看列名
        try:
            with pd.ExcelFile(excel_path) as xls:
                # 查看所有sheet名称
                print(f"\nExcel文件包含的sheet: {xls.sheet_names}")
                
                # 读取第一个sheet的前几行，查看列名
                df = pd.read_excel(xls, sheet_name=xls.sheet_names[0], header=None, nrows=5)
                print(f"\n第一个sheet的前5行数据:")
                print(df)
                
                # 提取中文名称（第一行中\n之前的部分）
                header_row = df.iloc[0]
                clean_columns = []
                for col in header_row:
                    col_str = str(col).strip() if pd.notna(col) else ''
                    if '\n' in col_str:
                        # 提取第一个\n之前的中文名称
                        chinese_name = col_str.split('\n')[0].strip()
                        clean_columns.append(chinese_name)
                    else:
                        clean_columns.append(col_str)
                
                print(f"\n提取到的列名: {clean_columns}")
                
                # 检查是否包含管理网元ID相关列
                print(f"\n检查是否包含管理网元ID相关列:")
                managed_element_related = [col for col in clean_columns if '管理' in col or '网元' in col or 'element' in col.lower()]
                print(f"  与管理网元相关的列: {managed_element_related}")
                
        except Exception as e:
            print(f"读取Excel文件失败: {e}")
    else:
        print(f"全量工参文件不存在: {excel_path}")

# 查找特定站点ID的管理网元ID
target_site_id = "936475"
found = False

for site in lte_sites:
    site_id = site.get('id', '')
    managed_element_id = site.get('managedElementId')
    
    if site_id == target_site_id:
        found = True
        print(f"\n找到目标站点!")
        print(f"站点ID: {site_id}")
        print(f"管理网元ID: {managed_element_id}")
        print(f"站点名称: {site.get('name')}")
        print(f"小区数量: {len(site.get('sectors', []))}")
        
        # 打印小区信息
        sectors = site.get('sectors', [])
        for sector in sectors:
            print(f"  小区ID: {sector.get('id')}, 小区名称: {sector.get('name')}, PCI: {sector.get('pci')}")
        break

if not found:
    print(f"\n未找到站点ID为 {target_site_id} 的LTE站点")
    # 打印所有LTE站点的ID，方便调试
    print("\n所有LTE站点ID:")
    for site in lte_sites[:10]:
        print(f"  {site.get('id')} (管理网元ID: {site.get('managedElementId')})")

print("\n测试完成!")
