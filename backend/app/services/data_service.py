"""
数据管理服务
"""
import os
import sys
import uuid
import shutil
import glob
import re
from datetime import datetime
from typing import List, Optional, Dict, Any, Set, Tuple
from pathlib import Path
import pandas as pd
import numpy as np
import openpyxl

from app.core.config import settings
from app.models.schemas import DataItem, DataType, DataStatus, SiteData

# 设置stdout编码为utf-8，避免Windows下GBK编码问题
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except:
        pass  # 如果无法配置，忽略错误

def safe_print(msg: str):
    """安全打印函数，处理可能的编码错误"""
    try:
        print(msg)
    except UnicodeEncodeError:
        # 如果打印失败，尝试使用GBK编码，替换无法编码的字符
        safe_msg = msg.encode('gbk', 'replace').decode('gbk')
        print(safe_msg)
    except Exception:
        # 其他错误也尝试处理
        try:
            safe_msg = msg.encode('gbk', 'replace').decode('gbk')
            print(safe_msg)
        except:
            pass  # 如果还是失败，放弃打印


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

    def update_parameters(self, full_param_id: str, current_param_id: str) -> Dict[str, Any]:
        """更新工参"""
        safe_print(f"[DataService] 开始更新工参: Full={full_param_id}, Current={current_param_id}")
        
        # 1. 获取文件路径
        if full_param_id not in self.index or current_param_id not in self.index:
            raise ValueError("找不到指定的文件ID")
            
        full_info = self.index[full_param_id]
        current_info = self.index[current_param_id]
        
        full_dir = settings.DATA_DIR / full_param_id
        current_dir = settings.DATA_DIR / current_param_id
        
        original_excel = full_dir / "original.xlsx"
        if not original_excel.exists():
            raise ValueError("全量工参原始文件不存在")
            
        # 2. 准备输出文件
        # 生成新文件名：原文件名 + 时间戳
        original_name = full_info['name']
        name_part, ext_part = os.path.splitext(original_name)
        # 移除可能已有的时间戳（简单处理：如果文件名以数字结尾，可能是时间戳）
        # 这里直接追加时间戳
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        
        # 尝试替换文件名中的最后一段数字串（如果存在）
        new_name = re.sub(r'\d{14}', timestamp, name_part)
        if new_name == name_part:
             new_name = f"{name_part}_{timestamp}"
        
        new_filename = f"{new_name}{ext_part}"
        
        # 创建新的数据ID
        new_data_id = str(uuid.uuid4())
        new_data_dir = settings.DATA_DIR / new_data_id
        new_data_dir.mkdir(parents=True, exist_ok=True)
        
        output_excel_path = new_data_dir / "original.xlsx"
        
        # 3. 加载Excel
        safe_print(f"[DataService] 加载Excel: {original_excel}")
        try:
            wb = openpyxl.load_workbook(original_excel)
        except Exception as e:
            raise ValueError(f"无法打开Excel文件: {e}")
            
        # 4. 处理LTE
        if "LTE Project Parameters" in wb.sheetnames:
            safe_print(f"[DataService] 处理LTE工参...")
            self._update_sheet(
                wb["LTE Project Parameters"], 
                current_dir, 
                "LTE"
            )
        else:
            safe_print(f"[DataService] 警告: 未找到 'LTE Project Parameters' Sheet")

        # 5. 处理NR
        if "NR Project Parameters" in wb.sheetnames:
            safe_print(f"[DataService] 处理NR工参...")
            self._update_sheet(
                wb["NR Project Parameters"], 
                current_dir, 
                "NR"
            )
        else:
            safe_print(f"[DataService] 警告: 未找到 'NR Project Parameters' Sheet")
            
        # 6. 保存结果
        safe_print(f"[DataService] 保存结果到: {output_excel_path}")
        wb.save(output_excel_path)
        wb.close()
        
        # 7. 解析新文件以生成 data.json (复用 upload_excel 的部分逻辑)
        safe_print(f"[DataService] 解析新文件生成 data.json...")
        metadata = {}
        try:
            import json
            xls = pd.ExcelFile(output_excel_path)
            parsed_data = {}
            
            with xls:
                sheet_names = xls.sheet_names
                for network in ['LTE', 'NR']:
                    sheet_name = f"{network} Project Parameters"
                    if sheet_name in sheet_names:
                        sites = self._parse_sheet_data(xls, sheet_name, network)
                        parsed_data[network] = sites
                        metadata[f"{network}SiteCount"] = len(sites)
                        metadata[f"{network}SectorCount"] = sum(len(s.get('sectors', [])) for s in sites)
            
            with open(new_data_dir / "data.json", 'w', encoding='utf-8') as f:
                json.dump(parsed_data, f, ensure_ascii=False, indent=2)
                
        except Exception as e:
            safe_print(f"[DataService] 解析新文件失败: {e}")
            # 即使解析失败，文件已经生成，我们还是注册它
            pass

        # 8. 注册新文件 & 保存到原始路径（如果存在）
        # 复制一份到uploads目录以便下载（模拟上传行为）
        new_upload_path = settings.UPLOAD_DIR / f"{new_data_id}.xlsx"
        shutil.copy(output_excel_path, new_upload_path)
        
        # 尝试保存到原始目录
        saved_to_original = False
        original_path = full_info.get("originalPath")
        safe_print(f"[DataService] 原始路径信息: originalPath='{original_path}', 类型={type(original_path).__name__}")

        if original_path:
            try:
                # 确保路径是绝对路径并处理编码
                original_file_path = os.path.abspath(original_path)
                original_dir = os.path.dirname(original_file_path)

                safe_print(f"[DataService] 解析后路径: original_file_path='{original_file_path}', original_dir='{original_dir}'")

                if os.path.exists(original_dir):
                    target_path = os.path.join(original_dir, new_filename)
                    safe_print(f"[DataService] 准备保存副本到: {target_path}")

                    shutil.copy2(output_excel_path, target_path)
                    if os.path.exists(target_path):
                        safe_print(f"[DataService] [OK] 副本保存成功到原路径!")
                        saved_to_original = True
                    else:
                        safe_print(f"[DataService] [X] 副本保存失败 - 文件不存在")
                else:
                    safe_print(f"[DataService] [X] 原始目录不存在: {original_dir}")
            except Exception as e:
                safe_print(f"[DataService] [X] 无法保存到原始目录 ({original_path}): {e}")
                import traceback
                traceback.print_exc()
        else:
            safe_print(f"[DataService] [X] 未能获取到原始路径 (originalPath is empty or None)")
            safe_print(f"[DataService] 提示: 请检查前端是否正确传递了 file_path 参数")
        
        self.index[new_data_id] = {
            "id": new_data_id,
            "name": new_filename,
            "type": "excel",
            "fileType": "full_params",
            "size": output_excel_path.stat().st_size,
            "uploadDate": datetime.now().isoformat(),
            "status": "ready",
            "originalPath": full_info.get("originalPath"), # 继承路径
            "metadata": metadata
        }
        self._save_index()
        safe_print(f"[DataService] 索引已更新")
        
        return {
            "newFileId": new_data_id,
            "newFileName": new_filename,
            "savedToOriginal": saved_to_original
        }

    def _update_sheet(self, ws, current_dir: Path, network_type: str):
        """更新单个Sheet"""
        # 1. 确定列索引映射
        header_row = list(ws.iter_rows(min_row=1, max_row=1, values_only=True))[0]
        col_map = {} # Chinese Name -> Column Index (1-based)

        for idx, col_val in enumerate(header_row):
            if col_val:
                # 提取中文名称（处理可能的前导换行符，取第一行非空内容）
                # 例如: "\ngNodeBLength\n..." -> "gNodeBLength"
                clean_name = str(col_val).strip().split('\n')[0].strip()
                col_map[clean_name] = idx + 1

        # 调试：检查是否找到小区覆盖类型列
        if '小区覆盖类型' in col_map:
            safe_print(f"[DataService] 找到'小区覆盖类型'列，列索引={col_map['小区覆盖类型']}")
        else:
            safe_print(f"[DataService] 警告: 未找到'小区覆盖类型'列")
        
        # 2. 读取现网工参数据
        updates = self._load_current_params(current_dir, network_type)
        safe_print(f"[DataService] 加载到 {len(updates)} 条 {network_type} 现网数据")
        
        # 3. 遍历Excel行进行更新
        # LTE Key: eNodeB标识 + 小区标识
        # NR Key: 移动国家码 + 移动网络码 + gNodeB标识 + 小区标识
        
        # 构建Excel中的现有Key集合
        existing_keys = set()
        
        # 映射字段配置
        if network_type == "LTE":
            key_cols = ['eNodeB标识', '小区标识']
            # 源CSV字段 -> 目标Excel字段
            # 注意：允许多个源字段映射到同一个目标字段（后遍历的会覆盖前面的，或者根据是否存在来决定）
            # 建议将优先使用的字段放在后面（字典顺序），或者在逻辑中处理
            field_map = {
                'eNBName': '基站名称',
                'UserLabel': '基站名称', # 备选
                'SubNetwork': '子网ID',
                'ManagedElement': '管理网元ID',
                'cellName': '小区名称',
                'CellName': '小区名称', # 备选 (常见大写)
                'tac': '跟踪区码',
                'pci': '物理小区识别码',
                'frequency': '下行链路的中心载频',
                'cellLocalId': '小区标识',
                'eNBId': 'eNodeB标识',
                'mcc': '移动国家码',
                'mnc': '移动网络码',
            }
        else: # NR
            key_cols = ['移动国家码', '移动网络码', 'gNodeB标识', '小区标识']
            field_map = {
                'eNBName': '基站名称',
                'gNBName': '基站名称',
                'UserLabel': '基站名称', # 备选
                'dra_GNBName': '基站名称', # 备选
                'SubNetwork': '子网ID',
                'ManagedElement': '管理网元ID',
                'cellName': '小区名称',
                'CellName': '小区名称', # 备选
                'tac': '跟踪区码',
                'pci': '物理小区识别码',
                'ssbFrequency': '填写SSB频点',  # 修改：使用ssbFrequency而不是frequency
                'frequencyBandList': 'gNodeBLength', # 新增映射
                'cellLocalId': '小区标识',
                'gNBId': 'gNodeB标识',
                'mcc': '移动国家码',
                'mnc': '移动网络码',
                # 注意：coverageType 不在 field_map 中，而是单独处理
            }

        # 验证必要的列是否存在于Excel中
        missing_cols = [k for k in key_cols if k not in col_map]
        if missing_cols:
            safe_print(f"[DataService] 警告: Sheet中缺少Key列: {missing_cols}，跳过更新")
            return

        # 遍历数据行（从第4行开始）
        # 注意：openpyxl的row是1-based
        for row in ws.iter_rows(min_row=4):
            # 获取Key值
            try:
                if network_type == "LTE":
                    enb_id = self._get_cell_val(row, col_map, 'eNodeB标识')
                    cell_id = self._get_cell_val(row, col_map, '小区标识')
                    if enb_id is not None and cell_id is not None:
                        key = f"{enb_id}_{cell_id}"
                        existing_keys.add(key)
                        
                        # 检查是否有更新
                        if key in updates:
                            self._apply_row_update(row, col_map, updates[key], field_map, network_type)
                            # 标记为已处理（以便后续追加未处理的）
                            updates[key]['_processed'] = True
                            
                else: # NR
                    mcc = self._get_cell_val(row, col_map, '移动国家码')
                    mnc = self._get_cell_val(row, col_map, '移动网络码')
                    gnb_id = self._get_cell_val(row, col_map, 'gNodeB标识')
                    cell_id = self._get_cell_val(row, col_map, '小区标识')
                    
                    if all(v is not None for v in [mcc, mnc, gnb_id, cell_id]):
                        key = f"{mcc}_{mnc}_{gnb_id}_{cell_id}"
                        existing_keys.add(key)

                        if key in updates:
                            try:
                                self._apply_row_update(row, col_map, updates[key], field_map, network_type)
                                updates[key]['_processed'] = True
                            except Exception as e:
                                import traceback
                                safe_print(f"[DataService] 更新行失败 (Key={key}): {e}")
                                traceback.print_exc()
            except Exception as e:
                import traceback
                safe_print(f"[DataService] 处理行时发生错误: {e}")
                traceback.print_exc()
                continue

        # 5. 追加新行
        new_rows_count = 0
        for key, data in updates.items():
            if not data.get('_processed'):
                # 准备新行数据
                self._append_new_row(ws, col_map, data, field_map, network_type)
                new_rows_count += 1
        
        # 4. 处理特殊列：CGI、跟踪区码、是否共享、第一分组、gNodeBLength
        # 收集所有行数据用于处理（包括新追加的行）
        all_rows = list(ws.iter_rows(min_row=4))
        
        if network_type == "NR":
            # NR网络处理
            # 4.1 生成CGI列
            cgi_list = []
            for row in all_rows:
                gnb_id = self._get_cell_val(row, col_map, 'gNodeB标识')
                cell_id = self._get_cell_val(row, col_map, '小区标识')
                if gnb_id and cell_id:
                    cgi = f"{gnb_id}-{cell_id}"
                    cgi_list.append(cgi)
                    # 更新CGI列
                    if 'CGI' in col_map:
                        row[col_map['CGI'] - 1].value = cgi
                else:
                    cgi_list.append(None)
            
            # 4.2 更新跟踪区码（从现网工参获取）
            for i, row in enumerate(all_rows):
                mcc = self._get_cell_val(row, col_map, '移动国家码')
                mnc = self._get_cell_val(row, col_map, '移动网络码')
                gnb_id = self._get_cell_val(row, col_map, 'gNodeB标识')
                cell_id = self._get_cell_val(row, col_map, '小区标识')
                if all([mcc, mnc, gnb_id, cell_id]):
                    key = f"{mcc}_{mnc}_{gnb_id}_{cell_id}"
                    if key in updates and 'tac' in updates[key]:
                        tac = updates[key]['tac']
                        if '跟踪区码' in col_map and tac is not None and not pd.isna(tac):
                            row[col_map['跟踪区码'] - 1].value = tac
            
            # 4.3 计算是否共享列
            if '是否共享' in col_map:
                # 统计CGI出现次数
                cgi_counts = {}
                for cgi in cgi_list:
                    if cgi:
                        cgi_counts[cgi] = cgi_counts.get(cgi, 0) + 1
                # 更新是否共享列
                for i, row in enumerate(all_rows):
                    cgi = cgi_list[i]
                    if cgi:
                        count = cgi_counts.get(cgi, 0)
                        row[col_map['是否共享'] - 1].value = "是" if count == 2 else "否"
            
            # 4.4 更新第一分组列：在现网工参能找到的小区都填为"电信中兴"
            for i, row in enumerate(all_rows):
                mcc = self._get_cell_val(row, col_map, '移动国家码')
                mnc = self._get_cell_val(row, col_map, '移动网络码')
                gnb_id = self._get_cell_val(row, col_map, 'gNodeB标识')
                cell_id = self._get_cell_val(row, col_map, '小区标识')
                if all([mcc, mnc, gnb_id, cell_id]):
                    key = f"{mcc}_{mnc}_{gnb_id}_{cell_id}"
                    if key in updates:
                        if '第一分组' in col_map:
                            row[col_map['第一分组'] - 1].value = "电信中兴"
            
            # 4.5 处理gNodeBLength：未找到的小区根据填写SSB频点判断
            for i, row in enumerate(all_rows):
                mcc = self._get_cell_val(row, col_map, '移动国家码')
                mnc = self._get_cell_val(row, col_map, '移动网络码')
                gnb_id = self._get_cell_val(row, col_map, 'gNodeB标识')
                cell_id = self._get_cell_val(row, col_map, '小区标识')
                if all([mcc, mnc, gnb_id, cell_id]):
                    key = f"{mcc}_{mnc}_{gnb_id}_{cell_id}"
                    if key not in updates:
                        # 未找到的小区，根据填写SSB频点判断
                        ssb_frequency = self._get_cell_val(row, col_map, '填写SSB频点')
                        if ssb_frequency:
                            try:
                                # 尝试将SSB频点转换为数值，处理范围判断
                                # 情况1: 直接是数值，如 "925"
                                ssb_num = float(ssb_frequency)
                                if 900 <= ssb_num <= 955:
                                    if 'gNodeBLength' in col_map:
                                        row[col_map['gNodeBLength'] - 1].value = 8
                                # 情况2: 范围字符串，如 "900-955"
                            except ValueError:
                                # 如果转换失败，检查是否是范围字符串
                                if "-" in ssb_frequency:
                                    try:
                                        # 提取范围的上下限
                                        lower, upper = ssb_frequency.split("-")
                                        lower_num = float(lower.strip())
                                        upper_num = float(upper.strip())
                                        # 检查范围是否与900-955有重叠
                                        if (lower_num <= 955 and upper_num >= 900):
                                            if 'gNodeBLength' in col_map:
                                                row[col_map['gNodeBLength'] - 1].value = 8
                                    except ValueError:
                                        # 如果范围解析失败，跳过
                                        pass
                                # 检查是否完全匹配 "900-955"
                                elif ssb_frequency == "900-955":
                                    if 'gNodeBLength' in col_map:
                                        row[col_map['gNodeBLength'] - 1].value = 8
        
        else:  # LTE网络
            # LTE网络处理
            # 4.1 生成CGI列
            for row in all_rows:
                enb_id = self._get_cell_val(row, col_map, 'eNodeB标识')
                cell_id = self._get_cell_val(row, col_map, '小区标识')
                if enb_id and cell_id:
                    cgi = f"{enb_id}-{cell_id}"
                    # 更新CGI列
                    if 'CGI' in col_map:
                        row[col_map['CGI'] - 1].value = cgi
            
            # 4.2 更新是否共享列（基于plmnIdList）
            for i, row in enumerate(all_rows):
                enb_id = self._get_cell_val(row, col_map, 'eNodeB标识')
                cell_id = self._get_cell_val(row, col_map, '小区标识')
                if enb_id and cell_id:
                    key = f"{enb_id}_{cell_id}"
                    if key in updates and 'plmnIdList' in updates[key]:
                        plmn_id_list = updates[key]['plmnIdList']
                        if '是否共享' in col_map:
                            if plmn_id_list and isinstance(plmn_id_list, str) and ';' in plmn_id_list:
                                row[col_map['是否共享'] - 1].value = "是"
                            else:
                                row[col_map['是否共享'] - 1].value = "否"
            
            # 4.3 更新第一分组列：在现网工参能找到的小区都填为"电信中兴"
            for i, row in enumerate(all_rows):
                enb_id = self._get_cell_val(row, col_map, 'eNodeB标识')
                cell_id = self._get_cell_val(row, col_map, '小区标识')
                if enb_id and cell_id:
                    key = f"{enb_id}_{cell_id}"
                    if key in updates:
                        if '第一分组' in col_map:
                            row[col_map['第一分组'] - 1].value = "电信中兴"
        
        safe_print(f"[DataService] 更新完成: 现有匹配 {len(existing_keys)} 行, 追加新行 {new_rows_count} 行")

    def _get_cell_val(self, row, col_map, col_name):
        """获取行中指定列的值"""
        if col_name in col_map:
            idx = col_map[col_name] - 1 # row is tuple, 0-based index
            val = row[idx].value
            if val is not None:
                return str(val).strip()
        return None

    def _apply_row_update(self, row, col_map, update_data, field_map, network_type: str):
        """应用更新到行"""
        # 先处理通用字段映射
        for src_field, target_col in field_map.items():
            if src_field in update_data and target_col in col_map:
                col_idx = col_map[target_col] - 1
                # 更新值
                val = update_data[src_field]

                # 检查是否为空值（处理numpy NaN、pandas NA、None等）
                if pd.isna(val) or val is None or (isinstance(val, float) and np.isnan(val)):
                    safe_print(f"[DataService] 字段 {src_field} 为空，跳过更新")
                    continue

                # 转换为Python原生类型（处理numpy类型）
                if hasattr(val, 'item'):  # numpy scalar
                    val = val.item()
                elif isinstance(val, str):
                    val = val.strip()

                row[col_idx].value = val

        # 特殊处理：NR coverageType 映射到小区覆盖类型
        # 只有NR网络类型才处理，且只在现网工参中有coverageType值时才更新
        # LTE网络不处理小区覆盖类型
        if network_type == "NR" and 'coverageType' in update_data:
            val = update_data['coverageType']

            # 调试日志
            safe_print(f"[DataService] NR小区: 发现coverageType字段，原始值={val}")

            # 检查是否为空值
            if not (pd.isna(val) or val is None or (isinstance(val, float) and np.isnan(val))):
                # 转换为字符串并去除空格
                val_str = str(val).strip()

                # coverageType: "Micro" -> 4 (室内), "Macro" -> 1 (室外)
                # 只有明确的Micro或Macro才更新，其他值不更新
                if val_str == 'Micro':
                    coverage_val = 4
                    possible_msg = f"[DataService] NR coverageType映射: Micro -> 小区覆盖类型=4"
                    safe_print(possible_msg)
                    # 如果Excel中有"小区覆盖类型"列，则更新
                    if '小区覆盖类型' in col_map:
                        col_idx = col_map['小区覆盖类型'] - 1
                        old_val = row[col_idx].value
                        row[col_idx].value = coverage_val
                        safe_print(f"[DataService] 已更新: 原值={old_val}, 新值={coverage_val}")
                    else:
                        safe_print(f"[DataService] 警告: Excel中没有'小区覆盖类型'列，无法更新")
                elif val_str == 'Macro':
                    coverage_val = 1
                    safe_print(f"[DataService] NR coverageType映射: Macro -> 小区覆盖类型=1")
                    # 如果Excel中有"小区覆盖类型"列，则更新
                    if '小区覆盖类型' in col_map:
                        col_idx = col_map['小区覆盖类型'] - 1
                        old_val = row[col_idx].value
                        row[col_idx].value = coverage_val
                        safe_print(f"[DataService] 已更新: 原值={old_val}, 新值={coverage_val}")
                    else:
                        safe_print(f"[DataService] 警告: Excel中没有'小区覆盖类型'列，无法更新")
                else:
                    # 未知值不更新（保持原值）
                    safe_print(f"[DataService] NR coverageType未知值: {val_str}，跳过更新小区覆盖类型")
            else:
                safe_print(f"[DataService] NR coverageType为空值，跳过更新")

        # 固定值更新
        # 系统制式固定值是1
        if '系统制式' in col_map:
             row[col_map['系统制式'] - 1].value = 1

    def _append_new_row(self, ws, col_map, data, field_map, network_type):
        """追加新行"""
        # 创建一个空行列表，长度为最大列索引
        max_col = max(col_map.values()) if col_map else 0
        new_row = [None] * max_col

        # 填充映射字段
        for src_field, target_col in field_map.items():
            if src_field in data and target_col in col_map:
                col_idx = col_map[target_col] - 1
                val = data[src_field]

                # 检查是否为空值
                if pd.isna(val) or val is None or (isinstance(val, float) and np.isnan(val)):
                    continue  # 跳过空值

                # 转换为Python原生类型（处理numpy类型）
                if hasattr(val, 'item'):  # numpy scalar
                    val = val.item()
                elif isinstance(val, str):
                    val = val.strip()

                new_row[col_idx] = val

        # 特殊处理：NR coverageType 映射到小区覆盖类型
        # 只有NR网络类型才处理，且只在现网工参中有coverageType值时才更新
        # LTE网络不处理小区覆盖类型
        # 注意：新行（不在现网工参中的小区）只有在现网工参中有明确coverageType值时才设置
        if network_type == "NR" and 'coverageType' in data:
            val = data['coverageType']

            # 调试日志
            safe_print(f"[DataService] NR新行: 发现coverageType字段，原始值={val}")

            # 检查是否为空值
            if not (pd.isna(val) or val is None or (isinstance(val, float) and np.isnan(val))):
                # 转换为字符串并去除空格
                val_str = str(val).strip()

                # coverageType: "Micro" -> 4 (室内), "Macro" -> 1 (室外)
                # 只有明确的Micro或Macro才设置，其他值不设置（保持默认或空）
                if val_str == 'Micro':
                    coverage_val = 4
                    safe_print(f"[DataService] NR新行 coverageType映射: Micro -> 小区覆盖类型=4")
                    # 如果Excel中有"小区覆盖类型"列，则设置
                    if '小区覆盖类型' in col_map:
                        col_idx = col_map['小区覆盖类型'] - 1
                        new_row[col_idx] = coverage_val
                        safe_print(f"[DataService] NR新行已设置: 小区覆盖类型={coverage_val}")
                    else:
                        safe_print(f"[DataService] NR新行警告: Excel中没有'小区覆盖类型'列")
                elif val_str == 'Macro':
                    coverage_val = 1
                    safe_print(f"[DataService] NR新行 coverageType映射: Macro -> 小区覆盖类型=1")
                    # 如果Excel中有"小区覆盖类型"列，则设置
                    if '小区覆盖类型' in col_map:
                        col_idx = col_map['小区覆盖类型'] - 1
                        new_row[col_idx] = coverage_val
                        safe_print(f"[DataService] NR新行已设置: 小区覆盖类型={coverage_val}")
                    else:
                        safe_print(f"[DataService] NR新行警告: Excel中没有'小区覆盖类型'列")
                else:
                    # 未知值不设置（保持Excel默认值或空）
                    safe_print(f"[DataService] NR新行 coverageType未知值: {val_str}，不设置小区覆盖类型")
            else:
                safe_print(f"[DataService] NR新行 coverageType为空值，不设置小区覆盖类型")

        # 填充固定字段
        if '系统制式' in col_map:
             new_row[col_map['系统制式'] - 1] = 1

        # 生成CGI列
        if 'CGI' in col_map:
            if network_type == "LTE":
                # LTE CGI: eNodeB标识-小区标识
                enb_id = data.get('eNBId')
                cell_id = data.get('cellLocalId')
                if enb_id and cell_id:
                    cgi = f"{enb_id}-{cell_id}"
                    new_row[col_map['CGI'] - 1] = cgi
            else:  # NR
                # NR CGI: gNodeB标识-小区标识
                gnb_id = data.get('gNBId')
                cell_id = data.get('cellLocalId')
                if gnb_id and cell_id:
                    cgi = f"{gnb_id}-{cell_id}"
                    new_row[col_map['CGI'] - 1] = cgi

        # 更新跟踪区码
        if '跟踪区码' in col_map:
            tac = data.get('tac')
            if tac is not None and not pd.isna(tac):
                # 转换为Python原生类型
                if hasattr(tac, 'item'):  # numpy scalar
                    tac = tac.item()
                elif isinstance(tac, str):
                    tac = tac.strip()
                new_row[col_map['跟踪区码'] - 1] = tac

        # 更新是否共享列
        if '是否共享' in col_map:
            if network_type == "LTE":
                # LTE: 基于plmnIdList判断
                plmn_id_list = data.get('plmnIdList')
                if plmn_id_list and isinstance(plmn_id_list, str) and ';' in plmn_id_list:
                    new_row[col_map['是否共享'] - 1] = "是"
                else:
                    new_row[col_map['是否共享'] - 1] = "否"
            else:  # NR
                # NR: 先设置默认值，后续会根据CGI出现次数更新
                new_row[col_map['是否共享'] - 1] = "否"

        # 将新行添加到工作表
        ws.append(new_row)

    def _load_current_params(self, current_dir: Path, network_type: str) -> Dict[str, Dict]:
        """读取现网工参CSV文件"""
        updates = {}

        if network_type == "LTE":
            patterns = ["LTE_SDR_CellInfo_*.csv", "LTE_ITBBU_CellInfo_*.csv"]
        else:
            patterns = ["NR_CellInfo_*.csv"]

        files = []
        for pat in patterns:
            files.extend(list(current_dir.glob(pat)))
            # Also try recursive if inside subfolders
            files.extend(list(current_dir.glob(f"**/{pat}")))

        try:
            safe_print(f"[DataService] 找到 {len(files)} 个CSV文件: {[f.name for f in files]}")
        except UnicodeEncodeError:
            # 如果文件名包含特殊字符，使用ASCII安全打印
            safe_names = [f.name.encode('ascii', 'replace').decode('ascii') for f in files]
            safe_print(f"[DataService] 找到 {len(files)} 个CSV文件: {safe_names}")

        for file_path in files:
            try:
                # 尝试不同的编码
                try:
                    df = pd.read_csv(file_path, encoding='gbk')
                except:
                    df = pd.read_csv(file_path, encoding='utf-8')

                # 标准化列名（去除空格）
                df.columns = [c.strip() for c in df.columns]

                # 调试：打印CSV列名（使用安全打印避免GBK编码错误）
                try:
                    safe_print(f"[DataService] CSV文件 {file_path.name} 的列名: {list(df.columns)}")
                except UnicodeEncodeError:
                    # 如果列名包含特殊字符，使用ASCII安全打印
                    safe_columns = [str(c).encode('ascii', 'replace').decode('ascii') for c in df.columns]
                    safe_print(f"[DataService] CSV文件 {file_path.name} 的列名: {safe_columns}")

                # 特别检查 coverageType 列
                if 'coverageType' in df.columns:
                    unique_values = df['coverageType'].dropna().unique()
                    try:
                        safe_print(f"[DataService] CSV文件 {file_path.name} 中 coverageType 的唯一值: {list(unique_values)}")
                    except UnicodeEncodeError:
                        # 如果值包含特殊字符，使用ASCII安全打印
                        safe_values = [str(v).encode('ascii', 'replace').decode('ascii') for v in unique_values]
                        safe_print(f"[DataService] CSV文件 {file_path.name} 中 coverageType 的唯一值: {safe_values}")
                else:
                    safe_print(f"[DataService] CSV文件 {file_path.name} 中没有 coverageType 列")

                for _, row in df.iterrows():
                    item = row.to_dict()

                    # 处理PLMN分解
                    if 'plmn' in item and pd.notna(item['plmn']):
                        plmn_parts = str(item['plmn']).split('-')
                        if len(plmn_parts) >= 2:
                            item['mcc'] = plmn_parts[0]
                            item['mnc'] = plmn_parts[1]
                        else:
                            item['mcc'] = ''
                            item['mnc'] = ''
                    else:
                        item['mcc'] = ''
                        item['mnc'] = ''

                    # 生成Key
                    key = None
                    if network_type == "LTE":
                        if 'eNBId' in item and 'cellLocalId' in item:
                            key = f"{item['eNBId']}_{item['cellLocalId']}"
                    else:
                        if all(k in item for k in ['mcc', 'mnc', 'gNBId', 'cellLocalId']):
                             key = f"{item['mcc']}_{item['mnc']}_{item['gNBId']}_{item['cellLocalId']}"

                    if key:
                        updates[key] = item

            except Exception as e:
                import traceback
                safe_print(f"[DataService] 读取CSV失败 {file_path.name}: {e}")
                traceback.print_exc()

        safe_print(f"[DataService] 总共加载 {len(updates)} 条 {network_type} 现网数据")
        return updates

    async def upload_excel(self, file, original_path: Optional[str] = None) -> Dict[str, str]:
        """上传Excel工参文件"""
        safe_print(f"[DataService] ===== 开始上传Excel文件 =====")
        safe_print(f"[DataService] 文件名: {file.filename}")
        safe_print(f"[DataService] 原始路径: {original_path}")
        
        # 生成唯一ID
        data_id = str(uuid.uuid4())
        safe_print(f"[DataService] 生成ID: {data_id}")

        # 清理文件名：移除或替换可能导致Windows路径问题的字符
        import re
        safe_filename = re.sub(r'[<>:"/\\|?*]', '_', file.filename)
        # 限制文件名长度（避免Windows路径长度限制）
        if len(safe_filename) > 100:
            name, ext = os.path.splitext(safe_filename)
            safe_filename = name[:90] + ext
        safe_print(f"[DataService] 安全文件名: {safe_filename}")

        # 保存文件 - 使用UUID避免中文文件名导致的路径问题
        file_path = settings.UPLOAD_DIR / f"{data_id}.xlsx"
        safe_print(f"[DataService] 目标路径: {file_path}")
        
        try:
            safe_print(f"[DataService] 读取文件内容...")
            content = await file.read()
            safe_print(f"[DataService] 已读取 {len(content):,} 字节")
            
            safe_print(f"[DataService] 保存到磁盘...")
            with open(file_path, 'wb') as f:
                f.write(content)
            safe_print(f"[DataService] 文件已保存")
            
            # 验证文件
            if file_path.exists():
                file_size = file_path.stat().st_size
                safe_print(f"[DataService] 文件验证成功，大小: {file_size:,} 字节")
            else:
                raise FileNotFoundError(f"文件保存失败: {file_path}")
                
        except Exception as e:
            safe_print(f"[DataService] 文件保存失败: {type(e).__name__}: {e}")
            raise ValueError(f"文件保存失败: {str(e)}")

        # 处理数据
        try:
            import json
            
            safe_print(f"[DataService] 开始解析Excel文件...")
            
            # 使用pandas.ExcelFile上下文管理器统一管理文件句柄
            # 这可以避免多次打开/关闭文件导致的Windows文件锁问题 (Errno 22)
            try:
                safe_print(f"[DataService] 打开Excel文件...")
                xls = pd.ExcelFile(file_path)
            except PermissionError as e:
                safe_print(f"[DataService] 权限错误: {e}")
                raise ValueError(f"文件被其他程序占用，请确保文件未被Excel打开: {str(e)}")
            except OSError as e:
                safe_print(f"[DataService] 系统错误 [Errno {e.errno}]: {e}")
                if e.errno == 22:
                    raise ValueError(f"无法打开文件 (Errno 22)。可能原因：1) 文件损坏 2) 文件被占用 3) 路径包含特殊字符")
                else:
                    raise ValueError(f"无法打开文件: {str(e)}")
            except Exception as e:
                safe_print(f"[DataService] 未知错误: {type(e).__name__}: {e}")
                raise ValueError(f"无法打开Excel文件: {str(e)}")
            
            try:
                with xls:
                    # 获取sheet名称
                    sheet_names = xls.sheet_names
                    try:
                        safe_print(f"[DataService] Excel文件包含的sheet: {sheet_names}")
                    except UnicodeEncodeError:
                        # 如果sheet名称包含特殊字符，使用ASCII安全打印
                        safe_sheet_names = [s.encode('ascii', 'replace').decode('ascii') for s in sheet_names]
                        safe_print(f"[DataService] Excel文件包含的sheet: {safe_sheet_names}")
        
                    # 判断文件类型
                    file_type = self._classify_file(file.filename, sheet_names)
                    safe_print(f"[DataService] 文件类型: {file_type}")

                    # === 单一实例逻辑 ===
                    # 如果是全量工参或待规划小区，先删除已存在的同类型文件
                    if file_type in ['full_params', 'target_cells']:
                        files_to_delete = []
                        for existing_id, existing_data in self.index.items():
                            # 检查fileType，如果没有fileType字段则忽略（或者是旧数据）
                            if existing_data.get('fileType') == file_type:
                                files_to_delete.append(existing_id)
                        
                        if files_to_delete:
                            safe_print(f"[DataService] 检测到已存在 {file_type} 文件 ({len(files_to_delete)} 个)，准备删除以保持唯一性...")
                            for data_id_to_delete in files_to_delete:
                                try:
                                    self.delete_data(data_id_to_delete)
                                    safe_print(f"[DataService] 已删除旧文件: {data_id_to_delete}")
                                except Exception as e:
                                    safe_print(f"[DataService] 删除旧文件失败: {e}")

                    # 根据文件类型解析数据
                    parsed_data = {}
                    metadata = {}

                    if file_type == "full_params":
                        # 全量工参文件 - 读取LTE和NR Project Parameters子表
                        for network in ['LTE', 'NR']:
                            sheet_name = f"{network} Project Parameters"
                            if sheet_name in sheet_names:
                                safe_print(f"[DataService] 解析 {sheet_name}...")
                                # 传入xls对象而不是路径
                                sites = self._parse_sheet_data(xls, sheet_name, network)
                                parsed_data[network] = sites
                                metadata[f"{network}SiteCount"] = len(sites)
                                metadata[f"{network}SectorCount"] = sum(len(s.get('sectors', [])) for s in sites)
                                safe_print(f"[DataService] {sheet_name} 解析完成: {len(sites)} 个基站")

                    elif file_type == "target_cells":
                        # 待规划小区文件 - 读取LTE和NR子表
                        for network in ['LTE', 'NR']:
                            if network in sheet_names:
                                safe_print(f"[DataService] 解析 {network}...")
                                # 传入xls对象而不是路径
                                sites = self._parse_sheet_data(xls, network, network)
                                parsed_data[network] = sites
                                metadata[f"{network}SiteCount"] = len(sites)
                                metadata[f"{network}SectorCount"] = sum(len(s.get('sectors', [])) for s in sites)
                                safe_print(f"[DataService] {network} 解析完成: {len(sites)} 个基站")
                    else:
                        # 普通工参文件 - 尝试默认解析
                        safe_print(f"[DataService] 使用默认解析...")
                        # 传入xls对象而不是路径
                        sites = self._parse_default_excel(xls)
                        parsed_data['default'] = sites
                        metadata['siteCount'] = len(sites)
                        metadata['sectorCount'] = sum(len(s.get('sectors', [])) for s in sites)
                        safe_print(f"[DataService] 默认解析完成: {len(sites)} 个基站")

            finally:
                # 确保关闭文件句柄
                # 注意：如果是在with块中，一般会自动关闭，但这里我们显式处理以防万一
                pass
                
        except Exception as e:
            # 清理失败的文件
            safe_print(f"[DataService] ===== 上传失败 =====")
            safe_print(f"[DataService] 错误类型: {type(e).__name__}")
            safe_print(f"[DataService] 错误信息: {str(e)}")
            # 只有在是在这个函数里创建的临时文件才清理，但这里文件已经被保存到uploads了
            # 如果是上传过程中的临时文件，FastAPI会处理
            import traceback
            traceback.print_exc()
            raise ValueError(f"Excel文件解析失败: {str(e)}")

        # 保存处理后的数据
        # 注意：之前的代码结构有点问题，保存逻辑应该在解析成功之后，且需要在xls关闭之后（如果是在Windows上移动文件的话）
        # 但这里我们是读取内容，所以xls关闭后数据都在parsed_data里了
        
        safe_print(f"[DataService] 保存解析结果...")
        data_dir = settings.DATA_DIR / data_id
        data_dir.mkdir(parents=True, exist_ok=True)

        # 保存原始文件 - 此时file_path是uploads下的文件，xls已经关闭，应该可以复制
        try:
            shutil.copy(file_path, data_dir / "original.xlsx")
            safe_print(f"[DataService] 原始文件已保存")
        except Exception as e:
            safe_print(f"[DataService] 保存原始文件失败: {e}")
            # 继续保存JSON

        # 保存解析后的数据
        with open(data_dir / "data.json", 'w', encoding='utf-8') as f:
            json.dump(parsed_data, f, ensure_ascii=False, indent=2)
        safe_print(f"[DataService] 数据已保存到 data.json")

        # 更新索引
        self.index[data_id] = {
            "id": data_id,
            "name": file.filename,
            "type": "excel",
            "fileType": file_type,
            "size": file_path.stat().st_size,
            "originalPath": original_path,
            "uploadDate": datetime.now().isoformat(),
            "status": "ready",
            "metadata": metadata
        }
        self._save_index()
        safe_print(f"[DataService] 索引已更新")

        safe_print(f"[DataService] ===== 上传成功 =====")
        return {
            "id": data_id,
            "name": file.filename,
            "status": "ready",
            "fileType": file_type
        }

    def _classify_file(self, filename: str, sheet_names: list) -> str:
        """根据文件名和sheet名称分类文件类型"""
        filename_lower = filename.lower()

        # 待规划小区文件特征 - 必须以"cell-tree-export"开头
        if filename_lower.startswith('cell-tree-export'):
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

        safe_print(f"[DataService] 正在解析sheet: {sheet_name} ({network_type})")

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
            safe_print(f"[DataService] 检测到全量工参文件，使用专用解析逻辑")
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
                 safe_print(f"[DataService] 检测到待规划小区文件格式，使用专用解析逻辑")
                 return self._parse_target_cells_sheet(excel_file, sheet_name, network_type)
                 
        except Exception as e:
            safe_print(f"[DataService] 预检查失败: {e}")

        # 尝试不同的解析方式
        df = None

        # 方式1: 跳过前3行
        try:
            df = pd.read_excel(excel_file, sheet_name=sheet_name, header=3)
            # 简单验证一下是否有效
            if len(df.columns) > 1:
                safe_print(f"[DataService] 使用header=3解析成功，共 {len(df)} 行")
            else:
                df = None
        except Exception as e:
            safe_print(f"[DataService] header=3解析失败: {e}")

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
            try:
                print(f"[DataService] 列名: {column_preview}...")
            except UnicodeEncodeError:
                # 如果列名包含特殊字符，使用ASCII安全打印
                safe_preview = [str(c).encode('ascii', 'replace').decode('ascii') for c in column_preview]
                print(f"[DataService] 列名: {safe_preview}...")

            # 使用专门的解析方法处理全量工参数据
            return self._parse_full_params_dataframe(df, network_type)

        except Exception as e:
            print(f"[DataService] 解析全量工参sheet失败: {sheet_name}, 错误: {e}")
            raise ValueError(f"解析工参表 {sheet_name} 失败: {str(e)}")

    def _parse_full_params_dataframe(self, df: pd.DataFrame, network_type: str) -> List[Dict]:
        """解析全量工参DataFrame为站点数据

        使用唯一键进行小区去重:
        - LTE: eNodeB标识 + 小区标识
        - NR: 移动国家码 + 移动网络码 + gNodeB标识 + 小区标识
        """
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
                'is_shared': ['是否共享'],
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
                'tac': ['跟踪区码', 'TAC'],
                'cell_cover_type': ['小区覆盖类型'],
                'is_shared': ['是否共享'],
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
        print(f"[DataService] {network_type}] 开始列名匹配，可用列: {list(df.columns)}")
        for key, possible_names in required_columns.items():
            found_col = find_column(df.columns, possible_names)
            if found_col is not None:
                mapped_columns[key] = found_col
                # 特别关注小区覆盖类型和是否共享列的映射
                if key in ['cell_cover_type', 'is_shared']:
                    try:
                        print(f"[DataService] {network_type}] 列名映射: {key} -> {found_col}")
                    except UnicodeEncodeError:
                        safe_col = str(found_col).encode('ascii', 'replace').decode('ascii')
                        print(f"[DataService] {network_type}] 列名映射: {key} -> {safe_col}")
            else:
                if key == 'cell_cover_type':
                    print(f"[DataService] {network_type}] 警告: 未找到列 {key}，尝试匹配: {possible_names}")
                # 只对必需字段输出警告
                if key in ['site_id', 'longitude', 'latitude', 'sector_id']:
                    print(f"[DataService] 警告: 未找到列 {key}，尝试匹配: {possible_names}")
        
        print(f"[DataService] {network_type}] 最终映射结果: {mapped_columns}")

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

                # 移除经纬度为0的过滤条件 - 只使用唯一键去重统计小区数

                # 创建或获取站点（使用字典存储sectors，以唯一键为key实现去重）
                if site_id not in sites:
                    sites[site_id] = {
                        "id": site_id,
                        "name": site_name,
                        "longitude": longitude,
                        "latitude": latitude,
                        "networkType": network_type,
                        "sectors": {}  # 改为字典，key为唯一键，value为sector对象
                    }

                # 提取小区信息
                sector_id_raw = row.get(mapped_columns['sector_id'])
                if pd.notna(sector_id_raw):
                    try:
                        sector_id = str(int(float(sector_id_raw)))
                    except:
                        sector_id = str(sector_id_raw).strip()
                else:
                    # 获取当前sectors字典的大小作为默认ID
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
                            # PCI值范围是0-503，包括0
                            sector['pci'] = pci_val
                        except Exception as e:
                            print(f"[DataService] 解析PCI失败: {pci_raw}, 错误: {e}")
                            sector['pci'] = str(pci_raw).strip()
                # 确保pci字段始终存在，即使值为None
                if 'pci' not in sector:
                    sector['pci'] = None

                # 可选字段：是否共享
                if 'is_shared' in mapped_columns:
                    is_shared_raw = row.get(mapped_columns['is_shared'])
                    if pd.notna(is_shared_raw):
                        sector['is_shared'] = str(is_shared_raw).strip()
                # 确保is_shared字段始终存在，即使值为None
                if 'is_shared' not in sector:
                    sector['is_shared'] = None

                # 可选字段：TAC（跟踪区码）
                if 'tac' in mapped_columns:
                    tac_raw = row.get(mapped_columns['tac'])
                    if pd.notna(tac_raw):
                        try:
                            # 尝试直接转换为整数
                            if isinstance(tac_raw, (int, float)):
                                tac_val = int(tac_raw)
                            else:
                                # 尝试从字符串转换
                                tac_val = int(float(str(tac_raw).strip()))
                            sector['tac'] = tac_val
                        except Exception as e:
                            # 记录错误并继续，使用原始值
                            print(f"[DataService] 解析TAC失败: {tac_raw}, 错误: {e}")
                            sector['tac'] = str(tac_raw).strip()
                # 确保tac字段始终存在，即使值为None
                if 'tac' not in sector:
                    sector['tac'] = None

                # 可选字段：EARFCN（LTE）或SSB频点（NR），并添加统一的下行频点字段
                if network_type == "LTE" and 'earfcn' in mapped_columns:
                    earfcn_raw = row.get(mapped_columns['earfcn'])
                    if pd.notna(earfcn_raw):
                        try:
                            earfcn_val = float(earfcn_raw)
                            sector['earfcn'] = earfcn_val
                            sector['frequency'] = earfcn_val  # 添加统一的下行频点字段
                        except Exception as e:
                            print(f"[DataService] 解析LTE频点失败: {earfcn_raw}, 错误: {e}")
                            # 使用原始值
                            sector['earfcn'] = str(earfcn_raw).strip()
                            sector['frequency'] = str(earfcn_raw).strip()
                elif network_type == "NR" and 'ssb_frequency' in mapped_columns:
                    ssb_raw = row.get(mapped_columns['ssb_frequency'])
                    if pd.notna(ssb_raw):
                        try:
                            ssb_val = float(ssb_raw)
                            sector['ssb_frequency'] = ssb_val
                            sector['frequency'] = ssb_val  # 添加统一的下行频点字段
                        except Exception as e:
                            # 处理字符串格式的SSB频点，如"900-955"
                            print(f"[DataService] 解析NR SSB频点失败: {ssb_raw}, 错误: {e}")
                            ssb_str = str(ssb_raw).strip()
                            sector['ssb_frequency'] = ssb_str
                            sector['frequency'] = ssb_str  # 添加统一的下行频点字段
                # 确保frequency字段始终存在，即使值为None
                if 'frequency' not in sector:
                    sector['frequency'] = None

                # 可选字段：小区覆盖类型
                # 1=室外小区（扇形，半径60米，夹角40度，按方向角绘制）
                # 4=室内小区（圆形，半径30米，不考虑方向角）
                if 'cell_cover_type' in mapped_columns:
                    cover_type_raw = row.get(mapped_columns['cell_cover_type'])
                    if pd.notna(cover_type_raw):
                        try:
                            cover_type_val = int(float(cover_type_raw))
                            sector['cell_cover_type'] = cover_type_val
                            # 调试日志：记录室内小区
                            if cover_type_val == 4 and network_type == "NR":
                                print(f"[DataService] NR室内小区: {sector.get('sector_name')} cell_cover_type=4")
                        except:
                            # 默认为室外小区
                            sector['cell_cover_type'] = 1
                    else:
                        sector['cell_cover_type'] = 1  # 默认室外
                else:
                    sector['cell_cover_type'] = 1  # 默认室外
                    if network_type == "NR":
                        print(f"[DataService] NR未找到小区覆盖类型列，使用默认值1: {sector.get('sector_name')}")
                
                # 生成小区唯一键用于去重
                # LTE: site_id + sector_id
                # NR: mcc + mnc + site_id + sector_id
                if network_type == "LTE":
                    sector_unique_key = f"{site_id}_{sector_id}"
                else:  # NR
                    # 尝试获取MCC和MNC
                    mcc = ""
                    mnc = ""
                    if 'mcc' in mapped_columns:
                        mcc_raw = row.get(mapped_columns['mcc'])
                        if pd.notna(mcc_raw):
                            mcc = str(mcc_raw).strip()
                            sector['mcc'] = mcc  # 添加到sector对象
                    if 'mnc' in mapped_columns:
                        mnc_raw = row.get(mapped_columns['mnc'])
                        if pd.notna(mnc_raw):
                            mnc = str(mnc_raw).strip()
                            sector['mnc'] = mnc  # 添加到sector对象
                    sector_unique_key = f"{mcc}_{mnc}_{site_id}_{sector_id}"

                # 使用唯一键存储sector，自动去重（后面的数据覆盖前面的）
                sites[site_id]['sectors'][sector_unique_key] = sector
                parsed_count += 1

            except Exception as e:
                print(f"[DataService] 解析第{idx}行数据失败: {e}")
                skipped_count += 1
                continue

        # 将sectors字典转换为列表，保持向后兼容
        result = []
        unique_sector_count = 0
        for site_data in sites.values():
            # 将sectors从字典转换为列表
            site_data['sectors'] = list(site_data['sectors'].values())
            result.append(site_data)
            unique_sector_count += len(site_data['sectors'])

        print(f"\n[DataService] ===== 全量工参解析完成 =====")
        print(f"  共解析: {len(result)} 个基站")
        print(f"  唯一小区数: {unique_sector_count} 个 (去重后)")
        print(f"  处理总行数: {parsed_count} 行")
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
        try:
            print(f"[DataService] 所有列名: {list(df.columns)}")
        except UnicodeEncodeError:
            # 如果列名包含特殊字符，使用ASCII安全打印
            safe_columns = [str(c).encode('ascii', 'replace').decode('ascii') for c in df.columns]
            print(f"[DataService] 所有列名: {safe_columns}")

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

    async def upload_map(self, file, original_path: Optional[str] = None) -> Dict[str, str]:
        """上传地图文件（支持 MapInfo 图层文件）"""
        data_id = str(uuid.uuid4())

        # 保存文件 - 使用UUID避免中文文件名导致的路径问题
        ext = os.path.splitext(file.filename)[1]
        file_path = settings.UPLOAD_DIR / f"{data_id}{ext}"
        with open(file_path, 'wb') as f:
            content = await file.read()
            f.write(content)

        # 创建数据目录
        data_dir = settings.DATA_DIR / data_id
        data_dir.mkdir(parents=True, exist_ok=True)

        # 检测文件类型
        is_mapinfo = file.filename.lower().endswith(('.mif', '.tab', '.dat'))
        is_zip = file.filename.lower().endswith('.zip')

        # 处理 ZIP 文件（离线地图或 MapInfo 包）
        if is_zip:
            import zipfile
            with zipfile.ZipFile(file_path, 'r') as zip_ref:
                zip_ref.extractall(data_dir)

            # 检查解压后的文件是否为 MapInfo
            extracted_files = list(data_dir.glob('*'))
            has_mapinfo = any(f.suffix.lower() in ['.mif', '.tab'] for f in extracted_files if f.is_file())

            if has_mapinfo:
                # 解析 MapInfo 图层
                from app.services.mapinfo_service import parse_mapinfo_files
                layers = parse_mapinfo_files(data_dir)

                # 保存图层元数据
                import json
                with open(data_dir / "layers.json", 'w', encoding='utf-8') as f:
                    json.dump(layers, f, ensure_ascii=False, indent=2)

                print(f"[DataService] 解析到 {len(layers)} 个 MapInfo 图层")
                for layer in layers:
                    print(f"  - {layer['name']} ({layer['type']}): {layer['feature_count']} 个要素")

                # 更新索引
                self.index[data_id] = {
                    "id": data_id,
                    "name": file.filename,
                    "type": "map",
                    "subType": "mapinfo",  # 标记为 MapInfo 图层文件
                    "size": file_path.stat().st_size,
                    "originalPath": original_path,
                    "uploadDate": datetime.now().isoformat(),
                    "status": "ready",
                    "metadata": {
                        "fileCount": len(extracted_files),
                        "layerCount": len(layers),
                        "layers": layers
                    }
                }
            else:
                # 普通离线地图文件
                self.index[data_id] = {
                    "id": data_id,
                    "name": file.filename,
                    "type": "map",
                    "subType": "offline",  # 标记为离线地图
                    "size": file_path.stat().st_size,
                    "originalPath": original_path,
                    "uploadDate": datetime.now().isoformat(),
                    "status": "ready",
                    "metadata": {
                        "fileCount": len(extracted_files)
                    }
                }

        # 处理单个 MapInfo 文件
        elif is_mapinfo:
            # 复制文件到数据目录
            target_file = data_dir / file.filename
            shutil.copy(file_path, target_file)

            # 解析 MapInfo 图层
            from app.services.mapinfo_service import parse_mapinfo_files
            layers = parse_mapinfo_files(target_file)

            # 保存图层元数据
            import json
            with open(data_dir / "layers.json", 'w', encoding='utf-8') as f:
                json.dump(layers, f, ensure_ascii=False, indent=2)

            print(f"[DataService] 解析到 {len(layers)} 个 MapInfo 图层")

            # 更新索引
            self.index[data_id] = {
                "id": data_id,
                "name": file.filename,
                "type": "map",
                "subType": "mapinfo",
                "size": file_path.stat().st_size,
                "originalPath": original_path,
                "uploadDate": datetime.now().isoformat(),
                "status": "ready",
                "metadata": {
                    "fileCount": 1,
                    "layerCount": len(layers),
                    "layers": layers
                }
            }
        else:
            # 其他地图文件
            self.index[data_id] = {
                "id": data_id,
                "name": file.filename,
                "type": "map",
                "subType": "other",
                "size": file_path.stat().st_size,
                "originalPath": original_path,
                "uploadDate": datetime.now().isoformat(),
                "status": "ready",
                "metadata": {
                    "fileCount": 1
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
            try:
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
                # 确保必填字段存在
                if 'size' not in data_copy:
                    data_copy['size'] = 0
                if 'uploadDate' not in data_copy:
                    data_copy['uploadDate'] = datetime.now().isoformat()
                # 创建DataItem实例
                item = DataItem(**data_copy)
                items.append(item)
            except Exception as e:
                safe_print(f"[DataService] 创建DataItem失败 (id={data_id}): {e}")
                import traceback
                traceback.print_exc()
                # 跳过无效数据项，继续处理其他项
                continue
        safe_print(f"[DataService] list_data返回 {len(items)} 个数据项")
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
