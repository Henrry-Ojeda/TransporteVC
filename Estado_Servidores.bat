@echo off
title Estado de Servidores - Transporte V2
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Estado_Servidores.ps1"
echo.
pause
