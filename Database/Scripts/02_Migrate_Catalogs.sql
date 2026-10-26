USE BD_TRANSPORTE;
GO

-- ====================================================================
-- 1. TABLA TIPOS DE PAGO (NUEVA TABLA)
-- ====================================================================
IF OBJECT_ID('dbo.TiposPago', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.TiposPago (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        Nombre NVARCHAR(50) NOT NULL
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Fincas') AND name = 'TipoPagoId')
BEGIN
    ALTER TABLE dbo.Fincas ADD TipoPagoId INT NULL FOREIGN KEY REFERENCES dbo.TiposPago(Id);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Queseras') AND name = 'TipoPagoId')
BEGIN
    ALTER TABLE dbo.Queseras ADD TipoPagoId INT NULL FOREIGN KEY REFERENCES dbo.TiposPago(Id);
END
GO

-- ====================================================================
-- 2. MIGRAR TIPOS DE PAGO (TB_TIPO_PAGO -> TiposPago)
-- ====================================================================
SET IDENTITY_INSERT dbo.TiposPago ON;

MERGE dbo.TiposPago AS Target
USING (SELECT ID, TIPO FROM TRANSPORTE.dbo.TB_TIPO_PAGO) AS Source
ON Target.Id = Source.ID
WHEN MATCHED THEN 
    UPDATE SET Target.Nombre = Source.TIPO
WHEN NOT MATCHED BY TARGET THEN
    INSERT (Id, Nombre) VALUES (Source.ID, Source.TIPO);

SET IDENTITY_INSERT dbo.TiposPago OFF;
GO

-- ====================================================================
-- 3. MIGRAR BANCOS EXACTOS CON SUS IDs ORIGINALES (TB_BANCOS -> Bancos)
-- ====================================================================
ALTER TABLE dbo.Fincas NOCHECK CONSTRAINT ALL;
DELETE FROM dbo.Bancos;

SET IDENTITY_INSERT dbo.Bancos ON;

INSERT INTO dbo.Bancos (Id, Codigo, Nombre, Activo)
SELECT 
    ID,
    CASE ID
        WHEN 1 THEN '0108' -- Provincial
        WHEN 2 THEN '0134' -- Banesco
        WHEN 3 THEN '0105' -- Mercantil
        WHEN 4 THEN '0191' -- BNC
        WHEN 5 THEN '0114' -- Bancaribe
        WHEN 6 THEN '0115' -- Exterior
        WHEN 7 THEN '0104' -- Venezolano de Crédito
        WHEN 8 THEN '0151' -- BFC
        WHEN 9 THEN '0174' -- Banplus
        WHEN 10 THEN '0138' -- Plaza
        WHEN 11 THEN '0137' -- Sofitasa
        WHEN 12 THEN '0128' -- Caroní
        WHEN 13 THEN '0171' -- Activo
        WHEN 14 THEN '0157' -- Del Sur
        WHEN 15 THEN '0156' -- 100% Banco
        WHEN 16 THEN '0172' -- Bancamiga
        WHEN 17 THEN '0173' -- BID
        WHEN 18 THEN '0102' -- Venezuela
        WHEN 19 THEN '0175' -- Bicentenario
        WHEN 20 THEN '0163' -- Tesoro
        WHEN 21 THEN '0177' -- BANFANB
        WHEN 22 THEN '0166' -- Agrícola
        ELSE '0000'         -- Sin banco
    END AS Codigo,
    NOMBRE,
    1 AS Activo
FROM TRANSPORTE.dbo.TB_BANCOS;

SET IDENTITY_INSERT dbo.Bancos OFF;
ALTER TABLE dbo.Fincas CHECK CONSTRAINT ALL;
GO

-- ====================================================================
-- 4. MIGRAR CONDUCTORES (TB_CONDUCTORES -> Conductores)
-- ====================================================================
SET IDENTITY_INSERT dbo.Conductores ON;

MERGE dbo.Conductores AS Target
USING (
    SELECT 
        ID, 
        NOMBRES, 
        CASE WHEN ELIMINADO = 1 THEN 1 ELSE 0 END AS Activo,
        CASE WHEN ELIMINADO = 2 THEN 1 ELSE 0 END AS IsDeleted
    FROM TRANSPORTE.dbo.TB_CONDUCTORES
) AS Source
ON Target.Id = Source.ID
WHEN MATCHED THEN
    UPDATE SET 
        Target.Nombres = Source.NOMBRES,
        Target.Activo = Source.Activo,
        Target.IsDeleted = Source.IsDeleted
WHEN NOT MATCHED BY TARGET THEN
    INSERT (Id, Nombres, Activo, IsDeleted, CreatedAt)
    VALUES (Source.ID, Source.NOMBRES, Source.Activo, Source.IsDeleted, GETDATE());

SET IDENTITY_INSERT dbo.Conductores OFF;
GO

-- ====================================================================
-- 5. MIGRAR QUESERAS (TB_QUESERAS -> Queseras)
-- ====================================================================
SET IDENTITY_INSERT dbo.Queseras ON;

MERGE dbo.Queseras AS Target
USING (
    SELECT 
        ID,
        NOMBRE,
        PROPIETARIO,
        ID_TIPO,
        ISNULL(VALOR_LECHE, 0.0000) AS VALOR_LECHE,
        CASE WHEN ISNULL(ELIMINADO, 1) = 1 THEN 1 ELSE 0 END AS Activo,
        CASE WHEN ELIMINADO = 2 THEN 1 ELSE 0 END AS IsDeleted
    FROM TRANSPORTE.dbo.TB_QUESERAS
) AS Source
ON Target.Id = Source.ID
WHEN MATCHED THEN
    UPDATE SET 
        Target.Nombre = Source.NOMBRE,
        Target.Encargado = Source.PROPIETARIO,
        Target.TipoPagoId = Source.ID_TIPO,
        Target.PrecioCompraLitroUSD = Source.VALOR_LECHE,
        Target.Activo = Source.Activo,
        Target.IsDeleted = Source.IsDeleted
WHEN NOT MATCHED BY TARGET THEN
    INSERT (Id, Nombre, Encargado, TipoPagoId, PrecioCompraLitroUSD, Activo, IsDeleted, CreatedAt)
    VALUES (Source.ID, Source.NOMBRE, Source.PROPIETARIO, Source.ID_TIPO, Source.VALOR_LECHE, Source.Activo, Source.IsDeleted, GETDATE());

SET IDENTITY_INSERT dbo.Queseras OFF;
GO

-- ====================================================================
-- 6. MIGRAR FINCAS (TB_FINCAS -> Fincas)
-- ====================================================================
SET IDENTITY_INSERT dbo.Fincas ON;

MERGE dbo.Fincas AS Target
USING (
    SELECT 
        ID,
        'FINCA-' + CAST(ID AS VARCHAR(10)) AS Codigo,
        NOMBRE,
        ISNULL(PROPIETARIO, '') AS PROPIETARIO,
        ID_BANCO,
        TIPO AS TipoPagoId,
        ISNULL(VALOR_LECHE, 0.0000) AS VALOR_LECHE,
        CASE WHEN ISNULL(ELIMINADO, 1) = 1 THEN 1 ELSE 0 END AS Activo,
        CASE WHEN ELIMINADO = 2 THEN 1 ELSE 0 END AS IsDeleted
    FROM TRANSPORTE.dbo.TB_FINCAS
) AS Source
ON Target.Id = Source.ID
WHEN MATCHED THEN
    UPDATE SET 
        Target.Nombre = Source.NOMBRE,
        Target.Propietario = Source.PROPIETARIO,
        Target.BancoId = Source.ID_BANCO,
        Target.TipoPagoId = Source.TipoPagoId,
        Target.PrecioLitroUSD = Source.VALOR_LECHE,
        Target.Activo = Source.Activo,
        Target.IsDeleted = Source.IsDeleted
WHEN NOT MATCHED BY TARGET THEN
    INSERT (Id, Codigo, Nombre, Propietario, BancoId, TipoPagoId, PrecioLitroUSD, Activo, IsDeleted, CreatedAt)
    VALUES (Source.ID, Source.Codigo, Source.NOMBRE, Source.PROPIETARIO, Source.ID_BANCO, Source.TipoPagoId, Source.VALOR_LECHE, Source.Activo, Source.IsDeleted, GETDATE());

SET IDENTITY_INSERT dbo.Fincas OFF;
GO
