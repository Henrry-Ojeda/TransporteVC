USE BD_TRANSPORTE;
GO

-- ====================================================================
-- SCRIPT: 05_Clean_And_Assign_Admin_Historial_BCV.sql
-- Propósito: 
--   1. Eliminar los dos primeros registros de prueba (Id = 1 e Id = 2).
--   2. Asignar el Id del usuario 'admin' en el campo CreatedBy de todos 
--      los registros de TB_HISTORIAL_BCV.
-- ====================================================================

-- 1. Obtener el Id del usuario admin
DECLARE @AdminId INT;
SELECT TOP 1 @AdminId = Id FROM dbo.TB_USUARIOS WHERE Username = 'admin';

IF @AdminId IS NULL
BEGIN
    PRINT '>> Advertencia: No se encontró el usuario admin. Asignando 1 por defecto.';
    SET @AdminId = 1;
END

-- 2. Eliminar los dos primeros registros (Id = 1 e Id = 2)
DELETE FROM dbo.TB_HISTORIAL_BCV 
WHERE Id IN (1, 2);

PRINT '>> Los dos primeros registros (Id 1 y 2) han sido eliminados.';

-- 3. Asignar el Id del admin en CreatedBy
UPDATE dbo.TB_HISTORIAL_BCV
SET CreatedBy = @AdminId
WHERE CreatedBy IS NULL OR CreatedBy <> @AdminId;

PRINT '>> Campo CreatedBy actualizado con el Id del Admin (' + CAST(@AdminId AS VARCHAR(10)) + ') para todos los registros.';

-- 4. Verificación final
SELECT 
    COUNT(*) AS TotalRegistros,
    COUNT(CreatedBy) AS TotalConAdminId,
    MIN(Fecha) AS FechaMin,
    MAX(Fecha) AS FechaMax
FROM dbo.TB_HISTORIAL_BCV;

SELECT TOP 5 Id, Fecha, TasaDolarBs, Fuente, CreatedBy 
FROM dbo.TB_HISTORIAL_BCV 
ORDER BY Id ASC;
GO
