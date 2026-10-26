@echo off
title Despliegue de Proyecto Transporte V2
cd /d "%~dp0"
echo ========================================================
echo   EJECUTANDO DESPLIEGUE AUTOMATICO DE TRANSPORTE V2
echo ========================================================
powershell -ExecutionPolicy Bypass -File "%~dp0desplegar.ps1"
if %ERRORLEVEL% neq 0 (
    echo.
    echo [ERROR] Hubo un error durante el despliegue.
)
pause
