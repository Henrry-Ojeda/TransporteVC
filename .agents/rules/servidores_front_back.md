# Regla: Levantar Frontend y Backend

## Instrucción de Ejecución Permanente
Siempre que se trabaje en esta base de código o ante cualquier modificación:

1. **Sincronización del Frontend al Backend:**
   Antes de levantar el servidor, sincronizar siempre los archivos desde `Frontend/` a `Backend/src/Transporte.API/wwwroot/`:
   ```powershell
   Copy-Item -Path "Frontend\*" -Destination "Backend\src\Transporte.API\wwwroot\" -Recurse -Force
   ```

2. **Ejecución del Servidor Unificado (Frontend + Backend API):**
   Asegurar que la API en .NET esté compilada y corriendo en segundo plano:
   ```powershell
   dotnet run --project Backend\src\Transporte.API\Transporte.API.csproj
   ```

3. **Verificación:**
   - Frontend UI y PWA: `http://localhost:5186/`
   - Documentación Swagger API: `http://localhost:5186/swagger`
