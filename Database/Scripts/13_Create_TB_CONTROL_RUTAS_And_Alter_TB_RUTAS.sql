-- =========================================================================================
-- Script: 13_Create_TB_CONTROL_RUTAS_And_Alter_TB_RUTAS.sql
-- Descripción: 
--   1. Crea la tabla TB_CONTROL_RUTAS (Control / Cuadre Diario de Rutas por Chofer y Fecha).
--      Campos: FECHA, CHOFER (UsuarioId), TOTAL_LITROS_FINCA, TOTAL_LITROS_RECEPTORIA, 
--              DIFERENCIA_LITROS, ESTADOS, CICLO_ID, AUDITORÍA.
--   2. Agrega la columna ControlRutaId en TB_RUTAS_RECOLECCION como Foreign Key.
--   3. Agrega la columna ControlRutaId en TB_ENTREGAS_COMPANIA como Foreign Key (opcional/complementario).
-- =========================================================================================

-- 1. CREAR TABLA TB_CONTROL_RUTAS SI NO EXISTE
IF OBJECT_ID('dbo.TB_CONTROL_RUTAS', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.TB_CONTROL_RUTAS (
        Id BIGINT IDENTITY(1,1) NOT NULL,
        Fecha DATE NOT NULL,
        UsuarioId INT NOT NULL, -- Chofer / Conductor
        CicloId INT NULL,       -- Ciclo / Semana Operativa activa
        TotalLitrosFinca INT NOT NULL CONSTRAINT DF_TB_CONTROL_RUTAS_TotalFinca DEFAULT 0,
        TotalLitrosReceptoria INT NOT NULL CONSTRAINT DF_TB_CONTROL_RUTAS_TotalReceptoria DEFAULT 0,
        DiferenciaLitros INT NOT NULL CONSTRAINT DF_TB_CONTROL_RUTAS_Diferencia DEFAULT 0,
        PorcentajeMerma DECIMAL(5,2) NOT NULL CONSTRAINT DF_TB_CONTROL_RUTAS_Porcentaje DEFAULT 0.00,
        Estado VARCHAR(50) NOT NULL CONSTRAINT DF_TB_CONTROL_RUTAS_Estado DEFAULT 'PENDIENTE', -- PENDIENTE, CUADRADO, MERMA_EXCESIVA, CERRADO
        Observacion NVARCHAR(500) NULL,
        CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_TB_CONTROL_RUTAS_CreatedAt DEFAULT GETDATE(),
        CreatedBy INT NULL,
        ModifiedAt DATETIME2 NULL,
        ModifiedBy INT NULL,
        CONSTRAINT PK_TB_CONTROL_RUTAS PRIMARY KEY CLUSTERED (Id ASC),
        CONSTRAINT FK_TB_CONTROL_RUTAS_Usuario FOREIGN KEY (UsuarioId) REFERENCES dbo.TB_USUARIOS (Id),
        CONSTRAINT FK_TB_CONTROL_RUTAS_Ciclo FOREIGN KEY (CicloId) REFERENCES dbo.TB_CICLOS_OPERATIVOS (Id)
    );

    CREATE NONCLUSTERED INDEX IX_TB_CONTROL_RUTAS_Fecha_Usuario ON dbo.TB_CONTROL_RUTAS (Fecha ASC, UsuarioId ASC);
    CREATE NONCLUSTERED INDEX IX_TB_CONTROL_RUTAS_CicloId ON dbo.TB_CONTROL_RUTAS (CicloId ASC);
    CREATE NONCLUSTERED INDEX IX_TB_CONTROL_RUTAS_Estado ON dbo.TB_CONTROL_RUTAS (Estado ASC);

    PRINT '>> Tabla TB_CONTROL_RUTAS creada exitosamente.';
END
ELSE
BEGIN
    PRINT '>> Tabla TB_CONTROL_RUTAS ya existe.';
END
GO

-- 2. AGREGAR COLUMNA ControlRutaId EN TB_RUTAS_RECOLECCION
IF COL_LENGTH('dbo.TB_RUTAS_RECOLECCION', 'ControlRutaId') IS NULL
BEGIN
    ALTER TABLE dbo.TB_RUTAS_RECOLECCION
    ADD ControlRutaId BIGINT NULL;

    ALTER TABLE dbo.TB_RUTAS_RECOLECCION
    ADD CONSTRAINT FK_TB_RUTAS_RECOLECCION_ControlRuta 
    FOREIGN KEY (ControlRutaId) REFERENCES dbo.TB_CONTROL_RUTAS (Id);

    CREATE NONCLUSTERED INDEX IX_TB_RUTAS_RECOLECCION_ControlRutaId 
    ON dbo.TB_RUTAS_RECOLECCION (ControlRutaId ASC);

    PRINT '>> Columna ControlRutaId y FK agregadas a TB_RUTAS_RECOLECCION.';
END
ELSE
BEGIN
    PRINT '>> Columna ControlRutaId ya existe en TB_RUTAS_RECOLECCION.';
END
GO

-- 3. AGREGAR COLUMNA ControlRutaId EN TB_ENTREGAS_COMPANIA
IF COL_LENGTH('dbo.TB_ENTREGAS_COMPANIA', 'ControlRutaId') IS NULL
BEGIN
    ALTER TABLE dbo.TB_ENTREGAS_COMPANIA
    ADD ControlRutaId BIGINT NULL;

    ALTER TABLE dbo.TB_ENTREGAS_COMPANIA
    ADD CONSTRAINT FK_TB_ENTREGAS_COMPANIA_ControlRuta 
    FOREIGN KEY (ControlRutaId) REFERENCES dbo.TB_CONTROL_RUTAS (Id);

    CREATE NONCLUSTERED INDEX IX_TB_ENTREGAS_COMPANIA_ControlRutaId 
    ON dbo.TB_ENTREGAS_COMPANIA (ControlRutaId ASC);

    PRINT '>> Columna ControlRutaId y FK agregadas a TB_ENTREGAS_COMPANIA.';
END
ELSE
BEGIN
    PRINT '>> Columna ControlRutaId ya existe en TB_ENTREGAS_COMPANIA.';
END
GO
