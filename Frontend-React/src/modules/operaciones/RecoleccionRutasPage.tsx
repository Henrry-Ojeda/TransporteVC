import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import apiClient from '@/api/client';
import { operacionesApi } from '@/api/operaciones.api';
import { catalogosApi } from '@/api/catalogos.api';
import { DataTable, type ColumnDef } from '@/components/common/DataTable';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import { CamionSelect, ChoferSelect, CompaniaSelect, TipoLecheSelect, FincaSelect } from '@/components/selectors';
import { confirmDialog } from '@/lib/sweetalert';
import Swal from 'sweetalert2';
import { useAuthStore } from '@/stores/authStore';
import type { ControlRutaDto, FincaDto, CamionDto, CompaniaDto } from '@/types';

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
  observacion?: string;
}

export const RecoleccionRutasPage: React.FC = () => {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);

  const hoyStr = new Date().toISOString().split('T')[0];

  // Modos de vista: 'viajes' (Tarjetas), 'fincas' (Tabla de recolecciones), 'diario' (Monitoreo de camiones)
  const [modoVista, setModoVista] = useState<'viajes' | 'fincas' | 'diario'>('viajes');
  const [fechaFiltro, setFechaFiltro] = useState<string>(hoyStr);
  const [filtroEstadoTicket, setFiltroEstadoTicket] = useState<'activos' | 'todos'>('activos');

  // Estados de Modales
  const [modalIniciarViaje, setModalIniciarViaje] = useState(false);
  const [modalRegistroFinca, setModalRegistroFinca] = useState(false);
  const [modalEditarRecoleccion, setModalEditarRecoleccion] = useState(false);
  const [modalEnviarReceptoria, setModalEnviarReceptoria] = useState(false);
  const [modalEnviarCompania, setModalEnviarCompania] = useState(false);
  const [modalTraspaso, setModalTraspaso] = useState(false);

  // Ticket seleccionado
  const [viajeActivo, setViajeActivo] = useState<ControlRutaDto | null>(null);

  // Formulario Iniciar Viaje
  const [formIniciar, setFormIniciar] = useState({
    fecha: new Date().toISOString().split('T')[0],
    camionId: 0,
    choferId: 0,
    rutaLogisticaId: 0,
    odometroInicialKm: 0,
    observaciones: '',
  });

  // Formulario Registrar Recolección Finca
  const [formFinca, setFormFinca] = useState({
    fincaId: 0,
    litros: 0,
    tipoLeche: 'VACA',
    esAcida: false,
    observacion: '',
  });

  // Formulario Editar Recolección
  const [formEditar, setFormEditar] = useState({
    id: 0,
    fincaId: 0,
    litros: 0,
    tipoLeche: 'VACA',
    esAcida: false,
    observacion: '',
  });

  // Formulario Enviar Receptoría
  const [formReceptoria, setFormReceptoria] = useState({
    observacion: '',
  });

  // Formulario Enviar Compañía Directo
  const [formCompania, setFormCompania] = useState({
    companiaId: 0,
    litros: 0,
    tipoLeche: 'VACA',
    observacion: '',
  });

  // Formulario Traspaso
  const [formTraspaso, setFormTraspaso] = useState({
    ticketDestinoId: 0,
    choferDestinoId: 0,
    litrosTraspaso: 0,
    observacion: '',
  });

  // Queries con auto-actualización reactiva en tiempo real (cada 8s)
  const { data: viajes = [], isLoading: loadingViajes, refetch: refetchViajes } = useQuery<ControlRutaDto[]>({
    queryKey: ['rutas-viajes-hoy', fechaFiltro],
    queryFn: () => operacionesApi.getControles(fechaFiltro),
    refetchInterval: 8000,
  });

  const { data: recolecciones = [], isLoading: loadingRecolecciones, refetch: refetchRecolecciones } = useQuery<RutaDetalleFinca[]>({
    queryKey: ['rutas-fincas-hoy', fechaFiltro],
    queryFn: async () => {
      const res = await apiClient.get<RutaDetalleFinca[]>(`/rutas/hoy?fecha=${fechaFiltro}`).catch(() => ({ data: [] }));
      return Array.isArray(res.data) ? res.data : [];
    },
    refetchInterval: 8000,
  });

  const tiposLecheOptions = useMemo(() => [
    { value: 'VACA', label: '🥛 Leche de Vaca' },
    { value: 'BUFALA', label: '🐃 Leche de Búfala' },
  ], []);

  const { data: camiones = [] } = useQuery<CamionDto[]>({
    queryKey: ['camiones'],
    queryFn: () => catalogosApi.getCamiones(true),
  });

  const { data: fincas = [] } = useQuery<FincaDto[]>({
    queryKey: ['fincas'],
    queryFn: () => catalogosApi.getFincas(true),
  });

  const { data: companias = [] } = useQuery<CompaniaDto[]>({
    queryKey: ['companias'],
    queryFn: () => catalogosApi.getCompanias(true),
  });

  const { data: conductores = [] } = useQuery<any[]>({
    queryKey: ['conductores'],
    queryFn: () => catalogosApi.getChoferes(),
  });

  const { data: rutasLogistica = [] } = useQuery<any[]>({
    queryKey: ['rutas-logistica'],
    queryFn: () => operacionesApi.getRutasLogistica(),
  });

  // MUTACIONES
  const iniciarMutation = useMutation({
    mutationFn: (dto: typeof formIniciar) => operacionesApi.iniciarViaje(dto),
    onSuccess: (data) => {
      Swal.fire({
        icon: 'success',
        title: '¡Viaje Iniciado!',
        text: data.message || 'Viaje iniciado con éxito en el sistema.',
        confirmButtonColor: '#10b981',
      });
      queryClient.invalidateQueries({ queryKey: ['rutas-viajes-hoy'] });
      setModalIniciarViaje(false);
    },
    onError: (err: any) => {
      Swal.fire({
        icon: 'error',
        title: 'Error al Iniciar Viaje',
        text: err.response?.data?.message || 'Error al iniciar viaje',
        confirmButtonColor: '#ef4444',
      });
    },
  });

  const guardarRecoleccionMutation = useMutation({
    mutationFn: async (dto: typeof formFinca) => {
      const payload = {
        fecha: fechaFiltro,
        fincaId: dto.fincaId,
        litros: dto.litros,
        tipoLeche: dto.tipoLeche,
        esAcida: dto.esAcida,
        observacion: dto.observacion,
        controlRutaId: viajeActivo ? viajeActivo.id : undefined,
      };
      const res = await apiClient.post('/rutas', payload);
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Recolección registrada exitosamente');
      queryClient.invalidateQueries({ queryKey: ['rutas-fincas-hoy'] });
      queryClient.invalidateQueries({ queryKey: ['rutas-viajes-hoy'] });
      setModalRegistroFinca(false);
      setFormFinca({ fincaId: 0, litros: 0, tipoLeche: 'VACA', esAcida: false, observacion: '' });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Error al registrar recolección');
    },
  });

  const editarRecoleccionMutation = useMutation({
    mutationFn: (dto: typeof formEditar) =>
      operacionesApi.editarRecoleccion(dto.id, {
        fincaId: dto.fincaId,
        litros: dto.litros,
        tipoLeche: dto.tipoLeche,
        esAcida: dto.esAcida,
        observacion: dto.observacion,
      }),
    onSuccess: (data) => {
      toast.success(data.message || 'Recolección actualizada');
      queryClient.invalidateQueries({ queryKey: ['rutas-fincas-hoy'] });
      queryClient.invalidateQueries({ queryKey: ['rutas-viajes-hoy'] });
      setModalEditarRecoleccion(false);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Error al actualizar recolección');
    },
  });

  const eliminarRecoleccionMutation = useMutation({
    mutationFn: (id: number) => operacionesApi.eliminarRecoleccion(id),
    onSuccess: (data) => {
      toast.success(data.message || 'Recolección eliminada');
      queryClient.invalidateQueries({ queryKey: ['rutas-fincas-hoy'] });
      queryClient.invalidateQueries({ queryKey: ['rutas-viajes-hoy'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Error al eliminar');
    },
  });

  const enviarReceptoriaMutation = useMutation({
    mutationFn: (ticketId: number) => operacionesApi.enviarAReceptoria(ticketId, formReceptoria.observacion),
    onSuccess: (data) => {
      toast.success(data.message || 'Viaje enviado a Receptoría');
      queryClient.invalidateQueries({ queryKey: ['rutas-viajes-hoy'] });
      setModalEnviarReceptoria(false);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Error al enviar a receptoría');
    },
  });

  const enviarCompaniaMutation = useMutation({
    mutationFn: (ticketId: number) =>
      operacionesApi.enviarACompania(ticketId, {
        companiaId: formCompania.companiaId,
        litrosDespachados: formCompania.litros,
        observacion: formCompania.observacion,
        destinos: [
          {
            companiaId: formCompania.companiaId,
            litros: formCompania.litros,
            tipoLeche: formCompania.tipoLeche,
          },
        ],
      }),
    onSuccess: (data) => {
      toast.success(data.message || 'Despacho a Compañía generado con éxito');
      queryClient.invalidateQueries({ queryKey: ['rutas-viajes-hoy'] });
      setModalEnviarCompania(false);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Error al enviar a compañía');
    },
  });

  const traspasoMutation = useMutation({
    mutationFn: (ticketOrigenId: number) =>
      operacionesApi.traspasarLeche(ticketOrigenId, {
        ticketDestinoId: formTraspaso.ticketDestinoId || undefined,
        choferDestinoId: formTraspaso.choferDestinoId || undefined,
        litrosTraspaso: formTraspaso.litrosTraspaso,
        observacion: formTraspaso.observacion,
      }),
    onSuccess: (data: any) => {
      toast.success(data.mensaje || 'Traspaso de leche ejecutado exitosamente');
      queryClient.invalidateQueries({ queryKey: ['rutas-viajes-hoy'] });
      setModalTraspaso(false);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Error al ejecutar traspaso');
    },
  });

  // FILTRO DE VIAJES: Si está en 'activos', oculta los FINALIZADOS / CERRADOS
  const viajesFiltrados = useMemo(() => {
    if (filtroEstadoTicket === 'activos') {
      return viajes.filter(
        (v) =>
          v.estado !== 'FINALIZADO' &&
          v.estado !== 'CERRADO' &&
          v.estadoProceso !== 'CERRADO' &&
          v.procesoActualId !== 4
      );
    }
    return viajes;
  }, [viajes, filtroEstadoTicket]);

  const fincasDisponibles = fincas;

  // COLUMNAS TABLA DE RECOLECCIONES (PUNTO 1: TIPO DE LECHE Y ACCIONES SIEMPRE PRESENTES)
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
      header: 'TICKET / VIAJE',
      sortable: true,
      cell: (row) => (
        <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#4f46e5', fontSize: '13px' }}>
          {row.ticketCodigo || (row.controlRutaId ? `TKT-${row.controlRutaId}` : '-')}
        </span>
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
    {
      header: 'TIPO DE LECHE',
      accessorKey: 'tipoLeche',
      sortable: true,
      cell: (row) => {
        const esBufala = (row.tipoLeche || '').toUpperCase().includes('BUFAL');
        return (
          <span
            className="badge"
            style={{
              background: esBufala ? '#f3e8ff' : '#e0f2fe',
              color: esBufala ? '#7e22ce' : '#0369a1',
              border: `1px solid ${esBufala ? '#d8b4fe' : '#bae6fd'}`,
              fontWeight: 800,
              fontSize: '11px',
              padding: '3px 8px',
              borderRadius: '6px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            {esBufala ? '🐃 BÚFALA' : '🥛 VACA'}
          </span>
        );
      },
    },
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
      header: 'ACCIONES',
      cell: (row) => (
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            type="button"
            className="btn btn-sm btn-outline"
            title="Editar recolección"
            style={{ padding: '4px 8px', borderColor: '#cbd5e1' }}
            onClick={() => {
              setFormEditar({
                id: row.id,
                fincaId: row.fincaId,
                litros: row.litros,
                tipoLeche: (row.tipoLeche || 'VACA').toUpperCase(),
                esAcida: Boolean(row.esAcida),
                observacion: row.observacion || '',
              });
              setModalEditarRecoleccion(true);
            }}
          >
            <i className="fa-solid fa-pen-to-square" style={{ color: '#4f46e5' }}></i>
          </button>
          <button
            type="button"
            className="btn btn-sm btn-outline"
            title="Eliminar recolección"
            style={{ padding: '4px 8px', borderColor: '#fecaca' }}
            onClick={async () => {
              if (
                await confirmDialog({
                  title: '¿Eliminar recolección?',
                  text: `¿Seguro que deseas eliminar la recolección de "${row.fincaNombre}" (${row.litros} Lts)?`,
                  icon: 'warning',
                  confirmButtonText: 'Sí, eliminar',
                  danger: true,
                })
              ) {
                eliminarRecoleccionMutation.mutate(row.id);
              }
            }}
          >
            <i className="fa-solid fa-trash-can" style={{ color: '#dc2626' }}></i>
          </button>
        </div>
      ),
    },
  ];

  return (
    <section id="tab-rutas" className="tab-content active" style={{ display: 'block' }}>
      {/* CABECERA VISTA */}
      <div className="view-header">
        <div>
          <h1 className="view-title">Rutas de Recolección & Operaciones en Campo</h1>
          <p className="view-subtitle">
            Control de recolección de leche en campo, asignación de rutas y despacho a plantas receptoras
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setFormIniciar({
                fecha: new Date().toISOString().split('T')[0],
                camionId: 0,
                choferId: user?.id || 0,
                rutaLogisticaId: 0,
                odometroInicialKm: 0,
                observaciones: '',
              });
              setModalIniciarViaje(true);
            }}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
            Modo de Vista:
          </span>
          <div style={{ display: 'inline-flex', background: '#f1f5f9', padding: '3px', borderRadius: '8px' }}>
            <button
              type="button"
              className={`btn btn-sm ${modoVista === 'viajes' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setModoVista('viajes')}
              style={{
                height: '32px',
                padding: '0 12px',
                borderRadius: '6px',
                fontSize: '12.5px',
                fontWeight: 700,
                background: modoVista === 'viajes' ? '#ffffff' : 'transparent',
                color: modoVista === 'viajes' ? '#1d4ed8' : '#64748b',
                boxShadow: modoVista === 'viajes' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              }}
            >
              <i className="fa-solid fa-truck" style={{ marginRight: '6px' }}></i> Mis Viajes / Tickets ({viajesFiltrados.length})
            </button>
            <button
              type="button"
              className={`btn btn-sm ${modoVista === 'fincas' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setModoVista('fincas')}
              style={{
                height: '32px',
                padding: '0 12px',
                borderRadius: '6px',
                fontSize: '12.5px',
                fontWeight: 700,
                background: modoVista === 'fincas' ? '#ffffff' : 'transparent',
                color: modoVista === 'fincas' ? '#1d4ed8' : '#64748b',
                boxShadow: modoVista === 'fincas' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              }}
            >
              <i className="fa-solid fa-list-check" style={{ marginRight: '6px' }}></i> Detalle por Fincas ({recolecciones.length})
            </button>
            <button
              type="button"
              className={`btn btn-sm ${modoVista === 'diario' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setModoVista('diario')}
              style={{
                height: '32px',
                padding: '0 12px',
                borderRadius: '6px',
                fontSize: '12.5px',
                fontWeight: 700,
                background: modoVista === 'diario' ? '#ffffff' : 'transparent',
                color: modoVista === 'diario' ? '#059669' : '#64748b',
                boxShadow: modoVista === 'diario' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              }}
            >
              <i className="fa-solid fa-satellite-dish" style={{ marginRight: '6px', color: '#10b981' }}></i> Camiones en Ruta (Diario)
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>Fecha de Operación:</label>
          <input
            type="date"
            value={fechaFiltro}
            onChange={(e) => setFechaFiltro(e.target.value)}
            className="form-input"
            style={{ height: '34px', fontSize: '13px', width: '150px' }}
          />
        </div>
      </div>

      {/* VISTA A: TARJETAS DE TICKETS / VIAJES */}
      {modoVista === 'viajes' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', gap: '6px', background: '#e2e8f0', padding: '3px', borderRadius: '8px' }}>
              <button
                type="button"
                onClick={() => setFiltroEstadoTicket('activos')}
                style={{
                  border: 'none',
                  padding: '4px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: filtroEstadoTicket === 'activos' ? '#ffffff' : 'transparent',
                  color: filtroEstadoTicket === 'activos' ? '#1d4ed8' : '#64748b',
                }}
              >
                <i className="fa-solid fa-play" style={{ color: '#10b981', marginRight: '4px' }}></i> En Ruta / Activos ({viajes.filter((v) => v.estado !== 'FINALIZADO' && v.estado !== 'CERRADO' && v.estadoProceso !== 'CERRADO').length})
              </button>
              <button
                type="button"
                onClick={() => setFiltroEstadoTicket('todos')}
                style={{
                  border: 'none',
                  padding: '4px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: filtroEstadoTicket === 'todos' ? '#ffffff' : 'transparent',
                  color: filtroEstadoTicket === 'todos' ? '#1d4ed8' : '#64748b',
                }}
              >
                Todos / Histórico ({viajes.length})
              </button>
            </div>
            <span style={{ fontSize: '12px', color: '#64748b' }}>
              {filtroEstadoTicket === 'activos' ? 'Mostrando únicamente viajes en curso' : 'Mostrando todos los tickets'}
            </span>
          </div>

          {viajesFiltrados.length === 0 ? (
            <div className="content-card" style={{ padding: '48px 20px', textAlign: 'center', color: '#94a3b8' }}>
              <i className="fa-solid fa-truck-moving" style={{ fontSize: '36px', marginBottom: '12px', opacity: 0.5, display: 'block' }}></i>
              <h3 style={{ margin: 0, color: '#334155', fontSize: '16px', fontWeight: 700 }}>
                {filtroEstadoTicket === 'activos' ? 'No hay viajes activos en ruta para esta fecha' : 'No hay tickets registrados'}
              </h3>
              <p style={{ margin: '6px 0 16px 0', fontSize: '13px' }}>
                {filtroEstadoTicket === 'activos'
                  ? 'Todos los viajes de este día ya finalizaron o puedes iniciar un nuevo viaje.'
                  : 'Inicia un nuevo viaje para comenzar las recolecciones.'}
              </p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setModalIniciarViaje(true)}
              >
                <i className="fa-solid fa-plus-circle"></i> Iniciar Nuevo Viaje
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px', marginBottom: '24px' }}>
              {viajesFiltrados.map((v) => {
                const esFinalizado =
                  v.estado === 'FINALIZADO' ||
                  v.estado === 'CERRADO' ||
                  v.estadoProceso === 'CERRADO' ||
                  v.procesoActualId === 4;

                // Cálculo en tiempo real de fincas recolectadas asociadas a este ticket
                const fincasTicket = recolecciones.filter((r) => {
                  const cId = r.controlRutaId || (r as any).ControlRutaId;
                  const tCode = r.ticketCodigo || (r as any).TicketCodigo;
                  return (
                    cId === v.id ||
                    (tCode && (tCode === v.codigoTicket || tCode === `TKT-${v.id}` || tCode === String(v.id)))
                  );
                });
                const sumFincasTicket = fincasTicket.reduce(
                  (acc, f) => acc + Number(f.litros || (f as any).Litros || 0),
                  0
                );
                const ltsRecolectados =
                  v.totalLitrosFinca != null && v.totalLitrosFinca > 0
                    ? v.totalLitrosFinca
                    : sumFincasTicket > 0
                    ? sumFincasTicket
                    : v.totalLitrosRecogidos || 0;

                const ltsEntregados =
                  v.litrosEntregadosCompania != null
                    ? v.litrosEntregadosCompania
                    : v.totalLitrosReceptoria != null
                    ? v.totalLitrosReceptoria
                    : v.totalLitrosEntregados || 0;

                const camionMatch = camiones.find(
                  (c) => c.id === v.camionId || (v.camionPlaca && c.placa === v.camionPlaca)
                );
                const placaTexto = camionMatch
                  ? `${camionMatch.placa} - ${camionMatch.marca || 'Cisterna'}`
                  : v.camionPlaca || (v.camionId ? `Camión #${v.camionId}` : 'Ruta Logística Activa');

                const choferMatch = conductores.find((u) => u.id === v.usuarioId || u.id === v.choferId);
                const choferTexto =
                  v.choferNombre ||
                  v.nombreConductor ||
                  camionMatch?.choferNombre ||
                  choferMatch?.nombreCompleto ||
                  'Sin asignar';

                return (
                  <div
                    key={v.id}
                    className="content-card"
                    style={{
                      padding: '18px',
                      borderRadius: '12px',
                      borderLeft: `4px solid ${esFinalizado ? '#10b981' : '#3b82f6'}`,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      boxShadow: '0 4px 12px rgba(15,23,42,0.04)',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <span style={{ fontWeight: 900, fontFamily: 'monospace', color: '#4f46e5', fontSize: '15px' }}>
                          TICKET #{v.codigoTicket || v.id}
                        </span>
                        <span
                          className="badge"
                          style={{
                            background: esFinalizado ? '#ecfdf5' : '#eff6ff',
                            color: esFinalizado ? '#047857' : '#1d4ed8',
                            border: `1px solid ${esFinalizado ? '#a7f3d0' : '#bfdbfe'}`,
                            fontWeight: 800,
                            fontSize: '11px',
                            textTransform: 'uppercase',
                          }}
                        >
                          {esFinalizado ? 'FINALIZADO' : (v.nombreProceso || v.estado || 'ABIERTO')}
                        </span>
                      </div>

                      <div style={{ fontSize: '13.5px', color: '#0f172a', marginBottom: '6px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <i className="fa-solid fa-truck" style={{ color: '#2563eb' }}></i>
                        <span>{placaTexto}</span>
                      </div>

                      <div style={{ fontSize: '12.5px', color: '#475569', marginBottom: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <i className="fa-regular fa-user" style={{ color: '#64748b' }}></i>
                        <span>Chofer: <strong style={{ color: '#1e293b' }}>{choferTexto}</strong></span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '14px' }}>
                        <div>
                          <span style={{ fontSize: '10.5px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: '2px' }}>Recolectado</span>
                          <span style={{ fontSize: '16px', fontWeight: 800, color: '#2563eb' }}>
                            {ltsRecolectados.toLocaleString()} L
                          </span>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: '10.5px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: '2px' }}>Entregado</span>
                          <span style={{ fontSize: '16px', fontWeight: 800, color: '#059669' }}>
                            {ltsEntregados.toLocaleString()} L
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* BOTONERA DE ACCIONES (PUNTO 3: SI EL TICKET ESTÁ ABIERTO MUESTRA +FINCA, RECEPTORIA, COMPAÑIAS, TRASPASO Y DETALLE) */}
                    <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '12px' }}>
                      {!esFinalizado ? (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginBottom: '6px' }}>
                          <button
                            type="button"
                            onClick={() => {
                              setViajeActivo(v);
                              setModalRegistroFinca(true);
                            }}
                            className="btn btn-sm"
                            style={{
                              background: '#eff6ff',
                              color: '#1d4ed8',
                              border: '1px solid #bfdbfe',
                              fontWeight: 700,
                              fontSize: '11px',
                              padding: '6px 2px',
                              borderRadius: '6px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '4px',
                            }}
                            title="Añadir finca a este ticket"
                          >
                            <i className="fa-solid fa-plus"></i> + Finca
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setViajeActivo(v);
                              setFormReceptoria({ observacion: '' });
                              setModalEnviarReceptoria(true);
                            }}
                            className="btn btn-sm"
                            style={{
                              background: '#f0fdf4',
                              color: '#15803d',
                              border: '1px solid #bbf7d0',
                              fontWeight: 700,
                              fontSize: '11px',
                              padding: '6px 2px',
                              borderRadius: '6px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '4px',
                            }}
                            title="Descargar en receptoría"
                          >
                            <i className="fa-solid fa-scale-balanced"></i> Receptoría
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setViajeActivo(v);
                              setFormCompania({
                                companiaId: 0,
                                litros: ltsRecolectados - ltsEntregados > 0 ? ltsRecolectados - ltsEntregados : ltsRecolectados,
                                tipoLeche: 'VACA',
                                observacion: '',
                              });
                              setModalEnviarCompania(true);
                            }}
                            className="btn btn-sm"
                            style={{
                              background: '#faf5ff',
                              color: '#7e22ce',
                              border: '1px solid #e9d5ff',
                              fontWeight: 700,
                              fontSize: '11px',
                              padding: '6px 2px',
                              borderRadius: '6px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '4px',
                            }}
                            title="Despachar a quesera / compañía"
                          >
                            <i className="fa-solid fa-building-circle-check"></i> Compañías
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setViajeActivo(v);
                              setFormTraspaso({
                                ticketDestinoId: 0,
                                choferDestinoId: 0,
                                litrosTraspaso: ltsRecolectados - ltsEntregados > 0 ? ltsRecolectados - ltsEntregados : 0,
                                observacion: '',
                              });
                              setModalTraspaso(true);
                            }}
                            className="btn btn-sm"
                            style={{
                              background: '#f0fdfa',
                              color: '#0f766e',
                              border: '1px solid #99f6e4',
                              fontWeight: 700,
                              fontSize: '11px',
                              padding: '6px 2px',
                              borderRadius: '6px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '4px',
                            }}
                            title="Traspasar leche a otro chofer"
                          >
                            <i className="fa-solid fa-right-left"></i> Traspaso
                          </button>
                        </div>
                      ) : null}

                      <button
                        type="button"
                        onClick={() => {
                          setViajeActivo(v);
                          setModoVista('fincas');
                        }}
                        className="btn btn-sm btn-outline"
                        style={{ width: '100%', height: '30px', fontSize: '11.5px', fontWeight: 700 }}
                      >
                        <i className="fa-solid fa-eye" style={{ marginRight: '6px' }}></i> Ver Detalle de Recolecciones
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* VISTA B: DETALLE POR FINCAS (PUNTO 1: TABLA CON TIPO DE LECHE Y ACCIONES COMPLETAS) */}
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
              onClick={() => {
                setViajeActivo(viajesFiltrados[0] || null);
                setModalRegistroFinca(true);
              }}
              style={{ fontWeight: 700 }}
            >
              <i className="fa-solid fa-plus"></i> Registrar Recolección en Finca
            </button>
          </div>

          <DataTable
            data={recolecciones}
            columns={columnsRecolecciones}
            isLoading={loadingRecolecciones}
            searchPlaceholder="Buscar por finca, propietario, ticket o leche..."
            exportFileName="recolecciones_campo"
          />
        </div>
      )}

      {/* VISTA C: MONITOREO DE DIARIO DE CAMIONES EN RUTA (PUNTO 4: VISTA DE DIARIO EN VIVO) */}
      {modoVista === 'diario' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10b981', display: 'inline-block', boxShadow: '0 0 8px #10b981' }}></span>
                Panel Diario de Camiones en Ruta — Telemetría en Vivo
              </h3>
              <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                Seguimiento operativo en tiempo real de unidades cisternas, estado de viaje, volumen cargado y reporte de siniestros
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                refetchViajes();
                refetchRecolecciones();
                toast.info('Datos de flota actualizados en vivo');
              }}
              className="btn btn-sm btn-outline"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}
            >
              <i className="fa-solid fa-rotate"></i> Actualizar Ahora
            </button>
          </div>

          {/* TABLA DE CAMIONES DEL DÍA */}
          <div className="content-card" style={{ padding: 0, overflow: 'hidden', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '24px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#475569', fontSize: '11.5px', textTransform: 'uppercase' }}>
                  <th style={{ padding: '12px 16px' }}>Unidad / Cisterna</th>
                  <th style={{ padding: '12px 16px' }}>Conductor en Turno</th>
                  <th style={{ padding: '12px 16px' }}>Ticket Activo</th>
                  <th style={{ padding: '12px 16px' }}>Estado Operativo</th>
                  <th style={{ padding: '12px 16px' }}>Carga a Bordo</th>
                  <th style={{ padding: '12px 16px' }}>Novedad / Siniestro</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center' }}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {viajes.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>
                      No hay camiones operando para la fecha seleccionada ({fechaFiltro})
                    </td>
                  </tr>
                ) : (
                  viajes.map((v) => {
                    const esCerrado = v.estado === 'FINALIZADO' || v.estado === 'CERRADO' || v.estadoProceso === 'CERRADO';
                    const lts = v.totalLitrosFinca != null ? v.totalLitrosFinca : (v.totalLitrosRecogidos || 0);
                    const camionMatch = camiones.find((c) => c.id === v.camionId || c.placa === v.camionPlaca);
                    const capMax = camionMatch?.capacidadLitros || 10000;
                    const pct = Math.min(Math.round((lts / capMax) * 100), 100);

                    // Alertas o siniestros detectados
                    const tieneAcida = recolecciones.some((r) => r.controlRutaId === v.id && r.esAcida);
                    const obsTexto = (v.observacion || '').toLowerCase();
                    const tieneSiniestro = obsTexto.includes('falla') || obsTexto.includes('averia') || obsTexto.includes('siniestro') || obsTexto.includes('choque');

                    return (
                      <tr key={v.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <i className="fa-solid fa-truck-droplet" style={{ color: '#2563eb' }}></i>
                            <span>{v.camionPlaca || `Cisterna #${v.camionId || 'S/N'}`}</span>
                          </div>
                          <span style={{ fontSize: '11px', color: '#64748b' }}>Capacidad: {capMax.toLocaleString()} Lts</span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: 700, color: '#1e293b' }}>{v.choferNombre || v.nombreConductor || 'Sin asignar'}</div>
                          <span style={{ fontSize: '11px', color: '#64748b' }}>Conductor asignado</span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#4f46e5' }}>
                            TKT-{v.codigoTicket || v.id}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span
                            className="badge"
                            style={{
                              background: esCerrado ? '#ecfdf5' : '#eff6ff',
                              color: esCerrado ? '#047857' : '#1d4ed8',
                              border: `1px solid ${esCerrado ? '#a7f3d0' : '#bfdbfe'}`,
                              fontWeight: 800,
                              fontSize: '11px',
                            }}
                          >
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: esCerrado ? '#10b981' : '#3b82f6', marginRight: '6px', display: 'inline-block' }}></span>
                            {esCerrado ? 'FINALIZADO' : (v.nombreProceso || 'EN RUTA')}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', minWidth: '160px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', fontWeight: 700, marginBottom: '4px' }}>
                            <span style={{ color: '#2563eb' }}>{lts.toLocaleString()} Lts</span>
                            <span style={{ color: '#64748b' }}>{pct}%</span>
                          </div>
                          <div style={{ width: '100%', height: '6px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ width: `${pct}%`, height: '100%', background: pct > 90 ? '#ef4444' : '#3b82f6', borderRadius: '4px' }}></div>
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          {tieneSiniestro ? (
                            <span className="badge" style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', fontWeight: 800 }}>
                              <i className="fa-solid fa-triangle-exclamation"></i> Siniestro / Avería
                            </span>
                          ) : tieneAcida ? (
                            <span className="badge" style={{ background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a', fontWeight: 800 }}>
                              <i className="fa-solid fa-flask-vial"></i> Reportó Leche Ácida
                            </span>
                          ) : (
                            <span style={{ fontSize: '12px', color: '#16a34a', fontWeight: 600 }}>
                              <i className="fa-solid fa-circle-check" style={{ marginRight: '4px' }}></i> Normal
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => {
                              setViajeActivo(v);
                              setModoVista('fincas');
                            }}
                            className="btn btn-sm btn-outline"
                            style={{ padding: '4px 8px', fontSize: '11.5px', fontWeight: 700 }}
                          >
                            <i className="fa-solid fa-list-ul"></i> Fincas
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL 1: REGISTRAR RECOLECCIÓN EN FINCA */}
      {modalRegistroFinca && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', padding: '16px' }}>
          <div className="content-card" style={{ width: '100%', maxWidth: '480px', padding: '24px', borderRadius: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '14px', marginBottom: '16px', borderBottom: '1px solid var(--border-color)' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                <i className="fa-solid fa-cow" style={{ color: '#10b981', marginRight: '8px' }}></i>
                Registrar Parada / Recolección en Finca
              </h3>
              <button type="button" onClick={() => setModalRegistroFinca(false)} style={{ background: 'none', border: 'none', fontSize: '18px', color: '#94a3b8', cursor: 'pointer' }}>
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
                {viajeActivo && (
                  <div style={{ padding: '8px 12px', background: '#eff6ff', borderRadius: '8px', border: '1px solid #bfdbfe', fontSize: '12px', color: '#1e40af', fontWeight: 700 }}>
                    Asociado al Ticket #{viajeActivo.codigoTicket || viajeActivo.id} ({viajeActivo.choferNombre || 'Chofer'})
                  </div>
                )}

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                    Finca Ganadera * <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 500 }}>(Busca escribiendo)</span>
                  </label>
                  <FincaSelect
                    value={formFinca.fincaId || undefined}
                    onChange={(val) => {
                      const fId = Number(val || 0);
                      const matched = fincas.find((f) => f.id === fId);
                      const tipo = matched?.tipoLeche === 'BUFALA' ? 'BUFALA' : 'VACA';
                      setFormFinca({ ...formFinca, fincaId: fId, tipoLeche: tipo });
                    }}
                    placeholder="-- Seleccionar o buscar finca --"
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
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

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                      Tipo de Leche *
                    </label>
                    <TipoLecheSelect
                      value={formFinca.tipoLeche}
                      onChange={(val) => setFormFinca({ ...formFinca, tipoLeche: val || 'VACA' })}
                      allowClear={false}
                    />
                  </div>
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
                    Reportar Leche Ácida / Incidencia
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
                <button type="button" onClick={() => setModalRegistroFinca(false)} className="btn btn-outline" style={{ height: '38px' }}>
                  Cancelar
                </button>
                <button type="submit" disabled={guardarRecoleccionMutation.isPending} className="btn btn-primary" style={{ height: '38px' }}>
                  {guardarRecoleccionMutation.isPending ? 'Guardando...' : 'Guardar Recolección'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: EDITAR RECOLECCIÓN (PUNTO 1: PERMITE EDITAR FINCA, LITROS, SI ES ÁCIDA Y TIPO DE LECHE) */}
      {modalEditarRecoleccion && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', padding: '16px' }}>
          <div className="content-card" style={{ width: '100%', maxWidth: '480px', padding: '24px', borderRadius: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '14px', marginBottom: '16px', borderBottom: '1px solid var(--border-color)' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                <i className="fa-solid fa-pen-to-square" style={{ color: '#4f46e5', marginRight: '8px' }}></i>
                Editar Recolección en Finca
              </h3>
              <button type="button" onClick={() => setModalEditarRecoleccion(false)} style={{ background: 'none', border: 'none', fontSize: '18px', color: '#94a3b8', cursor: 'pointer' }}>
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!formEditar.fincaId || formEditar.litros <= 0) {
                  toast.error('Datos inválidos');
                  return;
                }
                editarRecoleccionMutation.mutate(formEditar);
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                    Finca Ganadera *
                  </label>
                  <FincaSelect
                    value={formEditar.fincaId}
                    onChange={(val) => setFormEditar({ ...formEditar, fincaId: Number(val || 0) })}
                    placeholder="-- Seleccionar finca --"
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                      Litros Recolectados *
                    </label>
                    <input
                      type="number"
                      value={formEditar.litros || ''}
                      onChange={(e) => setFormEditar({ ...formEditar, litros: Number(e.target.value) })}
                      className="form-input"
                      style={{ width: '100%', height: '38px', fontWeight: 800, color: '#2563eb' }}
                      required
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                      Tipo de Leche *
                    </label>
                    <TipoLecheSelect
                      value={formEditar.tipoLeche}
                      onChange={(val) => setFormEditar({ ...formEditar, tipoLeche: val || 'VACA' })}
                      allowClear={false}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', background: '#fef2f2', borderRadius: '8px', border: '1px solid #fecaca' }}>
                  <input
                    type="checkbox"
                    id="chkEsAcidaEdit"
                    checked={formEditar.esAcida}
                    onChange={(e) => setFormEditar({ ...formEditar, esAcida: e.target.checked })}
                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                  />
                  <label htmlFor="chkEsAcidaEdit" style={{ fontSize: '12.5px', fontWeight: 700, color: '#dc2626', cursor: 'pointer', margin: 0 }}>
                    Reportar Leche Ácida / Incidencia
                  </label>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                    Observaciones
                  </label>
                  <input
                    type="text"
                    value={formEditar.observacion}
                    onChange={(e) => setFormEditar({ ...formEditar, observacion: e.target.value })}
                    className="form-input"
                    style={{ width: '100%', height: '38px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button type="button" onClick={() => setModalEditarRecoleccion(false)} className="btn btn-outline" style={{ height: '38px' }}>
                  Cancelar
                </button>
                <button type="submit" disabled={editarRecoleccionMutation.isPending} className="btn btn-primary" style={{ height: '38px' }}>
                  {editarRecoleccionMutation.isPending ? 'Actualizando...' : 'Actualizar Recolección'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: ENVIAR A RECEPTORÍA */}
      {modalEnviarReceptoria && viajeActivo && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', padding: '16px' }}>
          <div className="content-card" style={{ width: '100%', maxWidth: '440px', padding: '24px', borderRadius: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '14px', marginBottom: '16px', borderBottom: '1px solid var(--border-color)' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                <i className="fa-solid fa-scale-balanced" style={{ color: '#16a34a', marginRight: '8px' }}></i>
                Enviar Viaje a Receptoría
              </h3>
              <button type="button" onClick={() => setModalEnviarReceptoria(false)} style={{ background: 'none', border: 'none', fontSize: '18px', color: '#94a3b8', cursor: 'pointer' }}>
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <div style={{ padding: '12px', background: '#f0fdf4', borderRadius: '10px', border: '1px solid #bbf7d0', marginBottom: '16px' }}>
              <div style={{ fontSize: '13px', fontWeight: 800, color: '#166534', marginBottom: '4px' }}>
                Ticket #{viajeActivo.codigoTicket || viajeActivo.id} — Chofer: {viajeActivo.choferNombre || 'Chofer'}
              </div>
              <div style={{ fontSize: '12px', color: '#15803d' }}>
                Volumen recolectado en fincas: <strong>{(viajeActivo.totalLitrosFinca || viajeActivo.totalLitrosRecogidos || 0).toLocaleString()} Lts</strong>
              </div>
            </div>

            <p style={{ fontSize: '12.5px', color: '#64748b', marginBottom: '14px' }}>
              Al enviar a receptoría, el viaje pasa a estado <strong>EN RECEPTORÍA</strong> para que el operador de planta realice la medición física en tanques y cuadre de mermas.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                enviarReceptoriaMutation.mutate(viajeActivo.id);
              }}
            >
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                  Nota u Observación de Llegada
                </label>
                <input
                  type="text"
                  value={formReceptoria.observacion}
                  onChange={(e) => setFormReceptoria({ observacion: e.target.value })}
                  placeholder="Ej: Llegada a tiempo, sin novedades en ruta"
                  className="form-input"
                  style={{ width: '100%', height: '38px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setModalEnviarReceptoria(false)} className="btn btn-outline" style={{ height: '38px' }}>
                  Cancelar
                </button>
                <button type="submit" disabled={enviarReceptoriaMutation.isPending} className="btn btn-primary" style={{ height: '38px', background: '#16a34a', borderColor: '#16a34a' }}>
                  {enviarReceptoriaMutation.isPending ? 'Enviando...' : 'Confirmar Envío a Receptoría'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: DESPACHAR A COMPAÑÍAS DIRECTO */}
      {modalEnviarCompania && viajeActivo && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', padding: '16px' }}>
          <div className="content-card" style={{ width: '100%', maxWidth: '480px', padding: '24px', borderRadius: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '14px', marginBottom: '16px', borderBottom: '1px solid var(--border-color)' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                <i className="fa-solid fa-building-circle-check" style={{ color: '#7e22ce', marginRight: '8px' }}></i>
                Despachar Leche Directo a Compañía / Quesera
              </h3>
              <button type="button" onClick={() => setModalEnviarCompania(false)} style={{ background: 'none', border: 'none', fontSize: '18px', color: '#94a3b8', cursor: 'pointer' }}>
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!formCompania.companiaId || formCompania.litros <= 0) {
                  toast.error('Selecciona compañía y volumen válido');
                  return;
                }
                enviarCompaniaMutation.mutate(viajeActivo.id);
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                    Compañía / Quesera Destino *
                  </label>
                  <CompaniaSelect
                    value={formCompania.companiaId || undefined}
                    onChange={(val) => setFormCompania({ ...formCompania, companiaId: Number(val || 0) })}
                    placeholder="-- Seleccionar compañía destino --"
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                      Litros a Despachar *
                    </label>
                    <input
                      type="number"
                      value={formCompania.litros || ''}
                      onChange={(e) => setFormCompania({ ...formCompania, litros: Number(e.target.value) })}
                      className="form-input"
                      style={{ width: '100%', height: '38px', fontWeight: 800, color: '#7e22ce' }}
                      required
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                      Tipo de Leche Despachada
                    </label>
                    <TipoLecheSelect
                      value={formCompania.tipoLeche}
                      onChange={(val) => setFormCompania({ ...formCompania, tipoLeche: val || 'VACA' })}
                      allowClear={false}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                    Observación / Nro Guía SADA
                  </label>
                  <input
                    type="text"
                    value={formCompania.observacion}
                    onChange={(e) => setFormCompania({ ...formCompania, observacion: e.target.value })}
                    className="form-input"
                    placeholder="Ej: Guía de despacho #4029"
                    style={{ width: '100%', height: '38px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button type="button" onClick={() => setModalEnviarCompania(false)} className="btn btn-outline" style={{ height: '38px' }}>
                  Cancelar
                </button>
                <button type="submit" disabled={enviarCompaniaMutation.isPending} className="btn btn-primary" style={{ height: '38px', background: '#7e22ce', borderColor: '#7e22ce' }}>
                  {enviarCompaniaMutation.isPending ? 'Despachando...' : 'Confirmar Despacho a Compañía'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: TRASPASO DE LECHE A OTRO CHOFER / TICKET */}
      {modalTraspaso && viajeActivo && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', padding: '16px' }}>
          <div className="content-card" style={{ width: '100%', maxWidth: '480px', padding: '24px', borderRadius: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '14px', marginBottom: '16px', borderBottom: '1px solid var(--border-color)' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                <i className="fa-solid fa-right-left" style={{ color: '#0d9488', marginRight: '8px' }}></i>
                Traspaso de Leche en Ruta
              </h3>
              <button type="button" onClick={() => setModalTraspaso(false)} style={{ background: 'none', border: 'none', fontSize: '18px', color: '#94a3b8', cursor: 'pointer' }}>
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <div style={{ padding: '10px 12px', background: '#f0fdfa', borderRadius: '10px', border: '1px solid #99f6e4', marginBottom: '14px', fontSize: '12px', color: '#115e59' }}>
              Origen: <strong>Ticket #{viajeActivo.codigoTicket || viajeActivo.id}</strong> ({viajeActivo.choferNombre || 'Chofer'})
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (formTraspaso.litrosTraspaso <= 0) {
                  toast.error('Indica un volumen válido a traspasar');
                  return;
                }
                if (!formTraspaso.ticketDestinoId && !formTraspaso.choferDestinoId) {
                  toast.error('Selecciona el ticket o chofer destino');
                  return;
                }
                traspasoMutation.mutate(viajeActivo.id);
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                    Traspasar al Ticket Activo de otro Chofer
                  </label>
                  <SearchableSelect
                    options={viajes
                      .filter((v) => v.id !== viajeActivo.id && v.estado !== 'FINALIZADO' && v.estado !== 'CERRADO')
                      .map((v) => ({
                        value: v.id,
                        label: `Ticket #${v.codigoTicket || v.id} - ${v.choferNombre || 'Chofer'}`,
                        subLabel: `Cisterna: ${v.camionPlaca || 'S/N'} (${(v.totalLitrosFinca || 0).toLocaleString()} Lts cargados)`,
                      }))}
                    value={formTraspaso.ticketDestinoId || undefined}
                    onChange={(val) => setFormTraspaso({ ...formTraspaso, ticketDestinoId: Number(val || 0) })}
                    placeholder="-- Seleccionar ticket activo destino --"
                    searchPlaceholder="Buscar ticket o chofer..."
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                    Litros a Traspasar *
                  </label>
                  <input
                    type="number"
                    value={formTraspaso.litrosTraspaso || ''}
                    onChange={(e) => setFormTraspaso({ ...formTraspaso, litrosTraspaso: Number(e.target.value) })}
                    className="form-input"
                    style={{ width: '100%', height: '38px', fontWeight: 800, color: '#0d9488' }}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                    Motivo / Observación del Traspaso
                  </label>
                  <input
                    type="text"
                    value={formTraspaso.observacion}
                    onChange={(e) => setFormTraspaso({ ...formTraspaso, observacion: e.target.value })}
                    className="form-input"
                    placeholder="Ej: Falla mecánica, cambio de cisterna en vía"
                    style={{ width: '100%', height: '38px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button type="button" onClick={() => setModalTraspaso(false)} className="btn btn-outline" style={{ height: '38px' }}>
                  Cancelar
                </button>
                <button type="submit" disabled={traspasoMutation.isPending} className="btn btn-primary" style={{ height: '38px', background: '#0d9488', borderColor: '#0d9488' }}>
                  {traspasoMutation.isPending ? 'Traspasando...' : 'Confirmar Traspaso'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 6: INICIAR VIAJE */}
      {modalIniciarViaje && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', padding: '16px' }}>
          <div className="content-card" style={{ width: '100%', maxWidth: '460px', padding: '24px', borderRadius: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '14px', marginBottom: '16px', borderBottom: '1px solid var(--border-color)' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                <i className="fa-solid fa-plus-circle" style={{ color: '#10b981', marginRight: '8px' }}></i>
                Apertura de Nuevo Viaje / Ticket
              </h3>
              <button type="button" onClick={() => setModalIniciarViaje(false)} style={{ background: 'none', border: 'none', fontSize: '18px', color: '#94a3b8', cursor: 'pointer' }}>
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
                    <i className="fa-solid fa-calendar-day" style={{ color: '#10b981', marginRight: '6px' }}></i>
                    Fecha del Viaje / Ticket *
                  </label>
                  <input
                    type="date"
                    value={formIniciar.fecha}
                    onChange={(e) => setFormIniciar({ ...formIniciar, fecha: e.target.value })}
                    className="form-input"
                    style={{ width: '100%', height: '38px', fontWeight: 700, color: '#0f172a' }}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                    Unidad Cisterna * <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 500 }}>(Busca escribiendo)</span>
                  </label>
                  <CamionSelect
                    value={formIniciar.camionId || undefined}
                    onChange={(val, camion) => {
                      const num = Number(val || 0);
                      setFormIniciar((prev) => ({
                        ...prev,
                        camionId: num,
                        choferId: camion?.usuarioId || prev.choferId,
                      }));
                    }}
                    placeholder="-- Seleccionar camión cisterna --"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                    Conductor Asignado
                  </label>
                  <ChoferSelect
                    value={formIniciar.choferId || undefined}
                    onChange={(val) => {
                      const num = Number(val || 0);
                      const camMatch = camiones.find((c) => c.usuarioId === num);
                      setFormIniciar((prev) => ({
                        ...prev,
                        choferId: num,
                        camionId: prev.camionId || camMatch?.id || 0,
                      }));
                    }}
                    placeholder="-- Seleccionar chofer --"
                    allowClear
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                    Ruta Logística (Opcional)
                  </label>
                  <SearchableSelect
                    options={rutasLogistica.map((r) => ({
                      value: r.id,
                      label: r.nombre,
                      subLabel: r.codigo ? `Código: ${r.codigo}` : (r.descripcion || 'Ruta operativa'),
                    }))}
                    value={formIniciar.rutaLogisticaId || undefined}
                    onChange={(val) => setFormIniciar({ ...formIniciar, rutaLogisticaId: Number(val || 0) })}
                    placeholder="-- Seleccionar ruta logística (opcional) --"
                    allowClear
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
                <button type="button" onClick={() => setModalIniciarViaje(false)} className="btn btn-outline" style={{ height: '38px' }}>
                  Cancelar
                </button>
                <button type="submit" disabled={iniciarMutation.isPending} className="btn btn-primary" style={{ height: '38px', background: '#10b981', borderColor: '#10b981' }}>
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
