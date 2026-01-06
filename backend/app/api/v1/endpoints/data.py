"""
数据管理API端点
"""
from fastapi import APIRouter, UploadFile, File, HTTPException, Body, Form
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import FileResponse
from typing import Dict, Any, List, Optional
from app.core.config import settings
from app.models.schemas import UploadResponse, DataItem, UpdateParametersRequest
from app.services.data_service import data_service

router = APIRouter()


@router.get("/{data_id}/download")
async def download_file(data_id: str):
    """下载原始文件"""
    try:
        # 获取文件信息
        data_dir = settings.DATA_DIR / data_id
        file_path = data_dir / "original.xlsx"
        
        if not file_path.exists():
            # 尝试从 uploads 目录找
            file_path = settings.UPLOAD_DIR / f"{data_id}.xlsx"
            
        if not file_path.exists():
            raise HTTPException(status_code=404, detail="文件不存在")
            
        # 获取原始文件名
        filename = "download.xlsx"
        if data_id in data_service.index:
            filename = data_service.index[data_id].get('name', filename)
        
        # 处理中文文件名编码 (RFC 5987)
        import urllib.parse
        encoded_filename = urllib.parse.quote(filename)
        headers = {
            "Content-Disposition": f"attachment; filename*=utf-8''{encoded_filename}"
        }
            
        return FileResponse(
            path=file_path,
            filename=filename,
            headers=headers,
            media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/update-parameters", response_model=Dict[str, Any])
async def update_parameters(request: UpdateParametersRequest) -> Dict[str, Any]:
    """更新工参"""
    try:
        # 在线程池中运行同步的耗时操作，避免阻塞主线程
        result = await run_in_threadpool(data_service.update_parameters, request.fullParamId, request.currentParamId)
        return {
            "success": True,
            "message": "工参更新成功",
            "data": result
        }
    except ValueError as e:
        # 确保错误信息是安全的，避免GBK编码错误
        error_msg = str(e)
        # 显式替换可能导致编码问题的Unicode字符
        error_msg = error_msg.replace('\u2717', 'x').replace('✗', 'x')
        # 使用UTF-8编码处理，然后解码为字符串
        safe_detail = error_msg.encode('utf-8', 'replace').decode('utf-8')
        raise HTTPException(status_code=400, detail=safe_detail)
    except Exception as e:
        import traceback
        traceback.print_exc()
        # 确保错误信息是安全的，避免GBK编码错误
        error_msg = str(e)
        # 显式替换可能导致编码问题的Unicode字符
        error_msg = error_msg.replace('\u2717', 'x').replace('✗', 'x')
        # 使用UTF-8编码处理，然后解码为字符串
        safe_detail = error_msg.encode('utf-8', 'replace').decode('utf-8')
        raise HTTPException(status_code=500, detail=safe_detail)


@router.post("/upload/excel", response_model=Dict[str, Any])
async def upload_excel(file: UploadFile = File(...), file_path: Optional[str] = Form(None)) -> Dict[str, Any]:
    """上传Excel工参文件"""
    try:
        result = await data_service.upload_excel(file, file_path)
        return {
            "success": True,
            "data": result
        }
    except ValueError as e:
        safe_detail = str(e).encode('gbk', 'replace').decode('gbk')
        raise HTTPException(status_code=400, detail=safe_detail)
    except Exception as e:
        safe_detail = str(e).encode('gbk', 'replace').decode('gbk')
        raise HTTPException(status_code=500, detail=safe_detail)


@router.post("/upload/map", response_model=Dict[str, Any])
async def upload_map(file: UploadFile = File(...), file_path: Optional[str] = Form(None)) -> Dict[str, Any]:
    """上传地图文件"""
    try:
        result = await data_service.upload_map(file, file_path)
        return {
            "success": True,
            "data": result
        }
    except ValueError as e:
        safe_detail = str(e).encode('gbk', 'replace').decode('gbk')
        raise HTTPException(status_code=400, detail=safe_detail)
    except Exception as e:
        safe_detail = str(e).encode('gbk', 'replace').decode('gbk')
        raise HTTPException(status_code=500, detail=safe_detail)


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
        safe_detail = str(e).encode('gbk', 'replace').decode('gbk')
        raise HTTPException(status_code=500, detail=safe_detail)


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
        safe_detail = str(e).encode('gbk', 'replace').decode('gbk')
        raise HTTPException(status_code=500, detail=safe_detail)


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
        safe_detail = str(e).encode('gbk', 'replace').decode('gbk')
        raise HTTPException(status_code=500, detail=safe_detail)


@router.get("/{data_id}/preview", response_model=Dict[str, Any])
async def preview_data(data_id: str, rows: int = 100) -> Dict[str, Any]:
    """预览数据"""
    try:
        items = data_service.list_data()
        data_item = next((item for item in items if item.id == data_id), None)

        if not data_item:
            raise HTTPException(status_code=404, detail="数据不存在")

        if data_item.type.value != "excel":
            raise HTTPException(status_code=400, detail="只支持Excel文件预览")

        preview = data_service.preview_data(data_id, rows)
        if preview is None:
            raise HTTPException(status_code=404, detail="预览失败")

        return {
            "success": True,
            "data": preview
        }
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        safe_detail = str(e).encode('gbk', 'replace').decode('gbk')
        raise HTTPException(status_code=500, detail=safe_detail)


@router.get("/{data_id}/layers", response_model=Dict[str, Any])
async def get_layer_files(data_id: str) -> Dict[str, Any]:
    """获取MapInfo图层文件列表"""
    try:
        data = data_service.get_data(data_id)
        if data is None:
            raise HTTPException(status_code=404, detail="数据不存在")

        # 检查是否为MapInfo类型
        from app.services.data_service import data_service as ds
        if data_id in ds.index:
            data_info = ds.index[data_id]
            if data_info.get("subType") != "mapinfo":
                return {
                    "success": True,
                    "data": {
                        "layers": [],
                        "message": "该文件不是MapInfo图层文件"
                    }
                }

            layers = data_info.get("metadata", {}).get("layers", [])
            return {
                "success": True,
                "data": {
                    "layers": layers,
                    "layerCount": len(layers)
                }
            }

        return {
            "success": True,
            "data": {
                "layers": [],
                "layerCount": 0
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        safe_detail = str(e).encode('gbk', 'replace').decode('gbk')
        raise HTTPException(status_code=500, detail=safe_detail)


@router.get("/{data_id}/layers/{layer_id}/data", response_model=Dict[str, Any])
async def get_layer_data(data_id: str, layer_id: str) -> Dict[str, Any]:
    """获取图层要素数据（GeoJSON格式）"""
    try:
        from app.services.mapinfo_service import get_layer_data
        from app.core.config import settings

        data_dir = settings.DATA_DIR / data_id
        if not data_dir.exists():
            raise HTTPException(status_code=404, detail="数据不存在")

        geojson = get_layer_data(data_id, layer_id, data_dir)
        if geojson is None:
            raise HTTPException(status_code=404, detail="图层不存在")

        return {
            "success": True,
            "data": geojson
        }
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        safe_detail = str(e).encode('gbk', 'replace').decode('gbk')
        raise HTTPException(status_code=500, detail=safe_detail)
