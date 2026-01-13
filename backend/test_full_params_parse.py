#!/usr/bin/env python3
"""
测试_parse_full_params_dataframe方法，验证修复是否有效
"""

import pandas as pd
import os
import sys

# 添加项目根目录到Python路径
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.data_service import data_service

print("开始测试_parse_full_params_dataframe方法...")

# 检查文件路径
file_path = "D:/mycode/NetworkPlanningTooV3/backend/uploads/663c98ee-78e3-4af6-95c5-1673686748fb.xlsx"

if os.path.exists(file_path):
    print(f"找到文件: {file_path}")
    
    try:
        # 读取Excel文件
        xls = pd.ExcelFile(file_path)
        
        # 检查LTE Project Parameters sheet
        if 'LTE Project Parameters' in xls.sheet_names:
            print(f"\n===== 测试LTE Project Parameters sheet =====")
            
            # 读取前几行数据
            df = pd.read_excel(xls, sheet_name='LTE Project Parameters', header=None, nrows=5)
            
            # 提取中文名称（第一行中\n之前的部分）
            header_row = df.iloc[0]
            clean_columns = []
            for col in header_row:
                col_str = str(col).strip() if pd.notna(col) else ''
                if '\n' in col_str:
                    chinese_name = col_str.split('\n')[0].strip()
                    clean_columns.append(chinese_name)
                else:
                    clean_columns.append(col_str)
            
            # 从第4行开始读取数据
            data_df = pd.read_excel(xls, sheet_name='LTE Project Parameters', header=None, skiprows=3)
            data_df.columns = clean_columns
            
            print(f"\n数据总行数: {len(data_df)}")
            
            # 调用_parse_full_params_dataframe方法进行测试
            print(f"\n调用_parse_full_params_dataframe方法...")
            result = data_service._parse_full_params_dataframe(data_df, 'LTE')
            
            print(f"\n测试结果:")
            print(f"  解析成功，共生成 {len(result)} 个站点")
            
            if result:
                print(f"  第一个站点: {result[0]}")
                print(f"  第一个站点的小区数量: {len(result[0].get('sectors', {}))}")
                
                print(f"\n✅ 测试通过！_parse_full_params_dataframe方法能够正确解析全量工参文件")
            else:
                print(f"\n❌ 测试失败！_parse_full_params_dataframe方法未能生成任何站点")
            
    except Exception as e:
        print(f"\n❌ 测试失败！错误信息: {e}")
        import traceback
        traceback.print_exc()
else:
    print(f"文件不存在: {file_path}")

print("\n测试完成!")
