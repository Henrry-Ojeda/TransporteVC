# ==============================================================================
# Auto-Inicio del Sistema Transporte V2 (PRODUCCION y DESARROLLO)
# ==============================================================================
$ErrorActionPreference = "SilentlyContinue"
$repoPath = $PSScriptRoot
Set-Location $repoPath

$logFile = Join-Path $repoPath "AutoInicio.log"
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
Add-Content -Path $logFile -Value "[$timestamp] Iniciando secuencia de Auto-Inicio..."

function Start-DetachedProcess {
    param(
        [string]$FilePath,
        [string]$Arguments,
        [string]$WorkingDirectory
    )
    try {
        $pinfo = New-Object System.Diagnostics.ProcessStartInfo
        $pinfo.FileName = $FilePath
        $pinfo.Arguments = $Arguments
        $pinfo.WorkingDirectory = $WorkingDirectory
        $pinfo.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Minimized
        $pinfo.UseShellExecute = $true
        [System.Diagnostics.Process]::Start($pinfo) | Out-Null
        return $true
    } catch {
        return $false
    }
}

# 1. Espera de cortesía de 3 segundos para que SQL Server esté listo
Start-Sleep -Seconds 3

# 2. Iniciar PRODUCCIÓN (Puerto 5190 | BD_TRANSPORTE_PROD)
$prodDir = Join-Path $repoPath "Despliegue\Produccion\Transporte_App_PROD"
$prodExe = Join-Path $prodDir "Transporte.API.exe"

$prodRunning = Get-NetTCPConnection -LocalPort 5190 -State Listen -ErrorAction SilentlyContinue
if (-not $prodRunning -and (Test-Path $prodExe)) {
    Start-DetachedProcess -FilePath $prodExe `
                         -Arguments "--environment Production --urls http://0.0.0.0:5190" `
                         -WorkingDirectory $prodDir
    Add-Content -Path $logFile -Value "[$timestamp] [OK] Produccion iniciado en puerto 5190."
} else {
    Add-Content -Path $logFile -Value "[$timestamp] [INFO] Produccion ya estaba activo o ejecutable no existe."
}

# 3. Sincronizar Frontend para DESARROLLO
$frontendDir = Join-Path $repoPath "Frontend"
$devWwwroot = Join-Path $repoPath "Backend\src\Transporte.API\wwwroot"
if (Test-Path $frontendDir) {
    Copy-Item -Path "$frontendDir\*" -Destination $devWwwroot -Recurse -Force
    $debugWwwroot = Join-Path $repoPath "Backend\src\Transporte.API\bin\Debug\net8.0\wwwroot"
    if (Test-Path (Join-Path $repoPath "Backend\src\Transporte.API\bin\Debug\net8.0")) {
        Copy-Item -Path "$frontendDir\*" -Destination $debugWwwroot -Recurse -Force
    }
}

# 4. Iniciar DESARROLLO (Puerto 5188 | BD_TRANSPORTE_DEV)
$devExe = Join-Path $repoPath "Backend\src\Transporte.API\bin\Debug\net8.0\Transporte.API.exe"
$devRunning = Get-NetTCPConnection -LocalPort 5188 -State Listen -ErrorAction SilentlyContinue
$devApiDir = Join-Path $repoPath "Backend\src\Transporte.API"

if (-not $devRunning) {
    if (Test-Path $devExe) {
        Start-DetachedProcess -FilePath $devExe `
                             -Arguments "--environment Development --urls http://0.0.0.0:5188" `
                             -WorkingDirectory $devApiDir
        Add-Content -Path $logFile -Value "[$timestamp] [OK] Desarrollo iniciado en puerto 5188."
    } else {
        Start-DetachedProcess -FilePath "dotnet" `
                             -Arguments "run --project Transporte.API.csproj --urls http://0.0.0.0:5188 --environment Development" `
                             -WorkingDirectory $devApiDir
        Add-Content -Path $logFile -Value "[$timestamp] [OK] Desarrollo iniciado con dotnet run en puerto 5188."
    }
} else {
    Add-Content -Path $logFile -Value "[$timestamp] [INFO] Desarrollo ya estaba activo en puerto 5188."
}

Add-Content -Path $logFile -Value "[$timestamp] Auto-Inicio finalizado con exito.`n"
