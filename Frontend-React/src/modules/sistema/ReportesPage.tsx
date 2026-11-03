import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import * as XLSX from 'xlsx';
import { sistemaApi } from '@/api/sistema.api';
import { DataTable, type ColumnDef } from '@/components/common/DataTable';

export const ReportesPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'diarios' | 'fincas' | 'companias'>('diarios');
  const [fechaInicio, setFechaInicio] = useState(
    new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
  );
  const [fechaFin, setFechaFin] = useState(new Date().toISOString().split('T')[0]);

  // Queries
  const { data: reporteDiario = [], isLoading: loadingDiario, refetch: refetchDiario } = useQuery<any[]>({
    queryKey: ['reporte-diario', fechaInicio, fechaFin],
    queryFn: () => sistemaApi.getReporteDiarios(fechaInicio, fechaFin),
    enabled: activeTab === 'diarios',
  });

  const { data: reporteFincas = [], isLoading: loadingFincas, refetch: refetchFincas } = useQuery<any[]>({
    queryKey: ['reporte-fincas', fechaInicio, fechaFin],
    queryFn: () => sistemaApi.getReporteFincas(fechaInicio, fechaFin),
    enabled: activeTab === 'fincas',
  });

  const { data: reporteCompanias = [], isLoading: loadingCompanias, refetch: refetchCompanias } = useQuery<any[]>({
    queryKey: ['reporte-companias', fechaInicio, fechaFin],
    queryFn: () => sistemaApi.getReporteCompanias(fechaInicio, fechaFin),
    enabled: activeTab === 'companias',
  });

  const ejecutarBusqueda = () => {
    if (activeTab === 'diarios') refetchDiario();
    else if (activeTab === 'fincas') refetchFincas();
    else refetchCompanias();
  };

  const exportarExcel = () => {
    const datos = activeTab === 'diarios' ? reporteDiario : (activeTab === 'fincas' ? reporteFincas : reporteCompanias);
    if (!datos.length) return;
    const ws = XLSX.utils.json_to_sheet(datos);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Reporte');
    XLSX.writeFile(wb, `Reporte_${activeTab}_${fechaInicio}_al_${fechaFin}.xlsx`);
  };

  const columnsDiarios: ColumnDef<any>[] = [
    {
      header: 'Fecha',
      accessorKey: 'fecha',
      sortable: true,
      cell: (row) => (
        <span style={{ fontWeight: 700, color: '#0f172a' }}>
          {row.fecha ? new Date(row.fecha).toLocaleDateString('es-VE') : '-'}
        </span>
      ),
    },
    {
      header: 'Fincas Visitadas',
      accessorKey: 'fincasVisitadas',
      sortable: true,
      cell: (row) => <span style={{ fontWeight: 700, color: '#334155' }}>{row.fincasVisitadas || 0}</span>,
    },
    {
      header: 'Litros Recolectados',
      accessorKey: 'totalLitros',
      sortable: true,
      cell: (row) => (
        <span style={{ fontWeight: 900, color: '#0284c7', fontFamily: 'monospace' }}>
          {(row.totalLitros || 0).toLocaleString()} L
        </span>
      ),
    },
    {
      header: 'Monto Total ($)',
      accessorKey: 'totalUSD',
      sortable: true,
      cell: (row) => (
        <span style={{ fontWeight: 800, color: '#059669', fontFamily: 'monospace' }}>
          ${Number(row.totalUSD || 0).toFixed(2)}
        </span>
      ),
    },
  ];

  const columnsFincas: ColumnDef<any>[] = [
    {
      header: 'Código & Finca',
      accessorKey: 'fincaNombre',
      sortable: true,
      cell: (row) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <i className="fa-solid fa-cow" style={{ color: '#0284c7' }}></i>
          <div>
            <div style={{ fontWeight: 700, color: '#0f172a' }}>{row.fincaNombre || `Finca #${row.fincaId}`}</div>
            <div style={{ fontSize: '11px', color: '#64748b' }}>{row.propietarioNombre || 'Productor'}</div>
          </div>
        </div>
      ),
    },
    {
      header: 'Litros Entregados',
      accessorKey: 'litrosTotales',
      sortable: true,
      cell: (row) => (
        <span style={{ fontWeight: 900, color: '#0284c7', fontFamily: 'monospace' }}>
          {(row.litrosTotales || 0).toLocaleString()} L
        </span>
      ),
    },
    {
      header: 'Precio Prom. ($/Lt)',
      accessorKey: 'precioPromedio',
      cell: (row) => (
        <span style={{ fontWeight: 700, color: '#334155', fontFamily: 'monospace' }}>
          ${Number(row.precioPromedio || 0).toFixed(4)}
        </span>
      ),
    },
    {
      header: 'Total Liquidado ($)',
      accessorKey: 'totalUSD',
      sortable: true,
      cell: (row) => (
        <span style={{ fontWeight: 900, color: '#059669', fontFamily: 'monospace' }}>
          ${Number(row.totalUSD || 0).toFixed(2)}
        </span>
      ),
    },
  ];

  const columnsCompanias: ColumnDef<any>[] = [
    {
      header: 'Compañía / Planta',
      accessorKey: 'companiaNombre',
      sortable: true,
      cell: (row) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <i className="fa-solid fa-building" style={{ color: '#059669' }}></i>
          <span style={{ fontWeight: 700, color: '#0f172a' }}>{row.companiaNombre || `Planta #${row.companiaId}`}</span>
        </div>
      ),
    },
    {
      header: 'Litros Despachados',
      accessorKey: 'litrosDespachados',
      sortable: true,
      cell: (row) => (
        <span style={{ fontWeight: 800, color: '#2563eb', fontFamily: 'monospace' }}>
          {(row.litrosDespachados || 0).toLocaleString()} L
        </span>
      ),
    },
    {
      header: 'Litros Confirmados',
      accessorKey: 'litrosConfirmados',
      sortable: true,
      cell: (row) => (
        <span style={{ fontWeight: 800, color: '#059669', fontFamily: 'monospace' }}>
          {(row.litrosConfirmados || 0).toLocaleString()} L
        </span>
      ),
    },
    {
      header: 'Monto Facturado ($)',
      accessorKey: 'totalUSD',
      sortable: true,
      cell: (row) => (
        <span style={{ fontWeight: 900, color: '#059669', fontFamily: 'monospace' }}>
          ${Number(row.totalUSD || 0).toFixed(2)}
        </span>
      ),
    },
  ];

  return (
    <div>
      {/* HEADER BANNER 1:1 */}
      <div
        className="content-card"
        style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          color: '#ffffff',
          borderRadius: '16px',
          padding: '20px 24px',
          marginBottom: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          boxShadow: '0 10px 25px rgba(15,23,42,0.3)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              background: 'rgba(56, 189, 248, 0.15)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              color: '#38bdf8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '22px',
            }}
          >
            <i className="fa-solid fa-file-invoice-dollar"></i>
          </div>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '0.5px', margin: 0, color: '#fff' }}>
              INFORMACIÓN GENERAL / REPORTES
            </h2>
            <span style={{ fontSize: '12.5px', color: '#cbd5e1', fontWeight: 500 }}>
              Generación de balances, nómina bancaria y resumen integral de recolección
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => window.print()}
            style={{
              borderRadius: '8px',
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: 600,
              background: 'rgba(255,255,255,0.1)',
              borderColor: 'rgba(255,255,255,0.25)',
              color: '#fff',
            }}
          >
            <i className="fa-solid fa-print" style={{ marginRight: '6px' }}></i> Imprimir / PDF
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={exportarExcel}
            style={{
              borderRadius: '8px',
              padding: '8px 18px',
              fontSize: '13px',
              fontWeight: 800,
              background: 'linear-gradient(135deg, #10b981, #059669)',
              border: 'none',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.35)',
            }}
          >
            <i className="fa-solid fa-file-excel" style={{ marginRight: '6px' }}></i> Exportar
          </button>
        </div>
      </div>

      {/* PANEL BUSCAR REPORTES */}
      <div className="content-card" style={{ marginBottom: '20px', padding: '0', overflow: 'hidden' }}>
        <div
          style={{
            background: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
            padding: '14px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="fa-solid fa-magnifying-glass" style={{ color: '#0284c7' }}></i> PARÁMETROS DE BÚSQUEDA
          </span>
          <span className="badge" style={{ background: '#e0f2fe', color: '#0284c7', fontWeight: 700, fontSize: '11px' }}>
            Filtros Operativos
          </span>
        </div>

        <div style={{ padding: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr)) 140px', gap: '16px', alignItems: 'flex-end' }}>
            <div>
              <label style={{ fontSize: '12px', color: '#1e293b', fontWeight: 700, display: 'block', marginBottom: '6px' }}>
                Desde:
              </label>
              <input
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                className="form-input"
                style={{ height: '42px', fontSize: '13.5px', fontWeight: 600, width: '100%' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '12px', color: '#1e293b', fontWeight: 700, display: 'block', marginBottom: '6px' }}>
                Hasta:
              </label>
              <input
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
                className="form-input"
                style={{ height: '42px', fontSize: '13.5px', fontWeight: 600, width: '100%' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '12px', color: '#1e293b', fontWeight: 700, display: 'block', marginBottom: '6px' }}>
                Tipo de Reporte:
              </label>
              <select
                value={activeTab}
                onChange={(e) => setActiveTab(e.target.value as any)}
                className="form-input"
                style={{ height: '42px', fontSize: '13.5px', fontWeight: 700, color: '#0f172a', width: '100%' }}
              >
                <option value="diarios">📅 Resumen Diario de Recolección</option>
                <option value="fincas">🏡 Acopio por Fincas & Productores</option>
                <option value="companias">🏢 Entregas & Facturación Compañías</option>
              </select>
            </div>

            <div>
              <button
                type="button"
                className="btn btn-primary"
                onClick={ejecutarBusqueda}
                style={{
                  height: '42px',
                  width: '100%',
                  fontWeight: 800,
                  fontSize: '13.5px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  borderRadius: '8px',
                  background: '#0284c7',
                  border: 'none',
                }}
              >
                <i className="fa-solid fa-magnifying-glass"></i> Buscar
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* RESULTADOS */}
      {activeTab === 'diarios' && (
        <DataTable
          data={reporteDiario}
          columns={columnsDiarios}
          isLoading={loadingDiario}
          searchPlaceholder="Buscar en reporte diario..."
          exportFileName="reporte_diarios"
        />
      )}

      {activeTab === 'fincas' && (
        <DataTable
          data={reporteFincas}
          columns={columnsFincas}
          isLoading={loadingFincas}
          searchPlaceholder="Buscar por finca o productor..."
          exportFileName="reporte_fincas"
        />
      )}

      {activeTab === 'companias' && (
        <DataTable
          data={reporteCompanias}
          columns={columnsCompanias}
          isLoading={loadingCompanias}
          searchPlaceholder="Buscar por compañía o planta..."
          exportFileName="reporte_companias"
        />
      )}
    </div>
  );
};

export default ReportesPage;
