import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import Swal from 'sweetalert2';
import {
  ClipboardCheck,
  PlusCircle,
  FileSpreadsheet,
  Printer,
  RotateCw,
  Ticket as TicketIcon,
  Warehouse,
  TrendingDown,
  Truck,
  CheckCircle2,
  Calendar,
  User,
  FilterX,
  ChevronDown,
  ChevronUp,
  Pencil,
  Clock,
  ArrowRightLeft,
  RotateCcw,
  Trash2,
  X,
  Search,
} from 'lucide-react';
import { operacionesApi } from '@/api/operaciones.api';
import { catalogosApi } from '@/api/catalogos.api';
import { DataTable, type ColumnDef } from '@/components/common/DataTable';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import { CamionSelect, ChoferSelect } from '@/components/selectors';
import { useAuth } from '@/hooks/useAuth';
import type { ControlRutaDto, CamionDto, RutaLogisticaDto, FincaDto, CompaniaDto } from '@/types';

export const ViajesTicketsPage: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();

  // Filtros de fecha (por defecto últimos 30 días como en V2_3_11_26)
  const [fechaDesde, setFechaDesde] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [fechaHasta, setFechaHasta] = useState(() => new Date().toISOString().split('T')[0]);
  const [filtroChoferId, setFiltroChoferId] = useState<string>('');
  const [filtroOrigen, setFiltroOrigen] = useState<string>('');
  const [filtroProceso, setFiltroProceso] = useState<string>('');

  // Filas expandidas (Set de row keys)
  const [expandedRowKeys, setExpandedRowKeys] = useState<Set<string>>(new Set());

  // Modales
  const [modalIniciar, setModalIniciar] = useState(false);
  const [modalEditar, setModalEditar] = useState(false);
  const [ticketParaEditar, setTicketParaEditar] = useState<any | null>(null);

  // Modal Trazabilidad
  const [modalTrazabilidad, setModalTrazabilidad] = useState(false);
  const [ticketTrazabilidad, setTicketTrazabilidad] = useState<any | null>(null);
  const [tabTrazabilidad, setTabTrazabilidad] = useState<'fincas' | 'despacho' | 'entregas' | 'timeline' | 'logs'>('fincas');

  // Modal Traspaso
  const [modalTraspaso, setModalTraspaso] = useState(false);
  const [ticketParaTraspaso, setTicketParaTraspaso] = useState<any | null>(null);
  const [formTraspaso, setFormTraspaso] = useState({
    choferDestinoId: 0,
    litrosTraspaso: 0,
    observacion: '',
  });

  // Modal Agregar Finca Auditada
  const [modalAgregarFincaAuditada, setModalAgregarFincaAuditada] = useState(false);
  const [formFincaAuditada, setFormFincaAuditada] = useState({
    fincaId: 0,
    litros: 0,
    esAcida: false,
    tipoLeche: 'VACA',
    observacion: '',
  });

  // Formulario iniciar nuevo viaje
  const [formIniciar, setFormIniciar] = useState({
    fecha: new Date().toISOString().split('T')[0],
    camionId: 0,
    choferId: 0,
    rutaLogisticaId: 0,
    rutasLogisticasIds: [] as number[],
    odometroInicialKm: 0,
    observaciones: '',
  });

  // Queries
  const {
    data: viajesRutas = [],
    isLoading: isLoadingRutas,
    refetch: refetchRutas,
  } = useQuery<ControlRutaDto[]>({
    queryKey: ['control-rutas', fechaDesde, fechaHasta],
    queryFn: () => operacionesApi.getControles(undefined, undefined, undefined, fechaDesde, fechaHasta),
    refetchInterval: 10000,
  });

  const {
    data: despachosComp = [],
    isLoading: isLoadingComp,
    refetch: refetchComp,
  } = useQuery<any[]>({
    queryKey: ['control-companias', fechaDesde, fechaHasta],
    queryFn: () => operacionesApi.getDespachosCompanias(undefined, undefined, fechaDesde, fechaHasta),
    refetchInterval: 10000,
  });

  const { data: camiones = [] } = useQuery<CamionDto[]>({
    queryKey: ['camiones'],
    queryFn: () => catalogosApi.getCamiones(true),
  });

  const { data: choferes = [] } = useQuery<any[]>({
    queryKey: ['conductores'],
    queryFn: () => catalogosApi.getChoferes(),
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

  // Query fincas y entregas para el modal de trazabilidad o fila expandida
  const ticketTrazabilidadId = ticketTrazabilidad?.id;
  const esRutaTrazabilidad = ticketTrazabilidad?._origen === 'RUTA';

  const { data: fincasTrazabilidad = [], refetch: refetchFincasTraz } = useQuery({
    queryKey: ['fincas-ticket', ticketTrazabilidadId],
    queryFn: () => (ticketTrazabilidadId && esRutaTrazabilidad ? operacionesApi.getFincasViaje(ticketTrazabilidadId) : []),
    enabled: !!ticketTrazabilidadId && esRutaTrazabilidad,
  });

  const { data: entregasTrazabilidad = [] } = useQuery({
    queryKey: ['entregas-ticket', ticketTrazabilidadId],
    queryFn: () => (ticketTrazabilidadId && esRutaTrazabilidad ? operacionesApi.getEntregasViaje(ticketTrazabilidadId) : []),
    enabled: !!ticketTrazabilidadId && esRutaTrazabilidad,
  });

  const { data: historialTrazabilidad = [] } = useQuery({
    queryKey: ['historial-ticket', ticketTrazabilidadId],
    queryFn: () => (ticketTrazabilidadId && esRutaTrazabilidad ? operacionesApi.getHistorialViaje(ticketTrazabilidadId) : []),
    enabled: !!ticketTrazabilidadId && esRutaTrazabilidad,
  });

  const { data: logsTrazabilidad = [] } = useQuery({
    queryKey: ['logs-ticket', ticketTrazabilidadId],
    queryFn: () => (ticketTrazabilidadId && esRutaTrazabilidad ? operacionesApi.getLogsModificacionesViaje(ticketTrazabilidadId) : []),
    enabled: !!ticketTrazabilidadId && esRutaTrazabilidad,
  });

  // Normalización de datos 1:1 con app.js de V2_3_11_26
  const dataConsolidada = useMemo(() => {
    // Normalizar Rutas
    const listRutas = (viajesRutas || []).map((r) => {
      const pId = Number(r.procesoActualId || (r.estadoProceso === 'CERRADO' || r.estado === 'FINALIZADO' ? 4 : 1));
      const ltsFinca = Number(r.totalLitrosFinca ?? r.totalLitrosRecogidos ?? 0);
      const ltsRec = Number(r.totalLitrosReceptoria ?? (r as any).litrosRecibidosReceptoria ?? r.litrosEntregadosCompania ?? ltsFinca);
      const dif = Number(r.diferenciaLitros ?? (r as any).diferenciaReceptoria ?? (ltsRec - ltsFinca));
      const pct = ltsFinca > 0 ? (Math.abs(dif) / ltsFinca) * 100 : 0;

      return {
        ...r,
        _rowKey: `RUTA_${r.id}`,
        _origen: 'RUTA',
        _tipoLabel: 'RUTA',
        _tipoColor: '#0284c7',
        _tipoBg: '#e0f2fe',
        procesoActualId: pId,
        totalLitrosFinca: ltsFinca,
        totalLitrosReceptoria: ltsRec,
        diferenciaLitros: dif,
        mermaTotalLitros: dif,
        porcentajeMerma: pct,
        nombreConductor: r.nombreConductor || r.choferNombre || 'Conductor',
        nombreCompaniaDestino: (r as any).nombreCompaniaDestino || (r as any).companiaNombre || (r as any).tipoDestino || 'Receptoría',
        totalFincas: (r as any).totalFincas || (r as any).fincasCount || 0,
      };
    });

    // Normalizar Salidas a Compañía / Receptoría
    const listComp = (despachosComp || []).map((c) => {
      const esSubTicket = c.controlRutaId != null && Number(c.controlRutaId) > 0;
      const parentId = esSubTicket ? Number(c.controlRutaId) : null;
      const stUpper = (c.estado || '').toUpperCase();
      const pId = stUpper === 'FINALIZADO' ? 4 : stUpper === 'CAMINO A COMPAÑIA' || stUpper === 'EN VIA' ? 3 : 1;
      const ltsDesp = Number(c.litrosDespachados || 0);
      const ltsRec = c.litrosRecibidosCompania != null ? Number(c.litrosRecibidosCompania) : ltsDesp;
      const dif = c.diferenciaLitros != null ? Number(c.diferenciaLitros) : ltsDesp - ltsRec;
      const pct = c.porcentajeMerma != null ? Number(c.porcentajeMerma) : ltsDesp > 0 ? (Math.abs(dif) / ltsDesp) * 100 : 0;
      const origen = esSubTicket ? 'SUB_DESPACHO' : 'RECEPTORIA';

      return {
        ...c,
        _rowKey: `${origen}_${c.id}`,
        _origen: origen,
        _esSubTicket: esSubTicket,
        _parentTicketId: parentId,
        _tipoLabel: esSubTicket ? `SUB-TICKET #${c.id}` : 'PLANTA',
        _tipoColor: esSubTicket ? '#7e22ce' : '#9333ea',
        _tipoBg: esSubTicket ? '#f3e8ff' : '#faf5ff',
        procesoActualId: pId,
        totalLitrosFinca: ltsDesp,
        totalLitrosReceptoria: ltsRec,
        diferenciaLitros: dif,
        diferenciaReceptoria: dif,
        mermaTotalLitros: dif,
        porcentajeMerma: pct,
        nombreConductor: c.nombreUsuario || c.nombreConductor || 'Chofer',
        nombreCompaniaDestino: c.nombreCompania || 'Planta / Quesera',
        totalFincas: 0,
      };
    });

    let data = [...listRutas, ...listComp];

    // Filtros
    if (filtroOrigen) {
      if (filtroOrigen === 'RECEPTORIA') {
        data = data.filter((v) => v._origen === 'RECEPTORIA');
      } else if (filtroOrigen === 'RUTA') {
        data = data.filter((v) => v._origen === 'RUTA');
      }
    }

    if (filtroChoferId) {
      data = data.filter((v) => {
        const matchId = String(v.usuarioId || v.conductorId || '') === String(filtroChoferId);
        const matchNombre = (v.nombreConductor || '').toLowerCase().includes(String(filtroChoferId).toLowerCase());
        return matchId || matchNombre;
      });
    }

    if (filtroProceso) {
      data = data.filter((v) => Number(v.procesoActualId) === Number(filtroProceso));
    }

    return data;
  }, [viajesRutas, despachosComp, filtroOrigen, filtroChoferId, filtroProceso]);

  // Lista para la tabla principal (oculta sub-tickets que van como subfilas)
  const ticketsTablaPrincipal = useMemo(() => {
    return dataConsolidada.filter((v) => !v._esSubTicket);
  }, [dataConsolidada]);

  // Cálculos de KPIs 1:1 con app.js (L27930 - L28120)
  const kpis = useMemo(() => {
    const total = dataConsolidada.length;
    let abiertos = 0;
    let receptoria = 0;
    let entregados = 0;
    let finalizados = 0;

    let countRutas = 0;
    let ltsFincasRutas = 0;
    let ltsRecibidosRutas = 0;

    let countComp = 0;
    let ltsDespachadosComp = 0;
    let ltsRecibidosComp = 0;

    const idsRutasEnAllData = new Set(dataConsolidada.filter((v) => !v._esSubTicket).map((v) => Number(v.id)));

    dataConsolidada.forEach((v) => {
      const p = v.procesoActualId || 1;
      if (p === 1) abiertos++;
      else if (p === 2) receptoria++;
      else if (p === 3) entregados++;
      else if (p === 4) finalizados++;

      if (v._esSubTicket && v._parentTicketId && idsRutasEnAllData.has(Number(v._parentTicketId))) {
        return;
      }

      if (v._origen === 'RECEPTORIA') {
        countComp++;
        const desp = Number(v.litrosDespachados || v.totalLitrosFinca || 0);
        const rec = Number(v.litrosRecibidosCompania || v.totalLitrosReceptoria || desp);
        ltsDespachadosComp += desp;
        ltsRecibidosComp += rec;
      } else {
        countRutas++;
        const finca = Number(v.totalLitrosFinca || 0);
        const rec = Number(v.totalLitrosReceptoria || finca);
        ltsFincasRutas += finca;
        ltsRecibidosRutas += rec;
      }
    });

    let displayLtsOrigen = ltsFincasRutas;
    let displayLtsDestino = ltsRecibidosRutas;
    let displayDif = ltsRecibidosRutas - ltsFincasRutas;
    let subTotViajes = `${countRutas} Rutas · ${countComp} Despachos`;

    if (filtroOrigen === 'RECEPTORIA') {
      displayLtsOrigen = ltsDespachadosComp;
      displayLtsDestino = ltsRecibidosComp;
      displayDif = ltsRecibidosComp - ltsDespachadosComp;
      subTotViajes = `${countComp} Despachos en período`;
    } else if (filtroOrigen === 'RUTA') {
      displayLtsOrigen = ltsFincasRutas;
      displayLtsDestino = ltsRecibidosRutas;
      displayDif = ltsRecibidosRutas - ltsFincasRutas;
      subTotViajes = `${countRutas} Rutas en período`;
    }

    const absDif = Math.abs(displayDif);
    const pct = displayLtsOrigen > 0 ? ((absDif / displayLtsOrigen) * 100).toFixed(2) : '0.00';
    const efectividad = total > 0 ? ((finalizados / total) * 100).toFixed(1) : '100';

    // Días de período
    const d1 = new Date(fechaDesde);
    const d2 = new Date(fechaHasta);
    const diasPeriodo = Math.max(1, Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)) + 1);

    return {
      total,
      diasPeriodo,
      subTotViajes,
      displayLtsOrigen,
      displayLtsDestino,
      displayDif,
      absDif,
      pct,
      abiertos,
      receptoria,
      entregados,
      enProceso: abiertos + receptoria + entregados,
      finalizados,
      efectividad,
    };
  }, [dataConsolidada, filtroOrigen, fechaDesde, fechaHasta]);

  // Rangos rápidos de fecha
  const setRangoFechas = (tipo: 7 | 30 | 'mes' | '2026') => {
    const hoy = new Date();
    const hoyStr = hoy.toISOString().split('T')[0];
    setFechaHasta(hoyStr);

    if (tipo === 7) {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      setFechaDesde(d.toISOString().split('T')[0]);
    } else if (tipo === 30) {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      setFechaDesde(d.toISOString().split('T')[0]);
    } else if (tipo === 'mes') {
      const d = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      setFechaDesde(d.toISOString().split('T')[0]);
    } else if (tipo === '2026') {
      setFechaDesde('2026-01-01');
      setFechaHasta('2026-12-31');
    }
  };

  const limpiarFiltros = () => {
    setFiltroChoferId('');
    setFiltroOrigen('');
    setFiltroProceso('');
    setRangoFechas(30);
  };

  const toggleExpand = (rowKey: string) => {
    setExpandedRowKeys((prev) => {
      const next = new Set(prev);
      if (next.has(rowKey)) next.delete(rowKey);
      else next.add(rowKey);
      return next;
    });
  };

  // Mutación Iniciar Viaje
  const iniciarMutation = useMutation({
    mutationFn: (dto: typeof formIniciar) => operacionesApi.iniciarViaje(dto),
    onSuccess: (res) => {
      Swal.fire({
        icon: 'success',
        title: '¡Viaje Iniciado!',
        text: res.message || 'Viaje iniciado con éxito en el sistema.',
        confirmButtonColor: '#4f46e5',
      });
      queryClient.invalidateQueries({ queryKey: ['control-rutas'] });
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
      toast.error(err?.response?.data?.message || 'Error al iniciar viaje');
    },
  });

  // Mutación Finalizar Viaje (Admin)
  const handleFinalizarAdmin = async (ticket: any) => {
    const { value: observacion, isConfirmed } = await Swal.fire({
      title: '¿Finalizar y Auditar Viaje?',
      text: `Se cerrará el ticket #${ticket.id} y se registrará el cuadre volumétrico definitivo.`,
      input: 'text',
      inputPlaceholder: 'Nota contable de cierre (opcional)...',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, Finalizar Viaje',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#10b981',
      cancelButtonColor: '#475569',
    });

    if (!isConfirmed) return;

    try {
      await operacionesApi.finalizarViajeAdmin(ticket.id, observacion);
      Swal.fire({
        icon: 'success',
        title: '¡Viaje Finalizado!',
        text: `El ticket #${ticket.id} ha sido auditado y cerrado contablemente.`,
        timer: 2000,
        showConfirmButton: false,
      });
      queryClient.invalidateQueries({ queryKey: ['control-rutas'] });
      queryClient.invalidateQueries({ queryKey: ['control-companias'] });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Error al finalizar viaje');
    }
  };

  // Mutación Revertir Proceso (Admin)
  const handleRevertirAdmin = async (ticket: any) => {
    const { value: formValues, isConfirmed } = await Swal.fire({
      title: `Revertir Proceso — Ticket #${ticket.id}`,
      html: `
        <div style="text-align: left; font-size: 13px; color: #334155;">
          <p style="margin-bottom: 12px; color: #64748b;">
            Al revertir el proceso se reabrirá el viaje y se permitirá agregar fincas faltantes, ajustar litros o modificar entregas.
          </p>
          <div style="margin-bottom: 14px;">
            <label style="font-weight: 700; color: #0f172a; display: block; margin-bottom: 5px;">Etapa Destino:</label>
            <select id="swalSelectProcesoDestino" class="swal2-input" style="width: 100%; margin: 0; font-size: 13px; height: 40px; border-radius: 8px;">
              <option value="1">1. En Ruta / Recolección (Permite agregar fincas y corregir litros)</option>
              <option value="2">2. Llegada a Receptoría (Descarga y pesaje en silos)</option>
              <option value="3">3. Despacho / Entrega a Compañía</option>
            </select>
          </div>
          <div>
            <label style="font-weight: 700; color: #b91c1c; display: block; margin-bottom: 5px;">Motivo o Justificación * (Obligatorio para auditoría):</label>
            <textarea id="swalTextareaMotivoReversion" class="swal2-textarea" placeholder="Ej: no se agrego una finca y falto litros..." style="width: 100%; margin: 0; height: 75px; font-size: 13px; border-radius: 8px;"></textarea>
          </div>
        </div>
      `,
      focusConfirm: false,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Revertir Proceso',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#f59e0b',
      preConfirm: () => {
        const procesoDestinoId = parseInt((document.getElementById('swalSelectProcesoDestino') as HTMLSelectElement).value, 10);
        const motivo = (document.getElementById('swalTextareaMotivoReversion') as HTMLTextAreaElement).value.trim();
        if (!motivo) {
          Swal.showValidationMessage('¡El motivo de la reversión es obligatorio para el registro de auditoría!');
          return false;
        }
        return { procesoDestinoId, motivo };
      },
    });

    if (!isConfirmed || !formValues) return;

    try {
      await operacionesApi.revertirProcesoViaje(ticket.id, formValues);
      Swal.fire({
        icon: 'success',
        title: '¡Proceso Revertido!',
        text: `El ticket #${ticket.id} ha sido revertido exitosamente. Ahora puedes agregar fincas faltantes o corregir información.`,
        timer: 2500,
        showConfirmButton: true,
      });
      queryClient.invalidateQueries({ queryKey: ['control-rutas'] });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Error al revertir proceso');
    }
  };

  // Mutación Eliminar Ticket (Admin)
  const handleEliminarAdmin = async (ticket: any) => {
    const esRuta = ticket._origen === 'RUTA';
    const desc = esRuta ? `Ticket de Ruta #${ticket.id}` : `Ticket de Salida a Quesera #${ticket.id}`;

    const res = await Swal.fire({
      icon: 'warning',
      title: `¿Eliminar ${desc}?`,
      html: `<p style="color: #64748b; font-size: 13.5px;">Esta acción como <strong>ADMINISTRADOR</strong> eliminará permanentemente el ticket y sus registros vinculados.</p>`,
      showCancelButton: true,
      confirmButtonText: 'Sí, Eliminar Definitivamente',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
    });

    if (!res.isConfirmed) return;

    try {
      if (esRuta) {
        await operacionesApi.eliminarControl(ticket.id);
      } else {
        await operacionesApi.eliminarDespachoCompania(ticket.id);
      }
      toast.success(`${desc} eliminado correctamente.`);
      queryClient.invalidateQueries({ queryKey: ['control-rutas'] });
      queryClient.invalidateQueries({ queryKey: ['control-companias'] });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Error al eliminar ticket');
    }
  };

  // Imprimir Bitácora
  const handleImprimirBitacora = () => {
    window.print();
  };

  // Imprimir Comprobante Individual
  const handleImprimirComprobante = (ticket: any) => {
    const printWindow = window.open('', '_blank', 'width=800,height=750');
    if (!printWindow) return;

    const fechaStr = (ticket.fecha || '').split('T')[0];
    const ltsFinca = Number(ticket.totalLitrosFinca || ticket.litrosDespachados || 0);
    const ltsRec = Number(ticket.totalLitrosReceptoria || ticket.litrosRecibidosReceptoria || ticket.litrosRecibidosCompania || ltsFinca);
    const dif = Number(ticket.diferenciaLitros || 0);

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Comprobante de Viaje #${ticket.id}</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; margin: 25px; color: #1e293b; font-size: 12px; }
          .ticket-box { border: 2px solid #334155; border-radius: 8px; padding: 20px; max-width: 650px; margin: 0 auto; }
          .header { text-align: center; border-bottom: 2px dashed #cbd5e1; padding-bottom: 14px; margin-bottom: 14px; }
          .title { font-size: 20px; font-weight: bold; color: #1e1b4b; margin: 0; }
          .grid-info { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 15px; font-size: 12px; }
          .metric-box { display: flex; justify-content: space-between; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px 16px; margin-top: 14px; }
        </style>
      </head>
      <body>
        <div class="ticket-box">
          <div class="header">
            <h2 class="title">COMPROBANTE DE CONTROL LOGÍSTICO DE VIAJE</h2>
            <div style="font-size: 14px; font-weight: bold; color: #4338ca; margin-top: 4px;">TICKET #${ticket.id} (${ticket._origen || 'RUTA'})</div>
            <div style="color: #64748b; font-size: 11px;">Rutas de Leche &bull; Sistema Transporte V2</div>
          </div>
          <div class="grid-info">
            <div><strong>Fecha:</strong> ${fechaStr}</div>
            <div><strong>Semana:</strong> S${ticket.cicloId || '-'}</div>
            <div><strong>Conductor:</strong> ${ticket.nombreConductor || '-'}</div>
            <div><strong>Destino:</strong> ${ticket.nombreCompaniaDestino || 'Receptoría'}</div>
            <div><strong>Fincas:</strong> ${ticket.totalFincas || 0}</div>
            <div><strong>Estado:</strong> ${ticket.estado || 'FINALIZADO'}</div>
          </div>
          <div class="metric-box">
            <div>
              <div style="font-size: 11px; color: #64748b;">VOLUMEN ORIGEN</div>
              <div style="font-size: 16px; font-weight: bold; color: #0284c7;">${ltsFinca.toLocaleString('es-VE')} L</div>
            </div>
            <div>
              <div style="font-size: 11px; color: #64748b;">VOLUMEN RECIBIDO</div>
              <div style="font-size: 16px; font-weight: bold; color: #0f172a;">${ltsRec.toLocaleString('es-VE')} L</div>
            </div>
            <div>
              <div style="font-size: 11px; color: #64748b;">DIFERENCIA / MERMA</div>
              <div style="font-size: 16px; font-weight: bold; color: ${dif > 0 ? '#dc2626' : '#15803d'};">
                ${dif > 0 ? `-${dif.toLocaleString('es-VE')}` : `+${Math.abs(dif).toLocaleString('es-VE')}`} L
              </div>
            </div>
          </div>
          ${ticket.observacion ? `<div style="margin-top: 14px; font-size: 11.5px; color: #64748b;"><strong>Observaciones:</strong> ${ticket.observacion}</div>` : ''}
          <div style="margin-top: 45px; display: flex; justify-content: space-between; text-align: center; font-size: 11px;">
            <div style="border-top: 1px solid #333; width: 180px; padding-top: 4px;">Firma Conductor</div>
            <div style="border-top: 1px solid #333; width: 180px; padding-top: 4px;">Firma Receptor / Auditor</div>
          </div>
        </div>
        <script>window.onload = function() { window.print(); };</script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Abrir modal de edición
  const handleAbrirEditar = (ticket: any) => {
    setTicketParaEditar({
      ...ticket,
      fechaEdit: (ticket.fecha || '').split('T')[0],
      choferEditId: ticket.usuarioId || ticket.conductorId || 0,
      estadoEdit: ticket.estado || 'ABIERTO',
      litrosRecibidosEdit: ticket.litrosRecibidosReceptoria != null ? ticket.litrosRecibidosReceptoria : (ticket.totalLitrosReceptoria || ticket.totalLitrosFinca || 0),
      observacionEdit: ticket.observacion || '',
    });
    setModalEditar(true);
  };

  const handleGuardarEdicion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketParaEditar) return;

    try {
      const payload: any = {
        fecha: ticketParaEditar.fechaEdit,
        usuarioId: Number(ticketParaEditar.choferEditId),
        estado: ticketParaEditar.estadoEdit,
        procesoActualId: ticketParaEditar.estadoEdit === 'ABIERTO' ? 1 : ticketParaEditar.estadoEdit === 'FINALIZADO' ? 4 : 2,
        observacion: ticketParaEditar.observacionEdit,
        litrosRecibidosReceptoria: Number(ticketParaEditar.litrosRecibidosEdit),
        totalLitrosReceptoria: Number(ticketParaEditar.litrosRecibidosEdit),
      };

      if (ticketParaEditar._origen === 'RUTA') {
        await operacionesApi.editarControl(ticketParaEditar.id, payload);
      } else {
        await operacionesApi.actualizarDespachoCompania(ticketParaEditar.id, payload);
      }

      toast.success(`Ticket #${ticketParaEditar.id} actualizado exitosamente`);
      setModalEditar(false);
      queryClient.invalidateQueries({ queryKey: ['control-rutas'] });
      queryClient.invalidateQueries({ queryKey: ['control-companias'] });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Error al actualizar ticket');
    }
  };

  // Abrir modal de trazabilidad
  const handleAbrirTrazabilidad = (ticket: any) => {
    setTicketTrazabilidad(ticket);
    setTabTrazabilidad(ticket._origen === 'RUTA' ? 'fincas' : 'despacho');
    setModalTrazabilidad(true);
  };

  // Columnas de la DataTable 1:1 con la bitácora de V2_3_11_26
  const columns: ColumnDef<any>[] = [
    {
      header: '',
      width: '38px',
      cell: (row) => {
        const isExp = expandedRowKeys.has(row._rowKey);
        return (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleExpand(row._rowKey);
            }}
            className="w-6 h-6 rounded flex items-center justify-center border border-slate-300 text-slate-500 hover:bg-slate-100"
            title={isExp ? 'Ocultar desglose' : 'Ver desglose'}
          >
            {isExp ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        );
      },
    },
    {
      header: 'TICKET #',
      accessorKey: 'id',
      sortable: true,
      cell: (row) => {
        const esRuta = row._origen === 'RUTA';
        return (
          <div className="flex items-center gap-1.5 font-mono font-bold text-xs">
            <span style={{ color: esRuta ? '#4338ca' : '#9333ea' }}>#{row.id}</span>
            <span
              className="text-[10px] px-1.5 py-0.5 rounded font-extrabold"
              style={{
                backgroundColor: row._tipoBg,
                color: row._tipoColor,
              }}
            >
              {row._tipoLabel}
            </span>
          </div>
        );
      },
    },
    {
      header: 'FECHA',
      accessorKey: 'fecha',
      sortable: true,
      cell: (row) => (
        <span className="text-xs text-slate-700 font-medium">
          {(row.fecha || '').split('T')[0]}
        </span>
      ),
    },
    {
      header: 'SEMANA',
      accessorKey: 'cicloId',
      sortable: true,
      className: 'text-center',
      cell: (row) => (
        <span className="inline-block bg-indigo-50 text-indigo-700 border border-indigo-200 text-[11px] font-bold px-2 py-0.5 rounded">
          S{row.cicloId || '-'}
        </span>
      ),
    },
    {
      header: 'CONDUCTOR',
      accessorKey: 'nombreConductor',
      sortable: true,
      cell: (row) => (
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold">
            {(row.nombreConductor || 'C').charAt(0).toUpperCase()}
          </div>
          <span className="text-xs font-bold text-slate-800">{row.nombreConductor || '-'}</span>
        </div>
      ),
    },
    {
      header: 'FINCAS',
      accessorKey: 'totalFincas',
      sortable: true,
      className: 'text-center',
      cell: (row) => (
        <span className="inline-block bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold px-2 py-0.5 rounded">
          {row.totalFincas || 0}
        </span>
      ),
    },
    {
      header: 'LTS FINCA',
      accessorKey: 'totalLitrosFinca',
      sortable: true,
      className: 'text-right',
      cell: (row) => (
        <span className="font-mono font-bold text-xs text-blue-700">
          {(row.totalLitrosFinca || 0).toLocaleString()} L
        </span>
      ),
    },
    {
      header: 'DESTINO',
      accessorKey: 'nombreCompaniaDestino',
      sortable: true,
      cell: (row) => (
        <span
          className="text-[11px] font-bold px-2 py-0.5 rounded border inline-block"
          style={{
            backgroundColor: row._origen === 'RECEPTORIA' ? 'rgba(147, 51, 234, 0.1)' : 'rgba(2, 132, 199, 0.1)',
            color: row._origen === 'RECEPTORIA' ? '#7e22ce' : '#0284c7',
            borderColor: row._origen === 'RECEPTORIA' ? 'rgba(147, 51, 234, 0.3)' : 'rgba(2, 132, 199, 0.3)',
          }}
        >
          {row.nombreCompaniaDestino || 'Receptoría'}
        </span>
      ),
    },
    {
      header: 'LTS REC.',
      accessorKey: 'totalLitrosReceptoria',
      sortable: true,
      className: 'text-right',
      cell: (row) => (
        <span className="font-mono font-semibold text-xs text-slate-700">
          {(row.totalLitrosReceptoria || 0).toLocaleString()} L
        </span>
      ),
    },
    {
      header: 'DIFERENCIA',
      accessorKey: 'diferenciaLitros',
      sortable: true,
      className: 'text-right',
      cell: (row) => {
        const dif = Number(row.diferenciaLitros || 0);
        return (
          <span
            className={`font-mono font-bold text-xs ${
              dif < 0 ? 'text-red-600' : dif > 0 ? 'text-emerald-600' : 'text-slate-500'
            }`}
          >
            {dif !== 0 ? (dif > 0 ? `+${dif.toLocaleString()}` : dif.toLocaleString()) : '0 L'}
          </span>
        );
      },
    },
    {
      header: '% MERMA',
      accessorKey: 'porcentajeMerma',
      sortable: true,
      className: 'text-center',
      cell: (row) => {
        const pct = Number(row.porcentajeMerma || 0);
        const esPerdida = Number(row.diferenciaLitros || 0) < 0;
        return (
          <span
            className={`text-[10.5px] font-bold px-2 py-0.5 rounded border ${
              esPerdida && pct > 1.0
                ? 'bg-red-50 text-red-700 border-red-200'
                : esPerdida
                ? 'bg-amber-50 text-amber-700 border-amber-200'
                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
            }`}
          >
            {esPerdida ? `-${pct.toFixed(2)}%` : `+${pct.toFixed(2)}%`}
          </span>
        );
      },
    },
    {
      header: 'MERMA TOTAL',
      accessorKey: 'mermaTotalLitros',
      sortable: true,
      className: 'text-right',
      cell: (row) => {
        const merma = Number(row.mermaTotalLitros || row.diferenciaLitros || 0);
        return (
          <span
            className={`font-mono font-extrabold text-xs ${
              merma < 0 ? 'text-red-600' : merma > 0 ? 'text-emerald-600' : 'text-slate-500'
            }`}
          >
            {merma < 0 ? `${merma.toLocaleString()} L` : merma > 0 ? `+${merma.toLocaleString()} L` : '0 L'}
          </span>
        );
      },
    },
    {
      header: 'ESTADO',
      accessorKey: 'procesoActualId',
      sortable: true,
      className: 'text-center',
      cell: (row) => {
        const pId = row.procesoActualId || 1;
        if (pId === 1) {
          return (
            <span className="badge bg-blue-50 text-blue-700 border border-blue-200 font-bold text-[11px] px-2 py-0.5 rounded-full">
              1: En Ruta
            </span>
          );
        } else if (pId === 2) {
          return (
            <span className="badge bg-amber-50 text-amber-700 border border-amber-200 font-bold text-[11px] px-2 py-0.5 rounded-full">
              2: Recibido
            </span>
          );
        } else if (pId === 3) {
          return (
            <span className="badge bg-purple-50 text-purple-700 border border-purple-200 font-bold text-[11px] px-2 py-0.5 rounded-full">
              3: En Quesera
            </span>
          );
        }
        return (
          <span className="badge bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[11px] px-2 py-0.5 rounded-full">
            4: Finalizado
          </span>
        );
      },
    },
    {
      header: 'ACCIONES',
      className: 'text-center',
      cell: (row) => {
        const esAdmin = isAdmin || (user?.rol || '').toUpperCase().includes('ADMIN');
        const pId = row.procesoActualId || 1;
        const esRuta = row._origen === 'RUTA';

        return (
          <div className="flex items-center justify-center gap-1">
            <button
              type="button"
              onClick={() => handleAbrirEditar(row)}
              className="p-1.5 text-amber-600 hover:bg-amber-50 rounded border border-amber-200 transition-colors"
              title={`Editar Ticket #${row.id}`}
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => handleAbrirTrazabilidad(row)}
              className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded border border-indigo-200 transition-colors"
              title="Ver Trazabilidad y Auditoría"
            >
              <Clock className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => handleImprimirComprobante(row)}
              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded border border-blue-200 transition-colors"
              title="Imprimir Comprobante de Viaje"
            >
              <Printer className="w-3.5 h-3.5" />
            </button>

            {esAdmin && pId !== 4 && esRuta && (
              <button
                type="button"
                onClick={() => handleFinalizarAdmin(row)}
                className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded border border-emerald-200 transition-colors"
                title="Finalizar y Auditar Viaje"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
              </button>
            )}

            {esAdmin && esRuta && (
              <button
                type="button"
                onClick={() => handleRevertirAdmin(row)}
                className="p-1.5 text-indigo-500 hover:bg-indigo-50 rounded border border-indigo-200 transition-colors"
                title="Revertir / Reabrir Proceso de Viaje"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}

            {esAdmin && (
              <button
                type="button"
                onClick={() => handleEliminarAdmin(row)}
                className="p-1.5 text-red-600 hover:bg-red-50 rounded border border-red-200 transition-colors"
                title="Eliminar Ticket"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        );
      },
    },
  ];

  // Sub-fila expandida con fincas y sub-despachos asociados
  const renderSubRow = (row: any) => {
    const subDespachos = dataConsolidada.filter((x) => x._esSubTicket && Number(x._parentTicketId) === Number(row.id));

    return (
      <div className="p-4 bg-slate-50 border-y border-slate-200 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <i className="fa-solid fa-cow text-blue-600 text-sm"></i>
            <span className="text-xs font-bold text-slate-800">
              Desglose de Fincas y Trazabilidad — Ticket #{row.id}
            </span>
            <span className="text-xs text-gray-500">
              (Fecha: {(row.fecha || '').split('T')[0]} | Conductor: {row.nombreConductor})
            </span>
          </div>

          <button
            type="button"
            onClick={() => handleAbrirTrazabilidad(row)}
            className="btn btn-sm text-xs font-bold h-7 px-2.5 bg-white border border-slate-300 text-indigo-600 rounded hover:bg-indigo-50"
          >
            Ver Historial Completo
          </button>
        </div>

        {row.observacion && (
          <div className="p-2.5 bg-white border-l-4 border-indigo-600 rounded text-xs text-slate-600">
            <strong>Observaciones:</strong> {row.observacion}
          </div>
        )}

        {/* Sub-despachos asociados si existen */}
        {subDespachos.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-dashed border-slate-300">
            <span className="text-xs font-bold text-purple-800 flex items-center gap-1.5">
              <ArrowRightLeft className="w-3.5 h-3.5 text-purple-600" />
              Sub-Despachos a Queseras ({subDespachos.length}):
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {subDespachos.map((st) => (
                <div
                  key={st.id}
                  className="p-2.5 bg-purple-50 border border-purple-200 rounded-lg flex justify-between items-center"
                >
                  <div>
                    <span className="font-bold text-purple-900 block">Sub #{st.id} — {st.nombreCompaniaDestino}</span>
                    <span className="text-gray-500 text-[11px]">
                      Despacho: {Number(st.totalLitrosFinca).toLocaleString()} L &rarr; Recibido: {Number(st.totalLitrosReceptoria).toLocaleString()} L
                    </span>
                  </div>
                  <span className="font-mono font-bold text-purple-700">
                    {st.diferenciaLitros} L
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Footer con sumatorias de la vista
  const renderFooter = (filtered: any[]) => {
    let sumFincas = 0;
    let sumLtsFinca = 0;
    let sumLtsRec = 0;
    let sumDif = 0;
    let sumMerma = 0;

    filtered.forEach((v) => {
      sumFincas += v.totalFincas || 0;
      sumLtsFinca += v.totalLitrosFinca || 0;
      sumLtsRec += v.totalLitrosReceptoria || 0;
      sumDif += v.diferenciaLitros || 0;
      sumMerma += v.mermaTotalLitros || 0;
    });

    const pctMerma = sumLtsFinca > 0 ? ((Math.abs(sumMerma) / sumLtsFinca) * 100).toFixed(2) : '0.00';

    return (
      <tr>
        <td colSpan={5} className="text-right uppercase tracking-wider text-xs p-3">
          Totales del Período Filtrado ({filtered.length} viajes):
        </td>
        <td className="text-center p-3">{sumFincas.toLocaleString()}</td>
        <td className="text-right p-3 text-blue-700 font-mono">{sumLtsFinca.toLocaleString()} L</td>
        <td className="text-center p-3">-</td>
        <td className="text-right p-3 text-slate-800 font-mono">{sumLtsRec.toLocaleString()} L</td>
        <td className={`text-right p-3 font-mono ${sumDif < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
          {sumDif < 0 ? `${sumDif.toLocaleString()} L` : `+${sumDif.toLocaleString()} L`}
        </td>
        <td className="text-center p-3 text-xs">{pctMerma}%</td>
        <td className={`text-right p-3 font-mono ${sumMerma < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
          {sumMerma < 0 ? `${sumMerma.toLocaleString()} L` : `+${sumMerma.toLocaleString()} L`}
        </td>
        <td colSpan={2} className="text-center p-3 text-emerald-700 font-bold">
          Auditado
        </td>
      </tr>
    );
  };

  return (
    <div className="space-y-6">
      {/* 1. VIEW HEADER 1:1 CON V2_3_11_26 */}
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4 p-4 bg-white rounded-2xl shadow-sm border border-gray-200">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5 text-indigo-600" />
              Control Logístico de Viajes y Tickets
            </h1>
            <span className="badge bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-bold px-2.5 py-0.5 rounded-full">
              Sistema V2
            </span>
          </div>
          <p className="text-xs text-gray-500">
            Monitoreo en tiempo real del ciclo de vida de recolección, recepción, destino y liquidación volumétrica
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleImprimirBitacora}
            className="btn btn-outline text-xs font-bold h-9 px-3 flex items-center gap-1.5 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50"
          >
            <Printer className="w-4 h-4 text-indigo-600" /> Imprimir
          </button>

          <button
            type="button"
            onClick={() => setModalIniciar(true)}
            className="btn text-xs font-bold h-9 px-4 flex items-center gap-1.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white rounded-lg shadow-sm"
          >
            <PlusCircle className="w-4 h-4" /> Iniciar Nuevo Viaje
          </button>

          <button
            type="button"
            onClick={() => {
              refetchRutas();
              refetchComp();
            }}
            className="btn btn-outline text-xs font-bold h-9 px-3 flex items-center gap-1.5 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isLoadingRutas || isLoadingComp ? 'animate-spin' : ''}`} /> Actualizar
          </button>
        </div>
      </div>

      {/* 2. TARJETAS KPI REDISEÑADAS CON GLASSMORPHISM (6 TARJETAS EXACTAS DE V2_3_11_26) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3.5">
        {/* TOTAL VIAJES */}
        <div className="bg-gradient-to-br from-blue-50/70 to-indigo-50/50 border border-blue-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-extrabold text-blue-900 uppercase">TOTAL VIAJES</span>
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
              <TicketIcon className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-black text-slate-900">{kpis.total}</h3>
          <span className="text-[11px] font-semibold text-blue-600 mt-1 block">
            {kpis.diasPeriodo} días en período
          </span>
        </div>

        {/* VOLUMEN FINCAS */}
        <div className="bg-gradient-to-br from-emerald-50/70 to-teal-50/50 border border-emerald-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-extrabold text-emerald-900 uppercase">VOLUMEN FINCAS</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <i className="fa-solid fa-cow text-sm"></i>
            </div>
          </div>
          <h3 className="text-2xl font-black text-emerald-700">{kpis.displayLtsOrigen.toLocaleString()} L</h3>
          <span className="text-[11px] font-semibold text-emerald-600 mt-1 block">
            Recolectado en ruta
          </span>
        </div>

        {/* VOLUMEN RECIBIDO */}
        <div className="bg-gradient-to-br from-cyan-50/70 to-sky-50/50 border border-cyan-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-extrabold text-cyan-900 uppercase">VOLUMEN RECIBIDO</span>
            <div className="w-8 h-8 rounded-lg bg-cyan-100 text-cyan-600 flex items-center justify-center">
              <Warehouse className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-black text-cyan-700">{kpis.displayLtsDestino.toLocaleString()} L</h3>
          <span className="text-[11px] font-semibold text-cyan-600 mt-1 block">
            En Receptoría / Planta
          </span>
        </div>

        {/* MERMA GLOBAL */}
        <div className="bg-white border-2 border-amber-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-extrabold text-amber-900 uppercase">MERMA GLOBAL</span>
            <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-black text-amber-600">
            {kpis.displayDif < 0 ? `-${kpis.absDif.toLocaleString()} L` : `+${kpis.absDif.toLocaleString()} L`}
          </h3>
          <span className="text-[11px] font-bold text-amber-600 mt-1 block">
            {kpis.pct}% del volumen
          </span>
        </div>

        {/* EN PROCESO */}
        <div className="bg-gradient-to-br from-amber-50/70 to-yellow-50/50 border border-amber-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-extrabold text-amber-900 uppercase">EN PROCESO</span>
            <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-black text-amber-600">{kpis.enProceso}</h3>
          <span className="text-[10px] font-semibold text-amber-700 mt-1 block">
            {kpis.abiertos} Ruta | {kpis.receptoria} Rec. | {kpis.entregados} Dest.
          </span>
        </div>

        {/* FINALIZADOS */}
        <div className="bg-gradient-to-br from-emerald-50/70 to-green-50/50 border border-emerald-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-extrabold text-emerald-900 uppercase">FINALIZADOS</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-black text-emerald-600">{kpis.finalizados}</h3>
          <span className="text-[11px] font-semibold text-emerald-600 mt-1 block">
            {kpis.efectividad}% completados
          </span>
        </div>
      </div>

      {/* 3. CONTENEDOR DATATABLE PROFESIONAL */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        {/* HEADER BANNER */}
        <div className="bg-gradient-to-r from-slate-900 to-indigo-950 p-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-indigo-300 text-lg">
              <ClipboardCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold tracking-wide uppercase">
                Bitácora General de Viajes y Trazabilidad
              </h3>
              <p className="text-xs text-slate-300">
                Historial consolidado con búsqueda, ordenamiento y paginación en tiempo real
              </p>
            </div>
          </div>

          <span className="bg-slate-800/80 border border-white/20 px-3 py-1 rounded-lg text-xs font-semibold">
            Total Registros: <strong className="text-cyan-400 font-mono">{ticketsTablaPrincipal.length}</strong>
          </span>
        </div>

        {/* BARRA DE FILTROS RÁPIDOS Y RANGO DE FECHAS */}
        <div className="bg-slate-50 border-b border-slate-200 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 flex-wrap text-xs">
              <span className="font-bold text-slate-500 uppercase mr-1">Período rápido:</span>
              <button
                type="button"
                onClick={() => setRangoFechas(7)}
                className="px-2.5 py-1 bg-white border border-slate-300 rounded font-semibold text-slate-700 hover:bg-slate-50"
              >
                Últimos 7 días
              </button>
              <button
                type="button"
                onClick={() => setRangoFechas(30)}
                className="px-2.5 py-1 bg-white border border-slate-300 rounded font-semibold text-slate-700 hover:bg-slate-50"
              >
                Últimos 30 días
              </button>
              <button
                type="button"
                onClick={() => setRangoFechas('mes')}
                className="px-2.5 py-1 bg-white border border-slate-300 rounded font-semibold text-slate-700 hover:bg-slate-50"
              >
                Este Mes
              </button>
              <button
                type="button"
                onClick={() => setRangoFechas('2026')}
                className="px-2.5 py-1 bg-white border border-slate-300 rounded font-semibold text-slate-700 hover:bg-slate-50"
              >
                Todo 2026
              </button>
            </div>

            <button
              type="button"
              onClick={limpiarFiltros}
              className="text-xs font-bold text-red-600 hover:text-red-700 flex items-center gap-1 bg-white border border-slate-300 px-2.5 py-1 rounded"
            >
              <FilterX className="w-3.5 h-3.5" /> Limpiar Filtros
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
            <div>
              <label className="block font-bold text-slate-600 uppercase mb-1">Fecha Desde</label>
              <input
                type="date"
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
                className="form-input w-full h-9 rounded-lg border border-slate-300 px-2 font-bold text-slate-800"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-600 uppercase mb-1">Fecha Hasta</label>
              <input
                type="date"
                value={fechaHasta}
                onChange={(e) => setFechaHasta(e.target.value)}
                className="form-input w-full h-9 rounded-lg border border-slate-300 px-2 font-bold text-slate-800"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-600 uppercase mb-1">Conductor</label>
              <SearchableSelect
                options={[
                  { value: '', label: 'TODOS LOS CONDUCTORES' },
                  ...choferes.map((c: any) => ({
                    value: String(c.id || c.usuarioId),
                    label: c.nombreCompleto || c.nombre || `Chofer #${c.id}`,
                  })),
                ]}
                value={filtroChoferId}
                onChange={(val) => setFiltroChoferId(String(val || ''))}
                placeholder="TODOS LOS CONDUCTORES"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-600 uppercase mb-1">Origen / Módulo</label>
              <select
                value={filtroOrigen}
                onChange={(e) => setFiltroOrigen(e.target.value)}
                className="form-select w-full h-9 rounded-lg border border-slate-300 px-2 font-bold text-slate-800 bg-white"
              >
                <option value="">-- Todos los Orígenes --</option>
                <option value="RUTA">🚚 Rutas / Recolecciones</option>
                <option value="RECEPTORIA">🏢 Receptorías / Despachos Salidas</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-600 uppercase mb-1">Estado / Proceso</label>
              <select
                value={filtroProceso}
                onChange={(e) => setFiltroProceso(e.target.value)}
                className="form-select w-full h-9 rounded-lg border border-slate-300 px-2 font-bold text-slate-800 bg-white"
              >
                <option value="">-- Todos los Estados --</option>
                <option value="1">1: Abierto (Chofer en ruta)</option>
                <option value="2">2: Recibido (En Receptoría)</option>
                <option value="3">3: Entregado (En Quesera / Camino)</option>
                <option value="4">4: Finalizado (Auditado)</option>
              </select>
            </div>
          </div>
        </div>

        {/* TABLA PRINCIPAL MEDIANTE <DataTable /> REGLA 2 */}
        <DataTable
          data={ticketsTablaPrincipal}
          columns={columns}
          isLoading={isLoadingRutas || isLoadingComp}
          searchPlaceholder="Buscar ticket, conductor, destino..."
          exportFileName={`Bitacora_Control_Viajes_${fechaDesde}_al_${fechaHasta}`}
          pageSizeDefault={25}
          isRowExpanded={(row) => expandedRowKeys.has(row._rowKey)}
          renderSubRow={renderSubRow}
          footerContent={renderFooter}
        />
      </div>

      {/* 4. MODAL INICIAR NUEVO VIAJE DIRECTO */}
      {modalIniciar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <Truck className="w-5 h-5 text-indigo-600" />
                Iniciar Nuevo Viaje / Ticket
              </h3>
              <button
                type="button"
                onClick={() => setModalIniciar(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!formIniciar.camionId || !formIniciar.choferId) {
                  toast.error('Debe seleccionar camión y conductor');
                  return;
                }
                iniciarMutation.mutate({
                  ...formIniciar,
                  rutaLogisticaId: formIniciar.rutasLogisticasIds[0] || formIniciar.rutaLogisticaId || 0,
                });
              }}
              className="space-y-4 text-xs"
            >
              <div>
                <label className="block font-bold text-slate-700 mb-1">Fecha de Operación *</label>
                <input
                  type="date"
                  value={formIniciar.fecha}
                  onChange={(e) => setFormIniciar({ ...formIniciar, fecha: e.target.value })}
                  className="form-input w-full h-9 rounded-lg border border-slate-300 px-2 font-bold text-slate-800"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Unidad Cisterna *</label>
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

              <div>
                <label className="block font-bold text-slate-700 mb-1">Conductor Asignado *</label>
                <ChoferSelect
                  value={formIniciar.choferId || undefined}
                  onChange={(val) => setFormIniciar((prev) => ({ ...prev, choferId: Number(val || 0) }))}
                  placeholder="-- Seleccionar Chofer --"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Rutas Logísticas (Múltiple Selección)
                </label>
                <div className="max-h-36 overflow-y-auto border border-slate-200 rounded-lg p-2 bg-slate-50 space-y-1.5">
                  {rutasLogistica.map((r) => {
                    const isChecked = formIniciar.rutasLogisticasIds.includes(r.id);
                    return (
                      <label
                        key={r.id}
                        className={`flex items-center justify-between p-2 rounded-lg border cursor-pointer text-xs ${
                          isChecked ? 'bg-indigo-50 border-indigo-300' : 'bg-white border-slate-200'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormIniciar((p) => ({
                                  ...p,
                                  rutasLogisticasIds: [...p.rutasLogisticasIds, r.id],
                                }));
                              } else {
                                setFormIniciar((p) => ({
                                  ...p,
                                  rutasLogisticasIds: p.rutasLogisticasIds.filter((id) => id !== r.id),
                                }));
                              }
                            }}
                            className="rounded text-indigo-600"
                          />
                          <span className="font-bold text-slate-800">{r.nombre}</span>
                        </div>
                        <span className="text-gray-500 text-[11px]">
                          {r.totalFincas || 0} fincas &bull; ~{((r.totalFincas || 0) * 300).toLocaleString()} L
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Odómetro Inicial (Km)</label>
                <input
                  type="number"
                  value={formIniciar.odometroInicialKm || ''}
                  onChange={(e) => setFormIniciar({ ...formIniciar, odometroInicialKm: Number(e.target.value) })}
                  placeholder="Ej: 145000"
                  className="form-input w-full h-9 rounded-lg border border-slate-300 px-2"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Observaciones</label>
                <input
                  type="text"
                  value={formIniciar.observaciones}
                  onChange={(e) => setFormIniciar({ ...formIniciar, observaciones: e.target.value })}
                  placeholder="Instrucciones del viaje..."
                  className="form-input w-full h-9 rounded-lg border border-slate-300 px-2"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setModalIniciar(false)}
                  className="btn btn-outline h-9 px-4 rounded-lg text-slate-600"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={iniciarMutation.isPending}
                  className="btn h-9 px-5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg"
                >
                  {iniciarMutation.isPending ? 'Iniciando...' : 'Iniciar Viaje'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. MODAL EDITAR TICKET POR ADMIN 1:1 */}
      {modalEditar && ticketParaEditar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <Pencil className="w-5 h-5 text-amber-600" />
                Editar Ticket #{ticketParaEditar.id} ({ticketParaEditar._origen})
              </h3>
              <button
                type="button"
                onClick={() => setModalEditar(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleGuardarEdicion} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Fecha</label>
                  <input
                    type="date"
                    value={ticketParaEditar.fechaEdit}
                    onChange={(e) => setTicketParaEditar({ ...ticketParaEditar, fechaEdit: e.target.value })}
                    className="form-input w-full h-9 rounded-lg border border-slate-300 px-2 font-bold"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Estado</label>
                  <select
                    value={ticketParaEditar.estadoEdit}
                    onChange={(e) => setTicketParaEditar({ ...ticketParaEditar, estadoEdit: e.target.value })}
                    className="form-select w-full h-9 rounded-lg border border-slate-300 px-2 font-bold bg-white"
                  >
                    <option value="ABIERTO">1: EN RUTA (ABIERTO)</option>
                    <option value="RECEPCIONADO">2: RECEPCIONADO</option>
                    <option value="FINALIZADO">3: FINALIZADO</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Conductor Responsable</label>
                <ChoferSelect
                  value={ticketParaEditar.choferEditId || undefined}
                  onChange={(val) => setTicketParaEditar({ ...ticketParaEditar, choferEditId: Number(val || 0) })}
                  placeholder="-- Conductor asignado --"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Litros en Fincas / Origen</label>
                  <input
                    type="text"
                    readOnly
                    value={`${Number(ticketParaEditar.totalLitrosFinca || 0).toLocaleString()} L`}
                    className="form-input w-full h-9 rounded-lg border border-slate-200 bg-slate-50 px-2 font-bold text-slate-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Recibido en Receptoría</label>
                  <input
                    type="number"
                    value={ticketParaEditar.litrosRecibidosEdit || ''}
                    onChange={(e) => setTicketParaEditar({ ...ticketParaEditar, litrosRecibidosEdit: Number(e.target.value) })}
                    className="form-input w-full h-9 rounded-lg border border-slate-300 px-2 font-bold text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Observación</label>
                <input
                  type="text"
                  value={ticketParaEditar.observacionEdit}
                  onChange={(e) => setTicketParaEditar({ ...ticketParaEditar, observacionEdit: e.target.value })}
                  placeholder="Nota u observación del ticket..."
                  className="form-input w-full h-9 rounded-lg border border-slate-300 px-2"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setModalEditar(false)}
                  className="btn btn-outline h-9 px-4 rounded-lg text-slate-600"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn h-9 px-5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. MODAL TRAZABILIDAD COMPLETA 1:1 CON TABS */}
      {modalTrazabilidad && ticketTrazabilidad && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-extrabold text-slate-900">
                    Trazabilidad del Ticket #{ticketTrazabilidad.id}
                  </h3>
                  <span className="badge bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-bold px-2 py-0.5 rounded">
                    {ticketTrazabilidad._tipoLabel}
                  </span>
                </div>
                <p className="text-xs text-gray-500">
                  Fecha: {(ticketTrazabilidad.fecha || '').split('T')[0]} &bull; Conductor: {ticketTrazabilidad.nombreConductor}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setModalTrazabilidad(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Pestañas de Trazabilidad */}
            <div className="flex gap-2 border-b border-slate-200 pb-2 text-xs font-bold">
              {ticketTrazabilidad._origen === 'RUTA' && (
                <button
                  type="button"
                  onClick={() => setTabTrazabilidad('fincas')}
                  className={`px-3 py-1.5 rounded-lg transition-colors ${
                    tabTrazabilidad === 'fincas' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Fincas ({fincasTrazabilidad.length})
                </button>
              )}
              {ticketTrazabilidad._origen === 'RECEPTORIA' && (
                <button
                  type="button"
                  onClick={() => setTabTrazabilidad('despacho')}
                  className={`px-3 py-1.5 rounded-lg transition-colors ${
                    tabTrazabilidad === 'despacho' ? 'bg-purple-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Despacho
                </button>
              )}
              <button
                type="button"
                onClick={() => setTabTrazabilidad('entregas')}
                className={`px-3 py-1.5 rounded-lg transition-colors ${
                  tabTrazabilidad === 'entregas' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Entregas / Descargas ({entregasTrazabilidad.length})
              </button>
              <button
                type="button"
                onClick={() => setTabTrazabilidad('timeline')}
                className={`px-3 py-1.5 rounded-lg transition-colors ${
                  tabTrazabilidad === 'timeline' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Línea de Tiempo ({historialTrazabilidad.length})
              </button>
              <button
                type="button"
                onClick={() => setTabTrazabilidad('logs')}
                className={`px-3 py-1.5 rounded-lg transition-colors ${
                  tabTrazabilidad === 'logs' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Auditoría / Logs ({logsTrazabilidad.length})
              </button>
            </div>

            {/* Contenido Pestañas */}
            {tabTrazabilidad === 'fincas' && (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-700">Fincas Recolectadas:</span>
                  <button
                    type="button"
                    onClick={() => setModalAgregarFincaAuditada(true)}
                    className="btn btn-sm text-xs font-bold h-7 px-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded"
                  >
                    + Agregar Finca Faltante
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {fincasTrazabilidad.map((f: any, idx: number) => (
                    <div
                      key={idx}
                      className="p-3 bg-white border border-slate-200 rounded-xl flex justify-between items-center text-xs shadow-2xs"
                    >
                      <div>
                        <span className="text-gray-400 font-bold block text-[11px]">#{idx + 1} &bull; {f.propietarioNombre || f.propietario}</span>
                        <strong className="text-slate-900 block font-bold">{f.fincaNombre || f.finca}</strong>
                        <span className="text-[10.5px] text-gray-500">{f.tipoLeche || 'VACA'} &bull; {f.esAcida ? 'ÁCIDA' : 'DULCE'}</span>
                      </div>
                      <span className="font-mono font-extrabold text-blue-700 text-sm">
                        {Number(f.litros || f.litrosLeche || 0).toLocaleString()} L
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tabTrazabilidad === 'entregas' && (
              <div className="space-y-2">
                {entregasTrazabilidad.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-6">No hay entregas registradas aún.</p>
                ) : (
                  entregasTrazabilidad.map((e: any, idx: number) => (
                    <div
                      key={idx}
                      className="p-3 bg-emerald-50/50 border border-emerald-200 rounded-xl flex justify-between items-center text-xs"
                    >
                      <div>
                        <strong className="text-emerald-900 block font-bold">{e.companiaNombre || 'Planta'}</strong>
                        <span className="text-gray-500 text-[11px]">Ticket / Guía: {e.ticketReceptoria || '-'}</span>
                      </div>
                      <span className="font-mono font-bold text-emerald-700 text-sm">
                        {Number(e.litrosEntregados || 0).toLocaleString()} L
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}

            {tabTrazabilidad === 'timeline' && (
              <div className="space-y-3 py-2">
                {historialTrazabilidad.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-6">Sin historial de transiciones.</p>
                ) : (
                  historialTrazabilidad.map((h: any, idx: number) => (
                    <div key={idx} className="flex gap-3 text-xs items-start">
                      <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-[11px] shrink-0">
                        {idx + 1}
                      </div>
                      <div className="flex-1 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                        <div className="flex justify-between font-bold text-slate-800">
                          <span>{h.procesoNuevoNombre || h.proceso || 'Transición de estado'}</span>
                          <span className="text-gray-400 font-normal text-[11px]">{new Date(h.fecha).toLocaleString()}</span>
                        </div>
                        <span className="text-gray-600 block mt-0.5">{h.observacion || 'Sin observaciones'}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {tabTrazabilidad === 'logs' && (
              <div className="space-y-2 py-2">
                {logsTrazabilidad.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-6">No hay modificaciones auditadas registradas.</p>
                ) : (
                  logsTrazabilidad.map((l: any, idx: number) => (
                    <div key={idx} className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                      <div className="flex justify-between text-slate-800 font-bold">
                        <span>{l.accion || 'Modificación'} por {l.usuarioNombre || 'Admin'}</span>
                        <span className="text-gray-400 text-[11px]">{new Date(l.createdAt).toLocaleString()}</span>
                      </div>
                      <p className="text-gray-600 mt-1">{l.detalles || l.motivo}</p>
                    </div>
                  ))
                )}
              </div>
            )}

            <div className="flex justify-end pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setModalTrazabilidad(false)}
                className="btn btn-outline h-9 px-4 rounded-lg text-slate-700 font-bold text-xs"
              >
                Cerrar Ventana
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. MODAL AGREGAR FINCA AUDITADA */}
      {modalAgregarFincaAuditada && ticketTrazabilidad && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <i className="fa-solid fa-cow text-blue-600 text-base"></i>
                Agregar Finca Faltante (Auditado)
              </h3>
              <button
                type="button"
                onClick={() => setModalAgregarFincaAuditada(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!formFincaAuditada.fincaId || formFincaAuditada.litros <= 0) {
                  toast.error('Selecciona la finca e indica los litros');
                  return;
                }

                const { value: motivo, isConfirmed } = await Swal.fire({
                  title: 'Motivo de Inclusión de Finca',
                  text: 'Indique la justificación para registrar esta finca faltante en el ticket:',
                  input: 'textarea',
                  inputValue: 'no se agrego una finca y falto litros',
                  icon: 'question',
                  showCancelButton: true,
                  confirmButtonText: 'Registrar y Guardar',
                  cancelButtonText: 'Cancelar',
                  confirmButtonColor: '#0284c7',
                  inputValidator: (v) => (!v?.trim() ? '¡El motivo de la inclusión es obligatorio!' : undefined),
                });

                if (!isConfirmed || !motivo) return;

                try {
                  await operacionesApi.agregarFincaViaje(ticketTrazabilidad.id, {
                    fincaId: formFincaAuditada.fincaId,
                    litrosLeche: formFincaAuditada.litros,
                    tipoLeche: formFincaAuditada.tipoLeche,
                  });
                  toast.success('Finca agregada con éxito al ticket.');
                  setModalAgregarFincaAuditada(false);
                  refetchFincasTraz();
                  queryClient.invalidateQueries({ queryKey: ['control-rutas'] });
                } catch (err: any) {
                  toast.error(err?.response?.data?.message || 'Error al agregar finca');
                }
              }}
              className="space-y-4 text-xs"
            >
              <div>
                <label className="block font-bold text-slate-700 mb-1">Finca *</label>
                <SearchableSelect
                  options={fincas.map((f) => ({
                    value: f.id,
                    label: `${f.nombre} (${f.propietarioNombre || 'Productor'})`,
                  }))}
                  value={formFincaAuditada.fincaId}
                  onChange={(val) => setFormFincaAuditada({ ...formFincaAuditada, fincaId: Number(val) })}
                  placeholder="-- Seleccionar Finca --"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Litros Recogidos *</label>
                <input
                  type="number"
                  value={formFincaAuditada.litros || ''}
                  onChange={(e) => setFormFincaAuditada({ ...formFincaAuditada, litros: Number(e.target.value) })}
                  className="form-input w-full h-9 rounded-lg border border-slate-300 px-2 font-bold"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tipo de Leche</label>
                  <select
                    value={formFincaAuditada.tipoLeche}
                    onChange={(e) => setFormFincaAuditada({ ...formFincaAuditada, tipoLeche: e.target.value })}
                    className="form-select w-full h-9 rounded-lg border border-slate-300 px-2 bg-white"
                  >
                    <option value="VACA">🥛 Vaca</option>
                    <option value="BUFALA">🐃 Búfala</option>
                  </select>
                </div>

                <div className="flex items-center gap-2 pt-6">
                  <input
                    type="checkbox"
                    checked={formFincaAuditada.esAcida}
                    onChange={(e) => setFormFincaAuditada({ ...formFincaAuditada, esAcida: e.target.checked })}
                    id="chkEsAcida"
                    className="rounded text-amber-600"
                  />
                  <label htmlFor="chkEsAcida" className="font-bold text-slate-700 cursor-pointer">
                    ¿Es Leche Ácida?
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setModalAgregarFincaAuditada(false)}
                  className="btn btn-outline h-9 px-4 rounded-lg text-slate-600"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn h-9 px-5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg"
                >
                  Guardar Finca
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ViajesTicketsPage;
