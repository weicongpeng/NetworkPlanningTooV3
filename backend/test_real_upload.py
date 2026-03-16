import sys
import os
import asyncio
from pathlib import Path
import pandas as pd
from unittest.mock import MagicMock

# Add project root to path
ROOT_DIR = Path(__file__).parent
sys.path.insert(0, str(ROOT_DIR))

from app.services.data_service import data_service
from app.core.config import settings

class MockUploadFile:
    def __init__(self, filename, content):
        self.filename = filename
        self.content = content
        self.content_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        
    async def read(self):
        return self.content

async def test_upload_excel():
    print("Creating dummy Excel file...")
    
    # Create a dummy Excel file with required sheets
    df_lte = pd.DataFrame({
        'eNodeB标识': [1, 2],
        '小区标识': [10, 20],
        '基站名称': ['Site1', 'Site2'],
        '小区名称': ['Cell1', 'Cell2'],
        '经度': [120.1, 120.2],
        '纬度': [30.1, 30.2],
        '物理小区识别码': [100, 101],
        '下行链路的中心载频': [100, 100]
    })
    
    df_nr = pd.DataFrame({
        '移动国家码': [460],
        '移动网络码': [0],
        'gNodeB标识': [3],
        '小区标识': [30],
        '基站名称': ['Site3'],
        '小区名称': ['Cell3'],
        '经度': [120.3],
        '纬度': [30.3],
        '物理小区识别码': [200],
        '填写SSB频点': [633984]
    })
    
    dummy_file = Path("dummy_params.xlsx")
    with pd.ExcelWriter(dummy_file) as writer:
        df_lte.to_excel(writer, sheet_name='LTE Project Parameters', index=False)
        df_nr.to_excel(writer, sheet_name='NR Project Parameters', index=False)
        
    print(f"Dummy file created: {dummy_file.absolute()}")
    
    # Read content
    with open(dummy_file, "rb") as f:
        content = f.read()
        
    mock_file = MockUploadFile(dummy_file.name, content)
    
    print("\nCalling data_service.upload_excel...")
    try:
        result = await data_service.upload_excel(file=mock_file)
        print("\nSuccess!")
        print(result)
    except Exception as e:
        print(f"\nCaught Exception: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
    finally:
        if dummy_file.exists():
            os.remove(dummy_file)

if __name__ == "__main__":
    asyncio.run(test_upload_excel())
