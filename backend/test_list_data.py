#!/usr/bin/env python3
"""
测试list_data()方法是否能够返回正确的文件列表
"""

from app.services.data_service import data_service

print("开始测试list_data()方法...")

# 获取数据列表
items = data_service.list_data()
print(f"\nlist_data()返回 {len(items)} 个数据项")

# 打印每个数据项的详细信息
for item in items:
    print(f"\n数据项:")
    print(f"  ID: {item.id}")
    print(f"  名称: {item.name}")
    print(f"  类型: {item.type}")
    print(f"  文件类型: {item.fileType}")
    print(f"  大小: {item.size}")
    print(f"  上传日期: {item.uploadDate}")
    print(f"  状态: {item.status}")

# 检查是否包含待规划小区文件和全量工参文件
has_target_cells = any(item.fileType == "target_cells" for item in items)
has_full_params = any(item.fileType == "full_params" for item in items)

print(f"\n检查结果:")
print(f"  包含待规划小区文件: {'✅' if has_target_cells else '❌'}")
print(f"  包含全量工参文件: {'✅' if has_full_params else '❌'}")

if has_target_cells and has_full_params:
    print(f"\n✅ 测试通过！list_data()方法能够返回正确的文件列表")
else:
    print(f"\n❌ 测试失败！list_data()方法未能返回正确的文件列表")

print(f"\n测试完成!")
