#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
测试最大邻区数默认值修改
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from NetworkPlanningTool_V1 import NeighborPlanningTool
import tkinter as tk
from NetworkPlanningTool_V1 import PCIGUIApp

def test_max_neighbors_default():
    print("=== 测试最大邻区数默认值修改 ===")
    
    # 测试1: 验证NeighborPlanningTool的默认值
    print("1. 测试NeighborPlanningTool默认最大邻区数...")
    tool_default = NeighborPlanningTool()
    print(f"   默认最大邻区数: {tool_default.max_neighbors}")
    
    tool_explicit = NeighborPlanningTool(max_neighbors=16)
    print(f"   显式设置16: {tool_explicit.max_neighbors}")
    
    tool_custom = NeighborPlanningTool(max_neighbors=64)
    print(f"   自定义设置64: {tool_custom.max_neighbors}")
    
    # 测试2: 验证GUI默认值
    print("\n2. 测试GUI默认最大邻区数...")
    root = tk.Tk()
    root.withdraw()  # 隐藏窗口
    app = PCIGUIApp(root)
    
    gui_default_value = app.max_neighbors.get()
    print(f"   GUI默认最大邻区数: {gui_default_value}")
    
    root.destroy()
    
    # 验证结果
    print("\n3. 验证结果...")
    if tool_default.max_neighbors == 32:
        print("   √ NeighborPlanningTool默认值已正确设置为32")
    else:
        print(f"   X NeighborPlanningTool默认值错误，期望32，实际{tool_default.max_neighbors}")

    if gui_default_value == 32:
        print("   √ GUI默认值已正确设置为32")
    else:
        print(f"   X GUI默认值错误，期望32，实际{gui_default_value}")

    if tool_default.max_neighbors == 32 and gui_default_value == 32:
        print("\n   √ 所有测试通过！最大邻区数默认值已成功修改为32")
        return True
    else:
        print("\n   X 测试失败！")
        return False

if __name__ == "__main__":
    test_max_neighbors_default()