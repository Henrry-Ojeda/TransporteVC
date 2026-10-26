-- =========================================================================================
-- Script: 15_Poblar_TB_CONTROL_RUTAS_Desde_25_08_2026.sql
-- Descripción:
--   Agrupa los registros de TB_RUTAS_RECOLECCION desde el 25-08-2026 por (UsuarioId, Fecha),
--   crea un ticket en TB_CONTROL_RUTAS por cada combinación Chofer+Fecha,
--   y actualiza SOLO TB_RUTAS_RECOLECCION con el ControlRutaId resultante.
--   NOTA: TB_ENTREGAS_COMPANIA NO se vincula al ControlRutaId.
-- =========================================================================================

DECLARE @FechaDesde DATE = '2026-08-25';
DECLARE @ProcesoRutaId INT;

-- Obtener el Id del proceso RUTA (estado inicial)
SELECT @ProcesoRutaId = Id FROM dbo.TB_PROCESOS_TICKET WHERE Codigo = 'RUTA';

-- Crear tabla temporal para iterar sobre los grupos Chofer+Fecha
IF OBJECT_ID('tempdb..#GruposRuta') IS NOT NULL DROP TABLE #GruposRuta;

CREATE TABLE #GruposRuta (
    RowNum          INT IDENTITY(1,1),
    UsuarioId       INT,
    NombreConductor NVARCHAR(200),
    Fecha           DATE,
    CicloId         INT,
    TotalFinca      INT,
    TotalReceptoria INT,
    DiferenciaLitros INT,
    PorcentajeMerma DECIMAL(5,2),
    Estado          VARCHAR(50)
);

-- Poblar la tabla temporal con los grupos calculados
INSERT INTO #GruposRuta (UsuarioId, NombreConductor, Fecha, CicloId, TotalFinca, TotalReceptoria, DiferenciaLitros, PorcentajeMerma, Estado)
SELECT
    r.UsuarioId,
    u.NombreCompleto AS NombreConductor,
    CAST(r.Fecha AS DATE) AS Fecha,
    -- Ciclo operativo: el que contenga la fecha del registro
    (SELECT TOP 1 Id FROM dbo.TB_CICLOS_OPERATIVOS 
     WHERE CAST(r.Fecha AS DATE) BETWEEN FechaInicio AND FechaFin 
     ORDER BY FechaInicio DESC) AS CicloId,
    -- Total litros de fincas (excluye fincas de descuento/chofer que son mermas ya registradas)
    ISNULL(SUM(CASE WHEN f.Nombre NOT LIKE '%CHOFER%' AND f.Nombre NOT LIKE '%DESCUENTO%' THEN r.Litros ELSE 0 END), 0) AS TotalFinca,
    -- Total litros entregados en receptoría para ese chofer y fecha
    ISNULL((SELECT SUM(ec.Litros) 
             FROM dbo.TB_ENTREGAS_COMPANIA ec
             WHERE ec.UsuarioId = r.UsuarioId 
               AND CAST(ec.Fecha AS DATE) = CAST(r.Fecha AS DATE)), 0) AS TotalReceptoria,
    -- Diferencia
    ISNULL(SUM(CASE WHEN f.Nombre NOT LIKE '%CHOFER%' AND f.Nombre NOT LIKE '%DESCUENTO%' THEN r.Litros ELSE 0 END), 0)
    - ISNULL((SELECT SUM(ec.Litros) 
               FROM dbo.TB_ENTREGAS_COMPANIA ec
               WHERE ec.UsuarioId = r.UsuarioId 
                 AND CAST(ec.Fecha AS DATE) = CAST(r.Fecha AS DATE)), 0) AS DiferenciaLitros,
    -- Porcentaje de merma
    CASE 
        WHEN ISNULL(SUM(CASE WHEN f.Nombre NOT LIKE '%CHOFER%' AND f.Nombre NOT LIKE '%DESCUENTO%' THEN r.Litros ELSE 0 END), 0) > 0
        THEN ROUND(
            ABS(
                ISNULL(SUM(CASE WHEN f.Nombre NOT LIKE '%CHOFER%' AND f.Nombre NOT LIKE '%DESCUENTO%' THEN r.Litros ELSE 0 END), 0)
                - ISNULL((SELECT SUM(ec.Litros) FROM dbo.TB_ENTREGAS_COMPANIA ec
                           WHERE ec.UsuarioId = r.UsuarioId AND CAST(ec.Fecha AS DATE) = CAST(r.Fecha AS DATE)), 0)
            ) * 100.0 / 
            ISNULL(SUM(CASE WHEN f.Nombre NOT LIKE '%CHOFER%' AND f.Nombre NOT LIKE '%DESCUENTO%' THEN r.Litros ELSE 0 END), 0)
        , 2)
        ELSE 0
    END AS PorcentajeMerma,
    -- Estado automático
    CASE 
        WHEN (
            ISNULL(SUM(CASE WHEN f.Nombre NOT LIKE '%CHOFER%' AND f.Nombre NOT LIKE '%DESCUENTO%' THEN r.Litros ELSE 0 END), 0)
            - ISNULL((SELECT SUM(ec.Litros) FROM dbo.TB_ENTREGAS_COMPANIA ec
                       WHERE ec.UsuarioId = r.UsuarioId AND CAST(ec.Fecha AS DATE) = CAST(r.Fecha AS DATE)), 0)
        ) = 0 THEN 'CUADRADO'
        WHEN ROUND(ABS(
            ISNULL(SUM(CASE WHEN f.Nombre NOT LIKE '%CHOFER%' AND f.Nombre NOT LIKE '%DESCUENTO%' THEN r.Litros ELSE 0 END), 0)
            - ISNULL((SELECT SUM(ec.Litros) FROM dbo.TB_ENTREGAS_COMPANIA ec
                       WHERE ec.UsuarioId = r.UsuarioId AND CAST(ec.Fecha AS DATE) = CAST(r.Fecha AS DATE)), 0)
        ) * 100.0 / NULLIF(SUM(CASE WHEN f.Nombre NOT LIKE '%CHOFER%' AND f.Nombre NOT LIKE '%DESCUENTO%' THEN r.Litros ELSE 0 END), 0), 2) > 5 
        THEN 'MERMA_EXCESIVA'
        ELSE 'PENDIENTE'
    END AS Estado
