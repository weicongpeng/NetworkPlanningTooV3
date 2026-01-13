#!/usr/bin/env python3
"""
简单测试LTE网元ID匹配逻辑
"""

from app.services.data_service import data_service

print("开始简单测试LTE网元ID匹配逻辑...")

# 获取所有数据项
data_items = data_service.list_data()
print(f"找到 {len(data_items)} 个数据项")

# 查找全量工参文件
full_params_item = None

for item in data_items:
    if item.type.value == "excel" and item.name.lower().startswith('projectparameter'):
        full_params_item = item
        print(f"找到全量工参文件: {item.name} ({item.id})")
        break

if full_params_item:
    # 获取全量工参数据
    full_params_data = data_service.get_data(full_params_item.id)
    
    if isinstance(full_params_data, dict) and "LTE" in full_params_data:
        lte_sites = full_params_data["LTE"]
        print(f"\n找到 {len(lte_sites)} 个LTE站点")
        
        # 查找特定站点ID为"936475"的站点
        target_site_id = "936475"
        found = False
        
        for site in lte_sites:
            site_id = site.get('id', '')
            
            if site_id == target_site_id:
                found = True
                print(f"\n找到目标站点!")
                print(f"站点ID: {site_id}")
                print(f"站点名称: {site.get('name')}")
                print(f"管理网元ID: {site.get('managedElementId')}")
                print(f"\n站点包含的所有字段:")
                for key, value in site.items():
                    print(f"  {key}: {value}")
                break
        
        if not found:
            print(f"\n未找到站点ID为 {target_site_id} 的LTE站点")
            print("\n所有LTE站点ID列表 (前20个):")
            for site in lte_sites[:20]:
                print(f"  {site.get('id')}")
    else:
        print("全量工参数据格式不符合预期")
else:
    print("未找到全量工参文件")

print("\n测试完成!")
