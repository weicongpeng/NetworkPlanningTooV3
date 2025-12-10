#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
修复空的if/elif语句块
"""

def fix_empty_blocks():
    with open(r'D:\mycode\NetworkPlanningTool\NetworkPlanningTool_V1_with_map.py', 'r', encoding='utf-8') as f:
        content = f.read()

    lines = content.split('\n')
    fixed_lines = []
    i = 0

    while i < len(lines):
        line = lines[i]
        stripped = line.strip()

        # 检查是否是空的 elif 语句
        if stripped.startswith('elif msg_type ==') and i + 1 < len(lines):
            next_line = lines[i + 1].strip()
            # 如果下一行也是elif或者else或者空，则这是一个空块
            if next_line.startswith('elif ') or next_line.startswith('else:') or next_line == '':
                # 将这个elif替换为带pass的语句
                indent = len(line) - len(line.lstrip())
                fixed_lines.append(line)
                fixed_lines.append(' ' * indent + 'pass')
                i += 1
                continue

        # 检查是否是空的 if/elif 语句（已经有一些注释但没有代码）
        if (stripped.startswith('elif msg_type ==') or stripped.startswith('if msg_type ==')) and i + 1 < len(lines):
            # 检查接下来的几行，直到遇到非注释非空行
            j = i + 1
            found_code = False
            while j < len(lines) and (lines[j].strip().startswith('#') or lines[j].strip() == ''):
                j += 1

            # 如果接下来是elif、else或者减少缩进，说明是空块
            if j < len(lines):
                next_real_line = lines[j].strip()
                if next_real_line.startswith('elif ') or next_real_line.startswith('else:') or (
                    not lines[j].startswith(' ') and lines[j].strip()):
                    found_code = False
                else:
                    found_code = True

            if not found_code:
                indent = len(line) - len(line.lstrip())
                fixed_lines.append(line)
                fixed_lines.append(' ' * indent + 'pass')
                i += 1
                continue

        fixed_lines.append(line)
        i += 1

    # 写回文件
    with open(r'D:\mycode\NetworkPlanningTool\NetworkPlanningTool_V1_fixed.py', 'w', encoding='utf-8') as f:
        f.write('\n'.join(fixed_lines))

    print(f'修复完成！总行数: {len(fixed_lines)}')

if __name__ == '__main__':
    fix_empty_blocks()
