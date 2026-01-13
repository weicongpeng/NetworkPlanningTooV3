#!/usr/bin/env python3
"""
调试LTE网元ID匹配逻辑
"""

import pandas as pd
import openpyxl
import os

print("开始调试LTE网元ID匹配逻辑...")

# 直接指定全量工参文件路径
excel_path = "D:/mycode/NetworkPlanningTooV3/全量工参/ProjectParameter_mongoose河源电联20260104111858.xlsx"

if os.path.exists(excel_path):
    print(f"\n找到全量工参文件: {excel_path}")
    
    # 手动读取Excel文件，查看列名
    try:
        with pd.ExcelFile(excel_path) as xls:
            # 查看所有sheet名称
            print(f"\nExcel文件包含的sheet: {xls.sheet_names}")
            
            # 读取第一个sheet的前5行，查看列名
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
            for i, col in enumerate(clean_columns):
                if '网元' in col or 'element' in col.lower() or 'managed' in col.lower() or '管理' in col:
                    print(f"  第 {i} 列: {col}")
            
            # 从第4行开始读取数据
            data_df = pd.read_excel(xls, sheet_name=xls.sheet_names[0], header=None, skiprows=3)
            data_df.columns = clean_columns
            print(f"\n数据总行数: {len(data_df)}")
            
            # 查找包含"936475"的行
            print(f"\n查找站点ID为'936475'的行:")
            target_site_rows = data_df[data_df.apply(lambda row: row.astype(str).str.contains('936475').any(), axis=1)]
            print(f"找到 {len(target_site_rows)} 行包含'936475'")
            
            if not target_site_rows.empty:
                # 打印第一行的详细信息
                print(f"\n第一行详细信息:")
                first_row = target_site_rows.iloc[0]
                for col, value in first_row.items():
                    print(f"  {col}: {value}")
                
                # 查找管理网元ID列
                print(f"\n查找管理网元ID值:")
                for col in clean_columns:
                    if '网元' in col or 'element' in col.lower() or 'managed' in col.lower() or '管理' in col:
                        value = first_row[col]
                        print(f"  {col}: {value}")
            
    except Exception as e:
        print(f"读取Excel文件失败: {e}")
        import traceback
        traceback.print_exc()
else:
    print(f"全量工参文件不存在: {excel_path}")

print("\n调试完成!")
