import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import {
  Scale,
  Calendar,
  FileSpreadsheet,
  TrendingUp,
  DollarSign,
  Milk,
  Truck,
  Building,
  RefreshCw,
  PieChart,
} from 'lucide-react';
import { finanzasApi } from '@/api/finanzas.api';
import { catalogosApi } from '@/api/catalogos.api';
import { DataTable } from '@/components/common/DataTable';
import apiClient from '@/api/client';
import { useAuthStore } from '@/stores/authStore';
import type { CicloSemanalDto } from '@/types';

export const AdministracionGeneralPage: React.FC = () => {
  const hasBufala = useAuthStore((state) => state.hasTenantModule('MOD_LECHE_BUFALA'));
  const [fechaDesde, setFechaDesde] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [fechaHasta, setFechaHasta] = useState(() => new Date().toISOString().split('T')[0]);

  // Consultar ciclos para sincronizar con semanas operativas
  const { data: ciclos = [] } = useQuery<CicloSemanalDto[]>({
    queryKey: ['ciclos-admin-general'],
    queryFn: () => finanzasApi.getCiclos(),
  });

  // Consultar datos de reportes consolidados
  const {
    data: adminData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['admin-general-rentabilidad', fechaDesde, fechaHasta],
    queryFn: async () => {
      const [resComp, resFincas, resChof] = await Promise.all([
        apiClient.get<any[]>('/reportes/relacion-companias', { params: { fechaInicio: fechaDesde, fechaFin: fechaHasta } }).catch(() => ({ data: [] })),
        apiClient.get<any[]>('/reportes/fincas', { params: { fechaInicio: fechaDesde, fechaFin: fechaHasta } }).catch(() => ({ data: [] })),
        apiClient.get<any[]>('/reportes/relacion-choferes', { params: { fechaInicio: fechaDesde, fechaFin: fechaHasta } }).catch(() => ({ data: [] })),
      ]);

      const companias = Array.isArray(resComp.data) ? resComp.data : [];
      const fincas = Array.isArray(resFincas.data) ? resFincas.data : [];
      const choferes = Array.isArray(resChof.data) ? resChof.data : [];

      // Cálculos consolidados
      let litrosCompradosVaca = 0;
      let litrosCompradosBufala = 0;
      let litrosCompradosAcida = 0;
      let totalCostoFincasUSD = 0;

      fincas.forEach((f) => {
        litrosCompradosVaca += Number(f.litrosVaca || f.totalLitros || 0);
        litrosCompradosBufala += Number(f.litrosBufala || 0);
        litrosCompradosAcida += Number(f.litrosAcida || 0);
        totalCostoFincasUSD += Number(f.totalUSD || f.montoUSD || 0);
      });

      const totalLitrosComprados = litrosCompradosVaca + litrosCompradosBufala + litrosCompradosAcida;

      let totalLitrosVendidos = 0;
      let totalVentasCompaniasUSD = 0;

      companias.forEach((c) => {
        totalLitrosVendidos += Number(c.totalLitros || c.litrosEntregados || 0);
        totalVentasCompaniasUSD += Number(c.totalUSD || c.montoUSD || (Number(c.totalLitros || 0) * Number(c.precioLitroUSD || 0.40)));
      });

      let totalFletesChoferesUSD = 0;
      choferes.forEach((ch) => {
        totalFletesChoferesUSD += Number(ch.totalFleteUSD || ch.totalUSD || 0);
      });

      const margenBrutoUSD = totalVentasCompaniasUSD - totalCostoFincasUSD;
      const margenNetoUSD = margenBrutoUSD - totalFletesChoferesUSD;
      const gananciaPorLitroUSD = totalLitrosComprados > 0 ? margenNetoUSD / totalLitrosComprados : 0;
      const mermaTransporteLitros = totalLitrosComprados - totalLitrosVendidos;
      const porcentajeMerma = totalLitrosComprados > 0 ? (mermaTransporteLitros / totalLitrosComprados) * 100 : 0;

      return {
        totalLitrosComprados,
        litrosCompradosVaca,
        litrosCompradosBufala,
        litrosCompradosAcida,
        totalCostoFincasUSD,
        totalLitrosVendidos,
        totalVentasCompaniasUSD,
        totalFletesChoferesUSD,
        margenBrutoUSD,
        margenNetoUSD,
        gananciaPorLitroUSD,
        mermaTransporteLitros,
        porcentajeMerma,
        companias,
        fincas,
        choferes,
      };
    },
  });

  const handleSeleccionarSemana = (cicloIdStr: string) => {
    if (!cicloIdStr) return;
    const ciclo = ciclos.find((c) => String(c.id) === cicloIdStr);
    if (ciclo && ciclo.fechaInicio && ciclo.fechaFin) {
      setFechaDesde(ciclo.fechaInicio.split('T')[0]);
      setFechaHasta(ciclo.fechaFin.split('T')[0]);
    }
  };

  const exportarExcel = () => {
    if (!adminData) {
      toast.error('No hay datos calculados para exportar');
      return;
    }

    const resumenData = [
      { Concepto: 'Total Litros Comprados en Finca', Valor: adminData.totalLitrosComprados, Unidad: 'Litros' },
      { Concepto: 'Litros Leche de Vaca', Valor: adminData.litrosCompradosVaca, Unidad: 'Litros' },
      ...(hasBufala ? [{ Concepto: 'Litros Leche de Búfala', Valor: adminData.litrosCompradosBufala, Unidad: 'Litros' }] : []),
      { Concepto: 'Litros Leche Ácida', Valor: adminData.litrosCompradosAcida, Unidad: 'Litros' },
      { Concepto: 'Total Litros Vendidos a Plantas', Valor: adminData.totalLitrosVendidos, Unidad: 'Litros' },
      { Concepto: 'Merma Neta en Ruta / Transporte', Valor: adminData.mermaTransporteLitros, Unidad: 'Litros' },
      { Concepto: 'Porcentaje de Merma', Valor: `${adminData.porcentajeMerma.toFixed(2)}%`, Unidad: '%' },
      { Concepto: 'Ingresos por Venta a Compañías', Valor: adminData.totalVentasCompaniasUSD, Unidad: 'USD ($)' },
      { Concepto: 'Costo de Leche en Finca', Valor: adminData.totalCostoFincasUSD, Unidad: 'USD ($)' },
      { Concepto: 'Margen Bruto de Operación', Valor: adminData.margenBrutoUSD, Unidad: 'USD ($)' },
      { Concepto: 'Gastos Choferes y Fletes', Valor: adminData.totalFletesChoferesUSD, Unidad: 'USD ($)' },
      { Concepto: 'Ganancia Operativa Neta', Valor: adminData.margenNetoUSD, Unidad: 'USD ($)' },
      { Concepto: 'Ganancia Neta por Litro', Valor: adminData.gananciaPorLitroUSD, Unidad: 'USD/Litro' },
    ];

    const wsResumen = XLSX.utils.json_to_sheet(resumenData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsResumen, 'Rentabilidad_General');
    XLSX.writeFile(wb, `Administracion_General_${fechaDesde}_al_${fechaHasta}.xlsx`);
    toast.success('Informe de Administración General exportado a Excel');
  };

  const columnasCompanias = [
    {
      key: 'companiaNombre',
      header: 'Compañía / Destino',
      cell: (row: any) => (
        <span className="font-bold text-slate-800 text-xs">
          {row.companiaNombre || row.nombreCompania || row.nombre || 'Compañía'}
        </span>
      ),
    },
    {
      key: 'totalLitros',
      header: 'Litros Recibidos',
      className: 'text-right',
      cell: (row: any) => (
        <span className="font-mono text-xs font-semibold text-slate-700">
          {Number(row.totalLitros || row.litrosEntregados || 0).toLocaleString()} Lts
        </span>
      ),
    },
    {
      key: 'precioLitroUSD',
      header: 'Precio Compra/Lt',
      className: 'text-right',
      cell: (row: any) => (
        <span className="font-mono text-xs text-slate-600">
          ${Number(row.precioLitroUSD || 0.40).toFixed(4)}
        </span>
      ),
    },
    {
      key: 'totalUSD',
      header: 'Total Facturado USD',
      className: 'text-right',
      cell: (row: any) => (
        <span className="font-mono text-xs font-black text-blue-900">
          ${Number(row.totalUSD || (Number(row.totalLitros || 0) * Number(row.precioLitroUSD || 0.40))).toFixed(2)}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* HEADER DE LA VISTA */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 bg-white rounded-2xl shadow-sm border border-gray-200">
        <div>
          <h2 className="text-lg font-bold text-blue-900 flex items-center gap-2">
            <Scale className="w-5 h-5 text-emerald-600" />
            Administración General & Balance de Rentabilidad
          </h2>
          <p className="text-xs text-gray-500">
            Consolidado financiero de compras en fincas, ingresos por plantas queseras, fletes y ganancia neta
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={exportarExcel}
            className="btn text-xs font-bold h-9 px-3 flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm"
          >
            <FileSpreadsheet className="w-4 h-4" /> Exportar Balance Excel
          </button>
        </div>
      </div>

      {/* SELECTOR DE PERÍODO / CICLOS */}
      <div className="p-4 bg-white rounded-xl shadow-xs border border-gray-200 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-gray-700">Semana Predefinida:</label>
            <select
              onChange={(e) => handleSeleccionarSemana(e.target.value)}
              className="form-input text-xs h-9 rounded-lg border border-slate-300 font-medium"
            >
              <option value="">Rango Manual / Personalizado</option>
              {ciclos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.codigo || `Semana #${c.numeroSemana} (${c.año})`}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-gray-700">Desde:</label>
            <input
              type="date"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
              className="form-input text-xs h-9 rounded-lg border border-slate-300 font-medium px-2"
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-gray-700">Hasta:</label>
            <input
              type="date"
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
              className="form-input text-xs h-9 rounded-lg border border-slate-300 font-medium px-2"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={() => refetch()}
          className="btn btn-outline text-xs font-bold h-9 px-3 flex items-center gap-1.5 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50"
        >
          <RefreshCw className="w-3.5 h-3.5 text-blue-600" /> Recalcular
        </button>
      </div>

      {/* KPIS DE RENTABILIDAD EJECUTIVA */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs text-gray-500 block font-medium">Ingresos Ventas Plantas</span>
          <span className="text-xl font-black text-blue-900 font-mono">
            ${Number(adminData?.totalVentasCompaniasUSD || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </span>
          <span className="text-[11px] text-gray-400 block mt-0.5">
            {Number(adminData?.totalLitrosVendidos || 0).toLocaleString()} Lts despachados
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs text-gray-500 block font-medium">Costo Leche en Fincas</span>
          <span className="text-xl font-black text-slate-700 font-mono">
            ${Number(adminData?.totalCostoFincasUSD || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </span>
          <span className="text-[11px] text-gray-400 block mt-0.5">
            {Number(adminData?.totalLitrosComprados || 0).toLocaleString()} Lts recibidos
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs text-gray-500 block font-medium">Margen Bruto</span>
          <span className={`text-xl font-black font-mono ${(adminData?.margenBrutoUSD || 0) >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
            ${Number(adminData?.margenBrutoUSD || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </span>
          <span className="text-[11px] text-gray-400 block mt-0.5">
            Fletes: -${Number(adminData?.totalFletesChoferesUSD || 0).toFixed(2)}
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs bg-linear-to-br from-emerald-50 to-white border-emerald-200">
          <span className="text-xs text-emerald-800 block font-bold">Ganancia Neta por Litro</span>
          <span className="text-2xl font-black text-emerald-800 font-mono">
            ${Number(adminData?.gananciaPorLitroUSD || 0).toFixed(4)}
          </span>
          <span className="text-[11px] text-emerald-700 font-semibold block mt-0.5">
            Total Neto: ${Number(adminData?.margenNetoUSD || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {/* BALANCE DE VOLÚMENES POR TIPO DE LECHE */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
        <h3 className="text-sm font-bold text-blue-900 flex items-center gap-2 mb-3">
          <Milk className="w-4 h-4 text-blue-600" />
          Desglose Volumétrico de Leche (Comprada vs Entregada)
        </h3>
        <div className={`grid grid-cols-2 ${hasBufala ? 'sm:grid-cols-4' : 'sm:grid-cols-3'} gap-3 text-xs`}>
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
            <span className="text-gray-500 block">Leche de Vaca:</span>
            <strong className="text-slate-800 text-sm font-mono block">
              {Number(adminData?.litrosCompradosVaca || 0).toLocaleString()} Lts
            </strong>
          </div>
          {hasBufala && (
            <div className="bg-teal-50 p-3 rounded-lg border border-teal-200">
              <span className="text-teal-700 font-semibold block">Leche de Búfala:</span>
              <strong className="text-teal-900 text-sm font-mono block">
                {Number(adminData?.litrosCompradosBufala || 0).toLocaleString()} Lts
              </strong>
            </div>
          )}
          <div className="bg-amber-50 p-3 rounded-lg border border-amber-200">
            <span className="text-amber-700 font-semibold block">Leche Ácida:</span>
            <strong className="text-amber-900 text-sm font-mono block">
              {Number(adminData?.litrosCompradosAcida || 0).toLocaleString()} Lts
            </strong>
          </div>
          <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
            <span className="text-blue-700 font-semibold block">Merma en Transporte:</span>
            <strong className="text-blue-900 text-sm font-mono block">
              {Number(adminData?.mermaTransporteLitros || 0).toLocaleString()} Lts ({Number(adminData?.porcentajeMerma || 0).toFixed(2)}%)
            </strong>
          </div>
        </div>
      </div>

      {/* TABLA DE RELACIÓN CON COMPAÑÍAS DESTINO */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-xs">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Building className="w-4 h-4 text-blue-600" />
            Entregas y Facturación a Compañías Receptoras
          </h3>
          <span className="text-xs text-gray-500 font-medium">
            {adminData?.companias?.length || 0} Compañías en el período
          </span>
        </div>
        <DataTable
          columns={columnasCompanias}
          data={adminData?.companias || []}
          isLoading={isLoading}
          emptyMessage="No se registraron entregas a compañías en este rango de fechas."
        />
      </div>
    </div>
  );
};

export default AdministracionGeneralPage;
