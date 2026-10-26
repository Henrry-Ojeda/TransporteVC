# ==============================================================================
# SCRIPT DE RESPALDO COMPLETO DEL PROYECTO TRANSPORTE (FRONTEND + BACKEND + BD)
# ==============================================================================

$fechaStamp = Get-Date -Format "yyyyMMdd_HHmmss"
$baseDir = "c:\Users\Usuario\source\repos\Transporte"
$backupDir = Join-Path $baseDir "Backups"
$tempStagingDir = Join-Path $backupDir "Staging_$fechaStamp"
$zipFile = Join-Path $backupDir "Transporte_BACKUP_COMPLETO_$fechaStamp.zip"
$localBakName = "BD_TRANSPORTE_$fechaStamp.bak"
$destinationBakFile = Join-Path $backupDir $localBakName

# Ruta nativa de SQL Server con permisos
$sqlDefaultBackupDir = "C:\Program Files\Microsoft SQL Server\MSSQL16.MSSQLSERVER\MSSQL\Backup"
$sqlTempBakPath = Join-Path $sqlDefaultBackupDir $localBakName

Write-Host ">>> INICIANDO RESPALDO COMPLETO DEL PROYECTO TRANSPORTE ($fechaStamp) <<<" -ForegroundColor Cyan

# 1. Asegurar directorio de Backups
if (-not (Test-Path $backupDir)) {
    New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
    Write-Host "Directorio creado: $backupDir"
}

# 2. Respaldo de Base de Datos SQL Server en ruta nativa y copiado al repositorio
Write-Host "1. Generando respaldo de base de datos BD_TRANSPORTE (.bak)..." -ForegroundColor Yellow
$backupSqlCmd = "BACKUP DATABASE [BD_TRANSPORTE] TO DISK = N'$sqlTempBakPath' WITH INIT, NOUNLOAD, NAME = N'BD_TRANSPORTE-Completo-$fechaStamp', SKIP, STATS = 10"

try {
    $conn = New-Object System.Data.SqlClient.SqlConnection("Server=localhost;Database=master;Integrated Security=True;TrustServerCertificate=True;")
    $conn.Open()
    $cmd = $conn.CreateCommand()
    $cmd.CommandText = $backupSqlCmd
    $cmd.CommandTimeout = 120
    $cmd.ExecuteNonQuery() | Out-Null
    $conn.Close()

    # Mover el archivo .bak a la carpeta Backups del proyecto
    if (Test-Path $sqlTempBakPath) {
        Copy-Item -Path $sqlTempBakPath -Destination $destinationBakFile -Force
        Remove-Item -Path $sqlTempBakPath -Force -ErrorAction SilentlyContinue
        $bakSizeMB = [math]::Round(((Get-Item $destinationBakFile).Length / 1MB), 2)
        Write-Host "   [OK] Respaldo de BD generado exitosamente: $destinationBakFile ($bakSizeMB MB)" -ForegroundColor Green
    }
} catch {
    Write-Host "   [ALERTA] Error al generar .bak: $($_.Exception.Message)" -ForegroundColor Red
}

# 3. Preparar carpeta de Staging para empaquetado limpio
Write-Host "2. Preparando archivos de código fuente (Frontend, Backend, Documentación)..." -ForegroundColor Yellow
if (Test-Path $tempStagingDir) { Remove-Item -Path $tempStagingDir -Recurse -Force }
New-Item -ItemType Directory -Path $tempStagingDir -Force | Out-Null

# Copiar Frontend completo
$destFrontend = Join-Path $tempStagingDir "Frontend"
Copy-Item -Path (Join-Path $baseDir "Frontend") -Destination $destFrontend -Recurse -Force
Write-Host "   [OK] Frontend copiado."

# Copiar Backend completo excluyendo 'bin', 'obj', '.vs'
$destBackend = Join-Path $tempStagingDir "Backend"
New-Item -ItemType Directory -Path $destBackend -Force | Out-Null

$backendFiles = Get-ChildItem -Path (Join-Path $baseDir "Backend") -Recurse | Where-Object {
    $_.FullName -notmatch '\\bin(\\|$)' -and
    $_.FullName -notmatch '\\obj(\\|$)' -and
    $_.FullName -notmatch '\\\.vs(\\|$)'
}

foreach ($item in $backendFiles) {
    $relative = $item.FullName.Substring((Join-Path $baseDir "Backend").Length + 1)
    $target = Join-Path $destBackend $relative
    if ($item.PSIsContainer) {
        if (-not (Test-Path $target)) { New-Item -ItemType Directory -Path $target -Force | Out-Null }
    } else {
        $parent = Split-Path $target -Parent
        if (-not (Test-Path $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
        Copy-Item -Path $item.FullName -Destination $target -Force
    }
}
Write-Host "   [OK] Backend copiado (código fuente limpio sin binarios temporales)."

# Copiar documentación, scripts y configs del raíz
$archivosRaiz = @(
    "DOCUMENTACION_BD_Y_PROCESO_LECHE.md",
    "AGENTS.md",
    "README.md",
    "crear_backup_completo.ps1"
)

foreach ($ar in $archivosRaiz) {
    $origen = Join-Path $baseDir $ar
    if (Test-Path $origen) {
        Copy-Item -Path $origen -Destination (Join-Path $tempStagingDir $ar) -Force
        Write-Host "   [OK] Incluido archivo raíz: $ar"
    }
}

# Incluir copia del backup .bak si se generó
if (Test-Path $destinationBakFile) {
    $destDbBak = Join-Path $tempStagingDir "BaseDeDatos"
    New-Item -ItemType Directory -Path $destDbBak -Force | Out-Null
    Copy-Item -Path $destinationBakFile -Destination (Join-Path $destDbBak $localBakName) -Force
    Write-Host "   [OK] Incluido archivo .bak de la Base de Datos en el paquete."
}

# 4. Crear archivo ZIP Comprimido
Write-Host "3. Comprimiendo todo el paquete en archivo ZIP..." -ForegroundColor Yellow
if (Test-Path $zipFile) { Remove-Item -Path $zipFile -Force }

Compress-Archive -Path "$tempStagingDir\*" -DestinationPath $zipFile -CompressionLevel Optimal

# 5. Limpieza de carpeta temporal staging
Remove-Item -Path $tempStagingDir -Recurse -Force

$zipSizeMB = [math]::Round(((Get-Item $zipFile).Length / 1MB), 2)
Write-Host "`n==============================================================================" -ForegroundColor Green
Write-Host ">>> RESPALDO COMPLETADO CON ÉXITO <<<" -ForegroundColor Green
Write-Host "Archivo ZIP: $zipFile" -ForegroundColor Cyan
Write-Host "Tamaño ZIP:  $zipSizeMB MB" -ForegroundColor Cyan
if (Test-Path $destinationBakFile) {
    Write-Host "Archivo BAK: $destinationBakFile ($bakSizeMB MB)" -ForegroundColor Cyan
}
Write-Host "==============================================================================" -ForegroundColor Green
