"""
直接测试已保存文件的解析
"""
import sys
from pathlib import Path
ROOT_DIR = Path(__file__).parent
sys.path.insert(0, str(ROOT_DIR))

import uuid
import shutil
import pandas as pd
from app.core.config import settings

test_file = r'D:\mycode\NetworkPlanningTooV2\全量工参\ProjectParameter_mongoose河源电联20251225110859.xlsx'

print("="*80)
print("测试：直接复制文件到uploads并解析")
print("="*80)

# 1. 复制文件到uploads
data_id = str(uuid.uuid4())
target_file = settings.UPLOAD_DIR / f"{data_id}.xlsx"

print(f"\n1. 复制文件...")
print(f"   源: {test_file}")
print(f"   目标: {target_file}")

try:
    shutil.copy(test_file, target_file)
    print(f"   ✓ 复制成功")
    print(f"   大小: {target_file.stat().st_size:,} 字节")
    
    # 2. 尝试打开
    print(f"\n2. 尝试打开文件...")
    with pd.ExcelFile(target_file) as xls:
        print(f"   ✓ 成功打开")
        print(f"   Sheet: {xls.sheet_names}")
        
        # 3. 尝试读取数据
        print(f"\n3. 尝试读取LTE sheet...")
        df = pd.read_excel(xls, sheet_name='LTE Project Parameters', header=None, nrows=5)
        print(f"   ✓ 读取成功: {df.shape}")
    
    # 4. 清理
    print(f"\n4. 清理测试文件...")
    target_file.unlink()
    print(f"   ✓ 已删除")
    
    print(f"\n✅ 所有测试通过！文件可以正常处理")
    
except PermissionError as e:
    print(f"\n❌ 权限错误: {e}")
    print("   → 可能uploads目录权限不足")
    
except OSError as e:
    print(f"\n❌ 系统错误 [Errno {e.errno}]: {e}")
    if e.errno == 22:
        print("   → 这就是 [Errno 22] Invalid argument 错误!")
        print("   → 可能原因:")
        print("      - 文件路径包含特殊字符")
        print("      - 磁盘问题")
        print("      - 杀毒软件干扰")
    
except Exception as e:
    print(f"\n❌ 其他错误: {type(e).__name__}: {e}")
    import traceback
    traceback.print_exc()
    
print("\n" + "="*80)
