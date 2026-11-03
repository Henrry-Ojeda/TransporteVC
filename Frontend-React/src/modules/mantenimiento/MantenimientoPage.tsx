import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { mantenimientoApi } from '@/api/mantenimiento.api';
import { catalogosApi } from '@/api/catalogos.api';
import { DataTable, type ColumnDef } from '@/components/common/DataTable';
import { confirmDeleteOrDeactivate } from '@/lib/sweetalert';
import type {
  MantenimientoCamionDto,
  CrearMantenimientoCamionDto,
  AlertaPreventivaDto,
  CamionDto,
} from '@/types';

export const MantenimientoPage: React.FC = () => {
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'mantenimientos' | 'alertas'>('mantenimientos');
  const [filtroCamion, setFiltroCamion] = useState<string>('');
  const [filtroTipo, setFiltroTipo] = useState<string>('');
  const [filtroEstado, setFiltroEstado] = useState<string>('');

  const [modalAbierto, setModalAbierto] = useState<boolean>(false);
  const [modoEdicionId, setModoEdicionId] = useState<number | null>(null);

  const initialForm: CrearMantenimientoCamionDto = {
    camionId: 0,
    tipoEvento: 'PREVENTIVO',
    titulo: '',
    descripcion: '',
    fechaEvento: new Date().toISOString().split('T')[0],
    odometroKm: undefined,
    proximoKmSugerido: undefined,
    proximaFechaSugerida: undefined,
    tallerOMecanico: '',
    estado: 'RESUELTO',
    costoTotalUSD: 0,
  };
  const [form, setForm] = useState<CrearMantenimientoCamionDto>(initialForm);

  // Queries
  const { data: mantenimientos = [], isLoading: loadingMants, refetch: refetchMants } = useQuery<MantenimientoCamionDto[]>({
    queryKey: ['mantenimientos', filtroCamion, filtroTipo, filtroEstado],
    queryFn: () =>
      mantenimientoApi.getMantenimientos(
        filtroCamion ? Number(filtroCamion) : undefined,
        filtroTipo || undefined,
        filtroEstado || undefined
      ),
  });

  const { data: alertas = [], isLoading: loadingAlertas } = useQuery<AlertaPreventivaDto[]>({
    queryKey: ['mantenimientos-alertas'],
    queryFn: () => mantenimientoApi.getAlertas(),
  });

  const { data: camiones = [] } = useQuery<CamionDto[]>({
    queryKey: ['camiones-mantenimiento'],
    queryFn: () => catalogosApi.getCamiones(true),
  });

  // Mutaciones
  const mutationGuardar = useMutation({
    mutationFn: (dto: CrearMantenimientoCamionDto) =>
      modoEdicionId ? mantenimientoApi.actualizar(modoEdicionId, dto) : mantenimientoApi.crear(dto),
    onSuccess: (data: any) => {
      toast.success(data.message || 'Mantenimiento registrado exitosamente');
      queryClient.invalidateQueries({ queryKey: ['mantenimientos'] });
      queryClient.invalidateQueries({ queryKey: ['mantenimientos-alertas'] });
      cerrarModal();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Error al guardar mantenimiento');
    },
  });

  const mutationEliminar = useMutation({
    mutationFn: (id: number) => mantenimientoApi.eliminar(id),
    onSuccess: (data: any) => {
      toast.success(data.message || 'Registro de mantenimiento eliminado');
      queryClient.invalidateQueries({ queryKey: ['mantenimientos'] });
      queryClient.invalidateQueries({ queryKey: ['mantenimientos-alertas'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Error al eliminar mantenimiento');
    },
  });

  const abrirModalCrear = () => {
    setModoEdicionId(null);
    setForm(initialForm);
    setModalAbierto(true);
  };

  const abrirModalEditar = (item: MantenimientoCamionDto) => {
    setModoEdicionId(item.id);
    setForm({
      camionId: item.camionId,
      tipoEvento: item.tipoEvento,
      titulo: item.titulo,
      descripcion: item.descripcion || '',
      fechaEvento: item.fechaEvento ? item.fechaEvento.split('T')[0] : new Date().toISOString().split('T')[0],
      odometroKm: item.odometroKm,
      proximoKmSugerido: item.proximoKmSugerido,
      proximaFechaSugerida: item.proximaFechaSugerida ? item.proximaFechaSugerida.split('T')[0] : undefined,
      tallerOMecanico: item.tallerOMecanico || '',
      estado: item.estado,
      costoTotalUSD: item.costoTotalUSD || 0,
    });
    setModalAbierto(true);
  };

  const cerrarModal = () => {
    setModalAbierto(false);
    setModoEdicionId(null);
  };

  // Métricas
  const totalEnTaller = mantenimientos.filter((m) => m.estado === 'EN_TALLER').length;
  const totalReportados = mantenimientos.filter((m) => m.estado === 'REPORTADO_CHOFER').length;
  const totalAlertasCriticas = alertas.filter(
    (a) => a.proximoKmSugerido != null && a.odometroActualKm >= a.proximoKmSugerido
  ).length;
  const costoTotalUSD = mantenimientos.reduce((acc, m) => acc + (m.costoTotalUSD || 0), 0);

  const columns: ColumnDef<MantenimientoCamionDto>[] = [
    {
      header: 'FECHA',
      accessorKey: 'fechaEvento',
      sortable: true,
      width: '105px',
      cell: (row) => (
        <strong style={{ color: '#0f172a', fontSize: '13px', fontWeight: 700 }}>
          {row.fechaEvento ? row.fechaEvento.split('T')[0] : '-'}
        </strong>
      ),
    },
    {
      header: 'CAMIÓN',
      accessorKey: 'camionPlaca',
      sortable: true,
      width: '130px',
      cell: (row) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <i className="fa-solid fa-truck" style={{ color: '#2563eb' }}></i>
          <div>
            <div style={{ fontWeight: 800, color: '#0f172a' }}>{row.camionPlaca || `ID #${row.camionId}`}</div>
            <span style={{ fontSize: '11px', color: '#64748b' }}>{row.choferNombre || 'Chofer'}</span>
          </div>
        </div>
      ),
    },
    {
      header: 'TIPO SERVICIO',
      accessorKey: 'tipoEvento',
      sortable: true,
      width: '150px',
      cell: (row) => {
        const tipos: Record<string, { label: string; bg: string; color: string; border: string; icon: string }> = {
          CAMBIO_ACEITE: { label: 'Cambio de Aceite', bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe', icon: 'fa-oil-can' },
          CAUCHOS: { label: 'Cauchos / Neumáticos', bg: '#fdf4ff', color: '#a21caf', border: '#f0abfc', icon: 'fa-circle-dot' },
          PREVENTIVO: { label: 'Preventivo', bg: '#ecfdf5', color: '#047857', border: '#a7f3d0', icon: 'fa-wrench' },
          CORRECTIVO: { label: 'Correctivo', bg: '#fffbeb', color: '#b45309', border: '#fde68a', icon: 'fa-triangle-exclamation' },
          SINIESTRO_CHOFER: { label: 'Siniestro / Incidente', bg: '#fef2f2', color: '#dc2626', border: '#fecaca', icon: 'fa-car-burst' },
        };
        const t = tipos[row.tipoEvento] || { label: row.tipoEvento, bg: '#f8fafc', color: '#475569', border: '#cbd5e1', icon: 'fa-wrench' };
        return (
          <span
            className="badge"
            style={{
              background: t.bg,
              color: t.color,
              border: `1px solid ${t.border}`,
              fontWeight: 800,
              fontSize: '11px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <i className={`fa-solid ${t.icon}`}></i> {t.label}
          </span>
        );
      },
    },
    {
      header: 'DESCRIPCIÓN DEL EVENTO',
      accessorKey: 'titulo',
      cell: (row) => (
        <div>
          <div style={{ fontWeight: 700, color: '#0f172a' }}>{row.titulo}</div>
          {row.descripcion && (
            <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px', lineHeight: 1.3 }}>
              {row.descripcion}
            </div>
          )}
        </div>
      ),
    },
    {
      header: 'KM / PRÓXIMO',
      accessorKey: 'odometroKm',
      width: '130px',
      cell: (row) => (
        <div>
          <div style={{ fontWeight: 800, color: '#0f172a', fontFamily: 'monospace' }}>
            {row.odometroKm != null ? `${row.odometroKm.toLocaleString()} Km` : '-'}
          </div>
          {row.proximoKmSugerido && (
            <div style={{ fontSize: '11px', color: '#b45309', fontWeight: 600 }}>
              Próx: {row.proximoKmSugerido.toLocaleString()} Km
            </div>
          )}
        </div>
      ),
    },
    {
      header: 'TALLER / MECÁNICO',
      accessorKey: 'tallerOMecanico',
      cell: (row) => (
        <span style={{ fontSize: '12.5px', color: '#334155', fontWeight: 600 }}>
          {row.tallerOMecanico || 'Taller Interno Base'}
        </span>
      ),
    },
    {
      header: 'COSTO (USD)',
      accessorKey: 'costoTotalUSD',
      sortable: true,
      width: '115px',
      cell: (row) => (
        <span style={{ fontWeight: 900, color: '#059669', fontFamily: 'monospace', fontSize: '13.5px' }}>
          ${Number(row.costoTotalUSD || 0).toFixed(2)}
        </span>
      ),
    },
    {
      header: 'ESTADO',
      accessorKey: 'estado',
      sortable: true,
      width: '120px',
      cell: (row) => {
        const esResuelto = row.estado === 'RESUELTO';
        const esTaller = row.estado === 'EN_TALLER';
        return (
          <span
            className="badge"
            style={{
              background: esResuelto ? '#ecfdf5' : esTaller ? '#fef3c7' : '#fef2f2',
              color: esResuelto ? '#059669' : esTaller ? '#d97706' : '#dc2626',
              border: `1px solid ${esResuelto ? '#a7f3d0' : esTaller ? '#fde68a' : '#fecaca'}`,
              fontWeight: 800,
              fontSize: '11px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <i className={`fa-solid ${esResuelto ? 'fa-check' : esTaller ? 'fa-screwdriver-wrench' : 'fa-clock'}`}></i>
            {esResuelto ? 'Resuelto' : esTaller ? 'En Taller' : 'Pendiente'}
          </span>
        );
      },
    },
    {
      header: 'ACCIONES',
      width: '90px',
      cell: (row) => (
        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
          <button
            type="button"
            className="btn btn-sm btn-outline"
            onClick={() => abrirModalEditar(row)}
            title="Editar servicio"
            style={{ height: '30px', width: '30px', padding: 0, borderRadius: '6px' }}
          >
            <i className="fa-solid fa-pen-to-square" style={{ fontSize: '11px' }}></i>
          </button>
          <button
            type="button"
            className="btn btn-sm btn-outline"
            onClick={async () => {
              if (await confirmDeleteOrDeactivate('Eliminar registro de mantenimiento', `#${row.id}`)) {
                mutationEliminar.mutate(row.id);
              }
            }}
            title="Eliminar"
            style={{ height: '30px', width: '30px', padding: 0, borderRadius: '6px', color: '#ef4444', borderColor: '#fca5a5' }}
          >
            <i className="fa-solid fa-trash-can" style={{ fontSize: '11px' }}></i>
          </button>
        </div>
      ),
    },
  ];

  return (
    <section id="tab-historial-camiones" className="tab-content" style={{ display: 'block' }}>
      {/* CABECERA VISTA */}
      <div className="view-header">
        <div>
          <h1 className="view-title">
            <i className="fa-solid fa-truck-wrench" style={{ color: '#2563eb', marginRight: '10px' }}></i>
            Historial de Mantenimiento y Flota
          </h1>
          <p className="view-subtitle">
            Control preventivo de servicios mecánicos, cambios de aceite, reemplazo de cauchos y alertas por kilometraje
          </p>
        </div>
        <div className="view-actions" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => {
              refetchMants();
              queryClient.invalidateQueries({ queryKey: ['mantenimientos-alertas'] });
            }}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <i className="fa-solid fa-arrows-rotate"></i> Actualizar
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={abrirModalCrear}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#2563eb', borderColor: '#2563eb' }}
          >
            <i className="fa-solid fa-plus"></i> Registrar Mantenimiento
          </button>
        </div>
      </div>

      {/* TARJETAS DE INDICADORES (KPIS) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '16px', marginBottom: '22px' }}>
        <div className="kpi-card glass-amber">
          <div className="kpi-icon-wrap">
            <i className="fa-solid fa-wrench"></i>
          </div>
          <div className="kpi-content">
            <span className="kpi-title">En Taller / Activos</span>
            <div className="kpi-value">{totalEnTaller}</div>
            <span className="kpi-foot">{totalReportados} averías reportadas</span>
          </div>
        </div>

        <div className="kpi-card glass-red">
          <div className="kpi-icon-wrap">
            <i className="fa-solid fa-triangle-exclamation"></i>
          </div>
          <div className="kpi-content">
            <span className="kpi-title">Alertas Preventivas</span>
            <div className="kpi-value">{alertas.length}</div>
            <span className="kpi-foot" style={{ color: '#dc2626', fontWeight: 700 }}>
              {totalAlertasCriticas} críticas próximas
            </span>
          </div>
        </div>

        <div className="kpi-card glass-emerald">
          <div className="kpi-icon-wrap">
            <i className="fa-solid fa-dollar-sign"></i>
          </div>
          <div className="kpi-content">
            <span className="kpi-title">Costo Invertido (USD)</span>
            <div className="kpi-value">${costoTotalUSD.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <span className="kpi-foot">{mantenimientos.length} eventos registrados</span>
          </div>
        </div>

        <div className="kpi-card glass-blue">
          <div className="kpi-icon-wrap">
            <i className="fa-solid fa-truck"></i>
          </div>
          <div className="kpi-content">
            <span className="kpi-title">Camiones Operativos</span>
            <div className="kpi-value">{camiones.length}</div>
            <span className="kpi-foot">Flota bajo monitoreo</span>
          </div>
        </div>
      </div>

      {/* SUB-PESTAÑAS */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', borderBottom: '2px solid #e2e8f0', paddingBottom: '2px' }}>
        <button
          type="button"
          onClick={() => setActiveTab('mantenimientos')}
          style={{
            border: 'none',
            borderBottom: activeTab === 'mantenimientos' ? '3px solid #2563eb' : 'none',
            background: 'transparent',
            fontWeight: 800,
            fontSize: '13.5px',
            color: activeTab === 'mantenimientos' ? '#2563eb' : '#64748b',
            padding: '8px 16px',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <i className="fa-solid fa-clipboard-list"></i> Bitácora de Servicios y Reparaciones ({mantenimientos.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('alertas')}
          style={{
            border: 'none',
            borderBottom: activeTab === 'alertas' ? '3px solid #2563eb' : 'none',
            background: 'transparent',
            fontWeight: 800,
            fontSize: '13.5px',
            color: activeTab === 'alertas' ? '#2563eb' : '#64748b',
            padding: '8px 16px',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <i className="fa-solid fa-triangle-exclamation" style={{ color: '#f59e0b' }}></i> Semáforo de Alertas Preventivas ({alertas.length})
        </button>
      </div>

      {activeTab === 'mantenimientos' ? (
        /* TABLA PRINCIPAL DE MANTENIMIENTOS */
        <DataTable
          data={mantenimientos}
          columns={columns}
          isLoading={loadingMants}
          searchPlaceholder="Buscar por placa, título de servicio, taller..."
          exportFileName="mantenimiento_flota"
          searchFilter={(row, term) =>
            Boolean(
              (row.camionPlaca && row.camionPlaca.toLowerCase().includes(term)) ||
              (row.titulo && row.titulo.toLowerCase().includes(term)) ||
              (row.tallerOMecanico && row.tallerOMecanico.toLowerCase().includes(term)) ||
              (row.tipoEvento && row.tipoEvento.toLowerCase().includes(term))
            )
          }
          actions={
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <select
                className="form-input"
                value={filtroCamion}
                onChange={(e) => setFiltroCamion(e.target.value)}
                style={{ height: '38px', fontSize: '13px', fontWeight: 600 }}
              >
                <option value="">-- Todos los Camiones --</option>
                {camiones.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.placa} ({c.marca} {c.modelo})
                  </option>
                ))}
              </select>

              <select
                className="form-input"
                value={filtroTipo}
                onChange={(e) => setFiltroTipo(e.target.value)}
                style={{ height: '38px', fontSize: '13px', fontWeight: 600 }}
              >
                <option value="">-- Todos los Eventos --</option>
                <option value="CAMBIO_ACEITE">Cambio de Aceite</option>
                <option value="CAUCHOS">Cauchos / Neumáticos</option>
                <option value="PREVENTIVO">Mantenimiento Preventivo</option>
                <option value="CORRECTIVO">Reparación Correctiva</option>
                <option value="SINIESTRO_CHOFER">Siniestro / Incidente Chofer</option>
              </select>

              <select
                className="form-input"
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value)}
                style={{ height: '38px', fontSize: '13px', fontWeight: 600 }}
              >
                <option value="">-- Todos los Estados --</option>
                <option value="RESUELTO">Resuelto / Completado</option>
                <option value="EN_TALLER">En Taller</option>
                <option value="REPORTADO_CHOFER">Reportado / Pendiente</option>
              </select>
            </div>
          }
        />
      ) : (
        /* PANEL DE ALERTAS PREVENTIVAS POR CAMIÓN */
        <div style={{ marginBottom: '24px' }}>
          {loadingAlertas ? (
            <div className="content-card" style={{ padding: '30px', textAlign: 'center', color: '#94a3b8' }}>
              <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '20px', marginRight: '8px' }}></i>
              Evaluando odómetros y alertas de servicio...
            </div>
          ) : alertas.length === 0 ? (
            <div className="content-card" style={{ padding: '36px', textAlign: 'center', color: '#059669' }}>
              <i className="fa-solid fa-circle-check" style={{ fontSize: '32px', marginBottom: '8px', display: 'block' }}></i>
              <strong style={{ fontSize: '15px' }}>Flota al día</strong>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
                Todos los camiones se encuentran dentro de los rangos de kilometraje permitidos.
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
              {alertas.map((a, idx) => {
                const esCritica = a.proximoKmSugerido != null && a.odometroActualKm >= a.proximoKmSugerido;
                return (
                  <div
                    key={idx}
                    className="content-card"
                    style={{
                      borderLeft: `5px solid ${esCritica ? '#ef4444' : '#f59e0b'}`,
                      padding: '16px 20px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontWeight: 800, color: '#0f172a', fontSize: '14.5px' }}>
                        <i className="fa-solid fa-truck" style={{ color: '#2563eb', marginRight: '6px' }}></i>
                        {a.placa} ({a.marcaModelo})
                      </span>
                      <span
                        className="badge"
                        style={{
                          background: esCritica ? '#fef2f2' : '#fffbeb',
                          color: esCritica ? '#dc2626' : '#b45309',
                          border: `1px solid ${esCritica ? '#fecaca' : '#fde68a'}`,
                          fontWeight: 800,
                          fontSize: '11px',
                        }}
                      >
                        {esCritica ? 'CRÍTICA' : 'PRÓXIMA'}
                      </span>
                    </div>
                    <div style={{ fontWeight: 700, color: '#334155', fontSize: '13px', marginBottom: '4px' }}>
                      {a.titulo || a.tipoEvento || 'Servicio Mecánico'}
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '10px' }}>
                      Odómetro: <strong>{a.odometroActualKm?.toLocaleString()} Km</strong> | Límite: <strong>{a.proximoKmSugerido?.toLocaleString()} Km</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        className="btn btn-sm btn-primary"
                        onClick={() => {
                          setModoEdicionId(null);
                          setForm({
                            ...initialForm,
                            camionId: a.camionId,
                            titulo: `Servicio preventivo: ${a.titulo || a.tipoEvento}`,
                            odometroKm: a.odometroActualKm,
                          });
                          setModalAbierto(true);
                        }}
                        style={{ fontSize: '12px', padding: '4px 12px' }}
                      >
                        <i className="fa-solid fa-wrench"></i> Programar Taller
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODAL REGISTRAR / EDITAR MANTENIMIENTO */}
      {modalAbierto && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
        >
          <div
            className="content-card"
            style={{
              width: '100%',
              maxWidth: '580px',
              background: '#ffffff',
              borderRadius: '16px',
              padding: 0,
              overflow: 'hidden',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
            }}
          >
            <div
              style={{
                padding: '16px 20px',
                background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                color: '#ffffff',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fa-solid fa-wrench"></i>
                {modoEdicionId ? 'Editar Evento de Mantenimiento' : 'Registrar Mantenimiento'}
              </h3>
              <button
                type="button"
                onClick={cerrarModal}
                style={{ background: 'transparent', border: 'none', color: '#ffffff', fontSize: '16px', cursor: 'pointer' }}
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (form.camionId === 0 || !form.titulo.trim()) {
                  toast.error('Complete el camión y título del evento');
                  return;
                }
                mutationGuardar.mutate(form);
              }}
              style={{ padding: '20px' }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                    Camión Cisterna *
                  </label>
                  <select
                    className="form-input"
                    required
                    value={form.camionId || ''}
                    onChange={(e) => setForm({ ...form, camionId: Number(e.target.value) })}
                    style={{ height: '38px', fontWeight: 700 }}
                  >
                    <option value="">-- Seleccionar --</option>
                    {camiones.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.placa} ({c.marca} {c.modelo})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                    Tipo de Evento *
                  </label>
                  <select
                    className="form-input"
                    required
                    value={form.tipoEvento}
                    onChange={(e) => setForm({ ...form, tipoEvento: e.target.value })}
                    style={{ height: '38px', fontWeight: 700 }}
                  >
                    <option value="CAMBIO_ACEITE">Cambio de Aceite / Filtros</option>
                    <option value="CAUCHOS">Cambio / Rotación de Cauchos</option>
                    <option value="PREVENTIVO">Mantenimiento Preventivo General</option>
                    <option value="CORRECTIVO">Reparación Correctiva</option>
                    <option value="SINIESTRO_CHOFER">Siniestro / Incidente Chofer</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                  Título del Servicio *
                </label>
                <input
                  type="text"
                  className="form-input"
                  required
                  placeholder="Ej: Cambio de aceite 15W40 y filtros de diésel"
                  value={form.titulo}
                  onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                  style={{ height: '38px', fontWeight: 600 }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                    Fecha del Evento *
                  </label>
                  <input
                    type="date"
                    className="form-input"
                    required
                    value={form.fechaEvento}
                    onChange={(e) => setForm({ ...form, fechaEvento: e.target.value })}
                    style={{ height: '38px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                    Odómetro Actual (Km)
                  </label>
                  <input
                    type="number"
                    className="form-input"
                    placeholder="Ej: 145000"
                    value={form.odometroKm || ''}
                    onChange={(e) => setForm({ ...form, odometroKm: Number(e.target.value) || undefined })}
                    style={{ height: '38px', fontWeight: 700 }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                    Taller / Mecánico
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Ej: Taller Central El Vigía"
                    value={form.tallerOMecanico || ''}
                    onChange={(e) => setForm({ ...form, tallerOMecanico: e.target.value })}
                    style={{ height: '38px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                    Costo Total (USD)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-input"
                    placeholder="0.00"
                    value={form.costoTotalUSD || ''}
                    onChange={(e) => setForm({ ...form, costoTotalUSD: Number(e.target.value) || 0 })}
                    style={{ height: '38px', fontWeight: 800, color: '#059669' }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                  Estado del Mantenimiento *
                </label>
                <select
                  className="form-input"
                  value={form.estado}
                  onChange={(e) => setForm({ ...form, estado: e.target.value })}
                  style={{ height: '38px', fontWeight: 700 }}
                >
                  <option value="RESUELTO">Resuelto / Listo para rodar</option>
                  <option value="EN_TALLER">En Taller / En proceso de reparación</option>
                  <option value="REPORTADO_CHOFER">Reportado / Pendiente de ingreso</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={cerrarModal}
                  style={{ height: '38px', padding: '0 16px' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={mutationGuardar.isPending}
                  style={{
                    height: '38px',
                    padding: '0 20px',
                    fontWeight: 700,
                    background: '#2563eb',
                    border: 'none',
                  }}
                >
                  <i className="fa-solid fa-floppy-disk"></i>
                  {mutationGuardar.isPending ? 'Guardando...' : modoEdicionId ? 'Actualizar' : 'Guardar Mantenimiento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};
