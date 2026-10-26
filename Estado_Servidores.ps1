Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host "  ESTADO DE SERVIDORES TRANSPORTE V2" -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host ""

$servers = @(
    @{ Name = "PRODUCCION"; Port = 5190; Db = "BD_TRANSPORTE_PROD"; Url = "http://localhost:5190/" },
    @{ Name = "DESARROLLO"; Port = 5188; Db = "BD_TRANSPORTE_DEV";  Url = "http://localhost:5188/" }
)

foreach ($s in $servers) {
    $conn = Get-NetTCPConnection -LocalPort $s.Port -State Listen -ErrorAction SilentlyContinue
    if ($conn) {
        $pidNum = $conn[0].OwningProcess
        Write-Host (" [ACTIVO]   {0,-12} | Puerto: {1} | BD: {2,-18} | PID: {3}" -f $s.Name, $s.Port, $s.Db, $pidNum) -ForegroundColor Green
        Write-Host ("            -> URL: {0}" -f $s.Url) -ForegroundColor DarkGray
    } else {
        Write-Host (" [INACTIVO] {0,-12} | Puerto: {1} | BD: {2,-18}" -f $s.Name, $s.Port, $s.Db) -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "==================================================================" -ForegroundColor Cyan
