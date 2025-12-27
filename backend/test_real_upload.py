"""
完整模拟真实上传流程，捕获详细错误
"""
import sys
from pathlib import Path
ROOT_DIR = Path(__file__).parent
sys.path.insert(0, str(ROOT_DIR))

import asyncio
import traceback

# 模拟上传
async def test_real_upload():
    from app.services.data_service import data_service
    from io import BytesIO
    
    test_file_path = r'D:\mycode\NetworkPlanningTooV2\全量工参\ProjectParameter_mongoose河源电联20251225110859.xlsx'
    
    print("="*80)
    print("模拟真实上传流程")
    print("="*80)
    
    # 创建模拟的UploadFile对象
    class MockUploadFile:
        def __init__(self, file_path):
            self.filename = Path(file_path).name
            self._file_path = file_path
            
        async def read(self):
            with open(self._file_path, 'rb') as f:
                return f.read()
    
    mock_file = MockUploadFile(test_file_path)
    print(f"\n文件: {mock_file.filename}")
    
    try:
        print("\n调用 data_service.upload_excel()...")
        result = await data_service.upload_excel(mock_file)
        
        print("\n✅ 上传成功!")
        print(f"结果: {result}")
        
    except ValueError as e:
        print(f"\n❌ ValueError: {e}")
        traceback.print_exc()
        
    except OSError as e:
        print(f"\n❌ OSError [Errno {e.errno}]: {e}")
        traceback.print_exc()
        
    except Exception as e:
        print(f"\n❌ 未预期的错误: {type(e).__name__}: {e}")
        traceback.print_exc()
    
    print("\n" + "="*80)

if __name__ == "__main__":
    asyncio.run(test_real_upload())
