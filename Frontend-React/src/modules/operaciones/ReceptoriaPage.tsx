import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { operacionesApi } from '@/api/operaciones.api';
import { catalogosApi } from '@/api/catalogos.api';
import { sistemaApi } from '@/api/sistema.api';
import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/stores/authStore';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import type { CompaniaDto, CamionDto, UsuarioDto, DespachoCompaniaDto, ControlRutaDto } from '@/types';

export const ReceptoriaPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const hasBufala = useAuthStore((state) => state.hasTenantModule('MOD_LECHE_BUFALA'));
  const hoyStr = new Date().toISOString().split('T')[0];

  // Filtros globales de la vista
  const [filtroFecha, setFiltroFecha] = useState<string>(hoyStr);
  const [filtroEstado, setFiltroEstado] = useState<string>('TODOS');
  const [segmentoActivo, setSegmentoActivo] = useState<'TODOS' | 'ENTRADAS' | 'SALIDAS' | 'FORM' | 'HISTORIAL'>('TODOS');
  const [mostrarFormulario, setMostrarFormulario] = useState<boolean>(false);

  // Filtros específicos de la tabla de entregas
  const [filtroChoferTabla, setFiltroChoferTabla] = useState<string>('');
  const [filtroCompaniaTabla, setFiltroCompaniaTabla] = useState<string>('');
  const [busquedaTabla, setBusquedaTabla] = useState<string>('');
  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [sortColumn, setSortColumn] = useState<string>('fecha');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  // Modales
  const [modalNuevoDespacho, setModalNuevoDespacho] = useState<boolean>(false);
  const [modalConfirmar, setModalConfirmar] = useState<boolean>(false);
  const [despachoSeleccionado, setDespachoSeleccionado] = useState<DespachoCompaniaDto | null>(null);
  const [litrosConfirmadosInput, setLitrosConfirmadosInput] = useState<number>(0);
  const [obsConfirmacionInput, setObsConfirmacionInput] = useState<string>('');

  // Formulario rápido de entrega directa
  const [formEntrega, setFormEntrega] = useState({
    fecha: hoyStr,
    usuarioId: user?.rol === 'CHOFER' ? user.id : 0,
    companiaId: 0,
    litros: 0,
    observacion: '',
  });

  // Formulario nuevo despacho a quesera / salida con multi-destinos
  interface DestinoSalidaRow {
    id: string;
    companiaId: number;
    litrosDespachados: number;
    tipoLeche: string;
    numeroGuiaSADA: string;
    observacion: string;
  }

  const [despachoCamionId, setDespachoCamionId] = useState<number>(0);
  const [despachoUsuarioId, setDespachoUsuarioId] = useState<number>(0);
  const [destinosSalida, setDestinosSalida] = useState<DestinoSalidaRow[]>([
    { id: '1', companiaId: 0, litrosDespachados: 0, tipoLeche: 'VACA', numeroGuiaSADA: '', observacion: '' }
  ]);

  const [formDespacho, setFormDespacho] = useState({
    camionId: 0,
    companiaId: 0,
    litrosDespachados: 0,
    tipoLeche: 'VACA',
    numeroGuiaSADA: '',
    observaciones: '',
  });

  // Queries con auto-actualización reactiva en tiempo real (cada 8s)
  const { data: entregasHoy = [], isLoading: loadingEntregas } = useQuery<any[]>({
    queryKey: ['receptoria-hoy', filtroFecha],
    queryFn: () => operacionesApi.getEntregasHoy(filtroFecha || undefined),
    refetchInterval: 8000,
  });

  const { data: rutasHoy = [] } = useQuery<any[]>({
    queryKey: ['rutas-hoy', filtroFecha],
    queryFn: () => operacionesApi.getRutasHoy(filtroFecha || undefined),
    refetchInterval: 8000,
  });

  const { data: despachosCompanias = [], isLoading: loadingDespachos } = useQuery<DespachoCompaniaDto[]>({
    queryKey: ['despachos-companias', filtroFecha],
    queryFn: () => operacionesApi.getDespachosCompanias(filtroFecha || undefined),
    refetchInterval: 8000,
  });

  const { data: viajesActivos = [] } = useQuery<ControlRutaDto[]>({
    queryKey: ['viajes-activos-receptoria'],
    queryFn: () => operacionesApi.getControles(),
    refetchInterval: 8000,
  });

  const { data: companias = [] } = useQuery<CompaniaDto[]>({
    queryKey: ['companias-receptoria'],
    queryFn: () => catalogosApi.getCompanias(true),
  });

  const { data: camiones = [] } = useQuery<CamionDto[]>({
    queryKey: ['camiones-receptoria'],
    queryFn: () => catalogosApi.getCamiones(true),
  });

  const { data: usuarios = [] } = useQuery<UsuarioDto[]>({
    queryKey: ['usuarios-choferes'],
    queryFn: () => sistemaApi.getUsuarios('CHOFER'),
  });

  // Opciones con búsqueda interna para SearchableSelect
  const camionesOptions = useMemo(() => {
    return camiones.map((c) => ({
      value: c.id,
      label: `${c.placa} - ${c.marca || 'Cisterna'} ${c.modelo || ''}`.trim(),
      subLabel: `Chofer: ${c.choferNombre || 'Sin chofer asignado'} | Capacidad: ${(c.capacidadLitros || 0).toLocaleString()} L`,
      badge: `${(c.capacidadLitros || 0).toLocaleString()} L`,
    }));
  }, [camiones]);

  const conductoresOptions = useMemo(() => {
    return usuarios.map((u) => ({
      value: u.id,
      label: u.nombreCompleto || u.nombreUsuario,
      subLabel: `Usuario: ${u.nombreUsuario} | Rol: ${u.rol || 'CHOFER'}`,
    }));
  }, [usuarios]);

  const companiasOptions = useMemo(() => {
    return companias.map((c) => ({
      value: c.id,
      label: c.nombre,
      subLabel: c.contacto ? `Contacto: ${c.contacto}` : undefined,
    }));
  }, [companias]);

  const tiposLecheOptions = useMemo(() => [
    { value: 'VACA', label: '🥛 Leche de Vaca' },
    { value: 'BUFALA', label: '🐃 Leche de Búfala' },
  ], []);

  // Mutaciones
  const guardarEntregaMutation = useMutation({
    mutationFn: (dto: typeof formEntrega) => operacionesApi.guardarEntrega(dto),
    onSuccess: (data: any) => {
      toast.success(data.message || 'Entrega registrada exitosamente');
      queryClient.invalidateQueries({ queryKey: ['receptoria-hoy'] });
      queryClient.invalidateQueries({ queryKey: ['rutas-hoy'] });
      setFormEntrega({
        fecha: hoyStr,
        usuarioId: user?.rol === 'CHOFER' ? user.id : 0,
        companiaId: 0,
        litros: 0,
        observacion: '',
      });
      setMostrarFormulario(false);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Error al guardar entrega');
    },
  });

  const crearDespachoMutation = useMutation({
    mutationFn: (dto: typeof formDespacho) => operacionesApi.crearDespachoCompania(dto),
    onSuccess: (data) => {
      toast.success(data.message || 'Ticket de salida a planta creado');
      queryClient.invalidateQueries({ queryKey: ['despachos-companias'] });
      queryClient.invalidateQueries({ queryKey: ['receptoria-hoy'] });
      setModalNuevoDespacho(false);
      setFormDespacho({
        camionId: 0,
        companiaId: 0,
        litrosDespachados: 0,
        tipoLeche: 'VACA',
        numeroGuiaSADA: '',
        observaciones: '',
      });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Error al crear despacho');
    },
  });

  const crearDespachosMultiMutation = useMutation({
    mutationFn: async (payload: { camionId: number; usuarioId: number; destinos: DestinoSalidaRow[] }) => {
      const results = [];
      for (const dest of payload.destinos) {
        const res = await operacionesApi.crearDespachoCompania({
          camionId: payload.camionId,
          usuarioId: payload.usuarioId,
          companiaId: dest.companiaId,
          litrosDespachados: dest.litrosDespachados,
          tipoLeche: dest.tipoLeche,
          numeroGuiaSADA: dest.numeroGuiaSADA,
          observaciones: dest.observacion,
        });
        results.push(res);
      }
      return results;
    },
    onSuccess: (data) => {
      toast.success(`${data.length} Ticket(s) de salida emitido(s) con éxito`);
      queryClient.invalidateQueries({ queryKey: ['despachos-companias'] });
      queryClient.invalidateQueries({ queryKey: ['receptoria-hoy'] });
      queryClient.invalidateQueries({ queryKey: ['receptoria-balance'] });
      queryClient.invalidateQueries({ queryKey: ['rutas-hoy'] });
      queryClient.invalidateQueries({ queryKey: ['viajes-activos-receptoria'] });
      setModalNuevoDespacho(false);
      setDestinosSalida([
        { id: '1', companiaId: 0, litrosDespachados: 0, tipoLeche: 'VACA', numeroGuiaSADA: '', observacion: '' }
      ]);
      setDespachoCamionId(0);
      setDespachoUsuarioId(0);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Error al emitir despacho');
    },
  });

  const validarMutation = useMutation({
    mutationFn: ({ id, litros, obs }: { id: number; litros: number; obs: string }) =>
      operacionesApi.validarEntregaCompania(id, { litrosConfirmados: litros, observaciones: obs }),
    onSuccess: (data) => {
      toast.success(data.message || 'Entrega validada y conciliada');
      queryClient.invalidateQueries({ queryKey: ['despachos-companias'] });
      queryClient.invalidateQueries({ queryKey: ['receptoria-hoy'] });
      setModalConfirmar(false);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Error al validar entrega');
    },
  });

  const eliminarEntregaMutation = useMutation({
    mutationFn: (id: number) => operacionesApi.eliminarEntrega(id),
    onSuccess: (data) => {
      toast.success(data.message || 'Entrega eliminada');
      queryClient.invalidateQueries({ queryKey: ['receptoria-hoy'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Error al eliminar entrega');
    },
  });

  // Cálculo de totales y balance
  const totalLitrosRuta = useMemo(() => {
    return rutasHoy.reduce((acc, r) => acc + Number(r.litros || r.Litros || 0), 0);
  }, [rutasHoy]);

  const totalLitrosReceptoria = useMemo(() => {
    return entregasHoy.reduce((acc, e) => acc + Number(e.litros || e.Litros || 0), 0);
  }, [entregasHoy]);

  const diferenciaBalance = totalLitrosReceptoria - totalLitrosRuta;
  const pctMermaGlobal = totalLitrosRuta > 0 ? (Math.abs(diferenciaBalance) / totalLitrosRuta) * 100 : 0;

  // Clasificador de proceso por entrega
  const clasificarEntrega = (e: any) => {
    const compNom = (e.companiaNombre || '').toUpperCase();
    const obs = (e.observacion || '').toUpperCase();
    const numLitros = Number(e.litros || e.Litros || 0);

    const ticketId = e.controlRutaId || null;
    let ctrlCompId = null;
    if (e.observacion) {
      const matchCtrl = e.observacion.match(/Control\s*Compañ[íi]as\s*#?(\d+)/i) || e.observacion.match(/Ctrl\s*#?(\d+)/i);
      if (matchCtrl) ctrlCompId = parseInt(matchCtrl[1], 10);
    }

    if (((compNom.includes('RECEPTORIA') || compNom.includes('RECEPTORÍA')) && numLitros < 0) || obs.includes('SALIDA DESDE RECEPTORÍA')) {
      return {
        tipo: 'SALIDA_RECEPTORIA',
        label: 'Salida Receptoría',
        subLabel: 'Descarga de Tanque',
        icono: 'fa-solid fa-arrow-up-from-bracket',
        badgeBg: '#fff7ed',
        badgeColor: '#c2410c',
        badgeBorder: '#fed7aa',
        rowBg: 'rgba(255, 247, 237, 0.65)',
        borderLeft: '#ea580c',
        titleColor: '#c2410c',
        litrosColor: '#dc2626',
        ticketId,
        ctrlCompId,
      };
    }

    if ((compNom.includes('RECEPTORIA') || compNom.includes('RECEPTORÍA')) && numLitros >= 0) {
      return {
        tipo: 'INGRESO_RECEPTORIA',
        label: 'Ingreso Receptoría',
        subLabel: 'Recepción en Tanque',
        icono: 'fa-solid fa-warehouse',
        badgeBg: '#f0f9ff',
        badgeColor: '#0284c7',
        badgeBorder: '#bae6fd',
        rowBg: 'rgba(240, 249, 255, 0.65)',
        borderLeft: '#0284c7',
        titleColor: '#0369a1',
        litrosColor: '#0284c7',
        ticketId,
        ctrlCompId,
      };
    }

    if (e.controlRutaId != null && !obs.includes('CONTROL COMPAÑÍAS') && !obs.includes('DESPACHADO DESDE RECEPTOR')) {
      return {
        tipo: 'DIRECTO_FINCA_COMPANIA',
        label: 'Directo Finca ➔ Planta',
        subLabel: 'Ruta Directa',
        icono: 'fa-solid fa-route',
        badgeBg: '#ecfdf5',
        badgeColor: '#059669',
        badgeBorder: '#a7f3d0',
        rowBg: 'rgba(236, 253, 245, 0.65)',
        borderLeft: '#10b981',
        titleColor: '#047857',
        litrosColor: '#059669',
        ticketId,
        ctrlCompId,
      };
    }

    return {
      tipo: 'LLEGADA_COMPANIA',
      label: 'Llegada a Planta',
      subLabel: 'Recepción en Compañía',
      icono: 'fa-solid fa-building-circle-check',
      badgeBg: '#faf5ff',
      badgeColor: '#7c3aed',
      badgeBorder: '#ddd6fe',
      rowBg: 'rgba(250, 245, 255, 0.65)',
      borderLeft: '#9333ea',
      titleColor: '#6d28d9',
      litrosColor: '#7c3aed',
      ticketId,
      ctrlCompId,
    };
  };

  // Filtrado y ordenamiento de la tabla
  const entregasFiltradas = useMemo(() => {
    let items = entregasHoy.slice();

    if (filtroChoferTabla) {
      items = items.filter((e) =>
        (e.conductorNombre || '').toLowerCase().includes(filtroChoferTabla.toLowerCase())
      );
    }

    if (filtroCompaniaTabla) {
      items = items.filter((e) =>
        (e.companiaNombre || '').toLowerCase().includes(filtroCompaniaTabla.toLowerCase())
      );
    }

    if (busquedaTabla.trim()) {
      const term = busquedaTabla.toLowerCase().trim();
      items = items.filter((e) =>
        (e.companiaNombre || '').toLowerCase().includes(term) ||
        (e.conductorNombre || '').toLowerCase().includes(term) ||
        (e.observacion || '').toLowerCase().includes(term) ||
        (e.litros?.toString() || '').includes(term)
      );
    }

    items.sort((a, b) => {
      let valA: any = a[sortColumn];
      let valB: any = b[sortColumn];
      if (sortColumn === 'litros') {
        valA = Number(a.litros || 0);
        valB = Number(b.litros || 0);
      }
      if (valA === valB) return 0;
      if (valA == null) return 1;
      if (valB == null) return -1;
      return sortAsc ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1);
    });

    return items;
  }, [entregasHoy, filtroChoferTabla, filtroCompaniaTabla, busquedaTabla, sortColumn, sortAsc]);

  const totalFiltradoLts = useMemo(() => {
    return entregasFiltradas.reduce((acc, e) => acc + Number(e.litros || 0), 0);
  }, [entregasFiltradas]);

  const totalPages = Math.max(1, Math.ceil(entregasFiltradas.length / (pageSize === -1 ? 999999 : pageSize)));
  const entregasPaginadas = useMemo(() => {
    if (pageSize === -1) return entregasFiltradas;
    const start = (currentPage - 1) * pageSize;
    return entregasFiltradas.slice(start, start + pageSize);
  }, [entregasFiltradas, currentPage, pageSize]);

  // Lista dinámica de choferes y compañías que tienen entregas hoy
  const choferesUnicosHoy = useMemo(() => {
    const set = new Set<string>();
    entregasHoy.forEach((e) => {
      if (e.conductorNombre) set.add(e.conductorNombre.trim());
    });
    return Array.from(set).sort();
  }, [entregasHoy]);

  const companiasUnicasHoy = useMemo(() => {
    const set = new Set<string>();
    entregasHoy.forEach((e) => {
      if (e.companiaNombre) set.add(e.companiaNombre.trim());
    });
    return Array.from(set).sort();
  }, [entregasHoy]);

  const filtroChoferOptions = useMemo(() => [
    { value: '', label: 'TODOS LOS CHOFERES' },
    ...choferesUnicosHoy.map((c) => ({ value: c, label: c }))
  ], [choferesUnicosHoy]);

  const filtroCompaniaOptions = useMemo(() => [
    { value: '', label: 'TODAS LAS COMPAÑÍAS' },
    ...companiasUnicasHoy.map((cp) => ({ value: cp, label: cp }))
  ], [companiasUnicasHoy]);

  // Bandeja 1: Camiones en espera
  const camionesEnEspera = useMemo(() => {
    return viajesActivos.filter(
      (v) => v.estadoProceso === 'EN_RECOLECCION' || v.estadoProceso === 'EN_ESPERA' || v.estadoProceso === 'RECOLECCION'
    );
  }, [viajesActivos]);

  // Bandeja 2: Salidas a queseras
  const salidasTransito = useMemo(() => {
    return despachosCompanias.filter(
      (d) => d.estado === 'EN VIA' || d.estado === 'EN_TRANSITO' || !d.litrosRecibidosCompania
    );
  }, [despachosCompanias]);

  return (
    <section id="tab-receptoria" className="tab-content" style={{ display: 'block' }}>
      {/* CABECERA VISTA */}
      <div className="view-header">
        <div>
          <h1 className="view-title">Control de Entregas en Receptoría</h1>
          <p className="view-subtitle">
            Registro y control de entregas de leche en plantas y compañías receptoras
          </p>
        </div>
      </div>

      {/* SECCIÓN BANDEJAS ACTIVAS EN RECEPTORÍA */}
      <div id="seccionBandejasReceptoria" style={{ marginBottom: '20px' }}>
        {/* BARRA DE CONTROL GLOBAL */}
        <div
          className="content-card"
          style={{
            marginBottom: '14px',
            padding: '12px 18px',
            borderRadius: '12px',
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '14px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            {/* Filtro de Estado */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label
                htmlFor="filtroEstadoBandejaReceptoria"
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  color: '#475569',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  margin: 0,
                  textTransform: 'uppercase',
                  letterSpacing: '0.03em',
                }}
              >
                <i className="fa-solid fa-filter" style={{ color: '#0284c7' }}></i> Vista:
              </label>
              <select
                id="filtroEstadoBandejaReceptoria"
                className="form-input"
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value)}
                style={{
                  height: '36px',
                  padding: '4px 12px',
                  fontSize: '13px',
                  fontWeight: 700,
                  color: '#0f172a',
                  minWidth: '210px',
                  borderRadius: '8px',
                  border: '1.5px solid #cbd5e1',
                  background: '#f8fafc',
                }}
              >
                <option value="TODOS">⚡ Flujo Operativo Completo</option>
                <option value="EN_ESPERA">🚚 1. Entradas (En Espera / Ruta)</option>
                <option value="RECEPCIONADO">✅ 1. Entradas Recepcionadas</option>
                <option value="EN_VIA">🚚 2. Salidas (En Vía a Queseras)</option>
                <option value="DESPACHO">🏢 2. Salidas Entregadas</option>
              </select>
            </div>

            {/* Filtro de Fecha Sincronizado */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <label
                htmlFor="filtroFechaBandejaReceptoria"
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  color: '#475569',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  margin: 0,
                  textTransform: 'uppercase',
                  letterSpacing: '0.03em',
                }}
              >
                <i className="fa-regular fa-calendar" style={{ color: '#0284c7' }}></i> Fecha:
              </label>
              <input
                type="date"
                id="filtroFechaBandejaReceptoria"
                className="form-input"
                value={filtroFecha}
                onChange={(e) => setFiltroFecha(e.target.value)}
                style={{ height: '36px', fontSize: '13px', width: '145px', borderRadius: '8px', border: '1.5px solid #cbd5e1' }}
              />
              <button
                type="button"
                className="btn btn-sm btn-outline"
                onClick={() => setFiltroFecha(hoyStr)}
                title="Ver fecha de hoy"
                style={{ height: '36px', padding: '0 10px', fontSize: '12px', fontWeight: 700, borderRadius: '8px' }}
              >
                Hoy
              </button>
              <button
                type="button"
                className="btn btn-sm btn-outline"
                onClick={() => setFiltroFecha('')}
                title="Ver histórico / todas las fechas"
                style={{ height: '36px', padding: '0 10px', fontSize: '12px', fontWeight: 600, borderRadius: '8px' }}
              >
                Todas
              </button>
            </div>
          </div>

          {/* Botones de Acción */}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={() => setModalNuevoDespacho(true)}
              style={{
                height: '36px',
                fontWeight: 700,
                background: 'linear-gradient(135deg, #9333ea, #7e22ce)',
                border: 'none',
                borderRadius: '8px',
                padding: '0 16px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 8px rgba(147,51,234,0.3)',
                cursor: 'pointer',
              }}
            >
              <i className="fa-solid fa-plus-circle"></i> Nuevo Ticket Salida / ENVÍO
            </button>
            <button
              type="button"
              className="btn btn-sm btn-outline"
              onClick={() => setMostrarFormulario(!mostrarFormulario)}
              style={{
                height: '36px',
                fontWeight: 700,
                color: '#0284c7',
                borderColor: '#7dd3fc',
                background: '#f0f9ff',
                borderRadius: '8px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
              }}
            >
              <i className="fa-solid fa-pen-to-square"></i> Registrar Entrega
            </button>
            <button
              type="button"
              className="btn btn-sm btn-outline"
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ['receptoria-hoy'] });
                queryClient.invalidateQueries({ queryKey: ['rutas-hoy'] });
                queryClient.invalidateQueries({ queryKey: ['despachos-companias'] });
              }}
              style={{ height: '36px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '6px', borderRadius: '8px', cursor: 'pointer' }}
            >
              <i className="fa-solid fa-arrows-rotate"></i> Actualizar
            </button>
          </div>
        </div>

        {/* ACCESOS RÁPIDOS POR SEGMENTOS OPERATIVOS */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap' }}>
          {[
            { id: 'TODOS', label: 'Todos', icon: 'fa-layer-group', count: null },
            { id: 'ENTRADAS', label: '1. Entradas', icon: 'fa-truck-ramp-box', count: camionesEnEspera.length, color: '#0284c7', bg: '#e0f2fe' },
            { id: 'SALIDAS', label: '2. Salidas', icon: 'fa-building-wheat', count: salidasTransito.length, color: '#9333ea', bg: '#f3e8ff' },
            { id: 'FORM', label: 'Formulario de Entrega', icon: 'fa-edit', count: null },
            { id: 'HISTORIAL', label: 'Historial de Entregas', icon: 'fa-table-list', count: null },
          ].map((seg) => {
            const esActivo = segmentoActivo === seg.id;
            return (
              <button
                key={seg.id}
                type="button"
                className="btn btn-sm"
                onClick={() => {
                  setSegmentoActivo(seg.id as any);
                  if (seg.id === 'FORM') setMostrarFormulario(true);
                }}
                style={{
                  borderRadius: '20px',
                  fontWeight: 700,
                  padding: '5px 15px',
                  fontSize: '12.5px',
                  border: `1.5px solid ${esActivo ? '#0284c7' : '#cbd5e1'}`,
                  background: esActivo ? '#0284c7' : '#ffffff',
                  color: esActivo ? '#ffffff' : '#475569',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <i className={`fa-solid ${seg.icon}`} style={{ color: esActivo ? '#ffffff' : (seg.color || '#64748b') }}></i>
                {seg.label}
                {seg.count !== null && (
                  <span
                    className="badge"
                    style={{
                      background: esActivo ? 'rgba(255,255,255,0.25)' : seg.bg,
                      color: esActivo ? '#ffffff' : seg.color,
                      marginLeft: '4px',
                      fontSize: '11px',
                    }}
                  >
                    {seg.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* BANDEJA 1: ENTRADAS - CAMIONES EN ESPERA */}
        {(segmentoActivo === 'TODOS' || segmentoActivo === 'ENTRADAS') && (
          <div
            id="cardBandejaEnEspera"
            className="content-card"
            style={{
              marginBottom: '18px',
              borderRadius: '12px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
              border: '1px solid #e2e8f0',
              borderLeft: '4px solid #0284c7',
              background: '#ffffff',
              padding: '16px 20px',
            }}
          >
            <div style={{ marginBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <h3 style={{ fontSize: '14.5px', fontWeight: 800, color: '#0284c7', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fa-solid fa-truck-ramp-box"></i> 1. ENTRADAS: RECEPCIÓN DE LECHE DE FINCAS (CONTROL RUTAS)
              </h3>
              <span className="badge" style={{ background: '#e0f2fe', color: '#0284c7', fontWeight: 800, border: '1px solid #bae6fd' }}>
                {camionesEnEspera.length} Camiones Activos
              </span>
            </div>

            {camionesEnEspera.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                <i className="fa-solid fa-circle-check" style={{ color: '#10b981', marginRight: '6px' }}></i>
                No hay camiones pendientes de descarga en silos para este período.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '14px' }}>
                {camionesEnEspera.map((c) => (
                  <div
                    key={c.id}
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '10px',
                      padding: '14px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 800, color: '#0f172a', fontSize: '14px' }}>
                        <i className="fa-solid fa-truck" style={{ color: '#0284c7', marginRight: '6px' }}></i>
                        {c.camionPlaca || 'Camión Cisterna'}
                      </span>
                      <span className="badge" style={{ background: '#e0f2fe', color: '#0369a1', fontWeight: 800 }}>
                        Viaje #{c.id}
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#475569' }}>
                      <i className="fa-regular fa-user" style={{ marginRight: '6px' }}></i>
                      {c.choferNombre || 'Chofer Asignado'}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', paddingTop: '8px', borderTop: '1px solid #e2e8f0' }}>
                      <span style={{ fontWeight: 900, color: '#0284c7', fontSize: '16px' }}>
                        {(c.totalLitrosRecogidos || 0).toLocaleString()} <small style={{ fontSize: '11px', color: '#64748b' }}>Lts</small>
                      </span>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline"
                        onClick={() => {
                          setFormEntrega({
                            ...formEntrega,
                            usuarioId: c.choferId || 0,
                            litros: c.totalLitrosRecogidos || 0,
                            observacion: `Descarga de Viaje #${c.id} - ${c.camionPlaca || ''}`,
                          });
                          setMostrarFormulario(true);
                        }}
                        style={{ fontSize: '11.5px', fontWeight: 700, padding: '4px 10px', color: '#0284c7', borderColor: '#7dd3fc' }}
                      >
                        <i className="fa-solid fa-arrow-down-to-bracket"></i> Descargar a Silos
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* BANDEJA 2: SALIDAS - DESPACHOS A COMPAÑÍAS Y QUESERAS */}
        {(segmentoActivo === 'TODOS' || segmentoActivo === 'SALIDAS') && (
          <div
            id="cardBandejaEnTransito"
            className="content-card"
            style={{
              marginBottom: '18px',
              borderRadius: '12px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
              border: '1px solid #e2e8f0',
              borderLeft: '4px solid #9333ea',
              background: '#ffffff',
              padding: '16px 20px',
            }}
          >
            <div style={{ marginBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <h3 style={{ fontSize: '14.5px', fontWeight: 800, color: '#9333ea', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fa-solid fa-building-wheat"></i> 2. SALIDAS: DESPACHOS A COMPAÑÍAS Y QUESERAS (CONTROL COMPAÑÍAS)
              </h3>
              <span className="badge" style={{ background: '#f3e8ff', color: '#9333ea', fontWeight: 800, border: '1px solid #e9d5ff' }}>
                {salidasTransito.length} En Tránsito
              </span>
            </div>

            {salidasTransito.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                <i className="fa-solid fa-circle-check" style={{ color: '#10b981', marginRight: '6px' }}></i>
                No hay viajes a queseras en tránsito para la fecha seleccionada.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '14px' }}>
                {salidasTransito.map((d) => {
                  const compObj = companias.find((c) => c.id === d.companiaId);
                  const camionObj = camiones.find((c) => c.id === d.camionId);
                  const nombreComp = d.nombreCompania || d.companiaNombre || compObj?.nombre || `Planta #${d.companiaId}`;
                  const placaCamion = d.camionPlaca || camionObj?.placa || 'Cisterna Planta';

                  return (
                    <div
                      key={d.id}
                      style={{
                        background: '#faf5ff',
                        border: '1px solid #f3e8ff',
                        borderRadius: '10px',
                        padding: '14px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 800, color: '#6d28d9', fontSize: '14px' }}>
                          <i className="fa-solid fa-building" style={{ color: '#9333ea', marginRight: '6px' }}></i>
                          {nombreComp}
                        </span>
                        <span className="badge" style={{ background: '#f3e8ff', color: '#7e22ce', fontWeight: 800 }}>
                          Ctrl #{d.id}
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: '#475569', display: 'flex', justifyContent: 'space-between' }}>
                        <span>
                          <i className="fa-solid fa-truck" style={{ marginRight: '4px' }}></i> {placaCamion}
                        </span>
                        <span>
                          <i className="fa-regular fa-user" style={{ marginRight: '4px' }}></i> {d.nombreConductor || 'Conductor'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', paddingTop: '8px', borderTop: '1px solid #e9d5ff' }}>
                        <span style={{ fontWeight: 900, color: '#7e22ce', fontSize: '16px' }}>
                          {(d.litrosDespachados || 0).toLocaleString()} <small style={{ fontSize: '11px', color: '#64748b' }}>Lts Salida</small>
                        </span>
                        <button
                          type="button"
                          className="btn btn-sm btn-primary"
                          onClick={() => {
                            setDespachoSeleccionado(d);
                            setLitrosConfirmadosInput(d.litrosDespachados || 0);
                            setObsConfirmacionInput('');
                            setModalConfirmar(true);
                          }}
                          style={{
                            fontSize: '11.5px',
                            fontWeight: 700,
                            padding: '4px 12px',
                            background: 'linear-gradient(135deg, #059669, #047857)',
                            border: 'none',
                            borderRadius: '6px',
                            color: '#ffffff',
                            cursor: 'pointer',
                          }}
                        >
                          <i className="fa-solid fa-check"></i> Validar Entrega
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* FORMULARIO DE CAPTURA RÁPIDA DE ENTREGAS */}
      {mostrarFormulario && (
        <div
          className="content-card"
          id="cardRegistroEntregaReceptoria"
          style={{
            marginBottom: '20px',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            borderLeft: '4px solid #3b82f6',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            background: '#ffffff',
            padding: '18px 20px',
          }}
        >
          <div style={{ marginBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#1d4ed8', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className="fa-solid fa-truck-ramp-box"></i> Registrar Entrega en Planta / Compañía
            </h3>
            <button
              type="button"
              className="btn btn-sm btn-outline"
              onClick={() => setMostrarFormulario(false)}
              style={{ height: '28px', padding: '0 8px', fontSize: '11px', borderRadius: '6px' }}
            >
              <i className="fa-solid fa-xmark"></i> Cerrar
            </button>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (formEntrega.litros === 0) {
                toast.error('Ingrese los litros entregados');
                return;
              }
              guardarEntregaMutation.mutate(formEntrega);
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '14px' }}>
              {/* Fecha */}
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px', display: 'block' }}>
                  Fecha *
                </label>
                <input
                  type="date"
                  className="form-input"
                  required
                  value={formEntrega.fecha}
                  onChange={(e) => setFormEntrega({ ...formEntrega, fecha: e.target.value })}
                  style={{ height: '38px', borderRadius: '8px' }}
                />
              </div>

              {/* Conductor */}
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px', display: 'block' }}>
                  Conductor / Operador *
                </label>
                <SearchableSelect
                  options={conductoresOptions}
                  value={formEntrega.usuarioId || ''}
                  onChange={(val) => setFormEntrega({ ...formEntrega, usuarioId: Number(val) })}
                  placeholder="-- Seleccionar Chofer --"
                  searchPlaceholder="Buscar chofer por nombre..."
                />
              </div>

              {/* Compañía / Planta */}
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px', display: 'block' }}>
                  Compañía / Planta *
                </label>
                <SearchableSelect
                  options={companiasOptions}
                  value={formEntrega.companiaId || ''}
                  onChange={(val) => setFormEntrega({ ...formEntrega, companiaId: Number(val) })}
                  placeholder="-- Seleccionar Compañía / Silo --"
                  searchPlaceholder="Buscar compañía o planta..."
                />
              </div>

              {/* Litros Entregados */}
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px', display: 'block' }}>
                  Litros Entregados *
                </label>
                <input
                  type="number"
                  className="form-input"
                  required
                  placeholder="Litros"
                  value={formEntrega.litros || ''}
                  onChange={(e) => setFormEntrega({ ...formEntrega, litros: Number(e.target.value) })}
                  style={{
                    height: '38px',
                    fontWeight: 800,
                    fontSize: '15px',
                    color: '#0369a1',
                    background: '#f0f9ff',
                    border: '1.5px solid #7dd3fc',
                    borderRadius: '8px',
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '250px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px', display: 'block' }}>
                  Observación / Ticket de Pesaje
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Ej: Ticket #8492, Guía de recepción..."
                  value={formEntrega.observacion}
                  onChange={(e) => setFormEntrega({ ...formEntrega, observacion: e.target.value })}
                  style={{ height: '38px', borderRadius: '8px' }}
                />
              </div>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={guardarEntregaMutation.isPending}
                style={{
                  height: '38px',
                  padding: '0 24px',
                  fontWeight: 700,
                  borderRadius: '8px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                  cursor: 'pointer',
                }}
              >
                <i className="fa-solid fa-floppy-disk"></i>
                {guardarEntregaMutation.isPending ? 'Guardando...' : 'Guardar Entrega'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* CARD 2: TABLA Y BUSCADOR DE ENTREGAS (3 FILTROS + MODERN TABLE) */}
      <div
        className="content-card"
        id="cardHistorialEntregas"
        style={{
          padding: 0,
          overflow: 'hidden',
          borderRadius: '12px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
          border: '1px solid #e2e8f0',
          background: '#ffffff',
          marginBottom: '24px',
        }}
      >
        {/* Cabecera Estilo Cyan Original */}
        <div
          className="card-header-styled card-header-cyan"
          style={{
            background: 'linear-gradient(135deg, #0284c7, #0369a1)',
            padding: '14px 20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '10px',
            color: '#ffffff',
          }}
        >
          <span style={{ fontWeight: 800, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="fa-solid fa-magnifying-glass"></i> BÚSQUEDA Y CONTROL DE ENTREGAS EN RECEPTORÍA
          </span>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', fontSize: '13px', flexWrap: 'wrap' }}>
            <span
              style={{
                background: 'rgba(15, 23, 42, 0.55)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                padding: '5px 12px',
                borderRadius: '8px',
                fontWeight: 600,
                color: '#ffffff',
              }}
            >
              Total del Día: <strong style={{ color: '#fde047', fontWeight: 800, fontSize: '15px' }}>{totalLitrosReceptoria.toLocaleString('es-VE')}</strong> Lts
            </span>
            <span
              style={{
                background: 'rgba(15, 23, 42, 0.55)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                padding: '5px 12px',
                borderRadius: '8px',
                fontWeight: 600,
                color: '#ffffff',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              Diferencia:{' '}
              <strong
                style={{
                  color: diferenciaBalance === 0 ? '#34d399' : diferenciaBalance < 0 ? '#f87171' : '#60a5fa',
                  fontWeight: 800,
                  fontSize: '15px',
                }}
              >
                {diferenciaBalance > 0 ? `+${diferenciaBalance.toLocaleString('es-VE')}` : diferenciaBalance.toLocaleString('es-VE')} Lts
              </strong>
            </span>
            {totalFiltradoLts !== totalLitrosReceptoria && (
              <span
                style={{
                  background: 'rgba(15, 23, 42, 0.55)',
                  border: '1px solid rgba(56, 189, 248, 0.5)',
                  padding: '5px 12px',
                  borderRadius: '8px',
                  fontWeight: 600,
                  color: '#ffffff',
                }}
              >
                Total Filtrado: <strong style={{ color: '#fde047', fontWeight: 800, fontSize: '15px' }}>{totalFiltradoLts.toLocaleString('es-VE')}</strong> Lts
              </span>
            )}
          </div>
        </div>

        {/* 3 Filtros: Fecha, Chofer, Compañía */}
        <div style={{ padding: '18px 20px 0 20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '14px' }}>
            {/* 1. Fecha */}
            <div>
              <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>
                <i className="fa-regular fa-calendar"></i> 1. Fecha de Consulta
              </label>
              <input
                type="date"
                className="form-input"
                value={filtroFecha}
                onChange={(e) => setFiltroFecha(e.target.value)}
                style={{ height: '38px', fontSize: '13px', borderRadius: '8px' }}
              />
            </div>

            {/* 2. Chofer Desplegable Buscable */}
            <div>
              <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>
                <i className="fa-solid fa-user"></i> 2. Filtrar por Chofer
              </label>
              <SearchableSelect
                options={filtroChoferOptions}
                value={filtroChoferTabla}
                onChange={(val) => {
                  setFiltroChoferTabla(val || '');
                  setCurrentPage(1);
                }}
                placeholder="TODOS LOS CHOFERES"
                searchPlaceholder="Buscar chofer en entregas..."
                allowClear={true}
              />
            </div>

            {/* 3. Compañía Desplegable Buscable */}
            <div>
              <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>
                <i className="fa-solid fa-building"></i> 3. Filtrar por Compañía
              </label>
              <SearchableSelect
                options={filtroCompaniaOptions}
                value={filtroCompaniaTabla}
                onChange={(val) => {
                  setFiltroCompaniaTabla(val || '');
                  setCurrentPage(1);
                }}
                placeholder="TODAS LAS COMPAÑÍAS"
                searchPlaceholder="Buscar planta o silo..."
                allowClear={true}
              />
            </div>
          </div>

          {/* Barra de Resumen de Filtro Dinámico */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '10px 14px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              marginBottom: '14px',
              flexWrap: 'wrap',
              gap: '8px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', fontSize: '13px' }}>
              <span style={{ color: '#64748b', fontWeight: 600 }}>
                <i className="fa-solid fa-list-check" style={{ marginRight: '6px' }}></i>
                {entregasFiltradas.length} {entregasFiltradas.length === 1 ? 'entrega encontrada' : 'entregas encontradas'}
              </span>
              {filtroChoferTabla && (
                <span style={{ color: '#0284c7', background: '#e0f2fe', padding: '3px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 700 }}>
                  Chofer: {filtroChoferTabla}
                </span>
              )}
              {filtroCompaniaTabla && (
                <span style={{ color: '#0369a1', background: '#bae6fd', padding: '3px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 700 }}>
                  Compañía: {filtroCompaniaTabla}
                </span>
              )}
            </div>

            {(filtroChoferTabla || filtroCompaniaTabla || busquedaTabla) && (
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => {
                  setFiltroChoferTabla('');
                  setFiltroCompaniaTabla('');
                  setBusquedaTabla('');
                  setCurrentPage(1);
                }}
                style={{ fontSize: '12px', padding: '4px 12px', cursor: 'pointer' }}
              >
                <i className="fa-solid fa-filter-circle-xmark"></i> Limpiar Filtros
              </button>
            )}
          </div>

          {/* Controles de Paginación y Buscador en Vivo */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#64748b' }}>
              <span>Mostrar</span>
              <select
                className="form-input"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                style={{ width: '80px', height: '32px', padding: '2px 8px', fontSize: '13px' }}
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={-1}>Todos</option>
              </select>
              <span>registros por página</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label htmlFor="buscarTablaReceptoria" style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
                Buscar:
              </label>
              <div style={{ position: 'relative', width: '220px' }}>
                <i className="fa-solid fa-search" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '12px', color: '#94a3b8' }}></i>
                <input
                  id="buscarTablaReceptoria"
                  type="text"
                  className="form-input"
                  placeholder="Compañía, chofer, litros..."
                  value={busquedaTabla}
                  onChange={(e) => {
                    setBusquedaTabla(e.target.value);
                    setCurrentPage(1);
                  }}
                  style={{ height: '32px', fontSize: '12px', paddingLeft: '30px' }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* TABLA DE ENTREGAS ORIGINAL */}
        <div className="table-responsive" style={{ margin: 0, padding: '0 20px 10px 20px', overflowX: 'auto' }}>
          <table className="modern-table" style={{ width: '100%', minWidth: '950px', borderCollapse: 'collapse', marginBottom: 0 }}>
            <thead>
              <tr>
                <th
                  onClick={() => {
                    setSortColumn('fecha');
                    setSortAsc(!sortAsc);
                  }}
                  style={{ cursor: 'pointer', userSelect: 'none', width: '110px' }}
                >
                  FECHA <i className="fa-solid fa-sort" style={{ fontSize: '11px', opacity: 0.6 }}></i>
                </th>
                <th
                  onClick={() => {
                    setSortColumn('companiaNombre');
                    setSortAsc(!sortAsc);
                  }}
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                >
                  DESTINO / COMPAÑÍA <i className="fa-solid fa-sort" style={{ fontSize: '11px', opacity: 0.6 }}></i>
                </th>
                <th
                  onClick={() => {
                    setSortColumn('conductorNombre');
                    setSortAsc(!sortAsc);
                  }}
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                >
                  CONDUCTOR <i className="fa-solid fa-sort" style={{ fontSize: '11px', opacity: 0.6 }}></i>
                </th>
                <th style={{ textAlign: 'right', width: '120px' }}>
                  VOL. ORIGEN
                </th>
                <th
                  onClick={() => {
                    setSortColumn('litros');
                    setSortAsc(!sortAsc);
                  }}
                  style={{ cursor: 'pointer', userSelect: 'none', textAlign: 'right', width: '130px' }}
                >
                  ENTREGADO <i className="fa-solid fa-sort" style={{ fontSize: '11px', opacity: 0.6 }}></i>
                </th>
                <th style={{ textAlign: 'center', width: '140px' }}>
                  MERMA / BALANCE
                </th>
                <th style={{ maxWidth: '240px', width: '220px' }}>OBSERVACIÓN</th>
                <th style={{ width: '80px', minWidth: '80px', textAlign: 'center' }}>ACCIONES</th>
              </tr>
            </thead>
            <tbody>
              {loadingEntregas ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>
                    <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '20px', marginRight: '8px' }}></i>
                    Cargando entregas de receptoría...
                  </td>
                </tr>
              ) : entregasPaginadas.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', color: '#94a3b8', padding: '36px' }}>
                    <i className="fa-solid fa-inbox" style={{ fontSize: '28px', marginBottom: '8px', display: 'block', opacity: 0.4 }}></i>
                    No hay entregas registradas para los filtros seleccionados
                  </td>
                </tr>
              ) : (
                entregasPaginadas.map((e) => {
                  const meta = clasificarEntrega(e);
                  const numLitros = Number(e.litros || e.Litros || 0);
                  const numOrigen = Number(e.totalLitrosOrigen != null ? e.totalLitrosOrigen : numLitros);
                  const difLitros = e.diferenciaLitros != null ? Number(e.diferenciaLitros) : null;
                  const pctMerma = e.porcentajeMerma != null ? Math.abs(Number(e.porcentajeMerma)) : (difLitros && numOrigen > 0 ? (Math.abs(difLitros) * 100) / numOrigen : 0);

                  return (
                    <tr
                      key={e.id}
                      style={{
                        background: meta.rowBg,
                        borderLeft: `4px solid ${meta.borderLeft}`,
                        transition: 'background 0.15s ease',
                      }}
                    >
                      {/* 1. FECHA */}
                      <td style={{ whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
                        <strong style={{ color: '#0f172a', fontSize: '13px', fontWeight: 700 }}>
                          {e.fecha ? e.fecha.split('T')[0] : ''}
                        </strong>
                      </td>

                      {/* 2. DESTINO / COMPAÑÍA */}
                      <td style={{ verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '4px' }}>
                          <span
                            className="badge"
                            style={{
                              background: meta.badgeBg,
                              color: meta.badgeColor,
                              border: `1px solid ${meta.badgeBorder}`,
                              fontWeight: 700,
                              fontSize: '10.5px',
                              padding: '2px 7px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <i className={meta.icono}></i> {meta.label}
                          </span>
                          {meta.ticketId && (
                            <span
                              className="badge"
                              style={{
                                background: '#e0f2fe',
                                color: '#0369a1',
                                border: '1px solid #7dd3fc',
                                fontWeight: 800,
                                fontSize: '11px',
                                padding: '2px 7px',
                                borderRadius: '5px',
                              }}
                            >
                              <i className="fa-solid fa-ticket"></i> Ticket #{meta.ticketId}
                            </span>
                          )}
                          {meta.ctrlCompId && (
                            <span
                              className="badge"
                              style={{
                                background: '#faf5ff',
                                color: '#7e22ce',
                                border: '1px solid #d8b4fe',
                                fontWeight: 800,
                                fontSize: '11px',
                                padding: '2px 7px',
                                borderRadius: '5px',
                              }}
                            >
                              <i className="fa-solid fa-file-invoice"></i> Ctrl #{meta.ctrlCompId}
                            </span>
                          )}
                        </div>
                        <div style={{ fontWeight: 800, color: meta.titleColor, fontSize: '13.5px' }}>
                          {e.companiaNombre || `Compañía #${e.companiaId}`}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                          <small style={{ color: '#475569', fontWeight: 600 }}>{e.encargado || meta.subLabel}</small>
                        </div>
                      </td>

                      {/* 3. CONDUCTOR */}
                      <td style={{ verticalAlign: 'middle' }}>
                        <div style={{ color: '#1e293b', fontWeight: 700, fontSize: '13px' }}>
                          <i className="fa-solid fa-user-tie" style={{ color: '#64748b', marginRight: '6px' }}></i>
                          {e.conductorNombre || 'Chofer'}
                        </div>
                      </td>

                      {/* 4. VOL. ORIGEN */}
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
                        <span style={{ fontWeight: 700, fontSize: '13.5px', color: '#475569' }}>
                          {numOrigen > 0 ? numOrigen.toLocaleString('es-VE') : '-'} <small style={{ fontSize: '10.5px', color: '#94a3b8' }}>Lts</small>
                        </span>
                      </td>

                      {/* 5. ENTREGADO */}
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
                        <span style={{ fontWeight: 800, fontSize: '14.5px', color: meta.litrosColor }}>
                          {numLitros < 0 ? '-' : numLitros > 0 ? '+' : ''}{Math.abs(numLitros).toLocaleString('es-VE')}{' '}
                          <small style={{ fontSize: '11px', color: '#475569', fontWeight: 600 }}>Lts</small>
                        </span>
                      </td>

                      {/* 6. MERMA / BALANCE */}
                      <td style={{ textAlign: 'center', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
                        {difLitros !== null ? (
                          <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                            <span
                              style={{
                                fontWeight: 800,
                                fontSize: '12px',
                                color: difLitros === 0 ? '#166534' : difLitros > 0 ? '#b45309' : '#047857',
                              }}
                            >
                              {difLitros > 0 ? `-${difLitros.toLocaleString('es-VE')} L` : difLitros < 0 ? `+${Math.abs(difLitros).toLocaleString('es-VE')} L` : '0 L'}
                            </span>
                            <span
                              className="badge"
                              style={{
                                background: pctMerma <= 3.0 ? '#ecfdf5' : '#fef2f2',
                                color: pctMerma <= 3.0 ? '#059669' : '#dc2626',
                                border: `1px solid ${pctMerma <= 3.0 ? '#a7f3d0' : '#fecaca'}`,
                                fontWeight: 800,
                                fontSize: '11px',
                              }}
                            >
                              {pctMerma.toFixed(2)}%
                            </span>
                          </div>
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: '11px', fontWeight: 600 }}>-</span>
                        )}
                      </td>

                      {/* 7. OBSERVACIÓN */}
                      <td style={{ verticalAlign: 'middle', maxWidth: '220px', paddingRight: '12px' }}>
                        <span 
                          title={e.observacion || ''}
                          style={{ 
                            color: '#475569', 
                            fontSize: '11.5px', 
                            fontWeight: 500, 
                            lineHeight: 1.35, 
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            wordBreak: 'break-word',
                            maxWidth: '220px'
                          }}
                        >
                          {e.observacion || '-'}
                        </span>
                      </td>

                      {/* 8. ACCIONES */}
                      <td style={{ textAlign: 'center', whiteSpace: 'nowrap', verticalAlign: 'middle', width: '80px', minWidth: '80px', paddingLeft: '8px' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', alignItems: 'center' }}>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline"
                            onClick={() => {
                              if (window.confirm(`¿Eliminar este registro de entrega #${e.id}?`)) {
                                eliminarEntregaMutation.mutate(e.id);
                              }
                            }}
                            title="Eliminar entrega"
                            style={{ height: '30px', width: '30px', padding: 0, borderRadius: '6px', color: '#ef4444', borderColor: '#fca5a5', background: '#fff' }}
                          >
                            <i className="fa-solid fa-trash-can" style={{ fontSize: '11px' }}></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación Inferior */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 20px',
            borderTop: '1px solid #f1f5f9',
            background: '#ffffff',
            fontSize: '12.5px',
            color: '#64748b',
            flexWrap: 'wrap',
            gap: '10px',
          }}
        >
          <div>
            Mostrando{' '}
            <strong>
              {entregasFiltradas.length === 0 ? 0 : (currentPage - 1) * (pageSize === -1 ? entregasFiltradas.length : pageSize) + 1}
            </strong>{' '}
            a{' '}
            <strong>
              {pageSize === -1 ? entregasFiltradas.length : Math.min(currentPage * pageSize, entregasFiltradas.length)}
            </strong>{' '}
            de <strong>{entregasFiltradas.length}</strong> entregas
          </div>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              style={{ height: '30px', padding: '0 10px', fontSize: '11.5px' }}
            >
              Anterior
            </button>
            <span style={{ fontWeight: 700, color: '#0f172a' }}>
              Pág. {currentPage} de {totalPages}
            </span>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              style={{ height: '30px', padding: '0 10px', fontSize: '11.5px' }}
            >
              Siguiente
            </button>
          </div>
        </div>
      </div>

      {/* MODAL NUEVO TICKET SALIDA / ENVÍO */}
      {modalNuevoDespacho && (
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
              maxWidth: '780px',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              background: '#ffffff',
              borderRadius: '16px',
              padding: 0,
              overflow: 'hidden',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
            }}
          >
            {/* Cabecera del Modal */}
            <div
              style={{
                padding: '16px 22px',
                background: 'linear-gradient(135deg, #9333ea, #7e22ce)',
                color: '#ffffff',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="fa-solid fa-truck-arrow-right"></i> Nuevo Ticket Salida a Quesera / Compañía
                </h3>
                <span style={{ fontSize: '11.5px', color: '#e9d5ff', marginTop: '2px', display: 'block' }}>
                  Despacho desde tanques de receptoría hacia plantas procesadoras (Soporta múltiples destinos)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setModalNuevoDespacho(false)}
                style={{ background: 'transparent', border: 'none', color: '#ffffff', fontSize: '18px', cursor: 'pointer', padding: '4px' }}
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (despachoCamionId === 0) {
                  toast.error('Debe seleccionar el camión cisterna asignado');
                  return;
                }
                const invalidDestino = destinosSalida.some((d) => d.companiaId === 0 || d.litrosDespachados <= 0);
                if (invalidDestino) {
                  toast.error('Todos los destinos deben tener planta seleccionada y litros mayores a 0');
                  return;
                }
                crearDespachosMultiMutation.mutate({
                  camionId: despachoCamionId,
                  usuarioId: despachoUsuarioId,
                  destinos: destinosSalida,
                });
              }}
              style={{ padding: '20px', overflowY: 'auto', flex: 1 }}
            >
              {/* SECCIÓN 1: TRANSPORTE Y CONDUCTOR */}
              <div style={{ background: '#faf5ff', border: '1.5px solid #d8b4fe', borderRadius: '12px', padding: '14px 16px', marginBottom: '18px' }}>
                <div style={{ fontSize: '12px', fontWeight: 800, color: '#6b21a8', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <i className="fa-solid fa-truck"></i> 1. Unidad de Transporte y Conductor
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
                  {/* Selector de Camión */}
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                      Camión Cisterna Asignado *
                    </label>
                    <SearchableSelect
                      options={camionesOptions}
                      value={despachoCamionId || ''}
                      onChange={(val) => {
                        const num = Number(val);
                        setDespachoCamionId(num);
                        const cMatch = camiones.find((c) => c.id === num);
                        if (cMatch && cMatch.usuarioId) {
                          setDespachoUsuarioId(cMatch.usuarioId);
                        }
                      }}
                      placeholder="-- Seleccionar Camión Cisterna --"
                      searchPlaceholder="Buscar por placa o marca..."
                    />
                  </div>

                  {/* Selector de Conductor */}
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                      Conductor Asignado *
                    </label>
                    <SearchableSelect
                      options={conductoresOptions}
                      value={despachoUsuarioId || ''}
                      onChange={(val) => setDespachoUsuarioId(Number(val))}
                      placeholder="-- Seleccionar Conductor --"
                      searchPlaceholder="Buscar por nombre de chofer..."
                    />
                  </div>
                </div>

                {despachoCamionId > 0 && (
                  <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px', color: '#7e22ce', fontWeight: 600 }}>
                    <span>
                      <i className="fa-solid fa-gauge-high"></i> Capacidad Cisterna:{' '}
                      <strong>{(camiones.find((c) => c.id === despachoCamionId)?.capacidadLitros || 0).toLocaleString()} Lts</strong>
                    </span>
                    <span>&bull;</span>
                    <span>
                      <i className="fa-solid fa-user-check"></i> Chofer Registrado:{' '}
                      <strong>{camiones.find((c) => c.id === despachoCamionId)?.choferNombre || 'Sin asignar en catálogo'}</strong>
                    </span>
                  </div>
                )}
              </div>

              {/* SECCIÓN 2: DESTINOS Y CARGAS (SOPORTE MULTI-DESTINO) */}
              <div style={{ marginBottom: '18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <i className="fa-solid fa-building-wheat" style={{ color: '#9333ea' }}></i> 2. Destinos y Plantas a Despachar
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setDestinosSalida([
                        ...destinosSalida,
                        {
                          id: String(Date.now()),
                          companiaId: 0,
                          litrosDespachados: 0,
                          tipoLeche: 'VACA',
                          numeroGuiaSADA: '',
                          observacion: '',
                        },
                      ]);
                    }}
                    style={{
                      background: 'linear-gradient(135deg, #10b981, #059669)',
                      border: 'none',
                      color: '#ffffff',
                      fontWeight: 700,
                      fontSize: '11.5px',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '5px 12px',
                      borderRadius: '6px',
                      boxShadow: '0 2px 4px rgba(16, 185, 129, 0.25)',
                    }}
                  >
                    <i className="fa-solid fa-plus"></i> + Añadir Otra Planta / Destino
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {destinosSalida.map((dest, idx) => (
                    <div
                      key={dest.id}
                      style={{
                        background: '#f8fafc',
                        border: '1.5px solid #e2e8f0',
                        borderRadius: '10px',
                        padding: '12px 14px',
                        position: 'relative',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 800, color: '#7e22ce', textTransform: 'uppercase', background: '#f3e8ff', padding: '2px 8px', borderRadius: '4px' }}>
                          Destino #{idx + 1}
                        </span>
                        {destinosSalida.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              setDestinosSalida(destinosSalida.filter((d) => d.id !== dest.id));
                            }}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: '#ef4444',
                              cursor: 'pointer',
                              fontSize: '12px',
                              fontWeight: 700,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                            title="Quitar este destino"
                          >
                            <i className="fa-solid fa-trash-can"></i> Quitar
                          </button>
                        )}
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', alignItems: 'end' }}>
                        {/* Compañía Destino */}
                        <div>
                          <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                            Planta Destino *
                          </label>
                          <SearchableSelect
                            options={companiasOptions}
                            value={dest.companiaId || ''}
                            onChange={(val) => {
                              const updated = destinosSalida.map((d) =>
                                d.id === dest.id ? { ...d, companiaId: Number(val) } : d
                              );
                              setDestinosSalida(updated);
                            }}
                            placeholder="-- Seleccionar Planta Destino --"
                            searchPlaceholder="Buscar por nombre de compañía..."
                          />
                        </div>

                        {/* Litros a Despachar */}
                        <div>
                          <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                            Litros a Despachar *
                          </label>
                          <input
                            type="number"
                            className="form-input"
                            required
                            placeholder="Litros"
                            value={dest.litrosDespachados || ''}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              const updated = destinosSalida.map((d) =>
                                d.id === dest.id ? { ...d, litrosDespachados: val } : d
                              );
                              setDestinosSalida(updated);
                            }}
                            style={{ height: '38px', fontWeight: 800, fontSize: '14.5px', color: '#7e22ce' }}
                          />
                        </div>

                        {/* Tipo de Leche (Ambos tipos SIEMPRE disponibles) */}
                        <div>
                          <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                            Tipo de Leche *
                          </label>
                          <SearchableSelect
                            options={tiposLecheOptions}
                            value={dest.tipoLeche}
                            onChange={(val) => {
                              const updated = destinosSalida.map((d) =>
                                d.id === dest.id ? { ...d, tipoLeche: val } : d
                              );
                              setDestinosSalida(updated);
                            }}
                            allowClear={false}
                          />
                        </div>

                        {/* N° Guía SADA */}
                        <div>
                          <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                            Guía SADA / Observación
                          </label>
                          <input
                            type="text"
                            className="form-input"
                            placeholder="Ej: SADA-89123..."
                            value={dest.numeroGuiaSADA}
                            onChange={(e) => {
                              const val = e.target.value;
                              const updated = destinosSalida.map((d) =>
                                d.id === dest.id ? { ...d, numeroGuiaSADA: val } : d
                              );
                              setDestinosSalida(updated);
                            }}
                            style={{ height: '38px', fontSize: '12.5px' }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* BARRA DE RESUMEN Y BALANCE DE CARGA */}
              {(() => {
                const camionSel = camiones.find((c) => c.id === despachoCamionId);
                const cap = camionSel?.capacidadLitros || 0;
                const totLitros = destinosSalida.reduce((acc, d) => acc + (Number(d.litrosDespachados) || 0), 0);
                const excede = cap > 0 && totLitros > cap;

                return (
                  <div
                    style={{
                      background: excede ? '#fef2f2' : '#f0fdf4',
                      border: `1.5px solid ${excede ? '#fca5a5' : '#86efac'}`,
                      borderRadius: '10px',
                      padding: '12px 16px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '10px',
                    }}
                  >
                    <div>
                      <span style={{ fontSize: '11.5px', color: excede ? '#991b1b' : '#166534', fontWeight: 700, textTransform: 'uppercase' }}>
                        Total a Despachar:
                      </span>
                      <strong style={{ fontSize: '17px', color: excede ? '#dc2626' : '#15803d', marginLeft: '6px' }}>
                        {totLitros.toLocaleString()} Lts
                      </strong>
                      {cap > 0 && (
                        <span style={{ fontSize: '12px', color: '#64748b', marginLeft: '8px' }}>
                          (de {cap.toLocaleString()} Lts capacidad cisterna)
                        </span>
                      )}
                    </div>
                    {excede ? (
                      <span style={{ fontSize: '12px', color: '#dc2626', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <i className="fa-solid fa-triangle-exclamation"></i> Carga excede capacidad del camión por {(totLitros - cap).toLocaleString()} Lts
                      </span>
                    ) : (
                      <span style={{ fontSize: '12px', color: '#16a34a', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <i className="fa-solid fa-circle-check"></i> Carga dentro del límite ({destinosSalida.length} destino{destinosSalida.length > 1 ? 's' : ''})
                      </span>
                    )}
                  </div>
                );
              })()}

              {/* Botones del Modal */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setModalNuevoDespacho(false)}
                  style={{ height: '40px', padding: '0 18px', fontWeight: 600 }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={crearDespachosMultiMutation.isPending}
                  style={{
                    height: '40px',
                    padding: '0 24px',
                    fontWeight: 800,
                    fontSize: '13.5px',
                    background: 'linear-gradient(135deg, #9333ea, #7e22ce)',
                    border: 'none',
                    borderRadius: '8px',
                    boxShadow: '0 4px 14px rgba(147, 51, 234, 0.35)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <i className="fa-solid fa-paper-plane"></i>
                  {crearDespachosMultiMutation.isPending
                    ? 'Emitiendo Tickets...'
                    : `Emitir ${destinosSalida.length > 1 ? `${destinosSalida.length} Tickets de Salida` : 'Ticket de Salida'}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL VALIDAR ENTREGA COMPAÑÍA */}
      {modalConfirmar && despachoSeleccionado && (
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
              maxWidth: '480px',
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
                background: 'linear-gradient(135deg, #059669, #047857)',
                color: '#ffffff',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fa-solid fa-clipboard-check"></i> Validar y Confirmar Entrega
              </h3>
              <button
                type="button"
                onClick={() => setModalConfirmar(false)}
                style={{ background: 'transparent', border: 'none', color: '#ffffff', fontSize: '16px', cursor: 'pointer' }}
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                validarMutation.mutate({
                  id: despachoSeleccionado.id,
                  litros: litrosConfirmadosInput,
                  obs: obsConfirmacionInput,
                });
              }}
              style={{ padding: '20px' }}
            >
              <p style={{ margin: '0 0 14px 0', fontSize: '13.5px', color: '#334155' }}>
                Confirmación de recepción en{' '}
                <strong>{despachoSeleccionado.nombreCompania || `Planta #${despachoSeleccionado.companiaId}`}</strong>:
              </p>

              <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', color: '#64748b' }}>
                  <span>Litros Despachados:</span>
                  <strong style={{ color: '#0f172a' }}>{despachoSeleccionado.litrosDespachados?.toLocaleString()} Lts</strong>
                </div>
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                  Litros Confirmados / Recibidos por Planta *
                </label>
                <input
                  type="number"
                  className="form-input"
                  required
                  value={litrosConfirmadosInput || ''}
                  onChange={(e) => setLitrosConfirmadosInput(Number(e.target.value))}
                  style={{ height: '40px', fontWeight: 800, fontSize: '16px', color: '#059669', background: '#ecfdf5', border: '1.5px solid #a7f3d0' }}
                />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                  Observaciones de Validación (Balanza, Acidez, etc.)
                </label>
                <textarea
                  className="form-input"
                  rows={2}
                  placeholder="Ej: Pesaje conforme según ticket #..."
                  value={obsConfirmacionInput}
                  onChange={(e) => setObsConfirmacionInput(e.target.value)}
                  style={{ width: '100%', resize: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setModalConfirmar(false)}
                  style={{ height: '38px', padding: '0 16px' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={validarMutation.isPending}
                  style={{
                    height: '38px',
                    padding: '0 20px',
                    fontWeight: 700,
                    background: 'linear-gradient(135deg, #059669, #047857)',
                    border: 'none',
                  }}
                >
                  <i className="fa-solid fa-check-double"></i>
                  {validarMutation.isPending ? 'Validando...' : 'Confirmar y Conciliar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};
