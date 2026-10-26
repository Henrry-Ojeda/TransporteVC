USE BD_TRANSPORTE;
GO

-- ====================================================================
-- SCRIPT DE MIGRACIÓN: 04_Migrate_Historial_BCV_From_Parametros.sql
-- Propósito: Copiar las tasas históricas desde la tabla TB_PARAMETROS 
--            de la base de datos "TRANSPORTE" hacia la tabla TB_HISTORIAL_BCV 
--            en la base de datos "BD_TRANSPORTE".
-- Rango: Desde 2024-01-01 hasta la fecha actual.
-- ⚠️ REGLA ESTRICTA: SOLO LECTURA en base de datos "TRANSPORTE" (NO BORRA NADA).
-- ====================================================================

PRINT '>> Iniciando migración de tasas históricas desde TRANSPORTE.dbo.TB_PARAMETROS hacia BD_TRANSPORTE.dbo.TB_HISTORIAL_BCV...';

;WITH ParametrosUnicos AS (
    SELECT 
        CAST(FECHA AS DATE) AS Fecha,
        CAST(VALOR_DOLAR AS DECIMAL(18,4)) AS TasaDolarBs,
        ROW_NUMBER() OVER (PARTITION BY CAST(FECHA AS DATE) ORDER BY ID DESC) AS Fila
    FROM TRANSPORTE.dbo.TB_PARAMETROS
    WHERE FECHA >= '2024-01-01'
      AND VALOR_DOLAR > 0
)
MERGE dbo.TB_HISTORIAL_BCV AS Target
USING (
    SELECT Fecha, TasaDolarBs
    FROM ParametrosUnicos
    WHERE Fila = 1
) AS Source
ON Target.Fecha = Source.Fecha
WHEN MATCHED THEN
    UPDATE SET 
        Target.TasaDolarBs = Source.TasaDolarBs,
        Target.Fuente = COALESCE(Target.Fuente, 'BCV_PARAMETROS_HISTORICO'),
        Target.Observacion = COALESCE(Target.Observacion, 'Migrado desde TB_PARAMETROS')
WHEN NOT MATCHED BY TARGET THEN
    INSERT (Fecha, TasaDolarBs, Fuente, Observacion, CreatedAt)
    VALUES (Source.Fecha, Source.TasaDolarBs, 'BCV_PARAMETROS_HISTORICO', 'Migrado desde TB_PARAMETROS', GETDATE());

PRINT '>> Migración completada exitosamente.';

-- Verificación de registros migrados
SELECT 
    COUNT(*) AS TotalTasasRegistradas,
    MIN(Fecha) AS FechaMasAntigua,
    MAX(Fecha) AS FechaMasReciente
FROM dbo.TB_HISTORIAL_BCV;
GO
