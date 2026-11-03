import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { finanzasApi } from '@/api/finanzas.api';
import { DataTable, type ColumnDef } from '@/components/common/DataTable';
import type { PreliquidacionFincaDto, CicloSemanalDto } from '@/types';

export const LiquidacionesPage: React.FC = () => {
  const queryClient = useQueryClient();

  const [cicloSeleccionadoId, setCicloSeleccionadoId] = useState<number | undefined>(undefined);
  const [modalPagar, setModalPagar] = useState(false);
  const [fincaPago, setFincaPago] = useState<PreliquidacionFincaDto | null>(null);
  const [referenciaPago, setReferenciaPago] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<string>('TODOS');
  const [modoAgrupacion, setModoAgrupacion] = useState<'FINCA' | 'PROPIETARIO'>('FINCA');

  // Queries
  const { data: ciclos = [] } = useQuery<CicloSemanalDto[]>({
    queryKey: ['ciclos-semanas'],
    queryFn: () => finanzasApi.getCiclos(),
  });

  const { data: preliquidacion = [], isLoading } = useQuery<PreliquidacionFincaDto[]>({
    queryKey: ['preliquidacion', cicloSeleccionadoId],
    queryFn: () => finanzasApi.getPreliquidacion(cicloSeleccionadoId),
  });

  // Mutación Pago
  const pagarMutation = useMutation({
    mutationFn: (dto: { fincaId: number; cicloId: number; referenciaPago: string; montoUSD: number; montoBs: number; tasaBCV: number }) =>
      finanzasApi.pagarPreliquidacion(dto),
    onSuccess: (data) => {
      toast.success(data.message || 'Pago registrado exitosamente');
      queryClient.invalidateQueries({ queryKey: ['preliquidacion'] });
      setModalPagar(false);
      setReferenciaPago('');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Error al registrar pago');
    },
  });

  // Métricas
  const totalLitros = preliquidacion.reduce((acc, p) => acc + (p.totalLitros || 0), 0);
  const totalNetoUSD = preliquidacion.reduce((acc, p) => acc + (p.totalNetoUSD || 0), 0);
  const totalNetoBs = preliquidacion.reduce((acc, p) => acc + (p.totalNetoBs || 0), 0);
  const totalPagados = preliquidacion.filter((p) => p.pagado).length;

  const columns: ColumnDef<PreliquidacionFincaDto>[] = [
    {
      header: 'CÓDIGO & FINCA',
      accessorKey: 'fincaNombre',
      sortable: true,
      cell: (row) => (
        <div>
          <div style={{ fontWeight: 800, color: '#0f172a' }}>{row.fincaNombre}</div>
          <span style={{ fontSize: '11px', color: '#4f46e5', fontFamily: 'monospace', fontWeight: 700 }}>
            {row.fincaCodigo || 'S/C'}
          </span>
        </div>
      ),
    },
    {
      header: 'PROPIETARIO & PAGO',
      cell: (row) => (
        <div style={{ fontSize: '12px' }}>
          <div style={{ fontWeight: 700, color: '#1e293b' }}>
            <i className="fa-regular fa-user" style={{ color: '#64748b', marginRight: '4px' }}></i>
            {row.propietarioNombre}
          </div>
          {row.numeroCuenta && (
            <div style={{ color: '#64748b', fontSize: '11px', marginTop: '2px', fontFamily: 'monospace' }}>
              <i className="fa-solid fa-building-columns" style={{ color: '#0284c7', marginRight: '4px' }}></i>
              {row.bancoNombre ? `${row.bancoNombre}: ` : ''}{row.numeroCuenta}
            </div>
          )}
          {row.pagoMovil && (
            <div style={{ color: '#059669', fontSize: '11px', marginTop: '2px', fontFamily: 'monospace' }}>
              <i className="fa-solid fa-mobile-screen" style={{ marginRight: '4px' }}></i>
              PM: {row.pagoMovil}
            </div>
          )}
        </div>
      ),
    },
    {
      header: 'LITROS TOTALES',
      accessorKey: 'totalLitros',
      sortable: true,
      cell: (row) => (
        <span style={{ fontWeight: 800, color: '#2563eb', fontSize: '13.5px' }}>
          {(row.totalLitros || 0).toLocaleString()} <small>Lts</small>
        </span>
      ),
    },
    {
      header: 'PRECIO ($/L)',
      accessorKey: 'precioLitroUSD',
      cell: (row) => (
        <span style={{ fontWeight: 700, color: '#475569' }}>
          ${(row.precioLitroUSD || 0).toFixed(4)}
        </span>
      ),
    },
    {
      header: 'TOTAL BRUTO ($)',
      accessorKey: 'totalBrutoUSD',
      cell: (row) => (
        <span style={{ fontWeight: 700, color: '#334155' }}>
          ${(row.totalBrutoUSD || 0).toFixed(2)}
        </span>
      ),
    },
    {
      header: 'ADELANTOS ($)',
      accessorKey: 'totalAdelantosUSD',
      cell: (row) => (
        <span style={{ fontWeight: 700, color: row.totalAdelantosUSD ? '#dc2626' : '#94a3b8' }}>
          {row.totalAdelantosUSD ? `-$${row.totalAdelantosUSD.toFixed(2)}` : '$0.00'}
        </span>
      ),
    },
    {
      header: 'TOTAL NETO ($)',
      accessorKey: 'totalNetoUSD',
      sortable: true,
      cell: (row) => (
        <span style={{ fontWeight: 800, color: '#059669', fontSize: '14px' }}>
          ${(row.totalNetoUSD || 0).toFixed(2)}
        </span>
      ),
    },
    {
      header: 'MONTO BS (TASA BCV)',
      accessorKey: 'totalNetoBs',
      cell: (row) => (
        <div>
          <div style={{ fontWeight: 800, color: '#b45309', fontSize: '12.5px' }}>
            Bs. {(row.totalNetoBs || 0).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
          </div>
          <span style={{ fontSize: '10px', color: '#94a3b8' }}>Tasa: {row.tasaBCV || 0}</span>
        </div>
      ),
    },
    {
      header: 'ESTADO',
      accessorKey: 'pagado',
      sortable: true,
      cell: (row) => (
        <span
          className="badge"
          style={{
            background: row.pagado ? '#ecfdf5' : '#fffbeb',
            color: row.pagado ? '#047857' : '#b45309',
            border: `1px solid ${row.pagado ? '#a7f3d0' : '#fde68a'}`,
            fontWeight: 800,
          }}
        >
          <i className={`fa-solid ${row.pagado ? 'fa-circle-check' : 'fa-clock'}`} style={{ marginRight: '4px' }}></i>
          {row.pagado ? 'Pagado' : 'Pendiente'}
        </span>
      ),
    },
    {
      header: 'ACCIONES',
      className: 'text-right',
      cell: (row) => (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
          {!row.pagado && (
            <button
              type="button"
              onClick={() => {
                setFincaPago(row);
                setReferenciaPago('');
                setModalPagar(true);
              }}
              className="btn btn-sm btn-primary"
              style={{
                height: '30px',
                padding: '0 10px',
                fontSize: '12px',
                fontWeight: 700,
                background: 'linear-gradient(135deg, #059669, #047857)',
                border: 'none',
              }}
            >
              <i className="fa-solid fa-money-bill-wave"></i> Pagar
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <section id="tab-liquidacion" className="tab-content active" style={{ display: 'block' }}>
      {/* CABECERA VISTA */}
      <div className="view-header">
        <div>
          <h1 className="view-title">Liquidación y Nómina de Productores</h1>
          <p className="view-subtitle">
            Corte semanal (Martes a Lunes), deducción de adelantos y nómina bancaria
          </p>
        </div>

        <div className="view-actions" style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: '#ffffff',
              border: '1.5px solid #cbd5e1',
              padding: '4px 10px',
              borderRadius: '8px',
              boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
            }}
          >
            <label style={{ fontSize: '12.5px', fontWeight: 800, color: '#1e293b', whiteSpace: 'nowrap' }}>
              <i className="fa-solid fa-calendar-week" style={{ color: '#2563eb', marginRight: '6px' }}></i> Semana:
            </label>
            <select
              value={cicloSeleccionadoId || ''}
              onChange={(e) => setCicloSeleccionadoId(e.target.value ? Number(e.target.value) : undefined)}
              className="form-input"
              style={{
                height: '36px',
                padding: '0 10px',
                fontSize: '13px',
                fontWeight: 700,
                borderRadius: '6px',
                minWidth: '220px',
                border: '1px solid #94a3b8',
                color: '#0f172a',
                background: '#f8fafc',
              }}
            >
              <option value="">🟢 Semana Operativa Activa</option>
              {ciclos.map((c) => (
                <option key={c.id} value={c.id}>
                  Semana #{c.numeroSemana} ({c.año}) {c.estado === 'ABIERTO' ? '★ [ACTIVA]' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* TARJETAS RESUMEN DE LA PRE-LIQUIDACIÓN */}
      <div
        className="kpi-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '14px',
          marginBottom: '20px',
        }}
      >
        <div className="kpi-card glass-blue">
          <div className="kpi-icon-wrap">
            <i className="fa-solid fa-droplet"></i>
          </div>
          <div className="kpi-content">
            <span className="kpi-title">Litros Recolectados</span>
            <div className="kpi-value">{totalLitros.toLocaleString()} Lts</div>
            <span className="kpi-foot">{preliquidacion.length} Fincas a liquidar</span>
          </div>
        </div>

        <div className="kpi-card glass-emerald">
          <div className="kpi-icon-wrap">
            <i className="fa-solid fa-dollar-sign"></i>
          </div>
          <div className="kpi-content">
            <span className="kpi-title">Total Neto a Pagar</span>
            <div className="kpi-value">${totalNetoUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
            <span className="kpi-foot">Deducidos los adelantos</span>
          </div>
        </div>

        <div className="kpi-card glass-amber">
          <div className="kpi-icon-wrap">
            <i className="fa-solid fa-coins"></i>
          </div>
          <div className="kpi-content">
            <span className="kpi-title">Monto Total en Bolívares</span>
            <div className="kpi-value">Bs. {totalNetoBs.toLocaleString('es-VE', { maximumFractionDigits: 0 })}</div>
            <span className="kpi-foot">A tasa oficial BCV</span>
          </div>
        </div>

        <div className="kpi-card glass-purple">
          <div className="kpi-icon-wrap">
            <i className="fa-solid fa-circle-check"></i>
          </div>
          <div className="kpi-content">
            <span className="kpi-title">Fincas Pagadas</span>
            <div className="kpi-value">
              {totalPagados} / {preliquidacion.length}
            </div>
            <span className="kpi-foot">
              {preliquidacion.length > 0 ? ((totalPagados / preliquidacion.length) * 100).toFixed(0) : 0}% avance nómina
            </span>
          </div>
        </div>
      </div>

      {/* CARD DE TABLA */}
      <div className="content-card" style={{ padding: '20px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
            marginBottom: '16px',
            paddingBottom: '12px',
            borderBottom: '1px solid var(--border-color)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              className={`btn btn-sm ${modoAgrupacion === 'FINCA' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setModoAgrupacion('FINCA')}
              style={{ borderRadius: '6px', padding: '6px 14px', fontSize: '12px', fontWeight: 800 }}
            >
              <i className="fa-solid fa-leaf" style={{ marginRight: '6px' }}></i> Por Finca
            </button>
            <button
              type="button"
              className={`btn btn-sm ${modoAgrupacion === 'PROPIETARIO' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setModoAgrupacion('PROPIETARIO')}
              style={{ borderRadius: '6px', padding: '6px 14px', fontSize: '12px', fontWeight: 800 }}
            >
              <i className="fa-solid fa-users" style={{ marginRight: '6px' }}></i> Consolidado por Productor
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>
              <i className="fa-solid fa-filter" style={{ color: '#10b981', marginRight: '4px' }}></i> Estado:
            </label>
            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
              className="form-input"
              style={{ height: '34px', fontSize: '12px', fontWeight: 700 }}
            >
              <option value="TODOS">Todos</option>
              <option value="PENDIENTE">⏳ Pendientes</option>
              <option value="PAGADO">✅ Pagados</option>
            </select>
          </div>
        </div>

        <DataTable
          data={preliquidacion.filter((p) => {
            if (filtroEstado === 'PENDIENTE') return !p.pagado;
            if (filtroEstado === 'PAGADO') return p.pagado;
            return true;
          })}
          columns={columns}
          isLoading={isLoading}
          searchPlaceholder="Buscar por finca, propietario, código o banco..."
          exportFileName="nomina_liquidacion_fincas"
        />
      </div>

      {/* MODAL PAGAR */}
      {modalPagar && fincaPago && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(4px)',
            padding: '16px',
          }}
        >
          <div
            className="content-card"
            style={{
              width: '100%',
              maxWidth: '460px',
              padding: '24px',
              borderRadius: '16px',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingBottom: '14px',
                marginBottom: '16px',
                borderBottom: '1px solid var(--border-color)',
              }}
            >
              <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                <i className="fa-solid fa-money-bill-wave" style={{ color: '#059669', marginRight: '8px' }}></i>
                Registrar Pago de Liquidación
              </h3>
              <button
                type="button"
                onClick={() => setModalPagar(false)}
                style={{ background: 'none', border: 'none', fontSize: '18px', color: '#94a3b8', cursor: 'pointer' }}
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <div style={{ marginBottom: '16px', padding: '14px', background: '#f8fafc', borderRadius: '10px', fontSize: '13px' }}>
              <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '15px' }}>{fincaPago.fincaNombre}</div>
              <div style={{ color: '#64748b', marginTop: '2px' }}>Propietario: {fincaPago.propietarioNombre}</div>
              <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e2e8f0', paddingTop: '8px' }}>
                <span style={{ fontWeight: 700, color: '#059669', fontSize: '16px' }}>
                  Total: ${(fincaPago.totalNetoUSD || 0).toFixed(2)} USD
                </span>
                <span style={{ fontWeight: 800, color: '#b45309', fontSize: '14px' }}>
                  Bs. {(fincaPago.totalNetoBs || 0).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                pagarMutation.mutate({
                  fincaId: fincaPago.fincaId,
                  cicloId: cicloSeleccionadoId || 0,
                  referenciaPago,
                  montoUSD: fincaPago.totalNetoUSD,
                  montoBs: fincaPago.totalNetoBs,
                  tasaBCV: fincaPago.tasaBCV,
                });
              }}
            >
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                  Referencia Bancaria / Comprobante de Pago *
                </label>
                <input
                  type="text"
                  value={referenciaPago}
                  onChange={(e) => setReferenciaPago(e.target.value)}
                  className="form-input"
                  placeholder="Ej: REF-84920491"
                  style={{ width: '100%', height: '38px', fontWeight: 700 }}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setModalPagar(false)}
                  className="btn btn-outline"
                  style={{ height: '38px' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={pagarMutation.isPending}
                  className="btn btn-primary"
                  style={{ height: '38px', background: 'linear-gradient(135deg, #059669, #047857)' }}
                >
                  {pagarMutation.isPending ? 'Guardando...' : 'Confirmar Pago'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};

export default LiquidacionesPage;
