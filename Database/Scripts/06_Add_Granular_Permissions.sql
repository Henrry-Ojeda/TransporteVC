USE BD_TRANSPORTE;
GO

-- ====================================================================
-- 1. TABLA DE MÓDULOS DEL SISTEMA
-- ====================================================================
IF OBJECT_ID('dbo.TB_MODULOS', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.TB_MODULOS (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        Codigo NVARCHAR(50) NOT NULL UNIQUE, -- Ej: 'FINCAS', 'RUTAS', 'LIQUIDACIONES'
        Nombre NVARCHAR(100) NOT NULL,
        Icono NVARCHAR(50) NULL,
        Orden INT NOT NULL DEFAULT 0,
        Activo BIT NOT NULL DEFAULT 1
    );
END
GO

-- ====================================================================
-- 2. TABLA DE ROLES
-- ====================================================================
IF OBJECT_ID('dbo.TB_ROLES', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.TB_ROLES (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        Codigo NVARCHAR(30) NOT NULL UNIQUE, -- 'ADMIN', 'SUPERVISOR', 'FINANZAS', 'CHOFER', 'RECEPTOR'
        Nombre NVARCHAR(100) NOT NULL,
        Descripcion NVARCHAR(250) NULL,
        Activo BIT NOT NULL DEFAULT 1,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETDATE()
    );
END
GO

-- ====================================================================
-- 3. TABLA DE PERMISOS ATÓMICOS (VER, CREAR, EDITAR, ELIMINAR, APROBAR)
-- ====================================================================
IF OBJECT_ID('dbo.TB_PERMISOS', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.TB_PERMISOS (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        ModuloId INT NOT NULL FOREIGN KEY REFERENCES dbo.TB_MODULOS(Id),
        Codigo NVARCHAR(100) NOT NULL UNIQUE, -- Ej: 'FINCAS_VER', 'FINCAS_CREAR', 'FINCAS_ELIMINAR'
        Nombre NVARCHAR(150) NOT NULL,
        Accion NVARCHAR(30) NOT NULL, -- 'VER', 'CREAR', 'EDITAR', 'ELIMINAR', 'APROBAR', 'EXPORTAR'
        Descripcion NVARCHAR(250) NULL,
        Activo BIT NOT NULL DEFAULT 1
    );
END
GO

-- ====================================================================
-- 4. MATRIZ DE PERMISOS POR ROL
-- ====================================================================
IF OBJECT_ID('dbo.TB_ROL_PERMISOS', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.TB_ROL_PERMISOS (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        RolId INT NOT NULL FOREIGN KEY REFERENCES dbo.TB_ROLES(Id) ON DELETE CASCADE,
        PermisoId INT NOT NULL FOREIGN KEY REFERENCES dbo.TB_PERMISOS(Id) ON DELETE CASCADE,
        Concedido BIT NOT NULL DEFAULT 1,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETDATE(),
        CONSTRAINT UQ_Rol_Permiso UNIQUE (RolId, PermisoId)
    );
END
GO

-- ====================================================================
-- 5. ACTUALIZAR TB_USUARIOS CON RolId
-- ====================================================================
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.TB_USUARIOS') AND name = 'RolId')
BEGIN
    ALTER TABLE dbo.TB_USUARIOS ADD RolId INT NULL FOREIGN KEY REFERENCES dbo.TB_ROLES(Id);
END
GO

-- ====================================================================
-- 6. POBLAR MÓDULOS DEL SISTEMA
-- ====================================================================
SET IDENTITY_INSERT dbo.TB_MODULOS ON;
MERGE dbo.TB_MODULOS AS Target
USING (
    VALUES 
        (1, 'RUTAS', 'Rutas de Recolección', 'fa-road', 1),
        (2, 'ENTREGAS', 'Entregas a Compañías', 'fa-truck', 2),
        (3, 'FINCAS', 'Catálogo de Fincas', 'fa-leaf', 3),
        (4, 'COMPANIAS', 'Catálogo de Compañías/Queseras', 'fa-building', 4),
        (5, 'CONDUCTORES', 'Catálogo de Conductores', 'fa-id-card', 5),
        (6, 'BANCOS', 'Catálogo de Bancos', 'fa-university', 6),
        (7, 'HISTORIAL_BCV', 'Tasa Diaria del Dólar (BCV)', 'fa-dollar-sign', 7),
        (8, 'ADELANTOS', 'Gestión de Adelantos y Anticipos', 'fa-money-bill-wave', 8),
        (9, 'CICLOS', 'Ciclos y Períodos Semanales', 'fa-calendar-alt', 9),
        (10, 'LIQUIDACIONES', 'Liquidación Semanal y Cierres', 'fa-file-invoice-dollar', 10),
        (11, 'REPORTES', 'Reportes y Balance de Mermas', 'fa-chart-bar', 11),
        (12, 'USUARIOS_SEGURIDAD', 'Usuarios y Control de Acceso', 'fa-user-shield', 12)
) AS Source (Id, Codigo, Nombre, Icono, Orden)
ON Target.Id = Source.Id
WHEN MATCHED THEN
    UPDATE SET Target.Codigo = Source.Codigo, Target.Nombre = Source.Nombre, Target.Icono = Source.Icono, Target.Orden = Source.Orden
WHEN NOT MATCHED BY TARGET THEN
    INSERT (Id, Codigo, Nombre, Icono, Orden, Activo) VALUES (Source.Id, Source.Codigo, Source.Nombre, Source.Icono, Source.Orden, 1);
SET IDENTITY_INSERT dbo.TB_MODULOS OFF;
GO

-- ====================================================================
-- 7. POBLAR ROLES PRINCIPALES
-- ====================================================================
SET IDENTITY_INSERT dbo.TB_ROLES ON;
MERGE dbo.TB_ROLES AS Target
USING (
    VALUES 
        (1, 'ADMIN', 'Administrador General', 'Acceso y control total de todo el sistema'),
        (2, 'SUPERVISOR', 'Supervisor de Operaciones', 'Control operativo de rutas, mermas y auditoría'),
        (3, 'FINANZAS', 'Administración y Finanzas', 'Gestión de tasas, liquidaciones, adelantos y bancos'),
        (4, 'CHOFER', 'Conductor / Transportista', 'Captura de litros recolectados y entregas en ruta'),
        (5, 'RECEPTOR', 'Operador de Planta / Compañía', 'Confirmación de litros recibidos en planta')
) AS Source (Id, Codigo, Nombre, Descripcion)
ON Target.Id = Source.Id
WHEN MATCHED THEN
    UPDATE SET Target.Codigo = Source.Codigo, Target.Nombre = Source.Nombre, Target.Descripcion = Source.Descripcion
WHEN NOT MATCHED BY TARGET THEN
    INSERT (Id, Codigo, Nombre, Descripcion, Activo, CreatedAt) VALUES (Source.Id, Source.Codigo, Source.Nombre, Source.Descripcion, 1, GETDATE());
SET IDENTITY_INSERT dbo.TB_ROLES OFF;
GO

-- ====================================================================
-- 8. POBLAR PERMISOS ATÓMICOS (CRUD POR MÓDULO)
-- ====================================================================
-- Procedimiento temporal para insertar permisos CRUD estándar
DECLARE @ModId INT, @ModCod NVARCHAR(50), @ModNom NVARCHAR(100);

DECLARE ModCursor CURSOR FOR 
SELECT Id, Codigo, Nombre FROM dbo.TB_MODULOS;

OPEN ModCursor;
FETCH NEXT FROM ModCursor INTO @ModId, @ModCod, @ModNom;

WHILE @@FETCH_STATUS = 0
BEGIN
    -- Permiso VER
    IF NOT EXISTS (SELECT 1 FROM dbo.TB_PERMISOS WHERE Codigo = @ModCod + '_VER')
        INSERT INTO dbo.TB_PERMISOS (ModuloId, Codigo, Nombre, Accion, Descripcion)
        VALUES (@ModId, @ModCod + '_VER', 'Ver ' + @ModNom, 'VER', 'Permite consultar y visualizar ' + @ModNom);

    -- Permiso CREAR
    IF NOT EXISTS (SELECT 1 FROM dbo.TB_PERMISOS WHERE Codigo = @ModCod + '_CREAR')
        INSERT INTO dbo.TB_PERMISOS (ModuloId, Codigo, Nombre, Accion, Descripcion)
        VALUES (@ModId, @ModCod + '_CREAR', 'Crear ' + @ModNom, 'CREAR', 'Permite agregar nuevos registros en ' + @ModNom);

    -- Permiso EDITAR
    IF NOT EXISTS (SELECT 1 FROM dbo.TB_PERMISOS WHERE Codigo = @ModCod + '_EDITAR')
        INSERT INTO dbo.TB_PERMISOS (ModuloId, Codigo, Nombre, Accion, Descripcion)
        VALUES (@ModId, @ModCod + '_EDITAR', 'Editar ' + @ModNom, 'EDITAR', 'Permite modificar registros existentes en ' + @ModNom);

    -- Permiso ELIMINAR
    IF NOT EXISTS (SELECT 1 FROM dbo.TB_PERMISOS WHERE Codigo = @ModCod + '_ELIMINAR')
        INSERT INTO dbo.TB_PERMISOS (ModuloId, Codigo, Nombre, Accion, Descripcion)
        VALUES (@ModId, @ModCod + '_ELIMINAR', 'Eliminar ' + @ModNom, 'ELIMINAR', 'Permite borrar o anular registros en ' + @ModNom);

    FETCH NEXT FROM ModCursor INTO @ModId, @ModCod, @ModNom;
END

CLOSE ModCursor;
DEALLOCATE ModCursor;
GO

-- Permisos Especiales de Proceso
IF NOT EXISTS (SELECT 1 FROM dbo.TB_PERMISOS WHERE Codigo = 'LIQUIDACIONES_APROBAR')
    INSERT INTO dbo.TB_PERMISOS (ModuloId, Codigo, Nombre, Accion, Descripcion)
    VALUES ((SELECT Id FROM dbo.TB_MODULOS WHERE Codigo = 'LIQUIDACIONES'), 'LIQUIDACIONES_APROBAR', 'Aprobar Cierre Semanal', 'APROBAR', 'Permite cerrar y aprobar la liquidación para pago');

IF NOT EXISTS (SELECT 1 FROM dbo.TB_PERMISOS WHERE Codigo = 'LIQUIDACIONES_EXPORTAR_BANCO')
    INSERT INTO dbo.TB_PERMISOS (ModuloId, Codigo, Nombre, Accion, Descripcion)
    VALUES ((SELECT Id FROM dbo.TB_MODULOS WHERE Codigo = 'LIQUIDACIONES'), 'LIQUIDACIONES_EXPORTAR_BANCO', 'Generar Archivo Bancario TXT', 'EXPORTAR', 'Permite descargar el archivo de transferencias bancarias');
GO

-- ====================================================================
-- 9. ASIGNAR TODOS LOS PERMISOS AL ROL ADMIN
-- ====================================================================
INSERT INTO dbo.TB_ROL_PERMISOS (RolId, PermisoId, Concedido)
SELECT 1, Id, 1 FROM dbo.TB_PERMISOS
WHERE Id NOT IN (SELECT PermisoId FROM dbo.TB_ROL_PERMISOS WHERE RolId = 1);
GO

-- Asignar permisos básicos a CHOFER (Solo Ver y Crear en Rutas/Entregas)
INSERT INTO dbo.TB_ROL_PERMISOS (RolId, PermisoId, Concedido)
SELECT 4, Id, 1 FROM dbo.TB_PERMISOS
WHERE Codigo IN ('RUTAS_VER', 'RUTAS_CREAR', 'ENTREGAS_VER', 'ENTREGAS_CREAR', 'HISTORIAL_BCV_VER')
  AND Id NOT IN (SELECT PermisoId FROM dbo.TB_ROL_PERMISOS WHERE RolId = 4);
GO

-- Asignar usuario admin a Rol 1
UPDATE dbo.TB_USUARIOS SET RolId = 1 WHERE Username = 'admin';
GO
