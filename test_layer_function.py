#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""测试图层制作功能"""

import pandas as pd
import numpy as np
import os

# 创建测试数据
test_data = pd.DataFrame({
    '小区名称': ['小区A', '小区B', '小区C', '小区D'],
    '经度': [116.3974, 116.3984, 116.3994, 116.4004],
    '纬度': [39.9093, 39.9103, 39.9113, 39.9123],
    '方位角': [0, 120, 240, 60]
})

# 添加一些无效数据用于测试清洗功能
test_data_invalid = pd.DataFrame({
    '小区名称': ['无效1', '无效2', '', '有效小区'],
    '经度': [116.4, 'invalid', 116.5, 116.6],
    '纬度': ['invalid', 39.9, 39.91, 39.92],
    '方位角': [90, 180, None, 270]
})

# 保存测试数据
os.makedirs("test_data", exist_ok=True)
test_data.to_excel("test_data/valid_test_data.xlsx", index=False)
test_data_invalid.to_excel("test_data/invalid_test_data.xlsx", index=False)

print("测试数据已创建:")
print("- test_data/valid_test_data.xlsx (4个有效小区)")
print("- test_data/invalid_test_data.xlsx (包含无效数据)")
print("\n测试数据内容:")
print("\n有效数据:")
print(test_data)
print("\n包含无效数据:")
print(test_data_invalid)

# 预期结果:
# - 有效数据: 4个小区全部通过
# - 无效数据: 只有"有效小区"能通过清洗（第4行）
# - 无效1: 经度为字符串
# - 无效2: 纬度为字符串
# - 第3行: 小区名称为空