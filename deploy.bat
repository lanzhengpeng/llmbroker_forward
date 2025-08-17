@echo off
setlocal enabledelayedexpansion

REM LLM Broker Forward 部署脚本 (Windows版本)
REM 使用方法: deploy.bat

echo 🚀 开始部署 LLM Broker Forward...
echo.

REM 1. 构建项目
echo 📦 构建项目...
call npm run build

if not exist "dist" (
    echo ❌ 构建失败，dist目录不存在
    pause
    exit /b 1
)

echo ✅ 构建完成
echo.

REM 2. 检查构建产物
echo 🔍 检查构建产物...
set "missing_files="

if not exist "dist\index.html" set "missing_files=!missing_files! index.html"
if not exist "dist\sql-wasm.wasm" set "missing_files=!missing_files! sql-wasm.wasm"
if not exist "dist\db\config.db" set "missing_files=!missing_files! db/config.db"

if not "!missing_files!"=="" (
    echo ❌ 缺少必要文件:!missing_files!
    pause
    exit /b 1
)

echo ✅ 构建产物检查通过
echo.

REM 3. 本地部署说明
echo 📍 构建完成，准备部署
echo.
echo 请将 dist/ 目录的内容部署到你的Web服务器
echo.
echo 📋 部署检查清单:
echo 1. 配置SPA路由支持 (所有路由回退到 index.html)
echo 2. 配置WASM文件MIME类型 (application/wasm)
echo 3. 确保后端API可访问: %VITE_API_TARGET%
echo 4. 检查CORS配置
echo.
echo 配置文件参考:
echo - Nginx: nginx.conf.example
echo - 详细说明: DEPLOYMENT.md
echo.
echo 🎉 构建完成！

pause
