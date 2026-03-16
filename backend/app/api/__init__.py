"""
API路由创建和注册
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import logging

from app.core.config import settings
from app.api.v1 import api_router

# 配置日志
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # 启动时执行
    logger.info("应用启动中...")

    # 确保必要的目录存在
    settings.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    settings.OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    settings.LICENSE_DIR.mkdir(parents=True, exist_ok=True)
    settings.DATA_DIR.mkdir(parents=True, exist_ok=True)
    settings.TEMPLATE_DIR.mkdir(parents=True, exist_ok=True)

    logger.info("应用启动完成")
    yield

    # 关闭时执行
    logger.info("应用关闭中...")
    logger.info("应用关闭完成")


def create_app() -> FastAPI:
    """创建FastAPI应用实例"""

    # 配置JSON响应使用UTF-8编码
    from fastapi.responses import JSONResponse
    from fastapi.encoders import jsonable_encoder
    from typing import Any
    import json

    # 自定义JSON响应类，确保使用UTF-8编码
    class UTF8JSONResponse(JSONResponse):
        def render(self, content: Any) -> bytes:
            # 使用UTF-8编码序列化JSON
            return json.dumps(
                content,
                ensure_ascii=False,
                allow_nan=False,
                indent=None,
                separators=(",", ":"),
            ).encode("utf-8")

    app = FastAPI(
        title=settings.PROJECT_NAME,
        version=settings.VERSION,
        description="网络规划工具API",
        lifespan=lifespan,
        default_response_class=UTF8JSONResponse,  # 设置默认响应类为UTF-8 JSON响应
    )

    # 配置CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.BACKEND_CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["Content-Disposition", "Content-Length", "Content-Type"],
    )

    # 注册路由
    app.include_router(api_router, prefix=settings.API_V1_STR)

    # 静态文件服务（用于导出文件下载）
    # 在挂载静态文件之前确保目录存在
    settings.OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    app.mount("/static", StaticFiles(directory=str(settings.OUTPUT_DIR)), name="static")

    @app.get("/")
    async def root():
        return {
            "message": "网络规划工具API",
            "version": settings.VERSION,
            "status": "running",
        }

    @app.get("/health")
    async def health():
        return {"status": "healthy"}

    return app
