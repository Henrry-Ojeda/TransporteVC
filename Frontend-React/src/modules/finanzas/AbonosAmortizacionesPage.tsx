import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Swal from 'sweetalert2';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import {
  Coins,
  Plus,
  FileSpreadsheet,
  Receipt,
  Search,
  CheckCircle2,
  Building,
  User,
  Leaf,
  Calendar,
} from 'lucide-react';
import apiClient from '@/api/client';
import { finanzasApi } from '@/api/finanzas.api';
import { catalogosApi } from '@/api/catalogos.api';
import { bcvApi } from '@/api/bcv.api';
import { DataTable } from '@/components/common/DataTable';
import type { CicloSemanalDto, AdelantoDto } from '@/types';

interface AbonoDirectoItem {
  id: number;
  adelantoId: number;
  tipoEntidad: string;
  entidadNombre?: string;
  fecha: string;
  montoUSD: number;
  montoBs?: number;
  tasaBCV?: number;
  referenciaBancaria?: string;
  comprobanteUrl?: string;
  observaciones?: string;
  usuarioRegistro?: string;
}

export const AbonosAmortizacionesPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [modalNuevo, setModalNuevo] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState<string>('');
  const [filtroCiclo, setFiltroCiclo] = useState<string>('');
  const [busqueda, setBusqueda] = useState('');

  // 1. Obtener Semanas / Ciclos
  const { data: ciclos = [] } = useQuery<CicloSemanalDto[]>({
    queryKey: ['ciclos-abonos'],
    queryFn: () => finanzasApi.getCiclos(),
  });

  // 2. Obtener Lista de Abonos
  const { data: abonos = [], isLoading } = useQuery<AbonoDirectoItem[]>({
    queryKey: ['abonos-directos', filtroTipo, filtroCiclo],
    queryFn: async () => {
      const params: Record<string, any> = {};
      if (filtroTipo) params.tipoEntidad = filtroTipo;
      if (filtroCiclo) params.cicloId = filtroCiclo;
      const res = await apiClient.get<AbonoDirectoItem[]>('/adelantos/abonos', { params }).catch(() => ({ data: [] }));
      return Array.isArray(res.data) ? res.data : [];
    },
  });

  // 3. Tasa BCV
  const { data: bcv } = useQuery({
    queryKey: ['bcv-rate'],
    queryFn: () => bcvApi.getTasaHoy(),
  });
  const tasaBcv = bcv?.tasa || 36.5;

  // 4. Formulario de nuevo abono
  const [form, setForm] = useState({
    tipoEntidad: 'FINCA',
    adelantoId: 0,
    montoUSD: 0,
    montoBs: 0,
    tasaBCV: tasaBcv,
    referenciaBancaria: '',
    observaciones: '',
    fecha: new Date().toISOString().split('T')[0],
  });

  // Adelantos activos disponibles para amortizar
  const { data: adelantosActivos = [] } = useQuery<AdelantoDto[]>({
    queryKey: ['adelantos-para-abono', form.tipoEntidad],
    queryFn: () => finanzasApi.getAdelantos(form.tipoEntidad),
    enabled: modalNuevo,
  });

  // Mutación Crear Abono
  const crearMutation = useMutation({
    mutationFn: async (payload: typeof form) => {
      const res = await apiClient.post('/adelantos/abonos/directo', payload);
      return res.data;
    },
    onSuccess: (data: any) => {
      Swal.fire({
        icon: 'success',
        title: '¡Abono Registrado!',
        text: data?.message || 'Abono extraordinario aplicado a la deuda con éxito.',
        confirmButtonColor: '#10b981',
      });
      queryClient.invalidateQueries({ queryKey: ['abonos-directos'] });
      queryClient.invalidateQueries({ queryKey: ['adelantos-fincas'] });
      queryClient.invalidateQueries({ queryKey: ['adelantos-receptoria'] });
      setModalNuevo(false);
      setForm({
        tipoEntidad: 'FINCA',
        adelantoId: 0,
        montoUSD: 0,
        montoBs: 0,
        tasaBCV: tasaBcv,
        referenciaBancaria: '',
        observaciones: '',
        fecha: new Date().toISOString().split('T')[0],
      });
    },
    onError: (err: any) => {
      Swal.fire('Error', err?.response?.data?.message || 'No se pudo registrar el abono directo.', 'error');
    },
  });

  // Filtrado
  const filtrados = useMemo(() => {
    return abonos.filter((a) => {
      if (busqueda.trim()) {
        const query = busqueda.toLowerCase();
        const matchesEnt = a.entidadNombre?.toLowerCase().includes(query);
        const matchesRef = a.referenciaBancaria?.toLowerCase().includes(query);
        const matchesObs = a.observaciones?.toLowerCase().includes(query);
        if (!matchesEnt && !matchesRef && !matchesObs) return false;
      }
      return true;
    });
  }, [abonos, busqueda]);

  // KPIs
  const kpis = useMemo(() => {
    let totalUsd = 0;
    let totalBs = 0;
    filtrados.forEach((a) => {
      totalUsd += Number(a.montoUSD || 0);
      totalBs += Number(a.montoBs || (Number(a.montoUSD || 0) * Number(a.tasaBCV || tasaBcv)));
    });
    return { totalUsd, totalBs, totalRegistros: filtrados.length };
  }, [filtrados, tasaBcv]);

  // Exportar Excel
  const exportarExcel = () => {
    if (filtrados.length === 0) {
      toast.error('No hay registros para exportar');
      return;
    }
    const dataRows = filtrados.map((a, i) => ({
      '#': i + 1,
      'Entidad / Beneficiario': a.entidadNombre || 'N/A',
      'Tipo': a.tipoEntidad,
      'Fecha': a.fecha,
      'Monto Abonado USD': a.montoUSD,
      'Monto Bs': a.montoBs || (a.montoUSD * (a.tasaBCV || tasaBcv)),
      'Tasa BCV': a.tasaBCV || tasaBcv,
      'Referencia Bancaria': a.referenciaBancaria || 'N/A',
      'Observaciones': a.observaciones || 'Abono directo a deuda',
    }));

    const ws = XLSX.utils.json_to_sheet(dataRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Abonos_Amortizaciones');
    XLSX.writeFile(wb, `Abonos_Amortizaciones_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success('Reporte exportado a Excel');
  };

  const columns = [
    {
      key: 'entidadNombre',
      header: 'Entidad / Deudor',
      cell: (row: AbonoDirectoItem) => (
        <div>
          <span className="font-bold text-slate-800 text-xs block">
            {row.entidadNombre || `Adelanto #${row.adelantoId}`}
          </span>
          <span className="text-[11px] text-gray-500 flex items-center gap-1">
            {row.tipoEntidad === 'FINCA' ? (
              <Leaf className="w-3 h-3 text-emerald-600 inline" />
            ) : row.tipoEntidad === 'RECEPTORIA' ? (
              <Building className="w-3 h-3 text-blue-600 inline" />
            ) : (
              <User className="w-3 h-3 text-amber-600 inline" />
            )}
            {row.tipoEntidad}
          </span>
        </div>
      ),
    },
    {
      key: 'fecha',
      header: 'Fecha',
      cell: (row: AbonoDirectoItem) => (
        <span className="text-xs font-mono text-slate-600">
          {row.fecha ? new Date(row.fecha).toLocaleDateString() : 'N/A'}
        </span>
      ),
    },
    {
      key: 'montoUSD',
      header: 'Abono USD',
      className: 'text-right',
      cell: (row: AbonoDirectoItem) => (
        <span className="font-mono text-xs font-black text-emerald-700">
          +${Number(row.montoUSD || 0).toFixed(2)}
        </span>
      ),
    },
    {
      key: 'montoBs',
      header: 'Abono Bs',
      className: 'text-right',
      cell: (row: AbonoDirectoItem) => {
        const bs = Number(row.montoBs || (Number(row.montoUSD || 0) * Number(row.tasaBCV || tasaBcv)));
        return (
          <span className="font-mono text-xs font-bold text-slate-700">
            Bs. {bs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
          </span>
        );
      },
    },
    {
      key: 'tasaBCV',
      header: 'Tasa BCV',
      className: 'text-right',
      cell: (row: AbonoDirectoItem) => (
        <span className="font-mono text-[11px] text-gray-500">
          {Number(row.tasaBCV || tasaBcv).toFixed(2)}
        </span>
      ),
    },
    {
      key: 'referenciaBancaria',
      header: 'Referencia / Notas',
      cell: (row: AbonoDirectoItem) => (
        <div className="text-[11px]">
          <span className="font-mono font-bold text-slate-700 block">
            {row.referenciaBancaria || 'Sin Referencia'}
          </span>
          <span className="text-gray-500 italic">{row.observaciones || 'Amortización extraordinaria'}</span>
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
            <Coins className="w-5 h-5 text-amber-500" />
            Abonos Directos & Amortización de Deudas
          </h2>
          <p className="text-xs text-gray-500">
            Registro de cobros extraordinarios fuera de ciclo que amortizan el capital de adelantos activos
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
            className="btn text-xs font-bold h-9 px-3 flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm"
          >
            <Plus className="w-4 h-4" /> Registrar Abono Directo
          </button>
        </div>
      </div>

      {/* KPIS */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs text-gray-500 block font-medium">Total Abonado (USD)</span>
          <span className="text-xl font-black text-emerald-700 font-mono">
            ${kpis.totalUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs text-gray-500 block font-medium">Total Abonado (Bs)</span>
          <span className="text-xl font-black text-blue-900 font-mono">
            Bs. {kpis.totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs text-gray-500 block font-medium">Cantidad de Amortizaciones</span>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span className="text-xl font-bold text-slate-800">{kpis.totalRegistros}</span>
            <span className="text-xs text-gray-400">pagos</span>
          </div>
        </div>
      </div>

      {/* BARRA DE FILTROS */}
      <div className="p-4 bg-white rounded-xl shadow-xs border border-gray-200 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-gray-700">Tipo de Entidad:</label>
            <select
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value)}
              className="form-input text-xs h-9 rounded-lg border border-slate-300 font-medium"
            >
              <option value="">TODAS LAS ENTIDADES</option>
              <option value="FINCA">FINCAS</option>
              <option value="PERSONAL">PERSONAL & CHOFERES</option>
              <option value="RECEPTORIA">RECEPTORÍAS / PLANTAS</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-gray-700">Semana:</label>
            <select
              value={filtroCiclo}
              onChange={(e) => setFiltroCiclo(e.target.value)}
              className="form-input text-xs h-9 rounded-lg border border-slate-300 font-medium"
            >
              <option value="">TODAS LAS SEMANAS</option>
              {ciclos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.codigo || `Semana #${c.numeroSemana}`}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="relative w-64">
          <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-2.5" />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por beneficiario, ref..."
            className="w-full text-xs pl-8 pr-3 h-9 rounded-lg border border-slate-300 outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* TABLA PRINCIPAL */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-xs">
        <DataTable
          columns={columns}
          data={filtrados}
          isLoading={isLoading}
          pageSizeDefault={10}
          emptyMessage="No se han registrado abonos directos para los filtros seleccionados."
        />
      </div>

      {/* MODAL REGISTRAR ABONO DIRECTO */}
      {modalNuevo && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5 text-emerald-600" />
              Registrar Abono Directo a Deuda
            </h3>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Tipo de Deudor:</label>
                <select
                  value={form.tipoEntidad}
                  onChange={(e) => setForm({ ...form, tipoEntidad: e.target.value, adelantoId: 0 })}
                  className="w-full form-input rounded-lg border border-slate-300 p-2"
                >
                  <option value="FINCA">Finca / Productor</option>
                  <option value="PERSONAL">Personal / Chofer</option>
                  <option value="RECEPTORIA">Planta Receptoría</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Préstamo / Adelanto a Amortizar:</label>
                <select
                  value={form.adelantoId}
                  onChange={(e) => {
                    const id = Number(e.target.value);
                    const ad = adelantosActivos.find((a) => a.id === id);
                    const pend = ad ? (ad.montoPendienteUSD || (ad.montoUSD - (ad.montoPagadoUSD || 0))) : 0;
                    setForm({
                      ...form,
                      adelantoId: id,
                      montoUSD: pend > 0 ? pend : form.montoUSD,
                      montoBs: (pend > 0 ? pend : form.montoUSD) * tasaBcv,
                    });
                  }}
                  className="w-full form-input rounded-lg border border-slate-300 p-2"
                >
                  <option value={0}>-- Seleccione un Adelanto Pendiente --</option>
                  {adelantosActivos.map((a) => {
                    const pend = a.montoPendienteUSD || (a.montoUSD - (a.montoPagadoUSD || 0));
                    return (
                      <option key={a.id} value={a.id}>
                        {a.fincaNombre || a.usuarioNombre || a.companiaNombre || `Adelanto #${a.id}`} - Pendiente: ${pend.toFixed(2)}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Monto Abonado (USD):</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.montoUSD || ''}
                    onChange={(e) => {
                      const usd = Number(e.target.value);
                      setForm({ ...form, montoUSD: usd, montoBs: usd * (form.tasaBCV || tasaBcv) });
                    }}
                    placeholder="0.00"
                    className="w-full form-input rounded-lg border border-slate-300 p-2 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tasa BCV:</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.tasaBCV || tasaBcv}
                    onChange={(e) => {
                      const t = Number(e.target.value);
                      setForm({ ...form, tasaBCV: t, montoBs: form.montoUSD * t });
                    }}
                    className="w-full form-input rounded-lg border border-slate-300 p-2 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Equivalente en Bolívares (Bs):</label>
                <input
                  type="text"
                  readOnly
                  value={`Bs. ${Number(form.montoBs || 0).toLocaleString('es-VE', { minimumFractionDigits: 2 })}`}
                  className="w-full form-input rounded-lg border border-slate-200 bg-slate-50 p-2 font-mono font-bold text-emerald-800"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Referencia Bancaria:</label>
                <input
                  type="text"
                  value={form.referenciaBancaria}
                  onChange={(e) => setForm({ ...form, referenciaBancaria: e.target.value })}
                  placeholder="Ej: Pago Móvil / Transf. 984512"
                  className="w-full form-input rounded-lg border border-slate-300 p-2 font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Observaciones:</label>
                <textarea
                  rows={2}
                  value={form.observaciones}
                  onChange={(e) => setForm({ ...form, observaciones: e.target.value })}
                  placeholder="Detalle o justificación de la amortización..."
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
                  if (form.adelantoId <= 0 || form.montoUSD <= 0) {
                    toast.error('Seleccione un adelanto y coloque un monto mayor a cero');
                    return;
                  }
                  crearMutation.mutate(form);
                }}
                disabled={crearMutation.isPending}
                className="btn text-xs px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg"
              >
                Registrar y Amortizar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AbonosAmortizacionesPage;
