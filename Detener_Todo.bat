@echo off
title Detener Transporte V2 (PROD y DEV)
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Detener_Todo.ps1"
echo.
pause
