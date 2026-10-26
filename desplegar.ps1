# ==============================================================================
# Script de Despliegue Profesional - Sistema Transporte V2
# Ambientes: DESARROLLO (Puerto 5188 / BD_TRANSPORTE_DEV) y PRODUCCION (Puerto 5190 / BD_TRANSPORTE_PROD)
# ==============================================================================
param(
    [ValidateSet("All", "Production", "Development")]
    [string]$TargetEnv = "All"
)

$ErrorActionPreference = "Stop"
$rootPath = $PSScriptRoot
Set-Location $rootPath

Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host "  SISTEMA DE DESPLIEGUE MULTI-AMBIENTE - TRANSPORTE V2           " -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan

# 1. Compilación de componentes y sincronización del Frontend a wwwroot
Write-Host "`n[1/3] Compilando componentes React-like y sincronizando Frontend -> wwwroot..." -ForegroundColor Yellow
$frontendPath = Join-Path $rootPath "Frontend"
$wwwrootPath = Join-Path $rootPath "Backend\src\Transporte.API\wwwroot"

node (Join-Path $frontendPath "build_components.js")
Write-Host " -> Componentes compilados y Frontend sincronizado correctamente." -ForegroundColor Green

# Función interna para publicar un ambiente específico
function Publish-Environment {
    param(
        [string]$EnvName,      # "Production" o "Development"
        [string]$OutputDir,    # e.g. "Despliegue\Produccion\Transporte_App_PROD"
        [int]$Port,            # 5190 o 5188
        [string]$DbName        # "BD_TRANSPORTE_PROD" o "BD_TRANSPORTE_DEV"
    )

    Write-Host "`n------------------------------------------------------------------" -ForegroundColor DarkCyan
    Write-Host " Publicando Ambiente: $EnvName (Puerto: $Port | BD: $DbName)" -ForegroundColor Cyan
    Write-Host "------------------------------------------------------------------" -ForegroundColor DarkCyan

    $deployTarget = Join-Path $rootPath $OutputDir
    
    # Detener procesos previos que utilicen el puerto o bloqueen archivos del directorio
    try {
        Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue | ForEach-Object {
            Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
        }
        Get-Process -Name "Transporte.API" -ErrorAction SilentlyContinue | Where-Object { $_.Path -like "$deployTarget*" } | ForEach-Object {
            Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
        }
        Start-Sleep -Milliseconds 500
    } catch {}

    if (Test-Path $deployTarget) {
        Write-Host " -> Limpiando directorio previo: $deployTarget" -ForegroundColor DarkGray
        Remove-Item -Path $deployTarget -Recurse -Force
    }

    $projectPath = Join-Path $rootPath "Backend\src\Transporte.API\Transporte.API.csproj"
    
    # dotnet publish
    dotnet publish $projectPath -c Release -o $deployTarget --nologo
    if ($LASTEXITCODE -ne 0) {
        throw "Error al compilar y publicar para $EnvName"
    }

    # Copiar el appsettings correspondiente como appsettings.json principal en el destino
    $envConfigFile = Join-Path $rootPath "Backend\src\Transporte.API\appsettings.$EnvName.json"
    if (Test-Path $envConfigFile) {
        Copy-Item -Path $envConfigFile -Destination (Join-Path $deployTarget "appsettings.json") -Force
        Copy-Item -Path $envConfigFile -Destination (Join-Path $deployTarget "appsettings.$EnvName.json") -Force
    }

    # Eliminar el appsettings del entorno contrario para evitar interferencias
    $oppositeEnv = if ($EnvName -eq "Production") { "Development" } else { "Production" }
    $oppositeFile = Join-Path $deployTarget "appsettings.$oppositeEnv.json"
    if (Test-Path $oppositeFile) {
        Remove-Item -Path $oppositeFile -Force
    }

    # Generar scripts de ejecución para este ambiente
    $envPrefix = if ($EnvName -eq "Production") { "PRODUCCION" } else { "DESARROLLO" }

    # Iniciar
    $iniciarBat = @"
@echo off
title Sistema Transporte V2 - $envPrefix (Puerto $Port)
cd /d "%~dp0"
set ASPNETCORE_ENVIRONMENT=$EnvName
set ASPNETCORE_URLS=http://0.0.0.0:$Port
echo ==================================================================
echo   SISTEMA TRANSPORTE V2 - AMBIENTE $envPrefix
echo   PUERTO: $Port ^| BASE DE DATOS: $DbName
echo   URL: http://localhost:$Port/
echo ==================================================================
echo.
start http://localhost:$Port/
if exist "Transporte.API.exe" (
    Transporte.API.exe --environment $EnvName --urls http://0.0.0.0:$Port
) else (
    dotnet Transporte.API.dll --environment $EnvName --urls http://0.0.0.0:$Port
)
pause
"@
    Set-Content -Path (Join-Path $deployTarget "Iniciar_$envPrefix.bat") -Value $iniciarBat -Encoding ASCII

    # Iniciar Segundo Plano
    $segundoPlanoBat = @"
@echo off
title Transporte V2 - $envPrefix Segundo Plano
cd /d "%~dp0"
set ASPNETCORE_ENVIRONMENT=$EnvName
set ASPNETCORE_URLS=http://0.0.0.0:$Port
echo Iniciando Transporte V2 ($envPrefix) en puerto $Port...
if exist "Transporte.API.exe" (
    start /min "" Transporte.API.exe --environment $EnvName --urls http://0.0.0.0:$Port
) else (
    start /min "" dotnet Transporte.API.dll --environment $EnvName --urls http://0.0.0.0:$Port
)
timeout /t 2 /nobreak >nul
start http://localhost:$Port/
echo Servidor iniciado en http://localhost:$Port/
"@
    Set-Content -Path (Join-Path $deployTarget "Iniciar_Segundo_Plano.bat") -Value $segundoPlanoBat -Encoding ASCII

    # Detener
    $detenerBat = @"
@echo off
title Detener Transporte V2 - $envPrefix
echo Deteniendo instancias de Transporte V2 ($envPrefix)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":$Port" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a 2>nul
)
echo Proceso en puerto $Port detenido.
pause
"@
    Set-Content -Path (Join-Path $deployTarget "Detener_$envPrefix.bat") -Value $detenerBat -Encoding ASCII

    # Firewall
    $firewallBat = @"
