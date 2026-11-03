import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Swal from 'sweetalert2';
import { toast } from 'sonner';
import { finanzasApi } from '@/api/finanzas.api';
import { catalogosApi } from '@/api/catalogos.api';
import { bcvApi } from '@/api/bcv.api';
import { DataTable, type ColumnDef } from '@/components/common/DataTable';
import { ChoferSelect } from '@/components/selectors';
import type { AdelantoDto, ChoferDto } from '@/types';

export const AdelantosPersonalPage: React.FC = () => {
  const queryClient = useQueryClient();

  const [modalNuevo, setModalNuevo] = useState(false);
  const [modalAmortizar, setModalAmortizar] = useState(false);
  const [adelantoSeleccionado, setAdelantoSeleccionado] = useState<AdelantoDto | null>(null);
  const [montoAmortizar, setMontoAmortizar] = useState<number>(0);
  const [filtroEstado, setFiltroEstado] = useState<string>('');

  const initialForm = {
    tipoEntidad: 'PERSONAL',
    usuarioId: 0,
    montoUSD: 0,
    fecha: new Date().toISOString().split('T')[0],
    motivo: '',
  };
  const [form, setForm] = useState(initialForm);

  const { data: adelantos = [], isLoading } = useQuery<AdelantoDto[]>({
    queryKey: ['adelantos-personal'],
    queryFn: () => finanzasApi.getAdelantos('PERSONAL'),
  });

  const { data: choferes = [] } = useQuery<ChoferDto[]>({
    queryKey: ['choferes'],
    queryFn: () => catalogosApi.getChoferes(),
  });

  const { data: bcv } = useQuery({
    queryKey: ['bcv-rate'],
    queryFn: () => bcvApi.getTasaHoy(),
  });
  const tasaBcv = bcv?.tasa || 36.5;

  const crearMutation = useMutation({
    mutationFn: (dto: typeof initialForm) => finanzasApi.crearAdelanto(dto),
    onSuccess: (data: any) => {
      Swal.fire({
        icon: 'success',
        title: '¡Anticipo Registrado!',
        text: data.message || 'Anticipo a chofer registrado exitosamente',
        confirmButtonColor: '#3b82f6',
      });
      queryClient.invalidateQueries({ queryKey: ['adelantos-personal'] });
      setModalNuevo(false);
      setForm(initialForm);
    },
    onError: (err: any) => {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: err.response?.data?.message || 'Error al registrar anticipo',
        confirmButtonColor: '#ef4444',
      });
    },
  });

  const amortizarMutation = useMutation({
    mutationFn: ({ id, monto }: { id: number; monto: number }) =>
      finanzasApi.amortizarAdelanto(id, monto),
    onSuccess: (data: any) => {
      Swal.fire({
        icon: 'success',
        title: '¡Descuento Procesado!',
        text: data.message || 'Descuento procesado exitosamente',
        confirmButtonColor: '#3b82f6',
      });
      queryClient.invalidateQueries({ queryKey: ['adelantos-personal'] });
      setModalAmortizar(false);
    },
    onError: (err: any) => {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: err.response?.data?.message || 'Error al procesar descuento',
        confirmButtonColor: '#ef4444',
      });
    },
  });

  const adelantosNormalizados = useMemo(() => {
    return adelantos.map((a: any) => {
      const id = a.id ?? a.Id ?? 0;
      const montoTotal = Number(a.montoTotalUSD ?? a.MontoTotalUSD ?? a.montoUSD ?? a.MontoUSD ?? a.monto ?? 0);
      const saldoPend = Number(a.montoPendienteUSD ?? a.MontoPendienteUSD ?? a.saldoPendienteUSD ?? a.SaldoPendienteUSD ?? a.saldo ?? 0);
      const montoPag = Number(a.montoPagadoUSD ?? a.MontoPagadoUSD ?? Math.max(0, montoTotal - saldoPend));
      const uNom = a.entidadNombre ?? a.EntidadNombre ?? a.usuarioNombre ?? a.UsuarioNombre ?? a.nombre ?? '';
      const uId = a.entidadId ?? a.EntidadId ?? a.usuarioId ?? a.UsuarioId;
      const cMatch = choferes.find((c) => c.id === uId);
      const nombreFinal = uNom || cMatch?.nombreCompleto || (cMatch as any)?.username || (uId ? `Chofer #${uId}` : 'Chofer / Personal');
      const fecha = a.fechaSolicitud ?? a.FechaSolicitud ?? a.fecha ?? a.Fecha ?? a.createdAt;
      const estado = String(a.estado ?? a.Estado ?? (saldoPend <= 0 ? 'PAGADO' : 'PENDIENTE')).toUpperCase();
      const amortizado = saldoPend <= 0 || estado === 'PAGADO' || estado === 'LIQUIDADO' || a.amortizado === true;

      return {
        ...a,
        id,
        montoUSD: montoTotal,
        saldoPendienteUSD: saldoPend,
        montoPagadoUSD: montoPag,
        usuarioNombre: nombreFinal,
        usuarioId: uId,
        fecha,
        estado,
        amortizado,
      };
    });
  }, [adelantos, choferes]);

  const totalAdelantado = adelantosNormalizados.reduce((acc, a) => acc + (a.montoUSD || 0), 0);
  const totalPendiente = adelantosNormalizados.reduce((acc, a) => acc + (a.saldoPendienteUSD || 0), 0);
  const totalDescontado = Math.max(0, totalAdelantado - totalPendiente);
  const choferesConSaldo = adelantosNormalizados.filter((a) => !a.amortizado || (a.saldoPendienteUSD || 0) > 0).length;

  const adelantosFiltrados = adelantosNormalizados.filter((a) => {
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
      header: 'Chofer / Personal',
      accessorKey: 'usuarioNombre',
      sortable: true,
      cell: (row) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: '#eff6ff',
              color: '#3b82f6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '12px',
            }}
          >
            <i className="fa-solid fa-user"></i>
          </div>
          <div>
            <div style={{ fontWeight: 700, color: '#0f172a' }}>{row.usuarioNombre || `Personal #${row.usuarioId}`}</div>
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
      header: 'Descontado ($)',
      cell: (row) => {
        const desc = Math.max(0, (row.montoUSD || 0) - (row.saldoPendienteUSD || 0));
        return (
          <span style={{ fontWeight: 800, color: '#059669', fontFamily: 'monospace' }}>
            ${desc.toFixed(2)}
          </span>
        );
      },
    },
    {
      header: 'Saldo Pendiente ($)',
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
      accessorKey: 'estado',
      cell: (row) => {
        const saldo = row.saldoPendienteUSD ?? row.montoUSD;
        const esPagado = Boolean(row.amortizado || saldo <= 0);
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
            {esPagado ? 'Cancelado' : 'Activo (Pendiente)'}
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
                title="Descontar de Nómina"
              >
                <i className="fa-solid fa-hand-holding-dollar"></i> Descontar
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
            <i className="fa-solid fa-hand-holding-dollar" style={{ color: '#0284c7', marginRight: '8px' }}></i>
            Adelantos & Anticipos a Personal
          </h1>
          <p className="view-subtitle">
            Control de anticipos y préstamos descontables en nómina semanal para choferes, auxiliares y operarios
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
              background: 'linear-gradient(135deg, #0284c7, #2563eb)',
              border: 'none',
              boxShadow: '0 4px 12px rgba(37,99,235,0.3)',
            }}
          >
            <i className="fa-solid fa-plus-circle"></i> + Nuevo Anticipo a Personal
          </button>
        </div>
      </div>

      {/* TARJETAS KPI ADELANTOS PERSONAL */}
      <div className="kpi-grid" style={{ marginBottom: '24px' }}>
        <div className="kpi-card glass-blue">
          <div className="kpi-icon-wrap"><i className="fa-solid fa-hand-holding-dollar"></i></div>
          <div className="kpi-content">
            <span className="kpi-title">Total Adelantado Personal</span>
            <div className="kpi-value">${totalAdelantado.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <span className="kpi-foot">{adelantos.length} Anticipos registrados</span>
          </div>
        </div>

        <div className="kpi-card glass-emerald">
          <div className="kpi-icon-wrap"><i className="fa-solid fa-circle-check"></i></div>
          <div className="kpi-content">
            <span className="kpi-title">Total Descontado en Nómina</span>
            <div className="kpi-value">${totalDescontado.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <span className="kpi-foot">Recuperado en pagos semanales</span>
          </div>
        </div>

        <div className="kpi-card glass-amber">
          <div className="kpi-icon-wrap"><i className="fa-solid fa-clock-rotate-left"></i></div>
          <div className="kpi-content">
            <span className="kpi-title">Saldo Pendiente por Descontar</span>
            <div className="kpi-value">${totalPendiente.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <span className="kpi-foot">Deuda pendiente en nómina</span>
          </div>
        </div>

        <div className="kpi-card glass-purple">
          <div className="kpi-icon-wrap"><i className="fa-solid fa-users"></i></div>
          <div className="kpi-content">
            <span className="kpi-title">Trabajadores con Saldo</span>
            <div className="kpi-value">{choferesConSaldo}</div>
            <span className="kpi-foot">Con cuotas activas</span>
          </div>
        </div>
      </div>

      {/* Tabla Principal */}
      <DataTable
        data={adelantosFiltrados}
        columns={columns}
        isLoading={isLoading}
        searchPlaceholder="Buscar por nombre de chofer o motivo..."
        exportFileName="adelantos_personal"
        searchFilter={(row, term) =>
          Boolean(
            (row.usuarioNombre && row.usuarioNombre.toLowerCase().includes(term)) ||
            (row.motivo && row.motivo.toLowerCase().includes(term)) ||
            row.id.toString().includes(term)
          )
        }
      />

      {/* Modal Nuevo Adelanto Personal */}
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
                <i className="fa-solid fa-user-plus" style={{ color: '#0284c7', marginRight: '8px' }}></i>
                Registrar Anticipo a Trabajador
              </h3>
              <button type="button" onClick={() => setModalNuevo(false)} style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '18px' }}>
                &times;
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!form.usuarioId || form.usuarioId === 0) {
                  toast.error('Debe seleccionar el trabajador');
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
                  Trabajador / Chofer *
                </label>
                <ChoferSelect
                  value={form.usuarioId}
                  onChange={(id) => setForm({ ...form, usuarioId: id })}
                  placeholder="-- Seleccionar Trabajador / Chofer --"
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
                    style={{ width: '100%', height: '38px', borderRadius: '8px', fontWeight: 800, color: '#0284c7' }}
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
                  Motivo / Concepto del Anticipo
                </label>
                <input
                  type="text"
                  value={form.motivo}
                  onChange={(e) => setForm({ ...form, motivo: e.target.value })}
                  placeholder="Ej: Anticipo médico o emergencias..."
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
                  style={{ height: '38px', padding: '0 20px', borderRadius: '8px', background: '#0284c7', border: 'none', fontWeight: 700 }}
                >
                  {crearMutation.isPending ? 'Guardando...' : 'Registrar Anticipo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Descontar */}
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
                Descontar Deuda de Trabajador
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
                Descontar al anticipo <strong>#{adelantoSeleccionado.id}</strong> ({adelantoSeleccionado.usuarioNombre || 'Chofer'}):
              </p>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                  Monto a Descontar ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  max={adelantoSeleccionado.saldoPendienteUSD || adelantoSeleccionado.montoUSD}
                  value={montoAmortizar}
                  onChange={(e) => setMontoAmortizar(Number(e.target.value))}
                  className="form-input"
                  style={{ width: '100%', height: '40px', fontSize: '16px', fontWeight: 800, color: '#0284c7', borderRadius: '8px' }}
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
                  {amortizarMutation.isPending ? 'Descontando...' : 'Confirmar Descuento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdelantosPersonalPage;
