USE BD_TRANSPORTE;
GO

-- ====================================================================
-- SCRIPT: 08_Update_Ciclos_Martes_A_Lunes_2026.sql
-- Propósito:
--   1. Reconfigurar las semanas operativas en TB_CICLOS_OPERATIVOS 
--      con el formato estricto de MARTES a LUNES para el año 2026:
--      - Semana 01: Martes 30/12/2025 al Lunes 05/01/2026
--      - Semana 02: Martes 06/01/2026 al Lunes 12/01/2026
--      - ... sucesivamente hasta Semana 53.
--   2. Actualizar el campo CicloId en TB_RUTAS_RECOLECCION y 
--      TB_ENTREGAS_COMPANIA en función de la Fecha de cada registro.
-- ====================================================================

PRINT '>> [1/4] Deshabilitando restricciones de Foreign Key temporalmente...';

ALTER TABLE dbo.TB_RUTAS_RECOLECCION NOCHECK CONSTRAINT ALL;
ALTER TABLE dbo.TB_ENTREGAS_COMPANIA NOCHECK CONSTRAINT ALL;
ALTER TABLE dbo.TB_ADELANTOS NOCHECK CONSTRAINT ALL;
ALTER TABLE dbo.TB_LIQUIDACIONES_CABECERA NOCHECK CONSTRAINT ALL;
GO

PRINT '>> [2/4] Regenerando catálogo de ciclos operativos en TB_CICLOS_OPERATIVOS...';

DELETE FROM dbo.TB_CICLOS_OPERATIVOS;
DBCC CHECKIDENT ('dbo.TB_CICLOS_OPERATIVOS', RESEED, 0);
GO

SET IDENTITY_INSERT dbo.TB_CICLOS_OPERATIVOS ON;

DECLARE @Inicio DATE = '2025-12-30'; -- Martes
DECLARE @Semana INT = 1;
DECLARE @FechaActual DATE = CAST(GETDATE() AS DATE);

WHILE @Semana <= 53
BEGIN
    DECLARE @Fin DATE = DATEADD(day, 6, @Inicio); -- Lunes
    DECLARE @Codigo NVARCHAR(100) = 'Semana ' + RIGHT('0' + CAST(@Semana AS VARCHAR(2)), 2) + 
                                    ' (' + CONVERT(VARCHAR(10), @Inicio, 23) + ' al ' + CONVERT(VARCHAR(10), @Fin, 23) + ')';
    
    DECLARE @Estado NVARCHAR(20) = CASE 
        WHEN @FechaActual BETWEEN @Inicio AND @Fin THEN 'ABIERTO'
        WHEN @Fin < @FechaActual THEN 'CERRADO'
        ELSE 'PROGRAMADO'
    END;

    INSERT INTO dbo.TB_CICLOS_OPERATIVOS (Id, Codigo, FechaInicio, FechaFin, Estado, CreatedAt)
    VALUES (@Semana, @Codigo, @Inicio, @Fin, @Estado, GETDATE());

    SET @Inicio = DATEADD(day, 7, @Inicio);
    SET @Semana = @Semana + 1;
END

SET IDENTITY_INSERT dbo.TB_CICLOS_OPERATIVOS OFF;
GO

PRINT '>> [3/4] Actualizando CicloId en tablas operativas según la fecha de recolección y entrega...';

-- Actualizar Rutas de Recolección
UPDATE R
SET R.CicloId = C.Id
FROM dbo.TB_RUTAS_RECOLECCION R
INNER JOIN dbo.TB_CICLOS_OPERATIVOS C
    ON R.Fecha >= C.FechaInicio AND R.Fecha <= C.FechaFin;

PRINT '   ✔ CicloId actualizado en TB_RUTAS_RECOLECCION.';

-- Actualizar Entregas a Compañías / Receptorías
UPDATE E
SET E.CicloId = C.Id
FROM dbo.TB_ENTREGAS_COMPANIA E
INNER JOIN dbo.TB_CICLOS_OPERATIVOS C
    ON E.Fecha >= C.FechaInicio AND E.Fecha <= C.FechaFin;

PRINT '   ✔ CicloId actualizado en TB_ENTREGAS_COMPANIA.';

-- Actualizar Adelantos liquidados (si existen)
UPDATE A
SET A.CicloLiquidadoId = C.Id
FROM dbo.TB_ADELANTOS A
INNER JOIN dbo.TB_CICLOS_OPERATIVOS C
    ON A.Fecha >= C.FechaInicio AND A.Fecha <= C.FechaFin
WHERE A.CicloLiquidadoId IS NOT NULL;
GO

PRINT '>> [4/4] Rehabilitando y verificando restricciones de Foreign Key...';

ALTER TABLE dbo.TB_RUTAS_RECOLECCION WITH CHECK CHECK CONSTRAINT ALL;
ALTER TABLE dbo.TB_ENTREGAS_COMPANIA WITH CHECK CHECK CONSTRAINT ALL;
ALTER TABLE dbo.TB_ADELANTOS WITH CHECK CHECK CONSTRAINT ALL;
ALTER TABLE dbo.TB_LIQUIDACIONES_CABECERA WITH CHECK CHECK CONSTRAINT ALL;
GO

-- ====================================================================
-- VERIFICACIÓN FINAL
-- ====================================================================
SELECT 
    COUNT(*) AS TotalCiclosGenerados,
    MIN(FechaInicio) AS FechaInicioSemana1,
    MAX(FechaFin) AS FechaFinSemana53
FROM dbo.TB_CICLOS_OPERATIVOS;

SELECT 
    C.Id AS CicloId,
    C.Codigo,
    COUNT(R.Id) AS TotalRutasAsociadas
FROM dbo.TB_CICLOS_OPERATIVOS C
LEFT JOIN dbo.TB_RUTAS_RECOLECCION R ON C.Id = R.CicloId
WHERE C.Id <= 10 OR C.Estado = 'ABIERTO'
GROUP BY C.Id, C.Codigo, C.Estado
ORDER BY C.Id;
GO
