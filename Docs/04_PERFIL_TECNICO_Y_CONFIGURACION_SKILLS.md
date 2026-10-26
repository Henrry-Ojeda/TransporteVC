# 📋 04. Perfil Técnico, Arquitectura y Configuración de Skills (BD_TRANSPORTE)

Este documento condensa la radiografía técnica completa del proyecto **Transporte y Rutas de Leche**, respondiendo a los ejes de contexto, arquitectura, fricciones operativas, integraciones y estrategia de Skills para la asistencia con Inteligencia Artificial.

---

## 1. Contexto de la Aplicación y Arquitectura

* **Tipo de producto**: 
  * **Solución Multiplataforma**: Web App SPA + PWA Móvil (Mobile-Ready con `manifest.json` y soporte offline para choferes/recolectores en campo).
  * **API Backend**: RESTful Web API en .NET 8 C#.
  * **Herramientas de Consola**: Utilitario CLI (`Transporte.Migrador2026`) para migración histórica de datos.

* **Stack tecnológico exacto**:
  * **Backend**: C# / .NET 8 (`net8.0`), ASP.NET Core Web API, Dapper `2.1.35`, Microsoft.Data.SqlClient `5.2.0`, BCrypt.Net-Next `4.0.3`, Microsoft.AspNetCore.Authentication.JwtBearer `8.0.1`, Swashbuckle.AspNetCore `6.5.0` (Swagger/OpenAPI).
  * **Frontend**: HTML5 semántico, CSS3 puro / Vanilla CSS (Dark Mode profundo `#090d16`, paneles `#131b2e` con Glassmorphism `backdrop-filter: blur(12px)`), Vanilla JavaScript (ES6+ modular), PWA Client (`manifest.json`), Google Fonts (*Outfit* e *Inter*).
  * **Base de Datos**: Microsoft SQL Server (`BD_TRANSPORTE`).

* **Gestión de datos y persistencia**:
  * Base de datos relacional SQL Server (`BD_TRANSPORTE`).
  * Acceso a datos eficiente mediante Micro-ORM **Dapper** sobre `Microsoft.Data.SqlClient` con patrón `SqlConnectionFactory` (`IDbConnectionFactory`) y transacciones atómicas.
  * Versionado de esquema mediante scripts SQL numéricos ordenados secuencialmente en `Database/Scripts/` (ej. `01_Init_BD_TRANSPORTE.sql`, `06_Add_Granular_Permissions.sql`, etc.) y ejecutable C# dedicado. No se utiliza Entity Framework Core Migrations.

* **Patrón de diseño o arquitectura**:
  * **Clean Architecture / Arquitectura en Capas (Layered Architecture)** con estricto desacoplamiento:
    * `Transporte.Core`: Dominio puro (Entidades POCO y DTOs). Cero dependencias externas.
    * `Transporte.Infrastructure`: Acceso a datos (Repositorios Dapper), Seguridad BCrypt y JWT Token Service.
    * `Transporte.API`: Controladores HTTP RESTful, Middlewares (JWT, CORS, Swagger) y servidor de estáticos `wwwroot`.
    * `Frontend/`: Arquitectura SPA client-side con sincronización a `wwwroot`.

---

## 2. Puntos Críticos y Fricciones Diarias

* **Tareas repetitivas**:
  * **Cadena de Impacto Multicapa**: Cada nuevo requerimiento o campo exige modificar secuencialmente 7-8 capas:
    1. Script SQL en `Database/Scripts/`.
    2. Entidad POCO en `Transporte.Core/Entities/Entities.cs`.
    3. DTOs de entrada y salida en `Transporte.Core/DTOs/DTOs.cs`.
    4. Métodos e interfaces de Repositorio en `Transporte.Infrastructure/Repositories/Repositories.cs`.
    5. Métodos en Controllers en `Transporte.API/Controllers/`.
    6. Lógica de consumo Fetch y estado en `Frontend/js/app.js`.
    7. Maquetación de tablas/modales en `Frontend/index.html` y `Frontend/css/app.css`.
    8. Copia/sincronización de `Frontend/` a `Backend/src/Transporte.API/wwwroot/`.
  * Creación manual repetitiva de endpoints CRUD, DTOs y parámetros Dapper.

