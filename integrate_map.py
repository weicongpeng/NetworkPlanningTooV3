#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
将地图功能整合到优化后的主程序中
"""

def integrate_map():
    # 读取map_Browse.py的内容，提取TiandituMapPanel类
    with open(r'D:\mycode\NetworkPlanningTool\map_Browse.py', 'r', encoding='utf-8') as f:
        map_content = f.read()

    # 提取TiandituMapPanel类（从class TiandituMapPanel到下一个class之前）
    map_lines = map_content.split('\n')
    tianditu_class_start = None
    tianditu_class_end = None

    for i, line in enumerate(map_lines):
        if line.startswith('class TiandituMapPanel'):
            tianditu_class_start = i
        elif tianditu_class_start and line.startswith('class ') and i > tianditu_class_start:
            tianditu_class_end = i
            break

    if tianditu_class_end is None:
        tianditu_class_end = len(map_lines)

    tianditu_class = '\n'.join(map_lines[tianditu_class_start:tianditu_class_end])

    print(f"TiandituMapPanel类行数: {tianditu_class_end - tianditu_class_start}")

    # 读取优化后的主程序
    with open(r'D:\mycode\NetworkPlanningTool\NetworkPlanningTool_V1_optimized2.py', 'r', encoding='utf-8') as f:
        main_content = f.read()

    main_lines = main_content.split('\n')
    print(f"主程序行数: {len(main_lines)}")

    # 在导入语句后插入地图相关的导入
    import_insert_pos = 0
    for i, line in enumerate(main_lines):
        if line.startswith('import ') or line.startswith('from '):
            # 找到最后一个导入语句
            if i + 1 >= len(main_lines) or (not main_lines[i+1].startswith('import ') and not main_lines[i+1].startswith('from ')):
                import_insert_pos = i + 1
        else:
            break

    print(f"导入语句插入位置: {import_insert_pos}")

    # 创建新的导入语句
    new_imports = [
        "",
        "# Map related imports",
        "try:",
        "    import tkintermapview",
        "    MAP_AVAILABLE = True",
        "except ImportError:",
        "    MAP_AVAILABLE = False",
        "    print(\"Warning: tkintermapview not found.\")",
        "",
        "try:",
        "    from osgeo import ogr",
        "    OGR_AVAILABLE = True",
        "except ImportError:",
        "    OGR_AVAILABLE = False",
        "",
        "import math",
        "import ssl",
        "try:",
        "    _create_unverified_https_context = ssl._create_unverified_context",
        "except AttributeError:",
    ]

    # 在类定义之前插入TiandituMapPanel类
    class_insert_pos = 0
    for i, line in enumerate(main_lines):
        if line.startswith('class ') and 'PCIGUIApp' in line:
            class_insert_pos = i
            break

    print(f"TiandituMapPanel类插入位置: {class_insert_pos}")

    # 构建新的主程序
    new_lines = main_lines[:import_insert_pos] + new_imports + main_lines[import_insert_pos:class_insert_pos] + [tianditu_class, ""] + main_lines[class_insert_pos:]

    print(f"插入后的总行数: {len(new_lines)}")

    # 在每个tab创建函数的末尾添加地图实例
    # 找到create_pci_planning_tab函数的结束位置（在create_param_update_tab之前）
    for i, line in enumerate(new_lines):
        if 'def create_pci_planning_tab' in line:
            # 找到这个函数的结尾
            func_start = i
            for j in range(i, len(new_lines)):
                if new_lines[j].strip().startswith('def ') and not new_lines[j].startswith('        ') and j > i:
                    # 在函数结束前添加地图框架
                    # 找到这个函数的最后一行
                    for k in range(j-1, i, -1):
                        if new_lines[k].strip() and not new_lines[k].strip().startswith('#'):
                            # 在这里插入地图
                            indent = '        '
                            map_insertion = [
                                indent + "",
                                indent + "# 地图框架",
                                indent + "self.pci_map_frame = ttk.LabelFrame(pci_frame, text=\"在线地图\")",
                                indent + "self.pci_map_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=5)",
                                indent + "self.pci_map_widget = TiandituMapPanel(self.pci_map_frame, app_instance=self)",
                                indent + "self.pci_map_widget.pack(fill=tk.BOTH, expand=True)",
                            ]
                            new_lines = new_lines[:k+1] + map_insertion + new_lines[k+1:]
                            break
                    break
            break

    # 对于param_update_tab
    for i, line in enumerate(new_lines):
        if 'def create_param_update_tab' in line:
            for j in range(i, len(new_lines)):
                if new_lines[j].strip().startswith('def ') and not new_lines[j].startswith('        ') and j > i:
                    for k in range(j-1, i, -1):
                        if new_lines[k].strip() and not new_lines[k].strip().startswith('#'):
                            indent = '        '
                            map_insertion = [
                                indent + "",
                                indent + "# 地图框架",
                                indent + "self.update_map_frame = ttk.LabelFrame(param_frame, text=\"在线地图\")",
                                indent + "self.update_map_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=5)",
                                indent + "self.update_map_widget = TiandituMapPanel(self.update_map_frame, app_instance=self)",
                                indent + "self.update_map_widget.pack(fill=tk.BOTH, expand=True)",
                            ]
                            new_lines = new_lines[:k+1] + map_insertion + new_lines[k+1:]
                            break
                    break
            break

    # 对于neighbor planning tab
    for i, line in enumerate(new_lines):
        if 'def create_neighbor_planning_tab' in line:
            for j in range(i, len(new_lines)):
                if new_lines[j].strip().startswith('def ') and not new_lines[j].startswith('        ') and j > i:
                    for k in range(j-1, i, -1):
                        if new_lines[k].strip() and not new_lines[k].strip().startswith('#'):
                            indent = '        '
                            map_insertion = [
                                indent + "",
                                indent + "# 地图框架",
                                indent + "self.neighbor_map_frame = ttk.LabelFrame(neighbor_frame, text=\"在线地图\")",
                                indent + "self.neighbor_map_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=5)",
                                indent + "self.neighbor_map_widget = TiandituMapPanel(self.neighbor_map_frame, app_instance=self)",
                                indent + "self.neighbor_map_widget.pack(fill=tk.BOTH, expand=True)",
                            ]
                            new_lines = new_lines[:k+1] + map_insertion + new_lines[k+1:]
                            break
                    break
            break

    # 查找并添加 update_status 方法（如果缺少的话）
    has_update_status = False
    for line in new_lines:
        if 'def update_status' in line:
            has_update_status = True
            break

    if not has_update_status:
        # 在PCIGUIApp类中找到合适的位置添加方法
        for i, line in enumerate(new_lines):
            if 'class PCIGUIApp' in line:
                # 找到类的最后一个方法
                for j in range(i, len(new_lines)):
                    if new_lines[j].strip().startswith('def ') and j > i:
                        last_method_pos = j
                    elif j == len(new_lines)-1 or (new_lines[j].strip() and not new_lines[j].startswith(' ') and j > i):
                        # 在类结束前插入新方法
                        indent = '    '
                        new_method = [
                            indent + "",
                            indent + "def update_status(self, text):",
                            indent + "    \"\"\"Update status bar text\"\"\"",
                            indent + "    pass",
                        ]
                        new_lines = new_lines[:last_method_pos] + new_method + new_lines[last_method_pos:]
                        break
                break

    # 写回文件
    final_content = '\n'.join(new_lines)

    with open(r'D:\mycode\NetworkPlanningTool\NetworkPlanningTool_V1_with_map.py', 'w', encoding='utf-8') as f:
        f.write(final_content)

    print(f"地图整合完成！总文件行数: {len(new_lines)}")
    print("生成文件: NetworkPlanningTool_V1_with_map.py")

if __name__ == "__main__":
    integrate_map()
