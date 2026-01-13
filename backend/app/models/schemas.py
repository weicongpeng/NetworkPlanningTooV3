"""
数据模型定义
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any, TypeVar, Generic
from datetime import datetime
from enum import Enum

T = TypeVar('T')


class NetworkType(str, Enum):
    """网络类型枚举"""
    LTE = "LTE"
    NR = "NR"


class TaskStatus(str, Enum):
    """任务状态枚举"""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class DataType(str, Enum):
    """数据类型枚举"""
    EXCEL = "excel"
    MAP = "map"


class DataStatus(str, Enum):
    """数据状态枚举"""
    PROCESSING = "processing"
    READY = "ready"
    ERROR = "error"


# ============== 许可证相关 ==============
class LicenseStatus(BaseModel):
    """许可证状态"""
    valid: bool
    expiryDate: str
    licensee: str
    licenseKey: Optional[str] = None
    features: Optional[List[str]] = None


class LicenseActivateRequest(BaseModel):
    """许可证激活请求"""
    license_key: str


class LicenseResponse(BaseModel):
    """许可证响应"""
    success: bool
    message: Optional[str] = None


class UpdateParametersRequest(BaseModel):
    """工参更新请求"""
    fullParamId: str
    currentParamId: str


class ImportPointsRequest(BaseModel):
    """导入点数据请求"""
    file_path: str


# ============== 数据管理相关 ==============
class UploadResponse(BaseModel):
    """上传响应"""
    id: str
    name: str
    status: str


class DataItem(BaseModel):
    """数据项"""
    id: str
    name: str
    type: DataType
    fileType: Optional[str] = None  # 添加fileType字段
    originalPath: Optional[str] = None # 原始文件路径
    size: int
    uploadDate: str
    status: DataStatus
    metadata: Optional[Dict[str, Any]] = None


class SectorData(BaseModel):
    """小区数据"""
    id: str
    siteId: str
    name: str
    longitude: float
    latitude: float
    azimuth: float
    beamwidth: float = Field(default=65)
    height: float = Field(default=30)
    pci: Optional[int] = None
    earfcn: Optional[int] = None
    arfcn: Optional[int] = None
    cell_cover_type: Optional[int] = Field(default=1, description="小区覆盖类型: 1=室外小区, 4=室内小区")
    is_shared: Optional[str] = None


class SiteData(BaseModel):
    """基站数据"""
    id: str
    name: str
    longitude: float
    latitude: float
    networkType: NetworkType
    pci: Optional[int] = None
    earfcn: Optional[int] = None
    arfcn: Optional[int] = None
    sectors: List[SectorData] = []


# ============== PCI规划相关 ==============
class PCIRange(BaseModel):
    """PCI范围"""
    min: int = Field(default=0, ge=0)
    max: int = Field(default=503, ge=0)

class PCIConfig(BaseModel):
    """PCI规划配置"""
    networkType: NetworkType
    distanceThreshold: float = Field(default=3.0, ge=0.1, le=50.0)
    pciModulus: int = Field(default=3, ge=1, le=50)
    inheritModulus: bool = Field(default=False, description="是否继承全量工参小区对应的模3或模30")
    pciRange: Optional[PCIRange] = None
    customRules: Optional[List[Dict[str, Any]]] = None


class PCIConflict(BaseModel):
    """PCI冲突"""
    type: str  # 'collision' or 'confusion'
    sector1: str
    sector2: str
    pci: int


class SectorPCIResult(BaseModel):
    """小区PCI规划结果"""
    sectorId: str
    sectorName: str
    originalPCI: Optional[int] = None
    newPCI: int
    collisionCount: int = 0
    confusionCount: int = 0


class SitePCIResult(BaseModel):
    """基站PCI规划结果"""
    siteId: str
    siteName: str
    sectors: List[SectorPCIResult]
    conflicts: Optional[List[PCIConflict]] = None


class PCIResult(BaseModel):
    """PCI规划结果"""
    taskId: str
    status: TaskStatus
    progress: float = Field(ge=0, le=100)
    totalSites: int
    collisions: int
    confusions: int
    results: List[SitePCIResult] = []
    startTime: str
    endTime: Optional[str] = None


# ============== 邻区规划相关 ==============
class NeighborConfig(BaseModel):
    """邻区规划配置"""
    planningType: str = Field(default="LTE-LTE", description="邻区规划类型: LTE-LTE, NR-NR, NR-LTE")
    maxDistance: float = Field(default=3.0, ge=0.1, le=100.0)
    maxNeighbors: int = Field(default=32, ge=1, le=128)
    customRules: Optional[List[Dict[str, Any]]] = None

    @property
    def sourceType(self) -> NetworkType:
        """从planningType解析源网络类型"""
        return NetworkType(self.planningType.split('-')[0])

    @property
    def targetType(self) -> NetworkType:
        """从planningType解析目标网络类型"""
        return NetworkType(self.planningType.split('-')[1])


class NeighborRelation(BaseModel):
    """邻区关系"""
    sourceSector: str
    targetSector: str
    targetSite: str
    distance: float
    relationType: str  # 'LTE-LTE', 'LTE-NR', 'NR-LTE', 'NR-NR'


class SectorNeighborResult(BaseModel):
    """小区邻区规划结果"""
    sectorId: str
    sectorName: str
    neighbors: List[NeighborRelation] = []


class SiteNeighborResult(BaseModel):
    """基站邻区规划结果"""
    siteId: str
    siteName: str
    sectors: List[SectorNeighborResult]


class NeighborResult(BaseModel):
    """邻区规划结果"""
    taskId: str
    status: TaskStatus
    progress: float = Field(ge=0, le=100)
    totalSites: int
    totalNeighbors: int
    avgNeighbors: float
    results: List[SiteNeighborResult] = []
    startTime: str
    endTime: Optional[str] = None


# ============== 地图相关 ==============
class OnlineMapConfig(BaseModel):
    """在线地图配置"""
    provider: str = Field(default="openstreetmap")
    apiKey: Optional[str] = None
    style: str = Field(default="standard")


class OfflineMapConfig(BaseModel):
    """离线地图配置"""
    path: str
    format: str = Field(default="mbtiles")
    minZoom: int = Field(default=0, ge=0, le=20)
    maxZoom: int = Field(default=18, ge=0, le=20)


class MapBounds(BaseModel):
    """地图边界"""
    north: float
    south: float
    east: float
    west: float


class MapCenter(BaseModel):
    """地图中心"""
    latitude: float
    longitude: float


class MapData(BaseModel):
    """地图数据"""
    sites: List[SiteData] = []
    bounds: MapBounds
    center: MapCenter


# ============== 通用响应 ==============
class ApiResponse(BaseModel, Generic[T]):
    """通用API响应"""
    success: bool
    data: Optional[T] = None
    message: Optional[str] = None
    code: Optional[int] = None
