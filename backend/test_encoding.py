"""测试GBK编码问题"""
import sys
import os

# 配置stdout（模拟main.py的配置）
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        try:
            import io
            sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
            sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')
        except:
            pass

# 设置路径
sys.path.insert(0, os.path.dirname(__file__))

# 测试1: 检查stdout编码
print(f"Stdout encoding: {sys.stdout.encoding}")
print(f"Stdout can encode ✗: YES")

# 测试2: 尝试打印包含可能有问题字符的字符串
test_strings = [
    "[DataService] 测试",
    "[DataService] [X] 测试",
    "[DataService] [OK] 测试",
    "[DataService] ✗ 测试",
    "[DataService] 找到'小区覆盖类型'列",
]

for s in test_strings:
    print(f"Test: {s}")

# 测试3: 尝试导入并运行data_service
try:
    from app.services.data_service import data_service
    print("Import successful")

    # 测试_load_current_params
    from pathlib import Path
    current_dir = Path("D:/mycode/NetworkPlanningTooV2/backend/data/5ca70ef3-02ca-4c94-9314-81fab489bf1d")

    print("\n=== Testing _load_current_params ===")
    updates = data_service._load_current_params(current_dir, "NR")
    print(f"Loaded {len(updates)} updates")

except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
