Write-Output "Compilando arquitectura de componentes..."
node Frontend\build_components.js

$targets = @(
    "Backend\src\Transporte.API\wwwroot",
    "Backend\src\Transporte.API\bin\Release\net8.0\wwwroot",
    "Backend\src\Transporte.API\bin\Debug\net8.0\wwwroot",
    "Despliegue\Desarrollo\Transporte_App_DEV\wwwroot",
    "Despliegue\Transporte_App\wwwroot"
)

foreach ($target in $targets) {
    if (Test-Path $target) {
        Write-Output "Sincronizando hacia $target ..."
        Copy-Item -Path "Frontend\*" -Destination $target -Recurse -Force
    }
}

Write-Output "Sincronizacion completada con exito."
