# Semi-Proceso: Traspaso de Leche a Otro Chofer

## 1. Contexto y Procesos del Sistema
1. **Ruta $\to$ Receptoría**
2. **Ruta $\to$ Receptoría $\to$ Compañía**
3. **Ruta $\to$ Compañía**
4. **Receptoría $\to$ Compañía**
5. **Semi-Proceso: Traspaso de Leche a Otro Chofer** (Ruta Origen $\to$ Chofer Destino $\to$ Despacho a Compañía/Receptoría)

---

## 2. Caso de Uso Real
- **Fecha:** 11-09-2026
- **Chofer Origen:** José Paz (Ticket `#1126`), Litros recolectados en ruta: **1,070 L**.
- **Acción:** Traspasó la leche al Chofer Elvis (Ticket `#1128`).
- **Chofer Destino:** Elvis completó la entrega/despacho a Planta/Compañía o Receptoría con la carga recibida.

---

## 3. Opciones de Traspaso Disponibles
1. **Asignar a Ticket ya Creado / Existente:**
   - Permite seleccionar un ticket abierto o activo del chofer destino.
2. **Crear Ticket Automáticamente:**
   - Permite seleccionar la **Fecha del Viaje** y el **Chofer Destino**.
   - El sistema crea el nuevo ticket destino en `TB_CONTROL_RUTAS` de forma automática asignándole la carga traspasada en su balance volumétrico.

---

## 4. Trazabilidad y Logs Volumétricos
1. **Ticket Origen:**
   - Estado: `FINALIZADO` / `TRASPASADO`.
   - `TipoDestino`: `'TRASPASO_CHOFER'`.
   - Registro en `TB_HISTORIAL_PROCESOS_TICKET`: Tipo `'TRASPASO_SALIDA'`, Litros restados.
   - Registro en `TB_LOG_MODIFICACIONES_CONTROL`.

2. **Ticket Destino:**
   - Recibe el volumen en `LitrosCargadosAdicional` o como volumen transferido inicial.
   - Registro en `TB_HISTORIAL_PROCESOS_TICKET`: Tipo `'TRASPASO_ENTRADA'`, Litros sumados y referencia al Ticket Origen.
   - Registro en `TB_LOG_MODIFICACIONES_CONTROL`.
