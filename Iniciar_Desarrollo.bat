@echo off
title Sistema Transporte V2 - DESARROLLO (Puerto 5188)
cd /d "%~dp0"
echo ==================================================================
echo   SISTEMA TRANSPORTE V2 - AMBIENTE DE DESARROLLO (DEV)
echo   Base de Datos: BD_TRANSPORTE_DEV  ^|  Puerto: 5188
echo ==================================================================
echo.
echo [1/2] Compilando componentes y sincronizando Frontend -> wwwroot...
node Frontend\build_components.js
echo.
echo [2/2] Iniciando API en http://localhost:5188/ ...
set ASPNETCORE_ENVIRONMENT=Development
set ASPNETCORE_URLS=http://0.0.0.0:5188
start http://localhost:5188/
dotnet run --project Backend\src\Transporte.API\Transporte.API.csproj --urls "http://0.0.0.0:5188" --environment Development
pause
