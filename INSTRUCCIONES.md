# 📋 REGLAS E INSTRUCCIONES OBLIGATORIAS DE DESARROLLO — TRANSPORTE V2

Este documento establece las directrices maestras que **SIEMPRE Y SIN EXCEPCIÓN** deben seguirse en el desarrollo, modificación y mantenimiento del sistema.

---

### 1. 🔍 Verificación en Sistema Anterior (`v2_3_11_26`)
* **Ubicación de Referencia**: `C:\Users\Usuario\Downloads\Transporte_V2_3_11_26` (y `Frontend/index.html` original).
* Ante cualquier duda sobre la existencia, diseño exacto, campos, fórmulas o comportamiento de un módulo o vista:
  * **Buscar primero en la carpeta `Transporte_V2_3_11_26`** antes de asumir o proponer diseños nuevos.
  * Replicar con fidelidad 1:1 las tarjetas maestras, colores, nombres de procesos operativos, modales y flujos de usuario que ya fueron validados en producción.

---

### 2. 📊 Tablas Obligatoriamente con `DataTable`
* **Librería Estándar**: Toda tabla en el sistema (`modules/*`) debe crearse y utilizar el componente común `<DataTable />` (`Frontend-React/src/components/common/DataTable.tsx`).
* **Características requeridas en cada tabla**:
  * Buscador en vivo (`searchPlaceholder`).
  * Paginación dinámica y control de filas por página.
  * Ordenamiento por columnas (`sortable: true`).
  * Botón de exportación a Excel / CSV integrado.
  * Badges de estado con estilos consistentes.
  * Cero tablas HTML `<table class="...">` planas o sin capacidades interactivas.

---

### 3. 🔽 Campos Desplegables con Filtro / Búsqueda Integrada
* **Componente Estándar**: Todo selector desplegable (`<select>`) debe ser con filtro en vivo.
* **Componentes obligatorios**:
  * `<SearchableSelect />` (`Frontend-React/src/components/common/SearchableSelect.tsx`).
  * `<CamionSelect />` (`Frontend-React/src/components/selectors/CamionSelect.tsx`).
  * `<ChoferSelect />` (`Frontend-React/src/components/selectors/ChoferSelect.tsx`).
  * `<FincaSelect />` / `<PropietarioSelect />` / `<CompaniaSelect />`.
* Cada selector debe permitir escribir para filtrar por nombre, código, placa o documento, con opción de limpiar (`allowClear`) y subtítulo de contexto.

---

### 4. 🧩 Coherencia Multivista de Módulos (Ej: Búfala, Diferir Litros, etc.)
* Si se activa o añade un módulo, debe estructurarse y propagarse de manera transversal y consistente en **TODAS** las vistas relacionadas:
  * **Módulo Leche de Búfala**:
    * Debe reflejarse y filtrarse en:
      * `Reportes por Finca` (separación de litros Vaca vs Búfala).
      * `Receptoría y Descargas de Tanque` (tipo de leche, silo y precio correspondiente).
      * `Liquidación y Pagos a Productores` (precios diferenciados `precioLitroUSD` vs `precioBufalaLitroUSD`).
      * `Balance y Conciliación Volumétrica`.
    * Si la empresa cliente (tenant) tiene el módulo **habilitado** en el SaaS, las columnas y filtros de Búfala deben mostrarse.
    * Si el módulo está **deshabilitado**, deben ocultarse limpiamente en todas las vistas sin romper los balances.
  * **Módulo Diferir Litros**:
    * Debe vincularse en las entradas diarias de control de tanques, recepciones y su arrastre a las preliquidaciones semanales.

---

### 5. 🚀 Replicación Inmediata de Base (PADRE) a los HIJOS (Tenants / Empresas)
* **Regla de Despliegue**: Todo cambio realizado en el producto base (`Transporte_Base` / `main`) debe ser desplegado y reflejado **inmediatamente** en los entornos de producción de todos los clientes hijos:
  1. Compilar y verificar el frontend (`npm --prefix Frontend-React run build`) y backend (`dotnet build`).
  2. Hacer commit y push a `origin main` de `Transporte_Base`.
  3. Desplegar a Vercel Producción (`npx vercel --prod`).
  4. **Reasignar los Aliases de los HIJOS en Vercel**:
     * **Hijo Vergel & Carrillo**:
       ```bash
       npx vercel alias set <deployment-url> transporte-vergel-carrillo.vercel.app
       ```
     * **Hijo Campo Verde**:
       ```bash
       npx vercel alias set <deployment-url> lacteos-campoverde.vercel.app
       ```
     * **Padre Base**:
       ```bash
       npx vercel alias set <deployment-url> transporte-base.vercel.app
       ```
  5. Asegurar que las bases de datos de los inquilinos (`DB_PROD_TRANSPORTE_VERGEL_CARRILLO`, `DB_PROD_CAMPO_VERDE`, `DB_PRODUCTO_BASE`) cuenten con sus esquemas y tablas sincronizados.

---

### 6. 🔌 Validación Estricta de Endpoints de API (Backend ➔ Frontend)
* **REGLA OBLIGATORIA ANTES DE CONECTAR CUALQUIER API**:
  * **SIEMPRE Y SIN EXCEPCIÓN** antes de agregar o modificar una llamada en `Frontend-React/src/api/*.ts`, se debe verificar directamente en `Backend/src/Transporte.API/Controllers/*Controller.cs` y `Backend/src/Transporte.Core/DTOs/DTOs.cs`:
    1. La ruta exacta del atributo `[HttpGet("...")]`, `[HttpPost("...")]`, `[HttpPut("...")]`, `[HttpDelete("...")]` (ej. verificar si en el Controller es `/api/ciclos/generar-anual` o `/api/bcv/hoy` antes de llamarlo).
    2. El método HTTP exacto (`GET`, `POST`, `PUT`, `DELETE`).
    3. Las propiedades exactas que espera el DTO en el Backend.
  * Nunca asumir el nombre de un endpoint basándose únicamente en funciones antiguas o intuición sin confirmar primero en el Controller de C#.


