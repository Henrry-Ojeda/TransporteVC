@echo off
title Sistema Transporte V2 - Servidor Local
cd /d "%~dp0"
echo ========================================================
echo   SINCRONIZANDO FRONTEND Y ARRANCANDO SERVIDOR LOCAL
echo ========================================================
echo.
powershell -NoProfile -Command "Copy-Item -Path 'Frontend\*' -Destination 'Backend\src\Transporte.API\wwwroot\' -Recurse -Force"
echo Frontend sincronizado.
echo.
echo Iniciando backend en http://0.0.0.0:5188 ...
start http://localhost:5188/
dotnet run --project Backend\src\Transporte.API\Transporte.API.csproj --urls "http://0.0.0.0:5188"
pause
