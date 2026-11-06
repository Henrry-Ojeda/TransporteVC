import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import apiClient from '@/api/client';
import { operacionesApi } from '@/api/operaciones.api';
import { catalogosApi } from '@/api/catalogos.api';
import { sistemaApi } from '@/api/sistema.api';
import { DataTable, type ColumnDef } from '@/components/common/DataTable';
import { CamionSelect, ChoferSelect, FincaSelect } from '@/components/selectors';
import { confirmDialog } from '@/lib/sweetalert';
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
  const rol = user?.rol?.toUpperCase() || '';
  const esAdminOSup = ['ADMIN', 'ADMINISTRADOR', 'SUPERVISOR', 'GERENTE'].includes(rol);

  const hoyStr = new Date().toISOString().split('T')[0];

  // 2 Vistas Principales:
  // 1) 'viajes': Control de Rutas & Camiones (Fusión de Mis Tickets y Camiones en Ruta)
  // 2) 'fincas': Detalle por Fincas (Historial / Buscador de solo lectura)
  const [modoVista, setModoVista] = useState<'viajes' | 'fincas'>('viajes');
  const [fechaFiltro, setFechaFiltro] = useState<string>(hoyStr);

  // Sub-filtros en la vista de Rutas & Camiones
  const [filtroOrigenTicket, setFiltroOrigenTicket] = useState<'todos' | 'RUTA' | 'RECEPTORIA'>('todos');
  const [filtroEstadoTicket, setFiltroEstadoTicket] = useState<'activos' | 'todos'>('activos');
  const [busquedaTexto, setBusquedaTexto] = useState<string>('');

  // Control de acordeón de paradas / fincas en tarjetas de viajes
  const [fincasExpandidas, setFincasExpandidas] = useState<Record<number, boolean>>({});

  // Ticket seleccionado actualmente
  const [viajeActivo, setViajeActivo] = useState<ControlRutaDto | null>(null);

  // Cache reactivo de fincas/paradas por ticket para garantizar sincronización 100% en vivo
  const [fincasTicketsMap, setFincasTicketsMap] = useState<Record<number, any[]>>({});
  const [loadingFincasMap, setLoadingFincasMap] = useState<Record<number, boolean>>({});

  const cargarFincasTicket = async (ticketId: number) => {
    if (!ticketId) return [];
    try {
      setLoadingFincasMap((prev) => ({ ...prev, [ticketId]: true }));
      const paradas = await operacionesApi.getFincasViaje(ticketId);
      setFincasTicketsMap((prev) => ({ ...prev, [ticketId]: paradas || [] }));
      return paradas || [];
    } catch (err) {
      console.error(`Error cargando paradas para ticket #${ticketId}:`, err);
      return [];
    } finally {
      setLoadingFincasMap((prev) => ({ ...prev, [ticketId]: false }));
    }
  };

  // Modal Timelapse & Recorrido en Ruta
  const [modalTimelapse, setModalTimelapse] = useState(false);
  const [viajeTimelapse, setViajeTimelapse] = useState<ControlRutaDto | null>(null);

  // Modales Operativos
  const [modalIniciarViaje, setModalIniciarViaje] = useState(false);
  const [modalRegistroFinca, setModalRegistroFinca] = useState(false);
  const [modalEditarRecoleccion, setModalEditarRecoleccion] = useState(false);
  const [modalEnviarReceptoria, setModalEnviarReceptoria] = useState(false);
  const [modalEnviarCompania, setModalEnviarCompania] = useState(false);
  const [modalTraspaso, setModalTraspaso] = useState(false);
  const [modalCerrarViaje, setModalCerrarViaje] = useState(false);

  // Formulario Iniciar Viaje (con Selección Múltiple de Rutas y Validación de Capacidad)
  const [formIniciar, setFormIniciar] = useState({
    fecha: hoyStr,
    camionId: 0,
    choferId: user?.id && rol === 'CHOFER' ? user.id : 0,
    rutaLogisticaId: 0,
    rutasLogisticasIds: [] as number[],
    toleranciaPorcentaje: 15,
    odometroInicialKm: '' as any,
    observaciones: '',
  });

  // Formulario Modal Registrar Recolección en Finca (para tickets abiertos)
  const [formFinca, setFormFinca] = useState({
    fincaId: 0,
    litros: '' as any,
    tipoLeche: 'VACA',
    esAcida: false,
    esDiferido: false,
    fecha: '',
    observacion: '',
  });

  // Formulario Editar Recolección
  const [formEditar, setFormEditar] = useState({
    id: 0,
    fincaId: 0,
    litros: 0,
    tipoLeche: 'VACA',
    esAcida: false,
    esDiferido: false,
    fecha: '',
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

  // Formulario Cerrar Viaje
  const [formCerrar, setFormCerrar] = useState({
    odometroFinalKm: '' as any,
    observaciones: '',
  });

  // =========================================================================
  // REACT QUERIES
  // =========================================================================
  const { data: viajes = [], refetch: refetchViajes } = useQuery<ControlRutaDto[]>({
    queryKey: ['rutas-viajes-hoy', fechaFiltro],
    queryFn: () => operacionesApi.getControles(fechaFiltro),
    refetchInterval: 8000,
  });

  // Precargar paradas reales para todos los viajes visibles (garantiza ver fincas de cualquier fecha)
  useEffect(() => {
    if (viajes && viajes.length > 0) {
      viajes.forEach((v) => {
        if (v.id) {
          cargarFincasTicket(v.id);
        }
      });
    }
  }, [viajes]);

  const { data: despachos = [], refetch: refetchDespachos } = useQuery<DespachoCompaniaDto[]>({
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

  // Consulta histórica de fincas para cálculo del promedio semanal en vivo
  const fecha90DiasAtrasStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 90);
    return d.toISOString().split('T')[0];
  }, []);

  const { data: reporteFincasPromedios = [] } = useQuery({
    queryKey: ['reporte-fincas-promedios-rutas', fecha90DiasAtrasStr, hoyStr],
    queryFn: () => sistemaApi.getReporteFincas(fecha90DiasAtrasStr, hoyStr),
    staleTime: 1000 * 60 * 15,
  });

  const mapaPromediosFincas = useMemo(() => {
    const map = new Map<number, number>();
    reporteFincasPromedios.forEach((rf: any) => {
      const detalle = Array.isArray(rf.detalle) && rf.detalle.length > 0 ? rf.detalle.slice(-15) : [];
      const cant = detalle.length > 0 ? detalle.length : 1;
      const total = detalle.length > 0
        ? detalle.reduce((acc: number, item: any) => acc + Number(item.litros || 0), 0)
        : Number(rf.totalLitros || 0);
      const prom = total > 0 ? Math.round(total / cant) : 0;
      if (prom > 0) map.set(Number(rf.id), prom);
    });
    return map;
  }, [reporteFincasPromedios]);

  const getPromedioFinca = (fincaId: number, f?: any): number => {
    if (mapaPromediosFincas.has(fincaId)) return mapaPromediosFincas.get(fincaId)!;
    return Number(f?.promedioLitrosDiarios || f?.litrosPromedio || 0) || 190;
  };

  // =========================================================================
  // MUTATIONS
  // =========================================================================
  const iniciarMutation = useMutation({
    mutationFn: (dto: typeof formIniciar) => {
      const payload: any = {
        fecha: dto.fecha,
        camionId: dto.camionId,
        choferId: dto.choferId,
        rutaLogisticaId: dto.rutasLogisticasIds.length > 0 ? dto.rutasLogisticasIds[0] : (dto.rutaLogisticaId || undefined),
        rutasLogisticasIds: dto.rutasLogisticasIds,
        odometroInicialKm: dto.odometroInicialKm ? Number(dto.odometroInicialKm) : undefined,
        observacion: dto.observaciones,
      };
      return operacionesApi.iniciarViaje(payload);
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Viaje iniciado exitosamente');
      queryClient.invalidateQueries({ queryKey: ['rutas-viajes-hoy'] });
      setModalIniciarViaje(false);
      setFormIniciar({
        fecha: hoyStr,
        camionId: 0,
        choferId: user?.id && rol === 'CHOFER' ? user.id : 0,
        rutaLogisticaId: 0,
        rutasLogisticasIds: [],
        toleranciaPorcentaje: 15,
        odometroInicialKm: '',
        observaciones: '',
      });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Error al iniciar viaje');
    },
  });

  const guardarRecoleccionModalMutation = useMutation({
    mutationFn: async (dto: typeof formFinca) => {
      if (!viajeActivo) throw new Error('No hay ticket activo seleccionado');
      const payload: any = {
        controlRutaId: viajeActivo.id,
        fincaId: dto.fincaId,
        litros: Number(dto.litros),
        tipoLeche: dto.tipoLeche,
        esAcida: dto.esAcida,
        esDiferido: Boolean(dto.esDiferido),
        fecha: dto.fecha || (viajeActivo.fecha ? viajeActivo.fecha.split('T')[0] : undefined),
        observacion: dto.observacion,
      };
      return operacionesApi.agregarFincaViaje(viajeActivo.id, payload);
    },
    onSuccess: async (data) => {
      toast.success(data.message || 'Finca agregada al viaje exitosamente');
      if (viajeActivo?.id) {
        await cargarFincasTicket(viajeActivo.id);
        queryClient.invalidateQueries({ queryKey: ['fincas-ticket', viajeActivo.id] });
      }
      queryClient.invalidateQueries({ queryKey: ['rutas-fincas-hoy'] });
      queryClient.invalidateQueries({ queryKey: ['rutas-viajes-hoy'] });
      setModalRegistroFinca(false);
      setFormFinca({ fincaId: 0, litros: '', tipoLeche: 'VACA', esAcida: false, esDiferido: false, fecha: '', observacion: '' });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Error al registrar recolección');
    },
  });

  const editarRecoleccionMutation = useMutation({
    mutationFn: (dto: typeof formEditar) =>
      operacionesApi.editarRecoleccion(dto.id, {
        fincaId: dto.fincaId,
        litros: Number(dto.litros),
        tipoLeche: dto.tipoLeche,
        esAcida: dto.esAcida,
        esDiferido: Boolean(dto.esDiferido),
        observacion: dto.observacion,
      }),
    onSuccess: async (data) => {
      toast.success(data.message || 'Parada actualizada exitosamente');
      if (viajeActivo?.id) {
        await cargarFincasTicket(viajeActivo.id);
      } else {
        viajes.forEach((v) => cargarFincasTicket(v.id));
      }
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
    onSuccess: async (data) => {
      toast.success(data.message || 'Parada removida del viaje exitosamente');
      viajes.forEach((v) => cargarFincasTicket(v.id));
      queryClient.invalidateQueries({ queryKey: ['rutas-fincas-hoy'] });
      queryClient.invalidateQueries({ queryKey: ['rutas-viajes-hoy'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Error al remover parada');
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
      }),
    onSuccess: (data) => {
      toast.success(data.message || 'Despacho a compañía registrado exitosamente');
      queryClient.invalidateQueries({ queryKey: ['rutas-viajes-hoy'] });
      queryClient.invalidateQueries({ queryKey: ['rutas-despachos-hoy'] });
      setModalEnviarCompania(false);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Error al despachar a compañía');
    },
  });

  const traspasoMutation = useMutation({
    mutationFn: (id: number) => operacionesApi.traspasarLeche(id, formTraspaso),
    onSuccess: (data) => {
      toast.success(data.message || 'Traspaso de leche ejecutado exitosamente');
      queryClient.invalidateQueries({ queryKey: ['rutas-viajes-hoy'] });
      setModalTraspaso(false);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Error al ejecutar traspaso');
    },
  });

  const cerrarViajeMutation = useMutation({
    mutationFn: (ticketId: number) =>
      operacionesApi.cerrarViaje(ticketId, {
        odometroFinalKm: formCerrar.odometroFinalKm ? Number(formCerrar.odometroFinalKm) : undefined,
        observaciones: formCerrar.observaciones,
      }),
    onSuccess: (data) => {
      toast.success(data.message || 'Viaje finalizado y cerrado exitosamente');
      queryClient.invalidateQueries({ queryKey: ['rutas-viajes-hoy'] });
      setModalCerrarViaje(false);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Error al cerrar viaje');
    },
  });

  // =========================================================================
  // CÁLCULOS Y PROPIEDADES COMPUTADAS
  // =========================================================================
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

  const ticketsCombinados = useMemo(() => {
    const normRutas = viajesFiltrados.map((v) => ({
      ...v,
      _tipoTicket: 'RUTA' as const,
      _origenBadge: 'RUTA / FINCAS',
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
      _origenBadge: 'RECEPTORÍA / SALIDA',
      _origenColor: '#9333ea',
      _origenBg: '#f3e8ff',
      _origenBorder: '#e9d5ff',
      _origenIcon: 'fa-building-wheat',
      _litrosRecogidos: d.litrosDespachados || 0,
      _litrosEntregados: d.litrosRecibidosCompania || d.litrosConfirmados || 0,
      _conductor: d.choferNombre || d.nombreConductor || 'Chofer Asignado',
      nombreCompania: d.nombreCompania || d.companiaNombre,
    }));

    let combinados: any[] = [];
    if (filtroOrigenTicket === 'RUTA') combinados = normRutas;
    else if (filtroOrigenTicket === 'RECEPTORIA') combinados = normDespachos;
    else combinados = [...normRutas, ...normDespachos];

    if (busquedaTexto.trim()) {
      const q = busquedaTexto.toLowerCase();
      combinados = combinados.filter(
        (t) =>
          String(t.id).includes(q) ||
          String(t.codigoTicket || '').toLowerCase().includes(q) ||
          String(t._conductor || '').toLowerCase().includes(q) ||
          String(t.camionPlaca || '').toLowerCase().includes(q) ||
          String(t.rutaLogisticaNombre || t.rutaNombre || '').toLowerCase().includes(q) ||
          String(t.nombreCompania || '').toLowerCase().includes(q)
      );
    }

    return combinados;
  }, [viajesFiltrados, despachos, filtroOrigenTicket, busquedaTexto]);

  // Totales generales para Detalle por Fincas
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

  // Totales de flota para tarjetas KPI superiores
  const kpisFlota = useMemo(() => {
    const totalViajes = viajes.length;
    const activosEnRuta = viajes.filter((v) => v.procesoActualId === 1 && v.estado !== 'FINALIZADO' && v.estado !== 'CERRADO').length;
    const totalRecogido = viajes.reduce((acc, v) => acc + Number(v.totalLitrosFinca || v.totalLitrosRecogidos || 0), 0);
    const totalDespachado = despachos.reduce((acc, d) => acc + Number(d.litrosDespachados || 0), 0);
    return { totalViajes, activosEnRuta, totalRecogido, totalDespachado };
  }, [viajes, despachos]);

  // Validación y cálculo dinámico de capacidad en Iniciar Viaje (±15% configurable)
  const calculoCapacidadModal = useMemo(() => {
    const rIds = formIniciar.rutasLogisticasIds;
    const camion = camiones.find((c) => c.id === formIniciar.camionId);
    const capacidad = camion?.capacidadLitros || 0;

    if (rIds.length === 0) {
      return {
        rutasSeleccionadas: [],
        fincasDeRutas: [],
        litrosEstimados: 0,
        capacidad,
        diferencia: 0,
        porcentajeDesviacion: 0,
        estado: 'MODO_LIBRE',
      };
    }

    const fincasDeRutas = fincas.filter((f) => f.rutaId && rIds.includes(f.rutaId));
    const litrosEstimados = fincasDeRutas.reduce((acc, f) => acc + getPromedioFinca(f.id, f), 0);

    let diferencia = 0;
    let porcentajeDesviacion = 0;
    let estado: 'OPTIMO' | 'EXCESO' | 'BAJO' = 'OPTIMO';

    if (capacidad > 0) {
      diferencia = litrosEstimados - capacidad;
      porcentajeDesviacion = ((litrosEstimados - capacidad) / capacidad) * 100;
      const tol = Number(formIniciar.toleranciaPorcentaje) || 15;
      if (porcentajeDesviacion > tol) {
        estado = 'EXCESO';
      } else if (porcentajeDesviacion < -tol) {
        estado = 'BAJO';
      } else {
        estado = 'OPTIMO';
      }
    }

    return {
      rutasSeleccionadas: rutasLogistica.filter((r) => rIds.includes(r.id)),
      fincasDeRutas,
      litrosEstimados,
      capacidad,
      diferencia,
      porcentajeDesviacion,
      estado,
    };
  }, [formIniciar.rutasLogisticasIds, formIniciar.camionId, formIniciar.toleranciaPorcentaje, fincas, camiones, rutasLogistica, mapaPromediosFincas]);

  // TOGGLE DE ACORDEÓN EN TARJETAS
  const toggleAcordeonFincas = (ticketId: number) => {
    setFincasExpandidas((prev) => {
      const willExpand = !prev[ticketId];
      if (willExpand) {
        cargarFincasTicket(ticketId);
      }
      return {
        ...prev,
        [ticketId]: willExpand,
      };
    });
  };

  // TIMELAPSE DATA COMPUTED
  const timelapseData = useMemo(() => {
    if (!viajeTimelapse) return null;

    const tieneRuta = Boolean(viajeTimelapse.rutaLogisticaId && viajeTimelapse.rutaLogisticaId > 0);
    const camionMatch = camiones.find((c) => c.id === viajeTimelapse.camionId || c.placa === viajeTimelapse.camionPlaca);
    const capacidadMax = camionMatch?.capacidadLitros || viajeTimelapse.capacidadCamionLitros || 10000;

    const paradasDelTicket = (fincasTicketsMap[viajeTimelapse.id] && fincasTicketsMap[viajeTimelapse.id].length > 0)
      ? fincasTicketsMap[viajeTimelapse.id]
      : recolecciones.filter((r) => r.controlRutaId === viajeTimelapse.id || r.ticketCodigo === viajeTimelapse.codigoTicket || r.ticketCodigo === String(viajeTimelapse.id));

    const visitadas = [...paradasDelTicket]
      .sort((a, b) => {
        const timeA = new Date(a.createdAt || (a as any).CreatedAt || a.fecha).getTime();
        const timeB = new Date(b.createdAt || (b as any).CreatedAt || b.fecha).getTime();
        return timeA - timeB;
      });

    let acumulado = 0;
    const paradasConIntervalo = visitadas.map((item, idx) => {
      acumulado += Number(item.litros || (item as any).Litros || 0);
      const fechaActual = new Date(item.createdAt || (item as any).CreatedAt || item.fecha);
      let minutosDesdeAnterior: number | null = null;
      if (idx > 0) {
        const fechaAnt = new Date(visitadas[idx - 1].createdAt || (visitadas[idx - 1] as any).CreatedAt || visitadas[idx - 1].fecha);
        const diffMs = fechaActual.getTime() - fechaAnt.getTime();
        minutosDesdeAnterior = Math.max(0, Math.round(diffMs / (1000 * 60)));
      }
      return {
        ...item,
        acumulado,
        minutosDesdeAnterior,
        porcentajeCarga: Math.min(100, Math.round((acumulado / capacidadMax) * 100)),
      };
    });

    let pendientes: FincaDto[] = [];
    if (tieneRuta) {
      const idsVisitadas = new Set(visitadas.map((v) => v.fincaId || (v as any).FincaId));
      pendientes = fincas.filter((f) => f.rutaId === viajeTimelapse.rutaLogisticaId && !idsVisitadas.has(f.id));
    }

    const totalLitros = paradasConIntervalo.length > 0 ? paradasConIntervalo[paradasConIntervalo.length - 1].acumulado : 0;
    const porcentajeLlenado = Math.min(100, Math.round((totalLitros / capacidadMax) * 100));

    return {
      tieneRuta,
      rutaNombre: viajeTimelapse.rutaLogisticaNombre || (tieneRuta ? `Ruta #${viajeTimelapse.rutaLogisticaId}` : 'Modo Libre (Sin Ruta)'),
      chofer: viajeTimelapse.choferNombre || viajeTimelapse.nombreConductor || 'Sin Asignar',
      camion: camionMatch ? `${camionMatch.placa} (${camionMatch.capacidadLitros.toLocaleString()} Lts)` : viajeTimelapse.camionPlaca || 'Cisterna',
      capacidadMax,
      totalLitros,
      porcentajeLlenado,
      paradas: paradasConIntervalo,
      pendientes,
      totalParadasEstimadas: paradasConIntervalo.length + pendientes.length,
    };
  }, [viajeTimelapse, fincasTicketsMap, recolecciones, fincas, camiones]);

  const abrirTimelapse = async (viaje: ControlRutaDto) => {
    setViajeTimelapse(viaje);
    setModalTimelapse(true);
    await cargarFincasTicket(viaje.id);
  };

  // =========================================================================
  // COLUMNAS TABLA DETALLE POR FINCAS (HISTORIAL / BUSCADOR - SOLO LECTURA)
  // =========================================================================
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
      header: 'OBSERVACIÓN / DETALLE',
      accessorKey: 'observacion',
      cell: (row) => (
        <span style={{ fontSize: '12px', color: '#64748b' }}>
          {row.observacion || 'Sin observaciones'}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* ========================================================================= */}
      {/* ENCABEZADO Y KPIS SUPERIORES                                              */}
      {/* ========================================================================= */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff', boxShadow: '0 4px 10px rgba(37,99,235,0.25)' }}>
              <i className="fa-solid fa-truck-moving" style={{ fontSize: '18px' }}></i>
            </span>
            Control de Recolección & Flota Cisterna
          </h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
            Supervisión integral de viajes, camiones en ruta, recolección por circuito y trazabilidad de leche.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setModalIniciarViaje(true)}
            style={{
              fontWeight: 800,
              fontSize: '13px',
              padding: '9px 18px',
              borderRadius: '9px',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              border: 'none',
              boxShadow: '0 4px 12px rgba(16,185,129,0.3)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <i className="fa-solid fa-plus-circle"></i> Iniciar Nuevo Viaje / Ticket
          </button>
        </div>
      </div>

      {/* METRICAS KPI DE FLOTA */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '14px' }}>
        <div className="content-card" style={{ padding: '16px 18px', borderLeft: '4px solid #2563eb', borderRadius: '12px' }}>
          <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Viajes Operativos</span>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '6px' }}>
            <span style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a' }}>{kpisFlota.totalViajes}</span>
            <span className="badge" style={{ background: '#eff6ff', color: '#1d4ed8', fontWeight: 700, fontSize: '11px' }}>
              Fecha: {fechaFiltro}
            </span>
          </div>
        </div>

        <div className="content-card" style={{ padding: '16px 18px', borderLeft: '4px solid #10b981', borderRadius: '12px' }}>
          <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Cisternas en Ruta</span>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '6px' }}>
            <span style={{ fontSize: '24px', fontWeight: 800, color: '#059669' }}>{kpisFlota.activosEnRuta}</span>
            <span className="badge" style={{ background: '#ecfdf5', color: '#047857', fontWeight: 700, fontSize: '11px' }}>
              En recolección
            </span>
          </div>
        </div>

        <div className="content-card" style={{ padding: '16px 18px', borderLeft: '4px solid #0284c7', borderRadius: '12px' }}>
          <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Litros Recogidos Campo</span>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '6px' }}>
            <span style={{ fontSize: '24px', fontWeight: 800, color: '#0284c7' }}>{kpisFlota.totalRecogido.toLocaleString()} L</span>
            <span style={{ fontSize: '11.5px', color: '#64748b' }}>{recolecciones.length} paradas</span>
          </div>
        </div>

        <div className="content-card" style={{ padding: '16px 18px', borderLeft: '4px solid #9333ea', borderRadius: '12px' }}>
          <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Litros Despachados</span>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '6px' }}>
            <span style={{ fontSize: '24px', fontWeight: 800, color: '#7e22ce' }}>{kpisFlota.totalDespachado.toLocaleString()} L</span>
            <span style={{ fontSize: '11.5px', color: '#64748b' }}>{despachos.length} despachos</span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* BARRA DE NAVEGACIÓN ENTRE VISTAS (2 PESTAÑAS: TICKETS & DETALLE FINCAS)     */}
      {/* ========================================================================= */}
      <div
        className="content-card"
        style={{
          padding: '10px 16px',
          borderRadius: '12px',
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
            Vista Operativa:
          </span>
          <div style={{ display: 'inline-flex', background: '#f1f5f9', padding: '3px', borderRadius: '10px', border: '1px solid #e2e8f0', gap: '4px' }}>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => setModoVista('viajes')}
              style={{
                height: '34px',
                padding: '0 16px',
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
              Control de Rutas & Camiones
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
                padding: '0 16px',
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
              Detalle por Fincas (Historial / Buscador)
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
          </div>
        </div>

        {/* SELECTOR DE FECHA GLOBAL */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#ffffff', padding: '4px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
          <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <i className="fa-regular fa-calendar-days" style={{ color: '#2563eb' }}></i>
            Fecha Operativa:
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
      {/* VISTA 1: CONTROL DE RUTAS & CAMIONES (FUSIÓN MIS TICKETS + CAMIONES RUTA) */}
      {/* ========================================================================= */}
      {modoVista === 'viajes' && (
        <div style={{ marginBottom: '24px' }}>
          {/* BARRA DE FILTROS SUPERIOR */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
            {/* Píldoras de Filtro por Origen: TODOS | Rutas / Fincas | Receptorías / Salidas */}
            <div style={{ display: 'flex', gap: '6px', background: '#e2e8f0', padding: '3px', borderRadius: '8px' }}>
              <button
                type="button"
                onClick={() => setFiltroOrigenTicket('todos')}
                style={{
                  border: 'none',
                  padding: '5px 14px',
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
                  padding: '5px 14px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: filtroOrigenTicket === 'RUTA' ? '#ffffff' : 'transparent',
                  color: filtroOrigenTicket === 'RUTA' ? '#0369a1' : '#64748b',
                  boxShadow: filtroOrigenTicket === 'RUTA' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <i className="fa-solid fa-route" style={{ color: '#0284c7' }}></i>
                Rutas / Fincas ({viajesFiltrados.length})
              </button>
              <button
                type="button"
                onClick={() => setFiltroOrigenTicket('RECEPTORIA')}
                style={{
                  border: 'none',
                  padding: '5px 14px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: filtroOrigenTicket === 'RECEPTORIA' ? '#ffffff' : 'transparent',
                  color: filtroOrigenTicket === 'RECEPTORIA' ? '#7e22ce' : '#64748b',
                  boxShadow: filtroOrigenTicket === 'RECEPTORIA' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <i className="fa-solid fa-building-wheat" style={{ color: '#9333ea' }}></i>
                Receptorías / Salidas ({despachos.length})
              </button>
            </div>

            {/* Buscador de texto y filtro Activos vs Histórico */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', width: '220px' }}>
                <i className="fa-solid fa-magnifying-glass" style={{ position: 'absolute', left: '10px', top: '10px', color: '#94a3b8', fontSize: '12px' }}></i>
                <input
                  type="text"
                  placeholder="Buscar chofer, cisterna, ticket..."
                  value={busquedaTexto}
                  onChange={(e) => setBusquedaTexto(e.target.value)}
                  className="form-input"
                  style={{ height: '32px', paddingLeft: '28px', fontSize: '12px', borderRadius: '7px' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '4px', background: '#f1f5f9', padding: '3px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
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
                    color: filtroEstadoTicket === 'activos' ? '#059669' : '#64748b',
                    boxShadow: filtroEstadoTicket === 'activos' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                  }}
                >
                  Solo En Ruta / Activos
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
                    boxShadow: filtroEstadoTicket === 'todos' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                  }}
                >
                  Histórico Completo
                </button>
              </div>
            </div>
          </div>

          {/* GRID DE TARJETAS DE TICKETS / CAMIONES EN RUTA */}
          {ticketsCombinados.length === 0 ? (
            <div className="content-card" style={{ padding: '48px 20px', textAlign: 'center', color: '#94a3b8' }}>
              <i className="fa-solid fa-truck-moving" style={{ fontSize: '38px', color: '#0284c7', marginBottom: '12px', display: 'block' }}></i>
              <h4 style={{ color: '#1e293b', fontSize: '16px', margin: '0 0 6px 0', fontWeight: 700 }}>
                No hay viajes o camiones registrados para esta fecha ({fechaFiltro})
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '16px' }}>
              {ticketsCombinados.map((item: any) => {
                const esRuta = item._tipoTicket === 'RUTA';
                const esFinalizado =
                  item.estado === 'FINALIZADO' ||
                  item.estado === 'CERRADO' ||
                  item.estadoProceso === 'CERRADO' ||
                  item.procesoActualId === 4;

                const esAbierto = !esFinalizado && (item.estado === 'ABIERTO' || item.procesoActualId === 1);
                const esMiTicket = item.usuarioId === user?.id || item.conductorId === user?.id;
                const puedeEditarTicket = (esAdminOSup || esMiTicket) && esAbierto;
                const tieneRutaLogistica = Boolean((item.rutaLogisticaId && item.rutaLogisticaId > 0) || item.rutaLogisticaNombre || item.rutaNombre);

                const fincasTicket = esRuta
                  ? ((fincasTicketsMap[item.id] && fincasTicketsMap[item.id].length > 0)
                      ? fincasTicketsMap[item.id]
                      : recolecciones.filter((r) => r.controlRutaId === item.id || r.ticketCodigo === item.codigoTicket || r.ticketCodigo === String(item.id)))
                  : [];

                const sumFincasLts = fincasTicket.reduce((acc, f: any) => acc + Number(f.litros ?? f.Litros ?? 0), 0);
                const ltsRecolectados = item._litrosRecogidos > 0 ? item._litrosRecogidos : sumFincasLts;
                const ltsEntregados = item._litrosEntregados || 0;
                const mermaLitros = ltsRecolectados > 0 && ltsEntregados > 0 ? (ltsRecolectados - ltsEntregados) : 0;
                const estaExpandido = Boolean(fincasExpandidas[item.id]);

                const camionMatch = camiones.find((c) => c.id === item.camionId || c.placa === item.camionPlaca);
                const capacidadCisterna = camionMatch?.capacidadLitros || item.capacidadCamionLitros || 10000;
                const porcentajeCisterna = Math.min(100, Math.round((ltsRecolectados / capacidadCisterna) * 100));

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

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {esAbierto && (
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', display: 'inline-block', boxShadow: '0 0 6px #10b981' }} title="Unidad transmitiendo en vivo"></span>
                          )}
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
                      </div>

                      {/* CUERPO DE TARJETA */}
                      <div style={{ padding: '16px' }}>
                        <div style={{ marginBottom: '10px' }}>
                          <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: '2px' }}>
                            {esRuta ? 'Conductor Responsable:' : 'Conductor Asignado:'}
                          </span>
                          <span style={{ fontSize: '14.5px', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <i className="fa-solid fa-user-tie" style={{ color: item._origenColor }}></i>
                            {item._conductor}
                          </span>
                          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <i className="fa-solid fa-truck" style={{ color: '#64748b' }}></i>
                            <span>{placaTexto}</span>
                            <span style={{ color: '#94a3b8' }}>•</span>
                            <span style={{ fontWeight: 700, color: '#334155' }}>Capacidad: {capacidadCisterna.toLocaleString()} L</span>
                          </div>
                          {!esRuta && item.nombreCompania && (
                            <div style={{ fontSize: '12px', color: '#7e22ce', marginTop: '4px', fontWeight: 700 }}>
                              <i className="fa-solid fa-building-wheat" style={{ marginRight: '4px' }}></i>
                              Destino: {item.nombreCompania}
                            </div>
                          )}
                        </div>

                        {/* BADGE DE CIRCUITO ASIGNADO / MODO LIBRE */}
                        {esRuta && (
                          <div style={{ marginBottom: '12px' }}>
                            {tieneRutaLogistica ? (
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
                                  padding: '3px 9px',
                                  borderRadius: '6px',
                                }}
                              >
                                <i className="fa-solid fa-route"></i>
                                Ruta Planificada: {item.rutaLogisticaNombre || item.rutaNombre || `Ruta #${item.rutaLogisticaId}`}
                              </span>
                            ) : (
                              <span
                                className="badge"
                                style={{
                                  background: '#f8fafc',
                                  color: '#475569',
                                  border: '1px solid #cbd5e1',
                                  fontWeight: 700,
                                  fontSize: '11px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                  padding: '3px 9px',
                                  borderRadius: '6px',
                                }}
                              >
                                <i className="fa-solid fa-compass"></i>
                                Modo Libre (Sin Ruta Logística / Paradas Flexibles)
                              </span>
                            )}
                          </div>
                        )}

                        {/* MEDIDOR Y PROGRESS BAR DE CAPACIDAD DE CISTERNA */}
                        {esRuta && (
                          <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '12px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                              <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b' }}>
                                Ocupación Cisterna:
                              </span>
                              <strong style={{ fontSize: '13px', fontWeight: 800, color: porcentajeCisterna >= 95 ? '#dc2626' : '#0284c7' }}>
                                {ltsRecolectados.toLocaleString()} / {capacidadCisterna.toLocaleString()} L ({porcentajeCisterna}%)
                              </strong>
                            </div>
                            <div style={{ width: '100%', height: '7px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                              <div
                                style={{
                                  width: `${porcentajeCisterna}%`,
                                  height: '100%',
                                  background: porcentajeCisterna >= 100 ? '#ef4444' : porcentajeCisterna >= 80 ? '#f59e0b' : '#0284c7',
                                  borderRadius: '4px',
                                  transition: 'width 0.4s ease',
                                }}
                              ></div>
                            </div>
                          </div>
                        )}

                        {/* MÉTRICAS DE LITROS Y ENTREGAS */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                          <div style={{ background: '#eff6ff', padding: '9px 11px', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
                            <span style={{ fontSize: '11px', color: '#1e40af', fontWeight: 700, display: 'block' }}>
                              {esRuta ? 'Litros en Camión:' : 'Litros Despachados:'}
                            </span>
                            <strong style={{ fontSize: '16.5px', color: '#1d4ed8', fontWeight: 800 }}>
                              {ltsRecolectados.toLocaleString('es-VE')} L
                            </strong>
                            {esRuta && (
                              <small style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>
                                {fincasTicket.length} paradas registradas
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
                            <span style={{ fontSize: '11px', color: ltsEntregados > 0 ? '#15803d' : '#b45309', fontWeight: 700, display: 'block' }}>
                              {esRuta ? 'Litros Recibidos:' : 'Litros en Planta:'}
                            </span>
                            <strong style={{ fontSize: '16.5px', color: ltsEntregados > 0 ? '#16a34a' : '#d97706', fontWeight: 800 }}>
                              {ltsEntregados > 0 ? `${ltsEntregados.toLocaleString('es-VE')} L` : 'En Tránsito'}
                            </strong>
                            <small style={{ fontSize: '11px', color: ltsEntregados > 0 ? '#15803d' : '#b45309', display: 'block' }}>
                              {ltsEntregados > 0 ? 'En Receptoría' : 'Pendiente pesaje'}
                            </small>
                          </div>
                        </div>

                        {/* CAJA DE MERMA SI YA HUBO ENTREGA */}
                        {ltsEntregados > 0 && (
                          <div style={{ background: mermaLitros > 0 ? '#fef2f2' : '#f0fdf4', border: `1px solid ${mermaLitros > 0 ? '#fecaca' : '#bbf7d0'}`, borderRadius: '8px', padding: '7px 11px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '11px', fontWeight: 700, color: mermaLitros > 0 ? '#991b1b' : '#166534', textTransform: 'uppercase' }}>
                              {mermaLitros > 0 ? '⚠️ Merma Registrada:' : '✅ Entrega Exacta:'}
                            </span>
                            <strong style={{ fontSize: '14px', fontWeight: 800, color: mermaLitros > 0 ? '#dc2626' : '#16a34a' }}>
                              {mermaLitros > 0 ? `-${mermaLitros.toLocaleString()} Lts` : '0 Lts'}
                            </strong>
                          </div>
                        )}

                        {/* BOTÓN TIMELAPSE (CARACTERÍSTICA PRINCIPAL) */}
                        {esRuta && (
                          <div style={{ marginBottom: '10px' }}>
                            <button
                              type="button"
                              onClick={() => abrirTimelapse(item)}
                              className="btn btn-sm"
                              style={{
                                width: '100%',
                                background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
                                color: '#1d4ed8',
                                border: '1px solid #bfdbfe',
                                fontWeight: 800,
                                fontSize: '12px',
                                padding: '8px 12px',
                                borderRadius: '8px',
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                gap: '8px',
                                cursor: 'pointer',
                              }}
                            >
                              <i className="fa-solid fa-timeline" style={{ color: '#2563eb' }}></i>
                              Ver Timelapse & Recorrido de Paradas ({fincasTicket.length})
                            </button>
                          </div>
                        )}

                        {/* ============================================================= */}
                        {/* ACORDEÓN DE PARADAS: GESTIÓN DE FINCAS DENTRO DEL TICKET       */}
                        {/* ============================================================= */}
                        {esRuta && (
                          <div style={{ marginBottom: '10px' }}>
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                background: '#f8fafc',
                                border: '1px solid #cbd5e1',
                                borderRadius: estaExpandido ? '8px 8px 0 0' : '8px',
                                padding: '8px 12px',
                              }}
                            >
                              <button
                                type="button"
                                onClick={() => toggleAcordeonFincas(item.id)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  padding: 0,
                                  color: '#334155',
                                  fontWeight: 700,
                                  fontSize: '12px',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  flex: 1,
                                  textAlign: 'left',
                                }}
                              >
                                <i className="fa-solid fa-list-check" style={{ color: '#2563eb' }}></i>
                                Paradas / Fincas ({fincasTicket.length})
                                <i className={`fa-solid fa-chevron-${estaExpandido ? 'up' : 'down'}`} style={{ color: '#94a3b8', fontSize: '11px', marginLeft: 'auto' }}></i>
                              </button>

                              {/* BOTÓN + AGREGAR FINCA (DISPONIBLE TANTO EN RUTA COMO EN MODO LIBRE SI ESTÁ ABIERTO) */}
                              {puedeEditarTicket && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setViajeActivo(item);
                                    setFormFinca({ fincaId: 0, litros: '', tipoLeche: 'VACA', esAcida: false, esDiferido: false, fecha: '', observacion: '' });
                                    setModalRegistroFinca(true);
                                  }}
                                  className="btn btn-xs"
                                  style={{
                                    background: '#10b981',
                                    color: '#ffffff',
                                    border: 'none',
                                    fontWeight: 800,
                                    fontSize: '11px',
                                    padding: '3px 8px',
                                    borderRadius: '5px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    cursor: 'pointer',
                                    marginLeft: '8px',
                                  }}
                                  title={tieneRutaLogistica ? 'Añadir finca faltante a esta ruta' : 'Añadir parada a este ticket abierto'}
                                >
                                  <i className="fa-solid fa-plus"></i> {tieneRutaLogistica ? '+ Finca Faltante' : '+ Finca'}
                                </button>
                              )}
                            </div>

                            {/* CONTENIDO EXPANDIBLE DE PARADAS */}
                            {estaExpandido && (
                              <div style={{ maxHeight: '230px', overflowY: 'auto', background: '#ffffff', border: '1px solid #cbd5e1', borderTop: 'none', borderRadius: '0 0 8px 8px', padding: '6px' }}>
                                {fincasTicket.length === 0 ? (
                                  <div style={{ fontSize: '12px', color: '#94a3b8', textAlign: 'center', padding: '14px' }}>
                                    No hay paradas registradas aún.
                                    {puedeEditarTicket && (
                                      <div style={{ marginTop: '6px' }}>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setViajeActivo(item);
                                            setFormFinca({ fincaId: 0, litros: '', tipoLeche: 'VACA', esAcida: false, esDiferido: false, fecha: '', observacion: '' });
                                            setModalRegistroFinca(true);
                                          }}
                                          className="btn btn-xs btn-primary"
                                        >
                                          <i className="fa-solid fa-plus"></i> {tieneRutaLogistica ? 'Añadir Finca Faltante' : 'Añadir primera finca'}
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  fincasTicket.map((f: any, idx: number) => {
                                    const fId = f.id || f.Id || f.rutaId;
                                    const fLitros = Number(f.litros ?? f.Litros ?? 0);
                                    const fNombre = f.fincaNombre || f.FincaNombre || f.finca || `Finca #${f.fincaId || f.FincaId}`;
                                    const fProp = f.propietarioNombre || f.propietario || f.Propietario || 'Productor';
                                    const fTipo = (f.tipoLeche || f.TipoLeche || 'VACA').toUpperCase();
                                    const esBufala = fTipo.includes('BUFAL');
                                    const esAcida = Boolean(f.esAcida || f.EsAcida);

                                    return (
                                      <div
                                        key={fId || idx}
                                        style={{
                                          display: 'flex',
                                          justifyContent: 'space-between',
                                          alignItems: 'center',
                                          padding: '7px 8px',
                                          borderBottom: idx < fincasTicket.length - 1 ? '1px solid #f1f5f9' : 'none',
                                          fontSize: '12px',
                                          borderRadius: '4px',
                                          background: idx % 2 === 0 ? '#fcfcfd' : '#ffffff',
                                        }}
                                      >
                                        <div style={{ flex: 1, minWidth: 0, paddingRight: '8px' }}>
                                          <strong style={{ color: '#0f172a', display: 'block', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                            #{idx + 1} • {fNombre}
                                          </strong>
                                          <span style={{ fontSize: '11px', color: '#64748b' }}>
                                            {fProp} • {esBufala ? '🐃 Búfala' : '🥛 Vaca'}
                                            {esAcida ? ' • ⚠️ Ácida' : ''}
                                          </span>
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                          <span style={{ fontWeight: 800, color: '#2563eb', fontSize: '13px' }}>
                                            {fLitros.toLocaleString()} L
                                          </span>

                                          {/* BOTONES DE EDICIÓN Y ELIMINACIÓN DENTRO DEL TICKET ABIERTO */}
                                          {puedeEditarTicket && (
                                            <div style={{ display: 'flex', gap: '4px' }}>
                                              {/* Editar Litros (disponible para ruta logística y modo libre) */}
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  setViajeActivo(item);
                                                  setFormEditar({
                                                    id: fId,
                                                    fincaId: f.fincaId || f.FincaId,
                                                    litros: fLitros,
                                                    tipoLeche: fTipo,
                                                    esAcida: esAcida,
                                                    esDiferido: Boolean(f.esDiferido || f.EsDiferido),
                                                    fecha: f.fecha || item.fecha || '',
                                                    observacion: f.observacion || f.Observacion || '',
                                                  });
                                                  setModalEditarRecoleccion(true);
                                                }}
                                                className="btn btn-xs btn-outline"
                                                style={{ padding: '3px 6px', borderColor: '#bfdbfe', color: '#1d4ed8' }}
                                                title="Editar litros de esta finca"
                                              >
                                                <i className="fa-solid fa-pen-to-square"></i>
                                              </button>

                                              {/* Quitar Parada (modo libre o admin/supervisor en ruta) */}
                                              {(esAdminOSup || !tieneRutaLogistica) && (
                                                <button
                                                  type="button"
                                                  onClick={async () => {
                                                    if (
                                                      await confirmDialog({
                                                        title: '¿Quitar Finca del Viaje?',
                                                        text: `¿Seguro que deseas remover la parada de "${fNombre}" (${fLitros.toLocaleString()} Lts) del ticket #${item.codigoTicket || item.id}?`,
                                                        icon: 'warning',
                                                        confirmButtonText: 'Sí, remover',
                                                        danger: true,
                                                      })
                                                    ) {
                                                      setViajeActivo(item);
                                                      eliminarRecoleccionMutation.mutate(fId);
                                                    }
                                                  }}
                                                  className="btn btn-xs btn-outline"
                                                  style={{ padding: '3px 6px', borderColor: '#fecaca', color: '#dc2626' }}
                                                  title="Remover finca de este viaje"
                                                >
                                                  <i className="fa-solid fa-trash-can"></i>
                                                </button>
                                              )}
                                            </div>
                                          )}
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

                    {/* ============================================================= */}
                    {/* BOTONERA INFERIOR DE ACCIONES OPERATIVAS DEL VIAJE           */}
                    {/* ============================================================= */}
                    <div style={{ borderTop: '1px solid #f1f5f9', padding: '12px 16px', background: '#ffffff' }}>
                      {esRuta && !esFinalizado ? (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
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

                          <button
                            type="button"
                            onClick={() => {
                              setViajeActivo(item);
                              setFormCerrar({ odometroFinalKm: '', observaciones: '' });
                              setModalCerrarViaje(true);
                            }}
                            className="btn btn-sm"
                            style={{
                              background: '#fef2f2',
                              color: '#b91c1c',
                              border: '1px solid #fecaca',
                              fontWeight: 700,
                              fontSize: '11px',
                              padding: '6px 2px',
                              borderRadius: '6px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '4px',
                            }}
                            title="Finalizar y cerrar este ticket"
                          >
                            <i className="fa-solid fa-lock"></i> Finalizar
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: '#64748b' }}>
                          <span style={{ fontWeight: 700 }}>
                            <i className="fa-solid fa-circle-check" style={{ color: '#10b981', marginRight: '6px' }}></i>
                            Viaje {esFinalizado ? 'Cerrado / Auditado' : 'Procesado'}
                          </span>
                          <span style={{ fontSize: '11px', fontFamily: 'monospace' }}>
                            {new Date(item.fecha).toLocaleDateString('es-VE')}
                          </span>
                        </div>
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
      {/* VISTA 2: DETALLE POR FINCAS (HISTORIAL / BUSCADOR - SOLO LECTURA)          */}
      {/* ========================================================================= */}
      {modoVista === 'fincas' && (
        <div className="space-y-4">
          {/* TARJETAS RESUMEN DE LITROS Y CALIDAD */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
            <div className="content-card" style={{ padding: '14px 16px', borderLeft: '4px solid #0284c7', borderRadius: '10px' }}>
              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Total Litros Recogidos</span>
              <strong style={{ fontSize: '20px', color: '#0284c7', display: 'block', marginTop: '4px', fontWeight: 800 }}>
                {totalesRecoleccion.total.toLocaleString()} Lts
              </strong>
            </div>

            <div className="content-card" style={{ padding: '14px 16px', borderLeft: '4px solid #16a34a', borderRadius: '10px' }}>
              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>🥛 Leche de Vaca</span>
              <strong style={{ fontSize: '20px', color: '#16a34a', display: 'block', marginTop: '4px', fontWeight: 800 }}>
                {totalesRecoleccion.vaca.toLocaleString()} Lts
              </strong>
            </div>

            <div className="content-card" style={{ padding: '14px 16px', borderLeft: '4px solid #9333ea', borderRadius: '10px' }}>
              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>🐃 Leche de Búfala</span>
              <strong style={{ fontSize: '20px', color: '#9333ea', display: 'block', marginTop: '4px', fontWeight: 800 }}>
                {totalesRecoleccion.bufala.toLocaleString()} Lts
              </strong>
            </div>

            <div className="content-card" style={{ padding: '14px 16px', borderLeft: '4px solid #dc2626', borderRadius: '10px' }}>
              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>⚠️ Leche Ácida</span>
              <strong style={{ fontSize: '20px', color: '#dc2626', display: 'block', marginTop: '4px', fontWeight: 800 }}>
                {totalesRecoleccion.acida.toLocaleString()} Lts
              </strong>
            </div>

            <div className="content-card" style={{ padding: '14px 16px', borderLeft: '4px solid #4f46e5', borderRadius: '10px' }}>
              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Fincas Recolectadas</span>
              <strong style={{ fontSize: '20px', color: '#4f46e5', display: 'block', marginTop: '4px', fontWeight: 800 }}>
                {recolecciones.length} Fincas
              </strong>
            </div>
          </div>

          {/* TABLA HISTORIAL / BUSCADOR (SIN EDICIÓN NI ELIMINACIÓN) */}
          <div className="content-card" style={{ padding: '20px', borderRadius: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="fa-solid fa-clock-rotate-left" style={{ color: '#2563eb' }}></i>
                  Historial & Buscador General de Recolecciones en Campo ({fechaFiltro})
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                  Auditoría de cargas por finca. La edición o remoción de paradas se realiza estrictamente dentro del ticket correspondiente mientras esté abierto.
                </p>
              </div>
            </div>

            <DataTable
              data={recolecciones}
              columns={columnsRecolecciones}
              isLoading={loadingRecolecciones}
              searchPlaceholder="Buscar por finca, ganadero, conductor, ticket..."
              exportFileName={`recolecciones_campo_${fechaFiltro}`}
              pageSizeDefault={15}
            />
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: TIMELAPSE DE RECORRIDO (SECUENCIA Y HORAS DE PARADAS)            */}
      {/* ========================================================================= */}
      {modalTimelapse && timelapseData && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(4px)', padding: '16px' }}>
          <div className="content-card" style={{ width: '100%', maxWidth: '780px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: 0, borderRadius: '16px', overflow: 'hidden' }}>
            {/* CABECERA TIMELAPSE */}
            <div style={{ padding: '20px 24px', background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', color: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span className="badge" style={{ background: '#3b82f6', color: '#ffffff', fontWeight: 800, fontSize: '11px' }}>
                    <i className="fa-solid fa-truck"></i> {timelapseData.camion}
                  </span>
                  <span style={{ fontSize: '13px', color: '#94a3b8' }}>• Chofer: <strong style={{ color: '#ffffff' }}>{timelapseData.chofer}</strong></span>
                </div>
                <h3 style={{ margin: 0, fontSize: '19px', fontWeight: 800 }}>
                  <i className="fa-solid fa-timeline" style={{ color: '#38bdf8', marginRight: '8px' }}></i>
                  Timelapse de Paradas — {timelapseData.rutaNombre}
                </h3>
              </div>
              <button type="button" onClick={() => setModalTimelapse(false)} style={{ background: 'none', border: 'none', fontSize: '20px', color: '#94a3b8', cursor: 'pointer' }}>
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            {/* BARRA DE PROGRESO DE CARGA */}
            <div style={{ background: '#f8fafc', padding: '14px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <span style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Carga a Bordo / Capacidad</span>
                <div style={{ fontSize: '17px', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>
                  {timelapseData.totalLitros.toLocaleString()} / {timelapseData.capacidadMax.toLocaleString()} Lts ({timelapseData.porcentajeLlenado}%)
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Progreso del Circuito</span>
                <div style={{ fontSize: '15px', fontWeight: 800, color: '#2563eb', marginTop: '2px' }}>
                  {timelapseData.paradas.length} {timelapseData.tieneRuta ? `de ${timelapseData.totalParadasEstimadas} paradas` : 'paradas registradas'}
                </div>
              </div>
            </div>

            {/* CUERPO CON LÍNEA DE TIEMPO */}
            <div style={{ padding: '24px', overflowY: 'auto', flex: 1, maxHeight: '55vh' }}>
              {timelapseData.paradas.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                  <i className="fa-solid fa-clock" style={{ fontSize: '36px', opacity: 0.5, marginBottom: '10px', display: 'block' }}></i>
                  El camión aún no ha registrado la primera parada en fincas.
                </div>
              ) : (
                <div style={{ position: 'relative', paddingLeft: '32px' }}>
                  <div style={{ position: 'absolute', left: '11px', top: '12px', bottom: '12px', width: '3px', background: '#e2e8f0', borderRadius: '2px' }}></div>

                  {timelapseData.paradas.map((p, idx) => {
                    const timeStamp = p.createdAt || (p as any).CreatedAt;
                    const horaStr = timeStamp
                      ? new Date(timeStamp).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                      : p.horaRecoleccion || 'Registrado';
                    const esBufala = (p.tipoLeche || '').toUpperCase().includes('BUFAL');

                    return (
                      <div key={p.id} style={{ position: 'relative', marginBottom: '20px' }}>
                        <div
                          style={{
                            position: 'absolute',
                            left: '-32px',
                            top: '4px',
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            background: '#10b981',
                            color: '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '11px',
                            fontWeight: 800,
                            boxShadow: '0 0 0 4px #d1fae5',
                          }}
                        >
                          {idx + 1}
                        </div>

                        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                            <div>
                              <strong style={{ fontSize: '14.5px', color: '#0f172a' }}>
                                #{idx + 1} • {p.fincaNombre || `Finca #${p.fincaId}`}
                              </strong>
                              <span style={{ fontSize: '12px', color: '#64748b', display: 'block', marginTop: '2px' }}>
                                Productor: {p.propietarioNombre || p.propietario || 'No especificado'}
                              </span>
                            </div>

                            <div style={{ textAlign: 'right' }}>
                              <span style={{ fontSize: '16px', fontWeight: 800, color: '#2563eb' }}>
                                +{p.litros.toLocaleString()} Lts
                              </span>
                              <span style={{ fontSize: '11px', color: '#64748b', display: 'block', marginTop: '2px' }}>
                                Hora: <strong style={{ color: '#0f172a' }}>{horaStr}</strong>
                              </span>
                            </div>
                          </div>

                          <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11.5px' }}>
                            <span style={{ color: '#64748b' }}>
                              Acumulado en cisterna: <strong style={{ color: '#0284c7' }}>{p.acumulado.toLocaleString()} Lts</strong> ({p.porcentajeCarga}%)
                            </span>
                            {p.minutosDesdeAnterior !== null && (
                              <span style={{ color: '#059669', fontWeight: 700, background: '#ecfdf5', padding: '2px 8px', borderRadius: '6px' }}>
                                ⏱️ {p.minutosDesdeAnterior} min de trayecto
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* PARADAS PENDIENTES SI TIENE RUTA LOGÍSTICA */}
              {timelapseData.tieneRuta && timelapseData.pendientes.length > 0 && (
                <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '2px dashed #e2e8f0' }}>
                  <h4 style={{ fontSize: '13px', fontWeight: 800, color: '#b45309', margin: '0 0 12px 0', textTransform: 'uppercase' }}>
                    <i className="fa-solid fa-hourglass-half" style={{ marginRight: '6px' }}></i>
                    Paradas Faltantes de la Ruta ({timelapseData.pendientes.length})
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '8px' }}>
                    {timelapseData.pendientes.map((f, i) => (
                      <div key={f.id} style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '10px', fontSize: '12px' }}>
                        <strong style={{ color: '#92400e', display: 'block' }}>
                          #{timelapseData.paradas.length + i + 1} • {f.nombre}
                        </strong>
                        <span style={{ fontSize: '11px', color: '#b45309' }}>
                          {f.propietarioNombre || 'Productor'} • ~{getPromedioFinca(f.id, f)} Lts/d
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div style={{ padding: '14px 24px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setModalTimelapse(false)} className="btn btn-outline" style={{ fontWeight: 700 }}>
                Cerrar Ventana
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: INICIAR NUEVO VIAJE (MULTISELECCIÓN DE RUTAS & VALIDACIÓN ±15%)  */}
      {/* ========================================================================= */}
      {modalIniciarViaje && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)', padding: '16px' }}>
          <div className="content-card" style={{ width: '100%', maxWidth: '580px', maxHeight: '92vh', overflowY: 'auto', padding: '24px', borderRadius: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '14px', marginBottom: '16px', borderBottom: '1px solid #e2e8f0' }}>
              <div>
                <h3 style={{ fontSize: '17px', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                  <i className="fa-solid fa-play" style={{ color: '#10b981', marginRight: '8px' }}></i>
                  Iniciar Nuevo Viaje de Recolección
                </h3>
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  Asigna cisterna, chofer y las rutas planificadas para auditar la capacidad del tanque.
                </span>
              </div>
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontWeight: 700 }}>Fecha Operativa *</label>
                  <input
                    type="date"
                    value={formIniciar.fecha}
                    onChange={(e) => setFormIniciar({ ...formIniciar, fecha: e.target.value })}
                    className="form-input"
                    required
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontWeight: 700 }}>Chofer Responsable *</label>
                  <ChoferSelect
                    value={formIniciar.choferId}
                    onChange={(id) => setFormIniciar({ ...formIniciar, choferId: id })}
                    required
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label" style={{ fontWeight: 700 }}>Camión / Cisterna *</label>
                <CamionSelect
                  value={formIniciar.camionId}
                  onChange={(id) => setFormIniciar({ ...formIniciar, camionId: id })}
                  required
                />
              </div>

              {/* ============================================================= */}
              {/* SELECTOR MÚLTIPLE DE RUTAS LOGÍSTICAS (INTERACTIVO 1:1)       */}
              {/* ============================================================= */}
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label className="form-label" style={{ fontWeight: 800, margin: 0, color: '#0f172a' }}>
                    <i className="fa-solid fa-route" style={{ color: '#2563eb', marginRight: '6px' }}></i>
                    Ruta(s) Logística(s) Asignada(s)
                  </label>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>
                    {formIniciar.rutasLogisticasIds.length === 0 ? 'Modo Libre activo' : `${formIniciar.rutasLogisticasIds.length} seleccionada(s)`}
                  </span>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', padding: '10px', background: '#f8fafc', border: '1.5px solid #cbd5e1', borderRadius: '9px', maxHeight: '140px', overflowY: 'auto' }}>
                  {rutasLogistica.length === 0 ? (
                    <span style={{ fontSize: '12px', color: '#94a3b8' }}>No hay rutas registradas en el catálogo.</span>
                  ) : (
                    rutasLogistica.map((r: any) => {
                      const isChecked = formIniciar.rutasLogisticasIds.includes(r.id);
                      const fincasDeEsta = fincas.filter((f) => f.rutaId === r.id);
                      const ltsEstimadosEsta = fincasDeEsta.reduce((acc, f) => acc + getPromedioFinca(f.id, f), 0);

                      return (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => {
                            setFormIniciar((prev) => {
                              const exists = prev.rutasLogisticasIds.includes(r.id);
                              const newIds = exists
                                ? prev.rutasLogisticasIds.filter((id) => id !== r.id)
                                : [...prev.rutasLogisticasIds, r.id];
                              return {
                                ...prev,
                                rutasLogisticasIds: newIds,
                                rutaLogisticaId: newIds.length > 0 ? newIds[0] : 0,
                              };
                            });
                          }}
                          style={{
                            border: isChecked ? '1.5px solid #2563eb' : '1px solid #cbd5e1',
                            background: isChecked ? '#eff6ff' : '#ffffff',
                            color: isChecked ? '#1d4ed8' : '#475569',
                            fontWeight: isChecked ? 800 : 600,
                            padding: '6px 12px',
                            borderRadius: '7px',
                            fontSize: '12px',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <i className={`fa-${isChecked ? 'solid fa-check-circle' : 'regular fa-circle'}`} style={{ color: isChecked ? '#2563eb' : '#94a3b8' }}></i>
                          {r.nombre}
                          <span style={{ fontSize: '10.5px', opacity: 0.8 }}>
                            (~{ltsEstimadosEsta.toLocaleString()} L)
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
                {formIniciar.rutasLogisticasIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setFormIniciar({ ...formIniciar, rutasLogisticasIds: [], rutaLogisticaId: 0 })}
                    style={{ background: 'none', border: 'none', padding: '4px 0', fontSize: '11px', color: '#dc2626', fontWeight: 700, cursor: 'pointer', marginTop: '4px' }}
                  >
                    <i className="fa-solid fa-xmark"></i> Desmarcar todas (Operar en Modo Libre)
                  </button>
                )}
              </div>

              {/* ============================================================= */}
              {/* EVALUACIÓN DE CAPACIDAD DEL TANQUE VS PROMEDIO SEMANAL (±15%) */}
              {/* ============================================================= */}
              {calculoCapacidadModal.capacidad > 0 && formIniciar.rutasLogisticasIds.length > 0 && (
                <div
                  style={{
                    marginBottom: '16px',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    border: calculoCapacidadModal.estado === 'EXCESO'
                      ? '1.5px solid #f59e0b'
                      : calculoCapacidadModal.estado === 'BAJO'
                      ? '1.5px solid #93c5fd'
                      : '1.5px solid #86efac',
                    background: calculoCapacidadModal.estado === 'EXCESO'
                      ? '#fffbeb'
                      : calculoCapacidadModal.estado === 'BAJO'
                      ? '#eff6ff'
                      : '#f0fdf4',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <strong style={{ fontSize: '12.5px', color: calculoCapacidadModal.estado === 'EXCESO' ? '#b45309' : calculoCapacidadModal.estado === 'BAJO' ? '#1e40af' : '#15803d' }}>
                      {calculoCapacidadModal.estado === 'EXCESO' ? '⚠️ Alerta de Capacidad de Tanque' : calculoCapacidadModal.estado === 'BAJO' ? 'ℹ️ Capacidad Subutilizada' : '✅ Capacidad Óptima'}
                    </strong>

                    {/* Selector de Tolerancia configurable */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#64748b' }}>
                      <span>Tolerancia:</span>
                      {[10, 15, 20].map((tol) => (
                        <button
                          key={tol}
                          type="button"
                          onClick={() => setFormIniciar({ ...formIniciar, toleranciaPorcentaje: tol })}
                          style={{
                            border: formIniciar.toleranciaPorcentaje === tol ? '1px solid #2563eb' : '1px solid #cbd5e1',
                            background: formIniciar.toleranciaPorcentaje === tol ? '#2563eb' : '#ffffff',
                            color: formIniciar.toleranciaPorcentaje === tol ? '#ffffff' : '#64748b',
                            fontWeight: 700,
                            padding: '1px 5px',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '10.5px',
                          }}
                        >
                          ±{tol}%
                        </button>
                      ))}
                    </div>
                  </div>

                  <p style={{ margin: '0 0 6px 0', fontSize: '12px', color: '#334155', lineHeight: 1.4 }}>
                    Las rutas seleccionadas suman <strong>{calculoCapacidadModal.fincasDeRutas.length} fincas</strong> con un promedio semanal estimado de{' '}
                    <strong>~{calculoCapacidadModal.litrosEstimados.toLocaleString()} Lts</strong> contra una capacidad de cisterna de{' '}
                    <strong>{calculoCapacidadModal.capacidad.toLocaleString()} Lts</strong> ({calculoCapacidadModal.porcentajeDesviacion > 0 ? `+${calculoCapacidadModal.porcentajeDesviacion.toFixed(1)}%` : `${calculoCapacidadModal.porcentajeDesviacion.toFixed(1)}%`}).
                  </p>

                  {calculoCapacidadModal.estado === 'EXCESO' && (
                    <span style={{ fontSize: '11px', color: '#b45309', display: 'block', fontWeight: 700 }}>
                      ⚠️ El volumen promedio supera la capacidad del tanque, pero puedes iniciar el viaje de todas formas si la producción esperada de hoy ha bajado por la temporada.
                    </span>
                  )}
                </div>
              )}

              {formIniciar.rutasLogisticasIds.length === 0 && (
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 12px', marginBottom: '14px', fontSize: '12px', color: '#64748b' }}>
                  <i className="fa-solid fa-compass" style={{ color: '#0284c7', marginRight: '6px' }}></i>
                  <strong>Operación sin Ruta Logística (Modo Libre):</strong> El chofer o supervisor agregará las fincas y paradas recolectadas directamente durante la jornada.
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Odómetro Inicial (Km)</label>
                  <input
                    type="number"
                    value={formIniciar.odometroInicialKm}
                    onChange={(e) => setFormIniciar({ ...formIniciar, odometroInicialKm: e.target.value })}
                    className="form-input"
                    placeholder="Ej: 145000"
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Observaciones</label>
                  <input
                    type="text"
                    value={formIniciar.observaciones}
                    onChange={(e) => setFormIniciar({ ...formIniciar, observaciones: e.target.value })}
                    className="form-input"
                    placeholder="Notas o turno..."
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', paddingTop: '10px', borderTop: '1px solid #f1f5f9' }}>
                <button type="button" onClick={() => setModalIniciarViaje(false)} className="btn btn-outline">
                  Cancelar
                </button>
                <button type="submit" disabled={iniciarMutation.isPending} className="btn btn-primary" style={{ fontWeight: 800, background: '#10b981' }}>
                  {iniciarMutation.isPending ? 'Iniciando...' : 'Iniciar Viaje'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: REGISTRAR PARADA EN FINCA (DENTRO DEL TICKET ABIERTO)            */}
      {/* ========================================================================= */}
      {modalRegistroFinca && viajeActivo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-xl bg-white rounded-2xl border border-slate-300 shadow-2xl overflow-hidden flex flex-col my-auto" style={{ maxHeight: '92vh' }}>
            {/* CABECERA CON GRADIENTE OSCURO PREMIUM */}
            <div
              className="p-5 flex items-center justify-between border-b border-white/10 shrink-0"
              style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 55%, #0369a1 100%)' }}
            >
              <div className="flex items-center gap-3.5">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center text-xl text-emerald-400 shrink-0 shadow-xs"
                  style={{
                    background: 'rgba(16, 185, 129, 0.18)',
                    border: '1.5px solid rgba(52, 211, 153, 0.35)',
                  }}
                >
                  <i className="fa-solid fa-cow"></i>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="m-0 text-base font-extrabold text-white">
                      Agregar Finca al Ticket #{viajeActivo.codigoTicket || viajeActivo.id}
                    </h3>
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 uppercase tracking-wider">
                      {viajeActivo.estado || 'ABIERTO'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs text-sky-200">
                    <span>
                      <i className="fa-solid fa-user-tie text-sky-300 mr-1"></i>
                      Chofer: <strong>{viajeActivo.choferNombre || viajeActivo.nombreConductor || 'Conductor'}</strong>
                    </span>
                    <span className="text-white/40">•</span>
                    <span>
                      <i className="fa-solid fa-truck-moving text-sky-300 mr-1"></i>
                      {viajeActivo.camionPlaca || 'Cisterna'}
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalRegistroFinca(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 text-2xl transition-colors cursor-pointer"
                title="Cerrar modal"
              >
                &times;
              </button>
            </div>

            {/* FORMULARIO */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!formFinca.fincaId || formFinca.fincaId <= 0) {
                  toast.error('Seleccione una finca ganadera');
                  return;
                }
                if (!formFinca.litros || Number(formFinca.litros) <= 0) {
                  toast.error('Ingrese una cantidad válida de litros');
                  return;
                }
                guardarRecoleccionModalMutation.mutate(formFinca);
              }}
              className="flex flex-col flex-1 overflow-hidden"
            >
              <div className="p-5 md:p-6 overflow-y-auto space-y-4 flex-1">
                {/* 1. BANNER ELEGANTE DE FECHA OPERATIVA Y ASOCIACIÓN AL TICKET */}
                <div className="bg-gradient-to-r from-sky-50 to-indigo-50 border-[1.5px] border-sky-200 rounded-xl p-3.5 flex items-center justify-between gap-3 shadow-2xs">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-sky-600 text-white flex items-center justify-center text-lg shadow-xs shrink-0">
                      <i className="fa-regular fa-calendar-days"></i>
                    </div>
                    <div>
                      <div className="text-[11px] font-black text-sky-800 uppercase tracking-wider flex items-center gap-1.5">
                        <span>Fecha de Carga / Recolección</span>
                        <span className="text-[10px] bg-sky-200/80 text-sky-900 px-1.5 py-0.2 rounded font-bold">Asociada al Ticket</span>
                      </div>
                      <div className="text-sm font-extrabold text-slate-900 mt-0.5 flex items-center gap-2">
                        <span>
                          {viajeActivo.fecha
                            ? new Date(viajeActivo.fecha).toLocaleDateString('es-VE', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
                            : new Date().toLocaleDateString('es-VE')}
                        </span>
                        <span className="inline-block text-[11px] font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 border border-indigo-200">
                          Semana #{viajeActivo.cicloId || '-'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="hidden sm:block text-right">
                    <span className="text-[10.5px] font-bold text-slate-500 block">Identificador</span>
                    <span className="font-mono text-xs font-black text-sky-700 bg-white px-2 py-0.5 rounded border border-sky-200 shadow-2xs">
                      TKT-#{viajeActivo.id}
                    </span>
                  </div>
                </div>

                {/* 2. FINCA GANADERA */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <i className="fa-solid fa-location-dot text-emerald-600"></i>
                      Finca Ganadera *
                    </span>
                    {formFinca.fincaId > 0 && (
                      <span className="text-[11px] text-slate-500 font-medium">
                        {fincas.find((f) => f.id === formFinca.fincaId)?.propietario
                          ? `Productor: ${fincas.find((f) => f.id === formFinca.fincaId)?.propietario}`
                          : ''}
                      </span>
                    )}
                  </label>
                  <FincaSelect
                    value={formFinca.fincaId}
                    onChange={(id) => {
                      const fMatch = fincas.find((f) => f.id === id);
                      const esBuf = (fMatch?.tipoLeche || '').toUpperCase().includes('BUFAL');
                      setFormFinca({
                        ...formFinca,
                        fincaId: id,
                        tipoLeche: esBuf ? 'BUFALA' : (formFinca.tipoLeche || 'VACA'),
                      });
                    }}
                    required
                  />
                </div>

                {/* 3. LITROS RECOLECTADOS & TIPO DE LECHE */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <i className="fa-solid fa-faucet-drip text-blue-600"></i>
                      Litros Recolectados *
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={formFinca.litros}
                        onChange={(e) => setFormFinca({ ...formFinca, litros: e.target.value })}
                        className="w-full h-11 pl-3 pr-12 rounded-xl border-[1.5px] border-slate-300 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 font-mono font-black text-lg text-slate-900 transition-all placeholder:text-slate-400 placeholder:font-normal"
                        placeholder="Ej: 450"
                        min="1"
                        required
                        autoFocus
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400 pointer-events-none">
                        LTS
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <i className="fa-solid fa-cow text-sky-600"></i>
                      Tipo de Leche *
                    </label>
                    <div className="grid grid-cols-2 gap-2 h-11">
                      <button
                        type="button"
                        onClick={() => setFormFinca({ ...formFinca, tipoLeche: 'VACA' })}
                        className={`h-full rounded-xl border-[1.5px] font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                          formFinca.tipoLeche === 'VACA'
                            ? 'bg-blue-50 border-blue-500 text-blue-800 shadow-2xs'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <span>🥛</span>
                        <span>Vaca</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormFinca({ ...formFinca, tipoLeche: 'BUFALA' })}
                        className={`h-full rounded-xl border-[1.5px] font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                          formFinca.tipoLeche === 'BUFALA'
                            ? 'bg-purple-50 border-purple-500 text-purple-800 shadow-2xs'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <span>🐃</span>
                        <span>Búfala</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* 4. OPCIONES OPERATIVAS: DIFERIDO Y CALIDAD */}
                <div className="space-y-2.5 pt-1">
                  {/* OPCIÓN DIFERIR LITROS */}
                  <div
                    onClick={() => setFormFinca({ ...formFinca, esDiferido: !formFinca.esDiferido })}
                    className={`p-3.5 rounded-xl border-[1.5px] transition-all cursor-pointer select-none ${
                      formFinca.esDiferido
                        ? 'bg-amber-50/90 border-amber-400 shadow-xs'
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={formFinca.esDiferido}
                        onChange={(e) => setFormFinca({ ...formFinca, esDiferido: e.target.checked })}
                        onClick={(e) => e.stopPropagation()}
                        className="w-5 h-5 rounded border-slate-300 text-amber-600 focus:ring-amber-500 mt-0.5 cursor-pointer"
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-amber-950 flex items-center gap-1.5">
                            <i className="fa-solid fa-clock-rotate-left text-amber-600"></i>
                            Diferir Litros para el Siguiente Ciclo
                          </span>
                          <span
                            className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                              formFinca.esDiferido ? 'bg-amber-200 text-amber-900' : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {formFinca.esDiferido ? 'Diferido Activo' : 'Liquidación Normal'}
                          </span>
                        </div>
                        <p className="text-[11.5px] text-slate-600 m-0 mt-1 leading-snug">
                          Suma de inmediato al volumen de leche recolectada del camión en ruta, pero <strong>pospone el cálculo de pago</strong> para la liquidación de la próxima semana.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* OPCIÓN LECHE ÁCIDA */}
                  <div
                    onClick={() => setFormFinca({ ...formFinca, esAcida: !formFinca.esAcida })}
                    className={`p-3.5 rounded-xl border-[1.5px] transition-all cursor-pointer select-none ${
                      formFinca.esAcida
                        ? 'bg-rose-50/90 border-rose-400 shadow-xs'
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={formFinca.esAcida}
                        onChange={(e) => setFormFinca({ ...formFinca, esAcida: e.target.checked })}
                        onClick={(e) => e.stopPropagation()}
                        className="w-5 h-5 rounded border-slate-300 text-rose-600 focus:ring-rose-500 mt-0.5 cursor-pointer"
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-rose-950 flex items-center gap-1.5">
                            <i className="fa-solid fa-triangle-exclamation text-rose-600"></i>
                            ¿Es Leche Ácida / Deteriorada?
                          </span>
                          <span
                            className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                              formFinca.esAcida ? 'bg-rose-200 text-rose-900' : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {formFinca.esAcida ? 'Leche Ácida' : 'Leche Dulce'}
                          </span>
                        </div>
                        <p className="text-[11.5px] text-slate-600 m-0 mt-1 leading-snug">
                          Aplica tarifa especial de leche ácida y marca la parada para recepción segregada en silo o receptoría.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 5. OBSERVACIONES */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <i className="fa-regular fa-comment-dots text-slate-500"></i>
                    Observación Operativa (Opcional)
                  </label>
                  <input
                    type="text"
                    value={formFinca.observacion}
                    onChange={(e) => setFormFinca({ ...formFinca, observacion: e.target.value })}
                    className="w-full h-10 px-3 rounded-xl border-[1.5px] border-slate-300 focus:border-sky-600 focus:ring-2 focus:ring-sky-100 text-xs text-slate-800 transition-all placeholder:text-slate-400"
                    placeholder="Ej: Muestra tomada en caneca, recolección con retraso..."
                  />
                </div>
              </div>

              {/* PIE DE ACCIONES */}
              <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setModalRegistroFinca(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 transition-all cursor-pointer shadow-2xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardarRecoleccionModalMutation.isPending}
                  className="px-5 py-2 rounded-xl text-xs font-extrabold text-white transition-all flex items-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)' }}
                >
                  {guardarRecoleccionModalMutation.isPending ? (
                    <>
                      <i className="fa-solid fa-circle-notch fa-spin text-xs"></i>
                      Guardando...
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-check"></i>
                      Guardar Parada
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: EDITAR PARADA EN FINCA (DENTRO DEL TICKET ABIERTO)               */}
      {/* ========================================================================= */}
      {modalEditarRecoleccion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-lg bg-white rounded-2xl border border-slate-300 shadow-2xl overflow-hidden flex flex-col my-auto" style={{ maxHeight: '92vh' }}>
            {/* CABECERA */}
            <div
              className="p-5 flex items-center justify-between border-b border-white/10 shrink-0"
              style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 55%, #2563eb 100%)' }}
            >
              <div className="flex items-center gap-3.5">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center text-xl text-blue-400 shrink-0 shadow-xs"
                  style={{
                    background: 'rgba(37, 99, 235, 0.2)',
                    border: '1.5px solid rgba(96, 165, 250, 0.4)',
                  }}
                >
                  <i className="fa-solid fa-pen-to-square"></i>
                </div>
                <div>
                  <h3 className="m-0 text-base font-extrabold text-white">
                    Editar Parada de Finca
                  </h3>
                  <p className="m-0 text-xs text-blue-200 mt-0.5">
                    Modificación de litros y condiciones operativas en ticket abierto
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalEditarRecoleccion(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 text-2xl transition-colors cursor-pointer"
                title="Cerrar modal"
              >
                &times;
              </button>
            </div>

            {/* FORMULARIO EDITAR */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!formEditar.litros || Number(formEditar.litros) <= 0) {
                  toast.error('Ingrese una cantidad válida de litros');
                  return;
                }
                editarRecoleccionMutation.mutate(formEditar);
              }}
              className="flex flex-col flex-1 overflow-hidden"
            >
              <div className="p-5 md:p-6 overflow-y-auto space-y-4 flex-1">
                {/* 1. LITROS RECOLECTADOS & TIPO DE LECHE */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <i className="fa-solid fa-faucet-drip text-blue-600"></i>
                      Litros Recolectados *
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={formEditar.litros || ''}
                        onChange={(e) => setFormEditar({ ...formEditar, litros: Number(e.target.value) })}
                        className="w-full h-11 pl-3 pr-12 rounded-xl border-[1.5px] border-slate-300 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 font-mono font-black text-lg text-slate-900 transition-all"
                        min="1"
                        required
                        autoFocus
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400 pointer-events-none">
                        LTS
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <i className="fa-solid fa-cow text-sky-600"></i>
                      Tipo de Leche *
                    </label>
                    <div className="grid grid-cols-2 gap-2 h-11">
                      <button
                        type="button"
                        onClick={() => setFormEditar({ ...formEditar, tipoLeche: 'VACA' })}
                        className={`h-full rounded-xl border-[1.5px] font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                          formEditar.tipoLeche === 'VACA'
                            ? 'bg-blue-50 border-blue-500 text-blue-800 shadow-2xs'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <span>🥛</span>
                        <span>Vaca</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormEditar({ ...formEditar, tipoLeche: 'BUFALA' })}
                        className={`h-full rounded-xl border-[1.5px] font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                          formEditar.tipoLeche === 'BUFALA'
                            ? 'bg-purple-50 border-purple-500 text-purple-800 shadow-2xs'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <span>🐃</span>
                        <span>Búfala</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* 2. OPCIONES DIFERIDO Y ÁCIDA */}
                <div className="space-y-2.5 pt-1">
                  {/* DIFERIDO */}
                  <div
                    onClick={() => setFormEditar({ ...formEditar, esDiferido: !formEditar.esDiferido })}
                    className={`p-3.5 rounded-xl border-[1.5px] transition-all cursor-pointer select-none ${
                      formEditar.esDiferido
                        ? 'bg-amber-50/90 border-amber-400 shadow-xs'
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={formEditar.esDiferido}
                        onChange={(e) => setFormEditar({ ...formEditar, esDiferido: e.target.checked })}
                        onClick={(e) => e.stopPropagation()}
                        className="w-5 h-5 rounded border-slate-300 text-amber-600 focus:ring-amber-500 mt-0.5 cursor-pointer"
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-amber-950 flex items-center gap-1.5">
                            <i className="fa-solid fa-clock-rotate-left text-amber-600"></i>
                            Diferir Litros para el Siguiente Ciclo
                          </span>
                          <span
                            className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                              formEditar.esDiferido ? 'bg-amber-200 text-amber-900' : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {formEditar.esDiferido ? 'Diferido Activo' : 'Liquidación Normal'}
                          </span>
                        </div>
                        <p className="text-[11.5px] text-slate-600 m-0 mt-1 leading-snug">
                          Suma al volumen del camión, pero se liquida y paga en la semana operativa siguiente.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* ÁCIDA */}
                  <div
                    onClick={() => setFormEditar({ ...formEditar, esAcida: !formEditar.esAcida })}
                    className={`p-3.5 rounded-xl border-[1.5px] transition-all cursor-pointer select-none ${
                      formEditar.esAcida
                        ? 'bg-rose-50/90 border-rose-400 shadow-xs'
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={formEditar.esAcida}
                        onChange={(e) => setFormEditar({ ...formEditar, esAcida: e.target.checked })}
                        onClick={(e) => e.stopPropagation()}
                        className="w-5 h-5 rounded border-slate-300 text-rose-600 focus:ring-rose-500 mt-0.5 cursor-pointer"
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-rose-950 flex items-center gap-1.5">
                            <i className="fa-solid fa-triangle-exclamation text-rose-600"></i>
                            ¿Es Leche Ácida / Deteriorada?
                          </span>
                          <span
                            className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                              formEditar.esAcida ? 'bg-rose-200 text-rose-900' : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {formEditar.esAcida ? 'Leche Ácida' : 'Leche Dulce'}
                          </span>
                        </div>
                        <p className="text-[11.5px] text-slate-600 m-0 mt-1 leading-snug">
                          Aplica tarifa especial de leche ácida.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. OBSERVACIÓN / MOTIVO */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <i className="fa-regular fa-comment-dots text-slate-500"></i>
                    Observación o Justificación del Ajuste
                  </label>
                  <input
                    type="text"
                    value={formEditar.observacion}
                    onChange={(e) => setFormEditar({ ...formEditar, observacion: e.target.value })}
                    className="w-full h-10 px-3 rounded-xl border-[1.5px] border-slate-300 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 text-xs text-slate-800 transition-all placeholder:text-slate-400"
                    placeholder="Motivo del ajuste de litros..."
                  />
                </div>
              </div>

              {/* PIE */}
              <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setModalEditarRecoleccion(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 transition-all cursor-pointer shadow-2xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={editarRecoleccionMutation.isPending}
                  className="px-5 py-2 rounded-xl text-xs font-extrabold text-white transition-all flex items-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%)' }}
                >
                  {editarRecoleccionMutation.isPending ? (
                    <>
                      <i className="fa-solid fa-circle-notch fa-spin text-xs"></i>
                      Guardando...
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-check"></i>
                      Guardar Ajuste
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ========================================================================= */}
      {/* MODAL 5: ENVIAR A RECEPTORÍA                                              */}
      {/* ========================================================================= */}
      {modalEnviarReceptoria && viajeActivo && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)', padding: '16px' }}>
          <div className="content-card" style={{ width: '100%', maxWidth: '440px', padding: '24px', borderRadius: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 800, margin: '0 0 16px 0', color: '#0f172a' }}>
              <i className="fa-solid fa-scale-balanced" style={{ color: '#0284c7', marginRight: '8px' }}></i>
              Enviar Viaje a Receptoría
            </h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                enviarReceptoriaMutation.mutate(viajeActivo.id);
              }}
            >
              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label className="form-label">Observaciones / Notas de Entrada</label>
                <textarea
                  value={formReceptoria.observacion}
                  onChange={(e) => setFormReceptoria({ ...formReceptoria, observacion: e.target.value })}
                  className="form-input"
                  rows={3}
                  placeholder="Detalles para el operador del silo..."
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setModalEnviarReceptoria(false)} className="btn btn-outline">
                  Cancelar
                </button>
                <button type="submit" disabled={enviarReceptoriaMutation.isPending} className="btn btn-primary" style={{ fontWeight: 800 }}>
                  {enviarReceptoriaMutation.isPending ? 'Enviando...' : 'Confirmar Envío'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 6: DESPACHAR A COMPAÑÍA / QUESERA                                  */}
      {/* ========================================================================= */}
      {modalEnviarCompania && viajeActivo && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)', padding: '16px' }}>
          <div className="content-card" style={{ width: '100%', maxWidth: '460px', padding: '24px', borderRadius: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 800, margin: '0 0 16px 0', color: '#0f172a' }}>
              <i className="fa-solid fa-building" style={{ color: '#7e22ce', marginRight: '8px' }}></i>
              Despachar a Compañía / Planta
            </h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!formCompania.companiaId || formCompania.companiaId <= 0) {
                  toast.error('Seleccione una empresa de destino');
                  return;
                }
                if (!formCompania.litros || Number(formCompania.litros) <= 0) {
                  toast.error('Ingrese litros a entregar');
                  return;
                }
                enviarCompaniaMutation.mutate(viajeActivo.id);
              }}
            >
              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label" style={{ fontWeight: 700 }}>Compañía / Planta Destino *</label>
                <select
                  value={formCompania.companiaId}
                  onChange={(e) => setFormCompania({ ...formCompania, companiaId: Number(e.target.value) })}
                  className="form-input"
                  required
                >
                  <option value="0">-- Seleccione una Planta --</option>
                  {companias.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label" style={{ fontWeight: 700 }}>Litros a Entregar *</label>
                <input
                  type="number"
                  value={formCompania.litros}
                  onChange={(e) => setFormCompania({ ...formCompania, litros: Number(e.target.value) })}
                  className="form-input"
                  min="1"
                  required
                  style={{ height: '38px', fontWeight: 800 }}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label className="form-label">Observaciones</label>
                <input
                  type="text"
                  value={formCompania.observacion}
                  onChange={(e) => setFormCompania({ ...formCompania, observacion: e.target.value })}
                  className="form-input"
                  placeholder="Detalles del despacho..."
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setModalEnviarCompania(false)} className="btn btn-outline">
                  Cancelar
                </button>
                <button type="submit" disabled={enviarCompaniaMutation.isPending} className="btn btn-primary" style={{ fontWeight: 800, background: '#7e22ce' }}>
                  {enviarCompaniaMutation.isPending ? 'Despachando...' : 'Confirmar Despacho'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 7: TRASPASO DE LECHE ENTRE CAMIONES                                */}
      {/* ========================================================================= */}
      {modalTraspaso && viajeActivo && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)', padding: '16px' }}>
          <div className="content-card" style={{ width: '100%', maxWidth: '460px', padding: '24px', borderRadius: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 800, margin: '0 0 16px 0', color: '#0f172a' }}>
              <i className="fa-solid fa-right-left" style={{ color: '#0f766e', marginRight: '8px' }}></i>
              Traspasar Leche a Otro Camión
            </h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!formTraspaso.ticketDestinoId || formTraspaso.ticketDestinoId <= 0) {
                  toast.error('Seleccione un viaje / cisterna destino');
                  return;
                }
                if (!formTraspaso.litrosTraspaso || Number(formTraspaso.litrosTraspaso) <= 0) {
                  toast.error('Ingrese litros válidos a transferir');
                  return;
                }
                traspasoMutation.mutate(viajeActivo.id);
              }}
            >
              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label" style={{ fontWeight: 700 }}>Cisterna / Viaje Destino *</label>
                <select
                  value={formTraspaso.ticketDestinoId}
                  onChange={(e) => setFormTraspaso({ ...formTraspaso, ticketDestinoId: Number(e.target.value) })}
                  className="form-input"
                  required
                >
                  <option value="0">-- Seleccione Cisterna Destino --</option>
                  {viajes
                    .filter((v) => v.id !== viajeActivo.id && v.estado !== 'FINALIZADO')
                    .map((v) => (
                      <option key={v.id} value={v.id}>
                        Ticket #{v.codigoTicket || v.id} — {v.choferNombre || v.nombreConductor} ({v.camionPlaca})
                      </option>
                    ))}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label" style={{ fontWeight: 700 }}>Litros a Traspasar *</label>
                <input
                  type="number"
                  value={formTraspaso.litrosTraspaso}
                  onChange={(e) => setFormTraspaso({ ...formTraspaso, litrosTraspaso: Number(e.target.value) })}
                  className="form-input"
                  min="1"
                  required
                  style={{ height: '38px', fontWeight: 800 }}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label className="form-label">Motivo o Justificación</label>
                <input
                  type="text"
                  value={formTraspaso.observacion}
                  onChange={(e) => setFormTraspaso({ ...formTraspaso, observacion: e.target.value })}
                  className="form-input"
                  placeholder="Ej: Falla mecánica, relevo de ruta..."
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setModalTraspaso(false)} className="btn btn-outline">
                  Cancelar
                </button>
                <button type="submit" disabled={traspasoMutation.isPending} className="btn btn-primary" style={{ fontWeight: 800, background: '#0f766e' }}>
                  {traspasoMutation.isPending ? 'Traspasando...' : 'Ejecutar Traspaso'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 8: FINALIZAR Y CERRAR VIAJE                                         */}
      {/* ========================================================================= */}
      {modalCerrarViaje && viajeActivo && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)', padding: '16px' }}>
          <div className="content-card" style={{ width: '100%', maxWidth: '440px', padding: '24px', borderRadius: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 800, margin: '0 0 16px 0', color: '#0f172a' }}>
              <i className="fa-solid fa-lock" style={{ color: '#059669', marginRight: '8px' }}></i>
              Finalizar y Cerrar Ticket #{viajeActivo.codigoTicket || viajeActivo.id}
            </h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                cerrarViajeMutation.mutate(viajeActivo.id);
              }}
            >
              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label">Odómetro Final (Km)</label>
                <input
                  type="number"
                  value={formCerrar.odometroFinalKm}
                  onChange={(e) => setFormCerrar({ ...formCerrar, odometroFinalKm: e.target.value })}
                  className="form-input"
                  placeholder="Ej: 145320"
                />
              </div>

              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label className="form-label">Observaciones Finales</label>
                <input
                  type="text"
                  value={formCerrar.observaciones}
                  onChange={(e) => setFormCerrar({ ...formCerrar, observaciones: e.target.value })}
                  className="form-input"
                  placeholder="Conclusiones del viaje..."
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setModalCerrarViaje(false)} className="btn btn-outline">
                  Cancelar
                </button>
                <button type="submit" disabled={cerrarViajeMutation.isPending} className="btn btn-primary" style={{ fontWeight: 800, background: '#059669' }}>
                  {cerrarViajeMutation.isPending ? 'Cerrando...' : 'Confirmar Cierre'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
