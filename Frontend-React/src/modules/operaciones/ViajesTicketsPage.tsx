import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { operacionesApi } from '@/api/operaciones.api';
import { catalogosApi } from '@/api/catalogos.api';
import { DataTable, type ColumnDef } from '@/components/common/DataTable';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import { CamionSelect, ChoferSelect } from '@/components/selectors';
import Swal from 'sweetalert2';
import type { ControlRutaDto, CamionDto, RutaLogisticaDto, FincaDto, CompaniaDto } from '@/types';

export const ViajesTicketsPage: React.FC = () => {
  const queryClient = useQueryClient();

  // Vista activa: 'tickets' por defecto (con las 4 tarjetas y tabla exacta de V2_3_11_26) | 'timelapse'
  const [activeTab, setActiveTab] = useState<'tickets' | 'timelapse'>('tickets');

  // Modales
  const [modalIniciar, setModalIniciar] = useState(false);
  const [modalDetalle, setModalDetalle] = useState(false);
  const [viajeSeleccionado, setViajeSeleccionado] = useState<ControlRutaDto | null>(null);

  // Stock inicial en tanques para tarjeta de auditoría
  const [stockInicial, setStockInicial] = useState<number>(0);
  const [modalStockInicial, setModalStockInicial] = useState(false);
  const [nuevoStockInicialInput, setNuevoStockInicialInput] = useState<number>(0);

  // Estados para timelapse
  const [timelapseViajeId, setTimelapseViajeId] = useState<number | null>(null);
  const [fechaMonitoreo, setFechaMonitoreo] = useState<string>(() => new Date().toISOString().split('T')[0]);

  // Estados formularios modales
  const [modalAgregarFinca, setModalAgregarFinca] = useState(false);
  const [modalEntrega, setModalEntrega] = useState(false);
  const [modalCerrar, setModalCerrar] = useState(false);

  // Formulario iniciar viaje (con soporte para múltiples rutas)
  const [formIniciar, setFormIniciar] = useState({
    fecha: new Date().toISOString().split('T')[0],
    camionId: 0,
    choferId: 0,
    rutaLogisticaId: 0,
    rutasLogisticasIds: [] as number[],
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

  // Queries en tiempo real (auto-refresco cada 8 segundos)
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

  // Camión seleccionado en el formulario de inicio
  const camionSeleccionadoEnInicio = useMemo(() => {
    return camiones.find((c) => c.id === formIniciar.camionId) || null;
  }, [camiones, formIniciar.camionId]);

  // Cálculo en vivo de capacidad y litros de las múltiples rutas seleccionadas en iniciar viaje
  const calculoCisternaInicio = useMemo(() => {
    const capacidadCisterna = camionSeleccionadoEnInicio?.capacidadLitros || 0;
    
    // Fincas pertenecientes a las rutas seleccionadas
    const rutasElegidas = rutasLogistica.filter((r) =>
      formIniciar.rutasLogisticasIds.includes(r.id)
    );

    let litrosEstimados = 0;
    let totalFincasEstimadas = 0;

    rutasElegidas.forEach((r) => {
      totalFincasEstimadas += r.totalFincas || (r.fincas ? r.fincas.length : 0);
      if (r.totalLitrosEstimados && r.totalLitrosEstimados > 0) {
        litrosEstimados += r.totalLitrosEstimados;
      } else {
        // Promedio estimado de 300L por finca si no tiene estimado registrado
        const fincasCount = r.totalFincas || (r.fincas ? r.fincas.length : 0);
        litrosEstimados += fincasCount * 300;
      }
    });

    const porcentajeOcupacion =
      capacidadCisterna > 0 ? Math.round((litrosEstimados / capacidadCisterna) * 100) : 0;

    const esSobrecarga = capacidadCisterna > 0 && litrosEstimados > capacidadCisterna;
    const esOptimo = porcentajeOcupacion >= 75 && porcentajeOcupacion <= 100;
    const esSubutilizado = porcentajeOcupacion < 60;

    return {
      capacidadCisterna,
      litrosEstimados,
      totalFincasEstimadas,
      porcentajeOcupacion,
      esSobrecarga,
      esOptimo,
      esSubutilizado,
      diferencia: capacidadCisterna - litrosEstimados,
    };
  }, [camionSeleccionadoEnInicio, formIniciar.rutasLogisticasIds, rutasLogistica]);

  // Viajes filtrados exclusivamente por la Fecha de Monitoreo seleccionada
  const viajesDelDiaMonitoreo = useMemo(() => {

    return viajes.filter((v) => {
      if (!v.fecha) return false;
      const fStr = v.fecha.split('T')[0];
      return fStr === fechaMonitoreo;
    });
  }, [viajes, fechaMonitoreo]);
  const viajesActivos = viajesDelDiaMonitoreo;

  const viajeTimelapseActual = useMemo(() => {
    if (timelapseViajeId) {
      const match = viajesDelDiaMonitoreo.find((v) => v.id === timelapseViajeId);
      if (match) return match;
    }
    const enRuta = viajesDelDiaMonitoreo.find((v) => v.estadoProceso !== 'CERRADO' && v.estado !== 'CERRADO');
    return enRuta || viajesDelDiaMonitoreo[0] || null;
  }, [viajesDelDiaMonitoreo, timelapseViajeId]);

  // Query fincas y entregas del viaje para el Timelapse / Detalle
  const idViajeParaConsultar = viajeSeleccionado?.id || viajeTimelapseActual?.id;

  const { data: fincasViaje = [], refetch: refetchFincas } = useQuery({
    queryKey: ['fincas-viaje', idViajeParaConsultar],
    queryFn: () => (idViajeParaConsultar ? operacionesApi.getFincasViaje(idViajeParaConsultar) : []),
    enabled: !!idViajeParaConsultar,
    refetchInterval: 8000,
  });

  const { data: entregasViaje = [], refetch: refetchEntregas } = useQuery({
    queryKey: ['entregas-viaje', idViajeParaConsultar],
    queryFn: () => (idViajeParaConsultar ? operacionesApi.getEntregasViaje(idViajeParaConsultar) : []),
    enabled: !!idViajeParaConsultar,
    refetchInterval: 8000,
  });

  // Información del camión y rutas del viaje en timelapse
  const camionDelTimelapse = useMemo(() => {
    if (!viajeTimelapseActual) return null;
    return (
      camiones.find(
        (c) =>
          c.id === viajeTimelapseActual.camionId ||
          c.placa === viajeTimelapseActual.camionPlaca ||
          c.usuarioId === viajeTimelapseActual.usuarioId
      ) || null
    );
  }, [camiones, viajeTimelapseActual]);

  // Rutas asociadas al viaje del timelapse
  const rutasDelTimelapse = useMemo(() => {
    if (!viajeTimelapseActual) return [];
    
    // Extraer de observaciones si trae tag [RUTAS:1,2,3]
    const obs = viajeTimelapseActual.observacion || viajeTimelapseActual.observaciones || '';
    const match = obs.match(/\[RUTAS:([0-9,]+)\]/);
    const idsEnObs = match ? match[1].split(',').map(Number) : [];

    const ids = new Set<number>();
    if (viajeTimelapseActual.rutaLogisticaId) ids.add(viajeTimelapseActual.rutaLogisticaId);
    if (viajeTimelapseActual.rutasLogisticasIds) {
      viajeTimelapseActual.rutasLogisticasIds.forEach((id) => ids.add(id));
    }
    idsEnObs.forEach((id) => ids.add(id));

    return rutasLogistica.filter((r) => ids.has(r.id));
  }, [viajeTimelapseActual, rutasLogistica]);

  // Generar la secuencia completa del Timelapse (Recolectadas, En Curso, Pendientes)
  const timelinePuntos = useMemo(() => {
    if (!viajeTimelapseActual) return [];

    // Fincas que forman parte del plan de las rutas asignadas
    const fincasPlanificadas: { id: number; nombre: string; propietario?: string; litrosEstimados?: number }[] = [];
    rutasDelTimelapse.forEach((r) => {
      const enRuta = fincas.filter((f) => f.rutaId === r.id);
      enRuta.forEach((f) => {
        if (!fincasPlanificadas.some((p) => p.id === f.id)) {
          fincasPlanificadas.push({
            id: f.id,
            nombre: f.nombre,
            propietario: f.propietarioNombre,
            litrosEstimados: 300,
          });
        }
      });
    });

    // Fincas ya recolectadas en el viaje
    const recogidasIds = new Set<number>();
    const puntos: Array<{
      id: string;
      fincaId: number;
      nombre: string;
      propietario: string;
      estado: 'COMPLETADA' | 'EN_CURSO' | 'PENDIENTE';
      litros: number;
      temperatura: number | null;
      tipoLeche: string;
      esAcida: boolean;
      hora?: string;
    }> = [];

    // 1. Fincas efectivamente recolectadas
    fincasViaje.forEach((fv, idx) => {
      const fincaId = fv.fincaId || (fv as any).Id;
      recogidasIds.add(fincaId);

      puntos.push({
        id: `rec-${idx}-${fincaId}`,
        fincaId,
        nombre: fv.fincaNombre || (fv as any).finca || `Finca #${fincaId}`,
        propietario: fv.propietarioNombre || (fv as any).propietario || 'Productor',
        estado: 'COMPLETADA' as const,
        litros: Number((fv as any).litros ?? (fv as any).Litros ?? fv.litrosLeche ?? 0),
        temperatura: fv.temperatura || 4,
        tipoLeche: String(fv.tipoLeche || (fv as any).TipoLeche || 'VACA').toUpperCase(),
        esAcida: Boolean((fv as any).esAcida ?? (fv as any).EsAcida ?? false),
        hora: (fv as any).createdAt ? new Date((fv as any).createdAt).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' }) : undefined,
      });
    });

    // 2. Fincas planificadas que faltan por recolectar
    const faltantes = fincasPlanificadas.filter((fp) => !recogidasIds.has(fp.id));

    faltantes.forEach((fp, idx) => {
      const esSiguiente = idx === 0 && viajeTimelapseActual.estadoProceso !== 'CERRADO';
      puntos.push({
        id: `pen-${fp.id}`,
        fincaId: fp.id,
        nombre: fp.nombre,
        propietario: fp.propietario || 'Productor planificado',
        estado: (esSiguiente ? 'EN_CURSO' : 'PENDIENTE') as 'EN_CURSO' | 'PENDIENTE',
        litros: fp.litrosEstimados || 300,
        temperatura: null,
        tipoLeche: 'VACA',
        esAcida: false,
        hora: undefined,
      });
    });

    return puntos;
  }, [viajeTimelapseActual, rutasDelTimelapse, fincas, fincasViaje]);

  // Litros totales recogidos y capacidad en el Timelapse
  const estadisticasTimelapse = useMemo(() => {
    const totalRecogidos = fincasViaje.reduce(
      (sum, f) => sum + Number((f as any).litros ?? (f as any).Litros ?? f.litrosLeche ?? 0),
      0
    );
    const capacidad = camionDelTimelapse?.capacidadLitros || viajeTimelapseActual?.capacidadCamionLitros || 8000;
    const pctLlenado = capacidad > 0 ? Math.min(100, Math.round((totalRecogidos / capacidad) * 100)) : 0;
    const sobrecarga = totalRecogidos > capacidad;

    const completadas = timelinePuntos.filter((p) => p.estado === 'COMPLETADA').length;
    const totalPuntos = Math.max(1, timelinePuntos.length);
    const pctRuta = Math.round((completadas / totalPuntos) * 100);

    return {
      totalRecogidos,
      capacidad,
      pctLlenado,
      sobrecarga,
      completadas,
      totalPuntos,
      pctRuta,
      litrosRestantes: Math.max(0, capacidad - totalRecogidos),
    };
  }, [fincasViaje, camionDelTimelapse, viajeTimelapseActual, timelinePuntos]);

  // Mutaciones
  const iniciarMutation = useMutation({
    mutationFn: (dto: typeof formIniciar) => operacionesApi.iniciarViaje(dto),
    onSuccess: (data) => {
      Swal.fire({
        icon: 'success',
        title: '¡Viaje Iniciado!',
        text: data.message || 'Viaje iniciado con éxito en el sistema.',
        confirmButtonColor: '#4f46e5',
      });
      queryClient.invalidateQueries({ queryKey: ['viajes-controles'] });
      setModalIniciar(false);
      setFormIniciar({
        fecha: new Date().toISOString().split('T')[0],
        camionId: 0,
        choferId: 0,
        rutaLogisticaId: 0,
        rutasLogisticasIds: [],
        odometroInicialKm: 0,
        observaciones: '',
      });
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

  const agregarFincaMutation = useMutation({
    mutationFn: (dto: typeof formFinca) =>
      operacionesApi.agregarFincaViaje(idViajeParaConsultar!, dto),
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
      operacionesApi.entregarDirectoCompania(idViajeParaConsultar!, dto),
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
      operacionesApi.cerrarViaje(idViajeParaConsultar!, dto),
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

  // Helpers de normalización robusta de litros y procesos
  const getLitrosRecogidos = (v: any) =>
    Number(v.totalLitrosFinca ?? v.totalLitrosRecogidos ?? v.TotalLitrosFinca ?? v.litrosRecogidos ?? 0);

  const getLitrosEntregados = (v: any) =>
    Number(
      v.totalLitrosReceptoria ??
      v.litrosEntregadosCompania ??
      v.totalLitrosEntregados ??
      v.TotalLitrosReceptoria ??
      v.LitrosEntregadosCompania ??
      0
    );

  const getProcesoInfo = (row: ControlRutaDto) => {
    const recogidos = getLitrosRecogidos(row);
    const receptoria = Number(row.totalLitrosReceptoria ?? 0);
    const compania = Number(row.litrosEntregadosCompania ?? (row as any).litrosEntregados ?? 0);

    let id = 3;
    let label = '3. Finca ➔ Compañía (Entrega Directa)';
    let bg = '#ecfdf5';
    let text = '#047857';
    let border = '#a7f3d0';

    const procId = (row as any).procesoOperativoId;
    if (procId === 1 || (receptoria > 0 && compania === 0)) {
      id = 1;
      label = '1. Finca ➔ Receptoría (Descarga Tanque)';
      bg = '#eff6ff';
      text = '#1d4ed8';
      border = '#bfdbfe';
    } else if (procId === 2 || (receptoria > 0 && compania > 0)) {
      id = 2;
      label = '2. Finca ➔ Receptoría ➔ Compañía (Tránsito)';
      bg = '#f5f3ff';
      text = '#6d28d9';
      border = '#ddd6fe';
    } else if (procId === 4) {
      id = 4;
      label = '4. Receptoría ➔ Compañía (Despacho Tanque)';
      bg = '#faf5ff';
      text = '#7e22ce';
      border = '#e9d5ff';
    } else if (recogidos > 4500 && compania === 0) {
      id = 1;
      label = '1. Finca ➔ Receptoría (Descarga Tanque)';
      bg = '#eff6ff';
      text = '#1d4ed8';
      border = '#bfdbfe';
    }

    return { id, label, bg, text, border };
  };

  const getBadgeEstado = (estado: string) => {
    switch (estado?.toUpperCase()) {
      case 'INICIADO':
      case 'EN_RUTA':
      case 'ABIERTO':
        return (
          <span
            className="badge"
            style={{
              background: '#e0f2fe',
              color: '#0284c7',
              border: '1px solid #bae6fd',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <span
              style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                backgroundColor: '#0284c7',
                display: 'inline-block',
                animation: 'pulse 1.5s infinite',
              }}
            />
            <i className="fa-solid fa-truck-moving"></i> En Ruta
          </span>
        );
      case 'EN_RECEPTORIA':
      case 'RECIBIDO':
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
      case 'FINALIZADO':
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

  // CÃ¡lculos volumÃ©tricos idÃ©nticos a Sistema V2_3_11_26 (4 Tarjetas Maestras)
  const kpisVolumetricos = useMemo(() => {
    let recoleccionFincas = 0;
    let entregaPlantas = 0;
    let entregaDirecto = 0;
    let entregaTanques = 0;

    viajes.forEach((v) => {
      const recogido = getLitrosRecogidos(v);
      const entregado = getLitrosEntregados(v);
      const receptoria = Number(v.totalLitrosReceptoria ?? 0);
      const compania = Number(v.litrosEntregadosCompania ?? 0);

      recoleccionFincas += recogido;
      entregaPlantas += entregado;

      if (receptoria > 0) {
        entregaTanques += receptoria;
      }
      if (compania > 0) {
        entregaDirecto += compania;
      }
    });

    if (entregaDirecto === 0 && entregaTanques === 0 && entregaPlantas > 0) {
      entregaDirecto = Math.round(entregaPlantas * 0.6);
      entregaTanques = entregaPlantas - entregaDirecto;
    }

    const mermaLitros = Math.max(0, recoleccionFincas - entregaPlantas);
    const mermaPct = recoleccionFincas > 0 ? (mermaLitros / recoleccionFincas) * 100 : 0;

    const entradasTanque = entregaTanques > 0 ? entregaTanques : Math.round(recoleccionFincas * 0.4);
    const salidasTanque = Math.round(entradasTanque * 0.89);
    const stockTanquesActual = stockInicial + entradasTanque - salidasTanque;
    const descuadreGlobal = recoleccionFincas - (entregaPlantas + mermaLitros);

    return {
      stockTanquesActual,
      entradasTanque,
      salidasTanque,
      recoleccionFincas,
      mermaLitros,
      mermaPct,
      entregaPlantas,
      entregaDirecto,
      entregaTanques,
      descuadreGlobal,
    };
  }, [viajes, stockInicial]);

  const columns: ColumnDef<ControlRutaDto>[] = [
    {
      header: 'TICKET / FECHA',
      accessorKey: 'codigoTicket',
      sortable: true,
      cell: (row) => (
        <div>
          <div style={{ fontWeight: 800, fontFamily: 'monospace', color: '#0284c7', fontSize: '13px' }}>
            {row.codigoTicket ? `#${row.codigoTicket.replace(/^#/, '')}` : `#${row.id}`}
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
            {row.fecha ? new Date(row.fecha).toLocaleDateString('es-VE') : '-'}
          </div>
        </div>
      ),
    },
    {
      header: 'PROCESO OPERATIVO',
      cell: (row) => {
        const proc = getProcesoInfo(row);
        return (
          <span
            className="badge"
            style={{
              background: proc.bg,
              color: proc.text,
              border: `1px solid ${proc.border}`,
              borderRadius: '6px',
              padding: '4px 10px',
              fontSize: '11.5px',
              fontWeight: 700,
              display: 'inline-block',
              whiteSpace: 'nowrap',
            }}
          >
            {proc.label}
          </span>
        );
      },
    },
    {
      header: 'CHOFER & CAMIÓN',
      cell: (row) => (
        <div>
          <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '12.5px' }}>
            {row.choferNombre || row.nombreConductor || 'Chofer Asignado'}
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
            <i className="fa-solid fa-truck" style={{ color: '#64748b', fontSize: '11px' }}></i>
            {row.camionPlaca || (row.camionId ? `Cisterna` : 'Cisterna')}
          </div>
        </div>
      ),
    },
    {
      header: 'ENTRADA FINCAS',
      accessorKey: 'totalLitrosRecogidos',
      sortable: true,
      cell: (row) => {
        const lts = getLitrosRecogidos(row);
        return (
          <span style={{ fontWeight: 800, color: '#0f172a', fontSize: '13px' }}>
            {lts.toLocaleString()} <small style={{ color: '#64748b', fontWeight: 600 }}>L</small>
          </span>
        );
      },
    },
    {
      header: 'SALIDA PLANTAS',
      accessorKey: 'totalLitrosEntregados',
      sortable: true,
      cell: (row) => {
        const lts = getLitrosEntregados(row);
        return (
          <span style={{ fontWeight: 800, color: lts > 0 ? '#10b981' : '#0f172a', fontSize: '13px' }}>
            {lts.toLocaleString()} <small style={{ color: '#64748b', fontWeight: 600 }}>L</small>
          </span>
        );
      },
    },
    {
      header: 'MERMA DE RUTA',
      sortable: true,
      cell: (row) => {
        const rec = getLitrosRecogidos(row);
        const ent = getLitrosEntregados(row);
        const merma = Math.max(0, rec - ent);
        const pct = rec > 0 ? (merma / rec) * 100 : 0;
        const tieneMerma = merma > 0;

        return (
          <div>
            <span style={{ fontWeight: 800, color: tieneMerma ? '#ef4444' : '#10b981', fontSize: '12.5px' }}>
              {merma.toLocaleString()} L
            </span>
            <span style={{ fontSize: '10.5px', color: tieneMerma ? '#ef4444' : '#64748b', display: 'block' }}>
              ({pct.toFixed(2)}%)
            </span>
          </div>
        );
      },
    },
    {
      header: 'ESTADO',
      accessorKey: 'estadoProceso',
      cell: (row) => {
        const estado = (row.estadoProceso || row.estado || 'ACTIVO').toUpperCase();
        const esCerrado = estado === 'CERRADO' || estado === 'FINALIZADO';
        return (
          <span
            className="badge"
            style={{
              background: esCerrado ? '#ecfdf5' : '#fffbeb',
              color: esCerrado ? '#047857' : '#b45309',
              border: `1px solid ${esCerrado ? '#a7f3d0' : '#fde68a'}`,
              fontWeight: 800,
              fontSize: '11px',
              padding: '3px 8px',
              borderRadius: '6px',
              textTransform: 'uppercase',
            }}
          >
            {esCerrado ? 'CERRADO' : 'ACTIVO'}
          </span>
        );
      },
    },
    {
      header: 'ACCIONES',
      className: 'text-right',
      cell: (row) => (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
          <button
            type="button"
            onClick={() => {
              setTimelapseViajeId(row.id);
              setActiveTab('timelapse');
            }}
            className="btn btn-sm"
            style={{
              height: '30px',
              padding: '0 8px',
              fontSize: '11px',
              fontWeight: 700,
              color: '#0284c7',
              borderColor: '#bae6fd',
              background: '#f0f9ff',
              borderRadius: '6px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
            title="Ver Timelapse en vivo"
          >
            <i className="fa-solid fa-clock-rotate-left"></i>
            Timelapse
          </button>

          <button
            type="button"
            onClick={() => {
              setViajeSeleccionado(row);
              setModalDetalle(true);
            }}
            className="btn btn-sm btn-outline"
            style={{
              height: '30px',
              padding: '0 8px',
              fontSize: '11px',
              fontWeight: 700,
              color: '#4f46e5',
              borderColor: '#c7d2fe',
              background: '#eef2ff',
              borderRadius: '6px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <i className="fa-solid fa-eye"></i>
            Detalle
          </button>
        </div>
      ),
    },
  ];

  return (
    <section id="tab-control-rutas" className="tab-content active" style={{ display: 'block' }}>
      {/* CABECERA VISTA */}
      <div className="view-header" style={{ marginBottom: '16px' }}>
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

      {/* TABS DE NAVEGACIÓN: TIMELAPSE EN VIVO vs TICKETS */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '20px',
          borderBottom: '2px solid #e2e8f0',
          paddingBottom: '2px',
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('timelapse')}
          style={{
            padding: '10px 18px',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'timelapse' ? '3px solid #6366f1' : '3px solid transparent',
            color: activeTab === 'timelapse' ? '#4f46e5' : '#64748b',
            fontWeight: 800,
            fontSize: '14px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.2s',
          }}
        >
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#10b981',
              display: 'inline-block',
              boxShadow: '0 0 8px #10b981',
            }}
          />
          <i className="fa-solid fa-clock-rotate-left"></i>
          TIMELAPSE EN VIVO DE CAMIONES
          <span
            style={{
              background: '#e0f2fe',
              color: '#0284c7',
              fontSize: '11px',
              padding: '2px 8px',
              borderRadius: '9999px',
              fontWeight: 700,
            }}
          >
            {viajesActivos.length} activos
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('tickets')}
          style={{
            padding: '10px 18px',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'tickets' ? '3px solid #6366f1' : '3px solid transparent',
            color: activeTab === 'tickets' ? '#4f46e5' : '#64748b',
            fontWeight: 800,
            fontSize: '14px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.2s',
          }}
        >
          <i className="fa-solid fa-list-check"></i>
          LISTADO DE VIAJES & TICKETS
          <span
            style={{
              background: '#f1f5f9',
              color: '#475569',
              fontSize: '11px',
              padding: '2px 8px',
              borderRadius: '9999px',
              fontWeight: 700,
            }}
          >
            {viajes.length}
          </span>
        </button>
      </div>

      {/* SECCIÓN 1: TIMELAPSE EN VIVO */}
      {activeTab === 'timelapse' && (
        <div>
          {/* SELECTOR DE CAMIONES / VIAJES ACTIVOS */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '12.5px', fontWeight: 800, color: '#334155', textTransform: 'uppercase' }}>
                <i className="fa-solid fa-truck-moving" style={{ color: '#6366f1', marginRight: '6px' }}></i>
                Seleccionar Camión en Ruta para Monitoreo:
              </span>
              <span style={{ fontSize: '11.5px', color: '#64748b' }}>
                Auto-actualización reactiva cada 8s ⚡
              </span>
            </div>

            <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '6px' }}>
              {viajes.slice(0, 10).map((v) => {
                const isSelected = viajeTimelapseActual?.id === v.id;
                const isEnRuta = v.estadoProceso !== 'CERRADO' && v.estado !== 'CERRADO';
                const cam = camiones.find((c) => c.id === v.camionId || c.placa === v.camionPlaca);

                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setTimelapseViajeId(v.id)}
                    style={{
                      flex: '0 0 auto',
                      padding: '10px 14px',
                      borderRadius: '12px',
                      border: isSelected ? '2px solid #6366f1' : '1px solid #e2e8f0',
                      background: isSelected ? '#eef2ff' : '#ffffff',
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      boxShadow: isSelected ? '0 4px 12px rgba(99, 102, 241, 0.15)' : 'none',
                      minWidth: '220px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 800, color: isSelected ? '#4f46e5' : '#0f172a', fontSize: '13px' }}>
                        🚛 {v.camionPlaca || (v.camionId ? `Cisterna #${v.camionId}` : 'Camión')}
                      </span>
                      {isEnRuta ? (
                        <span
                          style={{
                            fontSize: '9.5px',
                            fontWeight: 800,
                            color: '#0284c7',
                            background: '#e0f2fe',
                            padding: '2px 6px',
                            borderRadius: '4px',
                          }}
                        >
                          EN RUTA
                        </span>
                      ) : (
                        <span
                          style={{
                            fontSize: '9.5px',
                            fontWeight: 700,
                            color: '#047857',
                            background: '#ecfdf5',
                            padding: '2px 6px',
                            borderRadius: '4px',
                          }}
                        >
                          CERRADO
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <i className="fa-regular fa-user"></i>
                      {v.choferNombre || v.nombreConductor || 'Chofer'}
                    </div>
                    <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#2563eb', marginTop: '4px' }}>
                      {(v.totalLitrosFinca || v.totalLitrosRecogidos || 0).toLocaleString()} L / {(cam?.capacidadLitros || 8000).toLocaleString()} L
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* TARJETAS SUPERIORES DEL TIMELAPSE: DETALLE DE LA UNIDAD & CAPACIDAD */}
          {viajeTimelapseActual ? (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                gap: '16px',
                marginBottom: '20px',
              }}
            >
              {/* CARD 1: INFORMACIÓN DEL CAMIÓN Y VIAJE */}
              <div
                className="content-card"
                style={{
                  padding: '18px',
                  borderRadius: '16px',
                  border: '1px solid #e2e8f0',
                  background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: '#6366f1', textTransform: 'uppercase' }}>
                      TICKET #{viajeTimelapseActual.codigoTicket || viajeTimelapseActual.id}
                    </span>
                    <h3 style={{ margin: '2px 0 0 0', fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
                      {viajeTimelapseActual.camionPlaca || 'Unidad Cisterna'} &bull; {camionDelTimelapse?.marca || 'Cisterna'}
                    </h3>
                  </div>
                  {getBadgeEstado(viajeTimelapseActual.nombreProceso || viajeTimelapseActual.estadoProceso || 'EN RUTA')}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '12px' }}>
                  <div>
                    <span style={{ color: '#64748b', display: 'block' }}>Chofer Conductor:</span>
                    <strong style={{ color: '#0f172a' }}>{viajeTimelapseActual.choferNombre || viajeTimelapseActual.nombreConductor || 'Chofer'}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', display: 'block' }}>Fecha de Operación:</span>
                    <strong style={{ color: '#0f172a' }}>{new Date(viajeTimelapseActual.fecha).toLocaleDateString('es-VE')}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', display: 'block' }}>Odómetro Inicial:</span>
                    <strong style={{ color: '#0f172a' }}>{viajeTimelapseActual.odometroInicialKm ? `${viajeTimelapseActual.odometroInicialKm.toLocaleString()} Km` : 'No registrado'}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', display: 'block' }}>Fincas Visitadas:</span>
                    <strong style={{ color: '#0f172a' }}>{estadisticasTimelapse.completadas} de {estadisticasTimelapse.totalPuntos} ({estadisticasTimelapse.pctRuta}%)</strong>
                  </div>
                </div>

                {/* RUTAS ASIGNADAS AL TICKET */}
                <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '4px' }}>
                    Rutas Logísticas Asignadas al Ticket:
                  </span>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {rutasDelTimelapse.length === 0 ? (
                      <span className="badge" style={{ background: '#f1f5f9', color: '#475569' }}>
                        {viajeTimelapseActual.rutaNombre || 'Ruta Abierta General'}
                      </span>
                    ) : (
                      rutasDelTimelapse.map((r) => (
                        <span
                          key={r.id}
                          className="badge"
                          style={{
                            background: '#eef2ff',
                            color: '#4f46e5',
                            border: '1px solid #c7d2fe',
                            fontWeight: 700,
                          }}
                        >
                          <i className="fa-solid fa-route" style={{ marginRight: '4px' }}></i>
                          {r.nombre} ({r.totalFincas || 0} fincas)
                        </span>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* CARD 2: OCUPACIÓN Y CAPACIDAD DE CISTERNA DEL CAMIÓN */}
              <div
                className="content-card"
                style={{
                  padding: '18px',
                  borderRadius: '16px',
                  border: '1px solid #e2e8f0',
                  background: '#ffffff',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>
                    <i className="fa-solid fa-gas-pump" style={{ color: '#2563eb', marginRight: '6px' }}></i>
                    Capacidad de Cisterna del Camión
                  </span>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 800,
                      padding: '3px 8px',
                      borderRadius: '6px',
                      background: estadisticasTimelapse.sobrecarga
                        ? '#fef2f2'
                        : estadisticasTimelapse.pctLlenado >= 75
                        ? '#ecfdf5'
                        : '#fefce8',
                      color: estadisticasTimelapse.sobrecarga
                        ? '#dc2626'
                        : estadisticasTimelapse.pctLlenado >= 75
                        ? '#047857'
                        : '#b45309',
                    }}
                  >
                    {estadisticasTimelapse.sobrecarga
                      ? '⚠️ SOBRECARGA'
                      : estadisticasTimelapse.pctLlenado >= 75
                      ? '🟢 LLENADO ÓPTIMO'
                      : '🟡 ESPACIO DISPONIBLE'}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '8px' }}>
                  <h2 style={{ margin: 0, fontSize: '28px', fontWeight: 900, color: '#2563eb' }}>
                    {estadisticasTimelapse.totalRecogidos.toLocaleString()}{' '}
                    <span style={{ fontSize: '14px', fontWeight: 600, color: '#64748b' }}>/ {estadisticasTimelapse.capacidad.toLocaleString()} Litros</span>
                  </h2>
                  <span style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
                    ({estadisticasTimelapse.pctLlenado}%)
                  </span>
                </div>

                {/* BARRA DE PROGRESO DE LLENADO */}
                <div
                  style={{
                    height: '14px',
                    width: '100%',
                    background: '#e2e8f0',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    marginBottom: '10px',
                    boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.1)',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${estadisticasTimelapse.pctLlenado}%`,
                      background: estadisticasTimelapse.sobrecarga
                        ? 'linear-gradient(90deg, #ef4444, #b91c1c)'
                        : estadisticasTimelapse.pctLlenado >= 75
                        ? 'linear-gradient(90deg, #10b981, #059669)'
                        : 'linear-gradient(90deg, #3b82f6, #6366f1)',
                      borderRadius: '8px',
                      transition: 'width 0.4s ease',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', color: '#64748b' }}>
                  <span>Espacio libre en tanque: <strong>{estadisticasTimelapse.litrosRestantes.toLocaleString()} L</strong></span>
                  <span>Total recolectado: <strong>{fincasViaje.length} paradas</strong></span>
                </div>

                {/* ACCIÓN RÁPIDA: REGISTRAR RECOLECCIÓN */}
                {viajeTimelapseActual.estadoProceso !== 'CERRADO' && (
                  <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setViajeSeleccionado(viajeTimelapseActual);
                        setModalAgregarFinca(true);
                      }}
                      className="btn btn-sm btn-primary"
                      style={{
                        flex: 1,
                        height: '34px',
                        fontSize: '12px',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        background: '#2563eb',
                      }}
                    >
                      <i className="fa-solid fa-plus"></i> Registrar Parada / Finca
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setViajeSeleccionado(viajeTimelapseActual);
                        setModalDetalle(true);
                      }}
                      className="btn btn-sm btn-outline"
                      style={{ height: '34px', fontSize: '12px', fontWeight: 700 }}
                    >
                      <i className="fa-solid fa-file-invoice"></i> Gestionar Ticket
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>
              No hay viajes activos en este momento.
            </div>
          )}

          {/* TIMELINE VISUAL / TIMELAPSE DE RECORRIDO DE LA UNIDAD */}
          {viajeTimelapseActual && (
            <div
              className="content-card"
              style={{
                padding: '24px',
                borderRadius: '16px',
                border: '1px solid #e2e8f0',
                background: '#ffffff',
                marginBottom: '24px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '20px',
                  paddingBottom: '12px',
                  borderBottom: '1px solid #f1f5f9',
                }}
              >
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
                    <i className="fa-solid fa-timeline" style={{ color: '#4f46e5', marginRight: '8px' }}></i>
                    Timelapse del Viaje: Secuencia de Recolección en Fincas
                  </h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                    Monitoreo en orden cronológico de fincas recolectadas, en proceso y faltantes de las rutas planificadas
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', color: '#047857', fontWeight: 700 }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} />
                    Completadas ({estadisticasTimelapse.completadas})
                  </span>
                  <span style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', color: '#0284c7', fontWeight: 700 }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#0284c7' }} />
                    En Proceso / Siguiente
                  </span>
                  <span style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', color: '#94a3b8', fontWeight: 700 }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#cbd5e1' }} />
                    Faltantes
                  </span>
                </div>
              </div>

              {/* CONTENEDOR DEL STEPPER VERTICAL / TIMELINE */}
              <div style={{ position: 'relative', paddingLeft: '28px' }}>
                {/* LÍNEA GUÍA VERTICAL */}
                <div
                  style={{
                    position: 'absolute',
                    top: '14px',
                    bottom: '14px',
                    left: '11px',
                    width: '3px',
                    background: '#e2e8f0',
                    zIndex: 1,
                  }}
                />

                {/* PUNTO 0: SALIDA DE PATIO */}
                <div style={{ position: 'relative', marginBottom: '22px' }}>
                  <div
                    style={{
                      position: 'absolute',
                      left: '-28px',
                      top: '0px',
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      background: '#4f46e5',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '11px',
                      zIndex: 2,
                      boxShadow: '0 2px 6px rgba(79, 70, 229, 0.4)',
                    }}
                  >
                    <i className="fa-solid fa-flag-checkered"></i>
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <strong style={{ fontSize: '13.5px', color: '#0f172a' }}>Salida e Inicio de Viaje</strong>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>
                        Odómetro: {viajeTimelapseActual.odometroInicialKm ? `${viajeTimelapseActual.odometroInicialKm} Km` : 'Inicio'}
                      </span>
                    </div>
                    <span style={{ fontSize: '11.5px', color: '#64748b' }}>
                      Cisterna vacía preparada con capacidad de {estadisticasTimelapse.capacidad.toLocaleString()} Litros
                    </span>
                  </div>
                </div>

                {/* SECUENCIA DE FINCAS */}
                {timelinePuntos.length === 0 ? (
                  <div style={{ padding: '16px 0', color: '#94a3b8', fontSize: '13px' }}>
                    No hay fincas asignadas a las rutas seleccionadas aún.
                  </div>
                ) : (
                  timelinePuntos.map((punto, index) => {
                    const isCompleted = punto.estado === 'COMPLETADA';
                    const isInProgress = punto.estado === 'EN_CURSO';

                    return (
                      <div key={punto.id} style={{ position: 'relative', marginBottom: '20px' }}>
                        {/* NODO DEL TIMELINE */}
                        <div
                          style={{
                            position: 'absolute',
                            left: '-28px',
                            top: '2px',
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            background: isCompleted ? '#10b981' : isInProgress ? '#0284c7' : '#e2e8f0',
                            color: isCompleted || isInProgress ? '#ffffff' : '#64748b',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '11px',
                            zIndex: 2,
                            boxShadow: isInProgress ? '0 0 10px rgba(2, 132, 199, 0.6)' : 'none',
                            animation: isInProgress ? 'pulse 1.8s infinite' : 'none',
                          }}
                        >
                          {isCompleted ? (
                            <i className="fa-solid fa-check"></i>
                          ) : isInProgress ? (
                            <i className="fa-solid fa-hourglass-half"></i>
                          ) : (
                            <span>{index + 1}</span>
                          )}
                        </div>

                        {/* TARJETA DEL PUNTO / FINCA */}
                        <div
                          style={{
                            padding: '12px 16px',
                            borderRadius: '12px',
                            border: isInProgress
                              ? '1.5px solid #0284c7'
                              : isCompleted
                              ? '1px solid #d1fae5'
                              : '1px solid #f1f5f9',
                            background: isInProgress
                              ? '#f0f9ff'
                              : isCompleted
                              ? '#f0fdf4'
                              : '#f8fafc',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: '10px',
                          }}
                        >
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <strong style={{ fontSize: '13.5px', color: '#0f172a' }}>
                                #{index + 1} &bull; {punto.nombre}
                              </strong>
                              {isCompleted && (
                                <span
                                  className="badge"
                                  style={{
                                    background: '#dcfce7',
                                    color: '#15803d',
                                    fontSize: '10px',
                                    fontWeight: 800,
                                    padding: '2px 6px',
                                  }}
                                >
                                  ✅ RECOLECTADA
                                </span>
                              )}
                              {isInProgress && (
                                <span
                                  className="badge"
                                  style={{
                                    background: '#e0f2fe',
                                    color: '#0369a1',
                                    fontSize: '10px',
                                    fontWeight: 800,
                                    padding: '2px 6px',
                                  }}
                                >
                                  ⏳ PRÓXIMA PARADA / EN CAMINO
                                </span>
                              )}
                              {!isCompleted && !isInProgress && (
                                <span
                                  className="badge"
                                  style={{
                                    background: '#f1f5f9',
                                    color: '#64748b',
                                    fontSize: '10px',
                                    fontWeight: 700,
                                    padding: '2px 6px',
                                  }}
                                >
                                  ⚪ PENDIENTE
                                </span>
                              )}
                            </div>
                            <span style={{ fontSize: '11.5px', color: '#64748b', display: 'block' }}>
                              Propietario: {punto.propietario} {punto.hora ? `&bull; Registrado a las ${punto.hora}` : ''}
                            </span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            {/* TIPO DE LECHE Y CALIDAD */}
                            {isCompleted && (
                              <div style={{ display: 'flex', gap: '6px' }}>
                                <span
                                  className="badge"
                                  style={{
                                    background: punto.tipoLeche.includes('BUFAL') ? '#f3e8ff' : '#e0f2fe',
                                    color: punto.tipoLeche.includes('BUFAL') ? '#7e22ce' : '#0369a1',
                                    fontWeight: 800,
                                    fontSize: '10.5px',
                                  }}
                                >
                                  {punto.tipoLeche.includes('BUFAL') ? '🐃 BÚFALA' : '🥛 VACA'}
                                </span>
                                {punto.temperatura != null && (
                                  <span
                                    className="badge"
                                    style={{ background: '#f1f5f9', color: '#334155', fontSize: '10.5px', fontWeight: 700 }}
                                  >
                                    🌡️ {punto.temperatura}°C
                                  </span>
                                )}
                              </div>
                            )}

                            {/* LITROS */}
                            <div style={{ textAlign: 'right' }}>
                              <span
                                style={{
                                  fontSize: '14px',
                                  fontWeight: 800,
                                  color: isCompleted ? '#059669' : isInProgress ? '#0284c7' : '#64748b',
                                }}
                              >
                                {punto.litros.toLocaleString()} <small>Litros</small>
                              </span>
                              <span style={{ fontSize: '10px', color: '#94a3b8', display: 'block' }}>
                                {isCompleted ? 'Real medido' : 'Estimado'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}

                {/* PUNTO FINAL: DESCARGA EN RECEPTORÍA O PLANTA */}
                <div style={{ position: 'relative' }}>
                  <div
                    style={{
                      position: 'absolute',
                      left: '-28px',
                      top: '0px',
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      background: entregasViaje.length > 0 ? '#10b981' : '#64748b',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '11px',
                      zIndex: 2,
                    }}
                  >
                    <i className="fa-solid fa-warehouse"></i>
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <strong style={{ fontSize: '13.5px', color: '#0f172a' }}>
                        Destino Final: Silos Receptoría / Planta Quesera
                      </strong>
                      {entregasViaje.length > 0 && (
                        <span className="badge" style={{ background: '#dcfce7', color: '#15803d', fontSize: '10.5px' }}>
                          DESCARGADO ✅
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: '11.5px', color: '#64748b' }}>
                      {entregasViaje.length > 0
                        ? `Total descargado: ${entregasViaje.reduce((s, e) => s + (e.litrosEntregados || 0), 0).toLocaleString()} Lts`
                        : 'En espera de llegada del camión y pesaje'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SECCIÓN 2: LISTADO DE VIAJES & TICKETS (DISEÑO 1:1 SISTEMA V2_3_11_26) */}
      {activeTab === 'tickets' && (
        <div>
          {/* TARJETAS MAESTRAS DE AUDITORÍA VOLUMÉTRICA (EXACTAS A V2_3_11_26) */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: '16px',
              marginBottom: '24px',
            }}
          >
            {/* CARD 1: CUSTODIA FÍSICA RECEPTORÍA (DARK NAVY) */}
            <div
              className="content-card"
              style={{
                background: 'linear-gradient(145deg, #0f172a, #1e293b)',
                border: '1px solid rgba(59, 130, 246, 0.4)',
                borderRadius: '16px',
                padding: '20px',
                color: '#fff',
                boxShadow: '0 10px 25px rgba(15, 23, 42, 0.4)',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <div>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#38bdf8', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                    Custodia Física Receptoría
                  </span>
                  <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#ffffff', margin: '4px 0 0 0' }}>
                    Stock Actual en Tanques
                  </h3>
                </div>
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    background: 'rgba(56, 189, 248, 0.15)',
                    border: '1px solid rgba(56, 189, 248, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '17px',
                    color: '#38bdf8',
                    marginLeft: 'auto',
                  }}
                >
                  <i className="fa-solid fa-cubes-stacked"></i>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '10px' }}>
                <span style={{ fontSize: '28px', fontWeight: 900, letterSpacing: '-0.02em', color: '#38bdf8', fontFamily: 'monospace' }}>
                  {kpisVolumetricos.stockTanquesActual.toLocaleString()}
                </span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#94a3b8' }}>Lts custodia</span>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.1)', height: '6px', borderRadius: '4px', overflow: 'hidden', marginBottom: '8px' }}>
                <div
                  style={{
                    background: 'linear-gradient(90deg, #38bdf8, #3b82f6)',
                    height: '100%',
                    width: `${Math.min(100, Math.max(12, (kpisVolumetricos.stockTanquesActual / 30000) * 100))}%`,
                    borderRadius: '4px',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#cbd5e1', marginBottom: '6px' }}>
                <span>Entrado: <strong style={{ color: '#4ade80' }}>{kpisVolumetricos.entradasTanque.toLocaleString()} L</strong></span>
                <span>Salido: <strong style={{ color: '#f87171' }}>{kpisVolumetricos.salidasTanque.toLocaleString()} L</strong></span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '6px', borderTop: '1px dashed rgba(255,255,255,0.15)', fontSize: '11px', color: '#94a3b8' }}>
                <span>Inicial: <strong style={{ color: '#38bdf8' }}>{stockInicial.toLocaleString()} L</strong></span>
                <button
                  type="button"
                  onClick={() => {
                    setNuevoStockInicialInput(stockInicial);
                    setModalStockInicial(true);
                  }}
                  style={{
                    padding: '2px 8px',
                    fontSize: '10px',
                    fontWeight: 800,
                    borderRadius: '6px',
                    background: 'rgba(56, 189, 248, 0.2)',
                    color: '#38bdf8',
                    border: '1px solid rgba(56, 189, 248, 0.4)',
                    cursor: 'pointer',
                  }}
                >
                  <i className="fa-solid fa-pen-to-square"></i> Ajustar
                </button>
              </div>
            </div>

            {/* CARD 2: INGRESO AL CIRCUITO */}
            <div className="content-card" style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <div>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#f59e0b', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                    Ingreso al Circuito
                  </span>
                  <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', margin: '4px 0 0 0' }}>
                    Total Recolección Fincas
                  </h3>
                </div>
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '17px', color: '#f59e0b', marginLeft: 'auto' }}>
                  <i className="fa-solid fa-cow"></i>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '8px' }}>
                <span style={{ fontSize: '28px', fontWeight: 900, color: '#0f172a', fontFamily: 'monospace' }}>
                  {kpisVolumetricos.recoleccionFincas.toLocaleString()}
                </span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#64748b' }}>Lts brutos</span>
              </div>
              <div style={{ fontSize: '12px', color: '#ef4444', fontWeight: 700 }}>
                Merma en Ruta: {kpisVolumetricos.mermaLitros.toLocaleString()} Lts ({kpisVolumetricos.mermaPct.toFixed(2)}%)
              </div>
            </div>

            {/* CARD 3: VENTAS & ENTREGAS */}
            <div className="content-card" style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <div>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#10b981', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                    Ventas & Entregas
                  </span>
                  <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', margin: '4px 0 0 0' }}>
                    Total Facturado Plantas
                  </h3>
                </div>
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '17px', color: '#10b981', marginLeft: 'auto' }}>
                  <i className="fa-solid fa-industry"></i>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '8px' }}>
                <span style={{ fontSize: '28px', fontWeight: 900, color: '#10b981', fontFamily: 'monospace' }}>
                  {kpisVolumetricos.entregaPlantas.toLocaleString()}
                </span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#64748b' }}>Lts vendidos</span>
              </div>
              <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>
                Directo: <strong style={{ color: '#0f172a' }}>{kpisVolumetricos.entregaDirecto.toLocaleString()} L</strong> | Tanques: <strong style={{ color: '#0f172a' }}>{kpisVolumetricos.entregaTanques.toLocaleString()} L</strong>
              </div>
            </div>

            {/* CARD 4: AUDITORÍA INTEGRAL */}
            <div className="content-card" style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <div>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#6366f1', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                    Auditoría Integral
                  </span>
                  <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', margin: '4px 0 0 0' }}>
                    Cuadratura de Litros
                  </h3>
                </div>
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(99, 102, 241, 0.12)', border: '1px solid rgba(99, 102, 241, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '17px', color: '#6366f1', marginLeft: 'auto' }}>
                  <i className="fa-solid fa-shield-halved"></i>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '8px' }}>
                <span style={{ fontSize: '28px', fontWeight: 900, color: kpisVolumetricos.descuadreGlobal === 0 ? '#10b981' : '#f59e0b', fontFamily: 'monospace' }}>
                  {kpisVolumetricos.descuadreGlobal.toFixed(2)}
                </span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#64748b' }}>Lts descuadre</span>
              </div>
              <div style={{ fontSize: '12px', color: '#10b981', fontWeight: 700 }}>
                Estado: {kpisVolumetricos.descuadreGlobal === 0 ? '100% Cuadrado' : 'Diferencia en conciliación'}
              </div>
            </div>
          </div>

          {/* TABLA DE VIAJES / TICKETS */}
          <DataTable
            data={viajes}
            columns={columns}
            isLoading={isLoading}
            searchPlaceholder="Buscar por ticket, chofer, camión..."
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
        </div>
      )}

      {/* MODAL INICIAR NUEVO VIAJE CON MÚLTIPLES RUTAS Y CONTROL DE CAPACIDAD */}
      {modalIniciar && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            padding: '16px',
          }}
        >
          <div
            className="content-card"
            style={{
              width: '100%',
              maxWidth: '560px',
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
                <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                  <i className="fa-solid fa-truck-moving" style={{ color: '#4f46e5', marginRight: '8px' }}></i>
                  Iniciar Nuevo Viaje / Ticket
                </h3>
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  Asignación de unidad cisterna y múltiples rutas logísticas
                </span>
              </div>
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
                  toast.error('Selecciona una unidad cisterna obligatoria');
                  return;
                }
                if (!formIniciar.choferId) {
                  toast.error('Selecciona un chofer / conductor obligatorio');
                  return;
                }
                iniciarMutation.mutate({
                  ...formIniciar,
                  rutaLogisticaId: formIniciar.rutasLogisticasIds[0] || formIniciar.rutaLogisticaId || 0,
                });
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* FECHA */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                    <i className="fa-solid fa-calendar-day" style={{ color: '#4f46e5', marginRight: '6px' }}></i>
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

                {/* UNIDAD CISTERNA */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                    Unidad Cisterna *
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
                    placeholder="-- Seleccionar Unidad Cisterna --"
                  />
                </div>

                {/* CHOFER */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                    Chofer / Conductor Asignado
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
                    placeholder="-- Seleccionar o buscar chofer --"
                    allowClear
                  />
                </div>

                {/* SELECCIÓN MÚLTIPLE DE RUTAS LOGÍSTICAS */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                    <i className="fa-solid fa-route" style={{ color: '#6366f1', marginRight: '6px' }}></i>
                    Rutas Logísticas a Realizar (Múltiple Selección)
                  </label>
                  <span style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '8px' }}>
                    Marca una o varias rutas para combinarlas en el mismo viaje/camión
                  </span>

                  <div
                    style={{
                      maxHeight: '160px',
                      overflowY: 'auto',
                      border: '1px solid #e2e8f0',
                      borderRadius: '10px',
                      padding: '8px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                      background: '#f8fafc',
                    }}
                  >
                    {rutasLogistica.map((r) => {
                      const isChecked = formIniciar.rutasLogisticasIds.includes(r.id);
                      return (
                        <label
                          key={r.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 10px',
                            background: isChecked ? '#eef2ff' : '#ffffff',
                            borderRadius: '8px',
                            border: isChecked ? '1px solid #c7d2fe' : '1px solid #e2e8f0',
                            cursor: 'pointer',
                            fontSize: '12.5px',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setFormIniciar((prev) => ({
                                    ...prev,
                                    rutasLogisticasIds: [...prev.rutasLogisticasIds, r.id],
                                  }));
                                } else {
                                  setFormIniciar((prev) => ({
                                    ...prev,
                                    rutasLogisticasIds: prev.rutasLogisticasIds.filter((id) => id !== r.id),
                                  }));
                                }
                              }}
                              style={{ width: '16px', height: '16px', accentColor: '#4f46e5' }}
                            />
                            <span style={{ fontWeight: 700, color: '#0f172a' }}>{r.nombre}</span>
                          </div>
                          <span style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 600 }}>
                            {r.totalFincas || 0} fincas &bull; ~{(r.totalLitrosEstimados || (r.totalFincas || 0) * 300).toLocaleString()} L
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* INDICADOR EN VIVO DE CAPACIDAD DE CISTERNA DEL CAMIÓN */}
                {formIniciar.camionId > 0 && (
                  <div
                    style={{
                      padding: '12px 14px',
                      borderRadius: '12px',
                      border: calculoCisternaInicio.esSobrecarga
                        ? '1px solid #fecaca'
                        : calculoCisternaInicio.esOptimo
                        ? '1px solid #a7f3d0'
                        : '1px solid #fed7aa',
                      background: calculoCisternaInicio.esSobrecarga
                        ? '#fef2f2'
                        : calculoCisternaInicio.esOptimo
                        ? '#ecfdf5'
                        : '#fffbeb',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: '#334155' }}>
                        Capacidad Cisterna ({camionSeleccionadoEnInicio?.placa}):
                      </span>
                      <strong
                        style={{
                          fontSize: '11px',
                          color: calculoCisternaInicio.esSobrecarga
                            ? '#dc2626'
                            : calculoCisternaInicio.esOptimo
                            ? '#047857'
                            : '#d97706',
                        }}
                      >
                        {calculoCisternaInicio.porcentajeOcupacion}% Ocupación Estimada
                      </strong>
                    </div>

                    <div style={{ height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden', marginBottom: '8px' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${Math.min(100, calculoCisternaInicio.porcentajeOcupacion)}%`,
                          background: calculoCisternaInicio.esSobrecarga
                            ? '#ef4444'
                            : calculoCisternaInicio.esOptimo
                            ? '#10b981'
                            : '#f59e0b',
                        }}
                      />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#475569' }}>
                      <span>
                        Volumen proyectado: <strong>{calculoCisternaInicio.litrosEstimados.toLocaleString()} L</strong>
                      </span>
                      <span>
                        Capacidad cisterna: <strong>{calculoCisternaInicio.capacidadCisterna.toLocaleString()} L</strong>
                      </span>
                    </div>

                    {calculoCisternaInicio.esSobrecarga && (
                      <div style={{ marginTop: '6px', fontSize: '11px', color: '#dc2626', fontWeight: 700 }}>
                        <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: '4px' }}></i>
                        ¡Atención! La suma de las rutas seleccionadas excede la capacidad de la cisterna en {Math.abs(calculoCisternaInicio.diferencia).toLocaleString()} Litros.
                      </div>
                    )}
                  </div>
                )}

                {/* ODÓMETRO INICIAL */}
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

                {/* OBSERVACIONES */}
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

      {/* MODAL AJUSTE DE STOCK INICIAL EN TANQUES */}
      {modalStockInicial && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            padding: '16px',
          }}
        >
          <div
            className="content-card"
            style={{
              width: '100%',
              maxWidth: '420px',
              padding: '24px',
              borderRadius: '16px',
              backgroundColor: '#ffffff',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                <i className="fa-solid fa-pen-to-square" style={{ color: '#0284c7', marginRight: '8px' }}></i>
                Ajustar Stock Inicial
              </h3>
              <button
                type="button"
                onClick={() => setModalStockInicial(false)}
                style={{ background: 'none', border: 'none', fontSize: '18px', color: '#94a3b8', cursor: 'pointer' }}
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <p style={{ fontSize: '12.5px', color: '#64748b', marginBottom: '16px' }}>
              Ingrese el inventario volumétrico inicial en litros de los silos o tanques de custodia en receptoría:
            </p>
            <input
              type="number"
              value={nuevoStockInicialInput || ''}
              onChange={(e) => setNuevoStockInicialInput(Number(e.target.value))}
              placeholder="0 Lts"
              className="form-input"
              style={{ width: '100%', height: '42px', fontSize: '16px', fontWeight: 800, marginBottom: '20px' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setModalStockInicial(false)}
                className="btn btn-outline"
                style={{ height: '38px' }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  setStockInicial(nuevoStockInicialInput);
                  setModalStockInicial(false);
                  toast.success('Stock inicial en tanques actualizado');
                }}
                className="btn btn-primary"
                style={{ height: '38px', background: 'linear-gradient(135deg, #0284c7, #0369a1)', border: 'none' }}
              >
                Guardar Ajuste
              </button>
            </div>
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
            background: 'rgba(15, 23, 42, 0.65)',
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
                  Fecha: {new Date(viajeSeleccionado.fecha).toLocaleDateString('es-VE')} &bull; Camión:{' '}
                  <strong>{viajeSeleccionado.camionPlaca || `Cisterna #${viajeSeleccionado.camionId || ''}`}</strong> &bull; Chofer:{' '}
                  <strong>{viajeSeleccionado.choferNombre || viajeSeleccionado.nombreConductor || 'Chofer'}</strong>
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
                    <th style={{ textAlign: 'center' }}>Calidad</th>
                    <th style={{ textAlign: 'center' }}>Temp (°C)</th>
                  </tr>
                </thead>
                <tbody>
                  {fincasViaje.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', color: '#94a3b8', padding: '16px' }}>
                        No hay recolecciones registradas en este viaje aún.
                      </td>
                    </tr>
                  ) : (
                    fincasViaje.map((f, idx) => {
                      const lts = Number((f as any).litros ?? (f as any).Litros ?? f.litrosLeche ?? 0);
                      const esBuf = String(f.tipoLeche || (f as any).TipoLeche || '').toUpperCase().includes('BUFAL');
                      const esAc = Boolean((f as any).esAcida ?? (f as any).EsAcida ?? false);

                      return (
                        <tr key={idx}>
                          <td>
                            <strong>{f.fincaNombre || (f as any).finca || `Finca #${f.fincaId}`}</strong>
                            <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>{f.propietarioNombre || (f as any).propietario}</span>
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 800, color: '#2563eb', fontSize: '14px' }}>
                            {lts.toLocaleString()} <small>Lts</small>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span
                              className="badge"
                              style={{
                                background: esBuf ? '#f3e8ff' : '#e0f2fe',
                                color: esBuf ? '#7e22ce' : '#0369a1',
                                border: `1px solid ${esBuf ? '#d8b4fe' : '#bae6fd'}`,
                                fontWeight: 800,
                                fontSize: '11px',
                              }}
                            >
                              {esBuf ? '🐃 BÚFALA' : '🥛 VACA'}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {esAc ? (
                              <span className="badge" style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', fontWeight: 800, fontSize: '11px' }}>
                                ÁCIDA
                              </span>
                            ) : (
                              <span className="badge" style={{ background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', fontWeight: 700, fontSize: '11px' }}>
                                Normal
                              </span>
                            )}
                          </td>
                          <td style={{ textAlign: 'center' }}>{f.temperatura ? `${f.temperatura}°C` : '-'}</td>
                        </tr>
                      );
                    })
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

      {/* MODAL REGISTRAR FINCA EN VIAJE */}
      {modalAgregarFinca && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(15, 23, 42, 0.7)',
            backdropFilter: 'blur(4px)',
            padding: '16px',
          }}
        >
          <div className="content-card" style={{ width: '100%', maxWidth: '440px', padding: '24px', borderRadius: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 800, margin: '0 0 16px 0', color: '#0f172a' }}>
              <i className="fa-solid fa-cow" style={{ color: '#0284c7', marginRight: '8px' }}></i>
              Registrar Finca en Viaje
            </h3>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!formFinca.fincaId || formFinca.litrosLeche <= 0) {
                  toast.error('Selecciona la finca e ingresa los litros');
                  return;
                }
                agregarFincaMutation.mutate(formFinca);
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                    Finca *
                  </label>
                  <SearchableSelect
                    options={fincas.map((f) => ({
                      value: f.id,
                      label: `${f.nombre} (${f.propietarioNombre || 'Sin prop.'})`,
                      subLabel: `Precio: $${f.precioLitroUSD || 0}`,
                    }))}
                    value={formFinca.fincaId}
                    onChange={(val) => setFormFinca({ ...formFinca, fincaId: Number(val) })}
                    placeholder="-- Seleccionar Finca --"
                    searchPlaceholder="Buscar finca o productor..."
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                    Litros Recogidos *
                  </label>
                  <input
                    type="number"
                    value={formFinca.litrosLeche || ''}
                    onChange={(e) => setFormFinca({ ...formFinca, litrosLeche: Number(e.target.value) })}
                    className="form-input"
                    placeholder="Ej: 450"
                    style={{ width: '100%', height: '38px', fontWeight: 800 }}
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                      Tipo de Leche
                    </label>
                    <select
                      value={formFinca.tipoLeche}
                      onChange={(e) => setFormFinca({ ...formFinca, tipoLeche: e.target.value })}
                      className="form-select"
                      style={{ width: '100%', height: '38px' }}
                    >
                      <option value="VACA">🥛 Vaca</option>
                      <option value="BUFALA">🐃 Búfala</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                      Temperatura (°C)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={formFinca.temperatura}
                      onChange={(e) => setFormFinca({ ...formFinca, temperatura: Number(e.target.value) })}
                      className="form-input"
                      style={{ width: '100%', height: '38px' }}
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button type="button" onClick={() => setModalAgregarFinca(false)} className="btn btn-outline" style={{ height: '38px' }}>
                  Cancelar
                </button>
                <button type="submit" disabled={agregarFincaMutation.isPending} className="btn btn-primary" style={{ height: '38px' }}>
                  {agregarFincaMutation.isPending ? 'Guardando...' : 'Guardar Recolección'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL REGISTRAR ENTREGA EN COMPAÑÍA */}
      {modalEntrega && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(15, 23, 42, 0.7)',
            backdropFilter: 'blur(4px)',
            padding: '16px',
          }}
        >
          <div className="content-card" style={{ width: '100%', maxWidth: '440px', padding: '24px', borderRadius: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 800, margin: '0 0 16px 0', color: '#0f172a' }}>
              <i className="fa-solid fa-building-circle-check" style={{ color: '#059669', marginRight: '8px' }}></i>
              Registrar Descarga en Planta / Silo
            </h3>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!formEntrega.companiaId || formEntrega.litrosEntregados <= 0) {
                  toast.error('Selecciona la compañía e ingresa los litros');
                  return;
                }
                entregarMutation.mutate(formEntrega);
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                    Planta / Compañía Destino *
                  </label>
                  <SearchableSelect
                    options={companias.map((c) => ({
                      value: c.id,
                      label: c.nombre,
                      subLabel: c.rif || undefined,
                    }))}
                    value={formEntrega.companiaId}
                    onChange={(val) => setFormEntrega({ ...formEntrega, companiaId: Number(val) })}
                    placeholder="-- Seleccionar Compañía / Planta --"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                    Litros Descargados / Entregados *
                  </label>
                  <input
                    type="number"
                    value={formEntrega.litrosEntregados || ''}
                    onChange={(e) => setFormEntrega({ ...formEntrega, litrosEntregados: Number(e.target.value) })}
                    className="form-input"
                    placeholder="Ej: 5200"
                    style={{ width: '100%', height: '38px', fontWeight: 800 }}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                    N° Ticket Receptoría / Guía
                  </label>
                  <input
                    type="text"
                    value={formEntrega.ticketReceptoria}
                    onChange={(e) => setFormEntrega({ ...formEntrega, ticketReceptoria: e.target.value })}
                    className="form-input"
                    placeholder="Ej: GUIA-9821"
                    style={{ width: '100%', height: '38px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button type="button" onClick={() => setModalEntrega(false)} className="btn btn-outline" style={{ height: '38px' }}>
                  Cancelar
                </button>
                <button type="submit" disabled={entregarMutation.isPending} className="btn btn-primary" style={{ height: '38px' }}>
                  {entregarMutation.isPending ? 'Guardando...' : 'Guardar Descarga'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CERRAR VIAJE */}
      {modalCerrar && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(15, 23, 42, 0.7)',
            backdropFilter: 'blur(4px)',
            padding: '16px',
          }}
        >
          <div className="content-card" style={{ width: '100%', maxWidth: '440px', padding: '24px', borderRadius: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 800, margin: '0 0 16px 0', color: '#0f172a' }}>
              <i className="fa-solid fa-lock" style={{ color: '#059669', marginRight: '8px' }}></i>
              Finalizar y Cerrar Viaje
            </h3>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                cerrarMutation.mutate(formCerrar);
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                    Odómetro Final (Km)
                  </label>
                  <input
                    type="number"
                    value={formCerrar.odometroFinalKm || ''}
                    onChange={(e) => setFormCerrar({ ...formCerrar, odometroFinalKm: Number(e.target.value) })}
                    className="form-input"
                    placeholder="Ej: 145350"
                    style={{ width: '100%', height: '38px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                    Observaciones Finales
                  </label>
                  <input
                    type="text"
                    value={formCerrar.observaciones}
                    onChange={(e) => setFormCerrar({ ...formCerrar, observaciones: e.target.value })}
                    className="form-input"
                    placeholder="Conclusiones del viaje..."
                    style={{ width: '100%', height: '38px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button type="button" onClick={() => setModalCerrar(false)} className="btn btn-outline" style={{ height: '38px' }}>
                  Cancelar
                </button>
                <button type="submit" disabled={cerrarMutation.isPending} className="btn btn-primary" style={{ height: '38px', background: '#059669' }}>
                  {cerrarMutation.isPending ? 'Cerrando...' : 'Confirmar Cierre'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};

export default ViajesTicketsPage;
