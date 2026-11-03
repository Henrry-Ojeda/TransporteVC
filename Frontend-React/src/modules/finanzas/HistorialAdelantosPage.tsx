import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import {
  History,
  FileSpreadsheet,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  Leaf,
  Building,
  User,
  Eye,
} from 'lucide-react';
import { finanzasApi } from '@/api/finanzas.api';
import { bcvApi } from '@/api/bcv.api';
import { DataTable } from '@/components/common/DataTable';
import Swal from 'sweetalert2';
import type { AdelantoDto } from '@/types';

export const HistorialAdelantosPage: React.FC = () => {
  const [filtroTipo, setFiltroTipo] = useState<string>('');
  const [filtroEstado, setFiltroEstado] = useState<string>('');
  const [busqueda, setBusqueda] = useState('');

  // 1. Obtener todos los adelantos
  const { data: adelantos = [], isLoading } = useQuery<AdelantoDto[]>({
    queryKey: ['historial-general-adelantos', filtroTipo],
    queryFn: () => finanzasApi.getAdelantos(filtroTipo || undefined),
  });

  // 2. Tasa BCV
  const { data: bcv } = useQuery({
    queryKey: ['bcv-rate'],
    queryFn: () => bcvApi.getTasaHoy(),
  });
  const tasaBcv = bcv?.tasa || 36.5;

  // Filtrado
  const filtrados = useMemo(() => {
    return adelantos.filter((a) => {
      const isLiquidado = (a.montoPendienteUSD === 0 && (a.montoPagadoUSD || 0) > 0) || a.estado === 'PAGADO' || a.estado === 'LIQUIDADO';
      if (filtroEstado === 'ACTIVOS' && isLiquidado) return false;
      if (filtroEstado === 'LIQUIDADOS' && !isLiquidado) return false;

      if (busqueda.trim()) {
        const query = busqueda.toLowerCase();
        const matchesNombre = (a.fincaNombre || a.usuarioNombre || a.companiaNombre || '')
          .toLowerCase()
          .includes(query);
        const matchesMotivo = (a.motivo || '').toLowerCase().includes(query);
        if (!matchesNombre && !matchesMotivo) return false;
      }
      return true;
    });
  }, [adelantos, filtroEstado, busqueda]);

  // KPIs
  const kpis = useMemo(() => {
    let totalOtorgado = 0;
    let totalCobrado = 0;
    let totalPendiente = 0;
    let activosCount = 0;
    let liquidadosCount = 0;

    filtrados.forEach((a) => {
      const otorgado = Number(a.montoUSD || 0);
      const cobrado = Number(a.montoPagadoUSD || 0);
      const pendiente = Number(a.montoPendienteUSD || (otorgado - cobrado));

      totalOtorgado += otorgado;
      totalCobrado += cobrado;
      totalPendiente += pendiente;

      if (pendiente <= 0.01 && cobrado > 0) {
        liquidadosCount++;
      } else {
        activosCount++;
      }
    });

    return {
      totalOtorgado,
      totalCobrado,
      totalPendiente,
      activosCount,
      liquidadosCount,
      totalRegistros: filtrados.length,
    };
  }, [filtrados]);

  // Ver Detalle de Cuotas
  const verDetalle = (item: AdelantoDto) => {
    const pend = Number(item.montoPendienteUSD || (item.montoUSD - (item.montoPagadoUSD || 0)));
    const cuotas = (item as any).cuotas || [];

    let cuotasHtml = '';
    if (cuotas.length > 0) {
      cuotasHtml = `
        <div class="mt-3 border-t border-slate-200 pt-2 text-left">
          <strong class="text-xs text-slate-700 block mb-1">Cuotas Programadas:</strong>
          <table class="w-full text-[11px] border border-slate-200 text-center">
            <thead class="bg-slate-100 font-bold">
              <tr>
                <th class="p-1">#</th>
                <th class="p-1">Semana</th>
                <th class="p-1">Monto USD</th>
                <th class="p-1">Estado</th>
              </tr>
            </thead>
            <tbody>
              ${cuotas.map((c: any, i: number) => `
                <tr class="border-b border-slate-100">
                  <td class="p-1">${i + 1}</td>
                  <td class="p-1">${c.semanaCodigo || `Semana #${c.semanaId || '-'}`}</td>
                  <td class="p-1 font-mono font-bold">$${Number(c.montoUSD || 0).toFixed(2)}</td>
                  <td class="p-1 font-bold ${c.cobrada ? 'text-emerald-600' : 'text-amber-600'}">
                    ${c.cobrada ? 'Cobrada' : 'Pendiente'}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    Swal.fire({
      title: `Detalle del Adelanto #${item.id}`,
      html: `
        <div class="text-left text-xs space-y-1.5 p-2 bg-slate-50 rounded-lg border border-slate-200">
          <p><strong>Beneficiario:</strong> ${item.fincaNombre || item.usuarioNombre || item.companiaNombre || 'Beneficiario'}</p>
          <p><strong>Tipo de Entidad:</strong> ${item.tipoEntidad}</p>
          <p><strong>Fecha de Emisión:</strong> ${item.fecha ? new Date(item.fecha).toLocaleDateString() : 'N/A'}</p>
          <p><strong>Monto Total Otorgado:</strong> $${Number(item.montoUSD || 0).toFixed(2)}</p>
          <p class="text-emerald-700"><strong>Monto Amortizado:</strong> $${Number(item.montoPagadoUSD || 0).toFixed(2)}</p>
          <p class="text-amber-800 font-bold text-sm"><strong>Saldo Pendiente:</strong> $${pend.toFixed(2)} (Bs. ${(pend * tasaBcv).toLocaleString('es-VE', { minimumFractionDigits: 2 })})</p>
          <p><strong>Motivo / Justificación:</strong> ${item.motivo || 'Préstamo o anticipo operativo'}</p>
          <p><strong>Estado:</strong> ${pend <= 0 ? '<span class="text-emerald-600 font-bold">LIQUIDADO</span>' : '<span class="text-amber-600 font-bold">ACTIVO EN COBRO</span>'}</p>
          ${cuotasHtml}
        </div>
      `,
      icon: 'info',
      confirmButtonText: 'Cerrar',
      confirmButtonColor: '#2563eb',
    });
  };

  // Exportar Excel
  const exportarExcel = () => {
    if (filtrados.length === 0) {
      toast.error('No hay registros para exportar');
      return;
    }
    const dataRows = filtrados.map((a, i) => {
      const pend = Number(a.montoPendienteUSD || (a.montoUSD - (a.montoPagadoUSD || 0)));
      return {
        '#': i + 1,
        'Tipo': a.tipoEntidad,
        'Beneficiario': a.fincaNombre || a.usuarioNombre || a.companiaNombre || 'N/A',
        'Fecha': a.fecha,
        'Monto Otorgado USD': a.montoUSD,
        'Amortizado USD': a.montoPagadoUSD || 0,
        'Saldo Pendiente USD': pend,
        'Saldo Pendiente Bs': pend * tasaBcv,
        'Estado': pend <= 0.01 ? 'LIQUIDADO' : 'ACTIVO',
        'Motivo': a.motivo || 'N/A',
      };
    });

    const ws = XLSX.utils.json_to_sheet(dataRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Historial_General_Adelantos');
    XLSX.writeFile(wb, `Historial_General_Adelantos_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success('Historial de adelantos exportado a Excel');
  };

  const columns = [
    {
      key: 'beneficiario',
      header: 'Beneficiario',
      cell: (row: AdelantoDto) => {
        const nombre = row.fincaNombre || row.usuarioNombre || row.companiaNombre || `Adelanto #${row.id}`;
        return (
          <div>
            <span className="font-bold text-slate-800 text-xs block">{nombre}</span>
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
        );
      },
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
      header: 'Total USD',
      className: 'text-right',
      cell: (row: AdelantoDto) => (
        <span className="font-mono text-xs font-bold text-slate-800">
          ${Number(row.montoUSD || 0).toFixed(2)}
        </span>
      ),
    },
    {
      key: 'montoPagadoUSD',
      header: 'Cobrado USD',
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
      key: 'progreso',
      header: 'Amortización',
      cell: (row: AdelantoDto) => {
        const otorgado = Number(row.montoUSD || 1);
        const cobrado = Number(row.montoPagadoUSD || 0);
        const pct = Math.min(100, Math.round((cobrado / otorgado) * 100));
        return (
          <div className="w-24">
            <div className="flex justify-between text-[10px] text-gray-500 mb-0.5">
              <span>{pct}%</span>
              <span>{pct === 100 ? 'Liquidado' : 'Pendiente'}</span>
            </div>
            <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
              <div
                className={`h-full ${pct === 100 ? 'bg-emerald-500' : 'bg-blue-600'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      },
    },
    {
      key: 'estado',
      header: 'Estado',
      className: 'text-center',
      cell: (row: AdelantoDto) => {
        const pend = Number(row.montoPendienteUSD || (row.montoUSD - (row.montoPagadoUSD || 0)));
        const isLiquidado = pend <= 0.01 && (row.montoPagadoUSD || 0) > 0;
        return isLiquidado ? (
          <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            Liquidado
          </span>
        ) : (
          <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
            Activo
          </span>
        );
      },
    },
    {
      key: 'acciones',
      header: 'Detalle',
      className: 'text-center',
      cell: (row: AdelantoDto) => (
        <button
          type="button"
          onClick={() => verDetalle(row)}
          className="p-1.5 hover:bg-blue-50 text-blue-700 rounded-lg transition-colors border border-blue-200"
          title="Ver Cuotas y Detalle del Adelanto"
        >
          <Eye className="w-4 h-4" />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 bg-white rounded-2xl shadow-sm border border-gray-200">
        <div>
          <h2 className="text-lg font-bold text-blue-900 flex items-center gap-2">
            <History className="w-5 h-5 text-blue-600" />
            Historial General de Adelantos & Préstamos
          </h2>
          <p className="text-xs text-gray-500">
            Auditoría consolidada de todos los anticipos otorgados (Fincas, Personal y Receptoría), cuotas cobradas y saldos
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={exportarExcel}
            className="btn text-xs font-bold h-9 px-3 flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm"
          >
            <FileSpreadsheet className="w-4 h-4" /> Exportar Historial Excel
          </button>
        </div>
      </div>

      {/* KPIS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs text-gray-500 block font-medium">Total Otorgado (USD)</span>
          <span className="text-xl font-black text-blue-900 font-mono">
            ${kpis.totalOtorgado.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs text-gray-500 block font-medium">Total Cobrado (USD)</span>
          <span className="text-xl font-black text-emerald-700 font-mono">
            ${kpis.totalCobrado.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs text-gray-500 block font-medium">Saldo por Cobrar en Calle</span>
          <span className="text-xl font-black text-amber-700 font-mono">
            ${kpis.totalPendiente.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </span>
          <span className="text-[11px] text-gray-400 block mt-0.5">
            ≈ Bs. {(kpis.totalPendiente * tasaBcv).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs text-gray-500 block font-medium">Estado de Cartera</span>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-sm font-bold text-amber-700">{kpis.activosCount} Activos</span>
            <span className="text-gray-300">|</span>
            <span className="text-sm font-bold text-emerald-700">{kpis.liquidadosCount} Liquidados</span>
          </div>
        </div>
      </div>

      {/* FILTROS */}
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
              <option value="RECEPTORIA">RECEPTORÍAS</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-gray-700">Estado:</label>
            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
              className="form-input text-xs h-9 rounded-lg border border-slate-300 font-medium"
            >
              <option value="">TODOS LOS ESTADOS</option>
              <option value="ACTIVOS">SOLO ACTIVOS (CON SALDO)</option>
              <option value="LIQUIDADOS">SOLO LIQUIDADOS</option>
            </select>
          </div>
        </div>

        <div className="relative w-64">
          <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-2.5" />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por beneficiario o motivo..."
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
          emptyMessage="No hay registros en el historial de adelantos."
        />
      </div>
    </div>
  );
};

export default HistorialAdelantosPage;
