"""
任务管理器 - 用于管理PCI和邻区规划的异步任务
"""
import asyncio
import uuid
import math
from datetime import datetime
from typing import Dict, Optional, Any, Callable
from enum import Enum
import logging

logger = logging.getLogger(__name__)

from app.models.schemas import TaskStatus, PCIConfig, NeighborConfig, NetworkType
from app.algorithms.pci_planning_service_v2 import (
    PlanningConfig,
    run_pci_planning
)
from app.algorithms.neighbor_planning_service_v2 import (
    NeighborConfig as NeighborPlanningConfig,
    run_neighbor_planning
)
from app.services.data_service import data_service


class TaskType(str, Enum):
    """任务类型"""
    PCI = "pci"
    NEIGHBOR = "neighbor"


class Task:
    """任务类"""

    def __init__(self, task_type: TaskType, config: Any):
        self.task_id = str(uuid.uuid4())
        self.task_type = task_type
        self.config = config
        self.status = TaskStatus.PENDING
        self.progress = 0.0
        self.result = None
        self.error = None
        self.created_at = datetime.now()
        self.started_at = None
        self.completed_at = None
        self.task = None  # asyncio任务

    def to_dict(self) -> Dict:
        """转换为字典"""
        return {
            "taskId": self.task_id,
            "status": self.status.value,
            "progress": self.progress,
            "message": self._get_status_message(),
            "error": self.error if self.status == TaskStatus.FAILED else None,
            "created_at": self.created_at.isoformat()
        }

    def _get_status_message(self) -> str:
        """获取状态消息"""
        if self.status == TaskStatus.PENDING:
            return "任务等待中..."
        elif self.status == TaskStatus.PROCESSING:
            return f"任务进行中... {self.progress:.1f}%"
        elif self.status == TaskStatus.COMPLETED:
            return "任务已完成"
        elif self.status == TaskStatus.FAILED:
            return f"任务失败: {self.error}"
        return ""


