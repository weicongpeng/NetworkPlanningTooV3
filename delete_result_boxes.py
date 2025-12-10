#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
删除规划结果展示框
"""

def delete_result_boxes():
    # 读取优化后的文件
    with open(r'D:\mycode\NetworkPlanningTool\NetworkPlanningTool_V1_optimized.py', 'r', encoding='utf-8') as f:
        content = f.read()

    lines = content.split('\n')
    print(f"优化后的文件行数: {len(lines)}")

    # 查找并删除PCI规划结果框
    # 查找 "# Results text area" 在PCI tab中的位置
    pci_result_start = None
    pci_result_end = None

    for i, line in enumerate(lines):
        if i >= 4835 and '# Results text area' in line and pci_result_start is None:
            # 这是PCI tab中的结果框
            pci_result_start = i
            # 结果框结束于 create_param_update_tab 函数的开始之前
            for j in range(i, min(i+20, len(lines))):
                if 'def create_param_update_tab' in lines[j]:
                    pci_result_end = j
                    break
            if pci_result_end is None:
                pci_result_end = i + 15  # 默认删除15行
            break

    # 查找并删除邻区规划结果框
    neighbor_result_start = None
    neighbor_result_end = None

    for i, line in enumerate(lines):
        if i >= 4965 and '# Results text area' in line and neighbor_result_start is None:
            # 这是邻区规划tab中的结果框
            neighbor_result_start = i
            # 结果框结束于 create_status_bar 函数的开始之前
            for j in range(i, min(i+20, len(lines))):
                if 'def create_status_bar' in lines[j]:
                    neighbor_result_end = j
                    break
            if neighbor_result_end is None:
                neighbor_result_end = i + 15  # 默认删除15行
            break

    print(f"PCI结果框: 行 {pci_result_start} 到 {pci_result_end}")
    print(f"邻区结果框: 行 {neighbor_result_start} 到 {neighbor_result_end}")

    # 删除这些行（从后往前删除，避免索引变化）
    lines_to_delete = set()
    if pci_result_start and pci_result_end:
        lines_to_delete.update(range(pci_result_start, pci_result_end))
    if neighbor_result_start and neighbor_result_end:
        lines_to_delete.update(range(neighbor_result_start, neighbor_result_end))

    # 同时删除所有引用 result_text 和 neighbor_result_text 的代码
    result_lines = []
    for i, line in enumerate(lines):
        if i not in lines_to_delete and 'result_text' not in line:
            result_lines.append(line)

    print(f"删除后行数: {len(result_lines)}")

    # 写回文件
    with open(r'D:\mycode\NetworkPlanningTool\NetworkPlanningTool_V1_optimized2.py', 'w', encoding='utf-8') as f:
        f.write('\n'.join(result_lines))

    print("删除规划结果框完成！")

if __name__ == "__main__":
    delete_result_boxes()
