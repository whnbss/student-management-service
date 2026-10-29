@echo off
title 教学工作台-生产模式
echo ========================================
echo   教学管理工作台 生产模式 一键启动
echo ========================================
echo.
REM 用法: start-prod.bat [--tunnel]
REM   --tunnel: 构建并启动服务后, 同时拉起 cloudflared 临时公网隧道（trycloudflare.com 随机域名, 无需账号）
REM 本文件必须保存为 ANSI/GBK 编码 + CRLF 换行, 否则 cmd 解析中文会乱码报错。

set "ROOT=%~dp0"
cd /d "%ROOT%"

REM 与 start.bat 一致的内网代理与公司根证书设置（AI 分析需要）
set "NODE_EXTRA_CA_CERTS=%ROOT%certs\corporate-ca.pem"
set "NODE_USE_ENV_PROXY=1"
if not defined HTTPS_PROXY set "HTTPS_PROXY=http://proxy.singapore.itsec.hihonor.com:8080"
if not defined HTTP_PROXY set "HTTP_PROXY=http://proxy.singapore.itsec.hihonor.com:8080"

REM 幂等：端口 3210 已有服务在监听则不重复构建与启动
netstat -ano | findstr ":3210" | findstr "LISTENING" >nul 2>nul
if not errorlevel 1 (
  echo [跳过] 端口 3210 已有服务在运行, 无需重复启动。
  goto tunnel
)

echo [1/3] 构建前端, 首次或代码更新后约需 30 秒...
call npm run build
if errorlevel 1 (
  echo 构建失败, 请检查上方报错信息。
  pause
  exit /b 1
)

echo [2/3] 启动服务: 单端口 3210, 同时提供网页与 API...
start "教学工作台-Prod" /D "%ROOT%apps\api" cmd /k npx tsx src/index.ts
timeout /t 3 /nobreak >nul

:tunnel
if /i not "%~1"=="--tunnel" goto done
echo [3/3] 启动 Cloudflare Tunnel 临时公网隧道...
start "Cloudflare-Tunnel" /D "%ROOT%" cmd /k node "%ROOT%scripts\tunnel.mjs" 3210
timeout /t 8 /nobreak >nul
echo 隧道窗口中会打印临时公网地址, 形如 https://xxxx.trycloudflare.com
echo 把该地址发给家长或在自己手机打开即可访问, 电脑关机或窗口关闭后失效。

:done
echo.
echo 启动完成!
echo   电脑访问: http://localhost:3210
echo   手机访问: http://本机IP:3210  需与电脑同一 WiFi, 地址见服务窗口打印。
echo   公网部署与固定域名, 详见 README.md 的「公网部署」章节。
echo.
pause
