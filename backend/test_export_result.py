#!/usr/bin/env python3
"""
测试export_result功能，验证"基站名称"是否已正确改为"网元ID"
"""
import sys
import os
import tempfile
import pandas as pd

# 添加项目根目录到Python路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.task_manager import TaskManager, TaskType
from app.models.schemas import PCIConfig, NetworkType

# 创建一个测试任务结果
test_task_result = {
    "taskId": "test_task",
    "status": "completed",
    "progress": 100,
    "totalSites": 2,
    "totalSectors": 3,
    "collisions": 0,
    "confusions": 0,
    "results": [
        {
            "siteId": "LTE-001",
            "siteName": "管理网元ID-LTE-001",
            "sectors": [
                {
                    "sectorId": "1",
                    "sectorName": "LTE-001-1",
                    "originalPCI": 100,
                    "newPCI": 200,
                    "originalMod": 1,
                    "newMod": 2,
                    "assignmentReason": "成功分配",
                    "minReuseDistance": 3.5
                }
            ]
        },
        {
            "siteId": "NR-002",
            "siteName": "NR-002",
            "sectors": [
                {
                    "sectorId": "1",
                    "sectorName": "NR-002-1",
                    "originalPCI": 200,
                    "newPCI": 300,
                    "originalMod": 20,
                    "newMod": 30,
                    "assignmentReason": "成功分配",
                    "minReuseDistance": 4.0
                },
                {
                    "sectorId": "2",
                    "sectorName": "NR-002-2",
                    "originalPCI": 201,
                    "newPCI": 301,
                    "originalMod": 21,
                    "newMod": 1,
                    "assignmentReason": "成功分配",
                    "minReuseDistance": 3.8
                }
            ]
        }
    ]
}

def test_pci_export_result():
    """测试PCI规划结果导出"""
    print("测试PCI规划结果导出...")
    
    # 创建TaskManager实例
    task_manager = TaskManager()
    
    # 创建一个测试任务
    task = type('TestTask', (), {
        'task_type': TaskType.PCI,
        'result': test_task_result
    })()
    
    # 创建临时文件
    with tempfile.NamedTemporaryFile(suffix='.xlsx', delete=False) as tmp:
        temp_file_path = tmp.name
    
    try:
        # 调用export_result方法
        result_file = task_manager.export_result(task, 'xlsx', temp_file_path)
        print(f"导出文件路径: {result_file}")
        
        # 读取导出的Excel文件
        df = pd.read_excel(result_file)
        print("\n导出文件的列名:")
        print(df.columns.tolist())
        
        # 验证是否包含"网元ID"列，而不包含"基站名称"列
        assert '网元ID' in df.columns, "导出结果中缺少'网元ID'列"
        assert '基站名称' not in df.columns, "导出结果中仍包含'基站名称'列"
        
        print("\n导出结果数据:")
        print(df)
        
        # 验证数据正确性
        print("\n验证数据正确性:")
        # LTE小区的网元ID应该是原站点名称
        lte_row = df[df['基站ID'] == 'LTE-001'].iloc[0]
        assert lte_row['网元ID'] == '管理网元ID-LTE-001', f"LTE网元ID错误: {lte_row['网元ID']}"
        print("✓ LTE小区网元ID正确")
        
        # NR小区的网元ID应该是基站ID
        nr_rows = df[df['基站ID'] == 'NR-002']
        for _, nr_row in nr_rows.iterrows():
            assert nr_row['网元ID'] == 'NR-002', f"NR网元ID错误: {nr_row['网元ID']}"
        print("✓ NR小区网元ID正确")
        
        print("\n🎉 测试通过！PCI规划结果导出已正确将'基站名称'改为'网元ID'。")
        return True
    except Exception as e:
        print(f"\n❌ 测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        # 清理临时文件
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)

if __name__ == "__main__":
    test_pci_export_result()
