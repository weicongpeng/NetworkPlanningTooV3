import pandas as pd
import geopandas as gpd
from shapely.geometry import Point, LineString
from scipy.interpolate import interp1d
import numpy as np
import os
from datetime import datetime, timedelta
import tkinter as tk
from tkinter import ttk, filedialog, messagebox, simpledialog

class TrajectoryGeneratorGUI:
    def __init__(self, root):
        self.root = root
        self.root.title("Excel轨迹数据转MapInfo工具")
        self.root.geometry("700x600")
        
        # 初始化变量
        self.file_path = tk.StringVar()
        self.use_smooth = tk.BooleanVar(value=False)  # 默认使用直线
        self.output_dir = tk.StringVar(value=os.getcwd())
        
        self.setup_ui()
    
    def setup_ui(self):
        # 主框架
        main_frame = ttk.Frame(self.root, padding="10")
        main_frame.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        
        # 文件选择
        ttk.Label(main_frame, text="Excel文件:").grid(row=0, column=0, sticky=tk.W, pady=5)
        file_frame = ttk.Frame(main_frame)
        file_frame.grid(row=1, column=0, columnspan=2, sticky=(tk.W, tk.E), pady=5)
        
        ttk.Entry(file_frame, textvariable=self.file_path, width=60).grid(row=0, column=0, sticky=(tk.W, tk.E))
        ttk.Button(file_frame, text="浏览", command=self.browse_file).grid(row=0, column=1, padx=(5, 0))
        file_frame.columnconfigure(0, weight=1)
        
        # 输出目录
        ttk.Label(main_frame, text="输出目录:").grid(row=2, column=0, sticky=tk.W, pady=(10, 5))
        output_frame = ttk.Frame(main_frame)
        output_frame.grid(row=3, column=0, columnspan=2, sticky=(tk.W, tk.E), pady=5)
        
        ttk.Entry(output_frame, textvariable=self.output_dir, width=60).grid(row=0, column=0, sticky=(tk.W, tk.E))
        ttk.Button(output_frame, text="浏览", command=self.browse_output_dir).grid(row=0, column=1, padx=(5, 0))
        output_frame.columnconfigure(0, weight=1)
        
        # 轨迹线类型选择
        ttk.Label(main_frame, text="轨迹线绘制方式:").grid(row=4, column=0, sticky=tk.W, pady=(10, 5))
        radio_frame = ttk.Frame(main_frame)
        radio_frame.grid(row=5, column=0, columnspan=2, sticky=(tk.W, tk.E), pady=5)
        
        ttk.Radiobutton(radio_frame, text="平滑曲线", variable=self.use_smooth, value=True).grid(row=0, column=0, sticky=tk.W)
        ttk.Radiobutton(radio_frame, text="直线", variable=self.use_smooth, value=False).grid(row=0, column=1, sticky=tk.W, padx=(20, 0))
        
        # 进度条
        self.progress = ttk.Progressbar(main_frame, mode='determinate')
        self.progress.grid(row=6, column=0, columnspan=2, sticky=(tk.W, tk.E), pady=10)

        # 状态标签
        self.status_label = ttk.Label(main_frame, text="就绪")
        self.status_label.grid(row=7, column=0, columnspan=2, pady=5)

        # 按钮
        button_frame = ttk.Frame(main_frame)
        button_frame.grid(row=8, column=0, columnspan=2, pady=20)

        ttk.Button(button_frame, text="开始处理", command=self.start_processing).pack(side=tk.LEFT, padx=(0, 10))
        ttk.Button(button_frame, text="退出", command=self.root.quit).pack(side=tk.LEFT)
        
        # 信息显示区域
        info_frame = ttk.LabelFrame(main_frame, text="处理信息", padding="5")
        info_frame.grid(row=10, column=0, columnspan=2, pady=10, sticky=(tk.W, tk.E, tk.N, tk.S))
        
        self.info_text = tk.Text(info_frame, height=15, width=80)
        info_scroll = ttk.Scrollbar(info_frame, orient="vertical", command=self.info_text.yview)
        self.info_text.configure(yscrollcommand=info_scroll.set)
        
        self.info_text.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        info_scroll.grid(row=0, column=1, sticky=(tk.N, tk.S))
        
        # 配置网格权重
        main_frame.columnconfigure(0, weight=1)
        main_frame.rowconfigure(10, weight=1)
        self.root.columnconfigure(0, weight=1)
        self.root.rowconfigure(0, weight=1)
        info_frame.columnconfigure(0, weight=1)
        info_frame.rowconfigure(0, weight=1)
    
    def browse_file(self):
        filename = filedialog.askopenfilename(
            title="选择Excel文件",
            filetypes=[("Excel files", "*.xlsx *.xls"), ("All files", "*.*")]
        )
        if filename:
            self.file_path.set(filename)
    
    def browse_output_dir(self):
        dirname = filedialog.askdirectory(title="选择输出目录")
        if dirname:
            self.output_dir.set(dirname)
    
    def update_status(self, message):
        self.status_label.config(text=message)
        self.root.update_idletasks()
        self.info_text.insert(tk.END, message + "\n")
        self.info_text.see(tk.END)
    
    def preprocess_data(self):
        """预处理数据，计算驻留时间和时间差合并"""
        if not self.file_path.get():
            messagebox.showerror("错误", "请选择Excel文件")
            return
        
        try:
            file_path = self.file_path.get()
            self.update_status("正在读取Excel文件...")
            
            # 读取Excel文件
            df = pd.read_excel(file_path)
            
            # 检查必要列是否存在
            required_columns = ['开始时间', '索引']
            if not all(col in df.columns for col in required_columns):
                messagebox.showerror("错误", f"Excel文件缺少必要列: {required_columns}")
                return
            
            # 计算驻留时间
            self.update_status("正在计算驻留时间...")
            df_with_residence = self.calculate_residence_time(df)
            
            # 计算时间差合并
            self.update_status("正在计算时间差合并...")
            df_with_calculated = self.calculate_time_difference(df_with_residence)
            
            self.df_with_calculated = df_with_calculated
            
            self.update_status("数据预处理完成！")
            self.update_status(f"原始数据行数: {len(df)}")
            self.update_status(f"计算后数据行数: {len(df_with_calculated)}")
            
            messagebox.showinfo("完成", "数据预处理完成！\n驻留时间和时间差合并列已添加。")
            
        except Exception as e:
            messagebox.showerror("错误", f"预处理过程中发生错误: {str(e)}")
    
    
    def calculate_residence_duration(self, df):
        """
        计算驻留时长: 按天为单位，当前"索引"对应的最大时间值的下一个"索引"值对应"开始时间"最小值减去当前"索引"的对应的"开始时间"最大值
        """
        df = df.copy()

        # 检查必要列是否存在
        if '开始时间' not in df.columns or '索引' not in df.columns:
            # 如果缺少必要列，返回原始数据并添加空的驻留时长列
            df['驻留时长'] = ''
            df['驻留时长_中文'] = ''
            return df

        df['开始时间'] = pd.to_datetime(df['开始时间'])

        # 添加日期列用于按天分组
        df['日期'] = df['开始时间'].dt.date

        # 初始化驻留时长列
        df['驻留时长'] = ''
        df['驻留时长_中文'] = ''

        # 按日期分组计算驻留时长
        for date in df['日期'].unique():
            # 获取当前日期的数据
            daily_df = df[df['日期'] == date].copy()

            if daily_df.empty:
                continue

            # 按索引分组，计算每个索引在当天的开始时间最大值
            index_max_time = daily_df.groupby('索引')['开始时间'].max().reset_index()
            index_max_time.columns = ['索引', '开始时间最大值']

            # 计算每个索引在当天的驻留时长
            for idx in daily_df['索引'].unique():
                # 当前索引在当天的最大开始时间
                current_max_time = index_max_time[index_max_time['索引'] == idx]['开始时间最大值'].values
                if len(current_max_time) == 0:
                    continue
                current_max_time = current_max_time[0]

                # 在同一天内找到所有开始时间大于当前索引最大时间的记录，并按索引分组取最小值
                later_records_in_day = daily_df[daily_df['开始时间'] > current_max_time]

                if later_records_in_day.empty:
                    # 当天没有后续记录，驻留时长为空
                    residence_duration_str = ''
                    residence_duration_chinese_str = ''
                else:
                    # 在当天找到了后续记录
                    next_index_min_time = later_records_in_day.groupby('索引')['开始时间'].min()

                    # 找到下一个索引（时间上最近的索引）
                    if not next_index_min_time.empty:
                        # 按时间排序，取最早的
                        sorted_times = next_index_min_time.sort_values()
                        next_min_time = sorted_times.iloc[0]

                        # 计算驻留时长（分钟）
                        residence_time_diff = next_min_time - current_max_time
                        residence_minutes = int(residence_time_diff.total_seconds() / 60)

                        # 格式化为"XXmin"，避免在MapInfo中出现中文乱码
                        residence_duration_str = f"{residence_minutes}min"
                        # 同时保留中文格式用于Excel输出
                        residence_duration_chinese_str = f"{residence_minutes}分钟"
                    else:
                        # 没有找到后续记录，设置为空
                        residence_duration_str = ''
                        residence_duration_chinese_str = ''

                # 更新df中对应索引在当天的所有行的驻留时长
                mask = (df['索引'] == idx) & (df['日期'] == date)
                df.loc[mask, '驻留时长'] = residence_duration_str
                df.loc[mask, '驻留时长_中文'] = residence_duration_chinese_str

        # 删除临时日期列
        df = df.drop(columns=['日期'])

        return df

    def calculate_time_merge(self, df):
        """
        计算时间差合并: "开始时间"和"驻留时长"转换为文本后合并，用下划线间隔
        驻留时长使用英文单位"min"以避免MapInfo中的中文乱码问题
        """
        df = df.copy()

        # 检查必要列是否存在
        if '开始时间' not in df.columns or '驻留时长' not in df.columns:
            # 如果缺少必要列，添加一个空的'时间差合并'列
            df['时间差合并'] = ''
            return df

        # 将开始时间转换为指定格式的文本
        df['开始时间文本'] = df['开始时间'].dt.strftime('%Y-%m-%d %H:%M:%S')

        # 确保驻留时长列是字符串类型以避免编码问题
        df['驻留时长'] = df['驻留时长'].astype(str)

        # 创建时间差合并列
        df['时间差合并'] = df['开始时间文本'] + '_' + df['驻留时长']

        # 删除临时列
        df = df.drop(columns=['开始时间文本'])

        return df

    def start_processing(self):
        if not self.file_path.get():
            messagebox.showerror("错误", "请选择Excel文件")
            return

        try:
            self.process_file()
        except Exception as e:
            messagebox.showerror("错误", f"处理过程中发生错误: {str(e)}")
    
    def process_file(self):
        file_path = self.file_path.get()
        output_dir = self.output_dir.get()
        use_smooth = self.use_smooth.get()

        self.update_status("正在读取Excel文件...")

        # 读取Excel文件
        df = pd.read_excel(file_path)

        # 计算驻留时长
        self.update_status("正在计算驻留时长...")
        df_with_residence = self.calculate_residence_duration(df)

        # 计算时间差合并
        self.update_status("正在计算时间差合并...")
        df_for_processing = self.calculate_time_merge(df_with_residence)

        self.update_status("正在按日期分组处理数据...")

        # 检查必要列是否存在
        required_columns = ['开始时间', '经度', '纬度']
        if not all(col in df.columns for col in required_columns):
            messagebox.showerror("错误", f"Excel文件缺少必要列: {required_columns}")
            return

        # 按开始时间排序
        df_sorted = df_for_processing.sort_values('开始时间')

        # 提取日期并按日期分组
        df_sorted['日期'] = pd.to_datetime(df_sorted['开始时间']).dt.date
        dates = df_sorted['日期'].unique()

        self.update_status(f"数据包含 {len(dates)} 天: {dates}")

        # 创建字段映射（只映射存在的列）
        field_mapping = {
            '序号': 'ID',
            '号码': 'Number',
            '开始时间': 'StartTime',
            '结束时间': 'EndTime',
            '小区': 'Cell',
            'SITE ID': 'SITE_ID',
            'CELL ID': 'CELL_ID',
            '索引': 'Index',
            '经度': 'Longitude',
            '纬度': 'Latitude',
            '驻留时长': 'ResidenceDuration',
            '时间差合并': 'TimeMerge'
        }

        # 计算进度
        total_dates = len(dates)
        progress_step = 100 / total_dates if total_dates > 0 else 0

        # 按日期分组处理
        for idx, date in enumerate(dates):
            self.update_status(f"正在处理日期: {date}")

            # 获取当前日期的数据
            daily_df = df_sorted[df_sorted['日期'] == date].copy()
            self.update_status(f"  该日期数据点数: {len(daily_df)}")

            # 应用字段映射（只对存在的列进行映射）
            available_mapping = {k: v for k, v in field_mapping.items() if k in daily_df.columns}
            daily_df_renamed = daily_df.rename(columns=available_mapping)

            # 提取经纬度坐标
            lons = daily_df['经度'].values
            lats = daily_df['纬度'].values
            times = np.arange(len(lons))  # 用索引作为时间参数

            # 根据用户选择创建轨迹线
            if len(lons) > 1:
                trajectory_line, original_points = self.create_trajectory_line(lons, lats, times, use_smooth)
            else:
                # 只有一个点时，创建一个包含单个点的LineString
                point = Point(lons[0], lats[0])
                original_points = [point]
                trajectory_line = LineString([(point.x, point.y) for point in original_points])

            # 创建轨迹线的GeoDataFrame
            trajectory_gdf = gpd.GeoDataFrame([{
                'TrajectoryID': f'Trajectory_{date}',
                'StartTime': daily_df['开始时间'].iloc[0],
                'EndTime': daily_df['开始时间'].iloc[-1],
                'PointCount': len(daily_df),
                'Date': str(date),
                'Type': 'AccurateSmooth' if use_smooth else 'Straight'
            }], geometry=[trajectory_line], crs='EPSG:4326')

            # 为轨迹点创建GeoDataFrame，使用英文字段名
            # 处理时间字段以确保MapInfo兼容性
            daily_df_renamed_for_mapinfo = daily_df_renamed.copy()

            # 将时间字段转换为字符串格式，以提高MapInfo兼容性（精确到秒）
            if 'StartTime' in daily_df_renamed_for_mapinfo.columns:
                daily_df_renamed_for_mapinfo['StartTime'] = daily_df_renamed_for_mapinfo['StartTime'].dt.strftime('%Y-%m-%d %H:%M:%S')
            if 'EndTime' in daily_df_renamed_for_mapinfo.columns:
                daily_df_renamed_for_mapinfo['EndTime'] = daily_df_renamed_for_mapinfo['EndTime'].dt.strftime('%Y-%m-%d %H:%M:%S')

            # 删除可能引起问题的临时字段（如日期字段）
            if 'Date' not in daily_df_renamed_for_mapinfo.columns and '日期' in daily_df_renamed_for_mapinfo.columns:
                daily_df_renamed_for_mapinfo = daily_df_renamed_for_mapinfo.drop(columns=['日期'])

            # 为轨迹点创建正确的几何对象（使用经纬度坐标）
            geometry_points = [Point(lon, lat) for lon, lat in zip(daily_df_renamed_for_mapinfo['Longitude'], daily_df_renamed_for_mapinfo['Latitude'])]
            points_gdf = gpd.GeoDataFrame(daily_df_renamed_for_mapinfo, geometry=geometry_points, crs='EPSG:4326')

            # 使用Excel文件名作为基础，生成带日期后缀的输出文件名
            base_name = os.path.splitext(os.path.basename(file_path))[0]
            date_str = date.strftime('%Y%m%d')  # 将日期格式化为YYYYMMDD格式

            # 保存每日的轨迹线为TAB格式
            daily_trajectory_tab_path = os.path.join(output_dir, f'{base_name}_轨迹线_{date_str}.tab')
            try:
                trajectory_gdf.to_file(daily_trajectory_tab_path, driver='MapInfo File', encoding='utf-8')
                self.update_status(f"  轨迹线已保存到 {daily_trajectory_tab_path}")
            except Exception as e:
                self.update_status(f"  保存轨迹线到TAB文件时出错: {e}")

            # 保存每日的点要素为TAB格式
            daily_points_tab_path = os.path.join(output_dir, f'{base_name}_轨迹点_{date_str}.tab')
            try:
                points_gdf.to_file(daily_points_tab_path, driver='MapInfo File', encoding='utf-8')
                self.update_status(f"  轨迹点已保存到 {daily_points_tab_path}")
            except Exception as e:
                self.update_status(f"  保存轨迹点到TAB文件时出错: {e}")

            # 更新进度
            progress = (idx + 1) * progress_step
            self.progress['value'] = progress

        # 输出包含驻留时长的Excel表格（使用中文格式）
        self.update_status("正在生成驻留时长分析Excel文件...")
        output_excel_path = os.path.join(output_dir, f'{base_name}_驻留时长.xlsx')
        try:
            # 创建一个临时副本用于Excel输出，将驻留时长替换为中文格式
            df_for_excel = df_for_processing.copy()
            if '驻留时长_中文' in df_for_excel.columns:
                df_for_excel['驻留时长'] = df_for_excel['驻留时长_中文']
                df_for_excel = df_for_excel.drop(columns=['驻留时长_中文'])  # 移除临时的中文列

            # 保存包含计算结果的完整数据到Excel文件
            df_for_excel.to_excel(output_excel_path, index=False, engine='openpyxl')
            self.update_status(f"驻留时长Excel文件已保存到: {output_excel_path}")
        except Exception as e:
            self.update_status(f"保存驻留时长Excel文件时出错: {e}")

        self.update_status("\n按日期分隔处理完成！")
        self.update_status("说明:")
        self.update_status("- 数据已按日期分组，每天生成一个轨迹线文件和一个轨迹点文件")
        self.update_status("- 轨迹线使用原始经纬度数据创建")
        if use_smooth:
            self.update_status("- 平滑轨迹线使用样条插值算法，确保原始轨迹点精确位于曲线上")
        else:
            self.update_status("- 轨迹线使用直线连接相邻点")
        self.update_status("- 所有原始轨迹点位置保持不变")
        self.update_status("- 文件使用WGS84坐标系，可在MapInfo等GIS软件中正确显示")
        self.update_status(f"- 驻留时长分析Excel文件已生成: {base_name}_驻留时长.xlsx")

        messagebox.showinfo("完成", "处理完成！文件已保存到指定目录。")
    
    def create_trajectory_line(self, lons, lats, times, use_smooth, smoothing_factor=5):
        original_points = [Point(lon, lat) for lon, lat in zip(lons, lats)]
        
        # 如果用户选择直线或点数少于2个，则使用直线
        if not use_smooth or len(lons) < 2:
            line = LineString([(point.x, point.y) for point in original_points])
            return line, original_points
        
        # 如果用户选择平滑曲线
        if len(lons) < 4:
            # 如果点数少于4，无法进行样条插值，使用直线
            line = LineString([(point.x, point.y) for point in original_points])
            return line, original_points
        
        try:
            # 创建样条函数，确保原始点精确通过
            lon_spline = interp1d(times, lons, kind='cubic', bounds_error=False, fill_value='extrapolate')
            lat_spline = interp1d(times, lats, kind='cubic', bounds_error=False, fill_value='extrapolate')
            
            # 生成更密集的插值点 (增加smoothing_factor倍的点，但确保原始时间点包含在内)
            min_t, max_t = times.min(), times.max()
            # 在原始时间间隔内插入新点，确保原始点精确通过
            detailed_times = []
            for i in range(len(times)-1):
                # 在每个原始时间间隔内插入更多点
                interval_times = np.linspace(times[i], times[i+1], smoothing_factor, endpoint=False)
                detailed_times.extend(interval_times)
            # 添加最后一个点
            detailed_times.append(times[-1])
            detailed_times = np.array(detailed_times)
            
            # 计算平滑轨迹
            smooth_lons = lon_spline(detailed_times)
            smooth_lats = lat_spline(detailed_times)
            
            # 创建平滑轨迹线
            smooth_points = [Point(lon, lat) for lon, lat in zip(smooth_lons, smooth_lats)]
            smooth_line = LineString([(point.x, point.y) for point in smooth_points])
            
            return smooth_line, original_points
        except Exception as e:
            self.update_status(f"  样条插值失败，使用直线连接: {e}")
            # 如果插值失败，返回原始直线
            line = LineString([(point.x, point.y) for point in original_points])
            return line, original_points


def main():
    root = tk.Tk()
    app = TrajectoryGeneratorGUI(root)
    root.mainloop()

if __name__ == "__main__":
    main()