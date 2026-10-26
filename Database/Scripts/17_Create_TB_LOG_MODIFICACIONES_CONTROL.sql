-- =========================================================================
-- TABLA: TB_LOG_MODIFICACIONES_CONTROL (BITÁCORA DE AUDITORÍA DE TICKETS)
-- =========================================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'TB_LOG_MODIFICACIONES_CONTROL')
BEGIN
    CREATE TABLE TB_LOG_MODIFICACIONES_CONTROL (
        Id BIGINT IDENTITY(1,1) PRIMARY KEY,
        ControlRutaId BIGINT NOT NULL,
        TipoEntidad VARCHAR(50) NOT NULL, -- 'FINCA_RUTA', 'RECEPTORIA_ENTREGA', 'TICKET_METRICAS'
        EntidadId BIGINT NULL,
        TipoAccion VARCHAR(50) NOT NULL,  -- 'EDITAR_FINCA', 'ELIMINAR_FINCA', 'AGREGAR_FINCA', 'EDITAR_ENTREGA', 'ELIMINAR_ENTREGA', 'EDITAR_METRICAS'
        ValoresAnteriores NVARCHAR(MAX) NULL,
        ValoresNuevos NVARCHAR(MAX) NULL,
        Motivo NVARCHAR(500) NOT NULL,
        UsuarioId INT NOT NULL,
        Fecha DATETIME NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_LogModificacionesControl_Ticket FOREIGN KEY (ControlRutaId) REFERENCES TB_CONTROL_RUTAS(Id),
        CONSTRAINT FK_LogModificacionesControl_Usuario FOREIGN KEY (UsuarioId) REFERENCES TB_USUARIOS(Id)
    );

    CREATE INDEX IX_LogModificacionesControl_Ticket ON TB_LOG_MODIFICACIONES_CONTROL(ControlRutaId);
    CREATE INDEX IX_LogModificacionesControl_Fecha ON TB_LOG_MODIFICACIONES_CONTROL(Fecha DESC);
END
GO
