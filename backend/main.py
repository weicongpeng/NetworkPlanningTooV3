"""
网络规划工具 - FastAPI后端主程序
"""
import sys
import os
from pathlib import Path

# 添加项目根目录到Python路径
ROOT_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT_DIR))

import uvicorn
from app.api import create_app

app = create_app()

if __name__ == '__main__':
    # 开发服务器配置
    uvicorn.run(
        'main:app',
        host='127.0.0.1',
        port=8000,
        reload=True,
        log_level='info'
    )
