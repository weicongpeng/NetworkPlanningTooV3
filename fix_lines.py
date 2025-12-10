#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
手动修复问题行
"""

def fix_file():
    # 读取源文件
    with open(r'D:\\mycode\\NetworkPlanningTool\\NetworkPlanningTool_V1_with_popup.py', 'r', encoding='utf-8') as f:
        lines = f.readlines()

    # 创建新文件
    with open(r'D:\\mycode\\NetworkPlanningTool\\NetworkPlanningTool_V1.py', 'w', encoding='utf-8') as f:
        i = 0
        while i < len(lines):
            line = lines[i]

            # 检查是否是问题行 1
            if i == 4718 and 'display_text += f"{k}: {v}' in line:
                # 合并这一行和下一行
                next_line = lines[i + 1] if i + 1 < len(lines) else '"\n'
                # 写入正确的格式
                f.write('                display_text += f"{k}: {v}\\n"\n')
                i += 2  # 跳过下一行
                continue

            # 检查是否是问题行 2
            if i == 4722 and "display_text = f\"Name: {data.get('name', '未命名')}" in line:
                # 这一行和下一行需要合并
                next_line = lines[i + 1] if i + 1 < len(lines) else ''
                f.write('            display_text = f"Name: {data.get(\'name\', \'未命名\')}\\nType: {data.get(\'type\')}"\n')
                i += 2
                continue

            # 正常写入其他行
            f.write(line)
            i += 1

    print("修复完成！")

if __name__ == '__main__':
    fix_file()
