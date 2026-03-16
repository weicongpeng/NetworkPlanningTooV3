# PCI规划功能修复计划

## 问题概述

用户报告PCI规划功能存在以下三个问题：

1. **复用距离参数无效**：无论前端设置"复用距离(km)"为1km还是10km，输出结果的"最小复用距离(km)"完全一样
2. **复用距离计算错误**：PCI规划结果的"最小复用距离(km)"按相同网络类型下的所有频点小区合并计算，而不是按相同频点计算
3. **分配原因逻辑不匹配**："分配原因"列没有准确说明是否满足用户设置的复用距离约束

## 问题分析

### 问题1：复用距离参数无效

**根本原因**：前端正确传递了`distanceThreshold`参数，后端也正确使用了该参数，但用户的期望存在误解。

**详细分析**：
- 前端`PCIPage.tsx` line 148-154：正确发送`distanceThreshold`到`/api/v1/pci/plan`
- 后端`pci.py` line 19：`create_pci_task`接收`PCIConfig`，其中包含`distanceThreshold`
- 后端`task_manager.py` line 173-179：正确将`distanceThreshold`转换为`distance_threshold`并传递给V2算法
- V2算法`pci_planning_service_v2.py` line 346：正确使用`self.config.distance_threshold`
- V2算法`pci_planning_service_v2.py` line 346-359：使用距离阈值策略`[self.config.distance_threshold, 2.0, 1.0]`

**为什么输出结果一样？**
- `distance_threshold`的作用是**筛选**满足距离>=阈值条件的PCI，而不是改变计算出的距离值
- 当所有小区的频点相同且分布不变时，无论设置阈值为1km还是10km，计算出的最小复用距离值都是相同的
- 但满足条件的PCI集合会不同：1km阈值筛选出的PCI比10km阈值筛选出的PCI更多

**实际状态**：参数传递和算法逻辑都是正确的，但需要让用户更清楚地看到参数的作用。

### 问题2：复用距离计算错误

**根本原因**：V2算法在计算复用距离时，频点过滤逻辑不完善，导致不同频点的小区也被计算在内。

**详细分析**：

1. **PCI分配时的验证**（`validate_pci_reuse_distance`方法，line 204-249）：
   ```python
   # 只检查同频小区
   if target_earfcn is not None and earfcn is not None:
       if abs(target_earfcn - earfcn) > 0.1:  # 频点不同
           continue
   ```
   - **问题**：当`target_earfcn`或`earfcn`为`None`时，不进行频点过滤
   - **结果**：如果数据中频点字段缺失或为None，所有小区都被视为同频，导致不同频点的小区也被计算距离

2. **最终核查时的计算**（line 940-1005）：
   ```python
   # 检查是否同频(处理earfcn为None的情况)
   cell_earfcn = cell.get("earfcn")
   other_earfcn = other_cell.get("earfcn")
   
   # 如果两者都有earfcn值,检查是否同频
   if cell_earfcn is not None and other_earfcn is not None:
       if abs(cell_earfcn - other_earfcn) >= 0.1:
           continue  # 不同频,跳过
   ```
   - **问题**：同样的逻辑，当earfcn为None时，不进行频点过滤
   - **结果**：复用距离计算包含不同频点的小区

**用户报告的具体场景**：
- 小区"GO_N78_河源龙川_粮仓AAU2"（频点N78）分配了PCI=394
- 该小区的最小复用距离是0.931km
- 但这个距离是与小区"GO_N5_河源龙川_第三小学RRU3"（频点N5）计算出来的
- **问题**：N78和N5是不同的频点，不应该计算它们之间的复用距离

**正确的逻辑**：
- PCI复用距离应该只计算**相同频点**（相同频段）的小区之间的距离
- 例如：N78小区的PCI复用距离应该只与其他N78小区计算，不应与N5、N41等其他频点小区计算

### 问题3：分配原因逻辑不匹配

**根本原因**：V2算法生成的"分配原因"字符串没有明确区分是否满足原始距离约束。

**详细分析**：

