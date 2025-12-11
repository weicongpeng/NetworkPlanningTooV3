#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""测试导入NetworkPlanningTool_V1模块"""

import sys
import tkinter as tk

# 捕获导入错误
try:
    # 检查GeoPandas
    try:
        import geopandas
        from shapely.geometry import Point, Polygon
        print("[OK] GeoPandas可用")
    except ImportError:
        print("[ERROR] GeoPandas未安装")

    # 尝试导入主模块
    print("正在导入NetworkPlanningTool_V1模块...")
    from NetworkPlanningTool_V1 import PCIGUIApp
    print("[OK] 模块导入成功")

    # 创建根窗口但不显示
    print("正在创建PCIGUIApp实例...")
    root = tk.Tk()
    root.withdraw()  # 隐藏窗口

    app = PCIGUIApp(root)
    print("[OK] PCIGUIApp实例创建成功")

    # 检查图层相关变量
    print("\n检查图层相关变量:")
    attrs = ['layer_data_file', 'layer_type', 'sector_color', 'sector_angle',
             'sector_radius', 'point_color', 'layer_status']
    for attr in attrs:
        if hasattr(app, attr):
            print(f"[OK] {attr}: {getattr(app, attr).get()}")
        else:
            print(f"[ERROR] {attr}: 未找到")

    root.destroy()
    print("\n[OK] 测试完成 - 程序可以正常启动")

except Exception as e:
    print(f"\n[ERROR] 错误: {type(e).__name__}: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)