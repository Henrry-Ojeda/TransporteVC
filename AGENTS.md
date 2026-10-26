# Instrucciones del Proyecto Transporte V2 (Arquitectura Multi-Ambiente)

Este proyecto cuenta con separación estricta y profesional entre **DESARROLLO (DEV)** y **PRODUCCIÓN (PROD)**:

### 🟢 Ambiente de Desarrollo (DEV)
- **Base de Datos**: `BD_TRANSPORTE_DEV` (SQL Server)
- **Puerto API Backend / App**: http://localhost:5188/
- **Documentación Swagger**: http://localhost:5188/swagger
- **Inicio Rápido**: Ejecutar [`Iniciar_Desarrollo.bat`](file:///c:/Users/Usuario/source/repos/Transporte_V2/Iniciar_Desarrollo.bat)

### 🔴 Ambiente de Producción (PROD)
- **Base de Datos**: `BD_TRANSPORTE_PROD` (SQL Server)
- **Puerto API Backend / App**: http://localhost:5190/
- **Inicio Rápido**: Ejecutar [`Iniciar_Produccion.bat`](file:///c:/Users/Usuario/source/repos/Transporte_V2/Iniciar_Produccion.bat)
- **Paquete Desplegado**: [`Despliegue/Produccion/Transporte_App_PROD/`](file:///c:/Users/Usuario/source/repos/Transporte_V2/Despliegue/Produccion/Transporte_App_PROD/)

## ⚠️ REGLA PRIMORDIAL DE TRABAJO (ESTRICTA)
1. **TODOS los cambios, modificaciones de código, nuevos módulos, pruebas y ajustes a la base de datos se realizan SIEMPRE Y EXCLUSIVAMENTE en el AMBIENTE DE DESARROLLO (DEV)**:
   - Base de datos de trabajo: `BD_TRANSPORTE_DEV`
   - Servidor y API de trabajo: `http://localhost:5188/`
2. **PRODUCCIÓN (`BD_TRANSPORTE_PROD` / Puerto `5190`) permanece INTACTO e INMUTABLE** durante el desarrollo activo.
3. **Pase a Producción**: Únicamente se actualiza y pasa a PRODUCCIÓN cuando se ordene un **DESPLIEGUE FORMAL** mediante [`desplegar.bat`](file:///c:/Users/Usuario/source/repos/Transporte_V2/desplegar.bat) o `powershell -ExecutionPolicy Bypass -File .\desplegar.ps1`.

## Regla de Ejecución y Sincronización en Desarrollo
1. **Sincronización de Frontend a Backend en Desarrollo**:
   `Copy-Item -Path 'Frontend\*' -Destination 'Backend\src\Transporte.API\wwwroot\' -Recurse -Force`
2. **Ejecutar Desarrollo**:
   [`Iniciar_Desarrollo.bat`](file:///c:/Users/Usuario/source/repos/Transporte_V2/Iniciar_Desarrollo.bat) o `dotnet run --project Backend\src\Transporte.API\Transporte.API.csproj --urls "http://0.0.0.0:5188"`