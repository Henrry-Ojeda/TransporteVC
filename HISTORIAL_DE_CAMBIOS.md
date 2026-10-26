# 📝 Historial de Versiones y Lista de Actualizaciones (Transporte V2)

Documento oficial de control de versiones, registros de despliegues y bitácora de cambios para el sistema **Transporte V2**.

---

## 🏷️ [Versión 2.1.0] - 2026-09-25

### 🚀 Despliegue y Arquitectura Multi-Ambiente
- **Separación de Ambientes**:
  - **DESARROLLO (DEV)**: Base de datos `BD_TRANSPORTE_DEV`, Puerto `5188`, Swagger habilitado.
  - **PRODUCCIÓN (PROD)**: Base de datos `BD_TRANSPORTE_PROD`, Puerto `5190`, ambiente aislado e inmutable.
- **Automatización de Despliegue**:
  - Creación de [`desplegar.bat`](file:///c:/Users/Usuario/source/repos/Transporte_V2/desplegar.bat) y [`desplegar.ps1`](file:///c:/Users/Usuario/source/repos/Transporte_V2/desplegar.ps1) con soporte para compilar y empaquetar ambos entornos en 1 clic.
  - Generación de scripts de inicio rápido independientes (`Iniciar_DESARROLLO.bat` e `Iniciar_PRODUCCION.bat`).
  - Creación de la [Guía de Despliegue Oficial](file:///c:/Users/Usuario/source/repos/Transporte_V2/Docs/05_GUIA_DE_DESPLIEGUE.md).

### 🎨 Frontend e Identidad Visual
- **Diferenciación Visual en DESARROLLO**:
  - Distintivo dinámico pulsante `[ 🛠️ DEV (5188) ]` en la barra superior con tooltip informativo de base de datos activa.
  - Borde ámbar superior y aviso informativo en la pantalla de inicio de sesión (Login).
  - Título dinámico en la pestaña del navegador: `[DEV] Rutas de Leche (5188)`.
  - Endpoint de diagnóstico en tiempo real: `GET /api/system/environment`.

### 🐛 Correcciones Críticas (Bug Fixes)
- **Filtro de Fecha en Recolección de Rutas y Tickets**:
  - **Problema corregido**: En la pantalla de Rutas, al consultar una fecha sin tickets registrados, un bloque de *fallback* cargaba todos los tickets históricos sin filtro de fecha, mostrando tickets de días anteriores (ej. Ticket #1174) como si pertenecieran al día consultado.
  - **Solución aplicada**: Se eliminó el *fallback* no condicionado, garantizando que el selector de fecha filtre estrictamente por el día elegido y muestre el estado vacío correspondiente si no hay operaciones en esa fecha.

---

## 🏷️ [Versión 2.0.0] - 2026-09-02
- Clonación inicial y evolución del sistema **Transporte V2**.
- Integración de modelo de negocio con trazabilidad de mermas, soporte multimoneda y OCR de tickets de pesaje.
