-- =========================================================================
-- SCRIPT 10: AGREGAR CAMPOS PARA TARIFICACIÓN Y CONTROL DE LECHE ÁCIDA
-- =========================================================================

-- 1. Agregar columna PrecioLitroAcidaUSD en TB_FINCAS
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('TB_FINCAS') AND name = 'PrecioLitroAcidaUSD')
BEGIN
    ALTER TABLE TB_FINCAS ADD PrecioLitroAcidaUSD DECIMAL(10,4) NOT NULL DEFAULT 0.0000;
END
GO

-- 2. Agregar columnas EsAcida y PrecioLitroUSDAplicado en TB_RUTAS_RECOLECCION
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('TB_RUTAS_RECOLECCION') AND name = 'EsAcida')
BEGIN
    ALTER TABLE TB_RUTAS_RECOLECCION ADD EsAcida BIT NOT NULL DEFAULT 0;
END
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('TB_RUTAS_RECOLECCION') AND name = 'PrecioLitroUSDAplicado')
BEGIN
    ALTER TABLE TB_RUTAS_RECOLECCION ADD PrecioLitroUSDAplicado DECIMAL(10,4) NULL;
END
GO

-- 3. Actualizar tickets existentes en TB_RUTAS_RECOLECCION que tengan PrecioLitroUSDAplicado NULL
UPDATE r
SET r.PrecioLitroUSDAplicado = CASE WHEN r.EsAcida = 1 THEN f.PrecioLitroAcidaUSD ELSE f.PrecioLitroUSD END
FROM TB_RUTAS_RECOLECCION r
INNER JOIN TB_FINCAS f ON r.FincaId = f.Id
WHERE r.PrecioLitroUSDAplicado IS NULL;
GO
