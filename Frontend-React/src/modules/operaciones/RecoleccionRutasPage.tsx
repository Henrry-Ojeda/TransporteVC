import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import apiClient from '@/api/client';
import { operacionesApi } from '@/api/operaciones.api';
import { catalogosApi } from '@/api/catalogos.api';
import { sistemaApi } from '@/api/sistema.api';
import { DataTable, type ColumnDef } from '@/components/common/DataTable';
import { CamionSelect, ChoferSelect, FincaSelect, CompaniaSelect } from '@/components/selectors';
import { SearchableSelect, type SelectOption } from '@/components/common/SearchableSelect';
import Swal from 'sweetalert2';
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
  const hasBufala = useAuthStore((state) => state.hasTenantModule('MOD_LECHE_BUFALA'));
  const rol = user?.rol?.toUpperCase() || '';
  const esAdminOSup = ['ADMIN', 'ADMINISTRADOR', 'SUPERVISOR', 'GERENTE', 'SUPERADMIN', 'SUPER_ADMIN'].includes(rol) || rol.includes('ADMIN');
  const esChofer = rol === 'CHOFER';

  // Fecha local real (evita saltos al día siguiente por UTC en horario nocturno)
  const hoyStr = (() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  })();

  // 2 Vistas Principales:
  // 1) 'viajes': Control de Rutas & Camiones (Fusión de Mis Tickets y Camiones en Ruta)
  // 2) 'fincas': Detalle por Fincas (Historial / Buscador de solo lectura)
  const [modoVista, setModoVista] = useState<'viajes' | 'fincas'>('viajes');
  const [fechaFiltro, setFechaFiltro] = useState<string>(hoyStr);

  // Sub-filtros en la vista de Rutas & Camiones
  const [filtroOrigenTicket, setFiltroOrigenTicket] = useState<'todos' | 'RUTA' | 'RECEPTORIA'>('todos');
  const [filtroEstadoTicket, setFiltroEstadoTicket] = useState<'activos' | 'todos'>('activos');
  const [busquedaTexto, setBusquedaTexto] = useState<string>('');

  // Filtros desplegables para Vista 2: Detalle por Fincas (Historial / Buscador)
  const [filtroDetalleChoferId, setFiltroDetalleChoferId] = useState<number | null>(null);
  const [filtroDetalleFincaId, setFiltroDetalleFincaId] = useState<number | null>(null);

  // Control de acordeón de paradas / fincas en tarjetas de viajes
  const [fincasExpandidas, setFincasExpandidas] = useState<Record<number, boolean>>({});

  // Ticket seleccionado actualmente
  const [viajeActivo, setViajeActivo] = useState<ControlRutaDto | null>(null);

  // Cache reactivo de fincas/paradas por ticket para garantizar sincronización 100% en vivo
  const [fincasTicketsMap, setFincasTicketsMap] = useState<Record<number, any[]>>({});
  const [loadingFincasMap, setLoadingFincasMap] = useState<Record<number, boolean>>({});

  const cargarFincasTicket = async (ticketId: number, silencioso = false) => {
    if (!ticketId) return [];
    try {
      if (!silencioso) setLoadingFincasMap((prev) => ({ ...prev, [ticketId]: true }));
      const paradas = await operacionesApi.getFincasViaje(ticketId);
      setFincasTicketsMap((prev) => ({ ...prev, [ticketId]: paradas || [] }));
      return paradas || [];
    } catch (err) {
      console.error(`Error cargando paradas para ticket #${ticketId}:`, err);
      return [];
    } finally {
      if (!silencioso) setLoadingFincasMap((prev) => ({ ...prev, [ticketId]: false }));
    }
  };

  // Modal Timelapse & Recorrido en Ruta
  const [modalTimelapse, setModalTimelapse] = useState(false);
  const [viajeTimelapse, setViajeTimelapse] = useState<ControlRutaDto | null>(null);

  // Estado para rastrear momento de detección de paradas móviles y reloj en vivo
  const [paradasDetectadasEnSesion, setParadasDetectadasEnSesion] = useState<Record<number, number>>({});
  const [nowTick, setNowTick] = useState(Date.now());
  const [ticketsTitilando, setTicketsTitilando] = useState<Record<number, number>>({});
  const prevTicketsDataRef = useRef<Record<number, { count: number; litros: number }>>({});

  // Reloj permanente cada segundo para animaciones y cuenta regresiva de titilar en toda la vista
  useEffect(() => {
    const timer = setInterval(() => {
      setNowTick(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Helper para verificar si proviene de la App Móvil (estricto)
  const esOrigenMovil = (item: any): boolean => {
    if (!item) return false;
    const obs = String(item.observacion || item.Observacion || '').toUpperCase();
    return obs.includes('[ORIGEN_MOVIL]') || obs.includes('APP MÓVIL') || obs.includes('APP MOVIL');
  };

  // Helper para verificar si una parada debe estar titilando (25 segundos, menos de un minuto)
  const estaTitilando = (p: any): boolean => {
    if (!esOrigenMovil(p)) return false; // NUNCA titila si fue registrada desde la web
    const refTime = paradasDetectadasEnSesion[p.id];
    if (!refTime) return false;
    const diff = nowTick - refTime;
    return diff >= 0 && diff < 25000;
  };

  // Polling ultra-reactivo en vivo cada 2.5s cuando el modal Timelapse está abierto (sin recargar la página)
  useEffect(() => {
    if (!modalTimelapse || !viajeTimelapse?.id) return;

    // Reloj cada segundo para animaciones y cuenta regresiva del titilar
    const timerTick = setInterval(() => {
      setNowTick(Date.now());
    }, 1000);

    // Sondeo de servidor cada 2.5 segundos sin recargar página
    const timerPoll = setInterval(async () => {
      try {
        await cargarFincasTicket(viajeTimelapse.id, true);
        refetchViajes();
      } catch (err) {
        console.error('Error sondeo en vivo timelapse:', err);
      }
    }, 2500);

    return () => {
      clearInterval(timerTick);
      clearInterval(timerPoll);
    };
  }, [modalTimelapse, viajeTimelapse?.id]);

  // Rastrear nuevas paradas que ingresan y calcular si les corresponde titilar (25 seg)
  useEffect(() => {
    if (!modalTimelapse || !viajeTimelapse?.id) return;
    const paradas = fincasTicketsMap[viajeTimelapse.id] || [];
    if (paradas.length === 0) return;

    const ahora = Date.now();
    let huboNuevos = false;
    const nuevoMap = { ...paradasDetectadasEnSesion };

    for (const p of paradas) {
      if (!p.id) continue;
      if (nuevoMap[p.id] === undefined) {
        if (esOrigenMovil(p)) {
          // Si tiene createdAt en el backend, calcular el desfase con la hora actual
          const serverCreated = p.createdAt || (p as any).CreatedAt;
          const createdAtMs = serverCreated ? new Date(serverCreated).getTime() : ahora;
          const antiguedadMs = ahora - createdAtMs;

          // Si fue creado hace menos de 25 segundos en el servidor o se detecta en vivo
          if (antiguedadMs >= 0 && antiguedadMs < 25000) {
            nuevoMap[p.id] = createdAtMs;
            huboNuevos = true;
          } else if (!serverCreated) {
            nuevoMap[p.id] = ahora;
            huboNuevos = true;
          } else {
            // Ya tiene más de 25 segundos de antigüedad; no debe titilar
            nuevoMap[p.id] = 0;
            huboNuevos = true;
          }
        } else {
          // Parada registrada desde la web o sin marca móvil; nunca titila
          nuevoMap[p.id] = 0;
          huboNuevos = true;
        }
      }
    }

    if (huboNuevos) {
      setParadasDetectadasEnSesion(nuevoMap);
    }
  }, [modalTimelapse, viajeTimelapse?.id, fincasTicketsMap]);

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

  // Formulario Enviar Receptoría (1:1 V2_3_11_26)
  const [formReceptoria, setFormReceptoria] = useState({
    observacion: '',
  });

  // Formulario Enviar Compañía Directo (Multi-Destino 1:1 V2_3_11_26 modalEntregaDirecta)
  interface FilaEntregaDirecta {
    companiaId: number;
    litros: number | string;
    tipoLeche: string;
  }
  const [filasEntregaDirecta, setFilasEntregaDirecta] = useState<FilaEntregaDirecta[]>([
    { companiaId: 0, litros: '', tipoLeche: 'VACA' },
  ]);
  const [obsEntregaDirecta, setObsEntregaDirecta] = useState('');

  // Formulario Traspaso (1:1 V2_3_11_26 modalTraspasoLeche)
  const [modoTraspaso, setModoTraspaso] = useState<'EXISTENTE' | 'NUEVO'>('EXISTENTE');
  const [formTraspaso, setFormTraspaso] = useState({
    ticketDestinoId: 0,
    choferDestinoId: 0,
    litrosTraspaso: 0 as number | string,
    observacion: '',
  });
  const [traspasoChoferDestinoId, setTraspasoChoferDestinoId] = useState<number>(0);
  const [traspasoFechaDestino, setTraspasoFechaDestino] = useState<string>(hoyStr);

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
    refetchInterval: 3500,
  });

  // Precargar y actualizar paradas reales para todos los viajes visibles (detecta nuevas fincas al instante)
  useEffect(() => {
    if (viajes && viajes.length > 0) {
      viajes.forEach((v) => {
        if (v.id) {
          cargarFincasTicket(v.id, true);
        }
      });
    }
  }, [viajes]);

  // Rastrear actividad reciente en tickets para hacerlos TITILAR con destello brillante (durante 60 segundos)
  useEffect(() => {
    if (!viajes || viajes.length === 0) return;
    const ahora = Date.now();
    let huboCambios = false;
    const nuevosTitilando = { ...ticketsTitilando };

    viajes.forEach((v) => {
      const paradas = fincasTicketsMap[v.id] || [];
      const litrosActuales = v.totalLitrosFinca || paradas.reduce((acc: number, p: any) => acc + Number(p.litros || p.Litros || 0), 0);
      const paradasCount = paradas.length;

      const prev = prevTicketsDataRef.current[v.id];
      if (prev) {
        // Si aumentaron las paradas o aumentaron los litros recolectados, ¡hacer titilar el ticket 25s!
        if (paradasCount > prev.count || litrosActuales > prev.litros) {
          nuevosTitilando[v.id] = ahora + 25000;
          huboCambios = true;
        }
      }

      // También verificar si alguna parada fue registrada hace menos de 25 segundos
      const tieneParadaReciente = paradas.some((p: any) => {
        const c = p.createdAt || p.CreatedAt;
        return c && ahora - new Date(c).getTime() < 25000;
      });

      if (tieneParadaReciente && (!nuevosTitilando[v.id] || nuevosTitilando[v.id] < ahora)) {
        nuevosTitilando[v.id] = ahora + 25000;
        huboCambios = true;
      }

      prevTicketsDataRef.current[v.id] = { count: paradasCount, litros: litrosActuales };
    });

    if (huboCambios) {
      setTicketsTitilando(nuevosTitilando);
    }
  }, [viajes, fincasTicketsMap]);

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

  const eliminarTicketMutation = useMutation({
    mutationFn: (ticketId: number) => operacionesApi.eliminarControl(ticketId),
    onSuccess: (data: any) => {
      toast.success(data?.message || 'Ticket eliminado exitosamente');
      queryClient.invalidateQueries({ queryKey: ['rutas-viajes-hoy'] });
      queryClient.invalidateQueries({ queryKey: ['rutas-fincas-hoy'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Error al eliminar el ticket');
    },
  });

  const handleEliminarTicket = (viaje: ControlRutaDto) => {
    const num = viaje.codigoTicket || viaje.id;
    if (window.confirm(`¿Está seguro de que desea eliminar el Ticket #${num}? Esta acción cancelará el viaje y no se puede deshacer.`)) {
      eliminarTicketMutation.mutate(viaje.id);
    }
  };

  const enviarReceptoriaMutation = useMutation({
    mutationFn: (ticketId: number) => operacionesApi.enviarAReceptoria(ticketId, formReceptoria.observacion),
    onSuccess: (data) => {
      Swal.fire({
        icon: 'success',
        title: '¡Despachado a Receptoría!',
        text: data?.message || 'El viaje ha sido enviado a receptoría para pesaje y control.',
        confirmButtonColor: '#d97706',
        timer: 2800,
        showConfirmButton: false,
      });
      queryClient.invalidateQueries({ queryKey: ['rutas-viajes-hoy'] });
      setModalEnviarReceptoria(false);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Error al enviar a receptoría');
    },
  });

  const enviarCompaniaMutation = useMutation({
    mutationFn: (ticketId: number) => {
      const primeraFila = filasEntregaDirecta[0] || { companiaId: 0, litros: 0, tipoLeche: 'VACA' };
      return operacionesApi.enviarACompania(ticketId, {
        companiaId: Number(primeraFila.companiaId),
        litrosDespachados: Number(primeraFila.litros || 0),
        observacion: obsEntregaDirecta,
        destinos: filasEntregaDirecta.map((f) => ({
          companiaId: Number(f.companiaId),
          litros: Number(f.litros || 0),
          tipoLeche: f.tipoLeche || 'VACA',
        })),
      });
    },
    onSuccess: (data) => {
      Swal.fire({
        icon: 'success',
        title: '¡Entrega Registrada Exitosamente!',
        text: data?.message || 'Se registraron los despachos a compañía correctamente.',
        confirmButtonColor: '#059669',
        timer: 2800,
        showConfirmButton: false,
      });
      queryClient.invalidateQueries({ queryKey: ['rutas-viajes-hoy'] });
      queryClient.invalidateQueries({ queryKey: ['rutas-despachos-hoy'] });
      setModalEnviarCompania(false);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Error al despachar a compañía');
    },
  });

  const traspasoMutation = useMutation({
    mutationFn: (id: number) => {
      const payload: any = {
        litrosTraspaso: Number(formTraspaso.litrosTraspaso),
        observacion: formTraspaso.observacion,
      };
      if (modoTraspaso === 'EXISTENTE') {
        payload.ticketDestinoId = Number(formTraspaso.ticketDestinoId);
      } else {
        payload.choferDestinoId = Number(traspasoChoferDestinoId);
        payload.fechaDestino = traspasoFechaDestino;
      }
      return operacionesApi.traspasarLeche(id, payload);
    },
    onSuccess: (data) => {
      Swal.fire({
        icon: 'success',
        title: '¡Traspaso Exitoso!',
        text: data?.mensaje || data?.message || 'Se traspasaron exitosamente los litros solicitados.',
        confirmButtonColor: '#0d9488',
        timer: 3500,
        showConfirmButton: true,
        confirmButtonText: 'Entendido',
      });
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
    // Si el usuario es CHOFER, solo puede ver sus propios viajes
    if (esChofer && user) {
      list = list.filter(
        (v) =>
          v.choferId === user.id ||
          (v as any).conductorId === user.id ||
          ((user as any).camionId && v.camionId === (user as any).camionId) ||
          (v.choferNombre && v.choferNombre.toLowerCase().includes((user.nombreCompleto || '').toLowerCase()))
      );
    }
    // Filtrado estricto por Fecha Operativa seleccionada
    if (fechaFiltro) {
      list = list.filter((v) => (v.fecha || '').split('T')[0] === fechaFiltro);
    }
    if (filtroEstadoTicket === 'activos') {
      list = list.filter((v) => {
        const est = (v.estado || '').toUpperCase();
        const estP = (v.estadoProceso || '').toUpperCase();
        return (
          est !== 'FINALIZADO' &&
          est !== 'CERRADO' &&
          est !== 'ENTREGADO' &&
          est !== 'AUDITADO' &&
          est !== 'CANCELADO' &&
          estP !== 'CERRADO' &&
          estP !== 'FINALIZADO' &&
          v.procesoActualId !== 4
        );
      });
    }
    return list;
  }, [viajes, filtroEstadoTicket, esChofer, user, fechaFiltro]);

  const despachosFiltrados = useMemo(() => {
    let list = despachos;
    // Si el usuario es CHOFER, solo puede ver los despachos que se le asignaron
    if (esChofer && user) {
      list = list.filter(
        (d) =>
          (d as any).choferId === user.id ||
          (d as any).conductorId === user.id ||
          ((user as any).camionId && d.camionId === (user as any).camionId) ||
          (d.choferNombre && d.choferNombre.toLowerCase().includes((user.nombreCompleto || '').toLowerCase()))
      );
    }
    // Filtrado estricto por Fecha Operativa seleccionada
    if (fechaFiltro) {
      list = list.filter((d) => (d.fecha || '').split('T')[0] === fechaFiltro);
    }
    if (filtroEstadoTicket === 'activos') {
      list = list.filter((d) => {
        const est = (d.estado || '').toUpperCase();
        const estP = ((d as any).estadoProceso || '').toUpperCase();
        return (
          est !== 'FINALIZADO' &&
          est !== 'CERRADO' &&
          est !== 'ENTREGADO' &&
          est !== 'AUDITADO' &&
          est !== 'CANCELADO' &&
          estP !== 'CERRADO' &&
          estP !== 'FINALIZADO'
        );
      });
    }
    return list;
  }, [despachos, filtroEstadoTicket, esChofer, user, fechaFiltro]);

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

    const normDespachos = despachosFiltrados.map((d) => ({
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
  }, [viajesFiltrados, despachosFiltrados, filtroOrigenTicket, busquedaTexto]);

  // Lista filtrada para Detalle por Fincas (Filtros por Chofer y Finca)
  const recoleccionesFiltradas = useMemo(() => {
    return recolecciones.filter((r: any) => {
      // 0. Filtro estricto por Fecha Operativa seleccionada (nunca mezclar fechas diferentes)
      if (fechaFiltro) {
        const fechaItem = r.fecha ? String(r.fecha).split('T')[0] : '';
        if (fechaItem && fechaItem !== fechaFiltro) return false;
      }

      // Si el usuario es CHOFER, solo ve sus propias paradas
      if (esChofer && user) {
        const itemChoferId = Number(r.conductorId ?? r.ConductorId ?? r.usuarioId ?? r.UsuarioId ?? 0);
        const nomChoferItem = (r.conductorNombre || r.ConductorNombre || '').toLowerCase().trim();
        const miNombre = (user.nombreCompleto || '').toLowerCase().trim();
        if (itemChoferId > 0) {
          if (itemChoferId !== user.id) return false;
        } else if (nomChoferItem && miNombre) {
          if (!nomChoferItem.includes(miNombre) && !miNombre.includes(nomChoferItem)) return false;
        }
      }

      // 1. Filtro por Finca Ganadera
      if (filtroDetalleFincaId && filtroDetalleFincaId > 0) {
        const itemFincaId = Number(r.fincaId ?? r.FincaId ?? 0);
        if (itemFincaId !== filtroDetalleFincaId) return false;
      }

      // 2. Filtro por Chofer / Conductor
      if (filtroDetalleChoferId && filtroDetalleChoferId > 0) {
        const itemChoferId = Number(r.conductorId ?? r.ConductorId ?? r.usuarioId ?? r.UsuarioId ?? 0);
        if (itemChoferId > 0) {
          if (itemChoferId !== filtroDetalleChoferId) return false;
        } else {
          // Búsqueda por nombre de conductor si no viene el ID numérico en el registro
          const choferObj = conductores.find((c: any) => c.id === filtroDetalleChoferId);
          if (choferObj) {
            const nomChoferFiltro = (choferObj.nombreCompleto || choferObj.nombre || '').toLowerCase().trim();
            const nomChoferItem = (r.conductorNombre || r.ConductorNombre || '').toLowerCase().trim();
            if (!nomChoferItem || (!nomChoferItem.includes(nomChoferFiltro) && !nomChoferFiltro.includes(nomChoferItem))) {
              return false;
            }
          }
        }
      }

      return true;
    });
  }, [recolecciones, filtroDetalleFincaId, filtroDetalleChoferId, conductores]);

  // Totales generales para Detalle por Fincas (calculados según los filtros aplicados)
  const totalesRecoleccion = useMemo(() => {
    let vaca = 0;
    let bufala = 0;
    let acida = 0;
    recoleccionesFiltradas.forEach((r) => {
      const lts = Number(r.litros || (r as any).Litros || 0);
      const tipo = (r.tipoLeche || (r as any).TipoLeche || '').toUpperCase();
      const esBuf = tipo.includes('BUFAL');
      if (esBuf) bufala += lts;
      else vaca += lts;
      if (r.esAcida || (r as any).EsAcida) acida += lts;
    });
    return { vaca, bufala, acida, total: vaca + bufala };
  }, [recoleccionesFiltradas]);

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

    const paradasDelTicket = Array.isArray(fincasTicketsMap[viajeTimelapse.id])
      ? fincasTicketsMap[viajeTimelapse.id]
      : recolecciones.filter((r) => r.controlRutaId != null && Number(r.controlRutaId) === Number(viajeTimelapse.id));

    const visitadas = [...paradasDelTicket]
      .sort((a, b) => {
        const timeA = new Date(a.createdAt || (a as any).CreatedAt || a.fecha).getTime();
        const timeB = new Date(b.createdAt || (b as any).CreatedAt || b.fecha).getTime();
        if (timeA !== timeB) return timeA - timeB;
        return (a.id || 0) - (b.id || 0);
      });

    let acumulado = 0;
    const paradasConIntervalo = visitadas.map((item, idx) => {
      const litrosItem = Number(item.litros || (item as any).Litros || (item as any).litrosLeche || 0);
      acumulado += litrosItem;
      const fechaActual = new Date(item.createdAt || (item as any).CreatedAt || item.fecha);
      let minutosDesdeAnterior: number | null = null;
      if (idx > 0) {
        const fechaAnt = new Date(visitadas[idx - 1].createdAt || (visitadas[idx - 1] as any).CreatedAt || visitadas[idx - 1].fecha);
        const diffMs = fechaActual.getTime() - fechaAnt.getTime();
        minutosDesdeAnterior = Math.max(0, Math.round(diffMs / (1000 * 60)));
      }
      return {
        ...item,
        litros: litrosItem,
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

  const handleAbrirReceptoria = (item: any) => {
    setViajeActivo(item);
    setFormReceptoria({ observacion: '' });
    setModalEnviarReceptoria(true);
  };

  const handleAbrirCompania = (item: any) => {
    setViajeActivo(item);
    const fincasT = fincasTicketsMap[item.id] || [];
    const totalCamion = item._litrosRecogidos > 0 ? item._litrosRecogidos : fincasT.reduce((a: number, f: any) => a + Number(f.litros || f.Litros || 0), 0);
    const yaAsignado = item._litrosEntregados || 0;
    const faltante = Math.max(0, totalCamion - yaAsignado);

    setFilasEntregaDirecta([
      {
        companiaId: item.companiaDestinoId || (companias.length > 0 ? companias[0].id : 0),
        litros: faltante > 0 ? faltante : totalCamion,
        tipoLeche: 'VACA',
      },
    ]);
    setObsEntregaDirecta('');
    setModalEnviarCompania(true);
  };

  const handleAbrirTraspaso = (item: any) => {
    setViajeActivo(item);
    const fincasT = fincasTicketsMap[item.id] || [];
    const totalCamion = item._litrosRecogidos > 0 ? item._litrosRecogidos : fincasT.reduce((a: number, f: any) => a + Number(f.litros || f.Litros || 0), 0);
    const yaAsignado = item._litrosEntregados || 0;
    const ltsDisponibles = Math.max(0, totalCamion - yaAsignado);

    setModoTraspaso('EXISTENTE');
    setFormTraspaso({
      ticketDestinoId: 0,
      choferDestinoId: 0,
      litrosTraspaso: ltsDisponibles > 0 ? ltsDisponibles : totalCamion,
      observacion: '',
    });
    setTraspasoChoferDestinoId(0);
    setTraspasoFechaDestino(hoyStr);
    setModalTraspaso(true);
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginRight: '4px' }}>
            <i className="fa-solid fa-layer-group" style={{ color: '#4f46e5', marginRight: '4px' }}></i>
            Vista Operativa:
          </span>
          <div
            className="vista-operativa-switcher"
            style={{
              display: 'inline-flex',
              background: '#f1f5f9',
              padding: '3px',
              borderRadius: '10px',
              border: '1px solid #e2e8f0',
              gap: '4px',
            }}
          >
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => setModoVista('viajes')}
              style={{
                minHeight: '38px',
                height: 'auto',
                padding: '6px 12px',
                borderRadius: '7px',
                border: 'none',
                fontSize: '12px',
                fontWeight: modoVista === 'viajes' ? 800 : 600,
                background: modoVista === 'viajes' ? '#ffffff' : 'transparent',
                color: modoVista === 'viajes' ? '#1e293b' : '#64748b',
                boxShadow: modoVista === 'viajes' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                cursor: 'pointer',
                textAlign: 'center',
              }}
            >
              <i className="fa-solid fa-truck-moving" style={{ color: modoVista === 'viajes' ? '#2563eb' : '#64748b', flexShrink: 0 }}></i>
              <span>
                <span className="hidden sm:inline">Control </span>Rutas & Camiones
              </span>
              <span
                className="badge"
                style={{
                  background: modoVista === 'viajes' ? '#eff6ff' : '#e2e8f0',
                  color: modoVista === 'viajes' ? '#1d4ed8' : '#475569',
                  fontSize: '11px',
                  padding: '2px 7px',
                  borderRadius: '10px',
                  fontWeight: 800,
                  flexShrink: 0,
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
                minHeight: '38px',
                height: 'auto',
                padding: '6px 12px',
                borderRadius: '7px',
                border: 'none',
                fontSize: '12px',
                fontWeight: modoVista === 'fincas' ? 800 : 600,
                background: modoVista === 'fincas' ? '#ffffff' : 'transparent',
                color: modoVista === 'fincas' ? '#1e293b' : '#64748b',
                boxShadow: modoVista === 'fincas' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                cursor: 'pointer',
                textAlign: 'center',
              }}
            >
              <i className="fa-solid fa-list-check" style={{ color: modoVista === 'fincas' ? '#2563eb' : '#64748b', flexShrink: 0 }}></i>
              <span>
                Detalle Fincas<span className="hidden md:inline"> (Historial)</span>
              </span>
              <span
                className="badge"
                style={{
                  background: modoVista === 'fincas' ? '#eff6ff' : '#e2e8f0',
                  color: modoVista === 'fincas' ? '#1d4ed8' : '#475569',
                  fontSize: '11px',
                  padding: '2px 7px',
                  borderRadius: '10px',
                  fontWeight: 800,
                  flexShrink: 0,
                }}
              >
                {filtroDetalleChoferId || filtroDetalleFincaId ? `${recoleccionesFiltradas.length}/${recoleccionesFiltradas.length}` : recoleccionesFiltradas.length}
              </span>
            </button>
          </div>
        </div>

        {/* SELECTOR DE FECHA GLOBAL (ALINEADO A LA DERECHA) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#ffffff', padding: '6px 14px', borderRadius: '10px', border: '1.5px solid #cbd5e1', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', marginLeft: 'auto' }}>
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
                Receptorías / Salidas ({despachosFiltrados.length})
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

          {/* ESTILOS PARA VISTA TABULAR DE TARJETAS DE TICKETS */}
          <style>{`
            @keyframes ticketGlowFlash {
              0% {
                box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.85);
                border-color: #10b981;
                background-color: #f0fdf4;
              }
              50% {
                box-shadow: 0 0 25px 8px rgba(16, 185, 129, 0.5);
                border-color: #059669;
                background-color: #dcfce7;
              }
              100% {
                box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.85);
                border-color: #10b981;
                background-color: #f0fdf4;
              }
            }
            .ticket-card-titilando {
              animation: ticketGlowFlash 1.2s infinite ease-in-out !important;
              border: 2.5px solid #10b981 !important;
            }
            .ticket-table-card {
              background: #ffffff;
              border: 1.5px solid #e2e8f0;
              border-radius: 12px;
              box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
              transition: all 0.2s ease;
              overflow: hidden;
            }
            .ticket-table-card:hover {
              box-shadow: 0 4px 14px rgba(0, 0, 0, 0.07);
              border-color: #cbd5e1;
            }
            .ticket-table-row {
              display: grid;
              grid-template-columns: minmax(230px, 1.15fr) minmax(230px, 1.15fr) minmax(280px, 1.35fr) minmax(220px, 1fr);
              gap: 16px;
              padding: 14px 18px;
              align-items: center;
            }
            @media (max-width: 1200px) {
              .ticket-table-header {
                display: none !important;
              }
              .ticket-table-row {
                grid-template-columns: 1fr 1fr;
                gap: 16px;
              }
            }
            @media (max-width: 640px) {
              .ticket-table-row {
                grid-template-columns: 1fr;
                gap: 14px;
              }
            }
          `}</style>

          {/* GRID / TABLA DE TICKETS / CAMIONES EN RUTA */}
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {/* ENCABEZADO TIPO TABLA PARA PANTALLAS GRANDES */}
              <div
                className="ticket-table-header"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(230px, 1.15fr) minmax(230px, 1.15fr) minmax(280px, 1.35fr) minmax(220px, 1fr)',
                  gap: '16px',
                  padding: '8px 18px',
                  fontSize: '11px',
                  fontWeight: 800,
                  color: '#64748b',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                }}
              >
                <div><i className="fa-solid fa-ticket" style={{ marginRight: '6px', color: '#0284c7' }}></i> Ticket & Conductor</div>
                <div><i className="fa-solid fa-gas-pump" style={{ marginRight: '6px', color: '#0284c7' }}></i> Modo & Ocupación Cisterna</div>
                <div><i className="fa-solid fa-droplet" style={{ marginRight: '6px', color: '#0284c7' }}></i> Litros & Recorrido / Paradas</div>
                <div style={{ textAlign: 'center' }}><i className="fa-solid fa-sliders" style={{ marginRight: '6px', color: '#0284c7' }}></i> Acciones Operativas</div>
              </div>

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
                  ? (Array.isArray(fincasTicketsMap[item.id])
                      ? fincasTicketsMap[item.id]
                      : recolecciones.filter((r) => r.controlRutaId != null && Number(r.controlRutaId) === Number(item.id)))
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

                const tiempoFinTitilar = ticketsTitilando[item.id] || 0;
                const tieneParadaReciente = fincasTicket.some((p: any) => {
                  const c = p.createdAt || (p as any).CreatedAt;
                  return c && (nowTick - new Date(c).getTime() < 25000);
                });
                const esTicketTitilando = (tiempoFinTitilar > nowTick) || tieneParadaReciente;

                return (
                  <div
                    key={`${item._tipoTicket}_${item.id}`}
                    className={`ticket-table-card ${esTicketTitilando ? 'ticket-card-titilando' : ''}`}
                    style={{
                      borderLeft: `5px solid ${esTicketTitilando ? '#10b981' : item._origenColor}`,
                    }}
                  >
                    {/* FILA PRINCIPAL: FORMATO COLUMNAS TIPO TABLA */}
                    <div className="ticket-table-row">
                      {/* COLUMNA 1: TICKET & CONDUCTOR (SIN FECHA Y SIN BADGE ABIERTO) */}
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '15px', fontWeight: 800, color: '#1e293b' }}>
                              <i className="fa-solid fa-ticket" style={{ color: item._origenColor, marginRight: '4px' }}></i>
                              Ticket #{item.codigoTicket || item.id}
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
                              <i className={`fa-solid ${item._origenIcon}`} style={{ marginRight: '4px' }}></i>
                              {item._origenBadge}
                            </span>
                            {esTicketTitilando && (
                              <span
                                className="badge"
                                style={{
                                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                  color: '#ffffff',
                                  fontWeight: 800,
                                  fontSize: '10px',
                                  padding: '2px 7px',
                                  borderRadius: '6px',
                                  boxShadow: '0 2px 6px rgba(16, 185, 129, 0.4)',
                                  animation: 'pulse 0.9s infinite ease-in-out',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                }}
                              >
                                <i className="fa-solid fa-bolt"></i> ¡NUEVA FINCA!
                              </span>
                            )}
                          </div>
                          {puedeEditarTicket && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEliminarTicket(item);
                              }}
                              className="btn btn-xs"
                              style={{
                                background: '#fef2f2',
                                color: '#dc2626',
                                border: '1px solid #fecaca',
                                borderRadius: '6px',
                                padding: '2px 7px',
                                fontSize: '11px',
                                cursor: 'pointer',
                              }}
                              title="Eliminar este ticket"
                            >
                              <i className="fa-solid fa-trash-can"></i>
                            </button>
                          )}
                        </div>

                        <div>
                          <span style={{ fontSize: '14.5px', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <i className="fa-solid fa-user-tie" style={{ color: item._origenColor }}></i>
                            {item._conductor}
                          </span>
                          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <i className="fa-solid fa-truck" style={{ color: '#64748b' }}></i>
                            <span>{placaTexto}</span>
                            <span style={{ color: '#94a3b8' }}>•</span>
                            <span style={{ fontWeight: 700, color: '#334155' }}>Capacidad: {capacidadCisterna.toLocaleString()} L</span>
                          </div>
                          {!esRuta && item.nombreCompania && (
                            <div style={{ fontSize: '12px', color: '#7e22ce', marginTop: '2px', fontWeight: 700 }}>
                              <i className="fa-solid fa-building-wheat" style={{ marginRight: '4px' }}></i>
                              Destino: {item.nombreCompania}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* COLUMNA 2: MODO LIBRE / RUTA & OCUPACIÓN CISTERNA */}
                      <div>
                        {esRuta ? (
                          <>
                            <div style={{ marginBottom: '8px' }}>
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
                                    padding: '3px 8px',
                                    borderRadius: '6px',
                                  }}
                                >
                                  <i className="fa-solid fa-route"></i>
                                  Ruta: {item.rutaLogisticaNombre || item.rutaNombre || `#${item.rutaLogisticaId}`}
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
                                    padding: '3px 8px',
                                    borderRadius: '6px',
                                  }}
                                >
                                  <i className="fa-solid fa-compass"></i>
                                  Modo Libre (Paradas Flexibles)
                                </span>
                              )}
                            </div>

                            {/* MEDIDOR Y PROGRESS BAR DE CAPACIDAD DE CISTERNA */}
                            <div style={{ background: '#f8fafc', padding: '8px 10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                                <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b' }}>
                                  Ocupación Cisterna:
                                </span>
                                <strong style={{ fontSize: '12px', fontWeight: 800, color: porcentajeCisterna >= 95 ? '#dc2626' : '#0284c7' }}>
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
                          </>
                        ) : (
                          <div style={{ background: '#faf5ff', padding: '10px', borderRadius: '8px', border: '1px solid #e9d5ff' }}>
                            <span style={{ fontSize: '11px', color: '#7e22ce', fontWeight: 700, display: 'block' }}>Despacho Externo</span>
                            <strong style={{ fontSize: '13px', color: '#581c87' }}>{item.nombreCompania || 'Planta Externa'}</strong>
                          </div>
                        )}
                      </div>

                      {/* COLUMNA 3: LITROS & TIMELAPSE CON BOTÓN "+ FINCAS" */}
                      <div>
                        {/* Métricas de Litros: si aún no hay entrega a receptoría/empresa, solo muestra Litros en Camión sin el cuadro amarillo */}
                        <div style={{ display: 'grid', gridTemplateColumns: ltsEntregados > 0 ? '1fr 1fr' : '1fr', gap: '8px', marginBottom: '8px' }}>
                          <div style={{ background: '#eff6ff', padding: '6px 8px', borderRadius: '7px', border: '1px solid #bfdbfe' }}>
                            <span style={{ fontSize: '10.5px', color: '#1e40af', fontWeight: 700, display: 'block' }}>
                              {esRuta ? 'Litros en Camión:' : 'Litros Despachados:'}
                            </span>
                            <strong style={{ fontSize: '15px', color: '#1d4ed8', fontWeight: 800 }}>
                              {ltsRecolectados.toLocaleString('es-VE')} L
                            </strong>
                            {esRuta && (
                              <small style={{ fontSize: '10.5px', color: '#64748b', display: 'block' }}>
                                {fincasTicket.length} paradas registradas
                              </small>
                            )}
                          </div>

                          {ltsEntregados > 0 && (
                            <div
                              style={{
                                background: '#f0fdf4',
                                padding: '6px 8px',
                                borderRadius: '7px',
                                border: '1px solid #bbf7d0',
                              }}
                            >
                              <span style={{ fontSize: '10.5px', color: '#15803d', fontWeight: 700, display: 'block' }}>
                                {esRuta ? 'Litros Recibidos:' : 'Litros en Planta:'}
                              </span>
                              <strong style={{ fontSize: '15px', color: '#16a34a', fontWeight: 800 }}>
                                {ltsEntregados.toLocaleString('es-VE')} L
                              </strong>
                              <small style={{ fontSize: '10.5px', color: '#15803d', display: 'block' }}>
                                {item.nombreCompania ? `En ${item.nombreCompania}` : 'En Receptoría'}
                              </small>
                            </div>
                          )}
                        </div>

                        {/* Merma si hubo entrega */}
                        {ltsEntregados > 0 && mermaLitros > 0 && (
                          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '3px 8px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#991b1b', textTransform: 'uppercase' }}>⚠️ Merma:</span>
                            <strong style={{ fontSize: '12px', fontWeight: 800, color: '#dc2626' }}>-{mermaLitros.toLocaleString()} Lts</strong>
                          </div>
                        )}

                        {/* TIMELAPSE INTEGRADO CON BOTÓN "+ FINCAS" Y TOGGLE PARADAS */}
                        {esRuta && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <button
                              type="button"
                              onClick={() => abrirTimelapse(item)}
                              className="btn btn-sm"
                              style={{
                                flex: 1,
                                background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
                                color: '#1d4ed8',
                                border: '1px solid #bfdbfe',
                                fontWeight: 800,
                                fontSize: '11px',
                                padding: '6px 8px',
                                borderRadius: '6px',
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                gap: '6px',
                                cursor: 'pointer',
                              }}
                              title="Ver Timelapse & Recorrido de Paradas"
                            >
                              <i className="fa-solid fa-timeline" style={{ color: '#2563eb' }}></i>
                              <span>Timelapse ({fincasTicket.length})</span>
                            </button>

                            {puedeEditarTicket && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setViajeActivo(item);
                                  setFormFinca({ fincaId: 0, litros: '', tipoLeche: 'VACA', esAcida: false, esDiferido: false, fecha: '', observacion: '' });
                                  setModalRegistroFinca(true);
                                }}
                                className="btn btn-sm"
                                style={{
                                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                  color: '#ffffff',
                                  border: 'none',
                                  fontWeight: 800,
                                  fontSize: '11px',
                                  padding: '6px 10px',
                                  borderRadius: '6px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  cursor: 'pointer',
                                  whiteSpace: 'nowrap',
                                }}
                                title={tieneRutaLogistica ? 'Añadir finca faltante a esta ruta' : 'Añadir parada a este ticket'}
                              >
                                <i className="fa-solid fa-plus"></i> Fincas
                              </button>
                            )}

                            {fincasTicket.length > 0 && (
                              <button
                                type="button"
                                onClick={() => toggleAcordeonFincas(item.id)}
                                className="btn btn-sm"
                                style={{
                                  background: estaExpandido ? '#e2e8f0' : '#f8fafc',
                                  color: '#334155',
                                  border: '1px solid #cbd5e1',
                                  padding: '6px 8px',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                }}
                                title={estaExpandido ? 'Ocultar listado de paradas' : 'Ver listado detallado de paradas'}
                              >
                                <i className={`fa-solid fa-chevron-${estaExpandido ? 'up' : 'down'}`} style={{ fontSize: '10px' }}></i>
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* COLUMNA 4: BOTONES COMO ACCIONES */}
                      <div>
                        <div style={{ fontSize: '10.5px', color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px', textAlign: 'center' }}>
                          Acciones
                        </div>
                        {esRuta && !esFinalizado ? (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                            <button
                              type="button"
                              onClick={() => handleAbrirReceptoria(item)}
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
                              onClick={() => handleAbrirCompania(item)}
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
                              onClick={() => handleAbrirTraspaso(item)}
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
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <span className="badge" style={{ background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', fontWeight: 800, fontSize: '11px', padding: '5px 12px', borderRadius: '6px' }}>
                              <i className="fa-solid fa-circle-check" style={{ marginRight: '5px' }}></i> FINALIZADO
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* ACORDEÓN / DESPLEGABLE DE PARADAS EXPANDIDAS */}
                    {esRuta && estaExpandido && (
                      <div style={{ background: '#f8fafc', borderTop: '1px solid #e2e8f0', padding: '12px 18px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <span style={{ fontSize: '12px', fontWeight: 800, color: '#334155', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <i className="fa-solid fa-list-check" style={{ color: '#2563eb' }}></i>
                            Paradas / Fincas Registradas ({fincasTicket.length})
                          </span>
                        </div>

                        <div style={{ maxHeight: '230px', overflowY: 'auto', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '6px' }}>
                          {fincasTicket.length === 0 ? (
                            <div style={{ fontSize: '12px', color: '#94a3b8', textAlign: 'center', padding: '14px' }}>
                              No hay paradas registradas aún en este ticket.
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

                                    {/* BOTONES DE EDICIÓN Y ELIMINACIÓN */}
                                    {puedeEditarTicket && (
                                      <div style={{ display: 'flex', gap: '4px' }}>
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
                      </div>
                    )}
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

            {hasBufala && (
              <div className="content-card" style={{ padding: '14px 16px', borderLeft: '4px solid #9333ea', borderRadius: '10px' }}>
                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>🐃 Leche de Búfala</span>
                <strong style={{ fontSize: '20px', color: '#9333ea', display: 'block', marginTop: '4px', fontWeight: 800 }}>
                  {totalesRecoleccion.bufala.toLocaleString()} Lts
                </strong>
              </div>
            )}

            <div className="content-card" style={{ padding: '14px 16px', borderLeft: '4px solid #dc2626', borderRadius: '10px' }}>
              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>⚠️ Leche Ácida</span>
              <strong style={{ fontSize: '20px', color: '#dc2626', display: 'block', marginTop: '4px', fontWeight: 800 }}>
                {totalesRecoleccion.acida.toLocaleString()} Lts
              </strong>
            </div>

            <div className="content-card" style={{ padding: '14px 16px', borderLeft: '4px solid #4f46e5', borderRadius: '10px' }}>
              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Fincas Recolectadas</span>
              <strong style={{ fontSize: '20px', color: '#4f46e5', display: 'block', marginTop: '4px', fontWeight: 800 }}>
                {recoleccionesFiltradas.length} Fincas
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

              {(filtroDetalleChoferId || filtroDetalleFincaId) && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="badge" style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', fontSize: '11.5px', padding: '5px 12px', fontWeight: 700, borderRadius: '8px' }}>
                    <i className="fa-solid fa-filter" style={{ marginRight: '5px' }}></i>
                    Mostrando {recoleccionesFiltradas.length} paradas filtradas
                  </span>
                </div>
              )}
            </div>

            {/* BARRA DE FILTROS DESPLEGABLES CON BÚSQUEDA INTEGRADA */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                gap: '14px',
                background: '#f8fafc',
                padding: '14px 16px',
                borderRadius: '10px',
                border: '1.5px solid #e2e8f0',
                marginBottom: '16px',
                alignItems: 'end',
              }}
            >
              {/* Filtro Chofer con Buscador */}
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <i className="fa-solid fa-user-tie" style={{ color: '#0284c7' }}></i>
                  Filtrar por Chofer / Conductor:
                </label>
                <ChoferSelect
                  value={filtroDetalleChoferId || undefined}
                  onChange={(val) => setFiltroDetalleChoferId(val ? Number(val) : null)}
                  placeholder="-- Todos los Choferes --"
                  allowClear={true}
                />
              </div>

              {/* Filtro Finca con Buscador */}
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <i className="fa-solid fa-cow" style={{ color: '#16a34a' }}></i>
                  Filtrar por Finca Ganadera:
                </label>
                <FincaSelect
                  value={filtroDetalleFincaId || undefined}
                  onChange={(val) => setFiltroDetalleFincaId(val ? Number(val) : null)}
                  placeholder="-- Todas las Fincas Ganaderas --"
                  allowClear={true}
                />
              </div>

              {/* Botón de limpiar filtros cuando alguno esté seleccionado */}
              {(filtroDetalleChoferId || filtroDetalleFincaId) && (
                <div style={{ display: 'flex', alignItems: 'flex-end', height: '100%' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setFiltroDetalleChoferId(null);
                      setFiltroDetalleFincaId(null);
                    }}
                    className="btn btn-outline"
                    style={{
                      height: '38px',
                      padding: '0 14px',
                      fontSize: '12px',
                      fontWeight: 700,
                      borderColor: '#fca5a5',
                      color: '#dc2626',
                      background: '#ffffff',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      borderRadius: '8px',
                    }}
                    title="Restablecer filtros de chofer y finca"
                  >
                    <i className="fa-solid fa-filter-circle-xmark"></i>
                    Limpiar Filtros
                  </button>
                </div>
              )}
            </div>

            <DataTable
              data={recoleccionesFiltradas}
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span
                  style={{
                    background: 'rgba(16, 185, 129, 0.15)',
                    border: '1px solid #10b981',
                    color: '#34d399',
                    padding: '4px 10px',
                    borderRadius: '20px',
                    fontSize: '11px',
                    fontWeight: 800,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                  title="Sondeo activo: las paradas registradas en la app móvil aparecen automáticamente sin recargar la página"
                >
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }}></span>
                  EN VIVO (Sin Recargar)
                </span>
                <button type="button" onClick={() => setModalTimelapse(false)} style={{ background: 'none', border: 'none', fontSize: '20px', color: '#94a3b8', cursor: 'pointer' }}>
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>
            </div>

            <style>{`
              @keyframes pulseColorMovil {
                0% {
                  background-color: #ecfdf5;
                  border-color: #10b981;
                  box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.6), 0 4px 14px rgba(16, 185, 129, 0.2);
                }
                50% {
                  background-color: #fef3c7;
                  border-color: #f59e0b;
                  box-shadow: 0 0 0 8px rgba(245, 158, 11, 0.35), 0 6px 18px rgba(245, 158, 11, 0.3);
                }
                100% {
                  background-color: #ecfdf5;
                  border-color: #10b981;
                  box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.6), 0 4px 14px rgba(16, 185, 129, 0.2);
                }
              }
              @keyframes badgePulse {
                0%, 100% { transform: scale(1); opacity: 1; }
                50% { transform: scale(1.05); opacity: 0.88; }
              }
            `}</style>

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
                    const esMovil = esOrigenMovil(p);
                    const titilando = estaTitilando(p);
                    const tiempoRef = paradasDetectadasEnSesion[p.id] || (timeStamp ? new Date(timeStamp).getTime() : 0);
                    const segRestantes = Math.max(0, Math.ceil((25000 - (nowTick - tiempoRef)) / 1000));

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
                            background: titilando ? '#f59e0b' : '#10b981',
                            color: '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '11px',
                            fontWeight: 800,
                            boxShadow: titilando ? '0 0 0 5px rgba(245, 158, 11, 0.45)' : '0 0 0 4px #d1fae5',
                            transition: 'all 0.3s ease',
                          }}
                        >
                          {idx + 1}
                        </div>

                        <div
                          style={{
                            background: titilando ? undefined : '#ffffff',
                            border: titilando ? '2.5px solid #10b981' : '1px solid #e2e8f0',
                            borderRadius: '12px',
                            padding: '12px 16px',
                            boxShadow: titilando ? undefined : '0 1px 3px rgba(0,0,0,0.04)',
                            animation: titilando ? 'pulseColorMovil 1.3s infinite ease-in-out' : undefined,
                            transition: 'all 0.4s ease',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                <strong style={{ fontSize: '14.5px', color: '#0f172a' }}>
                                  #{idx + 1} • {p.fincaNombre || `Finca #${p.fincaId}`}
                                </strong>

                                {/* BADGE DE ORIGEN & NOTIFICACIÓN TITILANTE */}
                                {titilando ? (
                                  <span
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      background: '#059669',
                                      color: '#ffffff',
                                      fontSize: '11px',
                                      fontWeight: 800,
                                      padding: '3px 8px',
                                      borderRadius: '6px',
                                      animation: 'badgePulse 0.9s infinite ease-in-out',
                                      boxShadow: '0 2px 6px rgba(5, 150, 105, 0.35)',
                                    }}
                                  >
                                    <i className="fa-solid fa-mobile-screen-button"></i> 📲 NUEVO DESDE APP MÓVIL ({segRestantes}s)
                                  </span>
                                ) : esMovil ? (
                                  <span
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      background: '#ecfdf5',
                                      color: '#059669',
                                      fontSize: '10.5px',
                                      fontWeight: 700,
                                      padding: '2px 7px',
                                      borderRadius: '6px',
                                      border: '1px solid #a7f3d0',
                                    }}
                                  >
                                    <i className="fa-solid fa-mobile-screen"></i> App Móvil
                                  </span>
                                ) : (
                                  <span
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      background: '#f1f5f9',
                                      color: '#475569',
                                      fontSize: '10.5px',
                                      fontWeight: 600,
                                      padding: '2px 7px',
                                      borderRadius: '6px',
                                    }}
                                  >
                                    <i className="fa-solid fa-desktop"></i> Web
                                  </span>
                                )}

                                {esBufala && (
                                  <span style={{ fontSize: '10.5px', color: '#ea580c', background: '#fff7ed', border: '1px solid #fed7aa', padding: '1px 6px', borderRadius: '4px', fontWeight: 800 }}>
                                    🐃 Búfala
                                  </span>
                                )}
                                {p.esAcida && (
                                  <span style={{ fontSize: '10.5px', color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', padding: '1px 6px', borderRadius: '4px', fontWeight: 800 }}>
                                    ⚠️ Ácida
                                  </span>
                                )}
                              </div>

                              <span style={{ fontSize: '12px', color: '#64748b', display: 'block', marginTop: '2px' }}>
                                Productor: {p.propietarioNombre || p.propietario || 'No especificado'}
                              </span>
                              {p.observacion && (
                                <span style={{ fontSize: '11px', color: '#475569', display: 'block', marginTop: '3px', fontStyle: 'italic' }}>
                                  Nota: {p.observacion}
                                </span>
                              )}
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
                <div className={`grid ${hasBufala ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'} gap-3.5`}>
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

                  {hasBufala && (
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
                              ? 'bg-blue-50 border-blue-500 text-blue-800 shadow-2xs font-extrabold ring-1 ring-blue-500/20'
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
                              ? 'bg-purple-50 border-purple-500 text-purple-800 shadow-2xs font-extrabold ring-1 ring-purple-500/20'
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <span>🐃</span>
                          <span>Búfala</span>
                        </button>
                      </div>
                    </div>
                  )}
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
                <div className={`grid ${hasBufala ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'} gap-3.5`}>
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

                  {hasBufala && (
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
                  )}
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
      {/* MODAL 5: ENVIAR A RECEPTORÍA (1:1 V2_3_11_26 modalEnviarReceptoria)       */}
      {/* ========================================================================= */}
      {modalEnviarReceptoria && viajeActivo && (() => {
        const fincasT = fincasTicketsMap[viajeActivo.id] || [];
        const totalLts = ((viajeActivo as any)._litrosRecogidos || viajeActivo.totalLitrosRecogidos || 0) > 0 ? ((viajeActivo as any)._litrosRecogidos || viajeActivo.totalLitrosRecogidos) : fincasT.reduce((a: number, f: any) => a + Number(f.litros || f.Litros || 0), 0);
        const cantFincas = fincasT.length > 0 ? fincasT.length : ((viajeActivo as any).cantidadParadas || 0);

        return (
          <div style={{ position: 'fixed', inset: 0, zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)', padding: '16px' }}>
            <div className="content-card" style={{ width: '100%', maxWidth: '480px', borderRadius: '16px', overflow: 'hidden', padding: 0, border: '1px solid #e2e8f0', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
              {/* Header con gradiente ámbar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #e2e8f0', background: '#ffffff' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
                    <i className="fa-solid fa-truck-fast"></i>
                  </div>
                  <div>
                    <h2 style={{ fontSize: '17px', fontWeight: 800, color: '#0f172a', margin: 0 }}>Enviar Viaje a Receptoría</h2>
                    <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0 0' }}>Despachar camión con las fincas recolectadas</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setModalEnviarReceptoria(false)}
                  style={{ background: 'none', border: 'none', fontSize: '24px', color: '#94a3b8', cursor: 'pointer', lineHeight: 1 }}
                >
                  &times;
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  enviarReceptoriaMutation.mutate(viajeActivo.id);
                }}
              >
                <div style={{ padding: '20px', background: '#ffffff' }}>
                  {/* Tarjeta oscura de resumen */}
                  <div style={{ background: 'rgba(30, 41, 59, 0.85)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px', padding: '14px 16px', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
                      <span style={{ color: '#94a3b8' }}>Ticket:</span>
                      <strong style={{ color: '#60a5fa' }}>#{viajeActivo.codigoTicket || viajeActivo.id} ({viajeActivo.choferNombre || viajeActivo.nombreConductor})</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
                      <span style={{ color: '#94a3b8' }}>Total Litros en Tanque:</span>
                      <strong style={{ color: '#34d399', fontSize: '16px', fontWeight: 800 }}>{totalLts.toLocaleString()} Lts</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                      <span style={{ color: '#94a3b8' }}>Fincas Recolectadas:</span>
                      <strong style={{ color: '#cbd5e1' }}>{cantFincas}</strong>
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px', display: 'block', fontWeight: 600 }}>
                      Nota de Despacho (Opcional)
                    </label>
                    <input
                      type="text"
                      value={formReceptoria.observacion}
                      onChange={(e) => setFormReceptoria({ ...formReceptoria, observacion: e.target.value })}
                      className="form-input"
                      placeholder="Ej: Camión precintado, temperatura 4°C..."
                      style={{ height: '40px', fontSize: '13px' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '14px 20px', background: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
                  <button type="button" onClick={() => setModalEnviarReceptoria(false)} className="btn btn-outline" style={{ height: '40px', padding: '0 18px', fontWeight: 700 }}>
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={enviarReceptoriaMutation.isPending}
                    className="btn btn-warning"
                    style={{ background: 'linear-gradient(135deg, #d97706, #b45309)', border: 'none', fontWeight: 700, padding: '0 20px', height: '40px', color: '#fff', display: 'inline-flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(217,119,6,0.25)' }}
                  >
                    <i className="fa-solid fa-paper-plane"></i> {enviarReceptoriaMutation.isPending ? 'Enviando...' : 'Confirmar y Enviar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* ========================================================================= */}
      {/* MODAL 6: DESPACHAR A COMPAÑÍA / PLANTA (1:1 V2_3_11_26 modalEntregaDirecta) */}
      {/* ========================================================================= */}
      {modalEnviarCompania && viajeActivo && (() => {
        const fincasT = fincasTicketsMap[viajeActivo.id] || [];
        const totalCamion = ((viajeActivo as any)._litrosRecogidos || viajeActivo.totalLitrosRecogidos || 0) > 0 ? ((viajeActivo as any)._litrosRecogidos || viajeActivo.totalLitrosRecogidos) : fincasT.reduce((a: number, f: any) => a + Number(f.litros || f.Litros || 0), 0);
        const yaAsignado = (viajeActivo as any)._litrosEntregados || viajeActivo.totalLitrosEntregados || 0;
        const faltante = Math.max(0, totalCamion - yaAsignado);
        const sumaFilas = filasEntregaDirecta.reduce((acc, f) => acc + (Number(f.litros) || 0), 0);
        const diferencia = (faltante > 0 ? faltante : totalCamion) - sumaFilas;

        const unificarLitros = () => {
          setFilasEntregaDirecta([
            {
              companiaId: filasEntregaDirecta[0]?.companiaId || (companias[0]?.id || 0),
              litros: faltante > 0 ? faltante : totalCamion,
              tipoLeche: 'VACA',
            },
          ]);
        };

        const agregarFila = () => {
          setFilasEntregaDirecta([
            ...filasEntregaDirecta,
            { companiaId: companias[0]?.id || 0, litros: '', tipoLeche: 'VACA' },
          ]);
        };

        const removerFila = (index: number) => {
          if (filasEntregaDirecta.length > 1) {
            setFilasEntregaDirecta(filasEntregaDirecta.filter((_, i) => i !== index));
          }
        };

        const actualizarFila = (index: number, campo: keyof FilaEntregaDirecta, valor: any) => {
          const nuevas = [...filasEntregaDirecta];
          nuevas[index] = { ...nuevas[index], [campo]: valor };
          setFilasEntregaDirecta(nuevas);
        };

        return (
          <div style={{ position: 'fixed', inset: 0, zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)', padding: '16px' }}>
            <div className="content-card" style={{ maxWidth: '740px', width: '95%', background: '#ffffff', color: '#0f172a', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', overflow: 'hidden', padding: 0 }}>
              {/* Header gradiente verde esmeralda */}
              <div style={{ background: 'linear-gradient(135deg, #065f46, #059669, #10b981)', color: '#ffffff', padding: '18px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(255, 255, 255, 0.2)', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}>
                    <i className="fa-solid fa-building-circle-check"></i>
                  </div>
                  <div>
                    <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.01em' }}>
                      Entrega Directa a Compañías / Receptoría
                    </h2>
                    <p style={{ margin: '2px 0 0 0', fontSize: '12.5px', color: '#d1fae5', fontWeight: 500 }}>
                      Despacho directo o distribuido a una o varias queseras y receptoría
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setModalEnviarCompania(false)}
                  style={{ color: '#ffffff', background: 'rgba(255,255,255,0.15)', border: 'none', width: '32px', height: '32px', borderRadius: '8px', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s ease' }}
                >
                  &times;
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (filasEntregaDirecta.length === 0) {
                    toast.error('Agregue al menos un destino');
                    return;
                  }
                  for (let i = 0; i < filasEntregaDirecta.length; i++) {
                    const fila = filasEntregaDirecta[i];
                    if (!fila.companiaId || Number(fila.companiaId) <= 0) {
                      toast.error(`Seleccione la compañía en el renglón #${i + 1}`);
                      return;
                    }
                    if (!fila.litros || Number(fila.litros) <= 0) {
                      toast.error(`Ingrese litros válidos en el renglón #${i + 1}`);
                      return;
                    }
                  }
                  enviarCompaniaMutation.mutate(viajeActivo.id);
                }}
              >
                <div style={{ padding: '22px', background: '#f8fafc' }}>
                  {/* Subtexto del ticket */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', padding: '0 4px' }}>
                    <span style={{ fontSize: '13px', color: '#334155', fontWeight: 700 }}>
                      <i className="fa-solid fa-ticket" style={{ color: '#059669', marginRight: '6px' }}></i>
                      Ticket #{viajeActivo.codigoTicket || viajeActivo.id} — Conductor: {viajeActivo.choferNombre || viajeActivo.nombreConductor} ({viajeActivo.camionPlaca || 'Cisterna'})
                    </span>
                  </div>

                  {/* 3 Tarjetas de Métricas del Ticket */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '16px' }}>
                    <div style={{ background: '#ecfdf5', border: '1.5px solid #a7f3d0', borderBottomWidth: '3px', borderRadius: '10px', padding: '10px 12px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#065f46', textTransform: 'uppercase', letterSpacing: '0.02em', display: 'block' }}>
                        Total en Camión
                      </span>
                      <strong style={{ display: 'block', fontSize: '18px', fontWeight: 800, color: '#059669', marginTop: '2px' }}>
                        {totalCamion.toLocaleString()} Lts
                      </strong>
                    </div>

                    <div style={{ background: '#fdf4ff', border: '1.5px solid #f0abfc', borderBottomWidth: '3px', borderRadius: '10px', padding: '10px 12px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#86198f', textTransform: 'uppercase', letterSpacing: '0.02em', display: 'block' }}>
                        Ya Asignado
                      </span>
                      <strong style={{ display: 'block', fontSize: '18px', fontWeight: 800, color: '#9333ea', marginTop: '2px' }}>
                        {yaAsignado.toLocaleString()} Lts
                      </strong>
                    </div>

                    <div style={{ background: '#eff6ff', border: '1.5px solid #bfdbfe', borderBottomWidth: '3px', borderRadius: '10px', padding: '10px 12px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#1e40af', textTransform: 'uppercase', letterSpacing: '0.02em', display: 'block' }}>
                        Falta Asignar
                      </span>
                      <strong style={{ display: 'block', fontSize: '18px', fontWeight: 800, color: '#2563eb', marginTop: '2px' }}>
                        {faltante.toLocaleString()} Lts
                      </strong>
                    </div>
                  </div>

                  {/* SECCIÓN MULTI-COMPAÑÍAS */}
                  <div style={{ background: '#ffffff', border: '1.5px solid #e2e8f0', borderRadius: '12px', padding: '16px', marginBottom: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                      <label style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <i className="fa-solid fa-building" style={{ color: '#059669' }}></i> Destinos y Litros a Entregar
                      </label>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="btn btn-sm"
                          onClick={unificarLitros}
                          style={{ fontSize: '12px', padding: '6px 14px', border: '1.5px solid #c084fc', color: '#6b21a8', background: '#faf5ff', fontWeight: 700, borderRadius: '8px', display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', transition: 'all 0.2s ease' }}
                          title="Unificar todos los litros en un solo destino"
                        >
                          <i className="fa-solid fa-arrows-to-circle" style={{ color: '#9333ea' }}></i> Unificar Litros
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm"
                          onClick={agregarFila}
                          style={{ fontSize: '12px', padding: '6px 14px', border: '1.5px solid #a7f3d0', color: '#065f46', background: '#ecfdf5', fontWeight: 700, borderRadius: '8px', display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', transition: 'all 0.2s ease' }}
                        >
                          <i className="fa-solid fa-plus-circle" style={{ color: '#059669' }}></i> + Añadir Destino / Compañía
                        </button>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 140px 130px 38px', gap: '10px', padding: '0 12px 6px 12px', fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                      <span>Destino / Quesera / Receptoría</span>
                      <span>Tipo de Leche</span>
                      <span style={{ textAlign: 'right', paddingRight: '14px' }}>Litros</span>
                      <span></span>
                    </div>

                    {/* Filas dinámicas */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {filasEntregaDirecta.map((fila, idx) => (
                        <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1.8fr 140px 130px 38px', gap: '10px', alignItems: 'center' }}>
                          <div>
                            <CompaniaSelect
                              value={fila.companiaId}
                              onChange={(val) => actualizarFila(idx, 'companiaId', val)}
                              placeholder="-- Seleccionar Compañía --"
                            />
                          </div>
                          <div>
                            <select
                              value={fila.tipoLeche}
                              onChange={(e) => actualizarFila(idx, 'tipoLeche', e.target.value)}
                              className="form-input"
                              style={{ height: '40px', fontSize: '12.5px', fontWeight: 700 }}
                            >
                              <option value="VACA">🥛 Vaca</option>
                              {hasBufala && <option value="BUFALA">🐃 Búfala</option>}
                              <option value="ACIDA">🍋 Ácida</option>
                            </select>
                          </div>
                          <div style={{ position: 'relative' }}>
                            <input
                              type="number"
                              value={fila.litros}
                              onChange={(e) => actualizarFila(idx, 'litros', e.target.value === '' ? '' : Number(e.target.value))}
                              className="form-input"
                              placeholder="0"
                              min="1"
                              step="1"
                              required
                              style={{ height: '40px', fontSize: '14px', fontWeight: 800, textAlign: 'right', paddingRight: '36px', color: '#059669' }}
                            />
                            <span style={{ position: 'absolute', right: '10px', top: '10px', fontSize: '12px', fontWeight: 700, color: '#64748b', pointerEvents: 'none' }}>
                              Lts
                            </span>
                          </div>
                          <div>
                            {filasEntregaDirecta.length > 1 ? (
                              <button
                                type="button"
                                onClick={() => removerFila(idx)}
                                style={{ width: '36px', height: '36px', borderRadius: '8px', border: '1px solid #fee2e2', background: '#fef2f2', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                                title="Eliminar este destino"
                              >
                                <i className="fa-solid fa-trash-can"></i>
                              </button>
                            ) : (
                              <div style={{ width: '36px', height: '36px' }}></div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Balance Volumétrico Live */}
                  <div
                    style={{
                      padding: '12px 16px',
                      borderRadius: '10px',
                      marginBottom: '16px',
                      textAlign: 'center',
                      background: diferencia === 0 ? '#f0fdf4' : diferencia > 0 ? '#eff6ff' : '#fef2f2',
                      border: `1.5px solid ${diferencia === 0 ? '#86efac' : diferencia > 0 ? '#93c5fd' : '#fca5a5'}`,
                    }}
                  >
                    <div style={{ fontSize: '16px', fontWeight: 800, color: diferencia === 0 ? '#15803d' : diferencia > 0 ? '#1d4ed8' : '#b91c1c' }}>
                      {diferencia === 0
                        ? '✅ Total Distribuido con Precisión Exacta'
                        : diferencia > 0
                        ? `ℹ️ Faltan ${diferencia.toLocaleString()} Lts por asignar del tanque`
                        : `⚠️ Exceso de ${Math.abs(diferencia).toLocaleString()} Lts sobre el volumen disponible`}
                    </div>
                    <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#64748b' }}>
                      Suma actual a despachar: {sumaFilas.toLocaleString()} Lts de {faltante > 0 ? faltante.toLocaleString() : totalCamion.toLocaleString()} Lts disponibles
                    </span>
                  </div>

                  {/* Observaciones */}
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '5px', display: 'block' }}>
                      <i className="fa-solid fa-comment-dots" style={{ color: '#64748b', marginRight: '4px' }}></i>
                      Observación / Ticket de Pesaje Planta (Opcional)
                    </label>
                    <input
                      type="text"
                      value={obsEntregaDirecta}
                      onChange={(e) => setObsEntregaDirecta(e.target.value)}
                      className="form-input"
                      placeholder="Ej: Ticket #5829, recibido por Ing. Romero..."
                      style={{ height: '42px', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '13px', background: '#ffffff', color: '#0f172a', width: '100%' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '14px 22px', background: '#ffffff', borderTop: '1px solid #e2e8f0', borderRadius: '0 0 16px 16px' }}>
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => setModalEnviarCompania(false)}
                    style={{ height: '40px', padding: '0 18px', borderRadius: '8px', fontWeight: 600, borderColor: '#cbd5e1', color: '#475569' }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={enviarCompaniaMutation.isPending}
                    className="btn btn-success"
                    style={{ background: 'linear-gradient(135deg, #059669, #10b981)', border: 'none', fontWeight: 700, padding: '0 22px', height: '40px', borderRadius: '8px', color: '#ffffff', display: 'inline-flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(16,185,129,0.3)', cursor: 'pointer' }}
                  >
                    <i className="fa-solid fa-check-circle"></i> {enviarCompaniaMutation.isPending ? 'Registrando...' : 'Registrar Entrega'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* ========================================================================= */}
      {/* MODAL 7: TRASPASO DE LECHE A OTRO CHOFER (1:1 V2_3_11_26 modalTraspasoLeche) */}
      {/* ========================================================================= */}
      {modalTraspaso && viajeActivo && (() => {
        const fincasT = fincasTicketsMap[viajeActivo.id] || [];
        const totalCamion = ((viajeActivo as any)._litrosRecogidos || viajeActivo.totalLitrosRecogidos || 0) > 0 ? ((viajeActivo as any)._litrosRecogidos || viajeActivo.totalLitrosRecogidos) : fincasT.reduce((a: number, f: any) => a + Number(f.litros || f.Litros || 0), 0);
        const yaAsignado = (viajeActivo as any)._litrosEntregados || viajeActivo.totalLitrosEntregados || 0;
        const ltsDisponibles = Math.max(0, totalCamion - yaAsignado);
        const ticketsDestino = viajes.filter((v) => v.id !== viajeActivo.id && v.estado !== 'FINALIZADO');

        const previewDestinoNombre = (() => {
          if (modoTraspaso === 'EXISTENTE') {
            const dest = ticketsDestino.find((t) => t.id === Number(formTraspaso.ticketDestinoId));
            return dest ? `Ticket #${dest.codigoTicket || dest.id} - ${dest.choferNombre || dest.nombreConductor}` : 'Seleccionar Ticket Destino';
          } else {
            const ch = conductores.find((c: any) => c.id === Number(traspasoChoferDestinoId));
            return ch ? (ch.nombreCompleto || ch.nombre) : 'Seleccionar Conductor';
          }
        })();

        return (
          <div style={{ position: 'fixed', inset: 0, zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)', padding: '16px' }}>
            <div className="content-card" style={{ maxWidth: '540px', width: '95%', borderRadius: '16px', border: '1.5px solid #0d948840', boxShadow: '0 20px 45px rgba(13, 148, 136, 0.2)', overflow: 'hidden', padding: 0, background: '#ffffff' }}>
              {/* Header gradiente teal */}
              <div style={{ background: 'linear-gradient(135deg, #f0fdfa 0%, #ccfbf1 100%)', borderBottom: '1px solid #99f6e4', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ background: '#0d9488', color: '#ffffff', width: '42px', height: '42px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', boxShadow: '0 4px 10px rgba(13, 148, 136, 0.3)' }}>
                    <i className="fa-solid fa-right-left"></i>
                  </div>
                  <div>
                    <h2 style={{ fontSize: '17px', fontWeight: 800, color: '#115e59', margin: 0 }}>Traspaso de Leche a Otro Chofer</h2>
                    <p style={{ fontSize: '12px', color: '#0f766e', margin: '2px 0 0 0' }}>Transferir carga recolectada a otro conductor / viaje</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setModalTraspaso(false)}
                  style={{ color: '#0f766e', fontSize: '24px', background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1 }}
                >
                  &times;
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (modoTraspaso === 'EXISTENTE') {
                    if (!formTraspaso.ticketDestinoId || Number(formTraspaso.ticketDestinoId) <= 0) {
                      toast.error('Seleccione un viaje / cisterna destino');
                      return;
                    }
                  } else {
                    if (!traspasoChoferDestinoId || Number(traspasoChoferDestinoId) <= 0) {
                      toast.error('Seleccione el conductor de destino');
                      return;
                    }
                  }
                  if (!formTraspaso.litrosTraspaso || Number(formTraspaso.litrosTraspaso) <= 0) {
                    toast.error('Ingrese litros válidos a transferir');
                    return;
                  }
                  traspasoMutation.mutate(viajeActivo.id);
                }}
              >
                <div style={{ padding: '20px', background: '#ffffff' }}>
                  {/* RESUMEN DEL TICKET ORIGEN */}
                  <div style={{ background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: '12px', padding: '12px 16px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Ticket Origen:</span>
                      <div style={{ fontSize: '14.5px', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>
                        #{viajeActivo.codigoTicket || viajeActivo.id} - {viajeActivo.choferNombre || viajeActivo.nombreConductor}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Volumen Disponible:</span>
                      <div style={{ fontSize: '18px', fontWeight: 900, color: '#0d9488', marginTop: '2px' }}>
                        {(ltsDisponibles > 0 ? ltsDisponibles : totalCamion).toLocaleString()} Lts
                      </div>
                    </div>
                  </div>

                  {/* SELECTOR DE MODO: EXISTENTE VS NUEVO */}
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px', display: 'block' }}>
                      <i className="fa-solid fa-layer-group" style={{ color: '#0d9488', marginRight: '4px' }}></i> Modo de Asignación del Ticket Destino:
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', background: '#f1f5f9', padding: '4px', borderRadius: '10px' }}>
                      <button
                        type="button"
                        onClick={() => setModoTraspaso('EXISTENTE')}
                        className="btn"
                        style={{
                          height: '36px',
                          fontSize: '12px',
                          fontWeight: 800,
                          borderRadius: '8px',
                          background: modoTraspaso === 'EXISTENTE' ? '#0d9488' : 'transparent',
                          color: modoTraspaso === 'EXISTENTE' ? '#ffffff' : '#475569',
                          border: 'none',
                          transition: 'all 0.2s',
                        }}
                      >
                        <i className="fa-solid fa-ticket"></i> Ticket Ya Creado
                      </button>
                      <button
                        type="button"
                        onClick={() => setModoTraspaso('NUEVO')}
                        className="btn"
                        style={{
                          height: '36px',
                          fontSize: '12px',
                          fontWeight: 800,
                          borderRadius: '8px',
                          background: modoTraspaso === 'NUEVO' ? '#0d9488' : 'transparent',
                          color: modoTraspaso === 'NUEVO' ? '#ffffff' : '#475569',
                          border: 'none',
                          transition: 'all 0.2s',
                        }}
                      >
                        <i className="fa-solid fa-plus-circle"></i> Crear Ticket Automático
                      </button>
                    </div>
                  </div>

                  {/* SECCIÓN MODO 1: TICKET YA CREADO */}
                  {modoTraspaso === 'EXISTENTE' ? (
                    <div style={{ marginBottom: '16px' }}>
                      <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px', display: 'block' }}>
                        <i className="fa-solid fa-ticket-simple" style={{ color: '#0d9488' }}></i> Seleccionar Ticket de Destino *
                      </label>
                      <select
                        value={formTraspaso.ticketDestinoId}
                        onChange={(e) => setFormTraspaso({ ...formTraspaso, ticketDestinoId: Number(e.target.value) })}
                        className="form-input"
                        style={{ height: '42px', fontSize: '13px', fontWeight: 700, color: '#0f172a', borderRadius: '8px', border: '1.5px solid #cbd5e1' }}
                        required
                      >
                        <option value="0">-- Seleccione Cisterna / Viaje Destino --</option>
                        {ticketsDestino.map((t) => (
                          <option key={t.id} value={t.id}>
                            Ticket #{t.codigoTicket || t.id} — {t.choferNombre || t.nombreConductor} ({t.camionPlaca || 'Cisterna'})
                          </option>
                        ))}
                      </select>
                      <small style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', display: 'block' }}>
                        Selecciona el viaje abierto del chofer receptor que recibirá los litros.
                      </small>
                    </div>
                  ) : (
                    /* SECCIÓN MODO 2: CREAR NUEVO TICKET AUTOMÁTICAMENTE */
                    <div style={{ marginBottom: '16px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '10px' }}>
                        <div>
                          <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px', display: 'block' }}>
                            <i className="fa-solid fa-user-check" style={{ color: '#0d9488' }}></i> Chofer de Destino *
                          </label>
                          <ChoferSelect
                            value={traspasoChoferDestinoId}
                            onChange={(val) => setTraspasoChoferDestinoId(val)}
                            placeholder="-- Seleccionar Conductor --"
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px', display: 'block' }}>
                            <i className="fa-solid fa-calendar-day" style={{ color: '#0d9488' }}></i> Fecha del Ticket
                          </label>
                          <input
                            type="date"
                            value={traspasoFechaDestino}
                            onChange={(e) => setTraspasoFechaDestino(e.target.value)}
                            className="form-input"
                            style={{ height: '42px', fontSize: '13px', fontWeight: 700, borderRadius: '8px', border: '1.5px solid #cbd5e1' }}
                          />
                        </div>
                      </div>
                      <small style={{ fontSize: '11px', color: '#0d9488', fontWeight: 600, marginTop: '6px', display: 'block' }}>
                        ✨ Se creará automáticamente un nuevo ticket en estado ABIERTO para el chofer seleccionado.
                      </small>
                    </div>
                  )}

                  {/* VOLUMEN A TRASPASAR */}
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', margin: 0 }}>
                        <i className="fa-solid fa-faucet-drip" style={{ color: '#0d9488' }}></i> Litros a Traspasar *
                      </label>
                      <button
                        type="button"
                        onClick={() => setFormTraspaso({ ...formTraspaso, litrosTraspaso: ltsDisponibles > 0 ? ltsDisponibles : totalCamion })}
                        style={{ fontSize: '11px', fontWeight: 800, color: '#0d9488', background: '#f0fdfa', border: '1px solid #99f6e4', padding: '2px 8px', borderRadius: '6px', cursor: 'pointer' }}
                      >
                        Traspasar Todo el Tanque
                      </button>
                    </div>
                    <div style={{ position: 'relative' }}>
                      <input
                        type="number"
                        value={formTraspaso.litrosTraspaso}
                        onChange={(e) => setFormTraspaso({ ...formTraspaso, litrosTraspaso: e.target.value === '' ? '' : Number(e.target.value) })}
                        className="form-input"
                        min="1"
                        step="1"
                        required
                        style={{ height: '44px', fontSize: '17px', fontWeight: 800, color: '#0d9488', background: '#f0fdfa', border: '2px solid #5eead4', paddingRight: '48px' }}
                      />
                      <span style={{ position: 'absolute', right: '14px', top: '12px', fontSize: '13px', fontWeight: 800, color: '#0d9488', pointerEvents: 'none' }}>
                        Lts
                      </span>
                    </div>
                  </div>

                  {/* OBSERVACIÓN */}
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px', display: 'block' }}>
                      <i className="fa-solid fa-comment-dots" style={{ color: '#64748b' }}></i> Nota / Motivo del Traspaso (Opcional)
                    </label>
                    <input
                      type="text"
                      value={formTraspaso.observacion}
                      onChange={(e) => setFormTraspaso({ ...formTraspaso, observacion: e.target.value })}
                      className="form-input"
                      placeholder="Ej: Traspaso de leche para completar viaje de despacho..."
                      style={{ height: '40px', fontSize: '13px', borderRadius: '8px', border: '1.5px solid #cbd5e1' }}
                    />
                  </div>

                  {/* DIAGRAMA VISUAL DE TRAZABILIDAD DEL TRASPASO */}
                  <div style={{ background: '#f0fdfa', border: '1.5px dashed #5eead4', borderRadius: '12px', padding: '12px 14px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 800, color: '#0f766e', textTransform: 'uppercase', marginBottom: '6px' }}>
                      <i className="fa-solid fa-route"></i> Flujo del Traspaso Logístico:
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', fontSize: '12px' }}>
                      <div style={{ flex: 1, background: '#ffffff', padding: '6px 10px', borderRadius: '6px', border: '1px solid #ccfbf1', textAlign: 'center' }}>
                        <span style={{ display: 'block', fontSize: '10.5px', color: '#64748b' }}>ORIGEN</span>
                        <strong style={{ color: '#0f172a', fontSize: '12px' }}>
                          {viajeActivo.choferNombre || viajeActivo.nombreConductor}
                        </strong>
                      </div>
                      <div style={{ color: '#0d9488', fontSize: '16px', fontWeight: 900 }}>
                        <i className="fa-solid fa-arrow-right-long"></i>
                      </div>
                      <div style={{ flex: 1, background: '#ffffff', padding: '6px 10px', borderRadius: '6px', border: '1px solid #ccfbf1', textAlign: 'center' }}>
                        <span style={{ display: 'block', fontSize: '10.5px', color: '#64748b' }}>DESTINO</span>
                        <strong style={{ color: '#0d9488', fontSize: '12px' }}>
                          {previewDestinoNombre}
                        </strong>
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '14px 20px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', borderRadius: '0 0 16px 16px' }}>
                  <button type="button" onClick={() => setModalTraspaso(false)} className="btn btn-outline" style={{ height: '40px', padding: '0 18px', fontWeight: 600 }}>
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={traspasoMutation.isPending}
                    className="btn btn-primary"
                    style={{ background: 'linear-gradient(135deg, #0d9488, #059669)', border: 'none', fontWeight: 800, padding: '0 22px', height: '42px', color: '#fff', borderRadius: '8px', boxShadow: '0 4px 14px rgba(13,148,136,0.3)', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                  >
                    <i className="fa-solid fa-right-left"></i> {traspasoMutation.isPending ? 'Traspasando...' : 'Confirmar Traspaso'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

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