FROM dbo.TB_RUTAS_RECOLECCION r
INNER JOIN dbo.TB_FINCAS f ON r.FincaId = f.Id
INNER JOIN dbo.TB_USUARIOS u ON r.UsuarioId = u.Id
WHERE CAST(r.Fecha AS DATE) >= @FechaDesde
  AND r.ControlRutaId IS NULL   -- Solo los que aún NO tienen ticket asignado
GROUP BY r.UsuarioId, u.NombreCompleto, CAST(r.Fecha AS DATE);

-- Verificar cuántos grupos se procesarán
DECLARE @TotalGrupos INT = (SELECT COUNT(*) FROM #GruposRuta);
PRINT 'Grupos a procesar (Chofer+Fecha): ' + CAST(@TotalGrupos AS VARCHAR(10));

-- Iterar sobre cada grupo y crear su ticket
DECLARE @i INT = 1;
DECLARE @NuevoControlId BIGINT;

WHILE @i <= @TotalGrupos
BEGIN
    DECLARE @UId   INT;
    DECLARE @Fecha DATE;
    DECLARE @CicloId INT;
    DECLARE @TotalF INT;
    DECLARE @TotalR INT;
    DECLARE @Dif    INT;
    DECLARE @Pct    DECIMAL(5,2);
    DECLARE @Est    VARCHAR(50);
    DECLARE @Nombre NVARCHAR(200);

    SELECT
        @UId    = UsuarioId,
        @Fecha  = Fecha,
        @CicloId = CicloId,
        @TotalF = TotalFinca,
        @TotalR = TotalReceptoria,
        @Dif    = DiferenciaLitros,
        @Pct    = PorcentajeMerma,
        @Est    = Estado,
        @Nombre = NombreConductor
    FROM #GruposRuta WHERE RowNum = @i;

    -- Insertar ticket en TB_CONTROL_RUTAS
    INSERT INTO dbo.TB_CONTROL_RUTAS
        (Fecha, UsuarioId, CicloId, TotalLitrosFinca, TotalLitrosReceptoria,
         DiferenciaLitros, PorcentajeMerma, Estado, ProcesoActualId,
         Observacion, CreatedAt, CreatedBy)
    VALUES
        (@Fecha, @UId, @CicloId, @TotalF, @TotalR,
         @Dif, @Pct, @Est, @ProcesoRutaId,
         'Generado automáticamente desde registros históricos desde ' + CONVERT(VARCHAR(10), @FechaDesde, 120),
         GETDATE(), 1);

    SET @NuevoControlId = SCOPE_IDENTITY();

    -- Actualizar TB_RUTAS_RECOLECCION del grupo con el nuevo ControlRutaId
    UPDATE dbo.TB_RUTAS_RECOLECCION
    SET ControlRutaId = @NuevoControlId
    WHERE UsuarioId = @UId
      AND CAST(Fecha AS DATE) = @Fecha
      AND ControlRutaId IS NULL;


    PRINT 'Ticket #' + CAST(@NuevoControlId AS VARCHAR(20)) + 
          ' creado: Chofer=' + @Nombre + 
          ' | Fecha=' + CONVERT(VARCHAR(10), @Fecha, 120) +
          ' | Finca=' + CAST(@TotalF AS VARCHAR(10)) + 'L' +
          ' | Recep=' + CAST(@TotalR AS VARCHAR(10)) + 'L' +
          ' | Dif=' + CAST(@Dif AS VARCHAR(10)) + 'L' +
          ' | Estado=' + @Est;

    SET @i = @i + 1;
END;

-- Insertar registro inicial de historial para cada ticket creado
INSERT INTO dbo.TB_HISTORIAL_PROCESOS_TICKET (ControlRutaId, ProcesoId, FechaCambio, CambiadoPor, Observacion)
SELECT 
    cr.Id,
    @ProcesoRutaId,
    cr.CreatedAt,
    1,
    'Estado inicial asignado en migración histórica.'
FROM dbo.TB_CONTROL_RUTAS cr
WHERE cr.Observacion LIKE 'Generado automáticamente desde registros históricos%'
  AND NOT EXISTS (
      SELECT 1 FROM dbo.TB_HISTORIAL_PROCESOS_TICKET h WHERE h.ControlRutaId = cr.Id
  );

DROP TABLE #GruposRuta;

-- Reporte final
SELECT 
    u.NombreCompleto AS Chofer,
    cr.Fecha,
    cr.TotalLitrosFinca,
    cr.TotalLitrosReceptoria,
    cr.DiferenciaLitros,
    cr.PorcentajeMerma,
    cr.Estado,
    (SELECT COUNT(*) FROM TB_RUTAS_RECOLECCION r WHERE r.ControlRutaId = cr.Id) AS RegistrosRuta
FROM dbo.TB_CONTROL_RUTAS cr
INNER JOIN dbo.TB_USUARIOS u ON cr.UsuarioId = u.Id
WHERE cr.Fecha >= @FechaDesde
ORDER BY cr.Fecha ASC, u.NombreCompleto ASC;

PRINT 'Proceso completado.';
