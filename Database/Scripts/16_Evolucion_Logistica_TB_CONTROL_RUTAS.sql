-- =========================================================================================
-- Script: 16_Evolucion_Logistica_TB_CONTROL_RUTAS.sql
-- Descripción:
--   1. Actualiza el catálogo TB_PROCESOS_TICKET con los 4 estados exactos:
--        ABIERTO (Chofer) -> RECIBIDO (Receptoría) -> ENTREGADO (Compañía) -> FINALIZADO (Admin)
--   2. Agrega a TB_CONTROL_RUTAS las columnas para registrar:
--        - Tipo de destino (Receptoría o Directo a Planta)
--        - Litros recibidos y diferencia en Receptoría (Tramo 1)
--        - Litros recargados adicionales en Receptoría
--        - Compañía destino y litros recibidos/diferencia en Planta (Tramo 2)
--        - Balance total de merma en litros y marcas de tiempo
--   3. NO borra ningún registro existente.
-- =========================================================================================

-- 1. ACTUALIZAR CATÁLOGO DE ESTADOS A LA NOMENCLATURA EXACTA
IF EXISTS (SELECT 1 FROM dbo.TB_PROCESOS_TICKET WHERE Id = 1)
BEGIN
    UPDATE dbo.TB_PROCESOS_TICKET
    SET Codigo = 'ABIERTO',
        Nombre = 'Abierto',
        Descripcion = 'Ticket abierto en posesión del Chofer recolectando en ruta.',
        Color = '#4f46e5',
        Icono = 'fa-solid fa-route'
    WHERE Id = 1;
END

IF EXISTS (SELECT 1 FROM dbo.TB_PROCESOS_TICKET WHERE Id = 2)
BEGIN
    UPDATE dbo.TB_PROCESOS_TICKET
    SET Codigo = 'RECIBIDO',
        Nombre = 'Recibido',
        Descripcion = 'Ticket recibido en Receptoría para validación de litros.',
        Color = '#ea580c',
        Icono = 'fa-solid fa-truck-ramp-box'
    WHERE Id = 2;
END

IF EXISTS (SELECT 1 FROM dbo.TB_PROCESOS_TICKET WHERE Id = 3)
BEGIN
    UPDATE dbo.TB_PROCESOS_TICKET
    SET Codigo = 'ENTREGADO',
        Nombre = 'Entregado',
        Descripcion = 'Ticket entregado en Compañía / Quesera compradora.',
        Color = '#0284c7',
        Icono = 'fa-solid fa-industry'
    WHERE Id = 3;
END

IF EXISTS (SELECT 1 FROM dbo.TB_PROCESOS_TICKET WHERE Id = 4)
BEGIN
    UPDATE dbo.TB_PROCESOS_TICKET
    SET Codigo = 'FINALIZADO',
        Nombre = 'Finalizado',
        Descripcion = 'Ticket auditado y conciliado contablemente por el Administrador.',
        Color = '#16a34a',
        Icono = 'fa-solid fa-clipboard-check'
    WHERE Id = 4;
END

PRINT '>> Catálogo TB_PROCESOS_TICKET actualizado con éxito.';
GO

-- 2. AGREGAR COLUMNAS LOGÍSTICAS Y DE MEDICIÓN A TB_CONTROL_RUTAS
IF COL_LENGTH('dbo.TB_CONTROL_RUTAS', 'TipoDestino') IS NULL
BEGIN
    ALTER TABLE dbo.TB_CONTROL_RUTAS
    ADD TipoDestino VARCHAR(30) NULL;
    PRINT '>> Columna TipoDestino agregada.';
END

IF COL_LENGTH('dbo.TB_CONTROL_RUTAS', 'LitrosRecibidosReceptoria') IS NULL
BEGIN
    ALTER TABLE dbo.TB_CONTROL_RUTAS
    ADD LitrosRecibidosReceptoria INT NULL;
    PRINT '>> Columna LitrosRecibidosReceptoria agregada.';
END

IF COL_LENGTH('dbo.TB_CONTROL_RUTAS', 'DiferenciaReceptoria') IS NULL
BEGIN
    ALTER TABLE dbo.TB_CONTROL_RUTAS
    ADD DiferenciaReceptoria INT NULL;
    PRINT '>> Columna DiferenciaReceptoria agregada.';
