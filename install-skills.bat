@echo off
REM ========================================
REM Skills.sh 批量安装脚本
REM ========================================

echo.
echo ========================================
echo 正在安装热门 Skills...
echo ========================================
echo.

REM Top 热门仓库（包含多个技能）
echo [1/8] 安装 Vercel Agent Skills (React 最佳实践等)...
call npx skills add vercel-labs/agent-skills
if %errorlevel% neq 0 (
    echo   ⚠ 安装失败或已存在
)

echo.
echo [2/8] 安装 Expo Skills (React Native 等)...
call npx skills add expo/skills
if %errorlevel% neq 0 (
    echo   ⚠ 安装失败或已存在
)

echo.
echo [3/8] 安装 Anthropic Skills (官方技能集)...
call npx skills add anthropics/skills
if %errorlevel% neq 0 (
    echo   ⚠ 安装失败或已存在
)

echo.
echo [4/8] 安装 Better Auth Skills...
call npx skills add better-auth/skills
if %errorlevel% neq 0 (
    echo   ⚠ 安装失败或已存在
)

echo.
echo [5/8] 安装 Baoyu Skills (中文营销工具)...
call npx skills add jimliu/baoyu-skills
if %errorlevel% neq 0 (
    echo   ⚠ 安装失败或已存在
)

echo.
echo [6/8] 安装 CallStack Agent Skills (React Native)...
call npx skills add callstackincubator/agent-skills
if %errorlevel% neq 0 (
    echo   ⚠ 安装失败或已存在
)

echo.
echo [7/8] 安装 Vercel Agent Browser...
call npx skills add vercel-labs/agent-browser
if %errorlevel% neq 0 (
    echo   ⚠ 安装失败或已存在
)

echo.
echo [8/8] 安装 Humanizer 中文版...
call npx skills add op7418/Humanizer-zh
if %errorlevel% neq 0 (
    echo   ⚠ 安装失败或已存在
)

echo.
echo ========================================
echo ✓ 批量安装完成！
echo ========================================
echo.
echo 已安装的技能仓库:
echo   - vercel-labs/agent-skills (React 最佳实践)
echo   - expo/skills (React Native 开发)
echo   - anthropics/skills (官方技能)
echo   - better-auth/skills (认证最佳实践)
echo   - jimliu/baoyu-skills (中文营销)
echo   - callstackincubator/agent-skills (React Native)
echo   - vercel-labs/agent-browser (浏览器自动化)
echo   - op7418/Humanizer-zh (中文人性化)
echo.
pause
