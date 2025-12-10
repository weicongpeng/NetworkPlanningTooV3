#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
添加缺失的 InfoPopup 类
"""

# InfoPopup 类的代码
info_popup_code = '''
class InfoPopup(tk.Frame):
    """显示图形信息的悬浮窗"""
    def __init__(self, master, close_callback=None):
        super().__init__(master, bg="white", highlightbackground="gray", highlightthickness=1)
        self.close_callback = close_callback
        self.place_forget()

        # 顶部标题栏
        header = tk.Frame(self, bg="#f0f0f0", height=25)
        header.pack(fill=tk.X)
        tk.Label(header, text="属性信息", bg="#f0f0f0", font=("Arial", 9, "bold")).pack(side=tk.LEFT, padx=5)

        # 关闭按钮
        close_btn = tk.Label(header, text="×", bg="#f0f0f0", cursor="hand2", font=("Arial", 12))
        close_btn.pack(side=tk.RIGHT, padx=5)
        close_btn.bind("<Button-1>", lambda e: self.hide())

        # 内容区域 (Text控件以支持复制)
        self.text_area = tk.Text(self, width=30, height=8, font=("Arial", 9), relief=tk.FLAT)
        self.text_area.pack(padx=5, pady=5)

        # 阻止事件冒泡，防止点击弹窗内容时触发地图点击
        self.bind("<Button-1>", lambda e: "break")
        self.text_area.bind("<Button-1>", lambda e: self.focus_set())  # 允许获取焦点

    def show(self, data, x, y):
        self.text_area.config(state=tk.NORMAL)
        self.text_area.delete(1.0, tk.END)

        # 格式化显示数据
        display_text = ""
        for k, v in data.items():
            if k not in ['points', 'type', 'lat', 'lon']:  # 过滤掉坐标等底层数据
                display_text += f"{k}: {v}\n"

        if not display_text:
            display_text = f"Name: {data.get('name', '未命名')}\nType: {data.get('type')}"

        self.text_area.insert(tk.END, display_text)
        self.text_area.config(state=tk.DISABLED)  # 设为只读但可复制

        # 调整位置，避免超出屏幕
        req_w = 250
        req_h = 180

        # 简单的边界检查
        parent_w = self.master.winfo_width()
        parent_h = self.master.winfo_height()

        if x + req_w > parent_w:
            x = parent_w - req_w - 10
        if y + req_h > parent_h:
            y = parent_h - req_h - 10

        self.place(x=x, y=y, width=req_w, height=req_h)
        self.lift()  # 确保在最上层

    def hide(self):
        self.place_forget()
        if self.close_callback:
            self.close_callback()


'''

import re

def add_info_popup_class():
    # 读取主程序文件
    with open(r'D:\mycode\NetworkPlanningTool\NetworkPlanningTool_V1.py', 'r', encoding='utf-8') as f:
        content = f.read()

    # 查找 TiandituMapPanel 类的位置
    class_pattern = r'class TiandituMapPanel\(ttk\.Frame\):'
    match = re.search(class_pattern, content)

    if match:
        insert_pos = match.start()
        print(f"在位置 {insert_pos} 找到 TiandituMapPanel 类")

        # 在 TiandituMapPanel 类之前插入 InfoPopup 类
        new_content = content[:insert_pos] + info_popup_code + '\n' + content[insert_pos:]

        # 写回文件（先写入临时文件）
        with open(r'D:\mycode\NetworkPlanningTool\NetworkPlanningTool_V1_with_popup.py', 'w', encoding='utf-8') as f:
            f.write(new_content)

        print(f"添加 InfoPopup 类完成！新文件行数: {new_content.count(chr(10))}")
        print("生成文件: NetworkPlanningTool_V1_with_popup.py")
    else:
        print("错误：未找到 TiandituMapPanel 类")

if __name__ == '__main__':
    add_info_popup_class()
