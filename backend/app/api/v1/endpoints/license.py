"""
许可证管理API端点
"""
from fastapi import APIRouter, UploadFile, File, HTTPException
from typing import Dict, Any
from app.models.schemas import (
    LicenseStatus,
    LicenseActivateRequest,
    LicenseResponse
)
from app.services.license_service import license_service

router = APIRouter()


@router.get("/status", response_model=Dict[str, Any])
async def get_license_status() -> Dict[str, Any]:
    """获取许可证状态"""
    try:
        status = license_service.get_status()
        return {
            "success": True,
            "data": status
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/activate", response_model=Dict[str, Any])
async def activate_license(request: LicenseActivateRequest) -> Dict[str, Any]:
    """激活许可证"""
    try:
        result = license_service.activate(request.license_key)
        return {
            "success": result,
            "message": "许可证激活成功" if result else "许可证激活失败"
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/upload", response_model=Dict[str, Any])
async def upload_license(file: UploadFile = File(...)) -> Dict[str, Any]:
    """上传许可证文件"""
    try:
        # 读取文件内容
        content = await file.read()
        license_key = content.decode('utf-8').strip()

        result = license_service.activate(license_key)
        return {
            "success": result,
            "message": "许可证上传成功" if result else "许可证上传失败"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/validate", response_model=Dict[str, Any])
async def validate_license(license_key: str) -> Dict[str, Any]:
    """验证许可证"""
    try:
        is_valid = license_service.validate(license_key)
        return {
            "success": True,
            "data": {"valid": is_valid}
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
