#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
修复缩进问题
"""

def fix_indentation():
    # 读取文件
    with open(r'D:\\mycode\\NetworkPlanningTool\\NetworkPlanningTool_V1.py', 'r', encoding='utf-8') as f:
        lines = f.readlines()

    # 找到process_queue函数
    for i, line in enumerate(lines):
        if 'def process_queue(self):' in line:
            print(f"找到process_queue函数开始位置: 第{i+1}行")

            # 找到这个函数的结束位置
            func_start = i
            indent_level = len(line) - len(line.lstrip())
            print(f"函数缩进级别: {indent_level}")

            # 找到函数结束位置（下一个同级函数或类）
            func_end = len(lines)
            for j in range(i+1, len(lines)):
                stripped = lines[j].lstrip()
                if stripped and not stripped.startswith('#'):
                    curr_indent = len(lines[j]) - len(stripped)
                    if curr_indent == indent_level and (lines[j].strip().startswith('def ') or lines[j].strip().startswith('class ')):
                        func_end = j
                        break

            print(f"函数结束位置: 第func_end行")

            # 重新构建这个函数的代码
            new_lines = lines[:func_start]

            # 添加函数头
            new_lines.append(lines[func_start])

            # 添加函数文档字符串
            if lines[func_start+1].strip().startswith('"""'):
                docstring_end = func_start+1
                for k in range(func_start+2, func_end):
                    if '"""' in lines[k]:
                        docstring_end = k
                        break
                # 添加所有文档字符串行
                for k in range(func_start+1, docstring_end+1):
                    new_lines.append(lines[k])
                code_start = docstring_end + 1
            else:
                code_start = func_start + 1

            # 添加代码主体（手动编写正确的结构）
            new_lines.append('        """Process messages from the thread queue"""\n')
            new_lines.append('        while True:\n')
            new_lines.append('            try:\n')
            new_lines.append('                msg_type, content = self.queue.get_nowait()\n')
            new_lines.append('\n')
            new_lines.append('                if msg_type == "info":\n')
            new_lines.append('                    # Removed result text display\n')
            new_lines.append('                    pass\n')
            new_lines.append('                elif msg_type == "progress":\n')
            new_lines.append('                    self.plan_progress[\'value\'] = content\n')
            new_lines.append('                    self.plan_progress_label.config(text=f"{content}%")\n')
            new_lines.append('                elif msg_type == "error":\n')
            new_lines.append('                    # Removed error text display\n')
            new_lines.append('                    pass\n')
            new_lines.append('                elif msg_type == "done":\n')
            new_lines.append('                    self.plan_btn.config(state=tk.NORMAL)\n')
            new_lines.append('\n')
            new_lines.append('                # Update parameter update results - no longer used since we use popups\n')
            new_lines.append('                elif msg_type == "update_info":\n')
            new_lines.append('                    pass  # No longer insert to text area\n')
            new_lines.append('                elif msg_type == "update_progress":\n')
            new_lines.append('                    pass  # No longer used\n')
            new_lines.append('                elif msg_type == "update_error":\n')
            new_lines.append('                    # No longer insert to text area\n')
            new_lines.append('                    pass\n')
            new_lines.append('                elif msg_type == "update_done":\n')
            new_lines.append('                    self.update_btn.config(state=tk.NORMAL)\n')
            new_lines.append('\n')
            new_lines.append('                # Handle button enabling for PCI planning\n')
            new_lines.append('                elif msg_type == "enable_button":\n')
            new_lines.append('                    if content == "plan_btn":\n')
            new_lines.append('                        self.plan_btn.config(state=tk.NORMAL)\n')
            new_lines.append('                    elif content == "update_btn":\n')
            new_lines.append('                        self.update_btn.config(state=tk.NORMAL)\n')
            new_lines.append('\n')
            new_lines.append('                # Update neighbor planning results\n')
            new_lines.append('                elif msg_type == "neighbor_info":\n')
            new_lines.append('                    pass  # No longer insert to text area\n')
            new_lines.append('                elif msg_type == "neighbor_progress":\n')
            new_lines.append('                    self.neighbor_progress[\'value\'] = content\n')
            new_lines.append('                    self.neighbor_progress_label.config(text=f"{content}%")\n')
            new_lines.append('                elif msg_type == "neighbor_error":\n')
            new_lines.append('                    # Insert error text in red\n')
            new_lines.append('                    pass\n')
            new_lines.append('                elif msg_type == "neighbor_done":\n')
            new_lines.append('                    self.neighbor_plan_btn.config(state=tk.NORMAL)\n')
            new_lines.append('\n')
            new_lines.append('            except queue.Empty:\n')
            new_lines.append('                break\n')
            new_lines.append('\n')
            new_lines.append('        # Schedule the next check\n')
            new_lines.append('        self.root.after(100, self.process_queue)\n')

            # 添加函数之后的代码
            new_lines.extend(lines[func_end:])

            # 写回文件
            with open(r'D:\\mycode\\NetworkPlanningTool\\NetworkPlanningTool_V1_fixed_final.py', 'w', encoding='utf-8') as f:
                f.writelines(new_lines)

            print(f"修复完成！新文件行数: {len(new_lines)}")
            break

if __name__ == '__main__':
    fix_indentation()
