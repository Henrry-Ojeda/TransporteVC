$startupPath = [System.Environment]::GetFolderPath('Startup')
$shortcutPath = Join-Path $startupPath "Transporte_V2_AutoInicio.lnk"

Write-Host "==================================================================" -ForegroundColor Yellow
Write-Host "  DESACTIVANDO AUTO-INICIO DE TRANSPORTE V2" -ForegroundColor Yellow
Write-Host "==================================================================" -ForegroundColor Yellow
Write-Host ""

if (Test-Path $shortcutPath) {
    Remove-Item -Path $shortcutPath -Force
    Write-Host "[OK] Auto-inicio eliminado correctamente de la carpeta de inicio de Windows." -ForegroundColor Green
} else {
    Write-Host "[INFO] No habia ningun acceso directo de auto-inicio en la carpeta de inicio." -ForegroundColor DarkGray
}

Write-Host ""
Write-Host "==================================================================" -ForegroundColor Yellow
