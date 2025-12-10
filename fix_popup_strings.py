#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
修复 InfoPopup 类中的 f-string 问题
"""

def fix_fstrings():
    # 读取文件
    with open(r'D:\\mycode\\NetworkPlanningTool\\NetworkPlanningTool_V1_with_popup.py', 'r', encoding='utf-8') as f:
        content = f.read()

    # 修复 f-string 问题
    # 问题 1: display_text += f"{k}: {v}\n" 被分成两行
    content = content.replace(
        '                display_text += f"{k}: {v}\n"\n"',
        '                display_text += f"{k}: {v}\\n"'
    )

    # 问题 2: display_text = f"Name: {data.get('name', '未命名')}\nType: {data.get('type')}" 也被破坏了
    content = content.replace(
        '            display_text = f"Name: {data.get(\'name\', \'未命名\')}\nType: {data.get(\'type\')}"',
        '            display_text = f"Name: {data.get(\'name\', \'未命名\')}\\nType: {data.get(\'type\')}"'
    )

    # 写回文件
    with open(r'D:\\mycode\\NetworkPlanningTool\\NetworkPlanningTool_V1.py', 'w', encoding='utf-8') as f:
        f.write(content)

    print("修复 f-string 完成！")

if __name__ == '__main__':
    fix_fstrings()
