@echo off
echo ===================================================
echo Network Planning Tool - Dependency Installer
echo ===================================================
echo.

echo Installing core dependencies...
pip install pandas numpy openpyxl cryptography
if errorlevel 1 (
    echo ERROR: Failed to install core dependencies
    pause
    exit /b 1
)

echo.
echo ===================================================
echo Installation completed!
echo ===================================================
echo.
echo You can now run the application with:
echo   run_gui.bat
echo.
pause
