import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Swal from 'sweetalert2';
import { toast } from 'sonner';
import {
  Truck,
  Plus,
  FileSpreadsheet,
  Building,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  Trash2,
  HandCoins,
} from 'lucide-react';
import { finanzasApi } from '@/api/finanzas.api';
import { catalogosApi } from '@/api/catalogos.api';
import { bcvApi } from '@/api/bcv.api';
import { DataTable } from '@/components/common/DataTable';
import * as XLSX from 'xlsx';
import type { AdelantoDto, CompaniaDto } from '@/types';

export const AdelantosReceptoriaPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [modalNuevo, setModalNuevo] = useState(false);
  const [modalAmortizar, setModalAmortizar] = useState(false);
  const [adelantoSeleccionado, setAdelantoSeleccionado] = useState<AdelantoDto | null>(null);
  const [montoAmortizar, setMontoAmortizar] = useState<number>(0);
  const [filtroEstado, setFiltroEstado] = useState<string>('');

  const initialForm = {
    tipoEntidad: 'RECEPTORIA',
    companiaId: 0,
    montoUSD: 0,
    fecha: new Date().toISOString().split('T')[0],
    motivo: '',
  };
  const [form, setForm] = useState(initialForm);

  // 1. Cargar Adelantos a Receptorías
  const { data: adelantos = [], isLoading } = useQuery<AdelantoDto[]>({
    queryKey: ['adelantos-receptoria'],
    queryFn: () => finanzasApi.getAdelantos('RECEPTORIA'),
  });

  // 2. Cargar Compañías
  const { data: companias = [] } = useQuery<CompaniaDto[]>({
    queryKey: ['companias-adelantos'],
    queryFn: () => catalogosApi.getCompanias(),
  });

  // 3. Tasa BCV
  const { data: bcv } = useQuery({
    queryKey: ['bcv-rate'],
    queryFn: () => bcvApi.getTasaHoy(),
  });
  const tasaBcv = bcv?.tasa || 36.5;

  // Mutación Crear
  const crearMutation = useMutation({
    mutationFn: (dto: any) => finanzasApi.crearAdelanto(dto),
    onSuccess: (data: any) => {
      Swal.fire({
        icon: 'success',
        title: '¡Anticipo Registrado!',
        text: data.message || 'Anticipo registrado a receptoría exitosamente.',
        confirmButtonColor: '#2563eb',
      });
      queryClient.invalidateQueries({ queryKey: ['adelantos-receptoria'] });
      setModalNuevo(false);
      setForm(initialForm);
    },
    onError: (err: any) => {
      Swal.fire('Error', err?.response?.data?.message || 'Error al registrar anticipo', 'error');
    },
  });

  // Mutación Amortizar
  const amortizarMutation = useMutation({
    mutationFn: ({ id, monto }: { id: number; monto: number }) =>
      finanzasApi.amortizarAdelanto(id, monto),
    onSuccess: () => {
      toast.success('Amortización registrada con éxito');
      queryClient.invalidateQueries({ queryKey: ['adelantos-receptoria'] });
      setModalAmortizar(false);
      setAdelantoSeleccionado(null);
      setMontoAmortizar(0);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Error al amortizar anticipo');
    },
  });

  // Mutación Eliminar
  const eliminarMutation = useMutation({
    mutationFn: (id: number) => finanzasApi.eliminarAdelanto(id),
    onSuccess: () => {
      toast.success('Anticipo eliminado');
      queryClient.invalidateQueries({ queryKey: ['adelantos-receptoria'] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Error al eliminar');
    },
  });

  const handleEliminar = async (id: number) => {
    const res = await Swal.fire({
      title: '¿Eliminar anticipo?',
      text: 'Esta acción anulará el registro y sus cuotas pendientes.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#ef4444',
    });
    if (res.isConfirmed) {
      eliminarMutation.mutate(id);
    }
  };

  const filtrados = useMemo(() => {
    return adelantos.filter((a) => {
      if (filtroEstado === 'PENDIENTES' && a.estado !== 'PENDIENTE' && a.estado !== 'ACTIVO') return false;
      if (filtroEstado === 'PAGADOS' && a.estado !== 'PAGADO' && a.estado !== 'LIQUIDADO') return false;
      return true;
    });
  }, [adelantos, filtroEstado]);

  const kpis = useMemo(() => {
    let totalAdelantado = 0;
    let totalPagado = 0;
    let totalPendiente = 0;

    filtrados.forEach((a) => {
      totalAdelantado += Number(a.montoUSD || 0);
      totalPagado += Number(a.montoPagadoUSD || 0);
      totalPendiente += Number(a.montoPendienteUSD || (Number(a.montoUSD || 0) - Number(a.montoPagadoUSD || 0)));
    });

    return { totalAdelantado, totalPagado, totalPendiente, count: filtrados.length };
  }, [filtrados]);

  const exportarExcel = () => {
    if (filtrados.length === 0) {
      toast.error('No hay datos para exportar');
      return;
    }
    const dataRows = filtrados.map((a, i) => ({
      '#': i + 1,
      'Receptoría / Compañía': a.companiaNombre || 'Receptoría',
      'Fecha': a.fecha,
      'Monto USD': a.montoUSD,
      'Amortizado USD': a.montoPagadoUSD || 0,
      'Pendiente USD': a.montoPendienteUSD || (a.montoUSD - (a.montoPagadoUSD || 0)),
      'Estado': a.estado || 'ACTIVO',
      'Motivo': a.motivo || 'N/A',
    }));

    const ws = XLSX.utils.json_to_sheet(dataRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Anticipos_Receptoria');
    XLSX.writeFile(wb, `Anticipos_Receptoria_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success('Reporte exportado a Excel');
  };

  const columns = [
    {
      key: 'companiaNombre',
      header: 'Receptoría / Compañía',
      cell: (row: AdelantoDto) => (
        <div>
          <span className="font-bold text-slate-800 text-xs block">
            {row.companiaNombre || 'Receptoría Destino'}
          </span>
          <span className="text-[11px] text-gray-500">{row.motivo || 'Anticipo operativo'}</span>
        </div>
      ),
    },
    {
      key: 'fecha',
      header: 'Fecha',
      cell: (row: AdelantoDto) => (
        <span className="text-xs font-mono text-slate-600">
          {row.fecha ? new Date(row.fecha).toLocaleDateString() : 'N/A'}
        </span>
      ),
    },
    {
      key: 'montoUSD',
      header: 'Monto Total USD',
      className: 'text-right',
      cell: (row: AdelantoDto) => (
        <span className="font-mono text-xs font-bold text-slate-800">
          ${Number(row.montoUSD || 0).toFixed(2)}
        </span>
      ),
    },
    {
      key: 'montoPagadoUSD',
      header: 'Amortizado USD',
      className: 'text-right',
      cell: (row: AdelantoDto) => (
        <span className="font-mono text-xs font-semibold text-emerald-700">
          ${Number(row.montoPagadoUSD || 0).toFixed(2)}
        </span>
      ),
    },
    {
      key: 'montoPendienteUSD',
      header: 'Saldo Pendiente',
      className: 'text-right',
      cell: (row: AdelantoDto) => {
        const pend = Number(row.montoPendienteUSD || (row.montoUSD - (row.montoPagadoUSD || 0)));
        return (
          <span className={`font-mono text-xs font-black ${pend > 0 ? 'text-amber-700' : 'text-slate-400'}`}>
            ${pend.toFixed(2)}
          </span>
        );
      },
    },
    {
      key: 'estado',
      header: 'Estado',
      className: 'text-center',
      cell: (row: AdelantoDto) => {
        const isPagado = (row.montoPendienteUSD === 0 && (row.montoPagadoUSD || 0) > 0) || row.estado === 'PAGADO' || row.estado === 'LIQUIDADO';
        return isPagado ? (
          <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            Completado
          </span>
        ) : (
          <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
            En Cuotas
          </span>
        );
      },
    },
    {
      key: 'acciones',
      header: 'Acciones',
      className: 'text-center',
      cell: (row: AdelantoDto) => (
        <div className="flex items-center justify-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              setAdelantoSeleccionado(row);
              setMontoAmortizar(row.montoPendienteUSD || (row.montoUSD - (row.montoPagadoUSD || 0)));
              setModalAmortizar(true);
            }}
            className="p-1 hover:bg-emerald-50 text-emerald-700 rounded border border-emerald-200"
            title="Amortizar Cuota / Saldo"
          >
            <HandCoins className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => handleEliminar(row.id)}
            className="p-1 hover:bg-red-50 text-red-600 rounded border border-red-200"
            title="Eliminar Anticipo"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 bg-white rounded-2xl shadow-sm border border-gray-200">
        <div>
          <h2 className="text-lg font-bold text-blue-900 flex items-center gap-2">
            <Truck className="w-5 h-5 text-blue-600" />
            Anticipos & Descuentos a Receptoría
          </h2>
          <p className="text-xs text-gray-500">
            Control de anticipos de dinero o leche otorgados a plantas receptoras y cuotas fijadas por ciclo
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={exportarExcel}
            className="btn btn-outline text-xs font-bold h-9 px-3 flex items-center gap-1.5 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50"
          >
            <FileSpreadsheet className="w-4 h-4" /> Exportar Excel
          </button>
          <button
            type="button"
            onClick={() => setModalNuevo(true)}
            className="btn text-xs font-bold h-9 px-3 flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm"
          >
            <Plus className="w-4 h-4" /> Nuevo Anticipo
          </button>
        </div>
      </div>

      {/* KPIS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs text-gray-500 block font-medium">Total Otorgado USD</span>
          <span className="text-xl font-black text-blue-900 font-mono">
            ${kpis.totalAdelantado.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs text-gray-500 block font-medium">Total Cobrado / Amortizado</span>
          <span className="text-xl font-black text-emerald-700 font-mono">
            ${kpis.totalPagado.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs text-gray-500 block font-medium">Saldo por Cobrar USD</span>
          <span className="text-xl font-black text-amber-700 font-mono">
            ${kpis.totalPendiente.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs text-gray-500 block font-medium">Equivalente en Bolívares (Bs)</span>
          <span className="text-base font-bold text-slate-800 font-mono">
            Bs. {(kpis.totalPendiente * tasaBcv).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
          </span>
          <span className="text-[10px] text-gray-400 block mt-0.5">Tasa BCV: {tasaBcv.toFixed(2)}</span>
        </div>
      </div>

      {/* FILTROS */}
      <div className="p-4 bg-white rounded-xl shadow-xs border border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-gray-700">Estado de Saldo:</label>
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            className="form-input text-xs h-9 rounded-lg border border-slate-300 font-medium"
          >
            <option value="">TODOS LOS ANTICIPOS</option>
            <option value="PENDIENTES">SOLO CON SALDO PENDIENTE</option>
            <option value="PAGADOS">TOTALMENTE LIQUIDADOS</option>
          </select>
        </div>
      </div>

      {/* TABLA PRINCIPAL */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-xs">
        <DataTable
          columns={columns}
          data={filtrados}
          isLoading={isLoading}
          pageSizeDefault={10}
          emptyMessage="No hay anticipos a receptorías registrados."
        />
      </div>

      {/* MODAL NUEVO ANTICIPO */}
      {modalNuevo && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5 text-blue-600" />
              Registrar Anticipo a Receptoría
            </h3>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Compañía / Receptoría:</label>
                <select
                  value={form.companiaId}
                  onChange={(e) => setForm({ ...form, companiaId: Number(e.target.value) })}
                  className="w-full form-input rounded-lg border border-slate-300 p-2"
                >
                  <option value={0}>-- Seleccione una Planta Receptoría --</option>
                  {companias.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Monto en Dólares (USD):</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.montoUSD || ''}
                  onChange={(e) => setForm({ ...form, montoUSD: Number(e.target.value) })}
                  placeholder="0.00"
                  className="w-full form-input rounded-lg border border-slate-300 p-2 font-mono font-bold"
                />
                {form.montoUSD > 0 && (
                  <span className="text-[11px] text-emerald-700 font-semibold block mt-1">
                    ≈ Bs. {(form.montoUSD * tasaBcv).toLocaleString('es-VE', { minimumFractionDigits: 2 })} (Tasa: {tasaBcv.toFixed(2)})
                  </span>
                )}
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Fecha de Otorgamiento:</label>
                <input
                  type="date"
                  value={form.fecha}
                  onChange={(e) => setForm({ ...form, fecha: e.target.value })}
                  className="w-full form-input rounded-lg border border-slate-300 p-2"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Motivo / Observaciones:</label>
                <textarea
                  rows={2}
                  value={form.motivo}
                  onChange={(e) => setForm({ ...form, motivo: e.target.value })}
                  placeholder="Ej: Anticipo para insumos o compra de volumen de leche..."
                  className="w-full form-input rounded-lg border border-slate-300 p-2"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setModalNuevo(false)}
                className="btn btn-outline text-xs px-3 py-1.5 border border-slate-300 rounded-lg text-slate-600"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (form.companiaId <= 0 || form.montoUSD <= 0) {
                    toast.error('Debe seleccionar la compañía y colocar un monto válido');
                    return;
                  }
                  crearMutation.mutate(form);
                }}
                disabled={crearMutation.isPending}
                className="btn text-xs px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg"
              >
                Guardar Anticipo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL AMORTIZAR SALDO */}
      {modalAmortizar && adelantoSeleccionado && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-base font-bold text-slate-800 mb-2 flex items-center gap-2">
              <HandCoins className="w-5 h-5 text-emerald-600" />
              Amortizar Anticipo
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              {adelantoSeleccionado.companiaNombre || 'Receptoría'}
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Monto a Amortizar (USD):</label>
                <input
                  type="number"
                  step="0.01"
                  value={montoAmortizar || ''}
                  onChange={(e) => setMontoAmortizar(Number(e.target.value))}
                  className="w-full form-input rounded-lg border border-slate-300 p-2 font-mono font-bold"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setModalAmortizar(false)}
                className="btn btn-outline text-xs px-3 py-1.5 border border-slate-300 rounded-lg text-slate-600"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (montoAmortizar <= 0) {
                    toast.error('Ingrese un monto válido');
                    return;
                  }
                  amortizarMutation.mutate({ id: adelantoSeleccionado.id, monto: montoAmortizar });
                }}
                disabled={amortizarMutation.isPending}
                className="btn text-xs px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg"
              >
                Aplicar Amortización
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdelantosReceptoriaPage;
