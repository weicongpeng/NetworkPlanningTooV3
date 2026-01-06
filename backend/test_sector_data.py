import requests
import json

# 调用API获取数据
response = requests.get('http://localhost:8000/api/v1/data')
print(f'Status Code: {response.status_code}')

# 解析响应
if response.status_code == 200:
    data = response.json()
    print(f'Response structure: {json.dumps(list(data.keys()), indent=2)}')
    
    if 'data' in data and 'sites' in data['data']:
        sites = data['data']['sites']
        print(f'Total sites: {len(sites)}')
        
        # 遍历前5个站点
        for site_idx, site in enumerate(sites[:5]):
            print(f'\nSite {site_idx + 1}: {site.get("name", "Unknown")}')
            print(f'  Network Type: {site.get("networkType", "Unknown")}')
            
            # 检查扇区数据
            if 'sectors' in site and isinstance(site['sectors'], list):
                sectors = site['sectors']
                print(f'  Sectors: {len(sectors)}')
                
                # 遍历前2个扇区
                for sec_idx, sector in enumerate(sectors[:2]):
                    print(f'    Sector {sec_idx + 1}: {sector.get("name", "Unknown")}')
                    print(f'      is_shared: {sector.get("is_shared")}')
                    print(f'      All keys: {list(sector.keys())[:10]}...')
            else:
                print(f'  No sectors found')
else:
    print(f'Error: {response.text}')