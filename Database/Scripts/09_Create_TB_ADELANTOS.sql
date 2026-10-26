-- =========================================================================
-- SCRIPT 09: CREACIÓN DE TABLAS PARA MÓDULO DE ADELANTOS Y ABONOS EN CUOTAS
-- =========================================================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'TB_ADELANTOS')
BEGIN
    CREATE TABLE TB_ADELANTOS (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        TipoEntidad NVARCHAR(20) NOT NULL, -- 'FINCA' o 'RECEPTORIA'
        EntidadId INT NOT NULL, -- FincaId o CompaniaId
        FechaSolicitud DATETIME NOT NULL DEFAULT GETDATE(),
        SemanaInicioId INT NULL,
        MontoTotalUSD DECIMAL(18,4) NOT NULL,
        NumeroCuotas INT NOT NULL DEFAULT 1,
        MontoCuotaUSD DECIMAL(18,4) NOT NULL,
        MontoPagadoUSD DECIMAL(18,4) NOT NULL DEFAULT 0,
        MontoPendienteUSD DECIMAL(18,4) NOT NULL,
        Estado NVARCHAR(20) NOT NULL DEFAULT 'ACTIVO', -- 'ACTIVO', 'PAGADO', 'CANCELADO'
        Observacion NVARCHAR(500) NULL,
        CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        CreatedBy INT NULL,
        ModifiedAt DATETIME NULL,
        ModifiedBy INT NULL
    );
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'TB_ADELANTOS_CUOTAS')
BEGIN
    CREATE TABLE TB_ADELANTOS_CUOTAS (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        AdelantoId INT NOT NULL,
        NumeroCuota INT NOT NULL,
        SemanaOperativaId INT NULL,
        MontoCuotaUSD DECIMAL(18,4) NOT NULL,
        MontoCobradoUSD DECIMAL(18,4) NOT NULL DEFAULT 0,
        TasaBcvAplicada DECIMAL(18,4) NULL,
        MontoCobradoBs DECIMAL(18,4) NOT NULL DEFAULT 0,
        Estado NVARCHAR(20) NOT NULL DEFAULT 'PENDIENTE', -- 'PENDIENTE', 'COBRADO', 'POSPUESTO'
        Observacion NVARCHAR(500) NULL,
        CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        CreatedBy INT NULL,
        ModifiedAt DATETIME NULL,
        ModifiedBy INT NULL,
        CONSTRAINT FK_TB_ADELANTOS_CUOTAS_ADELANTO FOREIGN KEY (AdelantoId) REFERENCES TB_ADELANTOS(Id) ON DELETE CASCADE
    );
END
GO
