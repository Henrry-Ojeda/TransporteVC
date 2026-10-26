-- =========================================================================================
-- Script: 14_Create_TB_PROCESOS_TICKET.sql
-- Descripción:
--   1. Crea la tabla catálogo TB_PROCESOS_TICKET con los 4 estados del flujo:
--        RUTA → RECEPCIONADO → DESTINO → FINALIZADO
--   2. Inserta los registros iniciales de cada proceso.
--   3. Agrega la columna ProcesoActualId en TB_CONTROL_RUTAS como FK a TB_PROCESOS_TICKET.
--   4. Actualiza TB_CONTROL_RUTAS existentes vinculando al proceso por defecto (RUTA).
-- =========================================================================================

-- 1. CREAR TABLA CATÁLOGO DE PROCESOS (SI NO EXISTE)
IF OBJECT_ID('dbo.TB_PROCESOS_TICKET', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.TB_PROCESOS_TICKET (
        Id         INT IDENTITY(1,1) NOT NULL,
        Codigo     VARCHAR(30)       NOT NULL,   -- RUTA, RECEPCIONADO, DESTINO, FINALIZADO
        Nombre     NVARCHAR(100)     NOT NULL,   -- Nombre amigable para mostrar en UI
        Descripcion NVARCHAR(300)   NULL,
        Orden      TINYINT          NOT NULL,    -- Orden en el flujo (1, 2, 3, 4)
        Color      VARCHAR(20)      NULL,        -- Color HEX para el badge de la UI
        Icono      VARCHAR(60)      NULL,        -- Clase Font Awesome (ej: fa-truck)
        Activo     BIT              NOT NULL CONSTRAINT DF_TB_PROCESOS_TICKET_Activo DEFAULT 1,
        CreatedAt  DATETIME2        NOT NULL CONSTRAINT DF_TB_PROCESOS_TICKET_CreatedAt DEFAULT GETDATE(),
        CONSTRAINT PK_TB_PROCESOS_TICKET PRIMARY KEY CLUSTERED (Id ASC),
        CONSTRAINT UQ_TB_PROCESOS_TICKET_Codigo UNIQUE (Codigo)
    );
    PRINT '>> Tabla TB_PROCESOS_TICKET creada exitosamente.';
END
ELSE
BEGIN
    PRINT '>> Tabla TB_PROCESOS_TICKET ya existe.';
END
GO

-- 2. INSERTAR LOS 4 PROCESOS DEL FLUJO (SOLO SI NO EXISTEN)
IF NOT EXISTS (SELECT 1 FROM dbo.TB_PROCESOS_TICKET WHERE Codigo = 'RUTA')
BEGIN
    INSERT INTO dbo.TB_PROCESOS_TICKET (Codigo, Nombre, Descripcion, Orden, Color, Icono)
    VALUES
    ('RUTA',         'En Ruta',        'Camión en ruta recolectando leche de las fincas asignadas.',   1, '#4f46e5', 'fa-solid fa-route'),
    ('RECEPCIONADO', 'Recepcionado',   'Recolección completada. Esperando despacho hacia la planta.', 2, '#ea580c', 'fa-solid fa-truck-loading'),
    ('DESTINO',      'En Destino',     'Camión en tránsito hacia la planta receptora / compañía.',    3, '#0284c7', 'fa-solid fa-arrow-right-to-bracket'),
    ('FINALIZADO',   'Finalizado',     'Entrega completada en la planta. Proceso cerrado.',            4, '#16a34a', 'fa-solid fa-circle-check');
    PRINT '>> 4 procesos insertados en TB_PROCESOS_TICKET.';
END
ELSE
BEGIN
    PRINT '>> Los procesos ya existen en TB_PROCESOS_TICKET.';
END
GO

-- 3. AGREGAR COLUMNA ProcesoActualId EN TB_CONTROL_RUTAS
IF COL_LENGTH('dbo.TB_CONTROL_RUTAS', 'ProcesoActualId') IS NULL
BEGIN
    ALTER TABLE dbo.TB_CONTROL_RUTAS
    ADD ProcesoActualId INT NULL;

    ALTER TABLE dbo.TB_CONTROL_RUTAS
    ADD CONSTRAINT FK_TB_CONTROL_RUTAS_Proceso
    FOREIGN KEY (ProcesoActualId) REFERENCES dbo.TB_PROCESOS_TICKET (Id);

    CREATE NONCLUSTERED INDEX IX_TB_CONTROL_RUTAS_ProcesoActualId
    ON dbo.TB_CONTROL_RUTAS (ProcesoActualId ASC);

    PRINT '>> Columna ProcesoActualId y FK agregadas a TB_CONTROL_RUTAS.';
END
ELSE
BEGIN
    PRINT '>> Columna ProcesoActualId ya existe en TB_CONTROL_RUTAS.';
END
GO

-- 4. ACTUALIZAR REGISTROS EXISTENTES: asignar proceso RUTA a los que no tienen proceso
UPDATE dbo.TB_CONTROL_RUTAS
SET ProcesoActualId = (SELECT Id FROM dbo.TB_PROCESOS_TICKET WHERE Codigo = 'RUTA')
WHERE ProcesoActualId IS NULL;

PRINT '>> TB_CONTROL_RUTAS: registros existentes asignados al proceso RUTA.';
GO

-- 5. CREAR TABLA DE HISTORIAL DE CAMBIOS DE PROCESO (TRAZABILIDAD)
IF OBJECT_ID('dbo.TB_HISTORIAL_PROCESOS_TICKET', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.TB_HISTORIAL_PROCESOS_TICKET (
        Id              BIGINT IDENTITY(1,1) NOT NULL,
        ControlRutaId   BIGINT              NOT NULL,
        ProcesoId       INT                 NOT NULL,   -- FK al proceso al que cambió
        FechaCambio     DATETIME2           NOT NULL CONSTRAINT DF_TB_HISTORIAL_PROCESOS_FechaCambio DEFAULT GETDATE(),
        CambiadoPor     INT                 NOT NULL,   -- UsuarioId que realizó el cambio
        Observacion     NVARCHAR(300)       NULL,
        CONSTRAINT PK_TB_HISTORIAL_PROCESOS_TICKET PRIMARY KEY CLUSTERED (Id ASC),
        CONSTRAINT FK_TB_HISTORIAL_PROCESOS_Control  FOREIGN KEY (ControlRutaId) REFERENCES dbo.TB_CONTROL_RUTAS (Id),
        CONSTRAINT FK_TB_HISTORIAL_PROCESOS_Proceso  FOREIGN KEY (ProcesoId)     REFERENCES dbo.TB_PROCESOS_TICKET (Id),
        CONSTRAINT FK_TB_HISTORIAL_PROCESOS_Usuario  FOREIGN KEY (CambiadoPor)   REFERENCES dbo.TB_USUARIOS (Id)
    );

    CREATE NONCLUSTERED INDEX IX_TB_HISTORIAL_PROCESOS_ControlRutaId
    ON dbo.TB_HISTORIAL_PROCESOS_TICKET (ControlRutaId ASC, FechaCambio DESC);

    PRINT '>> Tabla TB_HISTORIAL_PROCESOS_TICKET creada exitosamente.';
END
ELSE
BEGIN
    PRINT '>> Tabla TB_HISTORIAL_PROCESOS_TICKET ya existe.';
END
GO
