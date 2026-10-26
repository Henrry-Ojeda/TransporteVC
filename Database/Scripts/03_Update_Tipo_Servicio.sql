USE BD_TRANSPORTE;
GO

-- 1. Crear tabla TiposServicio
IF OBJECT_ID('dbo.TiposServicio', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.TiposServicio (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        Nombre NVARCHAR(50) NOT NULL,
        Descripcion NVARCHAR(250) NULL,
        Activo BIT NOT NULL DEFAULT 1
    );
END
GO

-- 2. Poblar TiposServicio con RUTA y TRANSPORTE
SET IDENTITY_INSERT dbo.TiposServicio ON;

MERGE dbo.TiposServicio AS Target
USING (
    VALUES 
        (1, 'RUTA', 'Ruta Propia (Compra directa de leche a la finca y venta a queseras)'),
        (2, 'TRANSPORTE', 'Servicio de Flete a Terceros (Transporte y acarreo de leche para otra empresa)')
) AS Source (Id, Nombre, Descripcion)
ON Target.Id = Source.Id
WHEN MATCHED THEN
    UPDATE SET Target.Nombre = Source.Nombre, Target.Descripcion = Source.Descripcion
WHEN NOT MATCHED BY TARGET THEN
    INSERT (Id, Nombre, Descripcion, Activo) VALUES (Source.Id, Source.Nombre, Source.Descripcion, 1);

SET IDENTITY_INSERT dbo.TiposServicio OFF;
GO

-- 3. Eliminar Foreign Keys existentes hacia TiposPago
DECLARE @sql NVARCHAR(MAX) = N'';
SELECT @sql += N'ALTER TABLE ' + QUOTENAME(OBJECT_SCHEMA_NAME(parent_object_id)) + '.' + QUOTENAME(OBJECT_NAME(parent_object_id)) + 
               N' DROP CONSTRAINT ' + QUOTENAME(name) + ';'
FROM sys.foreign_keys
WHERE referenced_object_id = OBJECT_ID('dbo.TiposPago');
IF @sql <> N'' EXEC sp_executesql @sql;
GO

-- 4. Renombrar columnas a TipoServicioId
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Fincas') AND name = 'TipoPagoId')
BEGIN
    EXEC sp_rename 'dbo.Fincas.TipoPagoId', 'TipoServicioId', 'COLUMN';
END
GO

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Queseras') AND name = 'TipoPagoId')
BEGIN
    EXEC sp_rename 'dbo.Queseras.TipoPagoId', 'TipoServicioId', 'COLUMN';
END
GO

-- 5. Eliminar tabla vieja TiposPago si existía
IF OBJECT_ID('dbo.TiposPago', 'U') IS NOT NULL
BEGIN
    DROP TABLE dbo.TiposPago;
END
GO

-- 6. Agregar Foreign Keys hacia TiposServicio
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Fincas_TiposServicio')
BEGIN
    ALTER TABLE dbo.Fincas 
    ADD CONSTRAINT FK_Fincas_TiposServicio FOREIGN KEY (TipoServicioId) REFERENCES dbo.TiposServicio(Id);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Queseras_TiposServicio')
BEGIN
    ALTER TABLE dbo.Queseras 
    ADD CONSTRAINT FK_Queseras_TiposServicio FOREIGN KEY (TipoServicioId) REFERENCES dbo.TiposServicio(Id);
END
GO