1. **PCI分配时的原因生成**（`assign_pci`方法，line 374-384）：
   ```python
   if threshold_idx == 0:
       # 第一轮：满足原始约束
       reason = f"[OK] 满足原始约束 (距离={min_distance:.2f}km >= {original_threshold:.1f}km)"
   else:
       # 后续轮次：放宽了约束
       constraint_status = (
           "[OK]"
           if min_distance >= original_threshold
           else "[VIOLATION]"
       )
       reason = f"{constraint_status} 放宽距离约束至{distance_threshold}km (原始约束{original_threshold}km, 实际距离={min_distance:.2f}km)"
   ```

2. **最终核查时的问题**：
   - 最终核查（line 797-1019）重新计算了所有小区的实际最小复用距离
   - **但问题**：重新计算后，没有更新"分配原因"来反映最终的实际距离是否满足原始约束
   - **结果**：分配原因中显示的距离可能不是最终的实际最小复用距离

**用户的需求**：
- 如果实际最小复用距离 >= 用户设置的复用距离阈值，分配原因应明确说明满足条件
- 如果实际最小复用距离 < 用户设置的复用距离阈值，分配原因应明确说明**不满足**条件及原因

**需要的改进**：
```python
# 示例：如果用户设置3km，实际距离0.931km
reason = "❌ 不满足复用距离约束 (实际距离0.93km < 用户阈值3.0km, 原因：相同频点资源不足)"

# 示例：如果用户设置3km，实际距离3.5km
reason = "✅ 满足复用距离约束 (实际距离3.5km >= 用户阈值3.0km)"
```

## 修复方案

### 修复策略

**方案选择**：修复现有的V2算法（`pci_planning_service_v2.py`），而不是切换到V3算法。

**选择理由**：
1. V2算法已经在生产环境使用，稳定性更好
2. V2算法的功能更完善（如最终核查、数据回填等）
3. 修复V2算法比切换到V3风险更小
4. 避免大规模代码变更和测试

### 具体修复步骤

#### 步骤1：增强频点过滤逻辑

**文件**：`backend/app/algorithms/pci_planning_service_v2.py`

**修改位置**：
1. `validate_pci_reuse_distance`方法（line 204-249）
2. 最终核查部分的频点过滤（line 949-989）

**修改内容**：

**1.1 改进`validate_pci_reuse_distance`方法**

当前代码（line 224-226）：
```python
# 只检查同频小区
if target_earfcn is not None and earfcn is not None:
    if abs(target_earfcn - earfcn) > 0.1:  # 频点不同
        continue
```

**问题**：当earfcn为None时，不进行频点过滤

**修复方案**：
```python
# 只检查同频小区
# 策略：如果earfcn值存在，必须严格匹配；如果都不存在，视为同频但标记警告
is_same_freq = False
if target_earfcn is not None and earfcn is not None:
    # 两者都有值，严格匹配
    if abs(target_earfcn - earfcn) <= 0.1:  # 同频
        is_same_freq = True
elif target_earfcn is None and earfcn is None:
    # 两者都为None，视为同频（保持向后兼容）
    is_same_freq = True
else:
    # 一个有值一个为None，视为不同频
    is_same_freq = False

if not is_same_freq:
    continue  # 跳过不同频的小区
```

**1.2 改进最终核查的频点过滤**

当前代码（line 954-956）：
```python
# 如果两者都有earfcn值,检查是否同频
if cell_earfcn is not None and other_earfcn is not None:
    if abs(cell_earfcn - other_earfcn) >= 0.1:
        continue  # 不同频,跳过
```

**修复方案**：
```python
# 检查是否同频
is_same_freq = False
if cell_earfcn is not None and other_earfcn is not None:
    # 两者都有值，严格匹配
    if abs(cell_earfcn - other_earfcn) <= 0.1:
        is_same_freq = True
elif cell_earfcn is None and other_earfcn is None:
    # 两者都为None，视为同频（保持向后兼容）
    is_same_freq = True
# else: 一个有值一个为None，视为不同频，is_same_freq=False

if not is_same_freq:
    continue  # 不同频,跳过
```

同样修改line 987-989的背景小区频点过滤逻辑。

#### 步骤2：添加统一的距离约束验证方法

**目标**：确保"分配原因"和"最小复用距离"始终匹配。

**实现**：在`PCIPlanningService`类中添加一个新方法：

