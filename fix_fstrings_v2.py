#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
修复 InfoPopup 类中的 f-string 换行问题
"""

def fix_fstrings_v2():
    # 读取文件
    with open(r'D:\\mycode\\NetworkPlanningTool\\NetworkPlanningTool_V1_with_popup.py', 'r', encoding='utf-8') as f:
        lines = f.readlines()

    # 找出有问题的行并修复
    fixed_lines = []
    i = 0
    while i < len(lines):
        line = lines[i]

        # 检查是否是 f-string 的开始且没有闭合
        if 'display_text += f"{k}: {v}' in line and '"' not in line.rstrip():
            # 这是有问题的行，需要与下一行合并
            next_line = lines[i + 1] if i + 1 < len(lines) else ''
            # 合并两行，去掉换行符
            merged = line.rstrip() + '\\n"\n'
            fixed_lines.append(merged)
            i += 2  # 跳过下一行
            continue

        # 检查是否是另一个 f-string 问题
        if 'display_text = f"Name: {data.get' in line and '"' not in line.rstrip():
            # 这行也需要修复，应该包含完整的字符串
            fixed_line = '            display_text = f"Name: {data.get(\'name\', \'未命名\')}\\nType: {data.get(\'type\')}"\n'
            fixed_lines.append(fixed_line)
            # 跳过接下来的 Type: 行
            if i + 1 < len(lines) and 'Type: {data.get' in lines[i + 1]:
                i += 2
                continue

        fixed_lines.append(line)
        i += 1

    # 写回文件
    with open(r'D:\\mycode\\NetworkPlanningTool\\NetworkPlanningTool_V1.py', 'w', encoding='utf-8') as f:
        f.writelines(fixed_lines)

    print(f"修复完成！处理了 {len(lines)} 行")

if __name__ == '__main__':
    fix_fstrings_v2()
