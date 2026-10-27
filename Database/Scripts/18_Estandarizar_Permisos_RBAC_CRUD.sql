USE BD_CV_PROD;
GO

SET NOCOUNT ON;

-- 1. Asegurar módulos limpios y correctos en TB_MODULOS
-- Eliminar el módulo huérfano 'ADELANTOS' si existe duplicado (ya que se usan ADELANTOS_FINCAS, ADELANTOS_PERSONAL, etc.)
DELETE FROM TB_ROL_PERMISOS WHERE PermisoId IN (SELECT Id FROM TB_PERMISOS WHERE ModuloId IN (SELECT Id FROM TB_MODULOS WHERE Codigo = 'ADELANTOS'));
DELETE FROM TB_PERMISOS WHERE ModuloId IN (SELECT Id FROM TB_MODULOS WHERE Codigo = 'ADELANTOS');
DELETE FROM TB_MODULOS WHERE Codigo = 'ADELANTOS';

-- Actualizar lista de módulos con los 31 módulos exactos
DECLARE @Modulos TABLE (
    Codigo NVARCHAR(50),
    Nombre NVARCHAR(100),
    Icono NVARCHAR(50),
    RutaVista VARCHAR(100),
    PermisoRequerido VARCHAR(100),
    Orden INT
);

INSERT INTO @Modulos (Codigo, Nombre, Icono, RutaVista, PermisoRequerido, Orden) VALUES
-- Operaciones (1 - 7)
('DASHBOARD', 'Principal (Dashboard)', 'fa-chart-pie', 'dashboard', 'DASHBOARD_VER', 1),
('RUTAS', 'Recolección en Ruta', 'fa-route', 'rutas', 'RUTAS_VER', 2),
('ENTREGAS', 'Entregas Receptoría', 'fa-truck-ramp-box', 'receptoria', 'ENTREGAS_VER', 3),
('BALANCE_LECHE', 'Análisis & Balance Leche', 'fa-chart-line', 'balance-receptoria', 'BALANCE_LECHE_VER', 4),
('CONTROL_RUTAS', 'Control de Viajes / Tickets', 'fa-clipboard-check', 'control-rutas', 'CONTROL_RUTAS_VER', 5),
('MERMAS', 'Balance de Mermas', 'fa-scale-balanced', 'mermas', 'MERMAS_VER', 6),
('TRAZABILIDAD_BUFALA', 'Trazabilidad Búfala', 'fa-gem', 'trazabilidad-bufala', 'TRAZABILIDAD_BUFALA_VER', 7),

-- Catálogos & Flota (8 - 14)
('FINCAS', 'Fincas', 'fa-seedling', 'fincas', 'FINCAS_VER', 8),
('PROPIETARIOS', 'Propietarios', 'fa-users', 'propietarios', 'PROPIETARIOS_VER', 9),
('CONDUCTORES', 'Conductores', 'fa-id-card', 'conductores', 'CONDUCTORES_VER', 10),
('CAMIONES', 'Camiones (Flota)', 'fa-truck-front', 'camiones', 'CAMIONES_VER', 11),
('COMPANIAS', 'Compañías', 'fa-building', 'companias', 'COMPANIAS_VER', 12),
('BANCOS', 'Bancos', 'fa-building-columns', 'bancos', 'BANCOS_VER', 13),
('EMPRESA', 'Datos de Empresa', 'fa-building-flag', 'empresa', 'EMPRESA_VER', 14),

-- Liquidación (15 - 19)
('CICLOS', 'Semanas Operativas', 'fa-calendar-check', 'semanas', 'CICLOS_VER', 15),
('LIQUIDACIONES', 'Liquidación Fincas', 'fa-file-invoice-dollar', 'liquidacion', 'LIQUIDACIONES_VER', 16),
('PAGOS_PERSONAL', 'Pagos Choferes & Materas', 'fa-money-check-dollar', 'pagos-usuarios', 'PAGOS_PERSONAL_VER', 17),
('HISTORIAL_PAGOS', 'Historial de Pagos', 'fa-receipt', 'historial-pagos', 'HISTORIAL_PAGOS_VER', 18),
('ADMINISTRACION', 'Administración General', 'fa-scale-balanced', 'administracion', 'ADMINISTRACION_VER', 19),

