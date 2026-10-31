Write-Output "Compilando arquitectura de componentes..."
node Frontend\build_components.js
node Frontend\generate_templates.js

$targets = @(
    "Backend\src\Transporte.API\wwwroot",
    "Backend\src\Transporte.API\bin\Debug\net8.0\wwwroot"
)

foreach ($target in $targets) {
    if (Test-Path $target) {
        Write-Output "Sincronizando hacia $target ..."
        robocopy Frontend $target /E /IS /IT /XD node_modules .git /NFL /NDL /NJH /NJS | Out-Null
    }
}

Write-Output "Sincronizacion completada con exito."
