import pandas as pd
import sys

sys.stdout.reconfigure(encoding='utf-8')

file_path = r'D:\mycode\NetworkPlanningTooV2\全量工参\全量工参1.xlsx'

print("="*60)
print("检查全量工参1.xlsx文件")
print("="*60)

# 打开文件
xls = pd.ExcelFile(file_path)
print(f"\n1. Sheet列表: {xls.sheet_names}")

# 检查LTE sheet
print("\n2. 检查LTE sheet...")
df_lte = pd.read_excel(xls, sheet_name='LTE', header=None, nrows=5)
print(f"   数据形状: {df_lte.shape}")
print(f"\n   前5行 x 前10列:")
print(df_lte.iloc[:, :10])

# 检查第一行列名
print("\n3. 第一行列名详情:")
header_row = df_lte.iloc[0]
for i in range(min(15, len(header_row))):
    col_val = header_row.iloc[i]
    print(f"   列{i}: {repr(col_val)}")

# 检查列名中是否有\n
print("\n4. 检查是否有多行列名(包含\\n):")
has_newline = False
for i, col in enumerate(header_row):
    col_str = str(col)
    if '\n' in col_str:
        has_newline = True
        print(f"   列{i}包含换行符: {repr(col_str[:100])}")

if not has_newline:
    print("   ❌ 没有发现包含\\n的列名")
    print("   这不是标准的全量工参格式(Project Parameters)")

# 尝试按照默认方式读取
print("\n5. 尝试不同方式读取:")
try:
    df_default = pd.read_excel(xls, sheet_name='LTE')
    print(f"   ✅ 默认方式读取成功: {df_default.shape}")
    print(f"   列名: {list(df_default.columns)[:10]}")
except Exception as e:
    print(f"   ❌ 默认方式读取失败: {e}")

try:
    df_skip3 = pd.read_excel(xls, sheet_name='LTE', header=3)
    print(f"   ✅ 跳过前3行读取成功: {df_skip3.shape}")
    print(f"   列名: {list(df_skip3.columns)[:10]}")
except Exception as e:
    print(f"   ❌ 跳过前3行读取失败: {e}")

xls.close()

print("\n" + "="*60)
print("检查完成")
print("="*60)
