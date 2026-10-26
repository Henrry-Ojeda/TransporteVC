# Sistema de Transporte y Liquidación de Leche (BD_TRANSPORTE)

Proyecto diseñado para la gestión integral de recolección de leche en fincas, entrega a plantas/queseras, control de mermas y liquidación semanal multimoneda (USD / Bs) a productores ganaderos.

## Estructura del Proyecto

- **Database/**: Scripts de inicialización, vistas, procedimientos y migraciones en SQL Server (`BD_TRANSPORTE`).
- **Backend/**: Arquitectura de servicios y API (.NET 8/9 C#).
  - `Transporte.Core`: Entidades, interfaces y lógica de negocio.
  - `Transporte.Infrastructure`: Acceso a datos y repositorios SQL.
  - `Transporte.API`: Endpoints y controladores.
  - `Transporte.Migrador2026`: Herramienta de consola para migración de datos históricos.
- **Frontend/**: Aplicación Web y PWA móvil para choferes en campo (soporte offline).
- **Ejecutables/**: Aplicaciones y herramientas binarias publicadas (`Migrador2026.exe`).
- **Docs/**: Documentación técnica, manuales de arquitectura y guías de desarrollo:
  - [01. Arquitectura y Estructura del Sistema](file:///c:/Users/Usuario/source/repos/Transporte_V2/Docs/01_ARQUITECTURA_Y_ESTRUCTURA_SISTEMA.md)
  - [02. Procesos Operativos y Lógica de Negocio](file:///c:/Users/Usuario/source/repos/Transporte_V2/Docs/02_PROCESOS_OPERATIVOS_Y_LOGICA_NEGOCIO.md)
  - [03. Guía de Desarrollo, Validación de Cambios y Control de Calidad](file:///c:/Users/Usuario/source/repos/Transporte_V2/Docs/03_GUIA_DE_DESARROLLO_VALIDACION_Y_CAMBIOS.md)
  - [05. Guía de Despliegue y Puesta en Producción](file:///c:/Users/Usuario/source/repos/Transporte_V2/Docs/05_GUIA_DE_DESPLIEGUE.md)

## Despliegue y Ejecución Rápida

- **Despliegue Automático (1-Click)**: Ejecute [`desplegar.bat`](file:///c:/Users/Usuario/source/repos/Transporte_V2/desplegar.bat) o [`desplegar.ps1`](file:///c:/Users/Usuario/source/repos/Transporte_V2/desplegar.ps1). El paquete listo para producción se genera en [`Despliegue/Transporte_App/`](file:///c:/Users/Usuario/source/repos/Transporte_V2/Despliegue/Transporte_App/).
- **Iniciar Servidor Local**: Ejecute [`Iniciar_Servidor.bat`](file:///c:/Users/Usuario/source/repos/Transporte_V2/Iniciar_Servidor.bat).

## Base de Datos (`BD_TRANSPORTE_V2`)

La base de datos contiene:
1. **Seguridad y Usuarios**: `TB_USUARIOS`, `TB_ROLES`, `TB_MODULOS`, `TB_PERMISOS`, `TB_ROL_PERMISOS`
2. **Parámetros y Tasas**: `TB_HISTORIAL_BCV`
3. **Catálogos**: `TB_BANCOS`, `TB_FINCAS`, `TB_FINCA_CUENTAS_BANCARIAS`, `TB_COMPANIAS`, `TB_TIPO_SERVICIO`
4. **Ciclos Operativos**: `TB_CICLOS_OPERATIVOS` (ej. Semanas continuas)
5. **Operaciones Diarias**: `TB_RUTAS_RECOLECCION`, `TB_ENTREGAS_COMPANIA`
6. **Finanzas y Pagos**: `TB_ADELANTOS`, `TB_LIQUIDACIONES_CABECERA`, `TB_LIQUIDACIONES_DETALLE_FINCA`


