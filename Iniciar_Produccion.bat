@echo off
title Sistema Transporte V2 - PRODUCCION (Puerto 5190)
cd /d "%~dp0"
echo ==================================================================
echo   SISTEMA TRANSPORTE V2 - AMBIENTE DE PRODUCCION (PROD)
echo   Base de Datos: BD_TRANSPORTE_PROD  ^|  Puerto: 5190
echo ==================================================================
echo.
echo [1/2] Sincronizando Frontend -> wwwroot...
powershell -NoProfile -Command "Copy-Item -Path 'Frontend\*' -Destination 'Backend\src\Transporte.API\wwwroot\' -Recurse -Force; if (Test-Path 'Backend\src\Transporte.API\bin\Release\net8.0') { Copy-Item -Path 'Frontend\*' -Destination 'Backend\src\Transporte.API\bin\Release\net8.0\wwwroot\' -Recurse -Force }"
echo.
echo [2/2] Iniciando API en http://localhost:5190/ ...
set ASPNETCORE_ENVIRONMENT=Production
set ASPNETCORE_URLS=http://0.0.0.0:5190;http://0.0.0.0:1590
start http://localhost:5190/
dotnet run --project Backend\src\Transporte.API\Transporte.API.csproj -c Release --urls "http://0.0.0.0:5190;http://0.0.0.0:1590" --environment Production
pause
