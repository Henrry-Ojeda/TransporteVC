import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import * as XLSX from 'xlsx';
import Swal from 'sweetalert2';
import { sistemaApi } from '@/api/sistema.api';
import { catalogosApi } from '@/api/catalogos.api';
import { DataTable, type ColumnDef } from '@/components/common/DataTable';
import { FincaSelect } from '@/components/selectors/FincaSelect';
import { ChoferSelect } from '@/components/selectors/ChoferSelect';
import { CompaniaSelect } from '@/components/selectors/CompaniaSelect';

export type TipoReporteOficial =
  | 'DIARIOS'
  | 'RECEPTORIAS'
  | 'FINCAS'
  | 'CHOFERES'
  | 'BANCOS'
  | 'RELACION_PAGOS'
  | 'RELACION_PAGOS_COMPANIAS'
  | 'RELACION_CHOFER';

const CATALOGO_REPORTES: { value: TipoReporteOficial; label: string; desc: string; icon: string; color: string }[] = [
  { value: 'DIARIOS', label: '1. DIARIOS', desc: 'Diarios de recolección y viajes operativos por día', icon: 'fa-calendar-days', color: '#2563eb' },
  { value: 'RECEPTORIAS', label: '2. RECEPTORIAS', desc: 'Descargas en silos, inventario y receptorías', icon: 'fa-warehouse', color: '#7c3aed' },
  { value: 'FINCAS', label: '3. FINCAS', desc: 'Volumen y liquidación de leche por finca ganadera', icon: 'fa-cow', color: '#059669' },
  { value: 'CHOFERES', label: '4. CHOFERES', desc: 'Desempeño, litros recogidos y balance sobrante/faltante', icon: 'fa-user-tie', color: '#0284c7' },
  { value: 'BANCOS', label: '5. BANCOS', desc: 'Dispersión y transferencias bancarias a productores', icon: 'fa-building-columns', color: '#d97706' },
  { value: 'RELACION_PAGOS', label: '6. RELACIÓN DE PAGOS A FINCAS', desc: 'Relación consolidada de liquidaciones a fincas', icon: 'fa-file-invoice-dollar', color: '#16a34a' },
  { value: 'RELACION_PAGOS_COMPANIAS', label: '7. RELACIÓN DE PAGOS DE COMPAÑÍAS', desc: 'Relación de entregas, facturación y cobros a compañías', icon: 'fa-building-wheat', color: '#9333ea' },
  { value: 'RELACION_CHOFER', label: '8. RELACIÓN CHOFER', desc: 'Relación individual detallada de viajes y entregas del chofer', icon: 'fa-truck-arrow-right', color: '#ea580c' },
];

