#!/usr/bin/env python3
"""
直接测试管理网元ID提取逻辑
"""

import pandas as pd
import openpyxl
import os

print("开始直接测试管理网元ID提取逻辑...")

# 直接指定全量工参文件路径
excel_path = "D:/mycode/NetworkPlanningTooV3/全量工参/ProjectParameter_mongoose河源电联20260104111858.xlsx"

if os.path.exists(excel_path):
    print(f"\n找到全量工参文件: {excel_path}")
    
    # 手动读取Excel文件，模拟_parse_full_params_dataframe函数的逻辑
    try:
        # 读取第一行获取列名
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
        
        # 检查是否包含管理网元ID列
        print(f"\n检查是否包含'管理网元ID'列:")
        if '管理网元ID' in clean_columns:
            print(f"  找到'管理网元ID'列，索引: {clean_columns.index('管理网元ID')}")
        else:
            print(f"  未找到'管理网元ID'列")
        
        # 从第4行开始读取数据
        data_df = pd.read_excel(excel_path, sheet_name="LTE Project Parameters", header=None, skiprows=3)
        data_df.columns = clean_columns
        
        print(f"\n数据总行数: {len(data_df)}")
        
        # 查找站点ID为"936475"的行
        print(f"\n查找站点ID为'936475'的行:")
        # 首先找到eNodeB标识列
        if 'eNodeB标识' in clean_columns:
            enodeb_col = 'eNodeB标识'
            target_rows = data_df[data_df[enodeb_col] == 936475]
            print(f"  找到 {len(target_rows)} 行匹配eNodeB标识为936475")
            
            if not target_rows.empty:
                # 查看管理网元ID值
                if '管理网元ID' in clean_columns:
                    me_id_col = '管理网元ID'
                    me_id = target_rows.iloc[0][me_id_col]
                    print(f"  管理网元ID值: {me_id}")
                else:
                    print(f"  未找到'管理网元ID'列")
        else:
            print(f"  未找到'eNodeB标识'列")
        
    except Exception as e:
        print(f"读取Excel文件失败: {e}")
        import traceback
        traceback.print_exc()
else:
    print(f"全量工参文件不存在: {excel_path}")

print("\n测试完成!")
