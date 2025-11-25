import math
from typing import List, Dict

Cell = Dict[str, any]  # 小区字典，键包括cell_id、sX、sY、az、Co

def plan_neighbors(
    cells: List[Cell],
    k: float = 5/9,       # 站点到覆盖圆心的距离系数（如图中的5/9）
    m: float = 5/9,       # 覆盖半径系数（如图中的5/9）
    max_neighbors: int = 32  # 每个小区的最大邻区数量
) -> Dict[str, List[str]]:
    """
    基于覆盖圆算法的邻区规划函数。
    
    参数：
        cells: 小区列表（每个元素为小区字典）。
        k: 站点到覆盖圆心的距离系数（d = k*Co）。
        m: 覆盖半径系数（Rs = m*Co）。
        max_neighbors: 每个小区的最大邻区数量。
    
    返回：
        邻区关系字典（键：小区ID；值：邻区ID列表）。
    """
    # 初始化邻区字典（键：小区ID，值：邻区ID列表）
    neighbor_dict = {cell["cell_id"]: [] for cell in cells}
    
    # 遍历每个服务小区（计算其邻区）
    for s_cell in cells:
        s_id = s_cell["cell_id"]
        s_x = s_cell["sX"]
        s_y = s_cell["sY"]
        s_az = s_cell["az"]
        s_co = s_cell["Co"]
        
        # ----------------------
        # 1. 计算服务小区的覆盖圆参数
        # ----------------------
        # 站点到覆盖圆心的距离（d = k*Co）
        d_s = k * s_co
        # 方位角转换为弧度（用于计算圆心坐标）
        s_az_rad = math.radians(s_az)
        # 覆盖圆心坐标（平面坐标）：位于主瓣方向，距离站点d_s
        c_sx = s_x + d_s * math.sin(s_az_rad)  # sin(az)：X轴分量（正东方向）
        c_sy = s_y + d_s * math.cos(s_az_rad)  # cos(az)：Y轴分量（正北方向）
        # 覆盖半径（Rs = m*Co）
        r_s = m * s_co
        
        # ----------------------
        # 2. 遍历候选邻区（计算是否满足条件）
        # ----------------------
        candidates = []  # 候选邻区列表（元素：(邻区ID, 圆心距离)）
        
        for n_cell in cells:
            n_id = n_cell["cell_id"]
            # 排除自身（不能将自己设为邻区）
            if n_id == s_id:
                continue
            
            # 计算候选邻区的覆盖圆参数
            n_x = n_cell["sX"]
            n_y = n_cell["sY"]
            n_az = n_cell["az"]
            n_co = n_cell["Co"]
            
            d_n = k * n_co  # 邻区站点到其覆盖圆心的距离
            n_az_rad = math.radians(n_az)  # 邻区方位角（弧度）
            # 邻区覆盖圆心坐标
            c_nx = n_x + d_n * math.sin(n_az_rad)
            c_ny = n_y + d_n * math.cos(n_az_rad)
            # 邻区覆盖半径
            r_n = m * n_co
            
            # ----------------------
            # 3. 判断是否满足邻区条件
            # ----------------------
            # 条件1：覆盖圆相交（圆心距离 ≤ 两圆半径之和）
            dc = math.hypot(c_sx - c_nx, c_sy - c_ny)  # 平面坐标下的欧几里得距离
            if dc <= r_s + r_n:
                candidates.append((n_id, dc))  # 加入候选列表（记录距离，用于排序）
            
            # 条件2：共站小区（强制加入邻区，即使覆盖圆不相交）
            # 判断标准：站点坐标相同（sX、sY误差≤1米）
            if math.isclose(n_x, s_x, abs_tol=1e-3) and math.isclose(n_y, s_y, abs_tol=1e-3):
                # 避免重复添加（如已通过条件1加入）
                if n_id not in [cid for cid, _ in candidates]:
                    candidates.append((n_id, 0.0))  # 共站小区距离设为0，优先排序
        
        # ----------------------
        # 4. 筛选邻区（按距离从小到大排序，取前max_neighbors个）
        # ----------------------
        # 按圆心距离从小到大排序（距离越近，邻区优先级越高）
        candidates.sort(key=lambda x: x[1])
        # 取前max_neighbors个邻区（避免邻区数量过多）
        selected_neighbors = [cid for cid, _ in candidates[:max_neighbors]]
        
        # 更新邻区字典（服务小区的邻区列表）
        neighbor_dict[s_id] = selected_neighbors
    
    # ----------------------
    # 5. 处理邻区双向性（可选，邻区关系通常是双向的）
    # ----------------------
    # 例如：若cell_2是cell_1的邻区，则cell_1也应是cell_2的邻区
    # 此处为简化，未处理双向性，可根据需要添加
    # for s_id in neighbor_dict:
    #     for n_id in neighbor_dict[s_id]:
    #         if s_id not in neighbor_dict[n_id]:
    #             neighbor_dict[n_id].append(s_id)
    
    return neighbor_dict

cells = [
    {
        "cell_id": "cell_1",
        "sX": 0,      # 站点X坐标（米）
        "sY": 0,      # 站点Y坐标（米）
        "az": 90,     # 方位角（正东，90度）
        "Co": 1000    # 正向覆盖距离（米）
    },
    {
        "cell_id": "cell_2",
        "sX": 2000,   # 站点X坐标（米）
        "sY": 0,      # 站点Y坐标（米）
        "az": 270,    # 方位角（正西，270度）
        "Co": 1000    # 正向覆盖距离（米）
    },
    {
        "cell_id": "cell_3",
        "sX": 0,      # 站点X坐标（米）
        "sY": 2000,   # 站点Y坐标（米）
        "az": 0,      # 方位角（正北，0度）
        "Co": 1000    # 正向覆盖距离（米）
    }
]

# 调用函数（使用默认参数：k=5/9，m=5/9，max_neighbors=32）
neighbor_dict = plan_neighbors(cells)

# 打印结果
for cell_id, neighbors in neighbor_dict.items():
    print(f"小区 {cell_id} 的邻区列表：{neighbors}")