-- Adelantos (20 - 25)
('ADELANTOS_FINCAS', 'Adelantos a Fincas', 'fa-leaf', 'adelantos-fincas', 'ADELANTOS_FINCAS_VER', 20),
('ADELANTOS_PERSONAL', 'Adelantos Personal & Chofer', 'fa-hand-holding-dollar', 'adelantos-usuarios', 'ADELANTOS_PERSONAL_VER', 21),
('ABONOS_COMPANIAS', 'Abonos a Compañías', 'fa-building', 'abonos-companias', 'ABONOS_COMPANIAS_VER', 22),
('ADELANTOS_RECEPTORIA', 'Adelantos Receptoría', 'fa-truck-droplet', 'adelantos-receptoria', 'ADELANTOS_RECEPTORIA_VER', 23),
('ABONOS', 'Abonos & Amortizaciones', 'fa-coins', 'abonos', 'ABONOS_VER', 24),
('HISTORIAL_ADELANTOS', 'Historial de Adelantos', 'fa-clock-rotate-left', 'historial-adelantos', 'HISTORIAL_ADELANTOS_VER', 25),

-- Reportes (26 - 27)
('REPORTES', 'Reportes Generales', 'fa-square-poll-vertical', 'reportes', 'REPORTES_VER', 26),
('HISTORIAL_BCV', 'Historial Tasas BCV', 'fa-coins', 'historial-bcv', 'HISTORIAL_BCV_VER', 27),

-- Sistema (28 - 31)
('USUARIOS_SEGURIDAD', 'Usuarios & Roles', 'fa-user-gear', 'usuarios', 'USUARIOS_VER', 28),
('PERMISOS', 'Módulos & Permisos', 'fa-shield-halved', 'permisos', 'PERMISOS_VER', 29),
('CONFIGURACION', 'Parametrización Global', 'fa-sliders', 'configuracion-sistema', 'CONFIGURACION_VER', 30),
('SESION', 'Tiempo de Sesión', 'fa-stopwatch', 'configuracion-sesion', 'SESION_VER', 31);

MERGE INTO TB_MODULOS AS Target
USING @Modulos AS Source
ON Target.Codigo = Source.Codigo
WHEN MATCHED THEN
    UPDATE SET 
        Target.Nombre = Source.Nombre,
        Target.Icono = Source.Icono,
        Target.RutaVista = Source.RutaVista,
        Target.PermisoRequerido = Source.PermisoRequerido,
        Target.Orden = Source.Orden,
        Target.Activo = 1
WHEN NOT MATCHED THEN
    INSERT (Codigo, Nombre, Icono, RutaVista, PermisoRequerido, Orden, Activo)
    VALUES (Source.Codigo, Source.Nombre, Source.Icono, Source.RutaVista, Source.PermisoRequerido, Source.Orden, 1);

-- 2. LIMPIAR PERMISOS VIEJOS/IRREGULARES Y REGENERAR EXACTAMENTE 4 ACCIONES POR MÓDULO:
-- Ver, Editar, Agregar, Eliminar
DELETE FROM TB_ROL_PERMISOS;
DELETE FROM TB_PERMISOS;

-- Reinsertar las 4 acciones estándar ordenadas por módulo
DECLARE @ModId INT, @ModCod NVARCHAR(50), @ModNom NVARCHAR(100);

DECLARE ModCursor CURSOR FOR 
SELECT Id, Codigo, Nombre 
FROM dbo.TB_MODULOS 
ORDER BY Orden ASC, Id ASC;

OPEN ModCursor;
FETCH NEXT FROM ModCursor INTO @ModId, @ModCod, @ModNom;

