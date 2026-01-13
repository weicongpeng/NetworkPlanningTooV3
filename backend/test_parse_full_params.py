#!/usr/bin/env python3
"""
直接测试_parse_full_params_dataframe函数，检查管理网元ID提取
"""

import pandas as pd
import openpyxl
import os
import sys

# 添加项目根目录到Python路径
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

print("开始直接测试_parse_full_params_dataframe函数...")

# 直接指定全量工参文件路径
excel_path = "D:/mycode/NetworkPlanningTooV3/全量工参/ProjectParameter_mongoose河源电联20260104111858.xlsx"

if os.path.exists(excel_path):
    print(f"\n找到全量工参文件: {excel_path}")
    
    try:
        # 读取Excel文件，模拟_parse_full_params_dataframe函数的逻辑
        print(f"\n读取Excel文件: {excel_path}")
        df = pd.read_excel(excel_path, sheet_name="LTE Project Parameters", header=None, nrows=5)
        
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
        
        print(f"\n提取到的列名: {clean_columns}")
        
        # 从第4行开始读取数据
        data_df = pd.read_excel(excel_path, sheet_name="LTE Project Parameters", header=None, skiprows=3)
        data_df.columns = clean_columns
        
        print(f"\n数据总行数: {len(data_df)}")
        
        # 查找站点ID为"936475"的行
        print(f"\n查找站点ID为'936475'的行:")
        
        # 首先找到eNodeB标识列
        enodeb_col = None
        for col in clean_columns:
            if 'eNodeB标识' in col or '基站ID' in col or 'site' in col.lower():
                enodeb_col = col
                break
        
        if enodeb_col:
            print(f"  找到站点ID列: {enodeb_col}")
            target_rows = data_df[data_df[enodeb_col] == 936475]
            print(f"  找到 {len(target_rows)} 行匹配站点ID为936475")
            
            if not target_rows.empty:
                # 查找管理网元ID列
                me_col = None
                for col in clean_columns:
                    if '管理网元ID' in col or '网元' in col or 'element' in col.lower():
                        me_col = col
                        break
                
                if me_col:
                    print(f"  找到管理网元ID列: {me_col}")
                    
                    # 查看管理网元ID值
                    me_value = target_rows.iloc[0][me_col]
                    print(f"  管理网元ID值: {me_value}")
                    
                    if me_value == 7906565:
                        print(f"  ✅ 管理网元ID匹配成功!")
                    else:
                        print(f"  ❌ 管理网元ID匹配失败，预期: 7906565, 实际: {me_value}")
                else:
                    print(f"  ❌ 未找到管理网元ID列")
        else:
            print(f"  ❌ 未找到站点ID列")
        
    except Exception as e:
        print(f"读取Excel文件失败: {e}")
        import traceback
        traceback.print_exc()
else:
    print(f"全量工参文件不存在: {excel_path}")

print("\n测试完成!")
