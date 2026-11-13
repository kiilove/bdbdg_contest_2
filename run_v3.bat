@echo off
chcp 65001 >nul
title [BDBDG V3 - feat/bdbdgmain3-menu-reorg] http://localhost:3003
node "%~dp0scripts\launch-version.mjs" v3
if errorlevel 1 (
    echo.
    pause
)
