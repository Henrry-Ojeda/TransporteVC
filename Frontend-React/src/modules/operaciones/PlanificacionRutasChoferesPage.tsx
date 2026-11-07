import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Swal from 'sweetalert2';
import { confirmDeleteOrDeactivate } from '@/lib/sweetalert';
import { CamionSelect, ChoferSelect } from '@/components/selectors';
import { SearchableSelect, type SelectOption } from '@/components/common/SearchableSelect';
import { DataTable, type ColumnDef } from '@/components/common/DataTable';
import { operacionesApi } from '@/api/operaciones.api';
import { catalogosApi } from '@/api/catalogos.api';
import type {
  PlanificacionRutaChoferDto,
  GuardarPlanificacionRutaChoferDto,
  FincaPromedioDto,
  CamionDto,
  RutaLogisticaDto,
} from '@/types';
import {
  Calendar,
  Truck,
  User,
  Route as RouteIcon,
  PlusCircle,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Layers,
  ChevronLeft,
  ChevronRight,
  Droplet,
  Info,
  X,
  Search,
  LayoutGrid,
  Table as TableIcon,
} from 'lucide-react';

export const PlanificacionRutasChoferesPage: React.FC = () => {
  const queryClient = useQueryClient();

  // Fecha operativa (por defecto hoy en YYYY-MM-DD)
  const [fechaOperativa, setFechaOperativa] = useState<string>(() => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  });

  // Vista: 'tarjetas' | 'tabla'
  const [vistaModo, setVistaModo] = useState<'tarjetas' | 'tabla'>('tarjetas');

  // Modal Estado
  const [modalAbierto, setModalAbierto] = useState(false);
  const [planificacionEditar, setPlanificacionEditar] = useState<PlanificacionRutaChoferDto | null>(null);

  // Formulario de asignación
  const [formCamionId, setFormCamionId] = useState<number | undefined>(undefined);
  const [formChoferId, setFormChoferId] = useState<number | undefined>(undefined);
  const [formRutaId, setFormRutaId] = useState<number | undefined>(undefined);
  const [formFincasSeleccionadas, setFormFincasSeleccionadas] = useState<number[]>([]);
  const [formObservacion, setFormObservacion] = useState<string>('');
  const [busquedaFincaChecklist, setBusquedaFincaChecklist] = useState<string>('');
  const [filtroSoloRuta, setFiltroSoloRuta] = useState<boolean>(true);

  // Navegación de fecha
  const cambiarFecha = (dias: number) => {
    const [y, m, d] = fechaOperativa.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    date.setDate(date.getDate() + dias);
    const nextStr = date.toISOString().split('T')[0];
    setFechaOperativa(nextStr);
  };

  const irAHoy = () => {
    setFechaOperativa(new Date().toISOString().split('T')[0]);
  };

  // Queries
  const { data: planificaciones = [], isLoading: cargandoPlanes } = useQuery<PlanificacionRutaChoferDto[]>({
    queryKey: ['planificaciones-choferes', fechaOperativa],
    queryFn: () => operacionesApi.getPlanificacionesChoferes(fechaOperativa),
  });

  const { data: rutas = [] } = useQuery<RutaLogisticaDto[]>({
    queryKey: ['rutas-logistica'],
    queryFn: () => operacionesApi.getRutasLogistica(),
    staleTime: 1000 * 60 * 5,
  });

  const { data: fincasPromedios = [], isLoading: cargandoFincas } = useQuery<FincaPromedioDto[]>({
    queryKey: ['fincas-promedios-15dias'],
    queryFn: () => operacionesApi.getFincasPromedios15Dias(),
    staleTime: 1000 * 60 * 5,
  });

  const { data: camiones = [] } = useQuery<CamionDto[]>({
    queryKey: ['camiones-catalogos'],
    queryFn: () => catalogosApi.getCamiones(true),
    staleTime: 1000 * 60 * 5,
  });

  // Mutaciones
  const guardarMutation = useMutation({
    mutationFn: (dto: GuardarPlanificacionRutaChoferDto) => operacionesApi.guardarPlanificacionChofer(dto),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['planificaciones-choferes'] });
      setModalAbierto(false);
      Swal.fire({
        icon: 'success',
        title: 'Planificación Guardada',
        text: res.message || 'La asignación de ruta y chofer se guardó exitosamente.',
        confirmButtonColor: '#2563eb',
        timer: 2000,
        showConfirmButton: false,
      });
    },
    onError: (err: any) => {
      Swal.fire({
        icon: 'error',
        title: 'Error al Guardar',
        text: err?.response?.data?.message || err?.message || 'No se pudo guardar la planificación.',
        confirmButtonColor: '#2563eb',
      });
    },
  });

  const eliminarMutation = useMutation({
    mutationFn: (id: number) => operacionesApi.eliminarPlanificacionChofer(id),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['planificaciones-choferes'] });
      Swal.fire({
        icon: 'success',
        title: 'Planificación Eliminada',
        text: res.message || 'La asignación se eliminó correctamente.',
        confirmButtonColor: '#2563eb',
        timer: 2000,
        showConfirmButton: false,
      });
    },
    onError: (err: any) => {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: err?.response?.data?.message || 'No se pudo eliminar la planificación.',
        confirmButtonColor: '#2563eb',
      });
    },
  });

  // Camión seleccionado en el modal
  const camionSeleccionado = useMemo(() => {
    return camiones.find((c) => c.id === formCamionId);
  }, [camiones, formCamionId]);

  // Capacidad de la cisterna seleccionada
  const capacidadCisterna = camionSeleccionado?.capacidadLitros || 0;

  // Mapa de fincas ya asignadas a otros camiones en la misma fecha
  const fincasAsignadasEnFecha = useMemo(() => {
    const map = new Map<number, { camionPlaca: string; choferNombre: string; planId: number }>();
    planificaciones.forEach((p) => {
      if (planificacionEditar && p.id === planificacionEditar.id) {
        return; // Excluir la planificación que se está editando
      }
      (p.listaFincasIds || []).forEach((fId) => {
        map.set(fId, {
          camionPlaca: p.camionPlaca || `Camión #${p.camionId}`,
          choferNombre: p.conductorNombre || 'Chofer',
          planId: p.id,
        });
      });
    });
    return map;
  }, [planificaciones, planificacionEditar]);

  // Fincas filtradas para el modal
  const fincasParaModal = useMemo(() => {
    let list = fincasPromedios;
    if (filtroSoloRuta && formRutaId) {
      list = list.filter((f) => f.rutaId === formRutaId);
    }
    if (busquedaFincaChecklist.trim()) {
      const q = busquedaFincaChecklist.toLowerCase();
      list = list.filter(
        (f) =>
          f.fincaNombre.toLowerCase().includes(q) ||
          (f.propietario && f.propietario.toLowerCase().includes(q))
      );
    }
    return list;
  }, [fincasPromedios, filtroSoloRuta, formRutaId, busquedaFincaChecklist]);

  // Litros estimados en vivo de las fincas seleccionadas en el modal
  const litrosEstimadosSeleccionados = useMemo(() => {
    const mapaPromedios = new Map<number, number>();
    fincasPromedios.forEach((f) => mapaPromedios.set(f.fincaId, f.promedioLitros || 0));
    return formFincasSeleccionadas.reduce((acc, fId) => acc + (mapaPromedios.get(fId) || 0), 0);
  }, [formFincasSeleccionadas, fincasPromedios]);

  // Porcentaje de ocupación proyectado
  const porcentajeOcupacion = useMemo(() => {
    if (capacidadCisterna <= 0) return 0;
    return Math.round((litrosEstimadosSeleccionados / capacidadCisterna) * 100);
  }, [litrosEstimadosSeleccionados, capacidadCisterna]);

  // Opciones de rutas para el selector
  const opcionesRutas: SelectOption[] = useMemo(() => {
    return rutas.map((r) => ({
      value: r.id,
      label: r.nombre,
      subLabel: `${r.totalFincas || 0} fincas asignadas base`,
    }));
  }, [rutas]);

  // Abrir modal para crear
  const abrirModalCrear = () => {
    setPlanificacionEditar(null);
    setFormCamionId(undefined);
    setFormChoferId(undefined);
    setFormRutaId(undefined);
    setFormFincasSeleccionadas([]);
    setFormObservacion('');
    setBusquedaFincaChecklist('');
    setFiltroSoloRuta(true);
    setModalAbierto(true);
  };

  // Abrir modal para editar
  const abrirModalEditar = (item: PlanificacionRutaChoferDto) => {
    setPlanificacionEditar(item);
    setFormCamionId(item.camionId);
    setFormChoferId(item.conductorId);
    setFormRutaId(item.rutaLogisticaId || undefined);
    setFormFincasSeleccionadas([...(item.listaFincasIds || [])]);
    setFormObservacion(item.observacion || '');
    setBusquedaFincaChecklist('');
    setFiltroSoloRuta(false);
    setModalAbierto(true);
  };

  // Guardar asignación
  const handleGuardar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCamionId) {
      Swal.fire({ icon: 'warning', title: 'Camión requerido', text: 'Por favor seleccione el camión cisterna.' });
      return;
    }
    if (!formChoferId) {
      Swal.fire({ icon: 'warning', title: 'Conductor requerido', text: 'Por favor seleccione el conductor responsable.' });
      return;
    }
    if (formFincasSeleccionadas.length === 0) {
      Swal.fire({ icon: 'warning', title: 'Sin fincas seleccionadas', text: 'Debe seleccionar al menos una finca para este camión.' });
      return;
    }

    const dto: GuardarPlanificacionRutaChoferDto = {
      id: planificacionEditar?.id,
      fecha: fechaOperativa,
      camionId: formCamionId,
      conductorId: formChoferId,
      rutaLogisticaId: formRutaId,
      fincasIds: formFincasSeleccionadas,
      litrosEstimados: Math.round(litrosEstimadosSeleccionados),
      observacion: formObservacion.trim() || undefined,
    };

    guardarMutation.mutate(dto);
  };

  // Alternar finca en el checklist
  const toggleFinca = (fincaId: number) => {
    setFormFincasSeleccionadas((prev) =>
      prev.includes(fincaId) ? prev.filter((id) => id !== fincaId) : [...prev, fincaId]
    );
  };

  // Seleccionar todas las fincas de la ruta activa
  const seleccionarTodasDeRuta = () => {
    const idsVisibles = fincasParaModal.map((f) => f.fincaId);
    setFormFincasSeleccionadas((prev) => Array.from(new Set([...prev, ...idsVisibles])));
  };

  // Deseleccionar todas las fincas
  const deseleccionarTodas = () => {
    setFormFincasSeleccionadas([]);
  };

  // Al cambiar camión, si tiene chofer asignado sugerirlo
  const handleCamionChange = (val: number, cam?: CamionDto) => {
    setFormCamionId(val);
    if (cam?.usuarioId && !formChoferId) {
      setFormChoferId(cam.usuarioId);
    }
  };

  // Al cambiar ruta, sugerir fincas de esa ruta si la lista está vacía
  const handleRutaChange = (val: string | number) => {
    const num = Number(val) || undefined;
    setFormRutaId(num);
    if (num && formFincasSeleccionadas.length === 0) {
      const fincasDeEstaRuta = fincasPromedios.filter((f) => f.rutaId === num).map((f) => f.fincaId);
      setFormFincasSeleccionadas(fincasDeEstaRuta);
    }
  };

  // KPIs de la fecha
  const kpiTotalCamiones = planificaciones.length;
  const kpiTotalLitrosEstimados = planificaciones.reduce((acc, p) => acc + (p.litrosEstimados || 0), 0);
  const kpiTotalFincas = useMemo(() => {
    const set = new Set<number>();
    planificaciones.forEach((p) => (p.listaFincasIds || []).forEach((id) => set.add(id)));
    return set.size;
  }, [planificaciones]);

  const kpiCapacidadPromedio = useMemo(() => {
    if (planificaciones.length === 0) return 0;
    const sumPcts = planificaciones.reduce((acc, p) => acc + (p.porcentajeOcupacion || 0), 0);
    return Math.round(sumPcts / planificaciones.length);
  }, [planificaciones]);

  // Columnas para DataTable
  const columnas: ColumnDef<PlanificacionRutaChoferDto>[] = [
    {
      header: 'Camión Cisterna',
      accessorKey: 'camionPlaca',
      sortable: true,
      cell: (row) => (
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <Truck className="w-4 h-4" />
          </div>
          <div>
            <div className="font-extrabold text-slate-800 text-sm">{row.camionPlaca || `ID: ${row.camionId}`}</div>
            <div className="text-xs text-slate-500">Capacidad: {(row.capacidadCamionLitros || 0).toLocaleString()} L</div>
          </div>
        </div>
      ),
    },
    {
      header: 'Conductor / Chofer',
      accessorKey: 'conductorNombre',
      sortable: true,
      cell: (row) => (
        <div className="flex items-center gap-1.5">
          <User className="w-3.5 h-3.5 text-slate-400" />
          <span className="font-bold text-slate-700 text-sm">{row.conductorNombre || 'Sin chofer'}</span>
        </div>
      ),
    },
    {
      header: 'Ruta Base',
      accessorKey: 'rutaLogisticaNombre',
      sortable: true,
      cell: (row) => (
        row.rutaLogisticaNombre ? (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
            <RouteIcon className="w-3 h-3" />
            {row.rutaLogisticaNombre}
          </span>
        ) : (
          <span className="text-xs text-slate-400 font-medium">Ruta Flexible / Multiruta</span>
        )
      ),
    },
    {
      header: 'Fincas Asignadas',
      accessorKey: 'totalFincas',
      sortable: true,
      cell: (row) => (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-extrabold bg-slate-100 text-slate-700 border border-slate-200">
          <Layers className="w-3 h-3 text-slate-500" />
          {row.totalFincas} {row.totalFincas === 1 ? 'Finca' : 'Fincas'}
        </span>
      ),
    },
    {
      header: 'Carga Estimada (15 Días)',
      accessorKey: 'litrosEstimados',
      sortable: true,
      cell: (row) => {
        const pct = row.porcentajeOcupacion || 0;
        const color = pct > 100 ? '#ef4444' : pct >= 90 ? '#f59e0b' : '#10b981';
        return (
          <div className="min-w-[130px]">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-extrabold text-slate-800">
                {(row.litrosEstimados || 0).toLocaleString()} Lts
              </span>
              <span className="font-extrabold" style={{ color }}>{pct}%</span>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }}
              />
            </div>
          </div>
        );
      },
    },
    {
      header: 'Observación',
      accessorKey: 'observacion',
      cell: (row) => (
        <span className="text-xs text-slate-500 italic max-w-[200px] truncate block" title={row.observacion || ''}>
          {row.observacion || '—'}
        </span>
      ),
    },
    {
      header: 'Acciones',
      className: 'text-right',
      cell: (row) => (
        <div className="flex items-center justify-end gap-1.5">
          <button
            type="button"
            onClick={() => abrirModalEditar(row)}
            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
            title="Editar Planificación"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={async () => {
              const res = await confirmDeleteOrDeactivate(
                'Eliminar Asignación',
                `¿Desea eliminar la planificación del camión ${row.camionPlaca} con ${row.conductorNombre}?`
              );
              if (res) {
                eliminarMutation.mutate(row.id);
              }
            }}
            className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
            title="Eliminar Planificación"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="page-container p-4 md:p-6 space-y-6">
      {/* CABECERA SUPERIOR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-blue-100 text-blue-800 border border-blue-200 uppercase tracking-wide">
              <RouteIcon className="w-3.5 h-3.5 text-blue-600" /> Logísticas & Flota Diaria
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Promedio 15 Días
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            Planificación de Rutas-choferes
          </h1>
          <p className="text-sm text-slate-500">
            Asignación y distribución diaria de fincas y rutas logísticas por camión cisterna y conductor, con proyección de carga en base al promedio de 15 días.
          </p>
        </div>

        {/* CONTROLES DERECHA: FECHA OPERATIVA Y BOTÓN NUEVO */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Navegador de Fecha */}
          <div className="flex items-center bg-white border border-slate-200 rounded-xl shadow-xs p-1">
            <button
              type="button"
              onClick={() => cambiarFecha(-1)}
              className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
              title="Día Anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1.5 px-2">
              <Calendar className="w-4 h-4 text-blue-600" />
              <input
                type="date"
                value={fechaOperativa}
                onChange={(e) => setFechaOperativa(e.target.value)}
                className="text-xs font-bold text-slate-800 bg-transparent border-none outline-none cursor-pointer"
              />
            </div>
            <button
              type="button"
              onClick={() => cambiarFecha(1)}
              className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
              title="Día Siguiente"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={irAHoy}
              className="ml-1 px-2 py-1 text-[11px] font-bold text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
            >
              Hoy
            </button>
          </div>

          {/* Botón Asignar Camión */}
          <button
            type="button"
            onClick={abrirModalCrear}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-sm shadow-blue-500/20 transition-all cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            Planificar Camión / Chofer
          </button>
        </div>
      </div>

      {/* KPIS DE RESUMEN DIARIO */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1 */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Camiones Planificados</div>
            <div className="text-2xl font-black text-slate-900 mt-1">{kpiTotalCamiones}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Asignados para {fechaOperativa}</div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Truck className="w-6 h-6" />
          </div>
        </div>

        {/* KPI 2 */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Litros Proyectados (15D)</div>
            <div className="text-2xl font-black text-blue-700 mt-1">{kpiTotalLitrosEstimados.toLocaleString()} Lts</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Basado en promedio histórico</div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Droplet className="w-6 h-6" />
          </div>
        </div>

        {/* KPI 3 */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Fincas en Recorrido</div>
            <div className="text-2xl font-black text-emerald-700 mt-1">{kpiTotalFincas}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Paradas programadas hoy</div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Layers className="w-6 h-6" />
          </div>
        </div>

        {/* KPI 4 */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Ocupación Media Cisternas</div>
            <div className="text-2xl font-black text-slate-900 mt-1">{kpiCapacidadPromedio}%</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Capacidad proyectada total</div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <RouteIcon className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* CONTROLES DE VISTA */}
      <div className="flex items-center justify-between">
        <div className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
          <span>Asignaciones de la Jornada ({planificaciones.length})</span>
        </div>
        <div className="flex items-center bg-slate-100 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setVistaModo('tarjetas')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              vistaModo === 'tarjetas' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            Tarjetas de Flota
          </button>
          <button
            type="button"
            onClick={() => setVistaModo('tabla')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              vistaModo === 'tabla' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <TableIcon className="w-3.5 h-3.5" />
            Tabla Completa
          </button>
        </div>
      </div>

      {/* CONTENIDO PRINCIPAL: TARJETAS O TABLA */}
      {cargandoPlanes ? (
        <div className="p-12 text-center text-slate-400">
          <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-3" />
          Cargando planificaciones de la fecha...
        </div>
      ) : planificaciones.length === 0 ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-4">
            <Truck className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-800 mb-1">Sin Planificaciones Registradas</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">
            Aún no se han asignado camiones, choferes y fincas para la fecha <b>{fechaOperativa}</b>. Comience planificando la primera cisterna.
          </p>
          <button
            type="button"
            onClick={abrirModalCrear}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-sm"
          >
            <PlusCircle className="w-4 h-4" />
            Planificar Primer Camión
          </button>
        </div>
      ) : vistaModo === 'tarjetas' ? (
        /* VISTA DE TARJETAS DE CAMIÓN */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {planificaciones.map((plan) => {
            const pct = plan.porcentajeOcupacion || 0;
            const color = pct > 100 ? '#ef4444' : pct >= 90 ? '#f59e0b' : '#10b981';
            const fincasIds = plan.listaFincasIds || [];

            return (
              <div
                key={plan.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-all p-5 flex flex-col justify-between"
              >
                <div>
                  {/* Encabezado de la tarjeta */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center shadow-xs">
                        <Truck className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-extrabold text-slate-900 text-base leading-tight">
                          {plan.camionPlaca}
                        </div>
                        <div className="text-xs text-slate-500 font-medium">
                          Capacidad: {(plan.capacidadCamionLitros || 0).toLocaleString()} Lts
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => abrirModalEditar(plan)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Editar Asignación"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          const res = await confirmDeleteOrDeactivate(
                            'Eliminar Asignación',
                            `¿Desea eliminar la planificación del camión ${plan.camionPlaca}?`
                          );
                          if (res) eliminarMutation.mutate(plan.id);
                        }}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Eliminar Asignación"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Chofer y Ruta */}
                  <div className="bg-slate-50/80 rounded-xl p-3 mb-3 space-y-2 border border-slate-100">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-slate-400" /> Chofer Responsable:
                      </span>
                      <span className="font-bold text-slate-800">{plan.conductorNombre || 'Sin chofer'}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 flex items-center gap-1.5">
                        <RouteIcon className="w-3.5 h-3.5 text-slate-400" /> Circuito Logístico:
                      </span>
                      <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                        {plan.rutaLogisticaNombre || 'Flexible / Multiruta'}
                      </span>
                    </div>
                  </div>

                  {/* Barra de progreso de capacidad */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-bold text-slate-700">Carga Proyectada (15D):</span>
                      <div className="flex items-center gap-1">
                        <span className="font-extrabold text-slate-900">
                          {(plan.litrosEstimados || 0).toLocaleString()} Lts
                        </span>
                        <span className="text-slate-400">/</span>
                        <span className="text-slate-500">{(plan.capacidadCamionLitros || 0).toLocaleString()} L</span>
                        <span className="font-black ml-1 text-xs" style={{ color }}>
                          ({pct}%)
                        </span>
                      </div>
                    </div>
                    <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }}
                      />
                    </div>
                    {pct > 100 && (
                      <div className="mt-1 flex items-center gap-1 text-[11px] font-bold text-red-600">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Sobrecupo: Excede en {((plan.litrosEstimados || 0) - (plan.capacidadCamionLitros || 0)).toLocaleString()} Lts
                      </div>
                    )}
                  </div>

                  {/* Lista de Fincas Asignadas */}
                  <div>
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center justify-between">
                      <span>Fincas Asignadas ({fincasIds.length})</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
                      {fincasIds.map((fId) => {
                        const finca = fincasPromedios.find((f) => f.fincaId === fId);
                        return (
                          <span
                            key={fId}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200"
                          >
                            <span className="truncate max-w-[140px]">{finca?.fincaNombre || `Finca #${fId}`}</span>
                            {finca?.promedioLitros ? (
                              <span className="text-[10px] font-bold text-blue-600 ml-0.5">
                                ~{finca.promedioLitros.toLocaleString()}L
                              </span>
                            ) : null}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Footer de Tarjeta */}
                {plan.observacion && (
                  <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-500 italic">
                    <Info className="w-3 h-3 inline mr-1 text-slate-400" />
                    {plan.observacion}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* VISTA DE TABLA CON DATATABLE (REGLA MAESTRA 2) */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4">
          <DataTable
            data={planificaciones}
            columns={columnas}
            searchPlaceholder="Buscar por placa, chofer, ruta u observación..."
            pageSizeDefault={10}
            exportFileName={`Planificacion_Rutas_Choferes_${fechaOperativa}`}
          />
        </div>
      )}

      {/* MODAL PARA CREAR / EDITAR PLANIFICACIÓN */}
      {modalAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
            {/* Cabecera del Modal */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    {planificacionEditar ? 'Editar Planificación de Camión' : 'Planificar Camión y Chofer'}
                  </h3>
                  <p className="text-xs text-slate-500">Fecha Operativa: <b>{fechaOperativa}</b></p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalAbierto(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Formulario */}
            <form onSubmit={handleGuardar} className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* SELECTORES DE CAMIÓN, CHOFER Y RUTA */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Camión Select */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Camión Cisterna *
                  </label>
                  <CamionSelect
                    value={formCamionId}
                    onChange={handleCamionChange}
                    required
                  />
                  {camionSeleccionado && (
                    <div className="mt-1 text-[11px] text-blue-700 font-semibold">
                      Capacidad: {capacidadCisterna.toLocaleString()} Lts
                    </div>
                  )}
                </div>

                {/* Chofer Select */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Conductor / Chofer *
                  </label>
                  <ChoferSelect
                    value={formChoferId}
                    onChange={(val) => setFormChoferId(val)}
                    required
                  />
                </div>

                {/* Ruta Base Select */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Ruta Base / Circuito
                  </label>
                  <SearchableSelect
                    options={opcionesRutas}
                    value={formRutaId}
                    onChange={handleRutaChange}
                    placeholder="-- Todas / Flexible --"
                    allowClear
                  />
                </div>
              </div>

              {/* PANEL EN VIVO DE CAPACIDAD Y OCUPACIÓN */}
              <div className="bg-gradient-to-br from-slate-50 to-blue-50/50 rounded-2xl p-4 border border-blue-100 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">
                      Proyección de Carga Cisterna (15 Días)
                    </span>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-2xl font-black text-slate-900">
                        {Math.round(litrosEstimadosSeleccionados).toLocaleString()} Lts
                      </span>
                      <span className="text-xs text-slate-500 font-semibold">
                        / {capacidadCisterna > 0 ? `${capacidadCisterna.toLocaleString()} Lts` : 'Sin camión'}
                      </span>
                      <span
                        className="text-sm font-black px-2 py-0.5 rounded-full"
                        style={{
                          background: porcentajeOcupacion > 100 ? '#fef2f2' : porcentajeOcupacion >= 90 ? '#fefce8' : '#ecfdf5',
                          color: porcentajeOcupacion > 100 ? '#dc2626' : porcentajeOcupacion >= 90 ? '#d97706' : '#059669',
                          border: `1px solid ${porcentajeOcupacion > 100 ? '#fecaca' : porcentajeOcupacion >= 90 ? '#fde68a' : '#a7f3d0'}`,
                        }}
                      >
                        {porcentajeOcupacion}% Ocupación
                      </span>
                    </div>
                  </div>

                  <div className="text-right sm:border-l sm:border-slate-200 sm:pl-4">
                    <div className="text-xs font-bold text-slate-500">Fincas Seleccionadas</div>
                    <div className="text-xl font-extrabold text-blue-700">
                      {formFincasSeleccionadas.length}
                    </div>
                  </div>
                </div>

                {/* Barra de progreso */}
                <div className="mt-3 w-full h-3 bg-slate-200/70 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min(porcentajeOcupacion, 100)}%`,
                      backgroundColor:
                        porcentajeOcupacion > 100
                          ? '#ef4444'
                          : porcentajeOcupacion >= 90
                          ? '#f59e0b'
                          : '#10b981',
                    }}
                  />
                </div>

                {/* Mensaje de alerta de sobrecupo o capacidad adecuada */}
                {capacidadCisterna > 0 && (
                  <div className="mt-2 text-xs font-semibold">
                    {porcentajeOcupacion > 100 ? (
                      <span className="text-red-700 flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                        Sobrecupo proyectado: Excede la capacidad por {(Math.round(litrosEstimadosSeleccionados) - capacidadCisterna).toLocaleString()} Lts. Se recomienda dividir fincas con otro camión.
                      </span>
                    ) : porcentajeOcupacion >= 90 ? (
                      <span className="text-amber-700 flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                        Capacidad casi completa ({porcentajeOcupacion}%). Margen libre de {(capacidadCisterna - Math.round(litrosEstimadosSeleccionados)).toLocaleString()} Lts.
                      </span>
                    ) : (
                      <span className="text-emerald-700 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        Carga óptima dentro del límite. Margen disponible: {(capacidadCisterna - Math.round(litrosEstimadosSeleccionados)).toLocaleString()} Lts.
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* SELECCIÓN DE FINCAS GANADERAS */}
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                  <label className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                    Fincas a Recolectar (Promedio Histórico 15 Días)
                  </label>
                  <div className="flex items-center gap-2">
                    {formRutaId && (
                      <button
                        type="button"
                        onClick={() => setFiltroSoloRuta(!filtroSoloRuta)}
                        className={`text-xs px-2.5 py-1 rounded-lg font-bold transition-colors ${
                          filtroSoloRuta ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {filtroSoloRuta ? '✓ Filtrando por Ruta' : 'Ver Todas las Rutas'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={seleccionarTodasDeRuta}
                      className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      Seleccionar Visibles
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={deseleccionarTodas}
                      className="text-xs font-bold text-slate-500 hover:text-slate-800 hover:underline"
                    >
                      Deseleccionar
                    </button>
                  </div>
                </div>

                {/* Buscador dentro del checklist */}
                <div className="relative mb-2">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={busquedaFincaChecklist}
                    onChange={(e) => setBusquedaFincaChecklist(e.target.value)}
                    placeholder="Filtrar finca o productor..."
                    className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 outline-none"
                  />
                </div>

                {/* Lista de fincas con scroll */}
                <div className="border border-slate-200 rounded-2xl max-h-64 overflow-y-auto p-2 divide-y divide-slate-100 bg-white">
                  {cargandoFincas ? (
                    <div className="p-6 text-center text-xs text-slate-400">Cargando fincas...</div>
                  ) : fincasParaModal.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-400">
                      No se encontraron fincas con los filtros seleccionados.
                    </div>
                  ) : (
                    fincasParaModal.map((finca) => {
                      const isChecked = formFincasSeleccionadas.includes(finca.fincaId);
                      const asignadaA = fincasAsignadasEnFecha.get(finca.fincaId);

                      return (
                        <div
                          key={finca.fincaId}
                          onClick={() => toggleFinca(finca.fincaId)}
                          className={`flex items-center justify-between p-2 rounded-xl cursor-pointer transition-colors ${
                            isChecked ? 'bg-blue-50/70 hover:bg-blue-50' : 'hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {}} // controlado por el onClick del contenedor
                              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                            />
                            <div>
                              <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                <span>{finca.fincaNombre}</span>
                                {asignadaA && (
                                  <span
                                    className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300"
                                    title={`Esta finca ya está asignada hoy a ${asignadaA.camionPlaca} (${asignadaA.choferNombre})`}
                                  >
                                    ⚠️ Asignada a {asignadaA.camionPlaca}
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-400">
                                {finca.propietario || 'Sin propietario'}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-blue-700 bg-white px-2 py-0.5 rounded-lg border border-slate-200">
                              ~{finca.promedioLitros.toLocaleString()} Lts/d
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* OBSERVACIÓN OPERATIVA */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Observación Operativa / Instrucciones para el Chofer (Opcional)
                </label>
                <textarea
                  value={formObservacion}
                  onChange={(e) => setFormObservacion(e.target.value)}
                  placeholder="Ej: Comenzar por el sector norte, recoger canecas adicionales en finca Guasimales..."
                  rows={2}
                  className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 outline-none"
                />
              </div>

              {/* ACCIONES FOOTER */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalAbierto(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardarMutation.isPending}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50"
                >
                  {guardarMutation.isPending ? 'Guardando...' : planificacionEditar ? 'Actualizar Planificación' : 'Guardar Planificación'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlanificacionRutasChoferesPage;
