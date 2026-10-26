@echo off
cd /d "%~dp0"

echo [1/3] Sincronizando Frontend a wwwroot...
powershell -NoProfile -Command "Copy-Item -Path 'Frontend\*' -Destination 'Backend\src\Transporte.API\wwwroot\' -Recurse -Force; if (Test-Path 'Backend\src\Transporte.API\bin\Debug\net8.0') { Copy-Item -Path 'Frontend\*' -Destination 'Backend\src\Transporte.API\bin\Debug\net8.0\wwwroot\' -Recurse -Force }; if (Test-Path 'Backend\src\Transporte.API\bin\Release\net8.0') { Copy-Item -Path 'Frontend\*' -Destination 'Backend\src\Transporte.API\bin\Release\net8.0\wwwroot\' -Recurse -Force }"

echo [2/3] Levantando Servidor DEV (Puerto 5188)...
start "Transporte_DEV_5188" /min dotnet run --project Backend\src\Transporte.API\Transporte.API.csproj --urls "http://0.0.0.0:5188" --environment Development

echo [3/3] Levantando Servidor PROD (Puertos 5190 y 1590)...
start "Transporte_PROD_5190_1590" /min dotnet run --project Backend\src\Transporte.API\Transporte.API.csproj -c Release --urls "http://0.0.0.0:5190;http://0.0.0.0:1590" --environment Production

echo Servidores iniciados correctamente.
