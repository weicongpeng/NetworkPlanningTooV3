"""
数据管理API端点
"""
from fastapi import APIRouter, UploadFile, File, HTTPException
from typing import Dict, Any, List
from app.models.schemas import UploadResponse, DataItem
from app.services.data_service import data_service

router = APIRouter()


@router.post("/upload/excel", response_model=Dict[str, Any])
async def upload_excel(file: UploadFile = File(...)) -> Dict[str, Any]:
    """上传Excel工参文件"""
    try:
        result = await data_service.upload_excel(file)
        return {
            "success": True,
            "data": result
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/upload/map", response_model=Dict[str, Any])
async def upload_map(file: UploadFile = File(...)) -> Dict[str, Any]:
    """上传地图文件"""
    try:
        result = await data_service.upload_map(file)
        return {
            "success": True,
            "data": result
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/list", response_model=Dict[str, Any])
async def list_data() -> Dict[str, Any]:
    """获取数据列表"""
    try:
        items = data_service.list_data()
        return {
            "success": True,
            "data": items
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{data_id}", response_model=Dict[str, Any])
async def get_data(data_id: str) -> Dict[str, Any]:
    """获取数据详情"""
    try:
        data = data_service.get_data(data_id)
        if data is None:
            raise HTTPException(status_code=404, detail="数据不存在")
        return {
            "success": True,
            "data": data
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{data_id}", response_model=Dict[str, Any])
async def delete_data(data_id: str) -> Dict[str, Any]:
    """删除数据"""
    try:
        result = data_service.delete_data(data_id)
        return {
            "success": result,
            "message": "删除成功" if result else "删除失败"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{data_id}/preview", response_model=Dict[str, Any])
async def preview_data(data_id: str, rows: int = 100) -> Dict[str, Any]:
    """预览数据"""
    try:
        preview = data_service.preview_data(data_id, rows)
        if preview is None:
            raise HTTPException(status_code=404, detail="数据不存在")
        return {
            "success": True,
            "data": preview
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
