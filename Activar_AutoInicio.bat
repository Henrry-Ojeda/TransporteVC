@echo off
title Activar Auto-Inicio de Transporte V2
cd /d "%~dp0"
echo ==================================================================
echo   CONFIGURANDO AUTO-INICIO DE TRANSPORTE V2 EN WINDOWS
echo ==================================================================
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Activar_AutoInicio.ps1"
echo.
echo ==================================================================
echo   [OK] El sistema arrancara automaticamente al encender la laptop!
echo   - Produccion:  http://localhost:5190/
echo   - Desarrollo:  http://localhost:5188/
echo ==================================================================
echo.
pause
