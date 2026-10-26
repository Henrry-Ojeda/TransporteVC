# Script de configuracion de inicio automatico y host local
$hostsPath = "$env:windir\System32\drivers\etc\hosts"
$hostsContent = [System.IO.File]::ReadAllText($hostsPath)

if ($hostsContent -notmatch "transportevc") {
    $entry = "`r`n127.0.0.1 transportevc`r`n::1 transportevc`r`n"
    [System.IO.File]::AppendAllText($hostsPath, $entry)
    Write-Output "Hosts actualizado con transportevc"
} else {
    Write-Output "transportevc ya estaba en el archivo hosts"
}