export const ReportesPage: React.FC = () => {
  const [tipoReporte, setTipoReporte] = useState<TipoReporteOficial>('DIARIOS');
  const [fechaInicio, setFechaInicio] = useState(
    new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
  );
  const [fechaFin, setFechaFin] = useState(new Date().toISOString().split('T')[0]);

  // Filtros contextuales según reporte
  const [finca1Id, setFinca1Id] = useState<number | undefined>();
  const [finca2Id, setFinca2Id] = useState<number | undefined>();
  const [choferId, setChoferId] = useState<number | undefined>();
  const [companiaId, setCompaniaId] = useState<number | undefined>();
  const [bancoId, setBancoId] = useState<number | undefined>();

  // Catálogo de bancos para selector de BANCOS
  const { data: bancos = [] } = useQuery({
    queryKey: ['bancos-catalogo'],
    queryFn: () => catalogosApi.getBancos(),
    staleTime: 1000 * 60 * 10,
  });

  // Query maestro dinámico según tipoReporte
  const {
    data: datosReporte = [],
    isLoading,
    refetch,
    isFetching,
  } = useQuery<any[]>({
    queryKey: ['reporte-oficial', tipoReporte, fechaInicio, fechaFin, finca1Id, finca2Id, choferId, companiaId, bancoId],
    queryFn: async () => {
      switch (tipoReporte) {
        case 'DIARIOS':
          return await sistemaApi.getReporteDiarios(fechaInicio, fechaFin);
        case 'RECEPTORIAS':
          return await sistemaApi.getReporteReceptorias(fechaInicio, fechaFin, companiaId);
        case 'FINCAS': {
          const ids = [finca1Id, finca2Id].filter(Boolean);
          return await sistemaApi.getReporteFincas(fechaInicio, fechaFin, ids.length ? ids.join(',') : undefined);
        }
        case 'CHOFERES':
          return await sistemaApi.getReporteChoferes(fechaInicio, fechaFin, choferId);
        case 'BANCOS':
          return await sistemaApi.getReporteBancos(fechaInicio, fechaFin, bancoId);
        case 'RELACION_PAGOS':
          return await sistemaApi.getReporteRelacionPagos(fechaInicio, fechaFin, bancoId);
        case 'RELACION_PAGOS_COMPANIAS':
          return await sistemaApi.getReporteRelacionCompanias(fechaInicio, fechaFin, companiaId);
        case 'RELACION_CHOFER':
          return await sistemaApi.getReporteRelacionChoferes(fechaInicio, fechaFin);
        default:
          return [];
      }
    },
    staleTime: 1000 * 60 * 2,
  });

  const datosLista = useMemo(() => {
    if (!Array.isArray(datosReporte)) return [];
    if (tipoReporte === 'CHOFERES' && choferId) {
      return datosReporte.filter(
        (c: any) =>
          c.id === choferId ||
          c.Id === choferId ||
          c.usuarioId === choferId ||
          String(c.nombre || '').toLowerCase().includes(String(choferId).toLowerCase())
      );
    }
    if (tipoReporte === 'RELACION_CHOFER' && choferId) {
      return datosReporte.filter((r: any) => r.usuarioId === choferId || r.choferId === choferId);
    }
    return datosReporte;
  }, [datosReporte, tipoReporte, choferId]);

  const exportarExcel = () => {
    if (!datosLista.length) {
      Swal.fire({
        icon: 'info',
        title: 'Sin Datos',
        text: 'No hay registros cargados para exportar en este período.',
        confirmButtonColor: '#2563eb',
      });
      return;
    }
    const ws = XLSX.utils.json_to_sheet(datosLista);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, tipoReporte);
    XLSX.writeFile(wb, `Reporte_${tipoReporte}_${fechaInicio}_al_${fechaFin}.xlsx`);
  };

  // Esquemas de Columnas por Tipo de Reporte Oficial
  const columns: ColumnDef<any>[] = useMemo(() => {
    switch (tipoReporte) {
      case 'DIARIOS':
        return [
          {
            header: 'Fecha',
            accessorKey: 'fecha',
            sortable: true,
            cell: (row) => (
              <span style={{ fontWeight: 800, color: '#0f172a' }}>
                {row.fecha ? new Date(row.fecha).toLocaleDateString('es-VE') : (row.Fecha ? new Date(row.Fecha).toLocaleDateString('es-VE') : '-')}
              </span>
            ),
          },
          {
            header: 'Fincas Visitadas',
            accessorKey: 'fincasVisitadas',
            sortable: true,
            cell: (row) => (
              <span className="badge" style={{ background: '#f1f5f9', color: '#334155', fontWeight: 700 }}>
                {row.fincasVisitadas ?? row.FincasVisitadas ?? 0}
              </span>
            ),
          },
          {
            header: 'Litros Recolectados',
            accessorKey: 'totalLitros',
            sortable: true,
            cell: (row) => (
              <span style={{ fontWeight: 900, color: '#0284c7', fontFamily: 'monospace', fontSize: '13.5px' }}>
                {Number(row.totalLitros ?? row.TotalLitros ?? 0).toLocaleString()} <small>Lts</small>
              </span>
            ),
          },
          {
            header: 'Monto Total ($)',
            accessorKey: 'totalUSD',
            sortable: true,
            cell: (row) => (
              <span style={{ fontWeight: 800, color: '#059669', fontFamily: 'monospace' }}>
                ${Number(row.totalUSD ?? row.TotalUSD ?? 0).toFixed(2)}
              </span>
            ),
          },
        ];

      case 'RECEPTORIAS':
        return [
          {
            header: 'Fecha / Día',
            accessorKey: 'fecha',
            sortable: true,
            cell: (row) => (
              <span style={{ fontWeight: 700, color: '#0f172a' }}>
                {row.fecha ? new Date(row.fecha).toLocaleDateString('es-VE') : '-'}
              </span>
            ),
          },
          {
            header: 'Compañía / Planta',
            accessorKey: 'companiaNombre',
            sortable: true,
            cell: (row) => (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fa-solid fa-warehouse" style={{ color: '#7c3aed' }}></i>
                <span style={{ fontWeight: 700, color: '#0f172a' }}>
                  {row.companiaNombre || row.CompaniaNombre || `Planta #${row.companiaId || ''}`}
                </span>
              </div>
            ),
          },
          {
            header: 'Litros Descargados',
            accessorKey: 'litros',
            sortable: true,
            cell: (row) => (
              <span style={{ fontWeight: 900, color: '#7c3aed', fontFamily: 'monospace' }}>
                {Number(row.litros ?? row.Litros ?? row.litrosDescargados ?? 0).toLocaleString()} Lts
              </span>
            ),
          },
          {
            header: 'Observación / Guía',
            accessorKey: 'observacion',
            cell: (row) => <span style={{ color: '#64748b', fontSize: '12px' }}>{row.observacion || row.Observacion || '-'}</span>,
          },
        ];

      case 'FINCAS':
        return [
          {
            header: 'Finca Productora',
            accessorKey: 'fincaNombre',
            sortable: true,
            cell: (row) => (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fa-solid fa-cow" style={{ color: '#059669' }}></i>
                <div>
                  <div style={{ fontWeight: 800, color: '#0f172a' }}>
                    {row.fincaNombre || row.FincaNombre || row.nombre || `Finca #${row.fincaId || row.id}`}
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>
                    {row.propietarioNombre || row.PropietarioNombre || 'Productor'}
                  </div>
                </div>
              </div>
            ),
          },
          {
            header: 'Litros Totales',
            accessorKey: 'litrosTotales',
            sortable: true,
            cell: (row) => (
              <span style={{ fontWeight: 900, color: '#0284c7', fontFamily: 'monospace', fontSize: '13.5px' }}>
                {Number(row.litrosTotales ?? row.LitrosTotales ?? row.totalLitros ?? 0).toLocaleString()} Lts
              </span>
            ),
          },
          {
            header: 'Precio Promedio',
            accessorKey: 'precioPromedio',
            cell: (row) => (
              <span style={{ fontWeight: 700, color: '#334155', fontFamily: 'monospace' }}>
                ${Number(row.precioPromedio ?? row.PrecioPromedio ?? 0).toFixed(4)}
              </span>
            ),
          },
          {
            header: 'Total Liquidado ($)',
            accessorKey: 'totalUSD',
            sortable: true,
            cell: (row) => (
              <span style={{ fontWeight: 900, color: '#059669', fontFamily: 'monospace', fontSize: '13.5px' }}>
                ${Number(row.totalUSD ?? row.TotalUSD ?? 0).toFixed(2)}
              </span>
            ),
          },
        ];

      case 'CHOFERES':
        return [
          {
            header: 'Chofer Conductor',
            accessorKey: 'nombre',
            sortable: true,
            cell: (row) => (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fa-solid fa-user-tie" style={{ color: '#0284c7' }}></i>
                <span style={{ fontWeight: 800, color: '#0f172a' }}>
                  {row.nombre || row.Nombre || row.nombreCompleto || row.choferNombre || `Conductor #${row.id}`}
                </span>
              </div>
            ),
          },
          {
            header: 'Viajes Realizados',
            accessorKey: 'totalViajes',
            sortable: true,
            cell: (row) => (
              <span className="badge" style={{ background: '#e0f2fe', color: '#0369a1', fontWeight: 800 }}>
                {row.totalViajes ?? row.TotalViajes ?? 0} viajes
              </span>
            ),
          },
          {
            header: 'Litros Fincas',
            accessorKey: 'litrosFincas',
            sortable: true,
            cell: (row) => (
              <span style={{ fontWeight: 800, color: '#0284c7', fontFamily: 'monospace' }}>
                {Number(row.litrosFincas ?? row.LitrosFincas ?? row.totalLitros ?? 0).toLocaleString()} L
              </span>
            ),
          },
          {
            header: 'Litros Entregados',
            accessorKey: 'litrosEntregados',
            sortable: true,
            cell: (row) => (
              <span style={{ fontWeight: 800, color: '#059669', fontFamily: 'monospace' }}>
                {Number(row.litrosEntregados ?? row.LitrosEntregados ?? 0).toLocaleString()} L
              </span>
            ),
          },
          {
            header: 'Balance Sobrante/Faltante',
            accessorKey: 'diferenciaLitros',
            sortable: true,
            cell: (row) => {
              const diff = Number(row.diferenciaLitros ?? row.DiferenciaLitros ?? 0);
              const esPositivo = diff >= 0;
              return (
                <span
                  className="badge"
                  style={{
                    background: esPositivo ? '#ecfdf5' : '#fef2f2',
                    color: esPositivo ? '#059669' : '#dc2626',
                    border: `1px solid ${esPositivo ? '#a7f3d0' : '#fecaca'}`,
                    fontWeight: 900,
                    fontFamily: 'monospace',
                  }}
                >
                  {esPositivo ? `+${diff.toLocaleString()} L` : `${diff.toLocaleString()} L`}
                </span>
              );
            },
          },
        ];

      case 'BANCOS':
      case 'RELACION_PAGOS':
        return [
          {
            header: 'Banco / Entidad',
            accessorKey: 'bancoNombre',
            sortable: true,
            cell: (row) => (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fa-solid fa-building-columns" style={{ color: '#d97706' }}></i>
                <span style={{ fontWeight: 800, color: '#0f172a' }}>
                  {row.bancoNombre || row.BancoNombre || 'Sin Banco'}
                </span>
              </div>
            ),
          },
          {
            header: 'Productor Ganadero',
            accessorKey: 'propietarioNombre',
            sortable: true,
            cell: (row) => (
              <div>
                <div style={{ fontWeight: 700, color: '#0f172a' }}>
                  {row.propietarioNombre || row.PropietarioNombre || row.fincaNombre || '-'}
                </div>
                <div style={{ fontSize: '11px', color: '#64748b' }}>
                  {row.numeroCuenta || row.NumeroCuenta || 'Sin Nro Cuenta'}
                </div>
              </div>
            ),
          },
          {
            header: 'Litros Liquidados',
            accessorKey: 'litros',
            sortable: true,
            cell: (row) => (
              <span style={{ fontWeight: 800, color: '#0284c7', fontFamily: 'monospace' }}>
                {Number(row.litros ?? row.Litros ?? 0).toLocaleString()} L
              </span>
            ),
          },
          {
            header: 'Monto USD ($)',
            accessorKey: 'montoUSD',
            sortable: true,
            cell: (row) => (
              <span style={{ fontWeight: 800, color: '#059669', fontFamily: 'monospace' }}>
                ${Number(row.montoUSD ?? row.MontoUSD ?? 0).toFixed(2)}
              </span>
            ),
          },
          {
            header: 'Monto Bs (BCV)',
            accessorKey: 'montoBs',
            sortable: true,
            cell: (row) => (
              <span style={{ fontWeight: 800, color: '#0f172a', fontFamily: 'monospace' }}>
                Bs. {Number(row.montoBs ?? row.MontoBs ?? 0).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
              </span>
            ),
          },
        ];

      case 'RELACION_PAGOS_COMPANIAS':
        return [
          {
            header: 'Compañía / Quesera',
            accessorKey: 'companiaNombre',
            sortable: true,
            cell: (row) => (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fa-solid fa-building-wheat" style={{ color: '#9333ea' }}></i>
                <span style={{ fontWeight: 800, color: '#0f172a' }}>
                  {row.companiaNombre || row.CompaniaNombre || `Compañía #${row.companiaId}`}
                </span>
              </div>
            ),
          },
          {
            header: 'Litros Despachados',
            accessorKey: 'litrosDespachados',
            sortable: true,
            cell: (row) => (
              <span style={{ fontWeight: 800, color: '#2563eb', fontFamily: 'monospace' }}>
                {Number(row.litrosDespachados ?? row.LitrosDespachados ?? 0).toLocaleString()} L
              </span>
            ),
          },
          {
            header: 'Litros Confirmados',
            accessorKey: 'litrosConfirmados',
            sortable: true,
            cell: (row) => (
              <span style={{ fontWeight: 800, color: '#059669', fontFamily: 'monospace' }}>
                {Number(row.litrosConfirmados ?? row.LitrosConfirmados ?? 0).toLocaleString()} L
              </span>
            ),
          },
          {
            header: 'Monto Facturado ($)',
            accessorKey: 'totalUSD',
            sortable: true,
            cell: (row) => (
              <span style={{ fontWeight: 900, color: '#059669', fontFamily: 'monospace' }}>
                ${Number(row.totalUSD ?? row.TotalUSD ?? 0).toFixed(2)}
              </span>
            ),
          },
        ];

      case 'RELACION_CHOFER':
        return [
          {
            header: 'Fecha & Ticket',
            accessorKey: 'fecha',
            sortable: true,
            cell: (row) => (
              <div>
                <span style={{ fontWeight: 800, color: '#0f172a' }}>
                  {row.fecha ? new Date(row.fecha).toLocaleDateString('es-VE') : '-'}
                </span>
                <div style={{ fontSize: '11px', color: '#2563eb', fontFamily: 'monospace', fontWeight: 700 }}>
                  {row.codigoTicket || row.ticketCodigo || 'TKT-S/C'}
                </div>
              </div>
            ),
          },
          {
            header: 'Chofer',
            accessorKey: 'chofer',
            sortable: true,
            cell: (row) => (
              <span style={{ fontWeight: 700, color: '#0f172a' }}>
                {row.chofer || row.choferNombre || '-'}
              </span>
            ),
          },
          {
            header: 'Finca Recolectada',
            accessorKey: 'fincaNombre',
            sortable: true,
            cell: (row) => (
              <span style={{ fontWeight: 700, color: '#059669' }}>
                {row.fincaNombre || row.FincaNombre || '-'}
              </span>
            ),
          },
          {
            header: 'Litros Finca',
            accessorKey: 'litros',
            sortable: true,
            cell: (row) => (
              <span style={{ fontWeight: 900, color: '#0284c7', fontFamily: 'monospace' }}>
                {Number(row.litros ?? row.Litros ?? 0).toLocaleString()} L
              </span>
            ),
          },
          {
            header: 'Destino / Planta',
            accessorKey: 'destinoNombre',
            cell: (row) => (
              <span style={{ color: '#64748b', fontSize: '12.5px' }}>
                {row.destinoNombre || row.companiaNombre || 'En Tránsito'}
              </span>
            ),
          },
        ];

      default:
        return [];
    }
  }, [tipoReporte]);

  const reporteActual = CATALOGO_REPORTES.find((r) => r.value === tipoReporte) || CATALOGO_REPORTES[0];

  return (
    <div>
      {/* HEADER BANNER */}
      <div
        className="content-card"
        style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          color: '#ffffff',
          borderRadius: '16px',
          padding: '22px 26px',
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
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: 'rgba(255, 255, 255, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '22px',
              color: reporteActual.color,
            }}
          >
            <i className={`fa-solid ${reporteActual.icon}`}></i>
          </div>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: 800, margin: 0, color: '#ffffff' }}>
              Reportes Generales y Liquidaciones Oficiales
            </h1>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#94a3b8' }}>
              {reporteActual.label} — {reporteActual.desc}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={exportarExcel}
            disabled={!datosLista.length || isLoading}
            className="btn btn-outline"
            style={{
              height: '40px',
              borderColor: '#10b981',
              color: '#10b981',
              background: 'rgba(16, 185, 129, 0.1)',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <i className="fa-solid fa-file-excel"></i> Exportar Excel
          </button>
        </div>
      </div>

      {/* PANEL DE FILTROS Y SELECCIÓN DE REPORTE */}
      <div
        className="content-card"
        style={{
          background: '#ffffff',
          borderRadius: '16px',
          padding: '20px',
          marginBottom: '20px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', alignItems: 'end' }}>
          {/* SELECTOR MAESTRO DE LOS 8 REPORTES OFICIALES */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#1e293b', marginBottom: '6px' }}>
              <i className="fa-solid fa-chart-pie" style={{ color: '#2563eb', marginRight: '6px' }}></i>
              Tipo de Reporte Oficial *
            </label>
            <select
              value={tipoReporte}
              onChange={(e) => setTipoReporte(e.target.value as TipoReporteOficial)}
              className="form-input"
              style={{
                width: '100%',
                height: '40px',
                fontWeight: 700,
                color: '#0f172a',
                border: '1.5px solid #cbd5e1',
                borderRadius: '8px',
              }}
            >
              {CATALOGO_REPORTES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          {/* RANGO DE FECHAS */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                Fecha Desde
              </label>
              <input
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                className="form-input"
                style={{ width: '100%', height: '40px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                Fecha Hasta
              </label>
              <input
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
                className="form-input"
                style={{ width: '100%', height: '40px' }}
              />
            </div>
          </div>

          {/* FILTROS CONTEXTUALES SEGÚN REPORTE */}
          {tipoReporte === 'FINCAS' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                  Finca 1 (Filtro / Principal)
                </label>
                <FincaSelect
                  value={finca1Id}
                  onChange={(val) => setFinca1Id(val)}
                  placeholder="-- Todas las fincas --"
                  allowClear
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                  Finca 2 (Comparación Dual)
                </label>
                <FincaSelect
                  value={finca2Id}
                  onChange={(val) => setFinca2Id(val)}
                  placeholder="-- Comparar con... --"
                  allowClear
                />
              </div>
            </div>
          )}

          {(tipoReporte === 'CHOFERES' || tipoReporte === 'RELACION_CHOFER') && (
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                Filtrar por Conductor
              </label>
              <ChoferSelect
                value={choferId}
                onChange={(val) => setChoferId(val)}
                placeholder="-- Todos los conductores --"
                allowClear
              />
            </div>
          )}

          {(tipoReporte === 'RECEPTORIAS' || tipoReporte === 'RELACION_PAGOS_COMPANIAS') && (
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                Filtrar por Compañía / Planta
              </label>
              <CompaniaSelect
                value={companiaId}
                onChange={(val) => setCompaniaId(val)}
                placeholder="-- Todas las compañías --"
                allowClear
              />
            </div>
          )}

          {(tipoReporte === 'BANCOS' || tipoReporte === 'RELACION_PAGOS') && (
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                Filtrar por Banco
              </label>
              <select
                value={bancoId || ''}
                onChange={(e) => setBancoId(e.target.value ? Number(e.target.value) : undefined)}
                className="form-input"
                style={{ width: '100%', height: '40px' }}
              >
                <option value="">-- Todos los bancos --</option>
                {bancos.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.nombre} {(b as any).codigoSudeban ? `(${(b as any).codigoSudeban})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* BOTÓN CONSULTAR */}
          <div>
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isLoading || isFetching}
              className="btn btn-primary"
              style={{
                width: '100%',
                height: '40px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                background: reporteActual.color,
                borderColor: reporteActual.color,
              }}
            >
              <i className={`fa-solid ${isFetching ? 'fa-spinner fa-spin' : 'fa-magnifying-glass'}`}></i>
              {isFetching ? 'Consultando...' : 'Consultar Reporte'}
            </button>
          </div>
        </div>
      </div>

      {/* TABLA PRINCIPAL DEL REPORTE */}
      <DataTable
        data={datosLista}
        columns={columns}
        isLoading={isLoading || isFetching}
        searchPlaceholder={`Buscar en ${reporteActual.label}...`}
        exportFileName={`Reporte_${tipoReporte}_${fechaInicio}_al_${fechaFin}`}
      />
    </div>
  );
};

export default ReportesPage;
