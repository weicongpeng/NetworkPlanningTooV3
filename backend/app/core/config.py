"""
应用配置
"""
from pydantic_settings import BaseSettings
from typing import List
from pathlib import Path


class Settings(BaseSettings):
    """应用配置类"""

    # 项目信息
    PROJECT_NAME: str = "网络规划工具"
    VERSION: str = "2.0.0"

    # API配置
    API_V1_STR: str = "/api/v1"

    # CORS配置
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]

    # 服务器配置
    HOST: str = "127.0.0.1"
    PORT: int = 8000

    # 目录配置
    BASE_DIR: Path = Path(__file__).parent.parent.parent
    UPLOAD_DIR: Path = BASE_DIR / "uploads"
    OUTPUT_DIR: Path = BASE_DIR / "outputs"
    LICENSE_DIR: Path = BASE_DIR / "licenses"
    DATA_DIR: Path = BASE_DIR / "data"

    # 许可证配置
    LICENSE_SECRET_KEY: str = "network-planning-tool-secret-key-2024"
    LICENSE_EXPIRY_DAYS: int = 365

    # 任务配置
    MAX_TASKS: int = 10
    TASK_TIMEOUT: int = 3600  # 1小时

    # 地图配置
    DEFAULT_MAP_CENTER: tuple = (39.9042, 116.4074)  # 北京
    DEFAULT_MAP_ZOOM: int = 10
    AMAP_API_KEY: str = "5299af602f4ee3cd7351c1bc7f32b1cb"  # 高德地图API Key
    AMAP_SECURITY_CODE: str = ""  # 高德地图安全密钥

    # PCI规划默认配置
    DEFAULT_PCI_DISTANCE_THRESHOLD: float = 3.0
    DEFAULT_PCI_MODULUS: int = 3

    # 邻区规划默认配置
    DEFAULT_NEIGHBOR_MAX_DISTANCE: float = 10.0
    DEFAULT_NEIGHBOR_MAX_COUNT: int = 32

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
