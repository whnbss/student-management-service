@echo off
rem ============================================================
rem  Pack Teaching Workbench for migration to another PC
rem  Creates workbench-migrate.zip in this folder (~15 MB).
rem  node_modules is excluded - run "npm install" on target PC.
rem  NOTE: for a 100% consistent database snapshot, close both
rem  dev server windows first (the zip still works if you forget,
rem  but the db copy is safest when servers are stopped).
rem ============================================================
setlocal
set "ROOT=%~dp0"
cd /d "%ROOT%"

if exist workbench-migrate.zip del workbench-migrate.zip

echo Packing source + data (excluding node_modules)...
tar.exe -a -c -f workbench-migrate.zip apps packages data docs certs package.json package-lock.json tsconfig.base.json start.bat README.md pack-migrate.bat

if errorlevel 1 (
  echo.
  echo [FAILED] tar error. Close the dev server windows and retry.
  pause
  exit /b 1
)

if not exist workbench-migrate.zip (
  echo.
  echo [FAILED] zip was not created. Close the dev server windows and retry.
  pause
  exit /b 1
)

echo.
echo [OK] Created: %ROOT%workbench-migrate.zip
for %%A in (workbench-migrate.zip) do echo Size: %%~zA bytes
echo.
echo Next steps:
echo   1. Send workbench-migrate.zip to the target PC via your phone
echo      (WeChat File Transfer / QQ / cloud drive) or a USB stick.
echo   2. On the target PC: install Node.js LTS 20+ from nodejs.org,
echo      unzip anywhere, then run: npm install
echo   3. IMPORTANT - if the target PC is NOT on the company intranet,
echo      edit start.bat and DELETE these lines (they hardcode the
echo      company proxy and will break AI calls elsewhere):
echo         set "NODE_EXTRA_CA_CERTS=..."
echo         set "NODE_USE_ENV_PROXY=1"
echo         set "HTTPS_PROXY=..."
echo         set "HTTP_PROXY=..."
echo   4. Double-click start.bat, open http://localhost:5173
echo      Login password and all student data travel inside data/app.db.
echo   5. Privacy: after the transfer, delete the zip from your phone
echo      and from the chat/cloud history (it contains student data).
echo.
pause
