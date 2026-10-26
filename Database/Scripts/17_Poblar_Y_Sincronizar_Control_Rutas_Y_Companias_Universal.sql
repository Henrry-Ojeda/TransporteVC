-- =========================================================================================
-- Script: 17_Poblar_Y_Sincronizar_Control_Rutas_Y_Companias_Universal.sql
-- Base de Datos: BD_TRANSPORTE_V2
-- Objetivo: Agrupar por Fecha y UsuarioId los registros de TB_RUTAS_RECOLECCION y TB_ENTREGAS_COMPANIA
--           para poblar TB_CONTROL_RUTAS y TB_CONTROL_COMPANIAS sin borrar ningún registro.
-- Regla de Negocio: La Finca CHOFERES (FincaId = 68) contiene el asiento de merma/diferencia (+/-).
--                   Las salidas de Receptoría (Litros < 0 en CompaniaId = 5028) emparejadas con
--                   queseras (Litros > 0) alimentan TB_CONTROL_COMPANIAS.
-- =========================================================================================

SET NOCOUNT ON;
BEGIN TRANSACTION;

PRINT '>> [PASO 1] Insertando cabeceras en TB_CONTROL_RUTAS para todas las fechas...';

INSERT INTO TB_CONTROL_RUTAS (
    Fecha,
    UsuarioId,
    CicloId,
    TotalLitrosFinca,
    TotalLitrosReceptoria,
    LitrosEntregadosCompania,
    DiferenciaLitros,
    PorcentajeMerma,
    Estado,
    ProcesoActualId,
    TipoDestino,
    LitrosRecibidosReceptoria,
    DiferenciaReceptoria,
    LitrosCargadosAdicional,
    CompaniaDestinoId,
    DiferenciaCompania,
    MermaTotalLitros,
    Observacion,
    CreatedAt,
    CreatedBy
)
SELECT 
    r.Fecha,
    r.UsuarioId,
    ISNULL(MIN(r.CicloId), 1) AS CicloId,
    -- Suma de fincas de productores reales (excluyendo Finca 68)
    SUM(CASE WHEN r.FincaId != 68 THEN r.Litros ELSE 0 END) AS TotalLitrosFinca,
    -- Leche entregada en Receptoría (positiva)
    ISNULL((
        SELECT SUM(e.Litros) 
        FROM TB_ENTREGAS_COMPANIA e 
        WHERE e.Fecha = r.Fecha AND e.UsuarioId = r.UsuarioId AND e.CompaniaId = 5028 AND e.Litros > 0
    ), 0) AS TotalLitrosReceptoria,
    -- Leche entregada directamente a queseras
    ISNULL((
        SELECT SUM(e.Litros) 
        FROM TB_ENTREGAS_COMPANIA e 
        WHERE e.Fecha = r.Fecha AND e.UsuarioId = r.UsuarioId AND e.CompaniaId != 5028 AND e.Litros > 0
          AND NOT (
              e.UsuarioId = 7 
              OR EXISTS (
                  SELECT 1 FROM TB_ENTREGAS_COMPANIA sal 
                  WHERE sal.Fecha = e.Fecha AND sal.UsuarioId = e.UsuarioId 
                    AND sal.CompaniaId = 5028 AND sal.Litros < 0
              )
          )
    ), 0) AS LitrosEntregadosCompania,
    -- Diferencia confirmada por FincaId = 68 (merma) o calculada
    ISNULL(
        NULLIF(SUM(CASE WHEN r.FincaId = 68 THEN r.Litros ELSE 0 END), 0),
        (
            ISNULL((
                SELECT SUM(e.Litros) 
                FROM TB_ENTREGAS_COMPANIA e 
                WHERE e.Fecha = r.Fecha AND e.UsuarioId = r.UsuarioId AND e.Litros > 0
            ), 0) - SUM(CASE WHEN r.FincaId != 68 THEN r.Litros ELSE 0 END)
        )
    ) AS DiferenciaLitros,
    -- Porcentaje de merma
    CASE 
        WHEN SUM(CASE WHEN r.FincaId != 68 THEN r.Litros ELSE 0 END) > 0 THEN
            ROUND(CAST(ABS(ISNULL(SUM(CASE WHEN r.FincaId = 68 THEN r.Litros ELSE 0 END), 0)) * 100.0 / 
                  SUM(CASE WHEN r.FincaId != 68 THEN r.Litros ELSE 0 END) AS DECIMAL(5,2)), 2)
        ELSE 0.00 
    END AS PorcentajeMerma,
    'FINALIZADO' AS Estado,
    4 AS ProcesoActualId, -- Cerrado / Finalizado
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM TB_ENTREGAS_COMPANIA e 
            WHERE e.Fecha = r.Fecha AND e.UsuarioId = r.UsuarioId AND e.CompaniaId = 5028 AND e.Litros > 0
        ) THEN 'RECEPTORIA'
        ELSE 'DIRECTO'
    END AS TipoDestino,
    ISNULL((
        SELECT SUM(e.Litros) 
        FROM TB_ENTREGAS_COMPANIA e 
        WHERE e.Fecha = r.Fecha AND e.UsuarioId = r.UsuarioId AND e.CompaniaId = 5028 AND e.Litros > 0
    ), 0) AS LitrosRecibidosReceptoria,
    0 AS DiferenciaReceptoria,
    0 AS LitrosCargadosAdicional,
    NULL AS CompaniaDestinoId,
    0 AS DiferenciaCompania,
    ABS(ISNULL(SUM(CASE WHEN r.FincaId = 68 THEN r.Litros ELSE 0 END), 0)) AS MermaTotalLitros,
    'Sincronización histórica agrupada por Fecha y Chofer' AS Observacion,
    CAST(r.Fecha AS DATETIME2) AS CreatedAt,
    r.UsuarioId AS CreatedBy
