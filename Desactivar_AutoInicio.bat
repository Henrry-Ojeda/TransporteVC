@echo off
title Desactivar Auto-Inicio de Transporte V2
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Desactivar_AutoInicio.ps1"
echo.
pause
