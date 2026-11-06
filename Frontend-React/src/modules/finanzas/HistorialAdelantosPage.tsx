import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { finanzasApi } from '@/api/finanzas.api';
import { bcvApi } from '@/api/bcv.api';
import { DataTable, type ColumnDef } from '@/components/common/DataTable';
import {
  ModalEditarCuota,
  ModalDividirCuota,
  ModalPosponerCuota,
  ModalReestructurarCuotas,
  SubRowCuotas,
} from './components/AdelantosCommonModals';
import type { AdelantoDto, CicloSemanalDto } from '@/types';

export const HistorialAdelantosPage: React.FC = () => {
  const queryClient = useQueryClient();

  const [filtroTipoEntidad, setFiltroTipoEntidad] = useState<string>('');
  const [filtroEstado, setFiltroEstado] = useState<string>('');
  const [expandedRows, setExpandedRows] = useState<Record<number, boolean>>({});

  // Modales
  const [modalEditarCuotaOpen, setModalEditarCuotaOpen] = useState(false);
  const [modalDividirCuotaOpen, setModalDividirCuotaOpen] = useState(false);
  const [modalPosponerCuotaOpen, setModalPosponerCuotaOpen] = useState(false);
  const [modalReestructurarOpen, setModalReestructurarOpen] = useState(false);

  const [adelantoSeleccionado, setAdelantoSeleccionado] = useState<any | null>(null);
  const [cuotaSeleccionada, setCuotaSeleccionada] = useState<any | null>(null);

  // 1. Cargar todos los adelantos
  const { data: adelantosRaw = [], isLoading } = useQuery<AdelantoDto[]>({
    queryKey: ['historial-adelantos', filtroTipoEntidad],
    queryFn: () => finanzasApi.getAdelantos(filtroTipoEntidad || undefined),
  });

  // 2. Semanas para modales
  const { data: semanas = [] } = useQuery<CicloSemanalDto[]>({
    queryKey: ['ciclos-semanas'],
    queryFn: () => finanzasApi.getCiclos(),
  });

  // Normalización
  const adelantos = useMemo(() => {
    return adelantosRaw.map((a: any) => {
      const id = a.id ?? a.Id ?? 0;
      const montoTotal = Number(a.montoTotalUSD ?? a.MontoTotalUSD ?? a.montoUSD ?? a.MontoUSD ?? a.monto ?? 0);
      const saldoPend = Number(a.montoPendienteUSD ?? a.MontoPendienteUSD ?? a.saldoPendienteUSD ?? a.SaldoPendienteUSD ?? 0);
      const montoPag = Number(a.montoPagadoUSD ?? a.MontoPagadoUSD ?? Math.max(0, montoTotal - saldoPend));
      const tipoEnt = a.tipoEntidad ?? a.TipoEntidad ?? 'FINCA';
      const entidadNom = a.entidadNombre ?? a.EntidadNombre ?? a.fincaNombre ?? a.FincaNombre ?? a.companiaNombre ?? a.usuarioNombre ?? 'Entidad';
      const fSol = (a.fechaSolicitud ?? a.FechaSolicitud ?? a.fecha ?? a.Fecha ?? '').split('T')[0] || '-';
      const cuotasList = a.cuotas || a.Cuotas || [];
      const numCuotas = Number(a.numeroCuotas ?? a.NumeroCuotas ?? (cuotasList.length > 0 ? cuotasList.length : 1));
      const cuotaUSD = numCuotas > 0 ? Number((montoTotal / numCuotas).toFixed(2)) : montoTotal;
      const est = String(a.estado || a.Estado || (saldoPend <= 0.001 ? 'PAGADO' : 'ACTIVO')).toUpperCase();

      return {
        ...a,
        id,
        tipoEntidad: tipoEnt,
        entidadNombre: entidadNom,
        fechaSolicitud: fSol,
        montoTotalUSD: montoTotal,
        montoPendienteUSD: saldoPend,
        montoPagadoUSD: montoPag,
        numeroCuotas: numCuotas,
        cuotaUSD,
        estado: est,
        cuotas: cuotasList,
      };
    });
  }, [adelantosRaw]);

  // Filtrado
  const adelantosFiltrados = useMemo(() => {
    return adelantos.filter((a) => {
      if (filtroEstado === 'ACTIVO' && a.montoPendienteUSD <= 0.001) return false;
      if (filtroEstado === 'PAGADO' && a.montoPendienteUSD > 0.001) return false;
      return true;
    });
  }, [adelantos, filtroEstado]);

  // 4 KPIs 1:1 con tab-historial-adelantos
  const kpis = useMemo(() => {
    let totalAdelantado = 0;
    let totalCobrado = 0;
    let totalPendiente = 0;
    let cuotasPospuestas = 0;
    let cuotasCobradas = 0;
    let cuotasPendientes = 0;

    adelantos.forEach((a) => {
      totalAdelantado += a.montoTotalUSD;
      totalCobrado += a.montoPagadoUSD;
      totalPendiente += a.montoPendienteUSD;

      (a.cuotas || []).forEach((c: any) => {
        const est = String(c.estado || '').toUpperCase();
        if (est === 'POSPUESTO') cuotasPospuestas++;
        if (est === 'COBRADO') cuotasCobradas++;
        if (est === 'PENDIENTE') cuotasPendientes++;
      });
    });

    return {
      totalAdelantadoUSD: totalAdelantado,
      totalCobradoUSD: totalCobrado,
      totalPendienteUSD: totalPendiente,
      cuotasPospuestas,
      cantTotal: adelantos.length,
      cuotasCobradas,
      cuotasPendientes,
    };
  }, [adelantos]);

  const toggleRow = (id: number) => {
    setExpandedRows((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const exportarHistorialExcel = () => {
    if (adelantosFiltrados.length === 0) {
      toast.info('No hay registros para exportar');
      return;
    }
    const dataExcel = adelantosFiltrados.map((a) => ({
      'ID Adelanto': a.id,
      'Fecha Solicitud': a.fechaSolicitud,
      'Tipo Entidad': a.tipoEntidad,
      'Productor / Receptoría': a.entidadNombre,
      'Total ($ USD)': a.montoTotalUSD,
      'Cuotas': a.numeroCuotas,
      'Cobrado ($)': a.montoPagadoUSD,
      'Pendiente ($)': a.montoPendienteUSD,
      'Estado': a.estado,
      'Motivo': a.motivo || a.observacion || '',
    }));
    const ws = XLSX.utils.json_to_sheet(dataExcel);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Historial_Adelantos');
    XLSX.writeFile(wb, `Historial_Adelantos_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const columns = useMemo<ColumnDef<any>[]>(() => [
    {
      id: 'expand',
      header: '',
      size: 40,
      cell: ({ row }) => {
        const isExp = !!expandedRows[row.id];
        return (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleRow(row.id);
            }}
            title={isExp ? 'Ocultar cuotas' : 'Ver cuotas'}
            style={{
              width: '26px',
              height: '26px',
              borderRadius: '6px',
              border: `1px solid ${isExp ? '#bfdbfe' : '#cbd5e1'}`,
              background: isExp ? '#eff6ff' : '#ffffff',
              color: isExp ? '#2563eb' : '#64748b',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '11px',
              fontWeight: 900,
            }}
          >
            <i className={`fa-solid ${isExp ? 'fa-minus' : 'fa-plus'}`}></i>
          </button>
        );
      },
    },
    {
      accessorKey: 'id',
      header: '# ID',
      size: 70,
      cell: ({ row }) => <span style={{ fontWeight: 800, color: '#334155' }}>#{row.id}</span>,
    },
    {
      accessorKey: 'fechaSolicitud',
      header: 'FECHA SOL.',
      size: 110,
      cell: ({ row }) => <span style={{ fontSize: '12px', fontWeight: 600 }}>{row.fechaSolicitud}</span>,
    },
    {
      accessorKey: 'tipoEntidad',
      header: 'TIPO',
      size: 120,
      cell: ({ row }) => (
        <span
          style={{
            fontSize: '10.5px',
            fontWeight: 800,
            padding: '2px 7px',
            borderRadius: '6px',
            background: row.tipoEntidad === 'FINCA' ? '#ecfdf5' : row.tipoEntidad === 'COMPANIA' ? '#eef2ff' : '#eff6ff',
            color: row.tipoEntidad === 'FINCA' ? '#047857' : row.tipoEntidad === 'COMPANIA' ? '#4f46e5' : '#1d4ed8',
            border: `1px solid ${row.tipoEntidad === 'FINCA' ? '#a7f3d0' : row.tipoEntidad === 'COMPANIA' ? '#c7d2fe' : '#bfdbfe'}`,
          }}
        >
          {row.tipoEntidad}
        </span>
      ),
    },
    {
      accessorKey: 'entidadNombre',
      header: 'PRODUCTOR / RECEPTORÍA',
      cell: ({ row }) => (
        <div>
          <div style={{ fontWeight: 800, color: '#0f172a' }}>{row.entidadNombre}</div>
          {row.observacion && (
            <div style={{ fontSize: '11px', color: '#64748b' }}>{row.observacion}</div>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'montoTotalUSD',
      header: 'TOTAL ($)',
      cell: ({ row }) => (
        <div style={{ textAlign: 'right', fontWeight: 900, color: '#0f172a' }}>
          $ {row.montoTotalUSD.toFixed(2)}
        </div>
      ),
    },
    {
      accessorKey: 'numeroCuotas',
      header: 'CUOTAS',
      cell: ({ row }) => (
        <div style={{ textAlign: 'center', fontWeight: 800 }}>
          {row.numeroCuotas}
        </div>
      ),
    },
    {
      accessorKey: 'montoPagadoUSD',
      header: 'COBRADO ($)',
      cell: ({ row }) => (
        <div style={{ textAlign: 'right', fontWeight: 800, color: '#10b981' }}>
          $ {row.montoPagadoUSD.toFixed(2)}
        </div>
      ),
    },
    {
      accessorKey: 'montoPendienteUSD',
      header: 'PENDIENTE ($)',
      cell: ({ row }) => {
        const pend = row.montoPendienteUSD;
        return (
          <div style={{ textAlign: 'right', fontWeight: 900, color: pend > 0 ? '#b45309' : '#15803d' }}>
            $ {pend.toFixed(2)}
          </div>
        );
      },
    },
    {
      accessorKey: 'estado',
      header: 'ESTADO',
      cell: ({ row }) => {
        const isPagado = row.montoPendienteUSD <= 0.001 || row.estado === 'PAGADO';
        return (
          <div style={{ textAlign: 'center' }}>
            <span
              style={{
                fontSize: '10px',
                fontWeight: 800,
                padding: '3px 8px',
                borderRadius: '6px',
                display: 'inline-block',
                background: isPagado ? '#dcfce7' : '#fef3c7',
                color: isPagado ? '#15803d' : '#b45309',
                border: `1px solid ${isPagado ? '#86efac' : '#fde68a'}`,
              }}
            >
              {isPagado ? 'PAGADO' : 'ACTIVO'}
            </span>
          </div>
        );
      },
    },
    {
      id: 'acciones',
      header: 'ACCIONES',
      cell: ({ row }) => (
        <div style={{ display: 'flex', gap: '5px', justifyContent: 'center' }}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setAdelantoSeleccionado(row);
              setModalReestructurarOpen(true);
            }}
            title="Reestructurar plan de pagos"
            style={{
              background: '#eff6ff',
              color: '#2563eb',
              border: '1px solid #bfdbfe',
              borderRadius: '6px',
              padding: '4px 8px',
              fontSize: '11px',
              cursor: 'pointer',
            }}
          >
            <i className="fa-solid fa-calculator"></i>
          </button>
        </div>
      ),
    },
  ], [expandedRows]);

  return (
    <div className="view-container">
      {/* HEADER */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '15px',
          marginBottom: '20px',
        }}
      >
        <div>
          <h1 className="view-title">
            <i className="fa-solid fa-clock-rotate-left" style={{ color: '#2563eb', marginRight: '8px' }}></i>
            Historial General de Adelantos &amp; Abonos
          </h1>
          <p className="view-subtitle">
            Consolidado histórico de préstamos, cuotas cobradas, saldos pendientes y posposiciones (Fincas y Receptorías)
          </p>
        </div>
        <div className="view-actions" style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            onClick={exportarHistorialExcel}
            className="btn btn-success"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontWeight: 700,
              padding: '9px 16px',
              background: '#10b981',
              border: 'none',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.35)',
              color: '#ffffff',
            }}
          >
            <i className="fa-solid fa-file-excel"></i> Exportar a Excel
          </button>
        </div>
      </div>

      {/* 4 KPIS HISTORIAL (1:1 V2_3_11_26) */}
      <div className="kpi-grid" style={{ marginBottom: '24px' }}>
        <div className="kpi-card glass-blue">
          <div className="kpi-icon-wrap"><i className="fa-solid fa-vault"></i></div>
          <div className="kpi-content">
            <span className="kpi-title">Monto Total Adelantado</span>
            <div className="kpi-value">
              $ {kpis.totalAdelantadoUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <span className="kpi-foot">{kpis.cantTotal} Adelantos en total</span>
          </div>
        </div>

        <div className="kpi-card glass-emerald">
          <div className="kpi-icon-wrap"><i className="fa-solid fa-circle-check"></i></div>
          <div className="kpi-content">
            <span className="kpi-title">Total Cobrado (Saldado)</span>
            <div className="kpi-value">
              $ {kpis.totalCobradoUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <span className="kpi-foot">{kpis.cuotasCobradas} Cuotas cobradas</span>
          </div>
        </div>

        <div className="kpi-card glass-amber">
          <div className="kpi-icon-wrap"><i className="fa-solid fa-clock"></i></div>
          <div className="kpi-content">
            <span className="kpi-title">Saldo Pendiente Actual</span>
            <div className="kpi-value">
              $ {kpis.totalPendienteUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <span className="kpi-foot">{kpis.cuotasPendientes} Cuotas por cobrar</span>
          </div>
        </div>

        <div className="kpi-card glass-purple">
          <div className="kpi-icon-wrap"><i className="fa-solid fa-calendar-minus"></i></div>
          <div className="kpi-content">
            <span className="kpi-title">Cuotas Pospuestas</span>
            <div className="kpi-value">{kpis.cuotasPospuestas}</div>
            <span className="kpi-foot">Reprogramadas</span>
          </div>
        </div>
      </div>

      {/* DATATABLE */}
      <div className="content-card">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
            marginBottom: '16px',
            paddingBottom: '14px',
            borderBottom: '1px solid #f1f5f9',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div>
              <select
                value={filtroTipoEntidad}
                onChange={(e) => setFiltroTipoEntidad(e.target.value)}
                className="form-input"
                style={{ height: '38px', fontSize: '13px', fontWeight: 600, padding: '0 10px' }}
              >
                <option value="">TODAS LAS ENTIDADES</option>
                <option value="FINCA">SOLO FINCAS</option>
                <option value="RECEPTORIA">SOLO RECEPTORÍA</option>
                <option value="COMPANIA">SOLO COMPAÑÍAS</option>
              </select>
            </div>

            <div>
              <select
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value)}
                className="form-input"
                style={{ height: '38px', fontSize: '13px', fontWeight: 600, padding: '0 10px' }}
              >
                <option value="">TODOS LOS ESTADOS</option>
                <option value="ACTIVO">ACTIVOS</option>
                <option value="PAGADO">PAGADOS</option>
              </select>
            </div>
          </div>

          <button
            type="button"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['historial-adelantos'] })}
            className="btn btn-outline"
            style={{ fontWeight: 700, height: '38px', padding: '0 12px', background: '#fff', border: '1.5px solid #cbd5e1' }}
          >
            <i className="fa-solid fa-rotate-right" style={{ marginRight: '6px' }}></i> Actualizar
          </button>
        </div>

        <DataTable
          columns={columns}
          data={adelantosFiltrados}
          isLoading={isLoading}
          searchPlaceholder="Buscar por finca, compañía, observación..."
          isRowExpanded={(row) => !!expandedRows[row.id]}
          renderSubRow={(row) => (
            <SubRowCuotas
              adelanto={row}
              onEditarCuota={(c) => {
                setAdelantoSeleccionado(row);
                setCuotaSeleccionada(c);
                setModalEditarCuotaOpen(true);
              }}
              onDividirCuota={(c) => {
                setAdelantoSeleccionado(row);
                setCuotaSeleccionada(c);
                setModalDividirCuotaOpen(true);
              }}
              onPosponerCuota={(c) => {
                setAdelantoSeleccionado(row);
                setCuotaSeleccionada(c);
                setModalPosponerCuotaOpen(true);
              }}
              onReestructurar={() => {
                setAdelantoSeleccionado(row);
                setModalReestructurarOpen(true);
              }}
            />
          )}
        />
      </div>

      <ModalEditarCuota
        isOpen={modalEditarCuotaOpen}
        onClose={() => setModalEditarCuotaOpen(false)}
        cuota={cuotaSeleccionada}
        adelanto={adelantoSeleccionado}
        semanas={semanas}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['historial-adelantos'] })}
      />

      <ModalDividirCuota
        isOpen={modalDividirCuotaOpen}
        onClose={() => setModalDividirCuotaOpen(false)}
        cuota={cuotaSeleccionada}
        adelanto={adelantoSeleccionado}
        semanas={semanas}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['historial-adelantos'] })}
      />

      <ModalPosponerCuota
        isOpen={modalPosponerCuotaOpen}
        onClose={() => setModalPosponerCuotaOpen(false)}
        cuota={cuotaSeleccionada}
        adelanto={adelantoSeleccionado}
        semanas={semanas}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['historial-adelantos'] })}
      />

      <ModalReestructurarCuotas
        isOpen={modalReestructurarOpen}
        onClose={() => setModalReestructurarOpen(false)}
        adelanto={adelantoSeleccionado}
        semanas={semanas}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['historial-adelantos'] })}
      />
    </div>
  );
};
