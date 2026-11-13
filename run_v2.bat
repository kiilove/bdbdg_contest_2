@echo off
chcp 65001 >nul
title [BDBDG V2 - design/unslop-redesign] http://localhost:3002
node "%~dp0scripts\launch-version.mjs" v2
if errorlevel 1 (
    echo.
    pause
)
