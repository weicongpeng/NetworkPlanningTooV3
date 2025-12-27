"""
PCI规划API端点
"""
from fastapi import APIRouter, HTTPException, BackgroundTasks
from typing import Dict, Any
from app.models.schemas import PCIConfig, PCIResult
from app.services.task_manager import task_manager

router = APIRouter()


@router.post("/plan", response_model=Dict[str, Any])
async def start_pci_planning(
    config: PCIConfig,
    background_tasks: BackgroundTasks
) -> Dict[str, Any]:
    """启动PCI规划任务"""
    try:
        task_id = await task_manager.create_pci_task(config)
        return {
            "success": True,
            "data": {
                "taskId": task_id,
                "message": "PCI规划任务已启动"
            }
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/progress/{task_id}", response_model=Dict[str, Any])
async def get_pci_progress(task_id: str) -> Dict[str, Any]:
    """获取PCI规划进度"""
    try:
        progress = task_manager.get_task_progress(task_id)
        if progress is None:
            raise HTTPException(status_code=404, detail="任务不存在")
        return {
            "success": True,
            "data": progress
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/result/{task_id}", response_model=Dict[str, Any])
async def get_pci_result(task_id: str) -> Dict[str, Any]:
    """获取PCI规划结果"""
    try:
        result = task_manager.get_task_result(task_id)
        if result is None:
            raise HTTPException(status_code=404, detail="任务不存在")
        return {
            "success": True,
            "data": result
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/export/{task_id}")
async def export_pci_result(task_id: str, format: str = "xlsx"):
    """导出PCI规划结果"""
    try:
        from fastapi.responses import FileResponse

        file_path = task_manager.export_result(task_id, format)
        if file_path is None:
            raise HTTPException(status_code=404, detail="任务不存在或导出失败")

        filename = f"pci_result_{task_id}.{format}"
        return FileResponse(
            path=file_path,
            filename=filename,
            media_type="application/octet-stream"
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/task/{task_id}", response_model=Dict[str, Any])
async def cancel_pci_task(task_id: str) -> Dict[str, Any]:
    """取消PCI规划任务"""
    try:
        result = task_manager.cancel_task(task_id)
        return {
            "success": result,
            "message": "任务已取消" if result else "取消失败"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
