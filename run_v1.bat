@echo off
chcp 65001 >nul
title [BDBDG V1 - main] http://localhost:3001
node "%~dp0scripts\launch-version.mjs" v1
if errorlevel 1 (
    echo.
    pause
)