@echo off
echo ==================================================================
echo   CONFIGURACION FIREWALL ($envPrefix - PUERTO $Port)
echo ==================================================================
echo Requiere permisos de Administrador.
netsh advfirewall firewall add rule name="Transporte V2 $envPrefix (Puerto $Port)" dir=in action=allow protocol=TCP localport=$Port
echo.
echo Regla habilitada para el puerto $Port. Acceso permitido desde red LAN/WiFi.
pause
"@
    Set-Content -Path (Join-Path $deployTarget "Configurar_Firewall.bat") -Value $firewallBat -Encoding ASCII

    Write-Host " -> $EnvName desplegado exitosamente en: $deployTarget" -ForegroundColor Green
}

# 2. Ejecutar despliegues según parámetro
if ($TargetEnv -eq "All" -or $TargetEnv -eq "Production") {
    Publish-Environment -EnvName "Production" -OutputDir "Despliegue\Produccion\Transporte_App_PROD" -Port 5190 -DbName "BD_TRANSPORTE_PROD"
}

if ($TargetEnv -eq "All" -or $TargetEnv -eq "Development") {
    Publish-Environment -EnvName "Development" -OutputDir "Despliegue\Desarrollo\Transporte_App_DEV" -Port 5188 -DbName "BD_TRANSPORTE_DEV"
}

# 3. Resumen Final
Write-Host "`n==================================================================" -ForegroundColor Green
Write-Host " DESPLIEGUE MULTI-AMBIENTE COMPLETADO CON EXITO                  " -ForegroundColor Green
Write-Host "==================================================================" -ForegroundColor Green
Write-Host "1. PRODUCCION:" -ForegroundColor Yellow
Write-Host "   - Directorio: Despliegue\Produccion\Transporte_App_PROD" -ForegroundColor White
Write-Host "   - Puerto: 5190 | Base de Datos: BD_TRANSPORTE_PROD" -ForegroundColor White
Write-Host "   - Ejecutable: Despliegue\Produccion\Transporte_App_PROD\Iniciar_PRODUCCION.bat" -ForegroundColor Cyan
Write-Host "`n2. DESARROLLO:" -ForegroundColor Yellow
Write-Host "   - Directorio: Despliegue\Desarrollo\Transporte_App_DEV" -ForegroundColor White
Write-Host "   - Puerto: 5188 | Base de Datos: BD_TRANSPORTE_DEV" -ForegroundColor White
Write-Host "   - Ejecutable: Despliegue\Desarrollo\Transporte_App_DEV\Iniciar_DESARROLLO.bat" -ForegroundColor Cyan
Write-Host "==================================================================`n" -ForegroundColor Green
