@echo off
title Transporte V2 - DESARROLLO Segundo Plano
cd /d "%~dp0"
set ASPNETCORE_ENVIRONMENT=Development
set ASPNETCORE_URLS=http://0.0.0.0:5188

echo Sincronizando Frontend...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Copy-Item -Path 'Frontend\*' -Destination 'Backend\src\Transporte.API\wwwroot\' -Recurse -Force; if (Test-Path 'Backend\src\Transporte.API\bin\Debug\net8.0') { Copy-Item -Path 'Frontend\*' -Destination 'Backend\src\Transporte.API\bin\Debug\net8.0\wwwroot\' -Recurse -Force }" >nul 2>&1

cd /d "%~dp0Backend\src\Transporte.API"
if exist "bin\Debug\net8.0\Transporte.API.exe" (
    start /min "" bin\Debug\net8.0\Transporte.API.exe --environment Development --urls http://0.0.0.0:5188
) else (
    start /min "" dotnet run --project Transporte.API.csproj --urls http://0.0.0.0:5188 --environment Development
)
