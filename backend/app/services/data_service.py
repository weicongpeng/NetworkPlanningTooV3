"""
数据管理服务
"""
import os
import uuid
import shutil
from datetime import datetime
from typing import List, Optional, Dict, Any
from pathlib import Path
import pandas as pd

from app.core.config import settings
from app.models.schemas import DataItem, DataType, DataStatus, SiteData


class DataService:
    """数据管理服务类"""

    def __init__(self):
        self.data_index_file = settings.DATA_DIR / "index.json"
        self._ensure_directories()
        self._load_index()

    def _ensure_directories(self):
        """确保必要的目录存在"""
        settings.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
        settings.DATA_DIR.mkdir(parents=True, exist_ok=True)

    def _load_index(self):
        """加载数据索引"""
        if self.data_index_file.exists():
            import json
            with open(self.data_index_file, 'r', encoding='utf-8') as f:
                self.index = json.load(f)
        else:
            self.index = {}

    def _save_index(self):
        """保存数据索引"""
        import json
        self.data_index_file.parent.mkdir(parents=True, exist_ok=True)
        with open(self.data_index_file, 'w', encoding='utf-8') as f:
            json.dump(self.index, f, ensure_ascii=False, indent=2)

    async def upload_excel(self, file) -> Dict[str, str]:
        """上传Excel工参文件"""
        print(f"[DataService] ===== 开始上传Excel文件 =====")
        print(f"[DataService] 文件名: {file.filename}")
        
        # 生成唯一ID
        data_id = str(uuid.uuid4())
        print(f"[DataService] 生成ID: {data_id}")

        # 清理文件名：移除或替换可能导致Windows路径问题的字符
        import re
        safe_filename = re.sub(r'[<>:"/\\|?*]', '_', file.filename)
        # 限制文件名长度（避免Windows路径长度限制）
        if len(safe_filename) > 100:
            name, ext = os.path.splitext(safe_filename)
            safe_filename = name[:90] + ext
        print(f"[DataService] 安全文件名: {safe_filename}")

        # 保存文件 - 使用UUID避免中文文件名导致的路径问题
        file_path = settings.UPLOAD_DIR / f"{data_id}.xlsx"
        print(f"[DataService] 目标路径: {file_path}")
        
        try:
            print(f"[DataService] 读取文件内容...")
            content = await file.read()
            print(f"[DataService] 已读取 {len(content):,} 字节")
            
            print(f"[DataService] 保存到磁盘...")
            with open(file_path, 'wb') as f:
                f.write(content)
            print(f"[DataService] 文件已保存")
            
            # 验证文件
            if file_path.exists():
                file_size = file_path.stat().st_size
                print(f"[DataService] 文件验证成功，大小: {file_size:,} 字节")
            else:
                raise FileNotFoundError(f"文件保存失败: {file_path}")
                
        except Exception as e:
            print(f"[DataService] 文件保存失败: {type(e).__name__}: {e}")
            raise ValueError(f"文件保存失败: {str(e)}")

        # 处理数据
        try:
            import json
            
            print(f"[DataService] 开始解析Excel文件...")
            
            # 使用pandas.ExcelFile上下文管理器统一管理文件句柄
            # 这可以避免多次打开/关闭文件导致的Windows文件锁问题 (Errno 22)
            try:
                print(f"[DataService] 打开Excel文件...")
                xls = pd.ExcelFile(file_path)
            except PermissionError as e:
                print(f"[DataService] 权限错误: {e}")
                raise ValueError(f"文件被其他程序占用，请确保文件未被Excel打开: {str(e)}")
            except OSError as e:
                print(f"[DataService] 系统错误 [Errno {e.errno}]: {e}")
                if e.errno == 22:
                    raise ValueError(f"无法打开文件 (Errno 22)。可能原因：1) 文件损坏 2) 文件被占用 3) 路径包含特殊字符")
                else:
                    raise ValueError(f"无法打开文件: {str(e)}")
            except Exception as e:
                print(f"[DataService] 未知错误: {type(e).__name__}: {e}")
                raise ValueError(f"无法打开Excel文件: {str(e)}")
            
            try:
                with xls:
                    # 获取sheet名称
                    sheet_names = xls.sheet_names
                    print(f"[DataService] Excel文件包含的sheet: {sheet_names}")
        
                    # 判断文件类型
                    file_type = self._classify_file(file.filename, sheet_names)
                    print(f"[DataService] 文件类型: {file_type}")

                    # === 单一实例逻辑 ===
                    # 如果是全量工参或待规划小区，先删除已存在的同类型文件
                    if file_type in ['full_params', 'target_cells']:
                        files_to_delete = []
                        for existing_id, existing_data in self.index.items():
                            # 检查fileType，如果没有fileType字段则忽略（或者是旧数据）
                            if existing_data.get('fileType') == file_type:
                                files_to_delete.append(existing_id)
                        
                        if files_to_delete:
                            print(f"[DataService] 检测到已存在 {file_type} 文件 ({len(files_to_delete)} 个)，准备删除以保持唯一性...")
                            for data_id_to_delete in files_to_delete:
                                try:
                                    self.delete_data(data_id_to_delete)
                                    print(f"[DataService] 已删除旧文件: {data_id_to_delete}")
                                except Exception as e:
                                    print(f"[DataService] 删除旧文件失败: {e}")

                    # 根据文件类型解析数据
                    parsed_data = {}
                    metadata = {}

                    if file_type == "full_params":
                        # 全量工参文件 - 读取LTE和NR Project Parameters子表
                        for network in ['LTE', 'NR']:
                            sheet_name = f"{network} Project Parameters"
                            if sheet_name in sheet_names:
                                print(f"[DataService] 解析 {sheet_name}...")
                                # 传入xls对象而不是路径
                                sites = self._parse_sheet_data(xls, sheet_name, network)
                                parsed_data[network] = sites
                                metadata[f"{network}SiteCount"] = len(sites)
                                metadata[f"{network}SectorCount"] = sum(len(s.get('sectors', [])) for s in sites)
                                print(f"[DataService] {sheet_name} 解析完成: {len(sites)} 个基站")

                    elif file_type == "target_cells":
                        # 待规划小区文件 - 读取LTE和NR子表
                        for network in ['LTE', 'NR']:
                            if network in sheet_names:
                                print(f"[DataService] 解析 {network}...")
                                # 传入xls对象而不是路径
                                sites = self._parse_sheet_data(xls, network, network)
                                parsed_data[network] = sites
                                metadata[f"{network}SiteCount"] = len(sites)
                                metadata[f"{network}SectorCount"] = sum(len(s.get('sectors', [])) for s in sites)
                                print(f"[DataService] {network} 解析完成: {len(sites)} 个基站")
                    else:
                        # 普通工参文件 - 尝试默认解析
                        print(f"[DataService] 使用默认解析...")
                        # 传入xls对象而不是路径
                        sites = self._parse_default_excel(xls)
                        parsed_data['default'] = sites
                        metadata['siteCount'] = len(sites)
                        metadata['sectorCount'] = sum(len(s.get('sectors', [])) for s in sites)
                        print(f"[DataService] 默认解析完成: {len(sites)} 个基站")

            finally:
                # 确保关闭文件句柄
                # 注意：如果是在with块中，一般会自动关闭，但这里我们显式处理以防万一
                pass
                
        except Exception as e:
            # 清理失败的文件
            print(f"[DataService] ===== 上传失败 =====")
            print(f"[DataService] 错误类型: {type(e).__name__}")
            print(f"[DataService] 错误信息: {str(e)}")
            # 只有在是在这个函数里创建的临时文件才清理，但这里文件已经被保存到uploads了
            # 如果是上传过程中的临时文件，FastAPI会处理
            import traceback
            traceback.print_exc()
            raise ValueError(f"Excel文件解析失败: {str(e)}")

        # 保存处理后的数据
        # 注意：之前的代码结构有点问题，保存逻辑应该在解析成功之后，且需要在xls关闭之后（如果是在Windows上移动文件的话）
        # 但这里我们是读取内容，所以xls关闭后数据都在parsed_data里了
        
        print(f"[DataService] 保存解析结果...")
        data_dir = settings.DATA_DIR / data_id
        data_dir.mkdir(parents=True, exist_ok=True)

        # 保存原始文件 - 此时file_path是uploads下的文件，xls已经关闭，应该可以复制
        try:
            shutil.copy(file_path, data_dir / "original.xlsx")
            print(f"[DataService] 原始文件已保存")
        except Exception as e:
            print(f"[DataService] 保存原始文件失败: {e}")
            # 继续保存JSON

        # 保存解析后的数据
        with open(data_dir / "data.json", 'w', encoding='utf-8') as f:
            json.dump(parsed_data, f, ensure_ascii=False, indent=2)
        print(f"[DataService] 数据已保存到 data.json")

        # 更新索引
        self.index[data_id] = {
            "id": data_id,
            "name": file.filename,
            "type": "excel",
            "fileType": file_type,
            "size": file_path.stat().st_size,
            "uploadDate": datetime.now().isoformat(),
            "status": "ready",
            "metadata": metadata
        }
        self._save_index()
        print(f"[DataService] 索引已更新")

        print(f"[DataService] ===== 上传成功 =====")
        return {
            "id": data_id,
            "name": file.filename,
            "status": "ready",
            "fileType": file_type
        }

    def _classify_file(self, filename: str, sheet_names: list) -> str:
        """根据文件名和sheet名称分类文件类型"""
        filename_lower = filename.lower()

        # 待规划小区文件特征
        if 'cell-tree' in filename_lower or 'export' in filename_lower:
            return "target_cells"

        # 全量工参文件特征 - 包含LTE Project Parameters和NR Project Parameters
        if 'lte project parameters' in [s.lower() for s in sheet_names] and \
           'nr project parameters' in [s.lower() for s in sheet_names]:
            return "full_params"

        # 默认类型
        return "default"

    def _parse_sheet_data(self, excel_file, sheet_name: str, network_type: str) -> List[Dict]:
        """解析指定sheet的数据"""
        import pandas as pd

        print(f"[DataService] 正在解析sheet: {sheet_name} ({network_type})")

        # 检测是否是全量工参文件（LTE/NR Project Parameters）
        is_full_params = "Project Parameters" in sheet_name
        # 检测是否是待规划小区文件
        # 注意：这里简单判断sheet名是否为LTE/NR且似乎在待规划文件上下文中
        # 更好的方式是传递file_type，但为了保持签名兼容，我们可以通过sheet内容或上下文判断
        # 这里我们假设如果是 'LTE' 或 'NR' 这种简短名字，且解析失败时尝试target_cells逻辑
        # 但既然我们现在在这个方法里，我们不妨先尝试特定的解析逻辑
        
        # 实际上，调用者知道file_type。但在目前的架构中，_parse_sheet_data是通用的。
        # 我们可以检查列名来决定。

        if is_full_params:
            # 全量工参文件：第一行列名包含\n分隔的多行信息，从第4行开始是数据
            print(f"[DataService] 检测到全量工参文件，使用专用解析逻辑")
            return self._parse_full_params_sheet(excel_file, sheet_name, network_type)

        # 尝试读取前几行来判断是否是target_cells（没有基站经纬度，只有ID）
        try:
            # 简单读取
            df_preview = pd.read_excel(excel_file, sheet_name=sheet_name, nrows=1)
            columns = list(df_preview.columns)
            
            # 待规划小区特征：包含 eNodeBID/gNodeBID 和 CellID，但不包含 Longitude/Latitude
            has_id = 'eNodeBID' in columns or 'gNodeBID' in columns
            has_cell = 'CellID' in columns
            has_coords = 'Longitude' in columns or 'Latitude' in columns or '基站经度' in columns
            
            if has_id and has_cell and not has_coords:
                 print(f"[DataService] 检测到待规划小区文件格式，使用专用解析逻辑")
                 return self._parse_target_cells_sheet(excel_file, sheet_name, network_type)
                 
        except Exception as e:
            print(f"[DataService] 预检查失败: {e}")

        # 尝试不同的解析方式
        df = None

        # 方式1: 跳过前3行
        try:
            df = pd.read_excel(excel_file, sheet_name=sheet_name, header=3)
            # 简单验证一下是否有效
            if len(df.columns) > 1:
                print(f"[DataService] 使用header=3解析成功，共 {len(df)} 行")
            else:
                df = None
        except Exception as e:
            print(f"[DataService] header=3解析失败: {e}")

        # 方式2: 多级列名
        if df is None:
            try:
                df = pd.read_excel(excel_file, sheet_name=sheet_name, header=[0, 1, 2])
                df.columns = ['_'.join(str(c).strip() for c in col).strip() for col in df.columns.values]
                print(f"[DataService] 使用多级列名解析成功，共 {len(df)} 行")
            except Exception as e:
                print(f"[DataService] 多级列名解析失败: {e}")

        # 方式3: 默认
        if df is None:
            try:
                df = pd.read_excel(excel_file, sheet_name=sheet_name)
                print(f"[DataService] 使用默认解析成功，共 {len(df)} 行")
            except Exception as e:
                print(f"[DataService] 默认解析失败: {e}")

        if df is None:
            raise ValueError(f"无法解析sheet: {sheet_name}")

        return self._parse_dataframe(df, sheet_name, network_type)

    def _parse_target_cells_sheet(self, excel_file, sheet_name: str, network_type: str) -> List[Dict]:
        """解析待规划小区Sheet (只有ID信息)"""
        import pandas as pd
        print(f"[DataService] 解析待规划小区Sheet: {sheet_name}")
        
        df = pd.read_excel(excel_file, sheet_name=sheet_name)
        sites = {}
        
        # 确定ID列
        site_id_col = 'eNodeBID' if network_type == 'LTE' else 'gNodeBID'
        
        if site_id_col not in df.columns:
            # 尝试查找
            for col in df.columns:
                if site_id_col.lower() in col.lower():
                    site_id_col = col
                    break
        
        if site_id_col not in df.columns:
             raise ValueError(f"在Sheet {sheet_name} 中找不到 {site_id_col} 列")

        print(f"[DataService] 使用 {site_id_col} 作为站点ID列")
        
        for _, row in df.iterrows():
            try:
                if pd.isna(row[site_id_col]):
                    continue
                    
                site_id = str(int(row[site_id_col]))
                cell_id = str(int(row['CellID'])) if 'CellID' in row and pd.notna(row['CellID']) else "0"
                
                # 构建唯一扇区ID
                unique_sector_id = f"{site_id}_{cell_id}"
                
                if site_id not in sites:
                    sites[site_id] = {
                        "id": site_id,
                        "name": f"Site_{site_id}", # 自动生成名称
                        "longitude": 0.0, # 默认值
                        "latitude": 0.0,  # 默认值
                        "networkType": network_type,
                        "sectors": []
                    }
                
                # 添加扇区
                sector = {
                    "id": unique_sector_id,
                    "siteId": site_id,
                    "name": f"Cell_{site_id}_{cell_id}",
                    "longitude": 0.0,
                    "latitude": 0.0,
                    "azimuth": 0,
                    "beamwidth": 65,
                    "height": 30,
                    "pci": 0,
                    "earfcn": 0
                }
                
                sites[site_id]["sectors"].append(sector)
                
            except Exception as e:
                print(f"[DataService] 解析行失败: {e}")
                continue
                
        return list(sites.values())

    def _parse_full_params_sheet(self, excel_file, sheet_name: str, network_type: str) -> List[Dict]:
        """解析全量工参文件（LTE/NR Project Parameters）"""
        import pandas as pd

        print(f"[DataService] 解析全量工参sheet: {sheet_name}")

        try:
            # 直接使用传入的ExcelFile对象
            xls = excel_file
            
            # 读取第一行获取列名（包含\n分隔的多行信息）
            header_row = pd.read_excel(xls, sheet_name=sheet_name, header=None, nrows=1).iloc[0]

            # 提取中文名称（第一行中\n之前的部分）
            clean_columns = []
            for col in header_row:
                col_str = str(col).strip() if pd.notna(col) else ''
                if '\n' in col_str:
                    # 提取第一个\n之前的中文名称
                    chinese_name = col_str.split('\n')[0].strip()
                    clean_columns.append(chinese_name)
                else:
                    clean_columns.append(col_str)

            print(f"[DataService] 提取到 {len(clean_columns)} 个列名")


            # 从第4行开始读取数据（前3行是列名相关信息）
            df = pd.read_excel(xls, sheet_name=sheet_name, header=None, skiprows=3)

            # 设置清理后的列名
            df.columns = clean_columns

            print(f"[DataService] 全量工参数据加载完成，共 {len(df)} 行")
            column_preview = list(df.columns)[:10]
            print(f"[DataService] 列名: {column_preview}...")

            # 使用专门的解析方法处理全量工参数据
            return self._parse_full_params_dataframe(df, network_type)

        except Exception as e:
            print(f"[DataService] 解析全量工参sheet失败: {sheet_name}, 错误: {e}")
            raise ValueError(f"解析工参表 {sheet_name} 失败: {str(e)}")

    def _parse_full_params_dataframe(self, df: pd.DataFrame, network_type: str) -> List[Dict]:
        """解析全量工参DataFrame为站点数据"""
        sites = {}

        print(f"[DataService] 解析全量工参DataFrame，网络类型: {network_type}")

        # 定义全量工参的列名映射（智能匹配）
        if network_type == "LTE":
            # LTE工参需要的列名（中文）
            required_columns = {
                'site_id': ['eNodeB标识', 'eNodeBID', 'eNodeB ID', '基站ID', '管理网元ID'],
                'site_name': ['基站名称'],
                'longitude': ['基站经度', '经度', '小区经度'],
                'latitude': ['基站纬度', '纬度', '小区纬度'],
                'sector_id': ['小区标识', '小区ID'],
                'sector_name': ['小区名称'],
                'azimuth': ['天线方向角', '方位角'],
                'height': ['天线挂高', '挂高'],
                'pci': ['物理小区识别码', 'PCI'],
                'earfcn': ['下行链路的中心载频', 'EARFCN'],
                # 可选字段
                'tac': ['跟踪区码', 'TAC'],
                'cell_cover_type': ['小区覆盖类型'],
            }
        else:  # NR
            # NR工参需要的列名（中文）
            required_columns = {
                'site_id': ['gNodeB标识', 'gNodeBID', 'gNodeB ID', '基站ID', '管理网元ID'],
                'site_name': ['基站名称'],
                'longitude': ['基站经度', '经度', '小区经度'],
                'latitude': ['基站纬度', '纬度', '小区纬度'],
                'sector_id': ['小区标识', '小区ID'],
                'sector_name': ['小区名称'],
                'azimuth': ['天线方向角', '方位角'],
                'height': ['天线挂高', '挂高'],
                'pci': ['物理小区识别码', 'PCI'],
                'ssb_frequency': ['填写SSB频点', 'SSB频点'],
                # 可选字段
                'cell_cover_type': ['小区覆盖类型'],
                'mcc': ['移动国家码', 'MCC'],
                'mnc': ['移动网络码', 'MNC'],
            }

        # 智能列名匹配函数
        def find_column(df_cols, possible_names):
            """在DataFrame的列名中查找匹配的列"""
            df_cols_lower = [str(c).strip().lower() for c in df_cols]

            for possible in possible_names:
                possible_lower = possible.lower()

                # 精确匹配
                if possible_lower in df_cols_lower:
                    return df.columns[list(df_cols_lower).index(possible_lower)]

                # 包含匹配
                for i, df_col in enumerate(df_cols_lower):
                    if possible_lower in df_col or df_col in possible_lower:
                        return df.columns[i]

            return None

        # 执行列名匹配
        mapped_columns = {}
        for key, possible_names in required_columns.items():
            found_col = find_column(df.columns, possible_names)
            if found_col is not None:
                mapped_columns[key] = found_col
                print(f"[DataService] 列名映射: {key} -> {found_col}")
            else:
                print(f"[DataService] 警告: 未找到列 {key}，尝试匹配: {possible_names}")

        # 检查必需列是否存在
        required_keys = ['site_id', 'longitude', 'latitude', 'sector_id']
        missing_keys = [k for k in required_keys if k not in mapped_columns]

        if missing_keys:
            raise ValueError(f"全量工参文件缺少必需的列: {missing_keys}。已找到的列: {list(df.columns)}")

        # 开始解析数据
        parsed_count = 0
        skipped_count = 0

        for idx, row in df.iterrows():
            try:
                # 提取基站ID
                site_id_raw = row.get(mapped_columns['site_id'])
                if pd.isna(site_id_raw):
                    skipped_count += 1
                    continue

                site_id = str(site_id_raw).strip()
                if not site_id or site_id.lower() in ['nan', 'none', '']:
                    skipped_count += 1
                    continue

                # 提取基站名称
                site_name = "Unknown"
                if 'site_name' in mapped_columns:
                    name_raw = row.get(mapped_columns['site_name'])
                    if pd.notna(name_raw):
                        site_name = str(name_raw).strip()

                # 提取经纬度
                longitude = 0.0
                latitude = 0.0
                lon_col = mapped_columns['longitude']
                lat_col = mapped_columns['latitude']

                if pd.notna(row.get(lon_col)):
                    try:
                        longitude = float(row[lon_col])
                    except:
                        pass

                if pd.notna(row.get(lat_col)):
                    try:
                        latitude = float(row[lat_col])
                    except:
                        pass

                # 跳过无效的经纬度
                if longitude == 0 and latitude == 0:
                    skipped_count += 1
                    continue

                # 创建或获取站点
                if site_id not in sites:
                    sites[site_id] = {
                        "id": site_id,
                        "name": site_name,
                        "longitude": longitude,
                        "latitude": latitude,
                        "networkType": network_type,
                        "sectors": []
                    }

                # 提取小区信息
                sector_id_raw = row.get(mapped_columns['sector_id'])
                if pd.notna(sector_id_raw):
                    try:
                        sector_id = str(int(float(sector_id_raw)))
                    except:
                        sector_id = str(sector_id_raw).strip()
                else:
                    sector_id = f"{site_id}_{len(sites[site_id]['sectors'])}"

                # 小区名称
                sector_name = f"{site_name}_{sector_id}"
                if 'sector_name' in mapped_columns:
                    sname_raw = row.get(mapped_columns['sector_name'])
                    if pd.notna(sname_raw):
                        sname_str = str(sname_raw).strip()
                        if sname_str and sname_str not in ['非必填', 'nan', 'None']:
                            sector_name = sname_str

                # 方位角
                azimuth = 0.0
                if 'azimuth' in mapped_columns:
                    az_raw = row.get(mapped_columns['azimuth'])
                    if pd.notna(az_raw):
                        try:
                            azimuth = float(az_raw)
                        except:
                            pass

                # 天线高度
                height = 30.0
                if 'height' in mapped_columns:
                    h_raw = row.get(mapped_columns['height'])
                    if pd.notna(h_raw):
                        try:
                            height = float(h_raw)
                        except:
                            pass

                # 构建小区数据
                sector = {
                    "id": sector_id,
                    "siteId": site_id,
                    "name": sector_name,
                    "longitude": longitude,
                    "latitude": latitude,
                    "azimuth": azimuth,
                    "beamwidth": 65.0,
                    "height": height
                }

                # 可选字段：PCI
                if 'pci' in mapped_columns:
                    pci_raw = row.get(mapped_columns['pci'])
                    if pd.notna(pci_raw):
                        try:
                            pci_val = int(float(pci_raw))
                            if 0 <= pci_val <= 503:
                                sector['pci'] = pci_val
                        except:
                            pass

                # 可选字段：EARFCN（LTE）或SSB频点（NR）
                if network_type == "LTE" and 'earfcn' in mapped_columns:
                    earfcn_raw = row.get(mapped_columns['earfcn'])
                    if pd.notna(earfcn_raw):
                        try:
                            earfcn_val = float(earfcn_raw)
                            if earfcn_val > 0:
                                sector['earfcn'] = earfcn_val
                        except:
                            pass
                elif network_type == "NR" and 'ssb_frequency' in mapped_columns:
                    ssb_raw = row.get(mapped_columns['ssb_frequency'])
                    if pd.notna(ssb_raw):
                        try:
                            ssb_val = float(ssb_raw)
                            if ssb_val > 0:
                                sector['ssb_frequency'] = ssb_val
                        except:
                            pass

                sites[site_id]['sectors'].append(sector)
                parsed_count += 1

            except Exception as e:
                print(f"[DataService] 解析第{idx}行数据失败: {e}")
                skipped_count += 1
                continue

        result = list(sites.values())
        print(f"\n[DataService] ===== 全量工参解析完成 =====")
        print(f"  共解析: {len(result)} 个基站")
        print(f"  成功解析: {parsed_count} 个小区")
        print(f"  跳过无效行: {skipped_count} 行")
        for site in result[:5]:
            print(f"  站点 {site['id']}: {len(site['sectors'])} 个小区")
        if len(result) > 5:
            print(f"  ... (还有 {len(result) - 5} 个站点)")
        print(f"=====================================\n")

        return result

    def _parse_default_excel(self, excel_file) -> List[Dict]:
        """解析默认格式的Excel文件"""
        import pandas as pd

        df = None
        try:
            df = pd.read_excel(excel_file, header=3)
        except:
            try:
                df = pd.read_excel(excel_file)
            except:
                pass

        if df is None:
            raise ValueError("无法解析Excel文件")

        return self._parse_dataframe(df, "default", "LTE")

    def _parse_dataframe(self, df: pd.DataFrame, sheet_name: str, network_type: str) -> List[Dict]:
        """解析DataFrame为站点数据"""
        print(f"[DataService] _parse_dataframe: sheet={sheet_name}, network={network_type}")
        # 复用现有的_parse_excel_data方法，传入网络类型作为文件名标识
        return self._parse_excel_data(df, f"{sheet_name} ({network_type})")

    def _parse_excel_data(self, df: pd.DataFrame, filename: str = "") -> List[Dict]:
        """解析Excel数据 - 支持多种列名格式，包括多行列名"""
        sites = {}

        print(f"[DataService] 开始解析Excel文件: {filename}")
        print(f"[DataService] 数据形状: {df.shape}")
        print(f"[DataService] 所有列名: {list(df.columns)}")

        # 改进的列名映射表 - 使用更灵活的模糊匹配
        column_mappings = {
            # 基站ID可能的列名（支持多级列名组合）
            'site_id': ['基站ID', 'eNodeBID', 'eNodeB ID', 'gNodeBID', 'gNodeB ID', '站点ID',
                       'Site ID', 'ENODEBID', '基站标识', '网元ID', 'NE ID',
                       # 多级列名可能的组合
                       '基站_ID', 'eNodeB_ID', 'gNodeB_ID', '站点_ID',
                       'Unnamed_0_基站ID', 'Unnamed_1_基站ID'],
            # 基站名称可能的列名
            'site_name': ['基站名称', '站点名称', 'Site Name', 'eNodeB Name', 'gNodeB Name',
                         '网元名称', 'NE Name', '基站_Name', '站点_Name'],
            # 经纬度可能的列名
            'longitude': ['经度', ' Longitude', '小区经度', 'Cell Longitude', 'eNodeB Longitude',
                         '基站经度', '经度_经度', 'Longitude_经度'],
            'latitude': ['纬度', ' Latitude', '小区纬度', 'Cell Latitude', 'eNodeB Latitude',
                        '基站纬度', '纬度_纬度', 'Latitude_纬度'],
            # 网络类型可能的列名
            'network_type': ['网络类型', 'Network Type', 'RAT', 'RAT Type', 'RAT_Type',
                           '网络类型_网络类型'],
            # 小区ID可能的列名
            'sector_id': ['小区ID', 'CellID', 'Cell ID', '小区标识', 'cellLocalId', 'Cell LocalId',
                         '扇区ID', 'Sector ID', '小区_ID', 'Cell_ID'],
            # 小区名称可能的列名
            'sector_name': ['小区名称', 'Cell Name', 'CELL NAME', 'userLabel', 'UserLabel',
                           '扇区名称', 'Sector Name', '小区_小区名称', 'Cell_Name'],
            # 方位角可能的列名
            'azimuth': ['方位角', 'Azimuth', '方位角\nAzimuth', '机械下倾角', 'Azimuth_Azimuth',
                       '方位角_方位角'],
            # 波束宽度可能的列名
            'beamwidth': ['波束宽度', 'Beamwidth', '水平波束宽度', '水平半功率角',
                         '波束宽度_波束宽度'],
            # 天线高度可能的列名
            'height': ['天线高度', 'Antenna Height', 'Height', '天线挂高', '总高度',
                      '天线高度_天线高度'],
            # PCI可能的列名
            'pci': ['PCI', '物理小区识别码', 'Physical Cell ID', 'PCI_PCI',
                   'PCI_物理小区识别码'],
            # EARFCN可能的列名
            'earfcn': ['EARFCN', 'earfcnDl', '下行链路的中心载频', 'ARFCN', 'SSB Frequency',
                      'EARFCN_EARFCN', 'DL EARFCN'],
        }

        # 改进的模糊匹配函数
        def find_column(target_name: str) -> Optional[str]:
            """查找目标列对应的实际列名 - 使用模糊匹配"""
            possible_names = column_mappings.get(target_name, [])

            for col in df.columns:
                col_str = str(col).strip().lower()
                col_str_clean = col_str.replace(' ', '').replace('_', '').replace('\n', '')

                for possible in possible_names:
                    possible_clean = possible.lower().replace(' ', '').replace('_', '').replace('\n', '')

                    # 精确匹配
                    if col_str == possible.lower():
                        return col
                    # 去除特殊字符后匹配
                    if col_str_clean == possible_clean:
                        return col
                    # 包含匹配（列名包含目标词或目标词包含列名）
                    if possible_clean in col_str_clean or col_str_clean in possible_clean:
                        if len(possible_clean) > 3:  # 避免过短词误匹配
                            return col

            return None

        # 映射列名
        site_id_col = find_column('site_id')
        site_name_col = find_column('site_name')
        longitude_col = find_column('longitude')
        latitude_col = find_column('latitude')
        network_type_col = find_column('network_type')
        sector_id_col = find_column('sector_id')
        sector_name_col = find_column('sector_name')
        azimuth_col = find_column('azimuth')
        beamwidth_col = find_column('beamwidth')
        height_col = find_column('height')
        pci_col = find_column('pci')
        earfcn_col = find_column('earfcn')

        print(f"\n[DataService] ===== 列名映射结果 =====")
        print(f"  基站ID: {site_id_col}")
        print(f"  基站名称: {site_name_col}")
        print(f"  经度: {longitude_col}")
        print(f"  纬度: {latitude_col}")
        print(f"  网络类型: {network_type_col}")
        print(f"  小区ID: {sector_id_col}")
        print(f"  小区名称: {sector_name_col}")
        print(f"  方位角: {azimuth_col}")
        print(f"  波束宽度: {beamwidth_col}")
        print(f"  天线高度: {height_col}")
        print(f"  PCI: {pci_col}")
        print(f"  EARFCN: {earfcn_col}")
        print(f"==============================\n")

        if not site_id_col:
            raise ValueError("无法找到基站ID列，请检查Excel文件格式。需要的列名包括：基站ID、eNodeBID、gNodeBID、站点ID等")

        print(f"[DataService] 开始解析 {len(df)} 行数据...")

        parsed_count = 0
        skipped_count = 0

        for idx, row in df.iterrows():
            try:
                # 提取基站ID
                site_id_raw = row.get(site_id_col)
                if pd.isna(site_id_raw):
                    skipped_count += 1
                    continue
                site_id = str(site_id_raw).strip()

                # 跳过空行或标题行
                if not site_id or site_id.lower() in ['nan', 'none', ''] or site_id.startswith('Un'):
                    skipped_count += 1
                    continue

                # 提取基站名称
                site_name = "Unknown"
                if site_name_col:
                    name_raw = row.get(site_name_col)
                    if pd.notna(name_raw):
                        site_name = str(name_raw).strip()

                # 提取网络类型
                network_type = "LTE"
                if network_type_col:
                    nt_raw = row.get(network_type_col)
                    if pd.notna(nt_raw):
                        nt_str = str(nt_raw).strip().upper()
                        if 'NR' in nt_str or '5G' in nt_str or '5GC' in nt_str:
                            network_type = "NR"
                        else:
                            network_type = "LTE"

                # 提取经纬度
                longitude = 0.0
                latitude = 0.0
                if longitude_col:
                    lon_raw = row.get(longitude_col)
                    if pd.notna(lon_raw):
                        try:
                            lon_str = str(lon_raw).strip()
                            longitude = float(lon_str)
                        except:
                            try:
                                longitude = float(lon_raw)
                            except:
                                longitude = 0.0
                if latitude_col:
                    lat_raw = row.get(latitude_col)
                    if pd.notna(lat_raw):
                        try:
                            lat_str = str(lat_raw).strip()
                            latitude = float(lat_str)
                        except:
                            try:
                                latitude = float(lat_raw)
                            except:
                                latitude = 0.0

                # 跳过无效的经纬度
                if longitude == 0 and latitude == 0:
                    skipped_count += 1
                    continue

                # 创建或获取站点
                if site_id not in sites:
                    sites[site_id] = {
                        "id": site_id,
                        "name": site_name,
                        "longitude": longitude,
                        "latitude": latitude,
                        "networkType": network_type,
                        "sectors": []
                    }

                # 提取小区信息
                sector_id = f"{site_id}_0"  # 默认
                if sector_id_col:
                    sid_raw = row.get(sector_id_col)
                    if pd.notna(sid_raw):
                        try:
                            # 处理科学计数法等格式
                            sector_id = str(int(float(sid_raw)))
                        except:
                            sector_id = str(sid_raw).strip()

                sector_name = f"{site_name}_{sector_id}"
                if sector_name_col:
                    sname_raw = row.get(sector_name_col)
                    if pd.notna(sname_raw):
                        sname_str = str(sname_raw).strip()
                        if sname_str and sname_str not in ['非必填', 'UserLabel', '必填', 'nan', 'None']:
                            sector_name = sname_str

                # 方位角
                azimuth = 0.0
                if azimuth_col:
                    az_raw = row.get(azimuth_col)
                    if pd.notna(az_raw):
                        try:
                            azimuth = float(az_raw)
                        except:
                            azimuth = 0.0

                # 波束宽度
                beamwidth = 65.0
                if beamwidth_col:
                    bw_raw = row.get(beamwidth_col)
                    if pd.notna(bw_raw):
                        try:
                            beamwidth = float(bw_raw)
                        except:
                            beamwidth = 65.0

                # 天线高度
                height = 30.0
                if height_col:
                    h_raw = row.get(height_col)
                    if pd.notna(h_raw):
                        try:
                            height = float(h_raw)
                        except:
                            height = 30.0

                # 构建小区数据
                sector = {
                    "id": sector_id,
                    "siteId": site_id,
                    "name": sector_name,
                    "longitude": longitude,
                    "latitude": latitude,
                    "azimuth": azimuth,
                    "beamwidth": beamwidth,
                    "height": height
                }

                # 可选字段：PCI
                if pci_col:
                    pci_raw = row.get(pci_col)
                    if pd.notna(pci_raw):
                        try:
                            pci_val = int(float(pci_raw))
                            if 0 <= pci_val <= 503:  # PCI有效范围检查
                                sector['pci'] = pci_val
                        except:
                            pass

                # 可选字段：EARFCN
                if earfcn_col:
                    earfcn_raw = row.get(earfcn_col)
                    if pd.notna(earfcn_raw):
                        try:
                            earfcn_val = float(earfcn_raw)
                            if earfcn_val > 0:
                                sector['earfcn'] = int(earfcn_val)
                        except:
                            pass

                sites[site_id]['sectors'].append(sector)
                parsed_count += 1

            except Exception as e:
                print(f"[DataService] 解析第{idx}行数据失败: {e}")
                skipped_count += 1
                continue

        result = list(sites.values())
        print(f"\n[DataService] ===== 解析完成 =====")
        print(f"  共解析: {len(result)} 个基站")
        print(f"  成功解析: {parsed_count} 个小区")
        print(f"  跳过无效行: {skipped_count} 行")
        for site in result[:5]:  # 只显示前5个站点
            print(f"  站点 {site['id']}: {len(site['sectors'])} 个小区")
        if len(result) > 5:
            print(f"  ... (还有 {len(result) - 5} 个站点)")
        print(f"=====================\n")

        return result

    async def upload_map(self, file) -> Dict[str, str]:
        """上传地图文件"""
        data_id = str(uuid.uuid4())

        # 保存文件 - 使用UUID避免中文文件名导致的路径问题
        ext = os.path.splitext(file.filename)[1]
        file_path = settings.UPLOAD_DIR / f"{data_id}{ext}"
        with open(file_path, 'wb') as f:
            content = await file.read()
            f.write(content)

        # 如果是ZIP文件，解压
        if file.filename.endswith('.zip'):
            import zipfile
            data_dir = settings.DATA_DIR / data_id
            data_dir.mkdir(parents=True, exist_ok=True)

            with zipfile.ZipFile(file_path, 'r') as zip_ref:
                zip_ref.extractall(data_dir)

        # 更新索引
        self.index[data_id] = {
            "id": data_id,
            "name": file.filename,
            "type": "map",
            "size": file_path.stat().st_size,
            "uploadDate": datetime.now().isoformat(),
            "status": "ready",
            "metadata": {
                "fileCount": len(list(file_path.parent.glob("*"))) if file_path.parent.exists() else 1
            }
        }
        self._save_index()

        return {
            "id": data_id,
            "name": file.filename,
            "status": "ready"
        }

    def list_data(self) -> List[DataItem]:
        """获取数据列表"""
        items = []
        for data_id, data in self.index.items():
            # 创建数据副本并转换枚举类型
            data_copy = data.copy()
            # 确保type字段是枚举类型
            if isinstance(data_copy.get('type'), str):
                if data_copy['type'] == 'excel':
                    data_copy['type'] = DataType.EXCEL
                elif data_copy['type'] == 'map':
                    data_copy['type'] = DataType.MAP
            # 确保status字段是枚举类型
            if isinstance(data_copy.get('status'), str):
                if data_copy['status'] == 'ready':
                    data_copy['status'] = DataStatus.READY
                elif data_copy['status'] == 'processing':
                    data_copy['status'] = DataStatus.PROCESSING
                elif data_copy['status'] == 'error':
                    data_copy['status'] = DataStatus.ERROR
            items.append(DataItem(**data_copy))
        print(f"[DataService] list_data返回 {len(items)} 个数据项")
        for item in items:
            print(f"  - {item.name} (id={item.id}, type={item.type}, type.value={item.type.value})")
        return items

    def get_data(self, data_id: str) -> Optional[Dict]:
        """获取数据详情"""
        print(f"[DataService] get_data被调用, data_id={data_id}")
        if data_id not in self.index:
            print(f"[DataService] data_id不在索引中")
            return None

        data_info = self.index[data_id]
        print(f"[DataService] data_info: {data_info}")
        data_dir = settings.DATA_DIR / data_id
        print(f"[DataService] data_dir: {data_dir}, exists: {data_dir.exists()}")

        if data_info["type"] == "excel":
            data_file = data_dir / "data.json"
            print(f"[DataService] data_file: {data_file}, exists: {data_file.exists()}")
            if data_file.exists():
                import json
                with open(data_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    print(f"[DataService] 成功加载 {len(data)} 个基站")
                    return data
            else:
                print(f"[DataService] data.json不存在!")
        else:
            # 地图文件返回文件列表
            files = list(data_dir.glob("*")) if data_dir.exists() else []
            return {"files": [f.name for f in files]}

        return None

    def delete_data(self, data_id: str) -> bool:
        """删除数据"""
        if data_id not in self.index:
            return False

        # 删除文件
        data_dir = settings.DATA_DIR / data_id
        if data_dir.exists():
            shutil.rmtree(data_dir)

        # 删除上传的原始文件 - 尝试新旧两种格式
        # 新格式：{data_id}.xlsx
        upload_file = settings.UPLOAD_DIR / f"{data_id}.xlsx"
        if upload_file.exists():
            upload_file.unlink()
        else:
            # 旧格式：{data_id}_{filename}.xlsx (兼容旧数据)
            old_filename = self.index[data_id].get('name', '')
            if old_filename:
                old_upload_file = settings.UPLOAD_DIR / f"{data_id}_{old_filename}"
                if old_upload_file.exists():
                    try:
                        old_upload_file.unlink()
                    except:
                        pass  # 忽略删除失败

        # 更新索引
        del self.index[data_id]
        self._save_index()

        return True

    def preview_data(self, data_id: str, rows: int = 100) -> Optional[Dict]:
        """预览数据"""
        if data_id not in self.index:
            return None

        data_info = self.index[data_id]
        if data_info["type"] != "excel":
            return None

        data_dir = settings.DATA_DIR / data_id
        original_file = data_dir / "original.xlsx"

        if original_file.exists():
            df = pd.read_excel(original_file, nrows=rows)
            return {
                "columns": df.columns.tolist(),
                "rows": df.to_dict('records'),
                "totalRows": len(df)
            }

        return None


# 创建全局实例
data_service = DataService()
