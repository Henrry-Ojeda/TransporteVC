@echo off
title Sistema Transporte V2 - DESARROLLO (Puerto 5188)
cd /d "%~dp0"
echo ==================================================================
echo   SISTEMA TRANSPORTE V2 - AMBIENTE DE DESARROLLO (DEV)
echo   Base de Datos: BD_TRANSPORTE_DEV  ^|  Puerto: 5188
echo ==================================================================
echo.
echo [1/2] Sincronizando Frontend -> wwwroot...
powershell -NoProfile -Command "Copy-Item -Path 'Frontend\*' -Destination 'Backend\src\Transporte.API\wwwroot\' -Recurse -Force; if (Test-Path 'Backend\src\Transporte.API\bin\Debug\net8.0') { Copy-Item -Path 'Frontend\*' -Destination 'Backend\src\Transporte.API\bin\Debug\net8.0\wwwroot\' -Recurse -Force }"
echo.
echo [2/2] Iniciando API en http://localhost:5188/ ...
set ASPNETCORE_ENVIRONMENT=Development
set ASPNETCORE_URLS=http://0.0.0.0:5188
start http://localhost:5188/
dotnet run --project Backend\src\Transporte.API\Transporte.API.csproj --urls "http://0.0.0.0:5188" --environment Development
pause
