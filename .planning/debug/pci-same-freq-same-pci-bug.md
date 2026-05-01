---
status: fix_applied
trigger: PCI规划结果的在地图地理化渲染同频点同PCI扇区异常，渲染数据需要使用小区规划后的PCI替换旧PCI后进行同频点同PCI筛查并渲染。不然地理化显示的同频同PCI渲染结果是不对的。
created: 2026-05-01T00:00:00+08:00
updated: 2026-05-01T00:05:00+08:00
slug: pci-same-freq-same-pci-bug
---

# Debug Session: PCI规划地图渲染同频同PCI异常

## Symptoms

**Expected Behavior**: 使用规划后的新PCI筛查同频同PCI冲突并在地图上正确渲染，包括：
1. 规划结果中其他被规划为相同PCI的小区
2. 全量工参中原本PCI就等于该值的小区（未规划的小区）

**Actual Behavior**: 地图只显示全量工参中原本PCI相同的未规划小区，不显示规划结果中其他被规划为相同PCI的小区

**Reproduction Steps**:
1. 导入工参数据
2. 执行PCI规划（确保有多个小区被规划为相同PCI）
3. 在地图上点击查看同频同PCI渲染结果
4. 发现只高亮了全量工参中原本PCI相同的小区，未高亮规划结果中其他PCI相同的小区

**Timeline**: 一直存在（从一开始就没有正确工作过）

**User Impact**: 地理化显示的同频同PCI渲染结果不完整，无法正确展示规划后的完整PCI冲突情况

---

## Current Focus

**hypothesis**: `pciDataSyncService.findSameFrequencyPCI()` 方法错误地排除了规划结果中的扇区（`isPlannedSector === true`），导致规划结果中其他被规划为相同PCI的小区不会被高亮显示

**test**: 检查 `findSameFrequencyPCI` 方法中的过滤逻辑，确认是否错误地排除了 `isPlannedSector === true` 的扇区

**expecting**: `findSameFrequencyPCI` 应该返回所有 syncedPCI 相同的扇区（包括规划结果中的扇区），只排除当前选中的扇区

**next_action**: 验证修复 - 执行PCI规划后，在地图上检查同频同PCI渲染是否包含所有规划后的扇区

**reasoning_checkpoint**: 根因已找到 - `findSameFrequencyPCI` 方法第452-458行排除了 `isPlannedSector === true` 的扇区，导致规划结果中其他相同PCI的小区不会被显示

---

## Evidence

- timestamp: 2026-05-01T00:00:00+08:00
  finding: 用户报告地图渲染同频同PCI时使用旧PCI值
  source: 用户描述
  type: symptom

- timestamp: 2026-05-01T00:30:00+08:00
  finding: 分析 `pciDataSyncService.findSameFrequencyPCI()` 方法，发现第452-458行明确排除了 `isPlannedSector === true` 的扇区
  source: 代码分析 (frontend/src/renderer/services/pciDataSyncService.ts:452-458)
  type: code_analysis
  detail: |
    代码逻辑：
    ```
    // 查找所有同频同PCI的扇区（只排除规划结果中的扇区和当前选中扇区）
    const result = allSectors.filter(sector => {
      // 关键：只查找全量工参中**未规划**的小区
      // 排除规划结果中的扇区（isPlannedSector === true）
      if (sector.isPlannedSector) {
        return false
      }
      ...
    })
    ```
    这导致规划结果中其他被规划为相同PCI的小区不会被返回。

- timestamp: 2026-05-01T00:35:00+08:00
  finding: 验证了 `setPCIResults` 和 `resyncData` 方法正确将规划结果的 newPCI 同步到了 syncedPCI
  source: 代码分析 (frontend/src/renderer/services/pciDataSyncService.ts:121-160, 257-314)
  type: code_analysis
  detail: |
    `setPCIResults` 调用 `resyncData`，后者遍历所有规划结果并调用 `syncSectorPCI` 更新 syncedPCI。
    规划结果中的扇区会被正确标记为 `isPlannedSector = true` 且 `syncedPCI = newPCI`。

- timestamp: 2026-05-01T00:40:00+08:00
  finding: 确认了如果用户点击一个规划后PCI=100的小区，期望看到所有PCI=100的小区（包括规划结果中的其他小区），但当前只显示全量工参中原本PCI=100的小区
  source: 逻辑推理
  type: analysis

- timestamp: 2026-05-01T00:05:00+08:00
  finding: 已应用修复 - 移除 `findSameFrequencyPCI` 方法中对 `isPlannedSector` 的过滤逻辑
  source: 代码修改 (frontend/src/renderer/services/pciDataSyncService.ts:452-458)
  type: fix_applied
  detail: |
    修改内容：
    1. 删除第452-458行：移除对 `isPlannedSector === true` 的过滤
    2. 更新注释：从"只排除规划结果中的扇区"改为"排除当前选中扇区"
    3. 更新日志：从"只返回未规划小区"改为"返回所有同频同PCI扇区"
    现在 `findSameFrequencyPCI` 会返回所有 syncedPCI 相同的扇区（包括规划结果中的扇区）。

---

## Eliminated

- 数据流问题：`pciDataSyncService` 的数据流是正确的，初始化时加载全量工参，`setPCIResults` 正确同步规划结果的PCI
- syncedPCI 未更新：已验证 `resyncData` 和 `syncSectorPCI` 正确更新 syncedPCI
- 地图渲染问题：地图渲染逻辑正确使用了 `findSameFrequencyPCI` 返回的结果，问题在数据源

---

## Resolution

**root_cause**: `pciDataSyncService.findSameFrequencyPCI()` 方法错误地排除了规划结果中的扇区（`isPlannedSector === true`），导致规划结果中其他被规划为相同PCI的小区不会被高亮显示。应该移除这个过滤条件，让方法返回所有 syncedPCI 相同的扇区（包括规划结果中的扇区）。

**fix**: 已应用修复 - 修改 `frontend/src/renderer/services/pciDataSyncService.ts` 中的 `findSameFrequencyPCI` 方法：
1. ✅ 移除对 `isPlannedSector` 的过滤（删除原第452-458行的 `if (sector.isPlannedSector) { return false }`）
2. ✅ 保留对当前选中扇区的排除（通过 `excludeKey`）
3. ✅ 更新方法注释（第452行）：从"只排除规划结果中的扇区"改为"排除当前选中扇区"
4. ✅ 更新日志消息（第490行）：从"只返回未规划小区"改为"返回所有同频同PCI扇区"

**verification**: 
1. 执行PCI规划，确保有多个小区被规划为相同PCI
2. 点击其中一个规划后PCI=100的小区
3. 验证地图上高亮显示了：该小区 + 规划结果中其他PCI=100的小区 + 全量工参中原本PCI=100的小区

**files_changed**: 
- `frontend/src/renderer/services/pciDataSyncService.ts` - 修改 `findSameFrequencyPCI` 方法（第452-458行）

---

## Notes

- 问题核心：`findSameFrequencyPCI` 的注释和逻辑表明这是"按设计"的行为（"只返回未规划的小区"），但这不符合用户的期望
- 用户期望看到规划后的完整PCI冲突情况，包括规划结果中其他被规划为相同PCI的小区
- 修复后，当用户点击规划结果中的小区时，会看到所有规划后PCI相同的扇区（包括规划结果中的其他小区和全量工参中原本PCI相同的小区）
