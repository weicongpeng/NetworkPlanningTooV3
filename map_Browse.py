#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
合并版网络规划工具 - 纯地图与图层功能 (修复版 V2)
集成天地图/高德/OSM在线地图模块

修复记录 (V2):
1. [修复] 切换地图源时强制清除 Overlay，解决从天地图切回高德显示异常的问题。
2. [优化] 扩大视锥体剔除边界 (Buffer)，解决缩放/平移时边缘图形消失过快的问题。
3. [新增] 图形点击冒泡功能：点击点/线/面显示详细信息，支持复制；点击空白处关闭。
"""

try:
    import sys
    import json
    import os
    import math
    import ssl
    # 忽略 SSL 证书验证
    try:
        _create_unverified_https_context = ssl._create_unverified_context
    except AttributeError:
        pass
    else:
        ssl._create_default_https_context = _create_unverified_https_context
except ImportError:
    pass

import pandas as pd
import tkinter as tk
from tkinter import ttk, filedialog, messagebox
import requests

try:
    import tkintermapview
    MAP_AVAILABLE = True
except ImportError:
    MAP_AVAILABLE = False
    print("Warning: tkintermapview not found.")

try:
    from osgeo import ogr
    OGR_AVAILABLE = True
except ImportError:
    OGR_AVAILABLE = False

# --- 信息冒泡弹窗类 ---
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
        self.text_area.bind("<Button-1>", lambda e: self.focus_set()) # 允许获取焦点

    def show(self, data, x, y):
        self.text_area.config(state=tk.NORMAL)
        self.text_area.delete(1.0, tk.END)
        
        # 格式化显示数据
        display_text = ""
        for k, v in data.items():
            if k not in ['points', 'type', 'lat', 'lon']: # 过滤掉坐标等底层数据
                display_text += f"{k}: {v}\n"
        
        if not display_text:
            display_text = f"Name: {data.get('name', '未命名')}\nType: {data.get('type')}"

        self.text_area.insert(tk.END, display_text)
        self.text_area.config(state=tk.DISABLED) # 设为只读但可复制
        
        # 调整位置，避免超出屏幕
        req_w = 250
        req_h = 180
        
        # 简单的边界检查
        parent_w = self.master.winfo_width()
        parent_h = self.master.winfo_height()
        
        if x + req_w > parent_w: x = parent_w - req_w - 10
        if y + req_h > parent_h: y = parent_h - req_h - 10
        
        self.place(x=x, y=y, width=req_w, height=req_h)
        self.lift() # 确保在最上层

    def hide(self):
        self.place_forget()
        if self.close_callback:
            self.close_callback()

# --- 地图面板类 ---

class TiandituMapPanel(ttk.Frame):
    TIANDITU_API_KEY = "47d74466e95676315a6f5d135edbfbd3" 
    AMAP_API_KEY = "5299af602f4ee3cd7351c1bc7f32b1cb"

    def __init__(self, master, app_instance):
        super().__init__(master)
        self.app_instance = app_instance
        self.map_widget = None
        self.current_marker = None
        self.popup = None

        self.tab_layer_objects = []
        self.tab_layer_data = []

        self.tab_file_path = tk.StringVar(value="")
        self.tab_layer_loaded = tk.BooleanVar(value=False)
        self.layer_width_var = tk.IntVar(value=2)

        self.cluster_threshold_zoom = 12
        self.cluster_distance_deg = 0.01

        self.map_provider = tk.StringVar(value="amap") 
        self.map_mode = tk.StringVar(value="normal")

        self.setup_ui()
        
    def setup_ui(self):
        # ... (UI代码保持不变，省略以节省篇幅，与原版一致) ...
        # --- 顶部控制区域 ---
        control_frame = ttk.Frame(self)
        control_frame.pack(fill=tk.X, padx=5, pady=5)
        
        search_frame = ttk.LabelFrame(control_frame, text="地点搜索")
        search_frame.pack(side=tk.LEFT, padx=2, fill=tk.Y)
        
        self.search_entry = ttk.Entry(search_frame, width=15)
        self.search_entry.pack(side=tk.LEFT, padx=5, pady=2)
        self.search_entry.bind('<Return>', lambda e: self.search_location())
        ttk.Button(search_frame, text="搜", width=4, command=self.search_location).pack(side=tk.LEFT, padx=2, pady=2)
        
        provider_frame = ttk.LabelFrame(control_frame, text="地图源")
        provider_frame.pack(side=tk.LEFT, padx=2, fill=tk.Y)

        ttk.Radiobutton(provider_frame, text="高德", variable=self.map_provider, value="amap", command=self.switch_map_provider).pack(side=tk.LEFT, padx=2)
        ttk.Radiobutton(provider_frame, text="天地图", variable=self.map_provider, value="tianditu", command=self.switch_map_provider).pack(side=tk.LEFT, padx=2)
        ttk.Radiobutton(provider_frame, text="OSM", variable=self.map_provider, value="osm", command=self.switch_map_provider).pack(side=tk.LEFT, padx=2)

        mode_frame = ttk.LabelFrame(control_frame, text="模式")
        mode_frame.pack(side=tk.LEFT, padx=2, fill=tk.Y)
        ttk.Radiobutton(mode_frame, text="平面", variable=self.map_mode, value="normal", command=self.switch_map_mode).pack(side=tk.LEFT, padx=2)
        ttk.Radiobutton(mode_frame, text="卫星", variable=self.map_mode, value="satellite", command=self.switch_map_mode).pack(side=tk.LEFT, padx=2)
        
        layer_frame = ttk.LabelFrame(control_frame, text="图层管理")
        layer_frame.pack(side=tk.LEFT, padx=2, fill=tk.Y, expand=True)
        
        self.tab_file_entry = ttk.Entry(layer_frame, textvariable=self.tab_file_path, width=20, state='readonly')
        self.tab_file_entry.pack(side=tk.LEFT, padx=5, pady=2)
        ttk.Button(layer_frame, text="选文件", width=6, command=self.select_tab_file).pack(side=tk.LEFT, padx=2)
        
        ttk.Separator(layer_frame, orient=tk.VERTICAL).pack(side=tk.LEFT, fill=tk.Y, padx=5)
        
        ttk.Label(layer_frame, text="线宽:").pack(side=tk.LEFT)
        self.width_scale = ttk.Scale(layer_frame, from_=1, to=10, variable=self.layer_width_var, orient=tk.HORIZONTAL, length=60)
        self.width_scale.pack(side=tk.LEFT, padx=2)
        
        self.tab_load_btn = ttk.Button(layer_frame, text="导入", command=self.load_tab_layer, state=tk.DISABLED)
        self.tab_load_btn.pack(side=tk.LEFT, padx=5)
        
        self.tab_close_btn = ttk.Button(layer_frame, text="清除", command=self.close_tab_layer, state=tk.DISABLED)
        self.tab_close_btn.pack(side=tk.LEFT, padx=2)
        
        # --- 地图控件 ---
        if MAP_AVAILABLE:
            self.map_widget = tkintermapview.TkinterMapView(self, corner_radius=0)
            self.map_widget.pack(fill=tk.BOTH, expand=True)
            self.map_widget.set_position(39.9042, 116.4074) 
            self.map_widget.set_zoom(12)
            
            # 初始化弹窗
            self.popup = InfoPopup(self.map_widget)

            # 立即应用地图源
            self.switch_map_mode()

            self.map_widget.add_right_click_menu_command(label="在此处创建点", command=self.add_marker_at_pos, pass_coords=True)
            
            # 【修复3】点击地图空白处逻辑：不仅打印坐标，还要关闭弹窗
            self.map_widget.add_left_click_map_command(self.handle_map_background_click)
            
            self.map_widget.canvas.bind("<ButtonRelease-1>", self.on_map_interaction)
            self.map_widget.canvas.bind("<MouseWheel>", self.on_map_zoom) 
            self.map_widget.canvas.bind("<Button-4>", self.on_map_zoom)   
            self.map_widget.canvas.bind("<Button-5>", self.on_map_zoom)   
            self.map_widget.canvas.bind("<Configure>", self.on_map_resize)
        else:
            ttk.Label(self, text="未安装 tkintermapview", foreground="red").pack(expand=True)
        
        self.tab_file_path.trace_add("write", self.on_tab_file_path_change)
        self.layer_width_var.trace_add("write", self.on_layer_width_change)

    # ... (辅助函数保持不变) ...
    def on_layer_width_change(self, *args):
        if hasattr(self, 'tab_layer_data') and self.tab_layer_data:
            self.refresh_layer()

    def on_tab_file_path_change(self, *args):
        if self.tab_file_path.get():
            self.tab_load_btn.config(state=tk.NORMAL)
        else:
            self.tab_load_btn.config(state=tk.DISABLED)

    def switch_map_provider(self):
        self.switch_map_mode()

    def switch_map_mode(self):
        """核心：设置地图切片服务器地址"""
        if not self.map_widget: return

        # 【修复1】核心修复：切换地图源前，必须先清除 overlay_tile_server
        # 否则从天地图切回高德时，天地图的文字注记层会继续请求导致错误或高德不显示
        self.map_widget.set_overlay_tile_server(None)

        provider = self.map_provider.get()
        mode = self.map_mode.get()

        if provider == "osm":
            self.map_widget.set_tile_server("https://a.tile.openstreetmap.org/{z}/{x}/{y}.png", max_zoom=19)
            if mode == "satellite":
                self.app_instance.update_status("OSM暂无卫星图，已显示标准图")

        elif provider == "amap":
            if mode == "normal":
                self.map_widget.set_tile_server(
                    "https://webrd02.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}", 
                    max_zoom=18
                )
            else:
                self.map_widget.set_tile_server(
                    "https://webst02.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}", 
                    max_zoom=18
                )

        elif provider == "tianditu":
            if mode == "normal":
                self.map_widget.set_tile_server(
                    "https://t0.tianditu.gov.cn/vec_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=vec&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=" + self.TIANDITU_API_KEY,
                    max_zoom=18
                )
                self.map_widget.set_overlay_tile_server(
                    "https://t0.tianditu.gov.cn/cva_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=cva&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=" + self.TIANDITU_API_KEY
                )
            else:
                self.map_widget.set_tile_server(
                    "https://t0.tianditu.gov.cn/img_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=img&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=" + self.TIANDITU_API_KEY,
                    max_zoom=18
                )
                self.map_widget.set_overlay_tile_server(
                    "https://t0.tianditu.gov.cn/cia_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=cia&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=" + self.TIANDITU_API_KEY
                )

    # --- 坐标转换算法 (保持不变) ---
    def _transform_lat(self, x, y):
        ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * math.sqrt(abs(x))
        ret += (20.0 * math.sin(6.0 * x * math.pi) + 20.0 * math.sin(2.0 * x * math.pi)) * 2.0 / 3.0
        ret += (20.0 * math.sin(y * math.pi) + 40.0 * math.sin(y / 3.0 * math.pi)) * 2.0 / 3.0
        ret += (160.0 * math.sin(y / 12.0 * math.pi) + 320 * math.sin(y * math.pi / 30.0)) * 2.0 / 3.0
        return ret

    def _transform_lon(self, x, y):
        ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * math.sqrt(abs(x))
        ret += (20.0 * math.sin(6.0 * x * math.pi) + 20.0 * math.sin(2.0 * x * math.pi)) * 2.0 / 3.0
        ret += (20.0 * math.sin(x * math.pi) + 40.0 * math.sin(x / 3.0 * math.pi)) * 2.0 / 3.0
        ret += (150.0 * math.sin(x / 12.0 * math.pi) + 300.0 * math.sin(x / 30.0 * math.pi)) * 2.0 / 3.0
        return ret

    def wgs84_to_gcj02(self, lon, lat):
        if self.out_of_china(lon, lat): return lon, lat
        a = 6378245.0
        ee = 0.00669342162296594323
        d_lat = self._transform_lat(lon - 105.0, lat - 35.0)
        d_lon = self._transform_lon(lon - 105.0, lat - 35.0)
        rad_lat = lat / 180.0 * math.pi
        magic = math.sin(rad_lat)
        magic = 1 - ee * magic * magic
        sqrt_magic = math.sqrt(magic)
        d_lat = (d_lat * 180.0) / ((a * (1 - ee)) / (magic * sqrt_magic) * math.pi)
        d_lon = (d_lon * 180.0) / (a / sqrt_magic * math.cos(rad_lat) * math.pi)
        return lon + d_lon, lat + d_lat

    def gcj02_to_wgs84(self, lng, lat):
        if self.out_of_china(lng, lat): return lng, lat
        dlat = self._transform_lat(lng - 105.0, lat - 35.0)
        dlon = self._transform_lon(lng - 105.0, lat - 35.0)
        radlat = lat / 180.0 * math.pi
        magic = math.sin(radlat)
        magic = 1 - 0.00669342162296594323 * magic * magic
        sqrtmagic = math.sqrt(magic)
        dlat = (dlat * 180.0) / ((6378245.0 * (1 - 0.00669342162296594323)) / (magic * sqrtmagic) * math.pi)
        dlon = (dlon * 180.0) / (6378245.0 / sqrtmagic * math.cos(radlat) * math.pi)
        mglat = lat + dlat
        mglng = lng + dlon
        return lng * 2 - mglng, lat * 2 - mglat

    def out_of_china(self, lng, lat):
        return not (73.66 < lng < 135.05 and 3.86 < lat < 53.55)

    def apply_coordinate_correction(self, lon, lat):
        if self.map_provider.get() == "amap":
            return self.wgs84_to_gcj02(lon, lat)
        return lon, lat

    def get_map_bounds(self):
        if not self.map_widget: return None
        center_lat, center_lon = self.map_widget.get_position()
        zoom = self.map_widget.zoom
        
        # 【修复2】增大缓冲区
        # 原来是 /1.5 (视野更小)，现在乘 3.0 (视野是屏幕的3倍)
        # 这样平移和缩放时，周围的数据已经渲染好了，不会出现突然消失的情况
        buffer_factor = 3.0 
        
        lat_range = (180 / (2 ** (zoom - 1))) * buffer_factor
        lon_range = (360 / (2 ** (zoom - 1))) * buffer_factor
        
        min_lat = max(-90, center_lat - lat_range)
        max_lat = min(90, center_lat + lat_range)
        min_lon = max(-180, center_lon - lon_range)
        max_lon = min(180, center_lon + lon_range)
        return (min_lat, max_lat, min_lon, max_lon)

    def is_point_visible(self, lat, lon, bounds):
        if not bounds: return True
        min_lat, max_lat, min_lon, max_lon = bounds
        return min_lat <= lat <= max_lat and min_lon <= lon <= max_lon

    def is_path_visible(self, points_list, bounds):
        if not bounds or not points_list: return True
        min_lat, max_lat, min_lon, max_lon = bounds
        # 优化：因为Bounds变大了，简单的采样检查依然有效且高效
        check_indices = [0, len(points_list)//2, -1]
        for i in check_indices:
            lat, lon = points_list[i]
            if min_lat <= lat <= max_lat and min_lon <= lon <= max_lon:
                return True
        return False

    def cluster_points(self, points, zoom):
        if not points: return []
        clusters = []
        used = set()
        
        distance_factor = max(0.5, 14 - zoom) * self.cluster_distance_deg 
        if zoom >= 15: distance_factor = 0 

        for i, point1 in enumerate(points):
            if i in used: continue
            
            cluster = [point1]
            used.add(i)

            if distance_factor > 0:
                for j, point2 in enumerate(points):
                    if j in used: continue
                    if abs(point1['lat'] - point2['lat']) < distance_factor and \
                       abs(point1['lon'] - point2['lon']) < distance_factor:
                        cluster.append(point2)
                        used.add(j)

            if len(cluster) == 1:
                clusters.append(point1)
            else:
                avg_lat = sum(p['lat'] for p in cluster) / len(cluster)
                avg_lon = sum(p['lon'] for p in cluster) / len(cluster)
                # 聚合点也需要包含原始数据以便点击查看
                clusters.append({
                    'type': 'cluster',
                    'lat': avg_lat,
                    'lon': avg_lon,
                    'name': f"区域聚合({len(cluster)})",
                    'count': len(cluster),
                    'details': f"包含了 {len(cluster)} 个点"
                })
        return clusters

    def search_location(self):
        keyword = self.search_entry.get().strip()
        if not keyword: return
        try:
            url = "https://restapi.amap.com/v3/place/text"
            params = {
                'key': self.AMAP_API_KEY,
                'keywords': keyword,
                'city': '全国',
                'output': 'json',
                'offset': '1',
                'page': '1'
            }
            res = requests.get(url, params=params, timeout=5).json()

            if res.get('status') == '1' and 'pois' in res and len(res['pois']) > 0:
                poi = res['pois'][0]
                gcj_lon, gcj_lat = map(float, poi['location'].split(','))
                wgs_lon, wgs_lat = self.gcj02_to_wgs84(gcj_lon, gcj_lat)
                disp_lon, disp_lat = self.apply_coordinate_correction(wgs_lon, wgs_lat)
                
                self.map_widget.set_position(disp_lat, disp_lon)
                self.map_widget.set_zoom(15)
                
                if self.current_marker: self.map_widget.delete(self.current_marker)
                self.current_marker = self.map_widget.set_marker(
                    disp_lat, disp_lon, text=poi.get('name', '结果'), marker_color_circle="red"
                )
            else:
                messagebox.showinfo("提示", "未找到相关地点")
        except Exception as e:
            messagebox.showerror("错误", f"搜索请求失败: {str(e)}")

    def on_map_interaction(self, event=None):
        if not self.map_widget or not self.tab_layer_data: return
        self.map_widget.after(200, self.refresh_layer)

    def on_map_zoom(self, event=None):
        if not self.map_widget: return
        if event:
            curr = self.map_widget.zoom
            new_z = curr
            if hasattr(event, 'delta') and event.delta: # Windows
                new_z = min(curr + 1, 19) if event.delta > 0 else max(curr - 1, 3)
            elif event.num == 4: new_z = min(curr + 1, 19)
            elif event.num == 5: new_z = max(curr - 1, 3)
            
            if new_z != curr:
                self.map_widget.set_zoom(new_z)
        
        if self.tab_layer_data:
            self.map_widget.after(200, self.refresh_layer)

    def on_map_resize(self, event=None):
        if self.tab_layer_data:
            self.map_widget.after(300, self.refresh_layer)

    def handle_map_background_click(self, coords):
        """点击地图空白处"""
        # 隐藏弹窗
        if self.popup:
            self.popup.hide()
        print(f"Clicked: {coords}")

    def add_marker_at_pos(self, coords):
        lat, lon = coords
        self.map_widget.set_marker(lat, lon, text="新标记", marker_color_circle="blue")

    # --- 【修复3】点击图形对象的回调 ---
    def on_object_click(self, map_object):
        """
        当点击 Marker 或 Path 时触发
        map_object: tkintermapview 传回的点击对象
        """
        # 我们需要在创建对象时把 data 绑在对象上
        if hasattr(map_object, "data_source"):
            data = map_object.data_source
            
            # 计算弹窗显示位置 (屏幕像素坐标)
            # 注意：tkintermapview 没有直接提供 latlon_to_screen，但我们可以通过事件或估算
            # 这里简单处理：显示在鼠标当前位置附近，或者屏幕中心
            
            # 获取当前鼠标在 map_widget 上的相对位置
            mx = self.map_widget.winfo_pointerx() - self.map_widget.winfo_rootx()
            my = self.map_widget.winfo_pointery() - self.map_widget.winfo_rooty()
            
            self.popup.show(data, mx + 10, my + 10)

    def select_tab_file(self):
        ft = [("MapInfo TAB", "*.tab"), ("Excel/CSV", "*.xlsx *.csv *.txt"), ("All", "*.*")]
        if not OGR_AVAILABLE:
            ft = [("Excel/CSV", "*.xlsx *.csv"), ("All", "*.*")]
        path = filedialog.askopenfilename(filetypes=ft)
        if path: self.tab_file_path.set(path)

    def close_tab_layer(self):
        for obj in self.tab_layer_objects:
            self.map_widget.delete(obj)
        self.tab_layer_objects.clear()
        self.tab_layer_data.clear()
        self.tab_layer_loaded.set(False)
        self.tab_close_btn.config(state=tk.DISABLED)
        if self.popup: self.popup.hide()
        self.app_instance.update_status("图层已清空")

    def refresh_layer(self):
        """刷新图层显示 (已优化边界和交互)"""
        if not self.tab_layer_data or not self.map_widget: return
        
        # 清除现有显示
        for obj in self.tab_layer_objects:
            self.map_widget.delete(obj)
        self.tab_layer_objects.clear()

        bounds = self.get_map_bounds()
        zoom = self.map_widget.zoom
        width = self.layer_width_var.get()

        points = [d for d in self.tab_layer_data if d.get('type') in ['point', 'cluster']]
        others = [d for d in self.tab_layer_data if d.get('type') in ['path', 'polygon']]

        # 聚类处理
        display_points = points
        if zoom < self.cluster_threshold_zoom and len(points) > 50:
             display_points = self.cluster_points(points, zoom)

        # 绘制点
        for p in display_points:
            d_lon, d_lat = self.apply_coordinate_correction(p['lon'], p['lat'])
            
            if self.is_point_visible(d_lat, d_lon, bounds):
                is_cluster = p.get('type') == 'cluster'
                col = "orange" if is_cluster else "red"
                txt = p.get('name', '')
                
                # 【新增】绑定 command 回调
                m = self.map_widget.set_marker(
                    d_lat, d_lon, text=txt,
                    marker_color_circle=col, marker_color_outside="white",
                    text_color="black",
                    command=self.on_object_click # 绑定点击事件
                )
                # 【技巧】将数据源绑定到对象上，以便回调时获取
                m.data_source = p 
                self.tab_layer_objects.append(m)

        # 绘制线/面
        for item in others:
            raw_pts = item['points']
            if not self.is_path_visible(raw_pts, bounds):
                continue
                
            disp_pts = [self.apply_coordinate_correction(ln, lt)[::-1] for lt, ln in raw_pts]
            
            if item['type'] == 'path':
                obj = self.map_widget.set_path(
                    disp_pts, width=width, color="blue",
                    command=self.on_object_click # 绑定点击事件
                )
            else:
                obj = self.map_widget.set_polygon(
                    disp_pts, border_width=width, outline_color="green", fill_color=None,
                    command=self.on_object_click # 绑定点击事件
                )
            
            # 【技巧】绑定数据源
            obj.data_source = item
            self.tab_layer_objects.append(obj)
            
        self.app_instance.update_status(f"当前视口显示要素: {len(self.tab_layer_objects)}")

    def load_tab_layer(self):
        path = self.tab_file_path.get()
        if not path: return
        
        self.close_tab_layer()
        self.app_instance.update_status("正在读取文件...")
        self.root = self.winfo_toplevel()
        self.root.update()

        try:
            new_data = []
            is_tab = path.lower().endswith('.tab')
            
            if is_tab and OGR_AVAILABLE:
                ds = ogr.Open(path, 0)
                if ds:
                    layer = ds.GetLayer(0)
                    for feat in layer:
                        geom = feat.GetGeometryRef()
                        if not geom: continue
                        gtype = geom.GetGeometryType()
                        
                        # 获取所有字段信息
                        props = {}
                        for i in range(feat.GetFieldCount()):
                            f_def = feat.GetFieldDefnRef(i)
                            f_name = f_def.GetName()
                            # 处理编码问题
                            try:
                                val = feat.GetField(i)
                                if isinstance(val, bytes):
                                    val = val.decode('gbk', errors='ignore')
                                props[f_name] = str(val)
                            except:
                                props[f_name] = str(feat.GetField(i))

                        # 查找常用名称字段
                        name = ""
                        for k in props.keys():
                            if k.upper() in ['NAME', '名称', 'ID', 'CELLNAME']:
                                name = props[k]
                                break
                        
                        base_data = props
                        base_data['name'] = name

                        if gtype == ogr.wkbPoint:
                            base_data.update({'type': 'point', 'lat': geom.GetY(), 'lon': geom.GetX()})
                            new_data.append(base_data)
                        elif gtype == ogr.wkbLineString:
                            pts = geom.GetPoints()
                            base_data.update({'type': 'path', 'points': [(p[1], p[0]) for p in pts]})
                            new_data.append(base_data)
                        elif gtype == ogr.wkbPolygon:
                            ring = geom.GetGeometryRef(0)
                            pts = ring.GetPoints()
                            base_data.update({'type': 'polygon', 'points': [(p[1], p[0]) for p in pts]})
                            new_data.append(base_data)
            else:
                # Pandas 读取
                if path.endswith('.xlsx'): df = pd.read_excel(path)
                else: 
                    try: df = pd.read_csv(path, encoding='utf-8')
                    except: df = pd.read_csv(path, encoding='gbk')
                
                cols = {c.upper(): c for c in df.columns}
                lat_c = next((c for k, c in cols.items() if 'LAT' in k or '纬' in k), None)
                lon_c = next((c for k, c in cols.items() if 'LON' in k or '经' in k), None)
                name_c = next((c for k, c in cols.items() if 'NAME' in k or '名' in k), None)
                
                if lat_c and lon_c:
                    df = df.dropna(subset=[lat_c, lon_c])
                    for _, row in df.iterrows():
                        # 将整行数据转为字典
                        props = row.to_dict()
                        n = str(row[name_c]) if name_c else ""
                        props.update({'type': 'point', 'lat': float(row[lat_c]), 'lon': float(row[lon_c]), 'name': n})
                        new_data.append(props)
            
            if new_data:
                self.tab_layer_data = new_data
                self.tab_layer_loaded.set(True)
                self.tab_close_btn.config(state=tk.NORMAL)
                self.refresh_layer()
                
                p0 = new_data[0]
                lat = p0['lat'] if 'lat' in p0 else p0['points'][0][0]
                lon = p0['lon'] if 'lon' in p0 else p0['points'][0][1]
                
                d_lon, d_lat = self.apply_coordinate_correction(lon, lat)
                self.map_widget.set_position(d_lat, d_lon)
                self.app_instance.update_status(f"导入完成: {len(new_data)} 个要素")
            else:
                messagebox.showwarning("警告", "未解析到有效数据")
                
        except Exception as e:
            messagebox.showerror("错误", f"文件读取失败: {str(e)}")
            self.app_instance.update_status("导入失败")

class MapApp:
    def __init__(self, root):
        self.root = root
        self.root.title("网优地图查看器 (修复版 V2)")
        self.root.geometry("1100x800") 
        self.root.columnconfigure(0, weight=1)
        self.root.rowconfigure(0, weight=1)
        
        self.create_main_frame()
        self.create_status_bar()

    def create_main_frame(self):
        self.notebook = ttk.Notebook(self.root)
        self.notebook.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)
        self.map_frame = TiandituMapPanel(self.notebook, app_instance=self)
        self.notebook.add(self.map_frame, text="在线地图")

    def create_status_bar(self):
        self.status_var = tk.StringVar(value="就绪")
        ttk.Label(self.root, textvariable=self.status_var, relief=tk.SUNKEN, anchor=tk.W).pack(side=tk.BOTTOM, fill=tk.X)
        
    def update_status(self, text):
        self.status_var.set(text)

if __name__ == "__main__":
    root = tk.Tk()
    app = MapApp(root)
    root.mainloop()