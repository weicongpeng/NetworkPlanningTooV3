@echo off
REM Network Planning Tool - Simple Startup Script (No Virtual Environment)
setlocal enabledelayedexpansion

echo =====================================
echo   Network Planning Tool v2.0
echo   (Simple Startup - No VEnv)
echo =====================================
echo.

REM Check Python
echo [Check] Python environment...
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python not found
    echo Please install Python 3.11+ from: https://www.python.org/downloads/
    pause
    exit /b 1
)
python --version
echo.

REM Check Node.js
echo [Check] Node.js environment...
node --version >nul 2>&1
if errorlevel 1 (
    echo [WARNING] Node.js not found - Frontend may not work
    echo Please install Node.js 18+ from: https://nodejs.org/
    echo.
) else (
    node --version
    echo.
)

REM Install essential Python dependencies if needed
echo [1/3] Checking Python dependencies...
python -c "import fastapi" >nul 2>&1
if errorlevel 1 (
    echo Installing essential Python dependencies...
    echo This may take a few minutes...
    python -m pip install --upgrade pip --quiet
    pip install fastapi uvicorn python-multipart pandas openpyxl pydantic pydantic-settings cryptography aiofiles --quiet
    if errorlevel 1 (
        echo [ERROR] Failed to install dependencies
        echo.
        echo Try manually:
        echo   pip install fastapi uvicorn python-multipart pandas openpyxl pydantic pydantic-settings cryptography aiofiles
        pause
        exit /b 1
    )
    echo Dependencies installed successfully
) else (
    echo Python dependencies OK
)
echo.

REM Create required directories
echo [2/3] Creating required directories...
if not exist "backend\uploads" mkdir "backend\uploads"
if not exist "backend\outputs" mkdir "backend\outputs"
if not exist "backend\licenses" mkdir "backend\licenses"
if not exist "backend\data" mkdir "backend\data"
echo Directories ready
echo.

REM Start backend
echo [3/3] Starting backend service...
cd backend
start "NetworkTool-Backend" cmd /k "title Network Planning Tool - Backend && echo Starting backend on http://127.0.0.1:8000 && echo. && python main.py"
cd ..

echo.
echo Waiting for backend to start (3 seconds)...
timeout /t 3 /nobreak >nul

REM Check if Node.js is available before starting frontend
node --version >nul 2>&1
if not errorlevel 1 (
    echo Starting frontend service...
    cd frontend
    if exist "node_modules" (
        echo Frontend dependencies installed
    ) else (
        echo Installing frontend dependencies...
        echo This may take several minutes...
        call npm install
    )
    start "NetworkTool-Frontend" cmd /k "title Network Planning Tool - Frontend && echo Starting frontend on http://localhost:5173 && echo. && npm run dev"
    cd ..
    timeout /t 3 /nobreak >nul
)

echo.
echo =====================================
echo   Services Started!
echo =====================================
echo.
echo Backend:  http://127.0.0.1:8000
if not errorlevel 1 (
    echo Frontend: http://localhost:5173
)
echo API Docs: http://127.0.0.1:8000/docs
echo.
echo Press any key to close this window (services will continue running)...
pause >nul
