import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import apiClient from '@/api/client';
import { operacionesApi } from '@/api/operaciones.api';
import { catalogosApi } from '@/api/catalogos.api';
import { DataTable, type ColumnDef } from '@/components/common/DataTable';
import { CamionSelect, ChoferSelect, CompaniaSelect, TipoLecheSelect, FincaSelect } from '@/components/selectors';
import { confirmDialog } from '@/lib/sweetalert';
import Swal from 'sweetalert2';
import { useAuthStore } from '@/stores/authStore';
import type { ControlRutaDto, FincaDto, CamionDto, CompaniaDto, DespachoCompaniaDto } from '@/types';

interface RutaDetalleFinca {
  id: number;
  fecha: string;
  fincaId: number;
  fincaNombre?: string;
  propietarioNombre?: string;
  propietario?: string;
  litros: number;
  tipoLeche: string;
  esAcida?: boolean;
  horaRecoleccion?: string;
  controlRutaId?: number;
  ticketCodigo?: string;
  conductorNombre?: string;
  conductorId?: number;
  observacion?: string;
  createdAt?: string;
  CreatedAt?: string;
  esDiferido?: boolean;
  litrosOriginales?: number;
}

export const RecoleccionRutasPage: React.FC = () => {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);

  const hoyStr = new Date().toISOString().split('T')[0];

  // Modos de vista: 'viajes' (Tarjetas agrupadas), 'fincas' (Detalle y Formulario 1:1), 'diario' (Camiones en Ruta / Telemetría)
  const [modoVista, setModoVista] = useState<'viajes' | 'fincas' | 'diario'>('viajes');
  const [fechaFiltro, setFechaFiltro] = useState<string>(hoyStr);

  // Sub-filtros en vista de Viajes
  const [filtroOrigenTicket, setFiltroOrigenTicket] = useState<'todos' | 'RUTA' | 'RECEPTORIA'>('todos');
  const [filtroEstadoTicket, setFiltroEstadoTicket] = useState<'activos' | 'todos'>('activos');

  // Control de acordeón de fincas en tarjetas de viajes
  const [fincasExpandidas, setFincasExpandidas] = useState<Record<number, boolean>>({});

  // Estados de Modales Operativos
  const [modalIniciarViaje, setModalIniciarViaje] = useState(false);
  const [modalRegistroFinca, setModalRegistroFinca] = useState(false);
  const [modalEditarRecoleccion, setModalEditarRecoleccion] = useState(false);
  const [modalEnviarReceptoria, setModalEnviarReceptoria] = useState(false);
  const [modalEnviarCompania, setModalEnviarCompania] = useState(false);
  const [modalTraspaso, setModalTraspaso] = useState(false);

  // MODAL TIMELAPSE & RECORRIDO EN RUTA (REQUERIMIENTO PRINCIPAL)
  const [modalTimelapse, setModalTimelapse] = useState(false);
  const [viajeTimelapse, setViajeTimelapse] = useState<ControlRutaDto | null>(null);

  // Ticket seleccionado actualmente
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

  // Formulario Captura en "Detalle por Fincas" (1:1 con Carpeta V2_3_11_26)
  const [formFincaDirecta, setFormFincaDirecta] = useState({
    fecha: hoyStr,
    conductorId: user?.id || 0,
    fincaId: 0,
    litros: '' as any,
    tipoLeche: 'VACA',
    esAcida: false,
    esDiferido: false,
    litrosDiferir: '' as any,
    observacion: '',
  });

  // Formulario Modal Registrar Recolección en Finca
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

  // QUERIES REACTIVAS (Auto-actualización cada 8 segundos)
  const { data: viajes = [], isLoading: loadingViajes, refetch: refetchViajes } = useQuery<ControlRutaDto[]>({
    queryKey: ['rutas-viajes-hoy', fechaFiltro],
    queryFn: () => operacionesApi.getControles(fechaFiltro),
    refetchInterval: 8000,
  });

  const { data: despachos = [], isLoading: loadingDespachos, refetch: refetchDespachos } = useQuery<DespachoCompaniaDto[]>({
    queryKey: ['rutas-despachos-hoy', fechaFiltro],
    queryFn: () => operacionesApi.getDespachosCompanias(fechaFiltro),
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

  const guardarRecoleccionDirectaMutation = useMutation({
    mutationFn: async (dto: typeof formFincaDirecta) => {
      const payload: any = {
        fecha: dto.fecha || fechaFiltro,
        fincaId: Number(dto.fincaId),
        litros: Number(dto.litros),
        tipoLeche: dto.tipoLeche,
        esAcida: dto.esAcida,
        observacion: dto.observacion,
        conductorId: dto.conductorId || (user?.id ? Number(user.id) : undefined),
        controlRutaId: viajeActivo ? viajeActivo.id : undefined,
      };

      const res = await apiClient.post('/rutas', payload);
      const nuevaRutaId = res.data?.id;

      // Si tiene diferimiento de litros activado (Regla 4)
      if (dto.esDiferido && Number(dto.litrosDiferir) > 0 && nuevaRutaId) {
        await operacionesApi.diferirLitros(nuevaRutaId, {
          litrosDiferir: Number(dto.litrosDiferir),
          motivo: 'Diferimiento automático desde formulario de recolección',
        }).catch(console.error);
      }

      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Recolección registrada exitosamente');
      queryClient.invalidateQueries({ queryKey: ['rutas-fincas-hoy'] });
      queryClient.invalidateQueries({ queryKey: ['rutas-viajes-hoy'] });
      setFormFincaDirecta((prev) => ({
        ...prev,
        fincaId: 0,
        litros: '' as any,
        tipoLeche: 'VACA',
        esAcida: false,
        esDiferido: false,
        litrosDiferir: '' as any,
        observacion: '',
      }));
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Error al registrar recolección');
    },
  });

  const guardarRecoleccionModalMutation = useMutation({
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

  // FILTRO COMBINADO DE VIAJES / TICKETS
  const viajesFiltrados = useMemo(() => {
    let list = viajes;
    if (filtroEstadoTicket === 'activos') {
      list = list.filter(
        (v) =>
          v.estado !== 'FINALIZADO' &&
          v.estado !== 'CERRADO' &&
          v.estadoProceso !== 'CERRADO' &&
          v.procesoActualId !== 4
      );
    }
    return list;
  }, [viajes, filtroEstadoTicket]);

  // COMBINACIÓN NORMALIZADA DE ENTRADAS (RUTAS) Y SALIDAS (RECEPTORÍA) - IDÉNTICO A CARPETA
  const ticketsCombinados = useMemo(() => {
    const normRutas = viajesFiltrados.map((v) => ({
      ...v,
      _tipoTicket: 'RUTA' as const,
      _origenBadge: 'RUTA',
      _origenColor: '#0284c7',
      _origenBg: '#e0f2fe',
      _origenBorder: '#bae6fd',
      _origenIcon: 'fa-route',
      _litrosRecogidos: v.totalLitrosFinca || v.totalLitrosRecogidos || 0,
      _litrosEntregados: v.litrosEntregadosCompania || v.totalLitrosReceptoria || v.totalLitrosEntregados || 0,
      _conductor: v.choferNombre || v.nombreConductor || 'Sin asignar',
    }));

    const normDespachos = despachos.map((d) => ({
      id: d.id,
      codigoTicket: String(d.id),
      fecha: d.fecha,
      camionPlaca: d.camionPlaca,
      camionId: d.camionId,
      observacion: d.observaciones || d.observacion,
      estado: d.estado,
      _tipoTicket: 'RECEPTORIA' as const,
      _origenBadge: 'RECEPTORÍA',
      _origenColor: '#9333ea',
      _origenBg: '#f3e8ff',
      _origenBorder: '#e9d5ff',
      _origenIcon: 'fa-building-wheat',
      _litrosRecogidos: d.litrosDespachados || 0,
      _litrosEntregados: d.litrosRecibidosCompania || d.litrosConfirmados || 0,
      _conductor: d.choferNombre || d.nombreConductor || 'Chofer Asignado',
      nombreCompania: d.nombreCompania || d.companiaNombre,
    }));

    if (filtroOrigenTicket === 'RUTA') return normRutas;
    if (filtroOrigenTicket === 'RECEPTORIA') return normDespachos;
    return [...normRutas, ...normDespachos];
  }, [viajesFiltrados, despachos, filtroOrigenTicket]);

  // CÁLCULO DE TOTALES PARA DETALLE POR FINCAS
  const totalesRecoleccion = useMemo(() => {
    let vaca = 0;
    let bufala = 0;
    let acida = 0;
    recolecciones.forEach((r) => {
      const lts = Number(r.litros || 0);
      const esBuf = (r.tipoLeche || '').toUpperCase().includes('BUFAL');
      if (esBuf) bufala += lts;
      else vaca += lts;
      if (r.esAcida) acida += lts;
    });
    return { vaca, bufala, acida, total: vaca + bufala };
  }, [recolecciones]);

  // TOGGLE DE ACORDEÓN EN TARJETAS
  const toggleAcordeonFincas = (ticketId: number) => {
    setFincasExpandidas((prev) => ({
      ...prev,
      [ticketId]: !prev[ticketId],
    }));
  };

  // ABRIR MODAL DE TIMELAPSE PARA UN CAMIÓN ESPECÍFICO
  const abrirTimelapse = (viaje: ControlRutaDto) => {
    setViajeTimelapse(viaje);
    setModalTimelapse(true);
  };

  // DATOS CALCULADOS PARA EL TIMELAPSE
  const timelapseData = useMemo(() => {
    if (!viajeTimelapse) return null;

    // Fincas ya recolectadas para este viaje
    const visitadas = recolecciones
      .filter((r) => {
        const cId = r.controlRutaId;
        const tCode = r.ticketCodigo;
        return (
          cId === viajeTimelapse.id ||
          (tCode && (tCode === viajeTimelapse.codigoTicket || tCode === `TKT-${viajeTimelapse.id}` || tCode === String(viajeTimelapse.id)))
        );
      })
      .sort((a, b) => {
        const timeA = a.createdAt || (a as any).CreatedAt || a.fecha;
        const timeB = b.createdAt || (b as any).CreatedAt || b.fecha;
        return new Date(timeA).getTime() - new Date(timeB).getTime() || a.id - b.id;
      });

    // Fincas que le hacen falta (SI TIENE RUTA LOGÍSTICA ASIGNADA)
    let pendientes: FincaDto[] = [];
    const tieneRuta = Boolean(viajeTimelapse.rutaLogisticaId && viajeTimelapse.rutaLogisticaId > 0);

    if (tieneRuta) {
      const idsVisitadas = new Set(visitadas.map((v) => Number(v.fincaId)));
      pendientes = fincas.filter(
        (f) => Number(f.rutaId) === Number(viajeTimelapse.rutaLogisticaId) && f.activo && !idsVisitadas.has(f.id)
      );
    }
    // SI NO TIENE RUTA: pendientes permanece vacío (Regla solicitada por el usuario: el chofer las añade manualmente)

    // Litros cargados y capacidad
    const sumLts = visitadas.reduce((acc, f) => acc + Number(f.litros || 0), 0);
    const camionMatch = camiones.find((c) => c.id === viajeTimelapse.camionId || c.placa === viajeTimelapse.camionPlaca);
    const capMax = camionMatch?.capacidadLitros || viajeTimelapse.capacidadCamionLitros || 10000;
    const pctLlenado = Math.min(Math.round((sumLts / capMax) * 100), 100);

    // Cálculos de tiempos entre paradas
    let duracionTotalMin = 0;
    if (visitadas.length >= 2) {
      const first = new Date(visitadas[0].createdAt || (visitadas[0] as any).CreatedAt || visitadas[0].fecha).getTime();
      const last = new Date(visitadas[visitadas.length - 1].createdAt || (visitadas[visitadas.length - 1] as any).CreatedAt || visitadas[visitadas.length - 1].fecha).getTime();
      if (!isNaN(first) && !isNaN(last) && last >= first) {
        duracionTotalMin = Math.round((last - first) / 60000);
      }
    }
    const promedioMinPorParada = visitadas.length > 1 && duracionTotalMin > 0
      ? Math.round(duracionTotalMin / (visitadas.length - 1))
      : 25; // Promedio estándar si no hay suficientes timestamps

    return {
      visitadas,
      pendientes,
      tieneRuta,
      sumLts,
      capMax,
      pctLlenado,
      camionMatch,
      duracionTotalMin,
      promedioMinPorParada,
    };
  }, [viajeTimelapse, recolecciones, fincas, camiones]);

  // COLUMNAS TABLA DE RECOLECCIONES (REGLA 2: DATATABLE OBLIGATORIA)
  const columnsRecolecciones: ColumnDef<RutaDetalleFinca>[] = [
    {
      header: 'HORA / REGISTRO',
      accessorKey: 'fecha',
      sortable: true,
      cell: (row) => {
        const timeStamp = row.createdAt || (row as any).CreatedAt;
        const horaStr = timeStamp
          ? new Date(timeStamp).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })
          : row.horaRecoleccion || 'En campo';
        return (
          <div>
            <span style={{ fontWeight: 800, color: '#0f172a', fontSize: '12.5px' }}>
              {row.fecha ? new Date(row.fecha).toLocaleDateString('es-VE') : '-'}
            </span>
            <span style={{ fontSize: '11px', color: '#2563eb', display: 'flex', alignItems: 'center', gap: '3px', fontWeight: 700, marginTop: '2px' }}>
              <i className="fa-regular fa-clock" style={{ fontSize: '10px' }}></i> {horaStr}
            </span>
          </div>
        );
      },
    },
    {
      header: 'TICKET / VIAJE',
      sortable: true,
      cell: (row) => (
        <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#4f46e5', fontSize: '13px' }}>
          {row.ticketCodigo || (row.controlRutaId ? `#${row.controlRutaId}` : 'Directo')}
        </span>
      ),
    },
    {
      header: 'CONDUCTOR',
      accessorKey: 'conductorNombre',
      sortable: true,
      cell: (row) => (
        <div style={{ fontSize: '12.5px', color: '#334155', fontWeight: 700 }}>
          <i className="fa-regular fa-user" style={{ color: '#64748b', marginRight: '5px' }}></i>
          {row.conductorNombre || 'Sin asignar'}
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
          {(row.propietarioNombre || row.propietario) && (
            <span style={{ fontSize: '11.5px', color: '#64748b' }}>{row.propietarioNombre || row.propietario}</span>
          )}
        </div>
      ),
    },
    {
      header: 'LITROS RECOGIDOS',
      accessorKey: 'litros',
      sortable: true,
      cell: (row) => (
        <div>
          <span style={{ fontWeight: 800, color: '#2563eb', fontSize: '14px' }}>
            {(row.litros || 0).toLocaleString()} <small>Lts</small>
          </span>
          {row.esDiferido && (
            <span className="badge" style={{ display: 'block', background: '#fff7ed', color: '#c2410c', border: '1px solid #fed7aa', fontSize: '10px', marginTop: '2px' }}>
              <i className="fa-solid fa-clock-rotate-left"></i> Diferido
            </span>
          )}
        </div>
      ),
    },
    {
      header: 'TIPO DE LECHE',
      accessorKey: 'tipoLeche',
      sortable: true,
      cell: (row) => {
        const esBufala = (row.tipoLeche || '').toUpperCase().includes('BUFAL');
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <span
              className="badge"
              style={{
                background: esBufala ? '#f3e8ff' : '#e0f2fe',
                color: esBufala ? '#7e22ce' : '#0369a1',
                border: `1px solid ${esBufala ? '#d8b4fe' : '#bae6fd'}`,
                fontWeight: 800,
                fontSize: '11px',
                padding: '2px 8px',
                borderRadius: '6px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                width: 'fit-content',
              }}
            >
              {esBufala ? '🐃 BÚFALA' : '🥛 VACA'}
            </span>
            {row.esAcida && (
              <span className="badge" style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', fontWeight: 800, fontSize: '10px', width: 'fit-content' }}>
                <i className="fa-solid fa-flask" style={{ marginRight: '3px' }}></i> ÁCIDA
              </span>
            )}
          </div>
        );
      },
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
      <div className="view-header" style={{ marginBottom: '16px' }}>
        <div>
          <h1 className="view-title" style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
            Rutas de Recolección & Operaciones en Campo
          </h1>
          <p className="view-subtitle" style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0 0' }}>
            Control de recolección de leche en campo, monitoreo en vivo de cisternas y despacho a receptoría
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

      {/* BARRA DE CONTROL DE VISTAS (PILLS 1:1 CON CARPETA V2_3_11_26) */}
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
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginRight: '4px' }}>
            <i className="fa-solid fa-layer-group" style={{ color: '#4f46e5', marginRight: '4px' }}></i>
            Modo de Vista:
          </span>
          <div style={{ display: 'inline-flex', background: '#f1f5f9', padding: '3px', borderRadius: '10px', border: '1px solid #e2e8f0', gap: '4px' }}>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => setModoVista('viajes')}
              style={{
                height: '34px',
                padding: '0 14px',
                borderRadius: '7px',
                border: 'none',
                fontSize: '12.5px',
                fontWeight: modoVista === 'viajes' ? 800 : 600,
                background: modoVista === 'viajes' ? '#ffffff' : 'transparent',
                color: modoVista === 'viajes' ? '#1e293b' : '#64748b',
                boxShadow: modoVista === 'viajes' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
              }}
            >
              <i className="fa-solid fa-truck-moving" style={{ color: modoVista === 'viajes' ? '#2563eb' : '#64748b' }}></i>
              Mis Viajes / Tickets
              <span
                className="badge"
                style={{
                  background: modoVista === 'viajes' ? '#eff6ff' : '#e2e8f0',
                  color: modoVista === 'viajes' ? '#1d4ed8' : '#475569',
                  fontSize: '11px',
                  padding: '2px 7px',
                  borderRadius: '10px',
                  fontWeight: 800,
                }}
              >
                {viajesFiltrados.length}
              </span>
            </button>

            <button
              type="button"
              className="btn btn-sm"
              onClick={() => setModoVista('fincas')}
              style={{
                height: '34px',
                padding: '0 14px',
                borderRadius: '7px',
                border: 'none',
                fontSize: '12.5px',
                fontWeight: modoVista === 'fincas' ? 800 : 600,
                background: modoVista === 'fincas' ? '#ffffff' : 'transparent',
                color: modoVista === 'fincas' ? '#1e293b' : '#64748b',
                boxShadow: modoVista === 'fincas' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
              }}
            >
              <i className="fa-solid fa-list-check" style={{ color: modoVista === 'fincas' ? '#2563eb' : '#64748b' }}></i>
              Detalle por Fincas
              <span
                className="badge"
                style={{
                  background: modoVista === 'fincas' ? '#eff6ff' : '#e2e8f0',
                  color: modoVista === 'fincas' ? '#1d4ed8' : '#475569',
                  fontSize: '11px',
                  padding: '2px 7px',
                  borderRadius: '10px',
                  fontWeight: 800,
                }}
              >
                {recolecciones.length}
              </span>
            </button>

            <button
              type="button"
              className="btn btn-sm"
              onClick={() => setModoVista('diario')}
              style={{
                height: '34px',
                padding: '0 14px',
                borderRadius: '7px',
                border: 'none',
                fontSize: '12.5px',
                fontWeight: modoVista === 'diario' ? 800 : 600,
                background: modoVista === 'diario' ? '#ffffff' : 'transparent',
                color: modoVista === 'diario' ? '#059669' : '#64748b',
                boxShadow: modoVista === 'diario' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
              }}
            >
              <i className="fa-solid fa-satellite-dish" style={{ color: modoVista === 'diario' ? '#10b981' : '#64748b' }}></i>
              Camiones en Ruta (Diario)
              <span
                className="badge"
                style={{
                  background: modoVista === 'diario' ? '#ecfdf5' : '#e2e8f0',
                  color: modoVista === 'diario' ? '#047857' : '#475569',
                  fontSize: '11px',
                  padding: '2px 7px',
                  borderRadius: '10px',
                  fontWeight: 800,
                }}
              >
                {viajes.length}
              </span>
            </button>
          </div>
        </div>

        {/* SELECTOR DE FECHA GLOBAL DE OPERACIÓN */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#ffffff', padding: '4px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
          <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <i className="fa-regular fa-calendar-days" style={{ color: '#2563eb' }}></i>
            Fecha:
          </label>
          <input
            type="date"
            value={fechaFiltro}
            onChange={(e) => setFechaFiltro(e.target.value)}
            className="form-input"
            style={{ height: '30px', fontSize: '13px', width: '140px', border: 'none', fontWeight: 800, color: '#0f172a', background: 'transparent' }}
          />
        </div>
      </div>

      {/* ========================================================================= */}
      {/* VISTA A: PANEL DE VIAJES / TICKETS DEL DÍA (1:1 CON CARPETA V2_3_11_26)  */}
      {/* ========================================================================= */}
      {modoVista === 'viajes' && (
        <div style={{ marginBottom: '24px' }}>
          {/* BARRA DE FILTRO POR ORIGEN (TODOS / RUTA / RECEPTORÍA) */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', gap: '6px', background: '#e2e8f0', padding: '3px', borderRadius: '8px' }}>
              <button
                type="button"
                onClick={() => setFiltroOrigenTicket('todos')}
                style={{
                  border: 'none',
                  padding: '4px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: filtroOrigenTicket === 'todos' ? '#ffffff' : 'transparent',
                  color: filtroOrigenTicket === 'todos' ? '#0f172a' : '#64748b',
                  boxShadow: filtroOrigenTicket === 'todos' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                }}
              >
                Todos ({ticketsCombinados.length})
              </button>
              <button
                type="button"
                onClick={() => setFiltroOrigenTicket('RUTA')}
                style={{
                  border: 'none',
                  padding: '4px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: filtroOrigenTicket === 'RUTA' ? '#ffffff' : 'transparent',
                  color: filtroOrigenTicket === 'RUTA' ? '#0369a1' : '#64748b',
                  boxShadow: filtroOrigenTicket === 'RUTA' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
              >
                <i className="fa-solid fa-route" style={{ color: '#0284c7' }}></i>
                Ruta / Fincas ({viajesFiltrados.length})
              </button>
              <button
                type="button"
                onClick={() => setFiltroOrigenTicket('RECEPTORIA')}
                style={{
                  border: 'none',
                  padding: '4px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: filtroOrigenTicket === 'RECEPTORIA' ? '#ffffff' : 'transparent',
                  color: filtroOrigenTicket === 'RECEPTORIA' ? '#7e22ce' : '#64748b',
                  boxShadow: filtroOrigenTicket === 'RECEPTORIA' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
              >
                <i className="fa-solid fa-building-wheat" style={{ color: '#9333ea' }}></i>
                Receptoría / Salidas ({despachos.length})
              </button>
            </div>

            <div style={{ display: 'flex', gap: '6px', background: '#f1f5f9', padding: '3px', borderRadius: '8px' }}>
              <button
                type="button"
                onClick={() => setFiltroEstadoTicket('activos')}
                style={{
                  border: 'none',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '11.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: filtroEstadoTicket === 'activos' ? '#ffffff' : 'transparent',
                  color: filtroEstadoTicket === 'activos' ? '#1d4ed8' : '#64748b',
                }}
              >
                <i className="fa-solid fa-play" style={{ color: '#10b981', marginRight: '4px' }}></i> Solo Activos
              </button>
              <button
                type="button"
                onClick={() => setFiltroEstadoTicket('todos')}
                style={{
                  border: 'none',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '11.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: filtroEstadoTicket === 'todos' ? '#ffffff' : 'transparent',
                  color: filtroEstadoTicket === 'todos' ? '#1d4ed8' : '#64748b',
                }}
              >
                Ver Histórico Completo
              </button>
            </div>
          </div>

          {/* GRID DE TARJETAS DE TICKETS */}
          {ticketsCombinados.length === 0 ? (
            <div className="content-card" style={{ padding: '48px 20px', textAlign: 'center', color: '#94a3b8' }}>
              <i className="fa-solid fa-truck-moving" style={{ fontSize: '38px', color: '#0284c7', marginBottom: '12px', display: 'block' }}></i>
              <h4 style={{ color: '#1e293b', fontSize: '16px', margin: '0 0 6px 0', fontWeight: 700 }}>
                No hay viajes registrados para esta fecha ({fechaFiltro})
              </h4>
              <p style={{ color: '#64748b', fontSize: '13px', margin: '0 0 16px 0' }}>
                Inicia un nuevo viaje de recolección para comenzar a registrar cargas en fincas.
              </p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setModalIniciarViaje(true)}
                style={{
                  fontWeight: 700,
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  border: 'none',
                  padding: '8px 18px',
                  borderRadius: '8px',
                }}
              >
                <i className="fa-solid fa-plus-circle"></i> Iniciar Nuevo Viaje / Ticket
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))', gap: '16px' }}>
              {ticketsCombinados.map((item: any) => {
                const esRuta = item._tipoTicket === 'RUTA';
                const esFinalizado =
                  item.estado === 'FINALIZADO' ||
                  item.estado === 'CERRADO' ||
                  item.estadoProceso === 'CERRADO' ||
                  item.procesoActualId === 4;

                const fincasTicket = esRuta
                  ? recolecciones.filter((r) => r.controlRutaId === item.id || r.ticketCodigo === item.codigoTicket || r.ticketCodigo === String(item.id))
                  : [];

                const sumFincasLts = fincasTicket.reduce((acc, f) => acc + Number(f.litros || 0), 0);
                const ltsRecolectados = item._litrosRecogidos > 0 ? item._litrosRecogidos : sumFincasLts;
                const ltsEntregados = item._litrosEntregados || 0;
                const tieneEntrega = !esRuta || (ltsEntregados > 0 && !esFinalizado);
                const mermaLitros = ltsRecolectados > 0 && ltsEntregados > 0 ? (ltsRecolectados - ltsEntregados) : 0;
                const estaExpandido = Boolean(fincasExpandidas[item.id]);

                const camionMatch = camiones.find((c) => c.id === item.camionId || c.placa === item.camionPlaca);
                const placaTexto = camionMatch
                  ? `${camionMatch.placa} - ${camionMatch.marca || 'Cisterna'}`
                  : item.camionPlaca || (item.camionId ? `Cisterna #${item.camionId}` : 'Cisterna en Turno');

                return (
                  <div
                    key={`${item._tipoTicket}_${item.id}`}
                    className="card-ticket-viaje"
                    style={{
                      background: '#ffffff',
                      border: '1.5px solid #e2e8f0',
                      borderTop: `4px solid ${item._origenColor}`,
                      borderRadius: '12px',
                      boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                    }}
                  >
                    {/* CABECERA DE TARJETA */}
                    <div>
                      <div
                        style={{
                          background: '#f8fafc',
                          borderBottom: '1px solid #e2e8f0',
                          padding: '12px 16px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: '8px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '15px', fontWeight: 800, color: '#1e293b' }}>
                            <i className="fa-solid fa-ticket" style={{ color: item._origenColor }}></i> Ticket #{item.codigoTicket || item.id}
                          </span>
                          <span
                            className="badge"
                            style={{
                              background: item._origenBg,
                              color: item._origenColor,
                              border: `1px solid ${item._origenBorder}`,
                              fontWeight: 800,
                              fontSize: '10.5px',
                              padding: '2px 8px',
                              borderRadius: '6px',
                            }}
                          >
                            <i className={`fa-solid ${item._origenIcon}`}></i> {item._origenBadge}
                          </span>
                        </div>

                        <span
                          className="badge"
                          style={{
                            background: esFinalizado ? '#ecfdf5' : '#eff6ff',
                            color: esFinalizado ? '#047857' : '#1d4ed8',
                            border: `1px solid ${esFinalizado ? '#a7f3d0' : '#bfdbfe'}`,
                            fontWeight: 800,
                            fontSize: '11px',
                          }}
                        >
                          {esFinalizado ? 'FINALIZADO' : (item.nombreProceso || item.estado || '1: EN RUTA')}
                        </span>
                      </div>

                      {/* CUERPO DE TARJETA */}
                      <div style={{ padding: '16px' }}>
                        <div style={{ marginBottom: '10px' }}>
                          <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: '2px' }}>
                            {esRuta ? 'Conductor Responsable:' : 'Conductor Asignado:'}
                          </span>
                          <span style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <i className="fa-solid fa-user-tie" style={{ color: item._origenColor }}></i>
                            {item._conductor}
                          </span>
                          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <i className="fa-solid fa-truck" style={{ color: '#64748b' }}></i>
                            <span>{placaTexto}</span>
                          </div>
                          {!esRuta && item.nombreCompania && (
                            <div style={{ fontSize: '12px', color: '#7e22ce', marginTop: '4px', fontWeight: 700 }}>
                              <i className="fa-solid fa-building-wheat" style={{ marginRight: '4px' }}></i>
                              Destino: {item.nombreCompania}
                            </div>
                          )}
                        </div>

                        {/* BADGE DE CIRCUITO / MODO LIBRE */}
                        {esRuta && (
                          <div style={{ marginBottom: '12px' }}>
                            {item.rutaLogisticaNombre || item.rutaNombre ? (
                              <span
                                className="badge"
                                style={{
                                  background: '#faf5ff',
                                  color: '#7e22ce',
                                  border: '1px solid #e9d5ff',
                                  fontWeight: 700,
                                  fontSize: '11px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                  padding: '2px 8px',
                                  borderRadius: '6px',
                                }}
                              >
                                <i className="fa-solid fa-route"></i>
                                Ruta: {item.rutaLogisticaNombre || item.rutaNombre}
                              </span>
                            ) : (
                              <span
                                className="badge"
                                style={{
                                  background: '#f8fafc',
                                  color: '#64748b',
                                  border: '1px solid #e2e8f0',
                                  fontWeight: 600,
                                  fontSize: '11px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                  padding: '2px 8px',
                                  borderRadius: '6px',
                                }}
                              >
                                <i className="fa-solid fa-location-dot"></i>
                                Sin Ruta (Modo Libre)
                              </span>
                            )}
                          </div>
                        )}

                        {/* GRID MÉTRICAS DE LITROS */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                          <div style={{ background: '#f8fafc', padding: '9px 11px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, display: 'block' }}>
                              {esRuta ? 'Leche en Camión:' : 'Litros Despachados:'}
                            </span>
                            <strong style={{ fontSize: '16.5px', color: '#0284c7', fontWeight: 800 }}>
                              {ltsRecolectados.toLocaleString('es-VE')} Lts
                            </strong>
                            {esRuta && (
                              <small style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>
                                ({fincasTicket.length} fincas registradas)
                              </small>
                            )}
                          </div>

                          <div
                            style={{
                              background: ltsEntregados > 0 ? '#f0fdf4' : '#fffbeb',
                              padding: '9px 11px',
                              borderRadius: '8px',
                              border: `1px solid ${ltsEntregados > 0 ? '#bbf7d0' : '#fef3c7'}`,
                            }}
                          >
                            <span style={{ fontSize: '11px', color: ltsEntregados > 0 ? '#15803d' : '#b45309', fontWeight: 600, display: 'block' }}>
                              {esRuta ? 'Litros Recibidos:' : 'Litros en Planta:'}
                            </span>
                            <strong style={{ fontSize: '16.5px', color: ltsEntregados > 0 ? '#16a34a' : '#d97706', fontWeight: 800 }}>
                              {ltsEntregados > 0 ? `${ltsEntregados.toLocaleString('es-VE')} Lts` : 'En Tránsito'}
                            </strong>
                            <small style={{ fontSize: '11px', color: ltsEntregados > 0 ? '#15803d' : '#b45309', display: 'block' }}>
                              {ltsEntregados > 0 ? 'En Receptoría' : 'Pendiente pesaje'}
                            </small>
                          </div>
                        </div>

                        {/* BANNER DE TRASPASO SI APLICA */}
                        {item.observacion && item.observacion.toLowerCase().includes('traspaso') && (
                          <div style={{ background: '#f0fdfa', border: '1px solid #5eead4', borderRadius: '8px', padding: '6px 10px', marginBottom: '10px', fontSize: '11.5px', color: '#0f766e', fontWeight: 700 }}>
                            <i className="fa-solid fa-right-left" style={{ marginRight: '6px' }}></i>
                            {item.observacion}
                          </div>
                        )}

                        {/* CAJA DE MERMA / DIFERENCIA SI YA HUBO ENTREGA */}
                        {ltsEntregados > 0 && (
                          <div style={{ background: mermaLitros > 0 ? '#fef2f2' : '#f0fdf4', border: `1px solid ${mermaLitros > 0 ? '#fecaca' : '#bbf7d0'}`, borderRadius: '8px', padding: '7px 11px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <span style={{ fontSize: '11px', fontWeight: 700, color: mermaLitros > 0 ? '#991b1b' : '#166534', textTransform: 'uppercase' }}>
                                {mermaLitros > 0 ? '⚠️ Merma Registrada:' : '✅ Entrega Exacta:'}
                              </span>
                            </div>
                            <strong style={{ fontSize: '14px', fontWeight: 800, color: mermaLitros > 0 ? '#dc2626' : '#16a34a' }}>
                              {mermaLitros > 0 ? `-${mermaLitros.toLocaleString()} Lts` : '0 Lts'}
                            </strong>
                          </div>
                        )}

                        {/* DESPLEGABLE DE FINCAS DE ESTE VIAJE (1:1 CON CARPETA) */}
                        {esRuta && (
                          <div style={{ marginBottom: '12px' }}>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline"
                              onClick={() => toggleAcordeonFincas(item.id)}
                              style={{
                                width: '100%',
                                borderColor: '#cbd5e1',
                                background: '#ffffff',
                                color: '#334155',
                                fontWeight: 700,
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '7px 12px',
                                borderRadius: '6px',
                                fontSize: '12px',
                              }}
                            >
                              <span>
                                <i className="fa-solid fa-list-ul" style={{ color: '#2563eb', marginRight: '6px' }}></i>
                                Ver Fincas de este Viaje ({fincasTicket.length})
                              </span>
                              <i className={`fa-solid fa-chevron-${estaExpandido ? 'up' : 'down'}`} style={{ color: '#94a3b8' }}></i>
                            </button>

                            {estaExpandido && (
                              <div style={{ marginTop: '8px', maxHeight: '200px', overflowY: 'auto', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px' }}>
                                {fincasTicket.length === 0 ? (
                                  <div style={{ fontSize: '12px', color: '#94a3b8', textAlign: 'center', padding: '10px' }}>
                                    No hay fincas registradas aún en este ticket.
                                  </div>
                                ) : (
                                  fincasTicket.map((f, idx) => {
                                    const esBufala = (f.tipoLeche || '').toUpperCase().includes('BUFAL');
                                    return (
                                      <div
                                        key={f.id}
                                        style={{
                                          display: 'flex',
                                          justifyContent: 'space-between',
                                          alignItems: 'center',
                                          padding: '6px 8px',
                                          borderBottom: idx < fincasTicket.length - 1 ? '1px solid #e2e8f0' : 'none',
                                          fontSize: '12px',
                                        }}
                                      >
                                        <div>
                                          <strong style={{ color: '#0f172a' }}>#{idx + 1} • {f.fincaNombre || `Finca #${f.fincaId}`}</strong>
                                          <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>{f.propietarioNombre || f.propietario}</span>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                          <span style={{ fontWeight: 800, color: '#2563eb', fontSize: '12.5px' }}>{f.litros.toLocaleString()} L</span>
                                          <span className="badge" style={{ display: 'block', fontSize: '9.5px', background: esBufala ? '#f3e8ff' : '#eff6ff', color: esBufala ? '#7e22ce' : '#1d4ed8', padding: '1px 4px', marginTop: '2px' }}>
                                            {esBufala ? 'BÚFALA' : 'VACA'}
                                          </span>
                                        </div>
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* BOTONERA INFERIOR DE ACCIONES */}
                    <div style={{ borderTop: '1px solid #f1f5f9', padding: '12px 16px', background: '#ffffff' }}>
                      {esRuta && !esFinalizado ? (
                        <>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginBottom: '8px' }}>
                            <button
                              type="button"
                              onClick={() => {
                                setViajeActivo(item);
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
                              title="Añadir parada / finca a este ticket"
                            >
                              <i className="fa-solid fa-plus"></i> + Finca
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setViajeActivo(item);
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
                                setViajeActivo(item);
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
                              <i className="fa-solid fa-building"></i> Compañías
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setViajeActivo(item);
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

                          <button
                            type="button"
                            onClick={() => {
                              setViajeActivo(item);
                              setFormFincaDirecta((prev) => ({
                                ...prev,
                                conductorId: item.usuarioId || item.choferId || user?.id || 0,
                              }));
                              setModoVista('fincas');
                            }}
                            className="btn btn-sm btn-outline"
                            style={{
                              width: '100%',
                              borderColor: '#cbd5e1',
                              background: '#ffffff',
                              color: '#1e293b',
                              fontWeight: 700,
                              padding: '8px 12px',
                              fontSize: '12px',
                              borderRadius: '6px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px',
                            }}
                          >
                            <i className="fa-solid fa-pen-to-square" style={{ color: '#2563eb' }}></i>
                            Ver y Capturar Fincas de este Viaje ({fincasTicket.length})
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            if (esRuta) abrirTimelapse(item);
                            else toast.info('Despacho de salida a compañía');
                          }}
                          className="btn btn-sm btn-outline"
                          style={{ width: '100%', height: '32px', fontSize: '12px', fontWeight: 700 }}
                        >
                          <i className="fa-solid fa-clock-rotate-left" style={{ marginRight: '6px', color: '#2563eb' }}></i>
                          Ver Timelapse y Trazabilidad
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* VISTA B: DETALLE POR FINCAS (DISEÑO 1:1 CON CARPETA V2_3_11_26)          */}
      {/* ========================================================================= */}
      {modoVista === 'fincas' && (
        <div>
          {/* CARD 1: FORMULARIO DE CAPTURA RÁPIDA SUPERIOR (1:1 CON CARPETA) */}
          <div className="content-card" style={{ padding: 0, overflow: 'visible', marginBottom: '24px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <div
              style={{
                background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
                color: '#ffffff',
                padding: '12px 18px',
                borderRadius: '12px 12px 0 0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '8px',
              }}
            >
              <span style={{ fontWeight: 800, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fa-solid fa-truck-ramp-box"></i> REGISTRAR RECOLECCIÓN EN RUTA
              </span>
              <span className="badge" style={{ background: 'rgba(255,255,255,0.2)', color: '#ffffff', fontSize: '11px', fontWeight: 800, border: 'none' }}>
                ROL: {(user?.rol || 'ADMIN').toUpperCase()}
              </span>
            </div>

            {/* BANNER MODO ASOCIAR A TICKET ACTIVO */}
            <div
              style={{
                background: viajeActivo ? '#eff6ff' : '#f8fafc',
                borderBottom: '1.5px solid #bfdbfe',
                padding: '10px 18px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '8px',
              }}
            >
              {viajeActivo ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span className="badge" style={{ background: '#2563eb', color: '#fff', fontWeight: 800, fontSize: '12px', padding: '4px 8px', borderRadius: '6px' }}>
                    <i className="fa-solid fa-ticket"></i> TICKET ACTIVO #{viajeActivo.codigoTicket || viajeActivo.id}
                  </span>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#1e3a8a' }}>
                    Asociando fincas a este viaje ({viajeActivo.choferNombre || viajeActivo.nombreConductor || 'Chofer'} - {viajeActivo.camionPlaca || 'Cisterna'})
                  </span>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="fa-solid fa-circle-info" style={{ color: '#2563eb' }}></i>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>
                    Seleccione un ticket activo del desplegable o registre recolección directa en campo.
                  </span>
                </div>
              )}

              {/* SELECTOR PARA ALTERNAR TICKET ACTIVO O DESVINCULAR */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {viajesFiltrados.length > 0 && (
                  <select
                    className="form-input"
                    value={viajeActivo?.id || ''}
                    onChange={(e) => {
                      const id = Number(e.target.value);
                      const match = viajes.find((v) => v.id === id);
                      setViajeActivo(match || null);
                      if (match) {
                        setFormFincaDirecta((prev) => ({
                          ...prev,
                          conductorId: match.usuarioId || match.choferId || prev.conductorId,
                        }));
                      }
                    }}
                    style={{ height: '32px', fontSize: '12px', fontWeight: 700, maxWidth: '240px' }}
                  >
                    <option value="">-- Cambiar Ticket Activo --</option>
                    {viajesFiltrados.map((v) => (
                      <option key={v.id} value={v.id}>
                        Ticket #{v.codigoTicket || v.id} - {v.choferNombre || v.nombreConductor}
                      </option>
                    ))}
                  </select>
                )}

                {viajeActivo && (
                  <button
                    type="button"
                    className="btn btn-sm btn-outline"
                    onClick={() => setViajeActivo(null)}
                    style={{ background: '#fff', borderColor: '#cbd5e1', color: '#64748b', fontSize: '11.5px', padding: '3px 10px', borderRadius: '6px', fontWeight: 700 }}
                  >
                    <i className="fa-solid fa-xmark"></i> Desvincular Ticket
                  </button>
                )}
              </div>
            </div>

            {/* FORMULARIO DE RECOLECCIÓN EN CAMPO */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!formFincaDirecta.fincaId || Number(formFincaDirecta.fincaId) <= 0) {
                  toast.error('Debe seleccionar una finca ganadera');
                  return;
                }
                if (!formFincaDirecta.litros || Number(formFincaDirecta.litros) <= 0) {
                  toast.error('Ingrese una cantidad válida de litros');
                  return;
                }
                guardarRecoleccionDirectaMutation.mutate(formFincaDirecta);
              }}
              style={{ padding: '18px' }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '14px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '12px', color: '#64748b', fontWeight: 700, marginBottom: '4px', display: 'block' }}>
                    Fecha *
                  </label>
                  <input
                    type="date"
                    value={formFincaDirecta.fecha}
                    onChange={(e) => setFormFincaDirecta({ ...formFincaDirecta, fecha: e.target.value })}
                    className="form-input"
                    required
                    style={{ height: '38px', fontWeight: 700 }}
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '12px', color: '#64748b', fontWeight: 700, marginBottom: '4px', display: 'block' }}>
                    Conductor *
                  </label>
                  <ChoferSelect
                    value={formFincaDirecta.conductorId}
                    onChange={(id) => setFormFincaDirecta({ ...formFincaDirecta, conductorId: id })}
                    required
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '12px', color: '#64748b', fontWeight: 700, marginBottom: '4px', display: 'block' }}>
                    Finca / Ganadero *
                  </label>
                  <FincaSelect
                    value={formFincaDirecta.fincaId}
                    onChange={(id) => {
                      const fincaMatch = fincas.find((f) => f.id === id);
                      const esBuf = (fincaMatch?.tipoLeche || '').toUpperCase().includes('BUFAL');
                      setFormFincaDirecta({
                        ...formFincaDirecta,
                        fincaId: id,
                        tipoLeche: esBuf ? 'BUFALA' : 'VACA',
                      });
                    }}
                    rutaLogisticaId={viajeActivo?.rutaLogisticaId}
                    required
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '12px', color: '#64748b', fontWeight: 700, marginBottom: '4px', display: 'block' }}>
                    Litros Recogidos *
                  </label>
                  <input
                    type="number"
                    value={formFincaDirecta.litros}
                    onChange={(e) => setFormFincaDirecta({ ...formFincaDirecta, litros: e.target.value })}
                    className="form-input"
                    placeholder="Ej: 550"
                    min="1"
                    step="1"
                    required
                    style={{ height: '38px', fontWeight: 800, fontSize: '15px', color: '#16a34a', background: '#f0fdf4', border: '1.5px solid #86efac' }}
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '12px', color: '#2563eb', fontWeight: 700, marginBottom: '4px', display: 'block' }}>
                    <i className="fa-solid fa-cow"></i> Tipo Leche *
                  </label>
                  <select
                    value={formFincaDirecta.tipoLeche}
                    onChange={(e) => setFormFincaDirecta({ ...formFincaDirecta, tipoLeche: e.target.value })}
                    className="form-input"
                    style={{ height: '38px', fontWeight: 800, fontSize: '13px', color: '#1e293b', background: '#eff6ff', border: '1.5px solid #93c5fd' }}
                  >
                    <option value="VACA">🥛 VACA</option>
                    <option value="BUFALA">🐃 BÚFALA</option>
                  </select>
                </div>

                <div className="form-group" style={{ margin: 0, display: 'flex', alignItems: 'flex-end' }}>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      cursor: 'pointer',
                      color: '#b45309',
                      fontSize: '12.5px',
                      fontWeight: 700,
                      height: '38px',
                      padding: '0 12px',
                      background: '#fffbeb',
                      border: '1.5px solid #fde68a',
                      borderRadius: '8px',
                      width: '100%',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={formFincaDirecta.esAcida}
                      onChange={(e) => setFormFincaDirecta({ ...formFincaDirecta, esAcida: e.target.checked })}
                      style={{ width: '18px', height: '18px', accentColor: '#d97706' }}
                    />
                    <span><i className="fa-solid fa-flask" style={{ color: '#d97706' }}></i> ¿Leche Ácida?</span>
                  </label>
                </div>

                {/* REGLA 4: DIFERIMIENTO DE LITROS */}
                <div className="form-group" style={{ margin: 0, display: 'flex', alignItems: 'flex-end' }}>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      cursor: 'pointer',
                      color: '#c2410c',
                      fontSize: '12.5px',
                      fontWeight: 700,
                      height: '38px',
                      padding: '0 12px',
                      background: '#fff7ed',
                      border: '1.5px solid #fed7aa',
                      borderRadius: '8px',
                      width: '100%',
                    }}
                    title="Dividir recolección para que parte entre en el cierre y el resto en la siguiente semana operativa"
                  >
                    <input
                      type="checkbox"
                      checked={formFincaDirecta.esDiferido}
                      onChange={(e) => setFormFincaDirecta({ ...formFincaDirecta, esDiferido: e.target.checked })}
                      style={{ width: '18px', height: '18px', accentColor: '#ea580c' }}
                    />
                    <span><i className="fa-solid fa-clock-rotate-left" style={{ color: '#ea580c' }}></i> ¿Diferir Litros?</span>
                  </label>
                </div>

                {formFincaDirecta.esDiferido && (
                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: '12px', color: '#ea580c', fontWeight: 700, marginBottom: '4px', display: 'block' }}>
                      <i className="fa-solid fa-share"></i> Litros a Diferir (Sig. Sem.) *
                    </label>
                    <input
                      type="number"
                      value={formFincaDirecta.litrosDiferir}
                      onChange={(e) => setFormFincaDirecta({ ...formFincaDirecta, litrosDiferir: e.target.value })}
                      className="form-input"
                      placeholder="Ej: 100"
                      min="1"
                      step="1"
                      required={formFincaDirecta.esDiferido}
                      style={{ height: '38px', fontWeight: 800, fontSize: '14px', color: '#c2410c', background: '#fff7ed', border: '1.5px solid #fdba74' }}
                    />
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '240px' }}>
                  <label style={{ fontSize: '12px', color: '#64748b', fontWeight: 700, marginBottom: '4px', display: 'block' }}>
                    Observación (opcional)
                  </label>
                  <input
                    type="text"
                    value={formFincaDirecta.observacion}
                    onChange={(e) => setFormFincaDirecta({ ...formFincaDirecta, observacion: e.target.value })}
                    className="form-input"
                    placeholder="Detalles de la recolección, temperatura o notas de campo..."
                    style={{ height: '38px' }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={guardarRecoleccionDirectaMutation.isPending}
                  className="btn btn-primary"
                  style={{
                    height: '38px',
                    padding: '0 24px',
                    fontWeight: 800,
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    border: 'none',
                    boxShadow: '0 4px 12px rgba(16,185,129,0.3)',
                    color: '#ffffff',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  {guardarRecoleccionDirectaMutation.isPending ? (
                    <>
                      <i className="fa-solid fa-spinner fa-spin"></i> Guardando...
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-plus-circle"></i> Guardar Recolección
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* CARD 2: TABLA OFICIAL CON DATATABLE (REGLA 2) */}
          <div className="content-card" style={{ padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="fa-solid fa-table-list" style={{ color: '#2563eb' }}></i>
                  RECOLECCIONES REGISTRADAS EN CAMPO ({fechaFiltro})
                </h3>
                <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                  Bitácora de paradas registradas por conductores y administradores
                </p>
              </div>

              {/* RESUMEN DE TOTALES EN TIEMPO REAL */}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <span className="badge" style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: '4px 10px', fontSize: '12px', fontWeight: 800 }}>
                  🥛 Vaca: {totalesRecoleccion.vaca.toLocaleString()} L
                </span>
                <span className="badge" style={{ background: '#faf5ff', color: '#7e22ce', border: '1px solid #e9d5ff', padding: '4px 10px', fontSize: '12px', fontWeight: 800 }}>
                  🐃 Búfala: {totalesRecoleccion.bufala.toLocaleString()} L
                </span>
                <span className="badge" style={{ background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0', padding: '4px 10px', fontSize: '12px', fontWeight: 900 }}>
                  Total: {totalesRecoleccion.total.toLocaleString()} Lts
                </span>
              </div>
            </div>

            <DataTable
              data={recolecciones}
              columns={columnsRecolecciones}
              isLoading={loadingRecolecciones}
              searchPlaceholder="Buscar por finca, productor, ticket o conductor..."
              exportFileName={`recolecciones_campo_${fechaFiltro}`}
            />
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VISTA C: CAMIONES EN RUTA (DIARIO) + TIMELAPSE (REQUERIMIENTO PRINCIPAL)  */}
      {/* ========================================================================= */}
      {modoVista === 'diario' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10b981', display: 'inline-block', boxShadow: '0 0 8px #10b981' }}></span>
                Panel Diario de Camiones en Ruta — Telemetría & Tiempos en Vivo
              </h3>
              <p style={{ margin: '4px 0 0 0', fontSize: '12.5px', color: '#64748b' }}>
                Monitoreo en tiempo real de unidades cisternas. Haz clic en "Timelapse & Recorrido" para auditar las horas y paradas de cada chofer.
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

          {/* TABLA DE CAMIONES EN RUTA */}
          <div className="content-card" style={{ padding: 0, overflow: 'hidden', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '24px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#475569', fontSize: '11.5px', textTransform: 'uppercase' }}>
                  <th style={{ padding: '12px 16px' }}>Unidad / Cisterna</th>
                  <th style={{ padding: '12px 16px' }}>Conductor en Turno</th>
                  <th style={{ padding: '12px 16px' }}>Ticket Activo</th>
                  <th style={{ padding: '12px 16px' }}>Circuito / Modo</th>
                  <th style={{ padding: '12px 16px' }}>Estado Operativo</th>
                  <th style={{ padding: '12px 16px' }}>Carga a Bordo</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center' }}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {viajes.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '36px', textAlign: 'center', color: '#94a3b8' }}>
                      <i className="fa-solid fa-truck" style={{ fontSize: '32px', marginBottom: '8px', display: 'block', opacity: 0.5 }}></i>
                      No hay camiones operando para la fecha seleccionada ({fechaFiltro})
                    </td>
                  </tr>
                ) : (
                  viajes.map((v) => {
                    const esCerrado = v.estado === 'FINALIZADO' || v.estado === 'CERRADO' || v.estadoProceso === 'CERRADO';
                    const fincasDeEste = recolecciones.filter((r) => r.controlRutaId === v.id || r.ticketCodigo === v.codigoTicket || r.ticketCodigo === String(v.id));
                    const lts = fincasDeEste.reduce((acc, f) => acc + Number(f.litros || 0), 0) || (v.totalLitrosFinca || v.totalLitrosRecogidos || 0);
                    const camionMatch = camiones.find((c) => c.id === v.camionId || c.placa === v.camionPlaca);
                    const capMax = camionMatch?.capacidadLitros || v.capacidadCamionLitros || 10000;
                    const pct = Math.min(Math.round((lts / capMax) * 100), 100);

                    return (
                      <tr key={v.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <i className="fa-solid fa-truck-droplet" style={{ color: '#2563eb' }}></i>
                            <span>{v.camionPlaca || camionMatch?.placa || `Cisterna #${v.camionId || 'S/N'}`}</span>
                          </div>
                          <span style={{ fontSize: '11px', color: '#64748b' }}>Capacidad: {capMax.toLocaleString()} Lts</span>
                        </td>

                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: 700, color: '#1e293b' }}>
                            {v.choferNombre || v.nombreConductor || 'Sin asignar'}
                          </div>
                          <span style={{ fontSize: '11px', color: '#64748b' }}>Conductor asignado</span>
                        </td>

                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#4f46e5' }}>
                            TKT-#{v.codigoTicket || v.id}
                          </span>
                        </td>

                        <td style={{ padding: '12px 16px' }}>
                          {v.rutaLogisticaNombre || v.rutaNombre ? (
                            <span className="badge" style={{ background: '#faf5ff', color: '#7e22ce', border: '1px solid #e9d5ff', fontWeight: 700, fontSize: '11px' }}>
                              <i className="fa-solid fa-route" style={{ marginRight: '4px' }}></i>
                              {v.rutaLogisticaNombre || v.rutaNombre}
                            </span>
                          ) : (
                            <span className="badge" style={{ background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0', fontWeight: 600, fontSize: '11px' }}>
                              <i className="fa-solid fa-location-dot" style={{ marginRight: '4px' }}></i>
                              Modo Libre
                            </span>
                          )}
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

                        <td style={{ padding: '12px 16px', minWidth: '150px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', fontWeight: 700, marginBottom: '4px' }}>
                            <span style={{ color: '#2563eb' }}>{lts.toLocaleString()} Lts</span>
                            <span style={{ color: '#64748b' }}>{pct}%</span>
                          </div>
                          <div style={{ width: '100%', height: '6px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ width: `${pct}%`, height: '100%', background: pct > 90 ? '#ef4444' : '#3b82f6', borderRadius: '4px' }}></div>
                          </div>
                        </td>

                        {/* ACCIONES: TIMELAPSE INTERACTIVO */}
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => abrirTimelapse(v)}
                            className="btn btn-sm"
                            style={{
                              background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                              color: '#ffffff',
                              fontWeight: 700,
                              borderRadius: '6px',
                              padding: '6px 12px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              border: 'none',
                              boxShadow: '0 2px 6px rgba(2,132,199,0.25)',
                              cursor: 'pointer',
                              fontSize: '12px',
                            }}
                            title="Auditar recorrido, paradas y tiempos del chofer"
                          >
                            <i className="fa-solid fa-clock-rotate-left"></i>
                            Timelapse & Recorrido
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

      {/* ========================================================================= */}
      {/* MODAL TIMELAPSE & RECORRIDO (REQUERIMIENTO PRINCIPAL DEL USUARIO)         */}
      {/* ========================================================================= */}
      {modalTimelapse && viajeTimelapse && timelapseData && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(5px)',
            padding: '16px',
          }}
        >
          <div
            className="content-card"
            style={{
              width: '100%',
              maxWidth: '850px',
              maxHeight: '92vh',
              overflowY: 'auto',
              borderRadius: '16px',
              padding: 0,
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
              border: 'none',
              background: '#ffffff',
            }}
          >
            {/* CABECERA OSCURA MODERNA */}
            <div
              style={{
                background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                color: '#ffffff',
                padding: '20px 24px',
                borderRadius: '16px 16px 0 0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                  <span
                    className="badge"
                    style={{
                      background: 'rgba(56, 189, 248, 0.15)',
                      color: '#38bdf8',
                      border: '1px solid rgba(56, 189, 248, 0.4)',
                      fontWeight: 800,
                      fontSize: '11px',
                    }}
                  >
                    <i className="fa-solid fa-satellite-dish"></i> TELEMETRÍA EN VIVO
                  </span>
                  <span style={{ fontSize: '13px', color: '#94a3b8' }}>
                    Fecha: <strong style={{ color: '#fff' }}>{viajeTimelapse.fecha ? viajeTimelapse.fecha.split('T')[0] : fechaFiltro}</strong>
                  </span>
                </div>

                <h2 style={{ margin: 0, fontSize: '19px', fontWeight: 800, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="fa-solid fa-clock-rotate-left" style={{ color: '#38bdf8' }}></i>
                  Timelapse Operativo: Chofer {viajeTimelapse.choferNombre || viajeTimelapse.nombreConductor || 'Alvaro'}
                </h2>

                <div style={{ marginTop: '6px', fontSize: '13px', color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  <span>
                    <i className="fa-solid fa-truck" style={{ color: '#94a3b8', marginRight: '4px' }}></i>
                    Cisterna: <strong>{viajeTimelapse.camionPlaca || timelapseData.camionMatch?.placa || `#${viajeTimelapse.camionId}`}</strong>
                  </span>
                  <span>
                    <i className="fa-solid fa-ticket" style={{ color: '#94a3b8', marginRight: '4px' }}></i>
                    Ticket: <strong>#{viajeTimelapse.codigoTicket || viajeTimelapse.id}</strong>
                  </span>
                  {timelapseData.tieneRuta ? (
                    <span className="badge" style={{ background: '#faf5ff', color: '#7e22ce', border: '1px solid #e9d5ff', fontWeight: 800 }}>
                      <i className="fa-solid fa-route" style={{ marginRight: '4px' }}></i>
                      Ruta Asignada: {viajeTimelapse.rutaLogisticaNombre || viajeTimelapse.rutaNombre}
                    </span>
                  ) : (
                    <span className="badge" style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', fontWeight: 700 }}>
                      <i className="fa-solid fa-location-dot" style={{ marginRight: '4px' }}></i>
                      Modo Libre (Sin Circuito Predeterminado)
                    </span>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setModalTimelapse(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '20px', cursor: 'pointer', padding: '4px' }}
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            {/* BARRA DE KPIS DEL TIMELAPSE */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                gap: '12px',
                padding: '16px 24px',
                background: '#f8fafc',
                borderBottom: '1px solid #e2e8f0',
              }}
            >
              <div style={{ background: '#ffffff', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', display: 'block' }}>
                  Lts Recolectados
                </span>
                <span style={{ fontSize: '18px', fontWeight: 900, color: '#2563eb' }}>
                  {timelapseData.sumLts.toLocaleString()} L
                </span>
                <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>
                  Capacidad: {timelapseData.pctLlenado}%
                </span>
              </div>

              <div style={{ background: '#ffffff', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', display: 'block' }}>
                  Paradas Realizadas
                </span>
                <span style={{ fontSize: '18px', fontWeight: 900, color: '#16a34a' }}>
                  {timelapseData.visitadas.length} Fincas
                </span>
                <span style={{ fontSize: '11px', color: '#16a34a', display: 'block', fontWeight: 700 }}>
                  <i className="fa-solid fa-circle-check"></i> Cargas medidas
                </span>
              </div>

              <div style={{ background: '#ffffff', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', display: 'block' }}>
                  Paradas Pendientes
                </span>
                <span style={{ fontSize: '18px', fontWeight: 900, color: timelapseData.tieneRuta ? '#d97706' : '#64748b' }}>
                  {timelapseData.tieneRuta ? `${timelapseData.pendientes.length} Faltantes` : 'Modo Libre'}
                </span>
                <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>
                  {timelapseData.tieneRuta ? 'En este circuito' : 'Carga manual libre'}
                </span>
              </div>

              <div style={{ background: '#ffffff', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', display: 'block' }}>
                  Ritmo Operativo
                </span>
                <span style={{ fontSize: '18px', fontWeight: 900, color: '#7e22ce' }}>
                  ~{timelapseData.promedioMinPorParada} min
                </span>
                <span style={{ fontSize: '11px', color: '#7e22ce', display: 'block', fontWeight: 700 }}>
                  Promedio por parada
                </span>
              </div>
            </div>

            {/* CUERPO DEL TIMELAPSE: STEPPER CRONOLÓGICO */}
            <div style={{ padding: '24px' }}>
              <h4 style={{ margin: '0 0 18px 0', fontSize: '14px', fontWeight: 800, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                <i className="fa-solid fa-timeline" style={{ color: '#2563eb', marginRight: '6px' }}></i>
                Secuencia Cronológica de Recorrido & Medición de Litros
              </h4>

              <div style={{ position: 'relative', paddingLeft: '32px' }}>
                {/* LÍNEA VERTICAL CONECTORA */}
                <div
                  style={{
                    position: 'absolute',
                    top: '12px',
                    bottom: '12px',
                    left: '11px',
                    width: '3px',
                    background: 'linear-gradient(to bottom, #10b981 0%, #10b981 60%, #cbd5e1 100%)',
                    borderRadius: '2px',
                  }}
                ></div>

                {/* HITO 0: SALIDA DE TURNO / INICIO */}
                <div style={{ position: 'relative', marginBottom: '24px' }}>
                  <div
                    style={{
                      position: 'absolute',
                      left: '-32px',
                      top: '0px',
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      background: '#10b981',
                      border: '3px solid #ffffff',
                      boxShadow: '0 0 0 2px #10b981',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#ffffff',
                      fontSize: '11px',
                    }}
                  >
                    <i className="fa-solid fa-flag-checkered"></i>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: '#10b981', textTransform: 'uppercase' }}>
                      Punto de Partida
                    </span>
                    <h5 style={{ margin: '2px 0', fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>
                      Inicio de Recolección en Ruta
                    </h5>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>
                      Ticket aperturado para la unidad cisterna
                    </span>
                  </div>
                </div>

                {/* LISTA DE FINCAS YA RECOLECTADAS (CON HORAS Y TIEMPOS CALCULADOS) */}
                {timelapseData.visitadas.map((f, idx) => {
                  const esBufala = (f.tipoLeche || '').toUpperCase().includes('BUFAL');
                  const timeStamp = f.createdAt || (f as any).CreatedAt;
                  const horaStr = timeStamp
                    ? new Date(timeStamp).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })
                    : f.horaRecoleccion || `Parada ${idx + 1}`;

                  // Cálculo de tiempo transcurrido respecto a la parada previa
                  let deltaTexto = 'Inicio de recolección';
                  if (idx > 0) {
                    const prevStamp = timelapseData.visitadas[idx - 1].createdAt || (timelapseData.visitadas[idx - 1] as any).CreatedAt;
                    if (timeStamp && prevStamp) {
                      const diffMin = Math.round((new Date(timeStamp).getTime() - new Date(prevStamp).getTime()) / 60000);
                      if (diffMin > 0) deltaTexto = `+ ${diffMin} min desde la parada anterior`;
                      else deltaTexto = 'Misma parada continua';
                    } else {
                      deltaTexto = `+ ~${timelapseData.promedioMinPorParada} min estimados`;
                    }
                  }

                  return (
                    <div key={f.id} style={{ position: 'relative', marginBottom: '20px' }}>
                      {/* NODO DEL TIMELINE */}
                      <div
                        style={{
                          position: 'absolute',
                          left: '-32px',
                          top: '2px',
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          background: '#2563eb',
                          border: '3px solid #ffffff',
                          boxShadow: '0 0 0 2px #3b82f6',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#ffffff',
                          fontSize: '10.5px',
                          fontWeight: 900,
                        }}
                      >
                        {idx + 1}
                      </div>

                      {/* TARJETA DE LA PARADA */}
                      <div
                        style={{
                          background: '#ffffff',
                          border: '1.5px solid #e2e8f0',
                          borderRadius: '10px',
                          padding: '12px 16px',
                          boxShadow: '0 1px 4px rgba(0,0,0,0.03)',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <h5 style={{ margin: 0, fontSize: '14.5px', fontWeight: 800, color: '#0f172a' }}>
                                #{idx + 1} • {f.fincaNombre || `Finca #${f.fincaId}`}
                              </h5>
                              <span
                                className="badge"
                                style={{
                                  background: esBufala ? '#f3e8ff' : '#eff6ff',
                                  color: esBufala ? '#7e22ce' : '#1d4ed8',
                                  fontWeight: 800,
                                  fontSize: '10px',
                                  padding: '2px 6px',
                                  borderRadius: '6px',
                                }}
                              >
                                {esBufala ? '🐃 BÚFALA' : '🥛 VACA'}
                              </span>
                              {f.esAcida && (
                                <span className="badge" style={{ background: '#fef2f2', color: '#dc2626', fontWeight: 800, fontSize: '10px' }}>
                                  ÁCIDA
                                </span>
                              )}
                            </div>
                            <span style={{ fontSize: '12px', color: '#64748b', display: 'block', marginTop: '2px' }}>
                              Productor: <strong>{f.propietarioNombre || f.propietario || 'No especificado'}</strong>
                            </span>
                          </div>

                          <div style={{ textAlign: 'right' }}>
                            <span style={{ fontSize: '16px', fontWeight: 900, color: '#2563eb' }}>
                              {f.litros.toLocaleString()} Lts
                            </span>
                            <span style={{ fontSize: '11px', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px', fontWeight: 700, marginTop: '2px' }}>
                              <i className="fa-solid fa-circle-check"></i> Recolectada
                            </span>
                          </div>
                        </div>

                        {/* HORA DE REGISTRO Y CÁLCULO DE TIEMPO TRANSCURRIDO */}
                        <div
                          style={{
                            marginTop: '8px',
                            paddingTop: '8px',
                            borderTop: '1px dashed #e2e8f0',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            fontSize: '11.5px',
                            color: '#64748b',
                            flexWrap: 'wrap',
                            gap: '8px',
                          }}
                        >
                          <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 700, color: '#1e293b' }}>
                            <i className="fa-regular fa-clock" style={{ color: '#2563eb' }}></i>
                            Hora de registro: <strong style={{ color: '#0f172a' }}>{horaStr}</strong>
                          </span>
                          <span
                            className="badge"
                            style={{
                              background: '#f1f5f9',
                              color: '#475569',
                              border: '1px solid #cbd5e1',
                              fontWeight: 700,
                              fontSize: '10.5px',
                              padding: '2px 8px',
                              borderRadius: '6px',
                            }}
                          >
                            <i className="fa-solid fa-hourglass-half" style={{ marginRight: '4px', color: '#64748b' }}></i>
                            {deltaTexto}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* SI TIENE RUTA LOGÍSTICA ASIGNADA: MOSTRAR FINCAS QUE LE HACEN FALTA */}
                {timelapseData.tieneRuta && timelapseData.pendientes.length > 0 && (
                  <div style={{ marginTop: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                      <span className="badge" style={{ background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a', fontWeight: 800, fontSize: '11px' }}>
                        <i className="fa-solid fa-hourglass-start"></i> FINCAS PENDIENTES POR RECOLECTAR EN ESTA RUTA ({timelapseData.pendientes.length})
                      </span>
                      <span style={{ fontSize: '12px', color: '#64748b' }}>
                        Paradas faltantes en el circuito asignado
                      </span>
                    </div>

                    {timelapseData.pendientes.map((f, pIdx) => {
                      const numParada = timelapseData.visitadas.length + pIdx + 1;
                      return (
                        <div key={f.id} style={{ position: 'relative', marginBottom: '16px' }}>
                          {/* NODO PENDIENTE */}
                          <div
                            style={{
                              position: 'absolute',
                              left: '-32px',
                              top: '2px',
                              width: '24px',
                              height: '24px',
                              borderRadius: '50%',
                              background: '#ffffff',
                              border: '2px dashed #f59e0b',
                              boxShadow: '0 0 0 2px #fef3c7',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#d97706',
                              fontSize: '10px',
                              fontWeight: 800,
                            }}
                          >
                            {numParada}
                          </div>

                          <div
                            style={{
                              background: '#fffdfa',
                              border: '1.5px dashed #fcd34d',
                              borderRadius: '10px',
                              padding: '12px 16px',
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                              <div>
                                <h5 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#92400e' }}>
                                  #{numParada} • {f.nombre}
                                </h5>
                                <span style={{ fontSize: '12px', color: '#b45309', display: 'block', marginTop: '2px' }}>
                                  Productor: {f.propietarioNombre || 'Por contactar'}
                                </span>
                              </div>

                              <div style={{ textAlign: 'right' }}>
                                <span className="badge" style={{ background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a', fontWeight: 800, fontSize: '11px' }}>
                                  <i className="fa-solid fa-clock" style={{ marginRight: '4px' }}></i> Pendiente en Ruta
                                </span>
                                {f.promedioLitrosDiarios && (
                                  <span style={{ fontSize: '11px', color: '#64748b', display: 'block', marginTop: '2px' }}>
                                    Estimado: ~{f.promedioLitrosDiarios.toLocaleString()} L
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* SI TIENE RUTA Y COMPLETÓ EL 100% */}
                {timelapseData.tieneRuta && timelapseData.pendientes.length === 0 && (
                  <div style={{ background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: '10px', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '12px', marginTop: '16px' }}>
                    <i className="fa-solid fa-circle-check" style={{ fontSize: '24px', color: '#16a34a' }}></i>
                    <div>
                      <h5 style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: '#15803d' }}>
                        ¡Circuito Logístico Completado al 100%!
                      </h5>
                      <span style={{ fontSize: '12.5px', color: '#166534' }}>
                        Todas las fincas programadas para esta ruta han sido visitadas y medidas.
                      </span>
                    </div>
                  </div>
                )}

                {/* SI NO TIENE RUTA LOGÍSTICA: REGLA SOLICITADA POR EL USUARIO: NO MOSTRAR FALTANTES */}
                {!timelapseData.tieneRuta && (
                  <div style={{ background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: '10px', padding: '16px 20px', marginTop: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                      <i className="fa-solid fa-compass" style={{ fontSize: '22px', color: '#0284c7', marginTop: '2px' }}></i>
                      <div style={{ flex: 1 }}>
                        <h5 style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>
                          Operación en Modo Libre (Recolección sin Ruta Asignada)
                        </h5>
                        <p style={{ margin: '4px 0 12px 0', fontSize: '12.5px', color: '#64748b', lineHeight: 1.5 }}>
                          Esta unidad no cuenta con una secuencia predeterminada de paradas. Las fincas recolectadas son añadidas de manera dinámica por el chofer conforme avanza en su trayecto.
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setViajeActivo(viajeTimelapse);
                            setModalTimelapse(false);
                            setModalRegistroFinca(true);
                          }}
                          className="btn btn-sm btn-primary"
                          style={{ fontWeight: 700, fontSize: '12px', background: '#2563eb' }}
                        >
                          <i className="fa-solid fa-plus"></i> Registrar Parada / Finca Manual a este Ticket
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* PIE DEL TIMELAPSE */}
            <div
              style={{
                padding: '16px 24px',
                background: '#f8fafc',
                borderTop: '1px solid #e2e8f0',
                borderRadius: '0 0 16px 16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '10px',
              }}
            >
              <button
                type="button"
                onClick={() => setModalTimelapse(false)}
                className="btn btn-outline"
                style={{ fontWeight: 700 }}
              >
                Cerrar Ventana
              </button>

              <button
                type="button"
                onClick={() => {
                  setViajeActivo(viajeTimelapse);
                  setModalTimelapse(false);
                  setModalRegistroFinca(true);
                }}
                className="btn btn-primary"
                style={{ fontWeight: 800, background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none' }}
              >
                <i className="fa-solid fa-plus-circle"></i> + Añadir Finca a este Ticket
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: REGISTRAR RECOLECCIÓN EN FINCA (POPUP RÁPIDO)                    */}
      {/* ========================================================================= */}
      {modalRegistroFinca && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', padding: '16px' }}>
          <div className="content-card" style={{ width: '100%', maxWidth: '480px', padding: '24px', borderRadius: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '14px', marginBottom: '16px', borderBottom: '1px solid var(--border-color)' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                <i className="fa-solid fa-cow" style={{ color: '#10b981', marginRight: '8px' }}></i>
                Registrar Parada en Finca
              </h3>
              <button type="button" onClick={() => setModalRegistroFinca(false)} style={{ background: 'none', border: 'none', fontSize: '18px', color: '#94a3b8', cursor: 'pointer' }}>
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!formFinca.fincaId || formFinca.fincaId <= 0) {
                  toast.error('Seleccione una finca');
                  return;
                }
                if (!formFinca.litros || formFinca.litros <= 0) {
                  toast.error('Ingrese litros válidos');
                  return;
                }
                guardarRecoleccionModalMutation.mutate(formFinca);
              }}
            >
              {viajeActivo && (
                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '10px 12px', marginBottom: '16px' }}>
                  <span style={{ fontSize: '11px', color: '#1e40af', fontWeight: 800, textTransform: 'uppercase' }}>Ticket Asociado:</span>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: '#1e3a8a' }}>
                    #{viajeActivo.codigoTicket || viajeActivo.id} — Chofer: {viajeActivo.choferNombre || viajeActivo.nombreConductor}
                  </div>
                </div>
              )}

              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label" style={{ fontWeight: 700 }}>Finca Ganadera *</label>
                <FincaSelect
                  value={formFinca.fincaId}
                  onChange={(id) => {
                    const fincaMatch = fincas.find((f) => f.id === id);
                    const esBuf = (fincaMatch?.tipoLeche || '').toUpperCase().includes('BUFAL');
                    setFormFinca({ ...formFinca, fincaId: id, tipoLeche: esBuf ? 'BUFALA' : 'VACA' });
                  }}
                  rutaLogisticaId={viajeActivo?.rutaLogisticaId}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label" style={{ fontWeight: 700 }}>Litros Recolectados *</label>
                <input
                  type="number"
                  value={formFinca.litros || ''}
                  onChange={(e) => setFormFinca({ ...formFinca, litros: Number(e.target.value) })}
                  className="form-input"
                  placeholder="Ej: 500"
                  min="1"
                  required
                  style={{ height: '38px', fontWeight: 800, fontSize: '15px' }}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label" style={{ fontWeight: 700 }}>Tipo de Leche *</label>
                <select
                  value={formFinca.tipoLeche}
                  onChange={(e) => setFormFinca({ ...formFinca, tipoLeche: e.target.value })}
                  className="form-input"
                  style={{ height: '38px', fontWeight: 700 }}
                >
                  <option value="VACA">🥛 Leche de Vaca</option>
                  <option value="BUFALA">🐃 Leche de Búfala</option>
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#b45309', fontWeight: 700, fontSize: '13px' }}>
                  <input
                    type="checkbox"
                    checked={formFinca.esAcida}
                    onChange={(e) => setFormFinca({ ...formFinca, esAcida: e.target.checked })}
                    style={{ width: '18px', height: '18px' }}
                  />
                  <span>¿Es Leche Ácida / Deteriorada?</span>
                </label>
              </div>

              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label className="form-label">Observación</label>
                <input
                  type="text"
                  value={formFinca.observacion}
                  onChange={(e) => setFormFinca({ ...formFinca, observacion: e.target.value })}
                  className="form-input"
                  placeholder="Opcional..."
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setModalRegistroFinca(false)} className="btn btn-outline">
                  Cancelar
                </button>
                <button type="submit" disabled={guardarRecoleccionModalMutation.isPending} className="btn btn-primary" style={{ fontWeight: 800 }}>
                  {guardarRecoleccionModalMutation.isPending ? 'Guardando...' : 'Guardar Parada'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: INICIAR NUEVO VIAJE / TICKET                                    */}
      {/* ========================================================================= */}
      {modalIniciarViaje && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', padding: '16px' }}>
          <div className="content-card" style={{ width: '100%', maxWidth: '520px', padding: '24px', borderRadius: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '14px', marginBottom: '16px', borderBottom: '1px solid var(--border-color)' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                <i className="fa-solid fa-play" style={{ color: '#10b981', marginRight: '8px' }}></i>
                Iniciar Nuevo Viaje de Recolección
              </h3>
              <button type="button" onClick={() => setModalIniciarViaje(false)} style={{ background: 'none', border: 'none', fontSize: '18px', color: '#94a3b8', cursor: 'pointer' }}>
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!formIniciar.camionId || formIniciar.camionId <= 0) {
                  toast.error('Seleccione un camión / cisterna');
                  return;
                }
                if (!formIniciar.choferId || formIniciar.choferId <= 0) {
                  toast.error('Seleccione el chofer responsable');
                  return;
                }
                iniciarMutation.mutate(formIniciar);
              }}
            >
              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label" style={{ fontWeight: 700 }}>Fecha de Operación *</label>
                <input
                  type="date"
                  value={formIniciar.fecha}
                  onChange={(e) => setFormIniciar({ ...formIniciar, fecha: e.target.value })}
                  className="form-input"
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label" style={{ fontWeight: 700 }}>Camión / Cisterna *</label>
                <CamionSelect
                  value={formIniciar.camionId}
                  onChange={(id) => setFormIniciar({ ...formIniciar, camionId: id })}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label" style={{ fontWeight: 700 }}>Chofer / Conductor *</label>
                <ChoferSelect
                  value={formIniciar.choferId}
                  onChange={(id) => setFormIniciar({ ...formIniciar, choferId: id })}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label" style={{ fontWeight: 700 }}>Ruta Logística (Opcional - Dejar vacío para Modo Libre)</label>
                <select
                  value={formIniciar.rutaLogisticaId || ''}
                  onChange={(e) => setFormIniciar({ ...formIniciar, rutaLogisticaId: Number(e.target.value) || 0 })}
                  className="form-input"
                  style={{ height: '38px', fontWeight: 600 }}
                >
                  <option value="">-- Sin Ruta Logística (Modo Libre / Carga Manual) --</option>
                  {rutasLogistica.map((r: any) => (
                    <option key={r.id} value={r.id}>
                      {r.nombre} {r.descripcion ? `(${r.descripcion})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label">Odómetro Inicial (Km)</label>
                <input
                  type="number"
                  value={formIniciar.odometroInicialKm || ''}
                  onChange={(e) => setFormIniciar({ ...formIniciar, odometroInicialKm: Number(e.target.value) })}
                  className="form-input"
                  placeholder="Ej: 145000"
                />
              </div>

              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label className="form-label">Observaciones</label>
                <input
                  type="text"
                  value={formIniciar.observaciones}
                  onChange={(e) => setFormIniciar({ ...formIniciar, observaciones: e.target.value })}
                  className="form-input"
                  placeholder="Notas de salida..."
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setModalIniciarViaje(false)} className="btn btn-outline">
                  Cancelar
                </button>
                <button type="submit" disabled={iniciarMutation.isPending} className="btn btn-primary" style={{ fontWeight: 800 }}>
                  {iniciarMutation.isPending ? 'Iniciando...' : 'Iniciar Viaje'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: EDITAR RECOLECCIÓN EN FINCA                                      */}
      {/* ========================================================================= */}
      {modalEditarRecoleccion && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', padding: '16px' }}>
          <div className="content-card" style={{ width: '100%', maxWidth: '480px', padding: '24px', borderRadius: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '14px', marginBottom: '16px', borderBottom: '1px solid var(--border-color)' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                <i className="fa-solid fa-pen-to-square" style={{ color: '#4f46e5', marginRight: '8px' }}></i>
                Editar Recolección #{formEditar.id}
              </h3>
              <button type="button" onClick={() => setModalEditarRecoleccion(false)} style={{ background: 'none', border: 'none', fontSize: '18px', color: '#94a3b8', cursor: 'pointer' }}>
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                editarRecoleccionMutation.mutate(formEditar);
              }}
            >
              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label" style={{ fontWeight: 700 }}>Finca *</label>
                <FincaSelect
                  value={formEditar.fincaId}
                  onChange={(id) => setFormEditar({ ...formEditar, fincaId: id })}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label" style={{ fontWeight: 700 }}>Litros *</label>
                <input
                  type="number"
                  value={formEditar.litros}
                  onChange={(e) => setFormEditar({ ...formEditar, litros: Number(e.target.value) })}
                  className="form-input"
                  required
                  style={{ height: '38px', fontWeight: 800 }}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label" style={{ fontWeight: 700 }}>Tipo de Leche</label>
                <select
                  value={formEditar.tipoLeche}
                  onChange={(e) => setFormEditar({ ...formEditar, tipoLeche: e.target.value })}
                  className="form-input"
                  style={{ height: '38px', fontWeight: 700 }}
                >
                  <option value="VACA">🥛 Leche de Vaca</option>
                  <option value="BUFALA">🐃 Leche de Búfala</option>
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#b45309', fontWeight: 700 }}>
                  <input
                    type="checkbox"
                    checked={formEditar.esAcida}
                    onChange={(e) => setFormEditar({ ...formEditar, esAcida: e.target.checked })}
                    style={{ width: '18px', height: '18px' }}
                  />
                  <span>¿Leche Ácida?</span>
                </label>
              </div>

              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label className="form-label">Observación</label>
                <input
                  type="text"
                  value={formEditar.observacion}
                  onChange={(e) => setFormEditar({ ...formEditar, observacion: e.target.value })}
                  className="form-input"
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setModalEditarRecoleccion(false)} className="btn btn-outline">
                  Cancelar
                </button>
                <button type="submit" disabled={editarRecoleccionMutation.isPending} className="btn btn-primary" style={{ fontWeight: 800 }}>
                  {editarRecoleccionMutation.isPending ? 'Guardando...' : 'Actualizar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: ENVIAR A RECEPTORÍA                                              */}
      {/* ========================================================================= */}
      {modalEnviarReceptoria && viajeActivo && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', padding: '16px' }}>
          <div className="content-card" style={{ width: '100%', maxWidth: '440px', padding: '24px', borderRadius: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 800, margin: '0 0 12px 0', color: '#0f172a' }}>
              <i className="fa-solid fa-scale-balanced" style={{ color: '#16a34a', marginRight: '8px' }}></i>
              Enviar Viaje #{viajeActivo.id} a Receptoría
            </h3>
            <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>
              El camión ingresará a la planta receptora para el pesaje y descarga de los litros recolectados.
            </p>
            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label className="form-label">Observación / Nota para Receptoría</label>
              <input
                type="text"
                value={formReceptoria.observacion}
                onChange={(e) => setFormReceptoria({ observacion: e.target.value })}
                className="form-input"
                placeholder="Ej: Turno mañana sin novedad..."
              />
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setModalEnviarReceptoria(false)} className="btn btn-outline">
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => enviarReceptoriaMutation.mutate(viajeActivo.id)}
                disabled={enviarReceptoriaMutation.isPending}
                className="btn btn-primary"
                style={{ background: '#16a34a', border: 'none', fontWeight: 800 }}
              >
                {enviarReceptoriaMutation.isPending ? 'Enviando...' : 'Confirmar Envío'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: DESPACHO DIRECTO A COMPAÑÍA                                      */}
      {/* ========================================================================= */}
      {modalEnviarCompania && viajeActivo && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', padding: '16px' }}>
          <div className="content-card" style={{ width: '100%', maxWidth: '480px', padding: '24px', borderRadius: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 800, margin: '0 0 12px 0', color: '#0f172a' }}>
              <i className="fa-solid fa-building" style={{ color: '#7e22ce', marginRight: '8px' }}></i>
              Despacho a Planta / Compañía
            </h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!formCompania.companiaId || formCompania.companiaId <= 0) {
                  toast.error('Seleccione una empresa o quesera destino');
                  return;
                }
                enviarCompaniaMutation.mutate(viajeActivo.id);
              }}
            >
              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label" style={{ fontWeight: 700 }}>Compañía / Planta Destino *</label>
                <CompaniaSelect
                  value={formCompania.companiaId}
                  onChange={(id) => setFormCompania({ ...formCompania, companiaId: id })}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label" style={{ fontWeight: 700 }}>Litros a Despachar *</label>
                <input
                  type="number"
                  value={formCompania.litros}
                  onChange={(e) => setFormCompania({ ...formCompania, litros: Number(e.target.value) })}
                  className="form-input"
                  required
                  style={{ height: '38px', fontWeight: 800 }}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label">Tipo de Leche</label>
                <select
                  value={formCompania.tipoLeche}
                  onChange={(e) => setFormCompania({ ...formCompania, tipoLeche: e.target.value })}
                  className="form-input"
                >
                  <option value="VACA">🥛 Leche de Vaca</option>
                  <option value="BUFALA">🐃 Leche de Búfala</option>
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label className="form-label">Observación</label>
                <input
                  type="text"
                  value={formCompania.observacion}
                  onChange={(e) => setFormCompania({ ...formCompania, observacion: e.target.value })}
                  className="form-input"
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setModalEnviarCompania(false)} className="btn btn-outline">
                  Cancelar
                </button>
                <button type="submit" disabled={enviarCompaniaMutation.isPending} className="btn btn-primary" style={{ background: '#7e22ce', border: 'none', fontWeight: 800 }}>
                  {enviarCompaniaMutation.isPending ? 'Despachando...' : 'Generar Despacho'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 6: TRASPASO DE LECHE ENTRE CISTERNAS                                */}
      {/* ========================================================================= */}
      {modalTraspaso && viajeActivo && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', padding: '16px' }}>
          <div className="content-card" style={{ width: '100%', maxWidth: '480px', padding: '24px', borderRadius: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 800, margin: '0 0 12px 0', color: '#0f172a' }}>
              <i className="fa-solid fa-right-left" style={{ color: '#0f766e', marginRight: '8px' }}></i>
              Traspasar Leche desde Ticket #{viajeActivo.id}
            </h3>
            <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>
              Transfiere volumen de leche a otra unidad cisterna activa en ruta.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!formTraspaso.litrosTraspaso || formTraspaso.litrosTraspaso <= 0) {
                  toast.error('Ingrese una cantidad válida de litros a traspasar');
                  return;
                }
                traspasoMutation.mutate(viajeActivo.id);
              }}
            >
              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label" style={{ fontWeight: 700 }}>Ticket Destino (Cisterna Receptora)</label>
                <select
                  value={formTraspaso.ticketDestinoId || ''}
                  onChange={(e) => setFormTraspaso({ ...formTraspaso, ticketDestinoId: Number(e.target.value) })}
                  className="form-input"
                  style={{ height: '38px', fontWeight: 700 }}
                >
                  <option value="">-- Seleccionar Ticket Activo --</option>
                  {viajes
                    .filter((v) => v.id !== viajeActivo.id && v.estado !== 'FINALIZADO')
                    .map((v) => (
                      <option key={v.id} value={v.id}>
                        Ticket #{v.codigoTicket || v.id} - {v.choferNombre || v.nombreConductor} ({v.camionPlaca})
                      </option>
                    ))}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label" style={{ fontWeight: 700 }}>Litros a Transferir *</label>
                <input
                  type="number"
                  value={formTraspaso.litrosTraspaso}
                  onChange={(e) => setFormTraspaso({ ...formTraspaso, litrosTraspaso: Number(e.target.value) })}
                  className="form-input"
                  required
                  style={{ height: '38px', fontWeight: 800, fontSize: '15px', color: '#0f766e' }}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label className="form-label">Motivo u Observación</label>
                <input
                  type="text"
                  value={formTraspaso.observacion}
                  onChange={(e) => setFormTraspaso({ ...formTraspaso, observacion: e.target.value })}
                  className="form-input"
                  placeholder="Ej: Falla mecánica, traspaso de carga..."
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setModalTraspaso(false)} className="btn btn-outline">
                  Cancelar
                </button>
                <button type="submit" disabled={traspasoMutation.isPending} className="btn btn-primary" style={{ background: '#0f766e', border: 'none', fontWeight: 800 }}>
                  {traspasoMutation.isPending ? 'Procesando...' : 'Confirmar Traspaso'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};
