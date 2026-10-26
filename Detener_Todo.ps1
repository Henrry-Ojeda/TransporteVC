Write-Host "==================================================================" -ForegroundColor Yellow
Write-Host "  DETENIENDO SERVIDORES DE TRANSPORTE V2" -ForegroundColor Yellow
Write-Host "==================================================================" -ForegroundColor Yellow
Write-Host ""

$ports = @(5188, 5190)

foreach ($p in $ports) {
    $conns = Get-NetTCPConnection -LocalPort $p -ErrorAction SilentlyContinue
    if ($conns) {
        foreach ($c in $conns) {
            try {
                $proc = Get-Process -Id $c.OwningProcess -ErrorAction SilentlyContinue
                Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue
                Write-Host ("[OK] Proceso en puerto {0} (PID {1} - {2}) detenido." -f $p, $c.OwningProcess, $proc.ProcessName) -ForegroundColor Green
            } catch {}
        }
    } else {
        Write-Host ("[INFO] Puerto {0} no estaba en ejecucion." -f $p) -ForegroundColor DarkGray
    }
}

Write-Host ""
Write-Host "Todos los servicios han sido detenidos correctamente." -ForegroundColor Green
Write-Host "==================================================================" -ForegroundColor Yellow