class TaskManager:
    """任务管理器"""

    def __init__(self):
        self.tasks: Dict[str, Task] = {}
        self.max_tasks = 10

    async def create_pci_task(self, config: PCIConfig) -> str:
        """创建PCI规划任务"""
        logger.info(f"[TaskManager] 创建PCI任务, config: {config}")

        # 检查任务数量
        running_tasks = sum(1 for t in self.tasks.values()
                            if t.status in [TaskStatus.PENDING, TaskStatus.PROCESSING])
        if running_tasks >= self.max_tasks:
            raise ValueError("任务数量过多，请等待当前任务完成")

        # 创建任务
        task = Task(TaskType.PCI, config)
        self.tasks[task.task_id] = task
        logger.info(f"[TaskManager] 任务创建成功, task_id: {task.task_id}")

        # 启动任务
        task.task = asyncio.create_task(self._run_pci_task(task))
        logger.info(f"[TaskManager] 异步任务已启动")

        return task.task_id

    async def create_neighbor_task(self, config: NeighborConfig) -> str:
        """创建邻区规划任务"""
        # 检查任务数量
        running_tasks = sum(1 for t in self.tasks.values()
                            if t.status in [TaskStatus.PENDING, TaskStatus.PROCESSING])
        if running_tasks >= self.max_tasks:
            raise ValueError("任务数量过多，请等待当前任务完成")

        # 创建任务
        task = Task(TaskType.NEIGHBOR, config)
        self.tasks[task.task_id] = task

        # 启动任务
        task.task = asyncio.create_task(self._run_neighbor_task(task))

        return task.task_id

    async def _run_pci_task(self, task: Task):
        """运行PCI规划任务"""
        logger.info(f"[TaskManager] _run_pci_task 开始执行, task_id: {task.task_id}")
        try:
            task.status = TaskStatus.PROCESSING
            task.started_at = datetime.now()
            logger.info(f"[TaskManager] 任务状态设置为 PROCESSING")

            # 获取配置
            config = task.config
            logger.info(f"[TaskManager] 配置: networkType={config.networkType}, distance={config.distanceThreshold}, inheritModulus={config.inheritModulus}")

            # 创建规划配置
            planning_config = PlanningConfig(
                network_type=NetworkType(config.networkType),
                distance_threshold=config.distanceThreshold,
                pci_modulus=config.pciModulus,
                inherit_modulus=config.inheritModulus
            )

            # 获取数据 - 支持网络类型特定的数据结构
            sites_data = []
            network_type_str = config.networkType.value  # "LTE" 或 "NR"

            try:
                data_items = data_service.list_data()
                logger.info(f"找到 {len(data_items)} 个数据项")

                if data_items:
                    # 遍历所有Excel数据，查找匹配的数据
                    for item in data_items:
                        if item.type.value == "excel":
                            logger.info(f"尝试加载数据: {item.name} ({item.id})")
                            data = data_service.get_data(item.id)

                            # 检查数据结构：可能是扁平结构或网络特定结构
                            if data:
                                if isinstance(data, dict):
                                    # 新结构：{"LTE": [...], "NR": [...]}
                                    if network_type_str in data:
                                        network_data = data[network_type_str]
                                        if network_data:
                                            logger.info(f"成功从{network_type_str}子表加载 {len(network_data)} 个基站")
                                            sites_data = network_data
                                            break
                                elif isinstance(data, list):
                                    # 旧结构：直接是基站列表 - 需要按networkType过滤
                                    logger.info(f"数据是列表格式，共 {len(data)} 个基站，需要按networkType过滤")
                                    # 过滤出指定网络类型的基站
                                    filtered_data = [s for s in data if s.get('networkType') == network_type_str]
                                    if filtered_data:
                                        logger.info(f"成功过滤出 {len(filtered_data)} 个{network_type_str}基站")
                                        sites_data = filtered_data
                                        break
                                    else:
                                        # 列表中没有该网络类型的数据，继续查找下一个数据项
                                        logger.info(f"列表中没有找到{network_type_str}类型的基站，继续查找")
                                        continue
                            else:
                                logger.warning(f"数据加载返回None")
                        else:
                            logger.info(f"跳过非Excel数据: {item.name} (type: {item.type})")
            except Exception as e:
                logger.error(f"获取数据失败: {e}")
                import traceback
                traceback.print_exc()

            if not sites_data:
                raise ValueError(f"没有可用的{network_type_str}工参数据，请先导入包含{network_type_str}基站信息的Excel文件")

            # 进度回调
            async def progress_callback(progress: float):
                task.progress = progress

            # 执行规划
            result = await run_pci_planning(
                planning_config,
                sites_data,
                progress_callback
            )

            # 完成任务
            task.status = TaskStatus.COMPLETED
            task.completed_at = datetime.now()
            task.result = {
                "taskId": result["taskId"],
                "status": "completed",
                "progress": 100,
                "totalSites": result["totalSites"],
                "totalSectors": result["totalSectors"],
                "collisions": result["collisions"],
                "confusions": result["confusions"],
                "results": result["results"],
                "startTime": task.started_at.isoformat(),
                "endTime": task.completed_at.isoformat()
            }
        except Exception as e:
            task.status = TaskStatus.FAILED
            task.error = str(e)
            task.completed_at = datetime.now()

    async def _run_neighbor_task(self, task: Task):
        """运行邻区规划任务"""
        try:
            task.status = TaskStatus.PROCESSING
            task.started_at = datetime.now()

            # 获取配置
            config = task.config

            # 从planningType解析sourceType和targetType
            source_type = config.sourceType  # 使用property方法
            target_type = config.targetType  # 使用property方法

            logger.info(f"[TaskManager] 邻区规划: planningType={config.planningType}, sourceType={source_type}, targetType={target_type}")

            # 创建规划配置
            planning_config = NeighborPlanningConfig(
                source_type=source_type,
                target_type=target_type,
                max_distance=config.maxDistance,
                max_neighbors=config.maxNeighbors,
                min_neighbors=getattr(config, 'minNeighbors', 0)
            )

            # 获取数据 - 支持网络类型特定的数据结构
            sites_data = []
            source_network_str = source_type.value  # "LTE" 或 "NR"

            try:
                data_items = data_service.list_data()
                logger.info(f"邻区规划: 找到 {len(data_items)} 个数据项")

                if data_items:
                    # 遍历所有Excel数据，查找匹配的源网络数据
                    for item in data_items:
                        if item.type.value == "excel":
                            logger.info(f"邻区规划: 尝试加载数据: {item.name} ({item.id})")
                            data = data_service.get_data(item.id)

                            # 检查数据结构：可能是扁平结构或网络特定结构
                            if data:
                                if isinstance(data, dict):
                                    # 新结构：{"LTE": [...], "NR": [...]}
                                    if source_network_str in data:
                                        network_data = data[source_network_str]
                                        if network_data:
                                            logger.info(f"邻区规划: 成功从{source_network_str}子表加载 {len(network_data)} 个基站")
                                            sites_data = network_data
                                            break
                                elif isinstance(data, list):
                                    # 旧结构：直接是基站列表 - 需要按networkType过滤
                                    logger.info(f"邻区规划: 数据是列表格式，共 {len(data)} 个基站，需要按networkType过滤")
                                    # 过滤出指定网络类型的基站
                                    filtered_data = [s for s in data if s.get('networkType') == source_network_str]
                                    if filtered_data:
                                        logger.info(f"邻区规划: 成功过滤出 {len(filtered_data)} 个{source_network_str}基站")
                                        sites_data = filtered_data
                                        break
                                    else:
                                        # 列表中没有该网络类型的数据，继续查找下一个数据项
                                        logger.info(f"邻区规划: 列表中没有找到{source_network_str}类型的基站，继续查找")
                                        continue
                            else:
                                logger.warning(f"邻区规划: 数据加载返回None")
                        else:
                            logger.info(f"邻区规划: 跳过非Excel数据: {item.name} (type: {item.type})")
            except Exception as e:
                logger.error(f"邻区规划获取数据失败: {e}")
                import traceback
                traceback.print_exc()

            if not sites_data:
                raise ValueError(f"没有可用的{source_network_str}工参数据，请先导入包含{source_network_str}基站信息的Excel文件")

            # 进度回调
            async def progress_callback(progress: float):
                task.progress = progress

            # 执行规划
            result = await run_neighbor_planning(
                planning_config,
                sites_data,
                progress_callback
            )

            # 完成任务
            task.status = TaskStatus.COMPLETED
            task.completed_at = datetime.now()
            task.result = {
                "taskId": result["taskId"],
                "status": "completed",
                "progress": 100,
                "totalSites": result["totalSites"],
                "totalSectors": result["totalSectors"],
                "totalNeighbors": result["totalNeighbors"],
                "avgNeighbors": result["avgNeighbors"],
                "results": result["results"],
                "startTime": task.started_at.isoformat(),
                "endTime": task.completed_at.isoformat()
            }
        except Exception as e:
            task.status = TaskStatus.FAILED
            task.error = str(e)
            task.completed_at = datetime.now()

    def get_task_progress(self, task_id: str) -> Optional[Dict]:
        """获取任务进度"""
        task = self.tasks.get(task_id)
        if task is None:
            return None
        return task.to_dict()

    def get_task_result(self, task_id: str) -> Optional[Dict]:
        """获取任务结果"""
        task = self.tasks.get(task_id)
        if task is None or task.status != TaskStatus.COMPLETED:
            return None
        return task.result

    def cancel_task(self, task_id: str) -> bool:
        """取消任务"""
        task = self.tasks.get(task_id)
        if task is None:
            return False

        if task.status in [TaskStatus.PENDING, TaskStatus.PROCESSING]:
            if task.task and not task.task.done():
                task.task.cancel()
            task.status = TaskStatus.FAILED
            task.error = "任务已取消"
            task.completed_at = datetime.now()
            return True

        return False

    def export_result(self, task_id: str, format: str = "xlsx") -> Optional[str]:
        """导出任务结果"""
        task = self.tasks.get(task_id)
        if task is None or task.status != TaskStatus.COMPLETED:
            return None

        try:
            import pandas as pd
            from pathlib import Path
            from app.core.config import settings

            output_file = Path(settings.OUTPUT_DIR) / f"{task_id}.{format}"

            # 根据任务类型导出
            if task.task_type == TaskType.PCI:
                # PCI规划结果导出
                data = []
                for site_result in task.result.get("results", []):
                    site_id = site_result.get("siteId", "")
                    site_name = site_result.get("siteName", "")
                    for sector_result in site_result.get("sectors", []):
                        data.append({
                            "基站ID": site_id,
                            "基站名称": site_name,
                            "小区ID": sector_result.get("sectorId", ""),
                            "小区名称": sector_result.get("sectorName", ""),
                            "原PCI": sector_result.get("originalPCI", ""),
                            "新PCI": sector_result.get("newPCI", ""),
                            "原模值": sector_result.get("originalMod", ""),
                            "新模值": sector_result.get("newMod", ""),
                            "分配原因": sector_result.get("assignmentReason", ""),
                            "最小复用距离(km)": sector_result.get("minReuseDistance", "")
                        })
                df = pd.DataFrame(data)

            elif task.task_type == TaskType.NEIGHBOR:
                # 邻区规划结果导出
                data = []
                for site_result in task.result.get("results", []):
                    site_id = site_result.get("siteId", "")
                    site_name = site_result.get("siteName", "")
                    for sector_result in site_result.get("sectors", []):
                        sector_id = sector_result.get("sectorId", "")
                        sector_name = sector_result.get("sectorName", "")
                        for neighbor in sector_result.get("neighbors", []):
                            data.append({
                                "源基站ID": site_id,
                                "源基站名称": site_name,
                                "源小区ID": sector_id,
                                "源小区名称": sector_name,
                                "目标小区": neighbor.get("targetSectorName", ""),
                                "目标基站": neighbor.get("targetSiteName", ""),
                                "距离(km)": neighbor.get("distance", ""),
                                "方位角(°)": neighbor.get("bearing", ""),
                                "关系类型": neighbor.get("relationType", "")
                            })
                df = pd.DataFrame(data)
            else:
                raise ValueError(f"未知的任务类型: {task.task_type}")

            if format == "xlsx":
                df.to_excel(output_file, index=False, engine='openpyxl')
            elif format == "csv":
                df.to_csv(output_file, index=False, encoding='utf-8-sig')

            return str(output_file)
        except Exception as e:
            print(f"导出失败: {e}")
            import traceback
            traceback.print_exc()
            return None

    def cleanup_old_tasks(self):
        """清理旧任务"""
        # 删除超过24小时完成的任务
        from datetime import timedelta

        cutoff = datetime.now() - timedelta(hours=24)
        to_remove = []

        for task_id, task in self.tasks.items():
            if task.completed_at and task.completed_at < cutoff:
                to_remove.append(task_id)

        for task_id in to_remove:
            del self.tasks[task_id]


# 创建全局实例
from app.core.config import settings
task_manager = TaskManager()
