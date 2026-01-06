"""
网络规划工具 - FastAPI后端主程序
"""
import sys
import os
from pathlib import Path

# 【重要】必须在最前面配置编码，避免Windows下GBK编码问题
# 方法1：设置环境变量（优先级最高）
os.environ['PYTHONIOENCODING'] = 'utf-8'
os.environ['PYTHONUTF8'] = '1'

# 方法2：覆盖内置的 print 函数，确保所有输出都是安全的
_original_print = print
def _safe_print(*args, **kwargs):
    """安全的print函数，处理编码错误"""
    try:
        _original_print(*args, **kwargs)
    except UnicodeEncodeError:
        # 如果遇到编码错误，尝试用GBK安全的方式打印（Windows默认编码）
        safe_args = []
        for arg in args:
            if isinstance(arg, str):
                # 替换无法编码的字符
                safe_arg = arg.encode('gbk', errors='replace').decode('gbk')
                safe_args.append(safe_arg)
            else:
                safe_args.append(arg)
        _original_print(*safe_args, **kwargs)

# 替换全局print函数
import builtins
builtins.print = _safe_print

# 方法3：配置stdout/stderr
if sys.platform == 'win32':
    try:
        # Python 3.7+ 支持的方法
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        # 降级方案：使用TextIOWrapper
        try:
            import io
            sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
            sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')
        except:
            pass

# 添加项目根目录到Python路径
ROOT_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT_DIR))

import uvicorn
from app.api import create_app

app = create_app()

if __name__ == '__main__':
    # 开发服务器配置
    # 注意：reload 模式下需要在启动命令中设置 PYTHONIOENCODING=utf-8
    # 或者在 uvicorn 配置中设置环境变量
    uvicorn.run(
        'main:app',
        host='127.0.0.1',
        port=8000,
        reload=True,
        log_level='warning',  # 降低日志级别
        access_log=False,    # 禁用访问日志避免编码问题
        use_colors=False      # 禁用颜色避免编码问题
    )
