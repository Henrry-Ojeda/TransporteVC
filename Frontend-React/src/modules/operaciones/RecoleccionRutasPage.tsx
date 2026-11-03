import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import apiClient from '@/api/client';
import { operacionesApi } from '@/api/operaciones.api';
import { catalogosApi } from '@/api/catalogos.api';
import { DataTable, type ColumnDef } from '@/components/common/DataTable';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import { useAuthStore } from '@/stores/authStore';
import type { ControlRutaDto, FincaDto, CamionDto } from '@/types';

interface RutaDetalleFinca {
  id: number;
  fecha: string;
  fincaId: number;
  fincaNombre?: string;
  propietarioNombre?: string;
  litros: number;
  tipoLeche: string;
  esAcida?: boolean;
  horaRecoleccion?: string;
  controlRutaId?: number;
  ticketCodigo?: string;
  conductorNombre?: string;
}

export const RecoleccionRutasPage: React.FC = () => {
  const queryClient = useQueryClient();
  const hasBufala = useAuthStore((state) => state.hasTenantModule('MOD_LECHE_BUFALA'));
  const hoyStr = new Date().toISOString().split('T')[0];

  const [modoVista, setModoVista] = useState<'viajes' | 'fincas'>('viajes');
  const [fechaFiltro, setFechaFiltro] = useState<string>(hoyStr);
  const [filtroOrigenTicket, setFiltroOrigenTicket] = useState<'todos' | 'RUTA' | 'RECEPTORIA'>('todos');
  const [modalIniciarViaje, setModalIniciarViaje] = useState(false);
  const [modalRegistroFinca, setModalRegistroFinca] = useState(false);
  const [viajeActivoId, setViajeActivoId] = useState<number | null>(null);

  // Formulario iniciar viaje
  const [formIniciar, setFormIniciar] = useState({
    camionId: 0,
    rutaLogisticaId: 0,
    odometroInicialKm: 0,
    observaciones: '',
  });

  // Formulario registrar recolección finca
  const [formFinca, setFormFinca] = useState({
    fincaId: 0,
    litros: 0,
    tipoLeche: 'VACA',
    esAcida: false,
    observacion: '',
  });

  // Queries
  const { data: viajes = [], isLoading: loadingViajes } = useQuery<ControlRutaDto[]>({
    queryKey: ['rutas-viajes-hoy', fechaFiltro],
    queryFn: () => operacionesApi.getControles(fechaFiltro),
  });

  const { data: recolecciones = [], isLoading: loadingRecolecciones } = useQuery<RutaDetalleFinca[]>({
    queryKey: ['rutas-fincas-hoy', fechaFiltro],
    queryFn: async () => {
      const res = await apiClient.get<RutaDetalleFinca[]>(`/rutas/hoy?fecha=${fechaFiltro}`).catch(() => ({ data: [] }));
      return Array.isArray(res.data) ? res.data : [];
    },
  });

  const { data: camiones = [] } = useQuery<CamionDto[]>({
    queryKey: ['camiones'],
    queryFn: () => catalogosApi.getCamiones(true),
  });

  const { data: fincas = [] } = useQuery<FincaDto[]>({
    queryKey: ['fincas'],
    queryFn: () => catalogosApi.getFincas(true),
  });

  const { data: rutasLogistica = [] } = useQuery<any[]>({
    queryKey: ['rutas-logistica'],
    queryFn: () => operacionesApi.getRutasLogistica(),
  });

  // Mutación iniciar viaje
  const iniciarMutation = useMutation({
    mutationFn: (dto: typeof formIniciar) => operacionesApi.iniciarViaje(dto),
    onSuccess: (data) => {
      toast.success(data.message || 'Viaje iniciado con éxito');
      queryClient.invalidateQueries({ queryKey: ['rutas-viajes-hoy'] });
      setModalIniciarViaje(false);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Error al iniciar viaje');
    },
  });

  // Mutación registrar recolección
  const guardarRecoleccionMutation = useMutation({
    mutationFn: async (dto: typeof formFinca) => {
      const payload = {
        fecha: fechaFiltro,
        fincaId: dto.fincaId,
        litros: dto.litros,
        tipoLeche: dto.tipoLeche,
        esAcida: dto.esAcida,
        observacion: dto.observacion,
        controlRutaId: viajeActivoId || undefined,
      };
      const res = await apiClient.post('/rutas', payload);
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Recolección registrada');
      queryClient.invalidateQueries({ queryKey: ['rutas-fincas-hoy'] });
      queryClient.invalidateQueries({ queryKey: ['rutas-viajes-hoy'] });
      setModalRegistroFinca(false);
      setFormFinca({ fincaId: 0, litros: 0, tipoLeche: 'VACA', esAcida: false, observacion: '' });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Error al registrar recolección');
    },
  });

  // Filtrado de viajes por origen
  const viajesFiltrados = useMemo(() => {
    if (filtroOrigenTicket === 'todos') return viajes;
    return viajes;
  }, [viajes, filtroOrigenTicket]);

  const columnsRecolecciones: ColumnDef<RutaDetalleFinca>[] = [
    {
      header: 'HORA / FECHA',
      accessorKey: 'fecha',
      sortable: true,
      cell: (row) => (
        <div>
          <span style={{ fontWeight: 700, color: '#0f172a' }}>
            {row.fecha ? new Date(row.fecha).toLocaleDateString('es-VE') : '-'}
          </span>
          {row.horaRecoleccion && (
            <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>{row.horaRecoleccion}</span>
          )}
        </div>
      ),
    },
    {
      header: 'FINCA PRODUCTORA',
      accessorKey: 'fincaNombre',
      sortable: true,
      cell: (row) => (
        <div>
          <div style={{ fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <i className="fa-solid fa-cow" style={{ color: '#10b981' }}></i>
            {row.fincaNombre || `Finca #${row.fincaId}`}
          </div>
          {row.propietarioNombre && (
            <span style={{ fontSize: '11.5px', color: '#64748b' }}>{row.propietarioNombre}</span>
          )}
        </div>
      ),
    },
    {
      header: 'LITROS RECOGIDOS',
      accessorKey: 'litros',
      sortable: true,
      cell: (row) => (
        <span style={{ fontWeight: 800, color: '#2563eb', fontSize: '14px' }}>
          {(row.litros || 0).toLocaleString()} <small>Lts</small>
        </span>
      ),
    },
    ...(hasBufala
      ? [
          {
            header: 'TIPO DE LECHE',
            accessorKey: 'tipoLeche',
            cell: (row: RutaDetalleFinca) => {
              const esBufala = row.tipoLeche === 'BUFALA';
              return (
                <span
                  className="badge"
                  style={{
                    background: esBufala ? '#f3e8ff' : '#e0f2fe',
                    color: esBufala ? '#7e22ce' : '#0284c7',
                    border: `1px solid ${esBufala ? '#d8b4fe' : '#bae6fd'}`,
                    fontWeight: 700,
                  }}
                >
                  {esBufala ? '🐃 BÚFALA' : '🥛 VACA'}
                </span>
              );
            },
          } as ColumnDef<RutaDetalleFinca>,
        ]
      : []),
    {
      header: 'CALIDAD',
      accessorKey: 'esAcida',
      cell: (row) =>
        row.esAcida ? (
          <span className="badge" style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', fontWeight: 800 }}>
            <i className="fa-solid fa-flask-vial" style={{ marginRight: '4px' }}></i> ÁCIDA
          </span>
        ) : (
          <span className="badge" style={{ background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0' }}>
            Normal (Fría)
          </span>
        ),
    },
    {
      header: 'TICKET / VIAJE',
      cell: (row) => (
        <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#4f46e5' }}>
          {row.ticketCodigo || (row.controlRutaId ? `TKT-${row.controlRutaId}` : '-')}
        </span>
      ),
    },
  ];

  return (
    <section id="tab-rutas" className="tab-content active" style={{ display: 'block' }}>
      {/* CABECERA VISTA */}
      <div className="view-header">
        <div>
          <h1 className="view-title">Rutas de Recolección</h1>
          <p className="view-subtitle">Captura, gestión y control de recolecciones de leche en campo</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setModalIniciarViaje(true)}
            style={{
              fontWeight: 700,
              background: 'linear-gradient(135deg, #10b981, #059669)',
              border: 'none',
              boxShadow: '0 4px 14px rgba(16,185,129,0.3)',
              height: '38px',
              padding: '0 18px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <i className="fa-solid fa-plus-circle"></i> Iniciar Nuevo Viaje / Ticket
          </button>
        </div>
      </div>

      {/* BARRA DE CONTROL DE VISTAS Y FECHA GLOBAL */}
      <div
        className="content-card"
        style={{
          padding: '10px 16px',
          marginBottom: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
            <i className="fa-solid fa-layer-group" style={{ color: '#4f46e5', marginRight: '6px' }}></i> Modo de Vista:
          </span>
          <div style={{ display: 'inline-flex', background: '#f1f5f9', padding: '3px', borderRadius: '10px', border: '1px solid #e2e8f0', gap: '4px' }}>
            <button
              type="button"
              className={`btn btn-sm ${modoVista === 'viajes' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setModoVista('viajes')}
              style={{
                fontWeight: 700,
                height: '34px',
                padding: '0 16px',
                borderRadius: '7px',
                border: 'none',
                background: modoVista === 'viajes' ? '#ffffff' : 'transparent',
                color: modoVista === 'viajes' ? '#1e293b' : '#64748b',
                boxShadow: modoVista === 'viajes' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <i className="fa-solid fa-truck-moving" style={{ color: '#2563eb' }}></i> Mis Viajes / Tickets
              <span className="badge" style={{ background: '#eff6ff', color: '#1d4ed8', fontSize: '11px', fontWeight: 800 }}>
                {viajes.length}
              </span>
            </button>

            <button
              type="button"
              className={`btn btn-sm ${modoVista === 'fincas' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setModoVista('fincas')}
              style={{
                fontWeight: 700,
                height: '34px',
                padding: '0 16px',
                borderRadius: '7px',
                border: 'none',
                background: modoVista === 'fincas' ? '#ffffff' : 'transparent',
                color: modoVista === 'fincas' ? '#1e293b' : '#64748b',
                boxShadow: modoVista === 'fincas' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <i className="fa-solid fa-list-check"></i> Detalle por Fincas
              <span className="badge" style={{ background: '#e2e8f0', color: '#475569', fontSize: '11px', fontWeight: 700 }}>
                {recolecciones.length}
              </span>
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#ffffff', padding: '4px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
            <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <i className="fa-regular fa-calendar-days" style={{ color: '#2563eb', fontSize: '14px' }}></i> Fecha:
            </label>
            <input
              type="date"
              value={fechaFiltro}
              onChange={(e) => setFechaFiltro(e.target.value)}
              className="form-input"
              style={{ height: '28px', width: '135px', fontWeight: 700, fontSize: '13px', border: 'none', padding: 0, background: 'transparent' }}
            />
          </div>
        </div>
      </div>

      {/* VISTA A: PANEL DE VIAJES / TICKETS DEL DÍA */}
      {modoVista === 'viajes' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'inline-flex', background: '#f1f5f9', padding: '3px', borderRadius: '8px', border: '1px solid #e2e8f0', gap: '4px' }}>
              <button
                type="button"
                className={`btn btn-sm ${filtroOrigenTicket === 'todos' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setFiltroOrigenTicket('todos')}
                style={{
                  height: '30px',
                  padding: '0 12px',
                  borderRadius: '6px',
                  border: 'none',
                  background: filtroOrigenTicket === 'todos' ? '#ffffff' : 'transparent',
                  color: '#0f172a',
                  fontWeight: 700,
                  fontSize: '12px',
                }}
              >
                Todos ({viajes.length})
              </button>
              <button
                type="button"
                className={`btn btn-sm ${filtroOrigenTicket === 'RUTA' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setFiltroOrigenTicket('RUTA')}
                style={{
                  height: '30px',
                  padding: '0 12px',
                  borderRadius: '6px',
                  border: 'none',
                  background: filtroOrigenTicket === 'RUTA' ? '#ffffff' : 'transparent',
                  color: '#0369a1',
                  fontWeight: 700,
                  fontSize: '12px',
                }}
              >
                <i className="fa-solid fa-route" style={{ marginRight: '4px' }}></i> Ruta / Fincas ({viajes.length})
              </button>
            </div>
          </div>

          {viajesFiltrados.length === 0 ? (
            <div className="content-card" style={{ padding: '48px 20px', textAlign: 'center', color: '#94a3b8' }}>
              <i className="fa-solid fa-truck-moving" style={{ fontSize: '36px', marginBottom: '12px', opacity: 0.5, display: 'block' }}></i>
              <h3 style={{ margin: 0, color: '#334155', fontSize: '16px', fontWeight: 700 }}>
                No hay viajes o tickets registrados para esta fecha
              </h3>
              <p style={{ margin: '6px 0 16px 0', fontSize: '13px' }}>
                Inicia un nuevo viaje para que los conductores registren recolecciones en ruta.
              </p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setModalIniciarViaje(true)}
              >
                <i className="fa-solid fa-plus-circle"></i> Iniciar Primer Viaje
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))', gap: '16px', marginBottom: '24px' }}>
              {viajesFiltrados.map((v) => (
                <div
                  key={v.id}
                  className="content-card"
                  style={{
                    padding: '18px',
                    borderRadius: '12px',
                    borderLeft: `4px solid ${v.estadoProceso === 'CERRADO' ? '#10b981' : '#3b82f6'}`,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <span style={{ fontWeight: 900, fontFamily: 'monospace', color: '#4f46e5', fontSize: '14px' }}>
                        TICKET #{v.codigoTicket || v.id}
                      </span>
                      <span
                        className="badge"
                        style={{
                          background: v.estadoProceso === 'CERRADO' ? '#ecfdf5' : '#eff6ff',
                          color: v.estadoProceso === 'CERRADO' ? '#047857' : '#1d4ed8',
                          fontWeight: 800,
                        }}
                      >
                        {v.estadoProceso}
                      </span>
                    </div>

                    <div style={{ fontSize: '13px', color: '#1e293b', marginBottom: '6px' }}>
                      <i className="fa-solid fa-truck" style={{ color: '#64748b', marginRight: '6px' }}></i>
                      <strong>{v.camionPlaca || `Camión #${v.camionId}`}</strong>
                    </div>

                    <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '12px' }}>
                      <i className="fa-regular fa-user" style={{ marginRight: '6px' }}></i>
                      Chofer: {v.choferNombre || 'Sin asignar'}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: '#f8fafc', borderRadius: '8px', marginBottom: '12px' }}>
                      <div>
                        <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', display: 'block' }}>Recolectado</span>
                        <span style={{ fontSize: '16px', fontWeight: 800, color: '#2563eb' }}>
                          {(v.totalLitrosRecogidos || 0).toLocaleString()} L
                        </span>
                      </div>
                      <div>
                        <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', display: 'block' }}>Entregado</span>
                        <span style={{ fontSize: '16px', fontWeight: 800, color: '#059669' }}>
                          {(v.totalLitrosEntregados || 0).toLocaleString()} L
                        </span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid #f1f5f9', paddingTop: '12px' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setViajeActivoId(v.id);
                        setModalRegistroFinca(true);
                      }}
                      className="btn btn-sm btn-primary"
                      style={{ flex: 1, height: '32px', fontSize: '12px', fontWeight: 700 }}
                    >
                      <i className="fa-solid fa-plus"></i> + Finca
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setViajeActivoId(v.id);
                        setModoVista('fincas');
                      }}
                      className="btn btn-sm btn-outline"
                      style={{ height: '32px', fontSize: '12px', fontWeight: 700 }}
                    >
                      <i className="fa-solid fa-eye"></i> Detalle
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* VISTA B: DETALLE POR FINCAS */}
      {modoVista === 'fincas' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>
              <i className="fa-solid fa-list-check" style={{ color: '#2563eb', marginRight: '8px' }}></i>
              Recolecciones Registradas en Campo ({fechaFiltro})
            </h3>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setModalRegistroFinca(true)}
              style={{ fontWeight: 700 }}
            >
              <i className="fa-solid fa-plus"></i> Registrar Recolección en Finca
            </button>
          </div>

          <DataTable
            data={recolecciones}
            columns={columnsRecolecciones}
            isLoading={loadingRecolecciones}
            searchPlaceholder="Buscar por finca, propietario o ticket..."
            exportFileName="recolecciones_campo"
          />
        </div>
      )}

      {/* MODAL REGISTRAR RECOLECCIÓN EN FINCA */}
      {modalRegistroFinca && (
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
                <i className="fa-solid fa-cow" style={{ color: '#10b981', marginRight: '8px' }}></i>
                Registrar Parada / Recolección en Finca
              </h3>
              <button
                type="button"
                onClick={() => setModalRegistroFinca(false)}
                style={{ background: 'none', border: 'none', fontSize: '18px', color: '#94a3b8', cursor: 'pointer' }}
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!formFinca.fincaId || formFinca.litros <= 0) {
                  toast.error('Selecciona finca y litros válidos');
                  return;
                }
                guardarRecoleccionMutation.mutate(formFinca);
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                    Finca Ganadera * <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 500 }}>(Busca escribiendo)</span>
                  </label>
                  <SearchableSelect
                    options={fincas.map((f) => ({
                      value: f.id,
                      label: f.nombre,
                      subLabel: f.propietarioNombre ? `Ganadero: ${f.propietarioNombre}` : 'Sin propietario',
                    }))}
                    value={formFinca.fincaId || undefined}
                    onChange={(val) => {
                      const fId = Number(val || 0);
                      const matched = fincas.find((f) => f.id === fId);
                      const tipo = hasBufala && (matched?.tipoLeche === 'BUFALA' || matched?.tieneDosTiposLeche)
                        ? (matched.tipoLeche === 'BUFALA' ? 'BUFALA' : 'VACA')
                        : 'VACA';
                      setFormFinca({ ...formFinca, fincaId: fId, tipoLeche: tipo });
                    }}
                    placeholder="-- Seleccionar o buscar finca --"
                    searchPlaceholder="Buscar finca por nombre o propietario..."
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: hasBufala ? '1fr 1fr' : '1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                      Litros Recolectados *
                    </label>
                    <input
                      type="number"
                      value={formFinca.litros || ''}
                      onChange={(e) => setFormFinca({ ...formFinca, litros: Number(e.target.value) })}
                      className="form-input"
                      placeholder="Ej: 850"
                      style={{ width: '100%', height: '38px', fontWeight: 800, color: '#2563eb' }}
                      required
                    />
                  </div>

                  {hasBufala && (
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                        Tipo de Leche
                      </label>
                      <select
                        value={formFinca.tipoLeche}
                        onChange={(e) => setFormFinca({ ...formFinca, tipoLeche: e.target.value })}
                        className="form-input"
                        style={{ width: '100%', height: '38px' }}
                      >
                        <option value="VACA">🥛 Vaca</option>
                        <option value="BUFALA">🐃 Búfala</option>
                      </select>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', background: '#fef2f2', borderRadius: '8px', border: '1px solid #fecaca' }}>
                  <input
                    type="checkbox"
                    id="chkEsAcida"
                    checked={formFinca.esAcida}
                    onChange={(e) => setFormFinca({ ...formFinca, esAcida: e.target.checked })}
                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                  />
                  <label htmlFor="chkEsAcida" style={{ fontSize: '12.5px', fontWeight: 700, color: '#dc2626', cursor: 'pointer', margin: 0 }}>
                    Reportar Incidencia: Leche Ácida / Fuera de Parámetros
                  </label>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                    Observaciones
                  </label>
                  <input
                    type="text"
                    value={formFinca.observacion}
                    onChange={(e) => setFormFinca({ ...formFinca, observacion: e.target.value })}
                    className="form-input"
                    placeholder="Temperatura, estado de vías, etc."
                    style={{ width: '100%', height: '38px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button
                  type="button"
                  onClick={() => setModalRegistroFinca(false)}
                  className="btn btn-outline"
                  style={{ height: '38px' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardarRecoleccionMutation.isPending}
                  className="btn btn-primary"
                  style={{ height: '38px' }}
                >
                  {guardarRecoleccionMutation.isPending ? 'Guardando...' : 'Guardar Recolección'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL INICIAR VIAJE */}
      {modalIniciarViaje && (
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
              maxWidth: '460px',
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
                <i className="fa-solid fa-plus-circle" style={{ color: '#10b981', marginRight: '8px' }}></i>
                Apertura de Nuevo Viaje / Ticket
              </h3>
              <button
                type="button"
                onClick={() => setModalIniciarViaje(false)}
                style={{ background: 'none', border: 'none', fontSize: '18px', color: '#94a3b8', cursor: 'pointer' }}
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!formIniciar.camionId) {
                  toast.error('Selecciona unidad cisterna');
                  return;
                }
                iniciarMutation.mutate(formIniciar);
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                    Unidad Cisterna * <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 500 }}>(Busca escribiendo)</span>
                  </label>
                  <SearchableSelect
                    options={camiones.map((c) => ({
                      value: c.id,
                      label: `${c.placa} - ${c.marca || 'Cisterna'}`,
                      subLabel: c.choferNombre ? `Chofer: ${c.choferNombre}` : `Capacidad: ${c.capacidadLitros} Lts`,
                    }))}
                    value={formIniciar.camionId || undefined}
                    onChange={(val) => setFormIniciar({ ...formIniciar, camionId: Number(val || 0) })}
                    placeholder="-- Seleccionar o buscar camión cisterna --"
                    searchPlaceholder="Buscar por placa o marca..."
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                    Ruta Logística * <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 500 }}>(Ej: Zona Sur, Ruta Norte)</span>
                  </label>
                  <SearchableSelect
                    options={rutasLogistica.map((r) => ({
                      value: r.id,
                      label: r.nombre,
                      subLabel: r.codigo ? `Código: ${r.codigo}` : (r.descripcion || 'Ruta operativa'),
                    }))}
                    value={formIniciar.rutaLogisticaId || undefined}
                    onChange={(val) => setFormIniciar({ ...formIniciar, rutaLogisticaId: Number(val || 0) })}
                    placeholder="-- Seleccionar o buscar ruta logística --"
                    searchPlaceholder="Buscar ruta logística por nombre..."
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
                    placeholder="Ej: 145000"
                    style={{ width: '100%', height: '38px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button
                  type="button"
                  onClick={() => setModalIniciarViaje(false)}
                  className="btn btn-outline"
                  style={{ height: '38px' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={iniciarMutation.isPending}
                  className="btn btn-primary"
                  style={{ height: '38px', background: '#10b981', borderColor: '#10b981' }}
                >
                  {iniciarMutation.isPending ? 'Iniciando...' : 'Iniciar Viaje'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};

export default RecoleccionRutasPage;