WHILE @@FETCH_STATUS = 0
BEGIN
    -- 1. VER
    INSERT INTO dbo.TB_PERMISOS (ModuloId, Codigo, Nombre, Accion, Descripcion, Activo)
    VALUES (@ModId, @ModCod + '_VER', 'Ver ' + @ModNom, 'VER', 'Permite consultar y visualizar ' + @ModNom, 1);

    -- 2. AGREGAR (Acción CREAR)
    INSERT INTO dbo.TB_PERMISOS (ModuloId, Codigo, Nombre, Accion, Descripcion, Activo)
    VALUES (@ModId, @ModCod + '_CREAR', 'Agregar ' + @ModNom, 'CREAR', 'Permite agregar nuevos registros en ' + @ModNom, 1);

    -- 3. EDITAR
    INSERT INTO dbo.TB_PERMISOS (ModuloId, Codigo, Nombre, Accion, Descripcion, Activo)
    VALUES (@ModId, @ModCod + '_EDITAR', 'Editar ' + @ModNom, 'EDITAR', 'Permite modificar registros existentes en ' + @ModNom, 1);

    -- 4. ELIMINAR
    INSERT INTO dbo.TB_PERMISOS (ModuloId, Codigo, Nombre, Accion, Descripcion, Activo)
    VALUES (@ModId, @ModCod + '_ELIMINAR', 'Eliminar ' + @ModNom, 'ELIMINAR', 'Permite eliminar registros en ' + @ModNom, 1);

    FETCH NEXT FROM ModCursor INTO @ModId, @ModCod, @ModNom;
END

CLOSE ModCursor;
DEALLOCATE ModCursor;

-- 3. ASIGNAR TODOS LOS PERMISOS AL ROL ADMINISTRADOR (RolId = 1)
INSERT INTO dbo.TB_ROL_PERMISOS (RolId, PermisoId, Concedido, CreatedAt)
SELECT 1, p.Id, 1, SYSDATETIME()
FROM dbo.TB_PERMISOS p;

-- 4. ASIGNAR PERMISOS AL ROL SUPERVISOR (RolId = 2)
-- Acceso a Operaciones, Catálogos y Reportes
INSERT INTO dbo.TB_ROL_PERMISOS (RolId, PermisoId, Concedido, CreatedAt)
SELECT 2, p.Id, 1, SYSDATETIME()
FROM dbo.TB_PERMISOS p
JOIN dbo.TB_MODULOS m ON p.ModuloId = m.Id
WHERE m.Codigo IN (
    'DASHBOARD', 'RUTAS', 'ENTREGAS', 'BALANCE_LECHE', 'CONTROL_RUTAS', 'MERMAS', 'TRAZABILIDAD_BUFALA',
    'FINCAS', 'PROPIETARIOS', 'CONDUCTORES', 'CAMIONES', 'COMPANIAS', 'REPORTES'
);

-- 5. ASIGNAR PERMISOS AL ROL FINANZAS (RolId = 3)
-- Acceso a Liquidación, Adelantos, Bancos, Reportes y Tasas
INSERT INTO dbo.TB_ROL_PERMISOS (RolId, PermisoId, Concedido, CreatedAt)
SELECT 3, p.Id, 1, SYSDATETIME()
FROM dbo.TB_PERMISOS p
JOIN dbo.TB_MODULOS m ON p.ModuloId = m.Id
WHERE m.Codigo IN (
    'DASHBOARD', 'CICLOS', 'LIQUIDACIONES', 'PAGOS_PERSONAL', 'HISTORIAL_PAGOS', 'ADMINISTRACION',
    'ADELANTOS_FINCAS', 'ADELANTOS_PERSONAL', 'ABONOS_COMPANIAS', 'ADELANTOS_RECEPTORIA', 'ABONOS', 
    'HISTORIAL_ADELANTOS', 'REPORTES', 'HISTORIAL_BCV', 'BANCOS', 'FINCAS', 'PROPIETARIOS', 'COMPANIAS'
);

-- 6. ASIGNAR PERMISOS BÁSICOS A CHOFER (RolId = 4)
INSERT INTO dbo.TB_ROL_PERMISOS (RolId, PermisoId, Concedido, CreatedAt)
SELECT 4, p.Id, 1, SYSDATETIME()
FROM dbo.TB_PERMISOS p
WHERE p.Codigo IN ('RUTAS_VER', 'RUTAS_CREAR', 'ENTREGAS_VER', 'ENTREGAS_CREAR', 'DASHBOARD_VER');

-- 7. REPORTE DE RESULTADOS
SELECT 
    (SELECT COUNT(*) FROM dbo.TB_MODULOS) AS TotalModulos,
    (SELECT COUNT(*) FROM dbo.TB_PERMISOS) AS TotalPermisos,
    (SELECT COUNT(*) FROM dbo.TB_ROL_PERMISOS WHERE RolId = 1) AS PermisosAdmin;

SELECT Accion, COUNT(*) AS Cantidad FROM dbo.TB_PERMISOS GROUP BY Accion;
