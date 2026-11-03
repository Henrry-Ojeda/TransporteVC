import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { operacionesApi } from '@/api/operaciones.api';
import { catalogosApi } from '@/api/catalogos.api';
import { DataTable, type ColumnDef } from '@/components/common/DataTable';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import { CamionSelect } from '@/components/selectors';
import type { ControlRutaDto, CamionDto, RutaLogisticaDto, FincaDto, CompaniaDto } from '@/types';

export const ViajesTicketsPage: React.FC = () => {
  const queryClient = useQueryClient();

  const [modalIniciar, setModalIniciar] = useState(false);
  const [modalDetalle, setModalDetalle] = useState(false);
  const [viajeSeleccionado, setViajeSeleccionado] = useState<ControlRutaDto | null>(null);

  // Estados formularios modales
  const [modalAgregarFinca, setModalAgregarFinca] = useState(false);
  const [modalEntrega, setModalEntrega] = useState(false);
  const [modalCerrar, setModalCerrar] = useState(false);

  const [formIniciar, setFormIniciar] = useState({
    camionId: 0,
    rutaLogisticaId: 0,
    odometroInicialKm: 0,
    observaciones: '',
  });

  const [formFinca, setFormFinca] = useState({
    fincaId: 0,
    litrosLeche: 0,
    temperatura: 4,
    tipoLeche: 'VACA',
  });

  const [formEntrega, setFormEntrega] = useState({
    companiaId: 0,
    litrosEntregados: 0,
    ticketReceptoria: '',
    observaciones: '',
  });

  const [formCerrar, setFormCerrar] = useState({
    odometroFinalKm: 0,
    observaciones: '',
  });

  // Queries con auto-actualización reactiva en tiempo real (cada 8s)
  const { data: viajes = [], isLoading, refetch } = useQuery<ControlRutaDto[]>({
    queryKey: ['viajes-controles'],
    queryFn: () => operacionesApi.getControles(),
    refetchInterval: 8000,
  });

  const { data: camiones = [] } = useQuery<CamionDto[]>({
    queryKey: ['camiones'],
    queryFn: () => catalogosApi.getCamiones(true),
  });

  const { data: rutasLogistica = [] } = useQuery<RutaLogisticaDto[]>({
    queryKey: ['rutas-logistica'],
    queryFn: () => operacionesApi.getRutasLogistica(),
  });

  const { data: fincas = [] } = useQuery<FincaDto[]>({
    queryKey: ['fincas'],
    queryFn: () => catalogosApi.getFincas(true),
  });

  const { data: companias = [] } = useQuery<CompaniaDto[]>({
    queryKey: ['companias'],
    queryFn: () => catalogosApi.getCompanias(true),
  });

  const camionesOptions = useMemo(() => {
    return camiones.map((c) => ({
      value: c.id,
      label: `${c.placa} (${c.marca || 'Cisterna'}) ${c.choferNombre ? `- Chofer: ${c.choferNombre}` : ''}`.trim(),
      subLabel: `Capacidad: ${(c.capacidadLitros || 0).toLocaleString()} Lts | Chofer: ${c.choferNombre || 'Sin asignar'}`,
    }));
  }, [camiones]);

  const rutasOptions = useMemo(() => {
    return [
      { value: 0, label: '-- Ruta Abierta / Sin predefinir --' },
      ...rutasLogistica.map((r) => ({
        value: r.id,
        label: `${r.nombre} (${r.totalFincas || 0} fincas)`,
        subLabel: r.descripcion || undefined,
      })),
    ];
  }, [rutasLogistica]);

  // Query fincas y entregas del viaje seleccionado
  const { data: fincasViaje = [], refetch: refetchFincas } = useQuery({
    queryKey: ['fincas-viaje', viajeSeleccionado?.id],
    queryFn: () => (viajeSeleccionado ? operacionesApi.getFincasViaje(viajeSeleccionado.id) : []),
    enabled: !!viajeSeleccionado,
  });

  const { data: entregasViaje = [], refetch: refetchEntregas } = useQuery({
    queryKey: ['entregas-viaje', viajeSeleccionado?.id],
    queryFn: () => (viajeSeleccionado ? operacionesApi.getEntregasViaje(viajeSeleccionado.id) : []),
    enabled: !!viajeSeleccionado,
  });

  // Mutaciones
  const iniciarMutation = useMutation({
    mutationFn: (dto: typeof formIniciar) => operacionesApi.iniciarViaje(dto),
    onSuccess: (data) => {
      toast.success(data.message || 'Viaje iniciado con éxito');
      queryClient.invalidateQueries({ queryKey: ['viajes-controles'] });
      setModalIniciar(false);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Error al iniciar viaje');
    },
  });

  const agregarFincaMutation = useMutation({
    mutationFn: (dto: typeof formFinca) =>
      operacionesApi.agregarFincaViaje(viajeSeleccionado!.id, dto),
    onSuccess: (data) => {
      toast.success(data.message || 'Finca registrada en viaje');
      refetchFincas();
      queryClient.invalidateQueries({ queryKey: ['viajes-controles'] });
      setModalAgregarFinca(false);
      setFormFinca({ fincaId: 0, litrosLeche: 0, temperatura: 4, tipoLeche: 'VACA' });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Error al registrar recolección');
    },
  });

  const entregarMutation = useMutation({
    mutationFn: (dto: typeof formEntrega) =>
      operacionesApi.entregarDirectoCompania(viajeSeleccionado!.id, dto),
    onSuccess: (data) => {
      toast.success(data.message || 'Entrega registrada');
      refetchEntregas();
      queryClient.invalidateQueries({ queryKey: ['viajes-controles'] });
      setModalEntrega(false);
      setFormEntrega({ companiaId: 0, litrosEntregados: 0, ticketReceptoria: '', observaciones: '' });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Error al registrar entrega');
    },
  });

  const cerrarMutation = useMutation({
    mutationFn: (dto: typeof formCerrar) =>
      operacionesApi.cerrarViaje(viajeSeleccionado!.id, dto),
    onSuccess: (data) => {
      toast.success(data.message || 'Viaje cerrado exitosamente');
      queryClient.invalidateQueries({ queryKey: ['viajes-controles'] });
      setModalCerrar(false);
      setModalDetalle(false);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Error al cerrar viaje');
    },
  });

  // Métricas calculadas para los 5 KPIs
  const kpis = useMemo(() => {
    const totalViajes = viajes.length;
    const volumenFincas = viajes.reduce((sum, v) => sum + (v.totalLitrosRecogidos || 0), 0);
    const volumenRecibido = viajes.reduce((sum, v) => sum + (v.totalLitrosEntregados || 0), 0);
    const mermaLitros = Math.max(0, volumenFincas - volumenRecibido);
    const mermaPct = volumenFincas > 0 ? (mermaLitros / volumenFincas) * 100 : 0;
    const enProcesoCount = viajes.filter((v) => v.estadoProceso !== 'CERRADO').length;

    return {
      totalViajes,
      volumenFincas,
      volumenRecibido,
      mermaLitros,
      mermaPct,
      enProcesoCount,
    };
  }, [viajes]);

  const getBadgeEstado = (estado: string) => {
    switch (estado) {
      case 'INICIADO':
      case 'EN_RUTA':
        return (
          <span
            className="badge"
            style={{
              background: '#e0f2fe',
              color: '#0284c7',
              border: '1px solid #bae6fd',
              fontWeight: 700,
            }}
          >
            <i className="fa-solid fa-truck-moving" style={{ marginRight: '4px' }}></i> En Ruta
          </span>
        );
      case 'EN_RECEPTORIA':
      case 'ENTREGADO_COMPANIA':
        return (
          <span
            className="badge"
            style={{
              background: '#fef3c7',
              color: '#d97706',
              border: '1px solid #fde68a',
              fontWeight: 700,
            }}
          >
            <i className="fa-solid fa-truck-ramp-box" style={{ marginRight: '4px' }}></i> En Planta
          </span>
        );
      case 'CERRADO':
      default:
        return (
          <span
            className="badge"
            style={{
              background: '#ecfdf5',
              color: '#047857',
              border: '1px solid #a7f3d0',
              fontWeight: 700,
            }}
          >
            <i className="fa-solid fa-circle-check" style={{ marginRight: '4px' }}></i> Liquidado
          </span>
        );
    }
  };

  const columns: ColumnDef<ControlRutaDto>[] = [
    {
      header: 'TICKET # / FECHA',
      accessorKey: 'codigoTicket',
      sortable: true,
      cell: (row) => (
        <div>
          <div style={{ fontWeight: 800, fontFamily: 'monospace', color: '#4f46e5' }}>
            {row.codigoTicket || `TKT-${row.id.toString().padStart(5, '0')}`}
          </div>
          <div style={{ fontSize: '11.5px', color: '#64748b' }}>
            {row.fecha ? new Date(row.fecha).toLocaleDateString('es-VE') : '-'}
          </div>
        </div>
      ),
    },
    {
      header: 'UNIDAD & CHOFER',
      cell: (row) => (
        <div>
          <div style={{ fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <i className="fa-solid fa-truck" style={{ color: '#2563eb' }}></i>
            {row.camionPlaca || row.rutaLogisticaNombre || (row.camionId ? `Camión #${row.camionId}` : 'Camión de Ruta')}
          </div>
          <div style={{ fontSize: '11.5px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
            <i className="fa-regular fa-user" style={{ color: '#94a3b8' }}></i>
            {row.choferNombre || row.nombreConductor || 'Chofer Asignado'}
          </div>
        </div>
      ),
    },
    {
      header: 'RUTA LOGÍSTICA',
      accessorKey: 'rutaNombre',
      cell: (row) => (
        <span
          className="badge"
          style={{
            background: '#f1f5f9',
            color: '#334155',
            border: '1px solid #e2e8f0',
            fontWeight: 600,
          }}
        >
          <i className="fa-solid fa-route" style={{ color: '#4f46e5', marginRight: '4px' }}></i>
          {row.rutaNombre || 'Ruta Abierta'}
        </span>
      ),
    },
    {
      header: 'LITROS RECOGIDOS',
      accessorKey: 'totalLitrosRecogidos',
      sortable: true,
      cell: (row) => (
        <span style={{ fontWeight: 800, color: '#2563eb', fontSize: '13.5px' }}>
          {(row.totalLitrosFinca != null ? row.totalLitrosFinca : (row.totalLitrosRecogidos || 0)).toLocaleString()} <small>L</small>
        </span>
      ),
    },
    {
      header: 'LITROS ENTREGADOS',
      accessorKey: 'totalLitrosEntregados',
      sortable: true,
      cell: (row) => (
        <span style={{ fontWeight: 800, color: '#059669', fontSize: '13.5px' }}>
          {((row.litrosEntregadosCompania != null ? row.litrosEntregadosCompania : (row.totalLitrosReceptoria != null ? row.totalLitrosReceptoria : (row.totalLitrosEntregados || 0)))).toLocaleString()} <small>L</small>
        </span>
      ),
    },
    {
      header: 'MERMA',
      cell: (row) => {
        const mermaLts = row.diferenciaLitros != null ? row.diferenciaLitros : (row.mermaLitros || 0);
        const mermaPct = row.porcentajeMerma != null ? row.porcentajeMerma : (row.mermaPorcentaje || 0);
        const alerta = Math.abs(mermaPct) > 1.5;
        return (
          <div>
            <span style={{ fontWeight: 800, color: alerta ? '#dc2626' : '#334155' }}>
              {mermaLts.toLocaleString()} L
            </span>
            <span style={{ fontSize: '11px', color: '#94a3b8', marginLeft: '4px' }}>
              ({mermaPct.toFixed(2)}%)
            </span>
          </div>
        );
      },
    },
    {
      header: 'ESTADO',
      accessorKey: 'estadoProceso',
      cell: (row) => getBadgeEstado(row.nombreProceso || row.estadoProceso || row.estado || 'EN RUTA'),
    },
    {
      header: 'ACCIONES',
      className: 'text-right',
      cell: (row) => (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={() => {
              setViajeSeleccionado(row);
              setModalDetalle(true);
            }}
            className="btn btn-sm btn-outline"
            style={{
              height: '32px',
              padding: '0 12px',
              fontSize: '12px',
              fontWeight: 700,
              color: '#4f46e5',
              borderColor: '#c7d2fe',
              background: '#eef2ff',
              borderRadius: '6px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <i className="fa-solid fa-eye"></i>
            Ver Viaje
          </button>
        </div>
      ),
    },
  ];

  return (
    <section id="tab-control-rutas" className="tab-content active" style={{ display: 'block' }}>
      {/* CABECERA VISTA */}
      <div className="view-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <h1 className="view-title" style={{ margin: 0 }}>
              <i className="fa-solid fa-clipboard-check" style={{ color: '#6366f1', marginRight: '8px' }}></i>
              Control Logístico de Viajes y Tickets
            </h1>
            <span
              className="badge"
              style={{
                background: 'rgba(99, 102, 241, 0.12)',
                color: '#6366f1',
                border: '1px solid rgba(99, 102, 241, 0.3)',
                fontWeight: 700,
                fontSize: '11px',
                padding: '4px 10px',
                borderRadius: '9999px',
              }}
            >
              <i className="fa-solid fa-bolt" style={{ marginRight: '4px' }}></i> Sistema V2
            </span>
          </div>
          <p className="view-subtitle" style={{ margin: 0, color: '#64748b', fontSize: '13px' }}>
            Monitoreo en tiempo real del ciclo de vida de recolección, recepción, destino y liquidación volumétrica
          </p>
        </div>

        <div className="view-actions" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setModalIniciar(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontWeight: 700,
              padding: '9px 18px',
              background: 'linear-gradient(135deg, #4f46e5, #3b82f6)',
              border: 'none',
              boxShadow: '0 4px 14px rgba(79, 70, 229, 0.35)',
            }}
          >
            <i className="fa-solid fa-plus-circle"></i> Iniciar Nuevo Viaje
          </button>

          <button
            type="button"
            className="btn btn-outline"
            onClick={() => refetch()}
            title="Actualizar datos desde el servidor"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, padding: '9px 14px' }}
          >
            <i className={`fa-solid fa-arrows-rotate ${isLoading ? 'fa-spin' : ''}`}></i> Actualizar
          </button>
        </div>
      </div>

      {/* TARJETAS KPI REDISEÑADAS CON GLASSMORPHISM (1:1 ORIGINAL) */}
      <div
        className="kpi-grid"
        style={{
          marginBottom: '24px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(185px, 1fr))',
          gap: '14px',
        }}
      >
        {/* KPI 1: Total Viajes */}
        <div className="kpi-card glass-blue">
          <div className="kpi-icon-wrap">
            <i className="fa-solid fa-ticket"></i>
          </div>
          <div className="kpi-content">
            <span className="kpi-label">TOTAL VIAJES</span>
            <h3 className="kpi-value">{kpis.totalViajes}</h3>
            <span className="kpi-subtext" style={{ color: '#60a5fa' }}>
              Registrados en sistema
            </span>
          </div>
        </div>

        {/* KPI 2: Volumen Fincas */}
        <div className="kpi-card glass-emerald">
          <div className="kpi-icon-wrap" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
            <i className="fa-solid fa-cow"></i>
          </div>
          <div className="kpi-content">
            <span className="kpi-label">VOLUMEN FINCAS</span>
            <h3 className="kpi-value" style={{ color: '#059669' }}>
              {kpis.volumenFincas.toLocaleString()} L
            </h3>
            <span className="kpi-subtext" style={{ color: '#10b981' }}>
              Recolectado en ruta
            </span>
          </div>
        </div>

        {/* KPI 3: Volumen Recibido */}
        <div className="kpi-card glass-cyan">
          <div className="kpi-icon-wrap" style={{ background: 'rgba(14, 165, 233, 0.15)', color: '#0ea5e9' }}>
            <i className="fa-solid fa-warehouse"></i>
          </div>
          <div className="kpi-content">
            <span className="kpi-label">VOLUMEN RECIBIDO</span>
            <h3 className="kpi-value" style={{ color: '#0ea5e9' }}>
              {kpis.volumenRecibido.toLocaleString()} L
            </h3>
            <span className="kpi-subtext" style={{ color: '#38bdf8' }}>
              En Receptoría / Planta
            </span>
          </div>
        </div>

        {/* KPI 4: Merma Global */}
        <div className="kpi-card glass-amber">
          <div className="kpi-icon-wrap" style={{ background: 'rgba(249, 115, 22, 0.15)', color: '#ea580c' }}>
            <i className="fa-solid fa-chart-line"></i>
          </div>
          <div className="kpi-content">
            <span className="kpi-label">MERMA GLOBAL</span>
            <h3 className="kpi-value" style={{ color: '#ea580c' }}>
              {kpis.mermaLitros.toLocaleString()} Lts
            </h3>
            <span className="kpi-subtext" style={{ color: '#f97316', fontWeight: 700 }}>
              {kpis.mermaPct.toFixed(2)}% del volumen
            </span>
          </div>
        </div>

        {/* KPI 5: En Proceso */}
        <div className="kpi-card glass-yellow">
          <div className="kpi-icon-wrap" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>
            <i className="fa-solid fa-truck-moving"></i>
          </div>
          <div className="kpi-content">
            <span className="kpi-label">EN PROCESO</span>
            <h3 className="kpi-value" style={{ color: '#f59e0b' }}>
              {kpis.enProcesoCount}
            </h3>
            <span className="kpi-subtext" style={{ color: '#d97706' }}>
              Viajes activos
            </span>
          </div>
        </div>
      </div>

      {/* TABLA DE VIAJES / TICKETS */}
      <DataTable
        data={viajes}
        columns={columns}
        isLoading={isLoading}
        searchPlaceholder="Buscar por ticket, chofer, camión, ruta..."
        exportFileName="control_viajes_tickets"
        searchFilter={(row, term) =>
          Boolean(
            (row.codigoTicket && row.codigoTicket.toLowerCase().includes(term)) ||
            (row.choferNombre && row.choferNombre.toLowerCase().includes(term)) ||
            (row.camionPlaca && row.camionPlaca.toLowerCase().includes(term)) ||
            (row.rutaNombre && row.rutaNombre.toLowerCase().includes(term))
          )
        }
      />

      {/* MODAL INICIAR NUEVO VIAJE */}
      {modalIniciar && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(4px)',
            padding: '16px',
          }}
        >
          <div
            className="content-card"
            style={{
              width: '100%',
              maxWidth: '480px',
              padding: '24px',
              borderRadius: '16px',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingBottom: '14px',
                marginBottom: '16px',
                borderBottom: '1px solid var(--border-color)',
              }}
            >
              <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                <i className="fa-solid fa-truck-moving" style={{ color: '#4f46e5', marginRight: '8px' }}></i>
                Iniciar Nuevo Viaje / Ticket
              </h3>
              <button
                type="button"
                onClick={() => setModalIniciar(false)}
                style={{ background: 'none', border: 'none', fontSize: '18px', color: '#94a3b8', cursor: 'pointer' }}
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!formIniciar.camionId) {
                  toast.error('Selecciona una unidad cisterna');
                  return;
                }
                iniciarMutation.mutate(formIniciar);
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                    Unidad Cisterna *
                  </label>
                  <CamionSelect
                    value={formIniciar.camionId || undefined}
                    onChange={(val) => setFormIniciar({ ...formIniciar, camionId: val || 0 })}
                    placeholder="-- Seleccionar Unidad Cisterna --"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                    Ruta Planificada
                  </label>
                  <SearchableSelect
                    options={rutasOptions}
                    value={formIniciar.rutaLogisticaId}
                    onChange={(val) => setFormIniciar({ ...formIniciar, rutaLogisticaId: Number(val) })}
                    placeholder="-- Ruta Abierta / Sin predefinir --"
                    searchPlaceholder="Buscar ruta planificada..."
                    allowClear={true}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                    Odómetro Inicial (Km)
                  </label>
                  <input
                    type="number"
                    value={formIniciar.odometroInicialKm || ''}
                    onChange={(e) => setFormIniciar({ ...formIniciar, odometroInicialKm: Number(e.target.value) })}
                    className="form-input"
                    placeholder="Ej: 145200"
                    style={{ width: '100%', height: '38px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                    Observaciones Iniciales
                  </label>
                  <input
                    type="text"
                    value={formIniciar.observaciones}
                    onChange={(e) => setFormIniciar({ ...formIniciar, observaciones: e.target.value })}
                    className="form-input"
                    placeholder="Turno, indicaciones especiales..."
                    style={{ width: '100%', height: '38px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button
                  type="button"
                  onClick={() => setModalIniciar(false)}
                  className="btn btn-outline"
                  style={{ height: '38px' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={iniciarMutation.isPending}
                  className="btn btn-primary"
                  style={{ height: '38px' }}
                >
                  {iniciarMutation.isPending ? 'Iniciando...' : 'Iniciar Viaje'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DETALLE DE VIAJE */}
      {modalDetalle && viajeSeleccionado && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(4px)',
            padding: '16px',
          }}
        >
          <div
            className="content-card"
            style={{
              width: '100%',
              maxWidth: '820px',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '24px',
              borderRadius: '16px',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingBottom: '14px',
                marginBottom: '16px',
                borderBottom: '1px solid var(--border-color)',
              }}
            >
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                  <i className="fa-solid fa-ticket" style={{ color: '#4f46e5', marginRight: '8px' }}></i>
                  Detalle del Viaje #{viajeSeleccionado.codigoTicket || viajeSeleccionado.id}
                </h3>
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  Fecha: {new Date(viajeSeleccionado.fecha).toLocaleDateString('es-VE')} | Camión: {viajeSeleccionado.camionPlaca} | Chofer: {viajeSeleccionado.choferNombre}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setModalDetalle(false)}
                style={{ background: 'none', border: 'none', fontSize: '18px', color: '#94a3b8', cursor: 'pointer' }}
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            {/* SECCIÓN 1: FINCAS RECOLECTADAS */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#0369a1' }}>
                  <i className="fa-solid fa-cow" style={{ marginRight: '6px' }}></i>
                  1. Fincas Recolectadas ({fincasViaje.length})
                </h4>
                {viajeSeleccionado.estadoProceso !== 'CERRADO' && (
                  <button
                    type="button"
                    onClick={() => setModalAgregarFinca(true)}
                    className="btn btn-sm btn-outline"
                    style={{ fontSize: '12px', padding: '0 10px', height: '30px' }}
                  >
                    <i className="fa-solid fa-plus"></i> Registrar Finca
                  </button>
                )}
              </div>

              <table className="data-table">
                <thead>
                  <tr>
                    <th>Finca</th>
                    <th style={{ textAlign: 'right' }}>Litros</th>
                    <th style={{ textAlign: 'center' }}>Tipo</th>
                    <th style={{ textAlign: 'center' }}>Temp (°C)</th>
                  </tr>
                </thead>
                <tbody>
                  {fincasViaje.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', color: '#94a3b8', padding: '16px' }}>
                        No hay recolecciones registradas en este viaje aún.
                      </td>
                    </tr>
                  ) : (
                    fincasViaje.map((f, idx) => (
                      <tr key={idx}>
                        <td>
                          <strong>{f.fincaNombre || `Finca #${f.fincaId}`}</strong>
                          <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>{f.propietarioNombre}</span>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: '#2563eb' }}>
                          {(f.litrosLeche || 0).toLocaleString()} L
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span className="badge">{f.tipoLeche || 'VACA'}</span>
                        </td>
                        <td style={{ textAlign: 'center' }}>{f.temperatura ? `${f.temperatura}°C` : '-'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* SECCIÓN 2: ENTREGAS A PLANTA / QUESERAS */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#7e22ce' }}>
                  <i className="fa-solid fa-building-circle-check" style={{ marginRight: '6px' }}></i>
                  2. Descargas en Silos / Queseras ({entregasViaje.length})
                </h4>
                {viajeSeleccionado.estadoProceso !== 'CERRADO' && (
                  <button
                    type="button"
                    onClick={() => setModalEntrega(true)}
                    className="btn btn-sm btn-outline"
                    style={{ fontSize: '12px', padding: '0 10px', height: '30px' }}
                  >
                    <i className="fa-solid fa-plus"></i> Registrar Descarga
                  </button>
                )}
              </div>

              <table className="data-table">
                <thead>
                  <tr>
                    <th>Planta / Compañía</th>
                    <th style={{ textAlign: 'right' }}>Litros Entregados</th>
                    <th>Ticket / Comprobante</th>
                  </tr>
                </thead>
                <tbody>
                  {entregasViaje.length === 0 ? (
                    <tr>
                      <td colSpan={3} style={{ textAlign: 'center', color: '#94a3b8', padding: '16px' }}>
                        No hay descargas registradas en este viaje aún.
                      </td>
                    </tr>
                  ) : (
                    entregasViaje.map((e, idx) => (
                      <tr key={idx}>
                        <td>
                          <strong>{e.companiaNombre || `Planta #${e.companiaId}`}</strong>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: '#059669' }}>
                          {(e.litrosEntregados || 0).toLocaleString()} L
                        </td>
                        <td>{e.ticketReceptoria || '-'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* BOTONES INFERIORES */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
              <div>
                {viajeSeleccionado.estadoProceso !== 'CERRADO' && (
                  <button
                    type="button"
                    onClick={() => setModalCerrar(true)}
                    className="btn btn-primary"
                    style={{ background: '#059669', borderColor: '#059669' }}
                  >
                    <i className="fa-solid fa-lock"></i> Finalizar y Cerrar Viaje
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => setModalDetalle(false)}
                className="btn btn-outline"
              >
                Cerrar Ventana
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default ViajesTicketsPage;
