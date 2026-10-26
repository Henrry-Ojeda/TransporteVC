$ws = New-Object -ComObject WScript.Shell
$startupPath = [System.Environment]::GetFolderPath('Startup')
$shortcutPath = Join-Path $startupPath "Transporte_V2_AutoInicio.lnk"
$repoPath = $PSScriptRoot

$shortcut = $ws.CreateShortcut($shortcutPath)
$shortcut.TargetPath = "wscript.exe"
$shortcut.Arguments = "`"$repoPath\AutoInicio_Transporte.vbs`""
$shortcut.WorkingDirectory = $repoPath
$shortcut.Description = "Auto-inicio del Sistema Transporte V2 (PROD y DEV)"
$shortcut.Save()

Write-Host "[OK] Acceso directo de Auto-Inicio configurado en:" -ForegroundColor Green
Write-Host "     $shortcutPath" -ForegroundColor Cyan
