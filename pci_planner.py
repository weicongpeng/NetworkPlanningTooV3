import pandas as pd
import numpy as np
import time
from typing import Generator, Dict, Any, List
from .utils import GeoUtils, DataFrameUtils

class PCIPlanningService:
    def __init__(self, reuse_distance: float = 3.0, 
                 lte_mod3: bool = False, nr_mod30: bool = False):
        self.reuse_distance = reuse_distance
        self.lte_mod3 = lte_mod3
        self.nr_mod30 = nr_mod30
        
        # 缓存优化
        self._distance_cache = {}
        self._same_site_cache = {}

    def run_planning(self, plan_df: pd.DataFrame, param_df: pd.DataFrame, 
                     network_type: str, pci_range: list = None) -> Generator[Dict[str, Any], None, pd.DataFrame]:
        """
        执行PCI规划 (生成器模式，用于前端进度条)
        Yields:
            Dict: 进度信息 {'progress': int, 'message': str}
        Returns:
            pd.DataFrame: 规划结果 (通过 yield 的最后一个值或副作用获取不太方便，建议全量计算完返回，
                          或者通过 yield 返回最终结果)
        """
        # 1. 数据预处理
        yield {'progress': 5, 'message': '正在预处理数据...'}
        plan_df = DataFrameUtils.normalize_columns(plan_df, network_type)
        param_df = DataFrameUtils.normalize_columns(param_df, network_type)
        
        # 清洗无效数据
        param_df = param_df.dropna(subset=['enodeb_id', 'cell_id', 'lat', 'lon'])
        
        # 设置默认 PCI 范围
        if not pci_range:
            pci_range = range(0, 504) if network_type == 'LTE' else range(0, 1008)
        
        mod_value = 3 if network_type == 'LTE' else 30
        inherit_mod = self.lte_mod3 if network_type == 'LTE' else self.nr_mod30
        
        total_cells = len(plan_df)
        results = []

        # 2. 预构建索引 (基站ID -> 行索引) 加速查找
        # 实际使用中，如果param_df很大，建议使用KDTree进行空间索引
        
        for idx, row in plan_df.iterrows():
            if idx % 10 == 0:
                progress = 10 + int((idx / total_cells) * 80)
                yield {'progress': progress, 'message': f'正在规划第 {idx+1}/{total_cells} 个小区'}

            # 获取待规划小区详情（从全量工参中补全经纬度）
            target_info = param_df[
                (param_df['enodeb_id'] == row['enodeb_id']) & 
                (param_df['cell_id'] == row['cell_id'])
            ]
            
            if target_info.empty:
                results.append({**row.to_dict(), 'new_pci': -1, 'reason': '未在工参中找到'})
                continue
                
            target_cell = target_info.iloc[0]
            lat, lon = target_cell['lat'], target_cell['lon']
            earfcn = target_cell.get('earfcn_dl', 0)
            orig_pci = target_cell.get('pci', -1)
            
            # 3. 核心算法：寻找可用 PCI
            best_pci, reason, min_dist = self._find_best_pci(
                lat, lon, earfcn, orig_pci, 
                param_df, pci_range, 
                mod_value, inherit_mod, network_type,
                target_cell['enodeb_id'], target_cell['cell_id']
            )
            
            # 更新全量工参中的PCI (模拟分配，防止后续规划冲突)
            # 注意：这里修改的是内存中的副本，不影响文件
            if best_pci != -1:
                param_df.loc[target_info.index, 'pci'] = best_pci
                
            res_row = row.to_dict()
            res_row.update({
                '原PCI': orig_pci,
                '分配的PCI': best_pci,
                '分配原因': reason,
                '最小复用距离': round(min_dist, 2) if min_dist != float('inf') else '无复用'
            })
            results.append(res_row)

        yield {'progress': 100, 'message': '规划完成'}
        return pd.DataFrame(results)

    def _find_best_pci(self, lat, lon, earfcn, orig_pci, all_cells, 
                       candidate_range, mod_val, inherit_mod, net_type,
                       exclude_enb, exclude_cell):
        """核心PCI选择逻辑"""
        
        # 1. 确定候选列表
        if inherit_mod and pd.notna(orig_pci) and orig_pci != -1:
            target_mod = int(orig_pci) % mod_val
            candidates = [p for p in candidate_range if p % mod_val == target_mod]
        else:
            candidates = list(candidate_range)
            
        # 2. 获取同站小区 (用于模值冲突检查)
        # 简单逻辑：距离 < 50米 视为同站
        # 优化：可以使用预计算的缓存
        same_site_mask = (np.abs(all_cells['lat'] - lat) < 0.0005) & \
                         (np.abs(all_cells['lon'] - lon) < 0.0005)
        same_site_cells = all_cells[same_site_mask]
        
        used_mods = set()
        for _, cell in same_site_cells.iterrows():
            if cell['enodeb_id'] == exclude_enb and cell['cell_id'] == exclude_cell:
                continue # 跳过自己
            if pd.notna(cell['pci']):
                used_mods.add(int(cell['pci']) % mod_val)

        # 3. 获取同频小区 (用于复用距离检查)
        co_freq_cells = all_cells[all_cells['earfcn_dl'] == earfcn].copy()
        # 计算距离 (向量化)
        if not co_freq_cells.empty:
            dists = GeoUtils.calculate_distances_vectorized(
                lat, lon, co_freq_cells['lat'].values, co_freq_cells['lon'].values
            )
            co_freq_cells['dist'] = dists
        else:
            co_freq_cells['dist'] = []

        valid_pcis = []
        
        # 4. 评分筛选
        for pci in candidates:
            # 规则A: 模值冲突 (最高优先级)
            # LTE: 必须模3错开; NR: 如果开启双模约束需检查
            current_mod = pci % mod_val
            if current_mod in used_mods:
                continue # 同站模冲突，跳过
            
            # 规则B: 复用距离
            # 找到同频且同PCI的最近小区
            same_pci_cells = co_freq_cells[co_freq_cells['pci'] == pci]
            
            if same_pci_cells.empty:
                min_dist = float('inf')
            else:
                # 排除自己 (如果是重规划)
                mask = ~((same_pci_cells['enodeb_id'] == exclude_enb) & 
                         (same_pci_cells['cell_id'] == exclude_cell))
                others = same_pci_cells[mask]
                if others.empty:
                    min_dist = float('inf')
                else:
                    min_dist = others['dist'].min()
            
            if min_dist < self.reuse_distance:
                continue # 复用距离不足
            
            valid_pcis.append((pci, min_dist))
            
        # 5. 返回结果
        if not valid_pcis:
            return -1, "无可用PCI(复用/模冲突)", 0.0
            
        # 排序策略: 复用距离越大越好 (或者接近复用距离阈值以节省资源，这里选最大的)
        valid_pcis.sort(key=lambda x: x[1], reverse=True)
        
        best_pci, dist = valid_pcis[0]
        return best_pci, "满足规则", dist