* **Bloqueos habituales**:
  * Olvido de sincronización entre la carpeta fuente `Frontend/` y la carpeta servida por el backend `wwwroot/` (`Copy-Item -Path "Frontend\*" -Destination "Backend\src\Transporte.API\wwwroot\" -Recurse -Force`).
  * Caídas del esquema OpenAPI/Swagger (HTTP 500 en `/swagger/v1/swagger.json`) por métodos públicos en Controllers sin verbos HTTP explícitos (`[HttpGet]`, `[HttpPost]`, etc.) o por parámetros de ruta/body no decorados.
  * Complejidad en el cálculo y redondeo de transacciones multimoneda (USD / Bolívares a tasa oficial BCV) para liquidaciones semanales y cuadre de mermas entre recolecciones y receptorías.

* **Nivel de cobertura de pruebas**:
  * Actualmente el proyecto carece de proyectos de pruebas unitarias o de integración automatizadas (xUnit/NUnit/MSTest).
  * Las pruebas se ejecutan de manera **manual y funcional en vivo** interactuando con la interfaz Swagger UI (`/swagger`) y la SPA/PWA en navegador web.

---

## 3. Integraciones, Servicios Externos y Entorno

* **Autenticación y autorización**:
  * Autenticación basada en **JWT Bearer Tokens** con firma simétrica HMAC-SHA256.
  * Hashing seguro de contraseñas con **BCrypt**.
  * Control de acceso basado en roles y permisos granulares (**RBAC**) registrado en base de datos (`TB_ROLES`, `TB_MODULOS`, `TB_PERMISOS`, `TB_ROL_PERMISOS`).
  * Roles operativos: `ADMIN`, `SUPERVISOR`, `FINANZAS`, `CHOFER`, `RECEPTOR`.

* **APIs de terceros**:
  * Registro e integración con tasas de cambio oficiales del **Banco Central de Venezuela (BCV)** (`TB_HISTORIAL_BCV` / `BcvController.cs`).
  * No utiliza pasarelas de pago ni almacenamiento en la nube externo (las liquidaciones generan reportes para transferencias bancarias locales registradas en `TB_BANCOS`).

* **Flujo de despliegue**:
  * **Entorno de Ejecución**: Servidor local / On-Premise ejecutando ASP.NET Core Kestrel (`dotnet run`) sirviendo el cliente desde `wwwroot` y conectando a SQL Server local o de red interna.
  * **Publicación**: Ejecutables standalone binarios publicados en la carpeta `Ejecutables/`.
  * Actualmente no dispone de pipelines de CI/CD automatizados (GitHub Actions / Azure DevOps).

---

## 4. Nivel Operativo del Desarrollador y Configuración de Skills

* **Estilo de asistencia requerido**:
  * **Ejecutivo, Directo y Riguroso con Estándares de Producción**:
    * Generación directa de código completo listo para producción.
    * Respeto estricto del protocolo de sincronización y validación cruzada entre capas.
    * Aplicación automática de las "Reglas de Oro" para controladores ASP.NET Core (decoradores explícitos `[HttpGet]`, `[FromBody]`, `[FromRoute]` para resiliencia en Swagger).
    * Diseño visual estético y moderno en el frontend (Glassmorphism, Dark Theme, CSS Vanilla limpio y modular).

* **Estrategia de Configuración de Skills**:

  ### A. Skills de Workspace (Específicas de `BD_TRANSPORTE`)
  1. **`transporte-crud-generator`**: Genera la solución vertical completa (Script SQL -> POCO -> DTO -> Repositorio Dapper -> Controller -> JS/HTML cliente).
  2. **`transporte-frontend-sync`**: Automatiza la sincronización de archivos desde `Frontend/` hacia `wwwroot/`.
  3. **`transporte-sql-migrator`**: Crea scripts DDL/DML alineados con la nomenclatura `dbo.TB_*` y la matriz RBAC.
  4. **`transporte-swagger-validator`**: Audita los controladores .NET 8 para prevenir errores 500 en Swagger.

  ### B. Skills Globales (Transversales)
  1. **`csharp-dotnet8-clean-code`**: Guía de buenas prácticas, inyección de dependencias y rendimiento en C# 12 / .NET 8.
  2. **`modern-web-vanilla-design`**: Guía UI/UX con Glassmorphism, CSS Variables, accesibilidad y JS ES6+.
