USE BD_CV_PROD;
GO

SET NOCOUNT ON;

-- =====================================================================
-- 1. ACTUALIZAR TB_CAMIONES (Capacidad de Tanque, Tipo Combustible, Odómetro)
-- =====================================================================
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.TB_CAMIONES') AND name = 'CapacidadTanqueLitros')
BEGIN
    ALTER TABLE dbo.TB_CAMIONES ADD CapacidadTanqueLitros DECIMAL(10,2) NOT NULL DEFAULT 0;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.TB_CAMIONES') AND name = 'TipoCombustible')
BEGIN
    ALTER TABLE dbo.TB_CAMIONES ADD TipoCombustible NVARCHAR(20) NOT NULL DEFAULT 'GASOIL';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.TB_CAMIONES') AND name = 'OdometroActualKm')
BEGIN
    ALTER TABLE dbo.TB_CAMIONES ADD OdometroActualKm DECIMAL(12,2) NOT NULL DEFAULT 0;
END
GO

-- =====================================================================
-- 2. TABLA DE RUTAS LOGÍSTICAS (Planificación de Zonas/Rutas y asignación)
-- =====================================================================
IF OBJECT_ID('dbo.TB_RUTAS_LOGISTICA', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.TB_RUTAS_LOGISTICA (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        Codigo NVARCHAR(50) NOT NULL UNIQUE,
        Nombre NVARCHAR(100) NOT NULL,
        Descripcion NVARCHAR(300) NULL,
        Color NVARCHAR(30) NOT NULL DEFAULT '#2563eb',
        Activo BIT NOT NULL DEFAULT 1,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETDATE()
    );

    -- Rutas iniciales estándar
    INSERT INTO dbo.TB_RUTAS_LOGISTICA (Codigo, Nombre, Descripcion, Color)
    VALUES 
        ('RUTA_SUR', 'Zona Sur', 'Ruta de recolección sector sur y fincas aledañas', '#2563eb'),
        ('RUTA_NORTE', 'Zona Norte', 'Ruta de recolección sector norte y fincas asociadas', '#059669'),
        ('RUTA_MEDIA', 'Zona Media', 'Ruta centro / zona media de producción', '#d97706'),
        ('RUTA_OCCIDENTE', 'Zona Occidente', 'Ruta eje vial occidente', '#7c3aed');
END
GO

-- =====================================================================
-- 3. ASOCIAR RUTA A FINCAS (TB_FINCAS)
-- =====================================================================
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.TB_FINCAS') AND name = 'RutaId')
BEGIN
    ALTER TABLE dbo.TB_FINCAS ADD RutaId INT NULL FOREIGN KEY REFERENCES dbo.TB_RUTAS_LOGISTICA(Id);
END
GO

-- =====================================================================
-- 4. ACTUALIZAR TB_CONTROL_RUTAS (Tickets con Ruta y Control de Combustible/Km)
-- =====================================================================
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.TB_CONTROL_RUTAS') AND name = 'RutaLogisticaId')
BEGIN
    ALTER TABLE dbo.TB_CONTROL_RUTAS ADD RutaLogisticaId INT NULL FOREIGN KEY REFERENCES dbo.TB_RUTAS_LOGISTICA(Id);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.TB_CONTROL_RUTAS') AND name = 'CombustibleLitrosSalida')
BEGIN
    ALTER TABLE dbo.TB_CONTROL_RUTAS ADD CombustibleLitrosSalida DECIMAL(10,2) NULL DEFAULT 0;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.TB_CONTROL_RUTAS') AND name = 'CombustibleLitrosLlegada')
BEGIN
    ALTER TABLE dbo.TB_CONTROL_RUTAS ADD CombustibleLitrosLlegada DECIMAL(10,2) NULL DEFAULT 0;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.TB_CONTROL_RUTAS') AND name = 'CombustibleConsumidoLitros')
BEGIN
    ALTER TABLE dbo.TB_CONTROL_RUTAS ADD CombustibleConsumidoLitros DECIMAL(10,2) NULL DEFAULT 0;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.TB_CONTROL_RUTAS') AND name = 'OdometroInicialKm')
BEGIN
    ALTER TABLE dbo.TB_CONTROL_RUTAS ADD OdometroInicialKm DECIMAL(12,2) NULL DEFAULT 0;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.TB_CONTROL_RUTAS') AND name = 'OdometroFinalKm')
BEGIN
    ALTER TABLE dbo.TB_CONTROL_RUTAS ADD OdometroFinalKm DECIMAL(12,2) NULL DEFAULT 0;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.TB_CONTROL_RUTAS') AND name = 'KmRecorridos')
BEGIN
    ALTER TABLE dbo.TB_CONTROL_RUTAS ADD KmRecorridos DECIMAL(12,2) NULL DEFAULT 0;
END
GO

-- =====================================================================
-- 5. INVENTARIO DE COMBUSTIBLE (GASOIL / GASOLINA)
-- =====================================================================
IF OBJECT_ID('dbo.TB_COMBUSTIBLE_INVENTARIO', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.TB_COMBUSTIBLE_INVENTARIO (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        TipoCombustible NVARCHAR(20) NOT NULL UNIQUE, -- 'GASOIL', 'GASOLINA'
        StockActualLitros DECIMAL(12,2) NOT NULL DEFAULT 0,
        CapacidadTanqueAlmacen DECIMAL(12,2) NOT NULL DEFAULT 5000,
        UpdatedAt DATETIME2 NOT NULL DEFAULT GETDATE()
    );

    INSERT INTO dbo.TB_COMBUSTIBLE_INVENTARIO (TipoCombustible, StockActualLitros, CapacidadTanqueAlmacen)
    VALUES 
        ('GASOIL', 3500.00, 10000.00),
        ('GASOLINA', 1200.00, 5000.00);
END
GO

-- =====================================================================
-- 6. HISTORIAL DE MOVIMIENTOS DE COMBUSTIBLE (Compras, Despachos, Ajustes)
-- =====================================================================
IF OBJECT_ID('dbo.TB_COMBUSTIBLE_HISTORIAL', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.TB_COMBUSTIBLE_HISTORIAL (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        TipoMovimiento NVARCHAR(30) NOT NULL, -- 'COMPRA_INGRESO', 'DESPACHO_CAMION', 'AJUSTE'
        TipoCombustible NVARCHAR(20) NOT NULL, -- 'GASOIL', 'GASOLINA'
        Litros DECIMAL(10,2) NOT NULL,
        StockAnteriorLitros DECIMAL(12,2) NOT NULL DEFAULT 0,
        StockNuevoLitros DECIMAL(12,2) NOT NULL DEFAULT 0,
        CamionId INT NULL FOREIGN KEY REFERENCES dbo.TB_CAMIONES(Id),
        ControlRutaId BIGINT NULL FOREIGN KEY REFERENCES dbo.TB_CONTROL_RUTAS(Id),
        OdometroKm DECIMAL(12,2) NULL,
        CostoPorLitroUSD DECIMAL(10,4) NULL DEFAULT 0,
        Proveedor NVARCHAR(150) NULL,
        Observaciones NVARCHAR(500) NULL,
        Fecha DATE NOT NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETDATE(),
        CreatedBy INT NULL FOREIGN KEY REFERENCES dbo.TB_USUARIOS(Id)
    );
END
GO

-- =====================================================================
-- 7. HISTORIAL DE CAMIONES (Mantenimientos, Aceite, Cauchos, Siniestros de Chofer)
-- =====================================================================
IF OBJECT_ID('dbo.TB_MANTENIMIENTO_CAMIONES', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.TB_MANTENIMIENTO_CAMIONES (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        CamionId INT NOT NULL FOREIGN KEY REFERENCES dbo.TB_CAMIONES(Id),
        TipoEvento NVARCHAR(30) NOT NULL, -- 'CAMBIO_ACEITE', 'CAUCHOS', 'PREVENTIVO', 'CORRECTIVO', 'MEJORA', 'SINIESTRO_CHOFER'
        Titulo NVARCHAR(150) NOT NULL,
        Descripcion NVARCHAR(1000) NOT NULL,
        FechaEvento DATE NOT NULL,
        OdometroKm DECIMAL(12,2) NULL,
        ProximoKmSugerido DECIMAL(12,2) NULL,
        ProximaFechaSugerida DATE NULL,
        TallerOMecanico NVARCHAR(150) NULL,
        Estado NVARCHAR(20) NOT NULL DEFAULT 'RESUELTO', -- 'REPORTADO_CHOFER', 'EN_TALLER', 'RESUELTO'
        ReportadoPorChoferId INT NULL FOREIGN KEY REFERENCES dbo.TB_USUARIOS(Id),
        CostoTotalUSD DECIMAL(12,2) NOT NULL DEFAULT 0,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETDATE(),
        CreatedBy INT NULL FOREIGN KEY REFERENCES dbo.TB_USUARIOS(Id)
    );
END
GO

-- =====================================================================
-- 8. INVENTARIO DE REPUESTOS
-- =====================================================================
IF OBJECT_ID('dbo.TB_INVENTARIO_REPUESTOS', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.TB_INVENTARIO_REPUESTOS (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        Codigo NVARCHAR(50) NOT NULL UNIQUE,
        Nombre NVARCHAR(150) NOT NULL,
        Categoria NVARCHAR(50) NOT NULL, -- 'MOTOR', 'FILTROS', 'LUBRICANTES', 'CAUCHOS', 'FRENOS', 'ELECTRICO', 'CARROCERIA', 'OTROS'
        StockActual INT NOT NULL DEFAULT 0,
        StockMinimo INT NOT NULL DEFAULT 1,
        CostoUnitarioUSD DECIMAL(10,2) NOT NULL DEFAULT 0,
        UbicacionAlmacen NVARCHAR(100) NULL,
        Activo BIT NOT NULL DEFAULT 1,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETDATE()
    );

    -- Algunos repuestos frecuentes de ejemplo
    INSERT INTO dbo.TB_INVENTARIO_REPUESTOS (Codigo, Nombre, Categoria, StockActual, StockMinimo, CostoUnitarioUSD, UbicacionAlmacen)
    VALUES 
        ('REP-ACE-15W40', 'Aceite 15W40 Mineral 1 Galón', 'LUBRICANTES', 24, 6, 25.00, 'Estante A1'),
        ('REP-FIL-ACE', 'Filtro de Aceite Camión', 'FILTROS', 12, 4, 15.00, 'Estante A2'),
        ('REP-FIL-GAS', 'Filtro de Combustible Trampa', 'FILTROS', 8, 3, 20.00, 'Estante A3'),
        ('REP-CAU-295', 'Caucho 295/80R22.5 Radial', 'CAUCHOS', 6, 2, 280.00, 'Área Llantas'),
        ('REP-INY-CLEAN', 'Limpiador de Inyectores / Aditivo', 'MOTOR', 15, 5, 8.50, 'Estante B1');
END
GO

-- =====================================================================
-- 9. HISTORIAL DE MOVIMIENTOS DE REPUESTOS
-- =====================================================================
IF OBJECT_ID('dbo.TB_MOVIMIENTOS_REPUESTOS', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.TB_MOVIMIENTOS_REPUESTOS (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        RepuestoId INT NOT NULL FOREIGN KEY REFERENCES dbo.TB_INVENTARIO_REPUESTOS(Id),
        TipoMovimiento NVARCHAR(30) NOT NULL, -- 'ENTRADA_COMPRA', 'SALIDA_MANTENIMIENTO', 'AJUSTE'
        Cantidad INT NOT NULL,
        CostoUnitarioUSD DECIMAL(10,2) NOT NULL DEFAULT 0,
        MantenimientoId INT NULL FOREIGN KEY REFERENCES dbo.TB_MANTENIMIENTO_CAMIONES(Id),
        CamionId INT NULL FOREIGN KEY REFERENCES dbo.TB_CAMIONES(Id),
        Fecha DATE NOT NULL,
        Observaciones NVARCHAR(500) NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETDATE(),
        CreatedBy INT NULL FOREIGN KEY REFERENCES dbo.TB_USUARIOS(Id)
    );
END
GO

-- =====================================================================
-- 10. PARÁMETRO DE TOLERANCIA DE MERMA EN PORCENTAJE (SEMÁFORO)
-- =====================================================================
IF NOT EXISTS (SELECT 1 FROM dbo.TB_PARAMETROS_SISTEMA WHERE Clave = 'TOLERANCIA_MERMA_PORCENTAJE')
BEGIN
    INSERT INTO dbo.TB_PARAMETROS_SISTEMA (Clave, Valor, TipoDato, Descripcion, Categoria, FechaModificacion, ModificadoPor)
    VALUES ('TOLERANCIA_MERMA_PORCENTAJE', '3.00', 'DECIMAL', 'Porcentaje de tolerancia para el semáforo de mermas (ej: 3.00%)', 'OPERACIONES', GETDATE(), 'admin');
END
GO

-- =====================================================================
-- 11. REGISTRAR LOS NUEVOS MÓDULOS EN TB_MODULOS CON SUS 4 PERMISOS EXACTOS
-- =====================================================================
DECLARE @NuevosModulos TABLE (
    Codigo NVARCHAR(50),
    Nombre NVARCHAR(100),
    Icono NVARCHAR(50),
    RutaVista VARCHAR(100),
    PermisoRequerido VARCHAR(100),
    Orden INT
);

INSERT INTO @NuevosModulos (Codigo, Nombre, Icono, RutaVista, PermisoRequerido, Orden) VALUES
('RUTAS_PLANIFICACION', 'Planificación de Rutas', 'fa-map-location-dot', 'rutas-planificacion', 'RUTAS_PLANIFICACION_VER', 32),
('COMBUSTIBLE', 'Gestión de Combustible', 'fa-gas-pump', 'combustible', 'COMBUSTIBLE_VER', 33),
('HISTORIAL_CAMIONES', 'Historial Camiones & Siniestros', 'fa-wrench', 'historial-camiones', 'HISTORIAL_CAMIONES_VER', 34),
('REPUESTOS', 'Inventario de Repuestos', 'fa-boxes-stacked', 'repuestos', 'REPUESTOS_VER', 35);

MERGE INTO dbo.TB_MODULOS AS Target
USING @NuevosModulos AS Source
ON Target.Codigo = Source.Codigo
WHEN MATCHED THEN
    UPDATE SET Target.Nombre = Source.Nombre, Target.Icono = Source.Icono, Target.RutaVista = Source.RutaVista, Target.PermisoRequerido = Source.PermisoRequerido, Target.Orden = Source.Orden, Target.Activo = 1
WHEN NOT MATCHED THEN
    INSERT (Codigo, Nombre, Icono, RutaVista, PermisoRequerido, Orden, Activo)
    VALUES (Source.Codigo, Source.Nombre, Source.Icono, Source.RutaVista, Source.PermisoRequerido, Source.Orden, 1);

-- Regenerar los 4 permisos estándar para los nuevos módulos
DECLARE @ModId INT, @ModCod NVARCHAR(50), @ModNom NVARCHAR(100);

DECLARE ModCursor CURSOR FOR 
SELECT Id, Codigo, Nombre 
FROM dbo.TB_MODULOS 
WHERE Codigo IN ('RUTAS_PLANIFICACION', 'COMBUSTIBLE', 'HISTORIAL_CAMIONES', 'REPUESTOS');

OPEN ModCursor;
FETCH NEXT FROM ModCursor INTO @ModId, @ModCod, @ModNom;

WHILE @@FETCH_STATUS = 0
BEGIN
    -- 1. VER
    IF NOT EXISTS (SELECT 1 FROM dbo.TB_PERMISOS WHERE ModuloId = @ModId AND Accion = 'VER')
        INSERT INTO dbo.TB_PERMISOS (ModuloId, Codigo, Nombre, Accion, Descripcion, Activo)
        VALUES (@ModId, @ModCod + '_VER', 'Ver ' + @ModNom, 'VER', 'Permite consultar ' + @ModNom, 1);

    -- 2. AGREGAR
    IF NOT EXISTS (SELECT 1 FROM dbo.TB_PERMISOS WHERE ModuloId = @ModId AND Accion = 'AGREGAR')
        INSERT INTO dbo.TB_PERMISOS (ModuloId, Codigo, Nombre, Accion, Descripcion, Activo)
        VALUES (@ModId, @ModCod + '_CREAR', 'Agregar ' + @ModNom, 'AGREGAR', 'Permite registrar en ' + @ModNom, 1);

    -- 3. EDITAR
    IF NOT EXISTS (SELECT 1 FROM dbo.TB_PERMISOS WHERE ModuloId = @ModId AND Accion = 'EDITAR')
        INSERT INTO dbo.TB_PERMISOS (ModuloId, Codigo, Nombre, Accion, Descripcion, Activo)
        VALUES (@ModId, @ModCod + '_EDITAR', 'Editar ' + @ModNom, 'EDITAR', 'Permite modificar en ' + @ModNom, 1);

    -- 4. ELIMINAR
    IF NOT EXISTS (SELECT 1 FROM dbo.TB_PERMISOS WHERE ModuloId = @ModId AND Accion = 'ELIMINAR')
        INSERT INTO dbo.TB_PERMISOS (ModuloId, Codigo, Nombre, Accion, Descripcion, Activo)
        VALUES (@ModId, @ModCod + '_ELIMINAR', 'Eliminar ' + @ModNom, 'ELIMINAR', 'Permite anular/borrar en ' + @ModNom, 1);

    FETCH NEXT FROM ModCursor INTO @ModId, @ModCod, @ModNom;
END

CLOSE ModCursor;
DEALLOCATE ModCursor;

-- Conceder todos los nuevos permisos a ADMIN (RolId = 1)
INSERT INTO dbo.TB_ROL_PERMISOS (RolId, PermisoId, Concedido, CreatedAt)
SELECT 1, p.Id, 1, SYSDATETIME()
FROM dbo.TB_PERMISOS p
WHERE p.Id NOT IN (SELECT PermisoId FROM dbo.TB_ROL_PERMISOS WHERE RolId = 1);

SELECT 
    (SELECT COUNT(*) FROM dbo.TB_MODULOS) AS TotalModulos,
    (SELECT COUNT(*) FROM dbo.TB_PERMISOS) AS TotalPermisos;
GO