END

IF COL_LENGTH('dbo.TB_CONTROL_RUTAS', 'LitrosCargadosAdicional') IS NULL
BEGIN
    ALTER TABLE dbo.TB_CONTROL_RUTAS
    ADD LitrosCargadosAdicional INT NOT NULL CONSTRAINT DF_TB_CONTROL_RUTAS_LitrosCargadosAdicional DEFAULT 0;
    PRINT '>> Columna LitrosCargadosAdicional agregada.';
END

IF COL_LENGTH('dbo.TB_CONTROL_RUTAS', 'CompaniaDestinoId') IS NULL
BEGIN
    ALTER TABLE dbo.TB_CONTROL_RUTAS
    ADD CompaniaDestinoId INT NULL;

    ALTER TABLE dbo.TB_CONTROL_RUTAS
    ADD CONSTRAINT FK_TB_CONTROL_RUTAS_CompaniaDestino
    FOREIGN KEY (CompaniaDestinoId) REFERENCES dbo.TB_COMPANIAS(Id);

    PRINT '>> Columna CompaniaDestinoId y FK agregada.';
END

IF COL_LENGTH('dbo.TB_CONTROL_RUTAS', 'LitrosEntregadosCompania') IS NULL
BEGIN
    ALTER TABLE dbo.TB_CONTROL_RUTAS
    ADD LitrosEntregadosCompania INT NULL;
    PRINT '>> Columna LitrosEntregadosCompania agregada.';
END

IF COL_LENGTH('dbo.TB_CONTROL_RUTAS', 'DiferenciaCompania') IS NULL
BEGIN
    ALTER TABLE dbo.TB_CONTROL_RUTAS
    ADD DiferenciaCompania INT NULL;
    PRINT '>> Columna DiferenciaCompania agregada.';
END

IF COL_LENGTH('dbo.TB_CONTROL_RUTAS', 'MermaTotalLitros') IS NULL
BEGIN
    ALTER TABLE dbo.TB_CONTROL_RUTAS
    ADD MermaTotalLitros INT NULL;
    PRINT '>> Columna MermaTotalLitros agregada.';
END

IF COL_LENGTH('dbo.TB_CONTROL_RUTAS', 'FechaLlegadaReceptoria') IS NULL
BEGIN
    ALTER TABLE dbo.TB_CONTROL_RUTAS
    ADD FechaLlegadaReceptoria DATETIME2 NULL;
    PRINT '>> Columna FechaLlegadaReceptoria agregada.';
END

IF COL_LENGTH('dbo.TB_CONTROL_RUTAS', 'FechaEntregaCompania') IS NULL
BEGIN
    ALTER TABLE dbo.TB_CONTROL_RUTAS
    ADD FechaEntregaCompania DATETIME2 NULL;
    PRINT '>> Columna FechaEntregaCompania agregada.';
END

IF COL_LENGTH('dbo.TB_CONTROL_RUTAS', 'CerradoPor') IS NULL
BEGIN
    ALTER TABLE dbo.TB_CONTROL_RUTAS
    ADD CerradoPor INT NULL;

    ALTER TABLE dbo.TB_CONTROL_RUTAS
    ADD CONSTRAINT FK_TB_CONTROL_RUTAS_CerradoPor
    FOREIGN KEY (CerradoPor) REFERENCES dbo.TB_USUARIOS(Id);

    PRINT '>> Columna CerradoPor y FK agregada.';
END
GO

-- 3. AJUSTAR REGISTROS EXISTENTES PARA MANTENER COHERENCIA
UPDATE dbo.TB_CONTROL_RUTAS
SET LitrosRecibidosReceptoria = TotalLitrosReceptoria,
    DiferenciaReceptoria = DiferenciaLitros,
    MermaTotalLitros = DiferenciaLitros,
    TipoDestino = 'RECEPTORIA'
WHERE TipoDestino IS NULL;

PRINT '>> Coherencia de datos históricos actualizada en TB_CONTROL_RUTAS.';
GO
