import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { finanzasApi } from '@/api/finanzas.api';
import { catalogosApi } from '@/api/catalogos.api';
import { bcvApi } from '@/api/bcv.api';
import { DataTable, type ColumnDef } from '@/components/common/DataTable';
import { FincaSelect } from '@/components/selectors';
import type { AdelantoDto, FincaDto } from '@/types';

export const AdelantosFincasPage: React.FC = () => {
  const queryClient = useQueryClient();

  const [modalNuevo, setModalNuevo] = useState(false);
  const [modalAmortizar, setModalAmortizar] = useState(false);
  const [adelantoSeleccionado, setAdelantoSeleccionado] = useState<AdelantoDto | null>(null);
  const [montoAmortizar, setMontoAmortizar] = useState<number>(0);
  const [filtroEstado, setFiltroEstado] = useState<string>('');

  const initialForm = {
    tipoEntidad: 'FINCA',
    fincaId: 0,
    montoUSD: 0,
    fecha: new Date().toISOString().split('T')[0],
    motivo: '',
  };
  const [form, setForm] = useState(initialForm);

  const { data: adelantos = [], isLoading } = useQuery<AdelantoDto[]>({
    queryKey: ['adelantos-fincas'],
    queryFn: () => finanzasApi.getAdelantos('FINCA'),
  });

  const { data: fincas = [] } = useQuery<FincaDto[]>({
    queryKey: ['fincas'],
    queryFn: () => catalogosApi.getFincas(true),
  });

  const { data: bcv } = useQuery({
    queryKey: ['bcv-rate'],
    queryFn: () => bcvApi.getTasaHoy(),
  });
  const tasaBcv = bcv?.tasa || 36.5;

  const crearMutation = useMutation({
    mutationFn: (dto: typeof initialForm) => finanzasApi.crearAdelanto(dto),
    onSuccess: (data: any) => {
      toast.success(data.message || 'Adelanto registrado a finca');
      queryClient.invalidateQueries({ queryKey: ['adelantos-fincas'] });
      setModalNuevo(false);
      setForm(initialForm);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Error al registrar adelanto');
    },
  });

  const amortizarMutation = useMutation({
    mutationFn: ({ id, monto }: { id: number; monto: number }) =>
      finanzasApi.amortizarAdelanto(id, monto),
    onSuccess: (data: any) => {
      toast.success(data.message || 'Abono procesado exitosamente');
      queryClient.invalidateQueries({ queryKey: ['adelantos-fincas'] });
      setModalAmortizar(false);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Error al abonar');
    },
  });

  const totalAdelantado = adelantos.reduce((acc, a) => acc + (a.montoUSD || 0), 0);
  const totalPendiente = adelantos.reduce((acc, a) => acc + (a.saldoPendienteUSD || 0), 0);
  const totalCobrado = Math.max(0, totalAdelantado - totalPendiente);
  const activosCount = adelantos.filter((a) => !a.amortizado || (a.saldoPendienteUSD || 0) > 0).length;

  const adelantosFiltrados = adelantos.filter((a) => {
    if (filtroEstado === 'ACTIVO' && a.amortizado) return false;
    if (filtroEstado === 'PAGADO' && !a.amortizado) return false;
    return true;
  });

  const columns: ColumnDef<AdelantoDto>[] = [
    {
      header: '# ID',
      accessorKey: 'id',
      sortable: true,
      cell: (row) => <span style={{ fontWeight: 800, color: '#64748b', fontFamily: 'monospace' }}>#{row.id}</span>,
    },
    {
      header: 'Finca / Productor',
      accessorKey: 'fincaNombre',
      sortable: true,
      cell: (row) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <i className="fa-solid fa-leaf" style={{ color: '#10b981' }}></i>
          <div>
            <div style={{ fontWeight: 700, color: '#0f172a' }}>{row.fincaNombre || `Finca #${row.fincaId}`}</div>
            <div style={{ fontSize: '11px', color: '#64748b' }}>
              {row.fecha ? new Date(row.fecha).toLocaleDateString('es-VE') : '-'}
            </div>
          </div>
        </div>
      ),
    },
    {
      header: 'Total ($)',
      accessorKey: 'montoUSD',
      sortable: true,
      cell: (row) => (
        <span style={{ fontWeight: 900, color: '#0f172a', fontFamily: 'monospace', fontSize: '13.5px' }}>
          ${Number(row.montoUSD || 0).toFixed(2)}
        </span>
      ),
    },
    {
      header: 'Monto (Bs)',
      cell: (row) => (
        <span style={{ fontWeight: 700, color: '#64748b', fontFamily: 'monospace', fontSize: '12px' }}>
          Bs. {((row.montoUSD || 0) * tasaBcv).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      header: 'Cobrado ($)',
      cell: (row) => {
        const cobrado = Math.max(0, (row.montoUSD || 0) - (row.saldoPendienteUSD || 0));
        return (
          <span style={{ fontWeight: 800, color: '#059669', fontFamily: 'monospace' }}>
            ${cobrado.toFixed(2)}
          </span>
        );
      },
    },
    {
      header: 'Pendiente ($)',
      accessorKey: 'saldoPendienteUSD',
      sortable: true,
      cell: (row) => {
        const saldo = row.saldoPendienteUSD ?? row.montoUSD;
        return (
          <span style={{ fontWeight: 900, color: saldo > 0 ? '#dc2626' : '#059669', fontFamily: 'monospace' }}>
            ${Number(saldo || 0).toFixed(2)}
          </span>
        );
      },
    },
    {
      header: 'Estado',
      cell: (row) => {
        const esPagado = row.amortizado || (row.saldoPendienteUSD || 0) <= 0;
        return (
          <span
            className="badge"
            style={{
              background: esPagado ? '#ecfdf5' : '#fef3c7',
              color: esPagado ? '#059669' : '#d97706',
              border: `1px solid ${esPagado ? '#a7f3d0' : '#fde68a'}`,
              fontWeight: 800,
            }}
          >
            <i className={`fa-solid ${esPagado ? 'fa-circle-check' : 'fa-clock'}`} style={{ marginRight: '4px' }}></i>
            {esPagado ? 'Liquidado' : 'Activo (Pendiente)'}
          </span>
        );
      },
    },
    {
      header: 'Acciones',
      className: 'text-right',
      cell: (row) => {
        const saldo = row.saldoPendienteUSD ?? row.montoUSD;
        return (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
            {saldo > 0 && (
              <button
                type="button"
                onClick={() => {
                  setAdelantoSeleccionado(row);
                  setMontoAmortizar(saldo);
                  setModalAmortizar(true);
                }}
                className="btn btn-sm btn-outline"
                style={{ height: '30px', padding: '0 8px', fontSize: '12px', color: '#0284c7', borderColor: '#bae6fd' }}
                title="Abonar a Deuda"
              >
                <i className="fa-solid fa-hand-holding-dollar"></i> Abonar
              </button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div>
      {/* VISTA HEADER 1:1 */}
      <div className="view-header">
        <div>
          <h1 className="view-title">
            <i className="fa-solid fa-leaf" style={{ color: '#10b981', marginRight: '8px' }}></i>
            Adelantos & Préstamos a Fincas
          </h1>
          <p className="view-subtitle">
            Gestión de anticipos fijados en USD, pagaderos en cuotas por ciclo operativo con cálculo dinámico en Bs (Tasa BCV)
          </p>
        </div>

        <div className="view-actions">
          <button
            type="button"
            onClick={() => setModalNuevo(true)}
            className="btn btn-primary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              fontWeight: 700,
              padding: '9px 18px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #10b981, #059669)',
              border: 'none',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.35)',
            }}
          >
            <i className="fa-solid fa-plus-circle"></i> + Nuevo Adelanto a Finca
          </button>
        </div>
      </div>

      {/* TARJETAS KPI ADELANTOS FINCAS */}
      <div className="kpi-grid" style={{ marginBottom: '24px' }}>
        <div className="kpi-card glass-blue">
          <div className="kpi-icon-wrap"><i className="fa-solid fa-hand-holding-dollar"></i></div>
          <div className="kpi-content">
            <span className="kpi-title">Total Adelantado Fincas</span>
            <div className="kpi-value">${totalAdelantado.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <span className="kpi-foot">{adelantos.length} Adelantos registrados</span>
          </div>
        </div>

        <div className="kpi-card glass-emerald">
          <div className="kpi-icon-wrap"><i className="fa-solid fa-circle-check"></i></div>
          <div className="kpi-content">
            <span className="kpi-title">Total Cobrado (Abonado)</span>
            <div className="kpi-value">${totalCobrado.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <span className="kpi-foot">Recuperación de capital</span>
          </div>
        </div>

        <div className="kpi-card glass-amber">
          <div className="kpi-icon-wrap"><i className="fa-solid fa-clock-rotate-left"></i></div>
          <div className="kpi-content">
            <span className="kpi-title">Monto Pendiente por Cobrar</span>
            <div className="kpi-value">${totalPendiente.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <span className="kpi-foot">Saldo por amortizar en nómina</span>
          </div>
        </div>

        <div className="kpi-card glass-purple">
          <div className="kpi-icon-wrap"><i className="fa-solid fa-calendar-minus"></i></div>
          <div className="kpi-content">
            <span className="kpi-title">Adelantos Activos</span>
            <div className="kpi-value">{activosCount}</div>
            <span className="kpi-foot">Productores con saldo</span>
          </div>
        </div>
      </div>

      {/* BARRA DE FILTROS */}
      <div className="content-card" style={{ padding: '16px 20px', marginBottom: '18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <div>
            <label style={{ fontSize: '11.5px', fontWeight: 800, color: '#475569', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>
              <i className="fa-solid fa-filter" style={{ color: '#0284c7', marginRight: '4px' }}></i> Estado del Préstamo:
            </label>
            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
              className="form-input"
              style={{ height: '38px', fontSize: '13px', fontWeight: 600, minWidth: '200px' }}
            >
              <option value="">TODOS LOS ESTADOS</option>
              <option value="ACTIVO">SOLO ACTIVOS (PENDIENTES)</option>
              <option value="PAGADO">SOLO PAGADOS (LIQUIDADOS)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tabla Principal */}
      <DataTable
        data={adelantosFiltrados}
        columns={columns}
        isLoading={isLoading}
        searchPlaceholder="Buscar por finca, observaciones..."
        exportFileName="adelantos_fincas"
        searchFilter={(row, term) =>
          Boolean(
            (row.fincaNombre && row.fincaNombre.toLowerCase().includes(term)) ||
            (row.motivo && row.motivo.toLowerCase().includes(term)) ||
            row.id.toString().includes(term)
          )
        }
      />

      {/* Modal Nuevo Adelanto */}
      {modalNuevo && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(4px)',
          }}
        >
          <div className="content-card" style={{ width: '100%', maxWidth: '480px', padding: '0', overflow: 'hidden', borderRadius: '16px' }}>
            <div style={{ padding: '16px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                <i className="fa-solid fa-hand-holding-dollar" style={{ color: '#10b981', marginRight: '8px' }}></i>
                Registrar Nuevo Adelanto a Finca
              </h3>
              <button type="button" onClick={() => setModalNuevo(false)} style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '18px' }}>
                &times;
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!form.fincaId || form.fincaId === 0) {
                  toast.error('Debe seleccionar la finca');
                  return;
                }
                if (form.montoUSD <= 0) {
                  toast.error('El monto debe ser mayor a 0');
                  return;
                }
                crearMutation.mutate(form);
              }}
              style={{ padding: '20px' }}
            >
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                  Finca / Productor *
                </label>
                <FincaSelect
                  value={form.fincaId}
                  onChange={(id) => setForm({ ...form, fincaId: id })}
                  placeholder="-- Seleccionar Finca / Productor --"
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                    Monto en Dólares ($) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.montoUSD || ''}
                    onChange={(e) => setForm({ ...form, montoUSD: Number(e.target.value) })}
                    placeholder="0.00"
                    className="form-input"
                    style={{ width: '100%', height: '38px', borderRadius: '8px', fontWeight: 800, color: '#059669' }}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                    Fecha
                  </label>
                  <input
                    type="date"
                    value={form.fecha}
                    onChange={(e) => setForm({ ...form, fecha: e.target.value })}
                    className="form-input"
                    style={{ width: '100%', height: '38px', borderRadius: '8px' }}
                    required
                  />
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                  Motivo / Concepto del Préstamo
                </label>
                <input
                  type="text"
                  value={form.motivo}
                  onChange={(e) => setForm({ ...form, motivo: e.target.value })}
                  placeholder="Ej: Anticipo para insumos o concentrado..."
                  className="form-input"
                  style={{ width: '100%', height: '38px', borderRadius: '8px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setModalNuevo(false)} className="btn btn-outline" style={{ height: '38px', padding: '0 16px', borderRadius: '8px' }}>
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={crearMutation.isPending}
                  className="btn btn-primary"
                  style={{ height: '38px', padding: '0 20px', borderRadius: '8px', background: '#10b981', border: 'none', fontWeight: 700 }}
                >
                  {crearMutation.isPending ? 'Guardando...' : 'Registrar Adelanto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Abonar */}
      {modalAmortizar && adelantoSeleccionado && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(4px)',
          }}
        >
          <div className="content-card" style={{ width: '100%', maxWidth: '420px', padding: '0', overflow: 'hidden', borderRadius: '16px' }}>
            <div style={{ padding: '16px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                <i className="fa-solid fa-coins" style={{ color: '#0284c7', marginRight: '8px' }}></i>
                Abonar a Deuda de Finca
              </h3>
              <button type="button" onClick={() => setModalAmortizar(false)} style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '18px' }}>
                &times;
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (montoAmortizar <= 0) {
                  toast.error('El monto debe ser mayor a 0');
                  return;
                }
                amortizarMutation.mutate({ id: adelantoSeleccionado.id, monto: montoAmortizar });
              }}
              style={{ padding: '20px' }}
            >
              <p style={{ margin: '0 0 14px 0', fontSize: '13px', color: '#475569' }}>
                Abonar al préstamo <strong>#{adelantoSeleccionado.id}</strong> ({adelantoSeleccionado.fincaNombre}):
              </p>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                  Monto a Abonar ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  max={adelantoSeleccionado.saldoPendienteUSD || adelantoSeleccionado.montoUSD}
                  value={montoAmortizar}
                  onChange={(e) => setMontoAmortizar(Number(e.target.value))}
                  className="form-input"
                  style={{ width: '100%', height: '40px', fontSize: '16px', fontWeight: 800, color: '#059669', borderRadius: '8px' }}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setModalAmortizar(false)} className="btn btn-outline" style={{ height: '36px', padding: '0 14px', borderRadius: '8px' }}>
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={amortizarMutation.isPending}
                  className="btn btn-primary"
                  style={{ height: '36px', padding: '0 18px', borderRadius: '8px', background: '#0284c7', border: 'none', fontWeight: 700 }}
                >
                  {amortizarMutation.isPending ? 'Abonando...' : 'Confirmar Abono'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdelantosFincasPage;
