#!/usr/bin/env python3
"""
测试PCI规划任务的完整执行过程
"""
import asyncio
import time
import logging

# 设置日志级别为INFO，确保所有INFO级别的日志都能显示
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

from app.services.task_manager import task_manager
from app.models.schemas import PCIConfig, NetworkType, PCIRange

async def main():
    """主测试函数"""
    print("开始测试PCI规划任务的完整执行过程...")
    
    # 创建PCI规划配置
    config = PCIConfig(
        networkType=NetworkType.LTE,
        distanceThreshold=3.0,
        pciModulus=3,
        inheritModulus=False,
        pciRange=PCIRange(min=0, max=503)
    )
    
    # 创建PCI规划任务
    task_id = await task_manager.create_pci_task(config)
    print(f"创建的任务ID: {task_id}")
    
    # 等待任务执行，每隔2秒检查一次进度
    print("等待任务执行...")
    for i in range(20):  # 最多等待40秒
        time.sleep(2)
        progress = task_manager.get_task_progress(task_id)
        print(f"第 {i*2} 秒 - 任务进度: {progress}")
        
        # 检查任务状态
        if progress and progress.get('status') == 'completed':
            print("任务已完成!")
            break
    
    # 检查任务结果
    result = task_manager.get_task_result(task_id)
    if result:
        print(f"任务结果: 成功，共规划 {result.get('totalSites', 0)} 个站点，{result.get('totalSectors', 0)} 个小区")
    else:
        print("未获取到任务结果")
    
    print("测试完成!")

if __name__ == "__main__":
    asyncio.run(main())
