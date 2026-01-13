#!/usr/bin/env python3
"""
测试PCI规划API接口
"""
import requests
import time

# API端点
API_URL = "http://localhost:8000/api/v1/pci/plan"

# 请求体
payload = {
    "networkType": "LTE",
    "distanceThreshold": 3.0,
    "pciModulus": 3,
    "inheritModulus": False,
    "pciRange": {
        "min": 0,
        "max": 503
    }
}

# 发送POST请求
print(f"发送POST请求到: {API_URL}")
print(f"请求体: {payload}")

response = requests.post(API_URL, json=payload)
print(f"响应状态码: {response.status_code}")
print(f"响应内容: {response.text}")

# 如果请求成功，获取任务ID
if response.status_code == 200:
    result = response.json()
    task_id = result.get("taskId")
    print(f"任务ID: {task_id}")
    
    # 等待任务执行
    print("等待任务执行...")
    time.sleep(5)
    
    # 检查任务进度
    progress_url = f"http://localhost:8000/api/v1/pci/progress/{task_id}"
    progress_response = requests.get(progress_url)
    print(f"进度响应状态码: {progress_response.status_code}")
    print(f"进度响应内容: {progress_response.text}")
    
    # 检查任务结果
    result_url = f"http://localhost:8000/api/v1/pci/result/{task_id}"
    result_response = requests.get(result_url)
    print(f"结果响应状态码: {result_response.status_code}")
    print(f"结果响应内容: {result_response.text}")
