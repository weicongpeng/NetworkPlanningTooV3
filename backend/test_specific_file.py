import pandas as pd
import sys
import os

sys.stdout.reconfigure(encoding='utf-8')

file_path = r'D:\mycode\NetworkPlanningTooV2\全量工参\ProjectParameter_mongoose河源电联20251225110859.xlsx'

print("=" * 80)
print("测试: ProjectParameter_mongoose河源电联20251225110859.xlsx")
print("=" * 80)

# 检查文件是否存在
if not os.path.exists(file_path):
    print(f"✗ 文件不存在: {file_path}")
    sys.exit(1)

print(f"✓ 文件存在")
print(f"  大小: {os.path.getsize(file_path):,} 字节")

# 尝试打开文件 - 这是最关键的测试
print("\n尝试打开文件...")
try:
    with pd.ExcelFile(file_path) as xls:
        print("✓ 成功打开文件!")
        print(f"  Sheet列表: {xls.sheet_names}")
        
        # 检查sheet名称
        sheet_names_lower = [s.lower() for s in xls.sheet_names]
        has_lte = 'lte project parameters' in sheet_names_lower
        has_nr = 'nr project parameters' in sheet_names_lower
        
        print(f"\n格式验证:")
        print(f"  包含 'LTE Project Parameters': {has_lte}")
        print(f"  包含 'NR Project Parameters': {has_nr}")
        
        if has_lte and has_nr:
            print("  ✓ 格式正确，应该被识别为全量工参!")
            
            # 尝试读取第一行
            print("\n尝试读取LTE sheet第一行...")
            df_header = pd.read_excel(xls, sheet_name='LTE Project Parameters', header=None, nrows=1)
            print(f"  列数: {df_header.shape[1]}")
            
            # 检查是否有\n分隔的列名
            first_col = str(df_header.iloc[0, 0])
            if '\n' in first_col:
                print(f"  ✓ 检测到多行列名（包含\\n）")
                print(f"  示例: {repr(first_col[:50])}")
            else:
                print(f"  第一列: {first_col}")
            
            # 尝试读取数据（从第4行开始）
            print("\n尝试读取数据...")
            df_data = pd.read_excel(xls, sheet_name='LTE Project Parameters', header=None, skiprows=3, nrows=5)
            print(f"  ✓ 成功读取数据: {df_data.shape}")
            
        else:
            print("  ✗ 格式不正确！")
            
except PermissionError as e:
    print(f"✗ 权限错误: {e}")
    print("  → 文件正在被其他程序使用（可能是Excel）")
    print("  → 这就是 [Errno 22] 的原因!")
    
except OSError as e:
    print(f"✗ 系统错误 [Errno {e.errno}]: {e}")
    if e.errno == 22:
        print("  → 这就是您看到的错误!")
        print("  → 最可能的原因: 文件被锁定")
    
except Exception as e:
    print(f"✗ 未预期的错误: {type(e).__name__}: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "=" * 80)
