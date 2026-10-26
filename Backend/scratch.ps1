$lines = [System.IO.File]::ReadAllLines("c:\Users\Usuario\source\repos\Transporte_V2\Frontend\js\app.js")
for ($i = 0; $i -lt $lines.Length; $i++) {
    $line = $lines[$i]
    if ($line -match "fetch\(" -and ($line -match "control-companias" -or $line -match "control-rutas" -or $line -match "receptoria" -or $line -match "entregas")) {
        $context = ""
        for ($j = [Math]::Max(0, $i - 2); $j -le [Math]::Min($lines.Length - 1, $i + 6); $j++) {
            $context += "$($j+1): $($lines[$j])`n"
        }
        Write-Host "=== MATCH AT LINE $($i+1) ==="
        Write-Host $context
    }
}
