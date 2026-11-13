@echo off
chcp 65001 >nul
title [BDBDG V1+V2+V3 Launcher]

echo ========================================================
echo   버전 1, 2, 3 로컬 서버를 순서대로 실행합니다...
echo   - 버전 1 (main)                    : http://localhost:3001
echo   - 버전 2 (design/unslop-redesign)  : http://localhost:3002
echo   - 버전 3 (feat/bdbdgmain3-menu-reorg): http://localhost:3003
echo ========================================================
echo.

start "[BDBDG V1 - 3001]" cmd /c "%~dp0run_v1.bat"
timeout /t 1 /nobreak >nul

start "[BDBDG V2 - 3002]" cmd /c "%~dp0run_v2.bat"
timeout /t 1 /nobreak >nul

start "[BDBDG V3 - 3003]" cmd /c "%~dp0run_v3.bat"

echo 모든 버전 실행 창을 열었습니다. 이 안내 창은 3초 후 자동으로 닫힙니다.
timeout /t 3 >nul