FROM TB_RUTAS_RECOLECCION r
WHERE NOT EXISTS (
    SELECT 1 FROM TB_CONTROL_RUTAS cr 
    WHERE cr.Fecha = r.Fecha AND cr.UsuarioId = r.UsuarioId
)
GROUP BY r.Fecha, r.UsuarioId;

PRINT '>> Filas insertadas en TB_CONTROL_RUTAS: ' + CAST(@@ROWCOUNT AS VARCHAR(10));

-- 2. Enlazar ControlRutaId en TB_RUTAS_RECOLECCION
PRINT '>> [PASO 2] Vinculando ControlRutaId en TB_RUTAS_RECOLECCION...';
UPDATE r
SET r.ControlRutaId = cr.Id
FROM TB_RUTAS_RECOLECCION r
JOIN TB_CONTROL_RUTAS cr ON cr.Fecha = r.Fecha AND cr.UsuarioId = r.UsuarioId
WHERE r.ControlRutaId IS NULL OR r.ControlRutaId != cr.Id;

PRINT '>> Filas vinculadas en TB_RUTAS_RECOLECCION: ' + CAST(@@ROWCOUNT AS VARCHAR(10));

-- 3. Enlazar ControlRutaId en TB_ENTREGAS_COMPANIA (entregas de rutas)
PRINT '>> [PASO 3] Vinculando ControlRutaId en TB_ENTREGAS_COMPANIA...';
UPDATE e
SET e.ControlRutaId = cr.Id
FROM TB_ENTREGAS_COMPANIA e
JOIN TB_CONTROL_RUTAS cr ON cr.Fecha = e.Fecha AND cr.UsuarioId = e.UsuarioId
WHERE e.Litros > 0 AND e.ControlRutaId IS NULL
  AND NOT (
      e.UsuarioId = 7 
      OR EXISTS (
          SELECT 1 FROM TB_ENTREGAS_COMPANIA sal 
          WHERE sal.Fecha = e.Fecha AND sal.UsuarioId = e.UsuarioId 
            AND sal.CompaniaId = 5028 AND sal.Litros < 0
      )
  );

PRINT '>> Filas vinculadas en TB_ENTREGAS_COMPANIA: ' + CAST(@@ROWCOUNT AS VARCHAR(10));

-- 4. Insertar despachos en TB_CONTROL_COMPANIAS
PRINT '>> [PASO 4] Insertando registros en TB_CONTROL_COMPANIAS...';
INSERT INTO TB_CONTROL_COMPANIAS (
    Fecha,
    UsuarioId,
    CompaniaId,
    CicloId,
    LitrosDespachados,
    LitrosRecibidosCompania,
    DiferenciaLitros,
    PorcentajeMerma,
    Estado,
    Observacion,
    FechaSalida,
    FechaEntrega,
    CreatedAt,
    CreatedBy
)
SELECT 
    e.Fecha,
    e.UsuarioId,
    e.CompaniaId,
    ISNULL(e.CicloId, 1) AS CicloId,
    SUM(e.Litros) AS LitrosDespachados,
    SUM(e.Litros) AS LitrosRecibidosCompania,
    0 AS DiferenciaLitros,
    0.00 AS PorcentajeMerma,
    'DESPACHO' AS Estado,
    'Despacho de salida de receptoria' AS Observacion,
    CAST(e.Fecha AS DATETIME2) AS FechaSalida,
    CAST(e.Fecha AS DATETIME2) AS FechaEntrega,
    CAST(e.Fecha AS DATETIME2) AS CreatedAt,
    e.UsuarioId AS CreatedBy
FROM TB_ENTREGAS_COMPANIA e
WHERE e.CompaniaId != 5028 
  AND e.Litros > 0
  AND (
      e.UsuarioId = 7 
      OR EXISTS (
          SELECT 1 FROM TB_ENTREGAS_COMPANIA sal 
          WHERE sal.Fecha = e.Fecha AND sal.UsuarioId = e.UsuarioId 
            AND sal.CompaniaId = 5028 AND sal.Litros < 0
      )
      OR NOT EXISTS (
          SELECT 1 FROM TB_RUTAS_RECOLECCION r 
          WHERE r.Fecha = e.Fecha AND r.UsuarioId = e.UsuarioId
      )
  )
  AND NOT EXISTS (
      SELECT 1 FROM TB_CONTROL_COMPANIAS cc 
      WHERE cc.Fecha = e.Fecha AND cc.UsuarioId = e.UsuarioId AND cc.CompaniaId = e.CompaniaId
  )
GROUP BY e.Fecha, e.UsuarioId, e.CompaniaId, e.CicloId;

PRINT '>> Filas insertadas en TB_CONTROL_COMPANIAS: ' + CAST(@@ROWCOUNT AS VARCHAR(10));

-- 5. Validación de integridad
DECLARE @Huerfanos INT;
SELECT @Huerfanos = COUNT(*) FROM TB_RUTAS_RECOLECCION WHERE ControlRutaId IS NULL;

IF (@Huerfanos = 0)
BEGIN
    PRINT '>> Validacion exitosa: 0 registros huerfanos. Haciendo COMMIT...';
    COMMIT TRANSACTION;
    PRINT '>> Proceso finalizado satisfactoriamente.';
END
ELSE
BEGIN
    PRINT '>> Advertencia: Quedaron huerfanos. Haciendo ROLLBACK...';
    ROLLBACK TRANSACTION;
END
GO
