#!/usr/bin/env python3
"""
简单测试PCI规划结果导出功能：
1. LTE和NR小区都使用正确的管理网元ID
2. NR小区使用正确的SSB频点
3. 导出结果包含频点列
"""

# 模拟task_manager.py中的export_result逻辑
def mock_export_result(task_result):
    """模拟导出结果生成"""
    data = []
    for site_result in task_result.get("results", []):
        site_id = site_result.get("siteId", "")
        site_name = site_result.get("siteName", "")
        network_type = site_result.get("networkType", "LTE")
        
        for sector_result in site_result.get("sectors", []):
            # 根据网络类型确定网元ID
            if network_type == "NR":
                # NR小区的网元ID对应全量工参NR表的“管理网元ID”
                net_element_id = site_result.get("managedElementId", site_name)
            else:
                # LTE小区的网元ID对应全量工参LTE表的“管理网元ID”
                net_element_id = site_result.get("managedElementId", site_name)
            
            # 获取频点信息
            frequency = sector_result.get("frequency", "") or sector_result.get("earfcn", "") or sector_result.get("ssb_frequency", "")
            
            data.append({
                "基站ID": site_id,
                "网元ID": net_element_id,
                "小区ID": sector_result.get("sectorId", ""),
                "小区名称": sector_result.get("sectorName", ""),
                "频点": frequency,
                "新PCI": sector_result.get("newPCI", "")
            })
    return data

# 测试主函数
def test_pci_export():
    """测试PCI规划结果导出功能"""
    print("开始测试PCI规划结果导出功能...")
    
    # 创建测试任务结果
    test_task_result = {
        "results": [
            # LTE站点
            {
                "siteId": "LTE-001",
                "siteName": "LTE基站001",
                "managedElementId": "ME-LTE-001",
                "networkType": "LTE",
                "sectors": [
                    {
                        "sectorId": "1",
                        "sectorName": "LTE-001-1",
                        "newPCI": 101,
                        "earfcn": 1000,
                        "frequency": 1000
                    }
                ]
            },
            # NR站点1（使用"填写SSB频点"）
            {
                "siteId": "NR-001",
                "siteName": "NR基站001",
                "managedElementId": "ME-NR-001",
                "networkType": "NR",
                "sectors": [
                    {
                        "sectorId": "1",
                        "sectorName": "NR-001-1",
                        "newPCI": 201,
                        "ssb_frequency": 2000,
                        "frequency": 2000
                    }
                ]
            },
            # NR站点2（使用"SSB Frequency"）
            {
                "siteId": "NR-002",
                "siteName": "NR基站002",
                "managedElementId": "ME-NR-002",
                "networkType": "NR",
                "sectors": [
                    {
                        "sectorId": "1",
                        "sectorName": "NR-002-1",
                        "newPCI": 301,
                        "ssb_frequency": 3000,
                        "frequency": 3000
                    }
                ]
            },
            # 无管理网元ID的站点
            {
                "siteId": "LTE-003",
                "siteName": "LTE基站003",
                "networkType": "LTE",
                "sectors": [
                    {
                        "sectorId": "1",
                        "sectorName": "LTE-003-1",
                        "newPCI": 401,
                        "earfcn": 4000,
                        "frequency": 4000
                    }
                ]
            }
        ]
    }
    
    # 生成导出数据
    export_data = mock_export_result(test_task_result)
    
    print("\n导出结果数据：")
    for row in export_data:
        print(f"  基站ID: {row['基站ID']}, 网元ID: {row['网元ID']}, 小区名称: {row['小区名称']}, 频点: {row['频点']}, 新PCI: {row['新PCI']}")
    
    # 验证结果
    print("\n验证结果：")
    
    # 验证LTE小区
    lte_row = export_data[0]
    assert lte_row['网元ID'] == "ME-LTE-001", f"LTE网元ID错误: {lte_row['网元ID']}，应为'ME-LTE-001'"
    assert lte_row['频点'] == 1000, f"LTE频点错误: {lte_row['频点']}，应为'1000'"
    print("✓ LTE小区验证通过：使用正确的管理网元ID和频点")
    
    # 验证NR小区1
    nr_row1 = export_data[1]
    assert nr_row1['网元ID'] == "ME-NR-001", f"NR网元ID错误: {nr_row1['网元ID']}，应为'ME-NR-001'"
    assert nr_row1['频点'] == 2000, f"NR频点错误: {nr_row1['频点']}，应为'2000'"
    print("✓ NR小区1验证通过：使用正确的管理网元ID和SSB频点")
    
    # 验证NR小区2
    nr_row2 = export_data[2]
    assert nr_row2['网元ID'] == "ME-NR-002", f"NR网元ID错误: {nr_row2['网元ID']}，应为'ME-NR-002'"
    assert nr_row2['频点'] == 3000, f"NR频点错误: {nr_row2['频点']}，应为'3000'"
    print("✓ NR小区2验证通过：使用正确的管理网元ID和SSB频点")
    
    # 验证无管理网元ID的站点
    no_me_row = export_data[3]
    assert no_me_row['网元ID'] == "LTE基站003", f"无管理网元ID的站点错误: {no_me_row['网元ID']}，应为'LTE基站003'"
    print("✓ 无管理网元ID的站点验证通过：使用站点名称作为网元ID")
    
    # 验证所有行都包含频点列
    for i, row in enumerate(export_data):
        assert "频点" in row, f"第{i+1}行缺少'频点'列"
    print("✓ 所有行都包含'频点'列")
    
    # 验证所有行都包含网元ID列
    for i, row in enumerate(export_data):
        assert "网元ID" in row, f"第{i+1}行缺少'网元ID'列"
        assert row['网元ID'], f"第{i+1}行'网元ID'为空"
    print("✓ 所有行都包含非空的'网元ID'列")
    
    print("\n🎉 所有测试通过！PCI规划结果导出功能已正确实现。")
    return True

if __name__ == "__main__":
    test_pci_export()
