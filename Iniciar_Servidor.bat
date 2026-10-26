@echo off
title Sistema Transporte V2 - Servidor Local
cd /d "%~dp0"
echo ========================================================
echo   COMPILANDO FRONTEND Y ARRANCANDO SERVIDOR LOCAL
echo ========================================================
echo.
node Frontend\build_components.js
echo.
echo Iniciando aplicacion en http://localhost:5188 ...
start http://localhost:5188/
dotnet run --project Backend\src\Transporte.API\Transporte.API.csproj --urls "http://0.0.0.0:5188"
pause
