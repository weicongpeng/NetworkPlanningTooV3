#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
清理混合的函数代码
"""

def clean_mixed_functions():
    with open(r'D:\\mycode\\NetworkPlanningTool\\NetworkPlanningTool_V1.py', 'r', encoding='utf-8') as f:
        lines = f.readlines()

    # 查找 create_param_update_tab 函数
    start_idx = None
    end_idx = None

    for i, line in enumerate(lines):
        if 'def create_param_update_tab(self):' in line:
            start_idx = i
            # 找到函数结束位置（下一个函数开始）
            for j in range(i + 1, len(lines)):
                if lines[j].strip().startswith('def ') and not lines[j].startswith('        '):
                    end_idx = j
                    break
            break

    print(f"create_param_update_tab 函数范围: {start_idx} - {end_idx}")

    if start_idx and end_idx:
        # 提取函数开头部分（直到第5494行之前的正确代码）
        clean_lines = lines[:start_idx]

        # 手动编写 create_param_update_tab 函数的正确内容
        function_code = [
            "    def create_param_update_tab(self):\n",
            '        """Create the Parameter Update tab"""\n',
            "        param_frame = ttk.Frame(self.notebook)\n",
            '        self.notebook.add(param_frame, text="规划数据导入及工参更新")\n',
            "        param_frame.columnconfigure(0, weight=1)\n",
            "        param_frame.rowconfigure(1, weight=1)\n",
            "\n",
            "        # Initialize search variables\n",
            "        self.nr_search_value = tk.StringVar()\n",
            "        self.lte_search_value = tk.StringVar()\n",
            "\n",
            "        # File selection\n",
            "        file_frame = ttk.Frame(param_frame)\n",
            "        file_frame.pack(fill=tk.X, padx=10, pady=5)\n",
            "\n",
            "        # Configure file_frame to be responsive\n",
            "        file_frame.columnconfigure(0, weight=1)\n",
            "\n",
            "        # Create left frame for file selection\n",
            "        selection_frame = ttk.LabelFrame(file_frame, text='文件选择')\n",
            "        selection_frame.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0, 10))\n",
            "        selection_frame.columnconfigure(1, weight=1)  # Entry column\n",
            "\n",
            "        # Create right frame for instructions\n",
            "        instruction_frame = ttk.LabelFrame(file_frame, text='文件导入说明')\n",
            "        instruction_frame.pack(side=tk.RIGHT, fill=tk.Y)\n",
            "\n",
            "        # Add instructions\n",
            "        instruction_text = tk.Text(instruction_frame, width=40, height=6, wrap=tk.WORD)\n",
            '        instruction_text.insert(tk.END, "1、请按模板填写待规划小区和全量工参。\\n\\n2、现网工参文件为中兴网管300基线导出的zip压缩包，无需解压直接导入。")\n',
            "        instruction_text.config(state=tk.DISABLED)  # Make it read-only\n",
            "        instruction_text.pack(padx=5, pady=5)\n",
            "\n",
            "        # 地图框架\n",
            "        self.update_map_frame = ttk.LabelFrame(param_frame, text=\"在线地图\")\n",
            "        self.update_map_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=5)\n",
            "        self.update_map_widget = TiandituMapPanel(self.update_map_frame, app_instance=self)\n",
            "        self.update_map_widget.pack(fill=tk.BOTH, expand=True)\n",
        ]

        clean_lines.extend(function_code)

        # 添加函数结束后的代码（从end_idx开始）
        clean_lines.extend(lines[end_idx:])

        # 写回文件
        with open(r'D:\\mycode\\NetworkPlanningTool\\NetworkPlanningTool_V1_clean.py', 'w', encoding='utf-8') as f:
            f.writelines(clean_lines)

        print(f"清理完成！新文件行数: {len(clean_lines)}")
        print("生成文件: NetworkPlanningTool_V1_clean.py")

if __name__ == '__main__':
    clean_mixed_functions()
