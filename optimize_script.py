#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
脚本用于优化 NetworkPlanningTool_V1.py
删除小区搜索功能、菜单、状态栏等
"""

import re

def delete_lines_by_patterns(content, patterns):
    """根据模式删除代码块"""
    lines = content.split('\n')
    lines_to_delete = set()

    for pattern_name, start_pattern, end_pattern in patterns:
        i = 0
        while i < len(lines):
            if start_pattern(lines[i]):
                start = i
                # 找到结束位置
                i += 1
                while i < len(lines):
                    if end_pattern(lines[i]):
                        end = i + 1
                        print(f"找到 {pattern_name}: 行 {start+1} 到 {end}")
                        lines_to_delete.update(range(start, end))
                        break
                    i += 1
            i += 1

    return [line for i, line in enumerate(lines) if i not in lines_to_delete]

def main():
    # 读取原始文件
    with open(r'D:\mycode\NetworkPlanningTool\NetworkPlanningTool_V1.py', 'r', encoding='utf-8') as f:
        content = f.read()

    original_length = len(content.split('\n'))
    print(f"原始文件行数: {original_length}")

    patterns = [
        # 删除 create_menu 函数
        ("create_menu",
         lambda line: line.strip() == "def create_menu(self):",
         lambda line: line.startswith('    def ') and not line.startswith('        ') and 'create_menu' not in line),

        # 删除 search_nr_cells 函数
        ("search_nr_cells",
         lambda line: line.strip() == "def search_nr_cells(self):",
         lambda line: line.startswith('    def ') and not line.startswith('        ') and 'search_nr_cells' not in line),

        # 删除 search_lte_cells 函数
        ("search_lte_cells",
         lambda line: line.strip() == "def search_lte_cells(self):",
         lambda line: line.startswith('    def ') and not line.startswith('        ') and 'search_lte_cells' not in line),

        # 删除 copy_nr_cell_value 函数
        ("copy_nr_cell_value",
         lambda line: line.strip() == "def copy_nr_cell_value(self):",
         lambda line: line.startswith('    def ') and not line.startswith('        ') and 'copy_nr_cell_value' not in line),

        # 删除 copy_lte_cell_value 函数
        ("copy_lte_cell_value",
         lambda line: line.strip() == "def copy_lte_cell_value(self):",
         lambda line: line.startswith('    def ') and not line.startswith('        ') and 'copy_lte_cell_value' not in line),
    ]

    # 删除函数
    lines = delete_lines_by_patterns(content, patterns)
    content = '\n'.join(lines)

    # 删除 GUI 部分
    # 删除小区搜索 frame (4922-5061行)
    lines = content.split('\n')
    lines = lines[:4921] + lines[5061:]  # 删除4922-5061行（0-based索引）

    print(f"删除小区搜索GUI后行数: {len(lines)}")

    # 删除菜单调用
    lines = [line for line in lines if 'self.create_menu()' not in line]

    # 删除状态栏
    # 找到 status_var 相关代码并删除
    filtered_lines = []
    skip_count = 0
    for i, line in enumerate(lines):
        if skip_count > 0:
            skip_count -= 1
            continue

        if 'self.status_var = tk.StringVar()' in line:
            skip_count = 2  # 跳过接下来的2行
            continue

        filtered_lines.append(line)

    lines = filtered_lines

    # 更新进度（由于文件行数变化，实际需要重新计算）
    content = '\n'.join(lines)

    # 删除状态栏的Label
    content = re.sub(r'\s+status_bar = ttk\.Label\(self\.root, textvariable=self\.status_var, relief=tk\.SUNKEN, anchor=tk\.W\).*', '', content)
    content = re.sub(r'\s+status_bar\.pack\(side=tk\.BOTTOM, fill=tk\.X\).*', '', content)

    # 将所有 status_var.set() 调用替换为 pass 或删除
    content = re.sub(r'\s+self\.status_var\.set\([^\)]+\).*', '', content)

    final_lines = content.split('\n')
    print(f"最终文件行数: {len(final_lines)}")
    print(f"减少了 {original_length - len(final_lines)} 行")

    # 写回文件
    with open(r'D:\mycode\NetworkPlanningTool\NetworkPlanningTool_V1_optimized.py', 'w', encoding='utf-8') as f:
        f.write(content)

    print("优化完成！生成文件: NetworkPlanningTool_V1_optimized.py")

if __name__ == "__main__":
    main()
