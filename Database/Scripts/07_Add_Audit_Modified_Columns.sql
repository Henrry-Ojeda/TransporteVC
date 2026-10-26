USE BD_TRANSPORTE;
GO

-- ====================================================================
-- SCRIPT: 07_Add_Audit_Modified_Columns.sql
-- Propósito:
--   1. Actualizar registros existentes en TB_RUTAS_RECOLECCION donde 
--      CreatedBy es NULL con el Id del usuario 'admin'.
--   2. Agregar los campos de auditoría de modificación (ModifiedAt / ModifiedBy)
--      a las tablas operativas TB_RUTAS_RECOLECCION y TB_ENTREGAS_COMPANIA.
-- ====================================================================

PRINT '>> Iniciando actualización de auditoría en TB_RUTAS_RECOLECCION...';

-- 1. Obtener el Id del usuario admin
DECLARE @AdminId INT;
SELECT TOP 1 @AdminId = Id FROM dbo.TB_USUARIOS WHERE Username = 'admin';

IF @AdminId IS NULL
BEGIN
    SELECT TOP 1 @AdminId = Id FROM dbo.TB_USUARIOS WHERE Rol = 'ADMIN';
END

IF @AdminId IS NULL
BEGIN
    SET @AdminId = 1;
END

-- 2. Asignar el Id del admin a los registros existentes con CreatedBy NULL
UPDATE dbo.TB_RUTAS_RECOLECCION
SET CreatedBy = @AdminId
WHERE CreatedBy IS NULL;

PRINT '>> CreatedBy actualizado con el AdminId (' + CAST(@AdminId AS VARCHAR(10)) + ') en TB_RUTAS_RECOLECCION.';

-- 3. Agregar campos de modificación en TB_RUTAS_RECOLECCION si no existen
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.TB_RUTAS_RECOLECCION') AND name = 'ModifiedAt')
BEGIN
    ALTER TABLE dbo.TB_RUTAS_RECOLECCION ADD ModifiedAt DATETIME2 NULL;
    PRINT '>> Columna ModifiedAt agregada a TB_RUTAS_RECOLECCION.';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.TB_RUTAS_RECOLECCION') AND name = 'ModifiedBy')
BEGIN
    ALTER TABLE dbo.TB_RUTAS_RECOLECCION ADD ModifiedBy INT NULL FOREIGN KEY REFERENCES dbo.TB_USUARIOS(Id);
    PRINT '>> Columna ModifiedBy agregada a TB_RUTAS_RECOLECCION.';
END
GO

-- 4. Agregar campos de modificación en TB_ENTREGAS_COMPANIA si no existen
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.TB_ENTREGAS_COMPANIA') AND name = 'ModifiedAt')
BEGIN
    ALTER TABLE dbo.TB_ENTREGAS_COMPANIA ADD ModifiedAt DATETIME2 NULL;
    PRINT '>> Columna ModifiedAt agregada a TB_ENTREGAS_COMPANIA.';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.TB_ENTREGAS_COMPANIA') AND name = 'ModifiedBy')
BEGIN
    ALTER TABLE dbo.TB_ENTREGAS_COMPANIA ADD ModifiedBy INT NULL FOREIGN KEY REFERENCES dbo.TB_USUARIOS(Id);
    PRINT '>> Columna ModifiedBy agregada a TB_ENTREGAS_COMPANIA.';
END
GO

-- 5. Verificación de columnas y registros
SELECT 
    COUNT(*) AS TotalRutas,
    COUNT(CreatedBy) AS TotalConCreatedBy,
    (SELECT TOP 1 Id FROM dbo.TB_USUARIOS WHERE Username = 'admin') AS AdminIdAsignado
FROM dbo.TB_RUTAS_RECOLECCION;

SELECT TOP 5 Id, Fecha, FincaId, UsuarioId, Litros, CreatedBy, ModifiedAt, ModifiedBy
FROM dbo.TB_RUTAS_RECOLECCION
ORDER BY Id DESC;
GO
