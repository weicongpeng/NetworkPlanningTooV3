"""
许可证管理服务
"""
import os
import json
import hashlib
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
import base64

from app.core.config import settings
from app.models.schemas import LicenseStatus


class LicenseService:
    """许可证服务类"""

    def __init__(self):
        self.license_file = settings.LICENSE_DIR / "license.dat"
        self._cipher = self._create_cipher()

    def _create_cipher(self) -> Fernet:
        """创建加密器"""
        # 使用配置的密钥创建Fernet加密器
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=b'network-planning-tool-salt',
            iterations=100000,
        )
        key = base64.urlsafe_b64encode(kdf.derive(settings.LICENSE_SECRET_KEY.encode()))
        return Fernet(key)

    def _encrypt_license(self, license_data: Dict[str, Any]) -> str:
        """加密许可证数据"""
        json_data = json.dumps(license_data)
        return self._cipher.encrypt(json_data.encode()).decode()

    def _decrypt_license(self, encrypted_data: str) -> Dict[str, Any]:
        """解密许可证数据"""
        try:
            decrypted = self._cipher.decrypt(encrypted_data.encode())
            return json.loads(decrypted.decode())
        except Exception:
            raise ValueError("许可证文件损坏")

    def _generate_license_key(self, licensee: str, days: int = 365) -> str:
        """生成许可证密钥"""
        expiry_date = (datetime.now() + timedelta(days=days)).isoformat()
        data = {
            "licensee": licensee,
            "expiryDate": expiry_date,
            "features": ["pci_planning", "neighbor_planning", "map_viewing"]
        }

        # 生成签名
        signature = hashlib.sha256(
            f"{licensee}{expiry_date}{settings.LICENSE_SECRET_KEY}".encode()
        ).hexdigest()

        data["signature"] = signature
        return base64.b64encode(json.dumps(data).encode()).decode()

    def _validate_license_data(self, license_data: Dict[str, Any]) -> bool:
        """验证许可证数据"""
        try:
            # 检查过期时间
            expiry_date = datetime.fromisoformat(license_data["expiryDate"])
            if expiry_date < datetime.now():
                return False

            # 验证签名
            signature = hashlib.sha256(
                f"{license_data['licensee']}{license_data['expiryDate']}{settings.LICENSE_SECRET_KEY}".encode()
            ).hexdigest()

            if signature != license_data.get("signature"):
                return False

            return True
        except Exception:
            return False

    def get_status(self) -> LicenseStatus:
        """获取许可证状态"""
        if not self.license_file.exists():
            return LicenseStatus(
                valid=False,
                expiryDate="",
                licensee="",
                features=[]
            )

        try:
            with open(self.license_file, 'r', encoding='utf-8') as f:
                encrypted_data = f.read().strip()

            license_data = self._decrypt_license(encrypted_data)
            is_valid = self._validate_license_data(license_data)

            return LicenseStatus(
                valid=is_valid,
                expiryDate=license_data.get("expiryDate", ""),
                licensee=license_data.get("licensee", ""),
                licenseKey=encrypted_data[:20] + "...",
                features=license_data.get("features", [])
            )
        except Exception as e:
            print(f"读取许可证失败: {e}")
            return LicenseStatus(
                valid=False,
                expiryDate="",
                licensee="",
                features=[]
            )

    def activate(self, license_key: str) -> bool:
        """激活许可证"""
        try:
            # 解码许可证密钥
            try:
                decoded_data = base64.b64decode(license_key).decode()
                license_data = json.loads(decoded_data)
            except Exception:
                # 尝试直接作为密钥解析
                license_data = {"licenseKey": license_key}

            # 如果只有密钥，创建基本许可证
            if "licensee" not in license_data:
                # 简单验证：使用密钥哈希作为用户
                licensee = hashlib.md5(license_key.encode()).hexdigest()[:16]
                expiry_date = (datetime.now() + timedelta(days=settings.LICENSE_EXPIRY_DAYS)).isoformat()
                license_data = {
                    "licensee": f"USER-{licenseee.upper()}",
                    "expiryDate": expiry_date,
                    "features": ["pci_planning", "neighbor_planning", "map_viewing"]
                }

            # 验证许可证
            if not self._validate_license_data(license_data):
                return False

            # 保存许可证
            encrypted = self._encrypt_license(license_data)
            self.license_file.parent.mkdir(parents=True, exist_ok=True)

            with open(self.license_file, 'w', encoding='utf-8') as f:
                f.write(encrypted)

            return True
        except Exception as e:
            print(f"激活许可证失败: {e}")
            return False

    def validate(self, license_key: str) -> bool:
        """验证许可证密钥"""
        try:
            decoded_data = base64.b64decode(license_key).decode()
            license_data = json.loads(decoded_data)
            return self._validate_license_data(license_data)
        except Exception:
            return False

    def check_permission(self, feature: str) -> bool:
        """检查是否有某功能权限"""
        status = self.get_status()
        if not status.valid:
            return False
        return status.features is None or feature in status.features


# 创建全局实例
license_service = LicenseService()