```python
def is_distance_constraint_satisfied(
    self, 
    actual_distance: float, 
    constraint_distance: float
) -> Tuple[bool, str]:
    """
    判断实际距离是否满足距离约束
    
    Args:
        actual_distance: 实际的最小复用距离
        constraint_distance: 用户的距离约束阈值
    
    Returns:
        (is_satisfied, reason_message)
    """
    is_satisfied = actual_distance >= constraint_distance
    
    if is_satisfied:
        reason = f"✅ 满足复用距离约束 (实际{actual_distance:.2f}km ≥ 约束{constraint_distance:.1f}km)"
    else:
        reason = f"❌ 不满足复用距离约束 (实际{actual_distance:.2f}km < 约束{constraint_distance:.1f}km)"
    
    return is_satisfied, reason
```

#### 步骤3：更新最终核查后的分配原因

**位置**：最终核查部分（line 929-1010）

**当前代码**（line 1008-1009）：
```python
# 更新规划结果中的最小复用距离
if min_distance != float("inf"):
    cell["sector_obj"].min_reuse_distance = min_distance
```

**修复方案**：
```python
# 更新规划结果中的最小复用距离和分配原因
if min_distance != float("inf"):
    cell["sector_obj"].min_reuse_distance = min_distance
    
    # 重新生成分配原因，确保与实际距离匹配
    original_threshold = self.config.distance_threshold
    is_satisfied, new_reason = self.is_distance_constraint_satisfied(
        min_distance, original_threshold
    )
    
    # 追加原因说明（保留原始分配原因）
    original_reason = cell["sector_obj"].assignment_reason
    if is_satisfied:
        # 如果最终满足约束，标记为"最终核查通过"
        cell["sector_obj"].assignment_reason = f"{new_reason} (原始:{original_reason})"
    else:
        # 如果最终不满足约束，标记为"最终核查未通过"
        # 查找具体原因（资源不足或频点缺失）
        if min_distance < 0.001:  # 实际上没有找到同频同PCI的小区
            reason_detail = "无同频同PCI小区"
        else:
            reason_detail = f"最近同频同PCI小区距离{min_distance:.2f}km过近"
        
        cell["sector_obj"].assignment_reason = (
            f"{new_reason}, {reason_detail} (原始:{original_reason})"
        )
```

#### 步骤4：改进assign_pci方法中的分配原因

**位置**：`assign_pci`方法（line 306-546）

**当前问题**：分配原因中的距离值是分配时的瞬时值，不是最终的实际最小复用距离。

**修复方案**：在分配原因中添加标记，表明这是"分配时"的距离，最终距离会在核查后更新：

```python
# 在line 374-384，修改为：
if threshold_idx == 0:
    # 第一轮：满足原始约束
    reason = f"[分配时] 满足原始约束 (当时最小距离={min_distance:.2f}km ≥ {original_threshold:.1f}km)"
else:
    # 后续轮次：放宽了约束
    constraint_status = (
        "✅"
        if min_distance >= original_threshold
        else "❌"
    )
    reason = f"{constraint_status} [分配时] 放宽距离约束至{distance_threshold}km (原始{original_threshold}km, 当时距离={min_distance:.2f}km)"
```

这样做的目的是：
1. 让用户清楚知道这个距离是"分配时"计算的，不是最终的
2. 最终距离会在核查后重新计算并更新
3. 最终核查后的分配原因会明确说明是否满足约束

#### 步骤5：添加单元测试

**文件**：`backend/test_pci_planning_v2.py`（新建）或扩展现有的测试文件

**测试用例**：

```python
class TestPCIPlanningV2_FrequencyFilter:
    """测试频点过滤逻辑"""
    
    def test_different_frequency_should_not_calculate_distance(self):
        """测试不同频点的小区不应计算复用距离"""
        config = PlanningConfig(
            network_type=NetworkType.LTE,
            distance_threshold=3.0,
            pci_modulus=3,
        )
        
        service = PCIPlanningService(config)
        
        # 模拟两个不同频点的小区
        sector1 = SiteSectorInfo(
            id="sector1",
            site_id="site1",
            name="扇区1",
            longitude=116.4074,
            latitude=39.9042,
            pci=100,
            earfcn=1850.0,  # LTE频点1
        )
        
        sector2 = SiteSectorInfo(
            id="sector2",
            site_id="site2",
            n
