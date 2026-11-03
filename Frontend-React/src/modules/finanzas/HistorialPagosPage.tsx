import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import Swal from 'sweetalert2';
import * as XLSX from 'xlsx';
import {
  History,
  FileSpreadsheet,
  Printer,
  Share2,
  CheckCircle2,
  AlertCircle,
  Eye,
  Filter,
  DollarSign,
  Receipt,
  Search,
} from 'lucide-react';
import { finanzasApi } from '@/api/finanzas.api';
import { DataTable } from '@/components/common/DataTable';
import type { PreliquidacionFincaDto, CicloSemanalDto } from '@/types';

export const HistorialPagosPage: React.FC = () => {
  const [selectedCicloId, setSelectedCicloId] = useState<number | undefined>(undefined);
  const [filtroEstado, setFiltroEstado] = useState<'TODOS' | 'PAGADOS' | 'PENDIENTES'>('TODOS');
  const [busqueda, setBusqueda] = useState('');

  // 1. Obtener Ciclos / Semanas
  const { data: ciclos = [] } = useQuery<CicloSemanalDto[]>({
    queryKey: ['ciclos-historial-pagos'],
    queryFn: () => finanzasApi.getCiclos(),
  });

  // 2. Obtener Liquidaciones / Pagos
  const {
    data: liquidaciones = [],
    isLoading,
    refetch,
  } = useQuery<PreliquidacionFincaDto[]>({
    queryKey: ['historial-pagos', selectedCicloId],
    queryFn: () => finanzasApi.getPreliquidacion(selectedCicloId),
  });

  // 3. Filtrar
  const filtrados = useMemo(() => {
    return liquidaciones.filter((item) => {
      if (filtroEstado === 'PAGADOS' && !item.pagado) return false;
      if (filtroEstado === 'PENDIENTES' && item.pagado) return false;
      if (busqueda.trim()) {
        const query = busqueda.toLowerCase();
        const matchesNombre = item.fincaNombre?.toLowerCase().includes(query);
        const matchesProp = item.propietarioNombre?.toLowerCase().includes(query);
        const matchesRef = item.referenciaPago?.toLowerCase().includes(query);
        const matchesBanco = item.bancoNombre?.toLowerCase().includes(query);
        if (!matchesNombre && !matchesProp && !matchesRef && !matchesBanco) return false;
      }
      return true;
    });
  }, [liquidaciones, filtroEstado, busqueda]);

  // 4. Totales KPIs
  const kpis = useMemo(() => {
    let totalUsd = 0;
    let totalBs = 0;
    let pagadosCount = 0;
    let pendientesCount = 0;

    filtrados.forEach((item) => {
      totalUsd += Number(item.totalNetoUSD || 0);
      totalBs += Number(item.totalNetoBs || 0);
      if (item.pagado) pagadosCount++;
      else pendientesCount++;
    });

    return {
      totalUsd,
      totalBs,
      pagadosCount,
      pendientesCount,
      totalRegistros: filtrados.length,
    };
  }, [filtrados]);

  // 5. Ver Comprobante y Compartir WhatsApp
  const verComprobante = (item: PreliquidacionFincaDto) => {
    const textoWhatsApp = `*COMPROBANTE DE LIQUIDACIÓN - TRANSPORTE VERGEL CARRILLO*\n` +
      `📅 Fecha: ${item.fechaPago || new Date().toLocaleDateString()}\n` +
      `🚜 Finca: ${item.fincaNombre}\n` +
      `👤 Productor: ${item.propietarioNombre}\n` +
      `🥛 Litros Totales: ${Number(item.totalLitros || 0).toLocaleString()} Lts\n` +
      `💵 Precio/Litro: $${Number(item.precioLitroUSD || 0).toFixed(4)}\n` +
      `--------------------------------\n` +
      `💰 Bruto: $${Number(item.totalBrutoUSD || 0).toFixed(2)}\n` +
      `🔻 Anticipos/Adelantos: -$${Number(item.totalAdelantosUSD || 0).toFixed(2)}\n` +
      `✅ *TOTAL NETO A PAGAR: $${Number(item.totalNetoUSD || 0).toFixed(2)}*\n` +
      `🇻🇪 Monto Bs: Bs. ${Number(item.totalNetoBs || 0).toLocaleString('es-VE', { minimumFractionDigits: 2 })}\n` +
      `🏦 Banco: ${item.bancoNombre || 'N/A'}\n` +
      `🔖 Ref: ${item.referenciaPago || 'PENDIENTE'}\n` +
      `Estado: ${item.pagado ? '✅ PAGADO' : '⏳ PENDIENTE'}`;

    Swal.fire({
      title: 'Comprobante de Liquidación',
      html: `
        <div class="text-left text-xs space-y-2 p-2 bg-slate-50 rounded-lg border border-slate-200">
          <p><strong>Finca:</strong> ${item.fincaNombre} (${item.fincaCodigo || 'S/C'})</p>
          <p><strong>Propietario:</strong> ${item.propietarioNombre}</p>
          <p><strong>Litros Entregados:</strong> ${Number(item.totalLitros || 0).toLocaleString()} Lts</p>
          <p><strong>Total Bruto:</strong> $${Number(item.totalBrutoUSD || 0).toFixed(2)}</p>
          <p class="text-amber-700"><strong>Adelantos Descontados:</strong> -$${Number(item.totalAdelantosUSD || 0).toFixed(2)}</p>
          <p class="text-blue-900 font-bold text-sm"><strong>Total Neto USD:</strong> $${Number(item.totalNetoUSD || 0).toFixed(2)}</p>
          <p class="text-emerald-800 font-bold"><strong>Total Neto Bs:</strong> Bs. ${Number(item.totalNetoBs || 0).toLocaleString('es-VE', { minimumFractionDigits: 2 })} (Tasa: ${Number(item.tasaBCV || 0).toFixed(2)})</p>
          <p><strong>Banco:</strong> ${item.bancoNombre || 'No especificado'}</p>
          <p><strong>Cuenta / Pago Móvil:</strong> ${item.numeroCuenta || item.pagoMovil || 'N/A'}</p>
          <p><strong>Referencia:</strong> ${item.referenciaPago || 'PENDIENTE'}</p>
          <p><strong>Estado:</strong> ${item.pagado ? '<span class="text-emerald-600 font-bold">PAGADO</span>' : '<span class="text-amber-600 font-bold">PENDIENTE</span>'}</p>
        </div>
      `,
      icon: 'info',
      showCancelButton: true,
      confirmButtonText: '📋 Copiar a WhatsApp',
      cancelButtonText: 'Cerrar',
      confirmButtonColor: '#16a34a',
    }).then((res) => {
      if (res.isConfirmed) {
        navigator.clipboard.writeText(textoWhatsApp);
        toast.success('Comprobante copiado al portapapeles listo para enviar por WhatsApp');
      }
    });
  };

  // 6. Exportar Excel
  const exportarExcel = () => {
    if (filtrados.length === 0) {
      toast.error('No hay datos para exportar');
      return;
    }
    const dataRows = filtrados.map((item, idx) => ({
      '#': idx + 1,
      'Finca': item.fincaNombre,
      'Propietario': item.propietarioNombre,
      'Litros Leche': item.totalLitros,
      'Precio USD/Lt': item.precioLitroUSD,
      'Total Bruto USD': item.totalBrutoUSD,
      'Adelantos USD': item.totalAdelantosUSD,
      'Neto a Pagar USD': item.totalNetoUSD,
      'Neto a Pagar Bs': item.totalNetoBs,
      'Tasa BCV': item.tasaBCV,
      'Banco': item.bancoNombre || 'N/A',
      'Referencia': item.referenciaPago || 'N/A',
      'Estado': item.pagado ? 'PAGADO' : 'PENDIENTE',
      'Fecha Pago': item.fechaPago || 'N/A',
    }));

    const ws = XLSX.utils.json_to_sheet(dataRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Historial_Pagos');
    XLSX.writeFile(wb, `Historial_Pagos_Liquidacion_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success('Historial de pagos exportado a Excel');
  };

  const columns = [
    {
      key: 'fincaNombre',
      header: 'Finca / Productor',
      cell: (row: PreliquidacionFincaDto) => (
        <div>
          <span className="font-bold text-slate-800 text-xs block">{row.fincaNombre}</span>
          <span className="text-[11px] text-gray-500">{row.propietarioNombre}</span>
        </div>
      ),
    },
    {
      key: 'totalLitros',
      header: 'Litros',
      className: 'text-right',
      cell: (row: PreliquidacionFincaDto) => (
        <span className="font-mono text-xs font-semibold">
          {Number(row.totalLitros || 0).toLocaleString()} Lts
        </span>
      ),
    },
    {
      key: 'totalBrutoUSD',
      header: 'Bruto USD',
      className: 'text-right',
      cell: (row: PreliquidacionFincaDto) => (
        <span className="font-mono text-xs text-slate-600">
          ${Number(row.totalBrutoUSD || 0).toFixed(2)}
        </span>
      ),
    },
    {
      key: 'totalAdelantosUSD',
      header: 'Adelantos',
      className: 'text-right',
      cell: (row: PreliquidacionFincaDto) => (
        <span className="font-mono text-xs text-amber-700 font-semibold">
          {Number(row.totalAdelantosUSD || 0) > 0 ? `-$${Number(row.totalAdelantosUSD).toFixed(2)}` : '$0.00'}
        </span>
      ),
    },
    {
      key: 'totalNetoUSD',
      header: 'Neto USD',
      className: 'text-right',
      cell: (row: PreliquidacionFincaDto) => (
        <span className="font-mono text-xs font-black text-blue-900">
          ${Number(row.totalNetoUSD || 0).toFixed(2)}
        </span>
      ),
    },
    {
      key: 'totalNetoBs',
      header: 'Neto Bs',
      className: 'text-right',
      cell: (row: PreliquidacionFincaDto) => (
        <span className="font-mono text-[11px] font-bold text-emerald-700">
          Bs. {Number(row.totalNetoBs || 0).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      key: 'pagado',
      header: 'Estado',
      className: 'text-center',
      cell: (row: PreliquidacionFincaDto) => (
        row.pagado ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Pagado
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
            <AlertCircle className="w-3 h-3 text-amber-600" /> Pendiente
          </span>
        )
      ),
    },
    {
      key: 'referenciaPago',
      header: 'Banco / Ref',
      cell: (row: PreliquidacionFincaDto) => (
        <div className="text-[11px]">
          <span className="font-semibold text-slate-700 block">{row.bancoNombre || 'N/A'}</span>
          <span className="font-mono text-gray-500">{row.referenciaPago || 'S/R'}</span>
        </div>
      ),
    },
    {
      key: 'acciones',
      header: 'Comprobante',
      className: 'text-center',
      cell: (row: PreliquidacionFincaDto) => (
        <button
          type="button"
          onClick={() => verComprobante(row)}
          className="p-1.5 hover:bg-blue-50 text-blue-700 rounded-lg transition-colors border border-blue-200"
          title="Ver Comprobante y Enviar por WhatsApp"
        >
          <Receipt className="w-4 h-4" />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* HEADER DE LA VISTA */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 bg-white rounded-2xl shadow-sm border border-gray-200">
        <div>
          <h2 className="text-lg font-bold text-blue-900 flex items-center gap-2">
            <History className="w-5 h-5 text-blue-600" />
            Historial de Pagos de Liquidación
          </h2>
          <p className="text-xs text-gray-500">
            Registro consolidado de pagos emitidos a fincas y productores, cuotas descontadas y comprobantes
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={exportarExcel}
            className="btn text-xs font-bold h-9 px-3 flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm"
          >
            <FileSpreadsheet className="w-4 h-4" /> Exportar Excel
          </button>
        </div>
      </div>

      {/* KPIS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs text-gray-500 block font-medium">Total Liquidado (USD)</span>
          <span className="text-xl font-black text-blue-900 font-mono">
            ${kpis.totalUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs text-gray-500 block font-medium">Equivalente en Bolívares (Bs)</span>
          <span className="text-xl font-black text-emerald-700 font-mono">
            Bs. {kpis.totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs text-gray-500 block font-medium">Pagos Realizados</span>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span className="text-xl font-bold text-slate-800">{kpis.pagadosCount}</span>
            <span className="text-xs text-gray-400">recibos</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs text-gray-500 block font-medium">Pagos Pendientes</span>
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600" />
            <span className="text-xl font-bold text-amber-700">{kpis.pendientesCount}</span>
            <span className="text-xs text-gray-400">fincas</span>
          </div>
        </div>
      </div>

      {/* BARRA DE FILTROS */}
      <div className="p-4 bg-white rounded-xl shadow-xs border border-gray-200 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-gray-700">Semana Operativa:</label>
            <select
              value={selectedCicloId || ''}
              onChange={(e) => setSelectedCicloId(e.target.value ? Number(e.target.value) : undefined)}
              className="form-input text-xs h-9 rounded-lg border border-slate-300 font-medium"
            >
              <option value="">TODAS LAS SEMANAS</option>
              {ciclos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.codigo || `Semana #${c.numeroSemana} (${c.año})`}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-gray-700">Estado:</label>
            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value as any)}
              className="form-input text-xs h-9 rounded-lg border border-slate-300 font-medium"
            >
              <option value="TODOS">TODOS LOS REGISTROS</option>
              <option value="PAGADOS">SOLO PAGADOS</option>
              <option value="PENDIENTES">SOLO PENDIENTES</option>
            </select>
          </div>
        </div>

        <div className="relative w-64">
          <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-2.5" />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por finca, productor o ref..."
            className="w-full text-xs pl-8 pr-3 h-9 rounded-lg border border-slate-300 outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* TABLA PRINCIPAL CON DATATABLE */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-xs">
        <DataTable
          columns={columns}
          data={filtrados}
          isLoading={isLoading}
          pageSizeDefault={15}
          emptyMessage="No hay registros de liquidaciones o pagos para los filtros seleccionados."
        />
      </div>
    </div>
  );
};

export default HistorialPagosPage;
