@echo off
title Transporte V2 - DESARROLLO Segundo Plano
cd /d "%~dp0"
set ASPNETCORE_ENVIRONMENT=Development
set ASPNETCORE_URLS=http://0.0.0.0:5188

echo Compilando y sincronizando Frontend...
node "%~dp0Frontend\build_components.js" >nul 2>&1

cd /d "%~dp0Backend\src\Transporte.API"
if exist "bin\Debug\net8.0\Transporte.API.exe" (
    start /min "" bin\Debug\net8.0\Transporte.API.exe --environment Development --urls http://0.0.0.0:5188
) else (
    start /min "" dotnet run --project Transporte.API.csproj --urls http://0.0.0.0:5188 --environment Development
)
