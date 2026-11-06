import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Swal from 'sweetalert2';
import { toast } from 'sonner';
import { finanzasApi } from '@/api/finanzas.api';
import { catalogosApi } from '@/api/catalogos.api';
import { bcvApi } from '@/api/bcv.api';
import { DataTable, type ColumnDef } from '@/components/common/DataTable';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import type { AdelantoDto, ChoferDto } from '@/types';

export const AdelantosPersonalPage: React.FC = () => {
  const queryClient = useQueryClient();

  const [modalCrearOpen, setModalCrearOpen] = useState(false);
  const [modalAmortizarOpen, setModalAmortizarOpen] = useState(false);
  const [adelantoSeleccionado, setAdelantoSeleccionado] = useState<any | null>(null);
  const [montoAmortizar, setMontoAmortizar] = useState<number>(0);

  const [filtroEstado, setFiltroEstado] = useState<string>('ACTIVO');

  // Formulario nuevo adelanto usuario
  const [usuarioId, setUsuarioId] = useState<string>('');
  const [montoUSD, setMontoUSD] = useState<number>(0);
  const [numeroCuotas, setNumeroCuotas] = useState<number>(1);
  const [fechaSolicitud, setFechaSolicitud] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [motivo, setMotivo] = useState<string>('');
  const [loadingGuardar, setLoadingGuardar] = useState(false);

  // 1. Cargar Adelantos a Personal / Usuarios
  const { data: adelantosRaw = [], isLoading } = useQuery<AdelantoDto[]>({
    queryKey: ['adelantos-personal'],
    queryFn: () => finanzasApi.getAdelantos('PERSONAL'),
  });

  // 2. Cargar Choferes / Usuarios
  const { data: choferes = [] } = useQuery<ChoferDto[]>({
    queryKey: ['choferes'],
    queryFn: () => catalogosApi.getChoferes(),
  });

  // 3. Tasa BCV
  const { data: bcv } = useQuery({
    queryKey: ['bcv-rate'],
    queryFn: () => bcvApi.getTasaHoy(),
  });
  const tasaBcv = bcv?.tasa || 36.5;

  // Normalización
  const adelantos = useMemo(() => {
    return adelantosRaw.map((a: any) => {
      const id = a.id ?? a.Id ?? 0;
      const montoTotal = Number(a.montoTotalUSD ?? a.MontoTotalUSD ?? a.montoUSD ?? a.MontoUSD ?? a.monto ?? 0);
      const saldoPend = Number(a.montoPendienteUSD ?? a.MontoPendienteUSD ?? a.saldoPendienteUSD ?? a.SaldoPendienteUSD ?? 0);
      const montoPag = Number(a.montoPagadoUSD ?? a.MontoPagadoUSD ?? Math.max(0, montoTotal - saldoPend));
      const uId = a.usuarioId ?? a.UsuarioId ?? a.entidadId ?? a.EntidadId;
      const uMatch = choferes.find((c) => c.id === uId);
      const nombre = a.usuarioNombre ?? a.UsuarioNombre ?? a.entidadNombre ?? a.EntidadNombre ?? uMatch?.nombreCompleto ?? (uMatch as any)?.nombre ?? 'Personal';
      const rolNom = a.rol ?? a.Rol ?? (uMatch ? 'Conductor' : 'Operador');
      const numCuotas = Number(a.numeroCuotas ?? a.NumeroCuotas ?? (a.cuotas?.length || 1));
      const cuotaUSD = numCuotas > 0 ? Number((montoTotal / numCuotas).toFixed(2)) : montoTotal;
      const fSol = (a.fechaSolicitud ?? a.FechaSolicitud ?? a.fecha ?? a.Fecha ?? '').split('T')[0] || '-';
      const obs = a.motivo ?? a.Motivo ?? a.observacion ?? a.Observacion ?? '';
      const est = String(a.estado || a.Estado || (saldoPend <= 0.001 ? 'PAGADO' : 'APROBADO')).toUpperCase();

      return {
        ...a,
        id,
        usuarioId: uId,
        nombre,
        rol: rolNom,
        fechaSolicitud: fSol,
        montoTotalUSD: montoTotal,
        montoPendienteUSD: saldoPend,
        montoPagadoUSD: montoPag,
        numeroCuotas: numCuotas,
        cuotaUSD,
        observacion: obs,
        estado: est,
      };
    });
  }, [adelantosRaw, choferes]);

  // Filtrado
  const adelantosFiltrados = useMemo(() => {
    return adelantos.filter((a) => {
      if (filtroEstado === 'ACTIVO') {
        return a.montoPendienteUSD > 0.001 && a.estado !== 'PAGADO' && a.estado !== 'ANULADO';
      }
      if (filtroEstado === 'PAGADO') {
        return a.montoPendienteUSD <= 0.001 || a.estado === 'PAGADO';
      }
      return true;
    });
  }, [adelantos, filtroEstado]);

  // 3 KPIs 1:1 con tab-adelantos-usuarios
  const kpis = useMemo(() => {
    let totalAdelantado = 0;
    let totalCobrado = 0;
    let totalPendiente = 0;
    let cantCuotasCobradas = 0;

    adelantos.forEach((a) => {
      totalAdelantado += a.montoTotalUSD;
      totalCobrado += a.montoPagadoUSD;
      totalPendiente += a.montoPendienteUSD;
      if (a.montoPagadoUSD > 0) cantCuotasCobradas++;
    });

    return {
      totalAdelantadoUSD: totalAdelantado,
      totalCobradoUSD: totalCobrado,
      totalPendienteUSD: totalPendiente,
      cantAdelantos: adelantos.length,
      cantCuotasCobradas,
    };
  }, [adelantos]);

  // Crear mutación
  const crearAdelantoUsuario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usuarioId) {
      toast.error('Debe seleccionar el beneficiario.');
      return;
    }
    if (montoUSD <= 0) {
      toast.error('El monto debe ser mayor a 0.');
      return;
    }

    setLoadingGuardar(true);
    try {
      const payload = {
        tipoEntidad: 'PERSONAL',
        usuarioId: parseInt(usuarioId, 10),
        montoUSD,
        montoTotalUSD: montoUSD,
        numeroCuotas,
        fecha: fechaSolicitud,
        fechaSolicitud,
        motivo: motivo || 'Préstamo personal / adelanto de nómina',
        tasaBCV: tasaBcv,
      };

      const res = await finanzasApi.crearAdelanto(payload);
      Swal.fire({
        icon: 'success',
        title: '¡Préstamo Registrado!',
        text: res.message || 'Préstamo a personal registrado exitosamente.',
        confirmButtonColor: '#d97706',
      });
      queryClient.invalidateQueries({ queryKey: ['adelantos-personal'] });
      setModalCrearOpen(false);
      setUsuarioId('');
      setMontoUSD(0);
      setNumeroCuotas(1);
      setMotivo('');
    } catch (err: any) {
      Swal.fire({
        icon: 'error',
        title: 'Error al Registrar',
        text: err.response?.data?.message || err.message || 'No se pudo guardar el préstamo.',
        confirmButtonColor: '#ef4444',
      });
    } finally {
      setLoadingGuardar(false);
    }
  };

  // Amortizar mutación
  const amortizarMutation = useMutation({
    mutationFn: ({ id, monto }: { id: number; monto: number }) =>
      finanzasApi.amortizarAdelanto(id, monto),
    onSuccess: (data: any) => {
      Swal.fire({
        icon: 'success',
        title: '¡Abono Registrado!',
        text: data.message || 'Amortización procesada con éxito.',
        confirmButtonColor: '#10b981',
      });
      queryClient.invalidateQueries({ queryKey: ['adelantos-personal'] });
      setModalAmortizarOpen(false);
    },
    onError: (err: any) => {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: err.response?.data?.message || err.message || 'Error al amortizar.',
        confirmButtonColor: '#ef4444',
      });
    },
  });

  const handleEliminar = (id: number, nombre: string) => {
    Swal.fire({
      title: '¿Eliminar Préstamo?',
      text: `Se cancelará el registro #${id} de "${nombre}".`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
    }).then((res) => {
      if (res.isConfirmed) {
        finanzasApi.eliminarAdelanto(id).then(() => {
          Swal.fire('¡Eliminado!', 'El préstamo ha sido removido.', 'success');
          queryClient.invalidateQueries({ queryKey: ['adelantos-personal'] });
        });
      }
    });
  };

  const choferesOptions = useMemo(() => {
    return choferes.map((c) => ({
      value: String(c.id),
      label: c.nombreCompleto || (c as any).nombre,
      sublabel: c.cedula ? `C.I. ${c.cedula}` : undefined,
    }));
  }, [choferes]);

  // Columnas exactas 1:1 con tab-adelantos-usuarios
  const columns = useMemo<ColumnDef<any>[]>(() => [
    {
      accessorKey: 'nombre',
      header: 'BENEFICIARIO',
      cell: (row) => (
        <div>
          <div style={{ fontWeight: 800, color: '#0f172a' }}>{row.nombre}</div>
          <span style={{ fontSize: '11px', color: '#64748b' }}>Adelanto #{row.id}</span>
        </div>
      ),
    },
    {
      accessorKey: 'rol',
      header: 'ROL',
      cell: (row) => (
        <div style={{ textAlign: 'center' }}>
          <span
            style={{
              background: '#f1f5f9',
              color: '#475569',
              fontWeight: 700,
              fontSize: '11px',
              padding: '2px 8px',
              borderRadius: '6px',
            }}
          >
            {row.rol}
          </span>
        </div>
      ),
    },
    {
      accessorKey: 'fechaSolicitud',
      header: 'FECHA SOLICITUD',
      cell: (row) => (
        <span style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>
          {row.fechaSolicitud}
        </span>
      ),
    },
    {
      accessorKey: 'montoTotalUSD',
      header: 'MONTO TOTAL ($)',
      cell: (row) => (
        <div style={{ textAlign: 'right', fontWeight: 900, color: '#0f172a' }}>
          $ {(Number(row.montoTotalUSD) || 0).toFixed(2)}
        </div>
      ),
    },
    {
      accessorKey: 'numeroCuotas',
      header: 'CUOTAS',
      cell: (row) => (
        <div style={{ textAlign: 'center', fontWeight: 800 }}>
          {row.numeroCuotas}
        </div>
      ),
    },
    {
      accessorKey: 'cuotaUSD',
      header: 'CUOTA ($)',
      cell: (row) => (
        <div style={{ textAlign: 'right', fontWeight: 800, color: '#2563eb' }}>
          $ {(Number(row.cuotaUSD) || 0).toFixed(2)}
        </div>
      ),
    },
    {
      accessorKey: 'montoPagadoUSD',
      header: 'AMORTIZADO ($)',
      cell: (row) => (
        <div style={{ textAlign: 'right', fontWeight: 800, color: '#10b981' }}>
          $ {(Number(row.montoPagadoUSD) || 0).toFixed(2)}
        </div>
      ),
    },
    {
      accessorKey: 'montoPendienteUSD',
      header: 'PENDIENTE ($)',
      cell: (row) => {
        const pend = Number(row.montoPendienteUSD) || 0;
        return (
          <div
            style={{
              textAlign: 'right',
              fontWeight: 900,
              color: pend > 0 ? '#d97706' : '#15803d',
            }}
          >
            $ {pend.toFixed(2)}
          </div>
        );
      },
    },
    {
      accessorKey: 'estado',
      header: 'ESTADO',
      cell: (row) => {
        const pend = Number(row.montoPendienteUSD) || 0;
        const isPagado = pend <= 0.001 || row.estado === 'PAGADO';
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
      accessorKey: 'observacion',
      header: 'MOTIVO / OBSERVACIÓN',
      cell: (row) => (
        <span style={{ fontSize: '11.5px', color: '#64748b' }}>
          {row.observacion || '-'}
        </span>
      ),
    },
    {
      id: 'acciones',
      header: 'ACCIONES',
      cell: (row) => {
        const isPagado = (Number(row.montoPendienteUSD) || 0) <= 0.001;
        return (
          <div style={{ display: 'flex', gap: '5px', justifyContent: 'center' }}>
            {!isPagado && (
              <button
                type="button"
                onClick={() => {
                  setAdelantoSeleccionado(row);
                  setMontoAmortizar(row.cuotaUSD || row.montoPendienteUSD);
                  setModalAmortizarOpen(true);
                }}
                title="Abonar / Descontar cuota"
                style={{
                  background: '#f0fdf4',
                  color: '#16a34a',
                  border: '1px solid #bbf7d0',
                  borderRadius: '6px',
                  padding: '4px 8px',
                  fontSize: '11px',
                  cursor: 'pointer',
                }}
              >
                <i className="fa-solid fa-coins"></i>
              </button>
            )}
            <button
              type="button"
              onClick={() => handleEliminar(row.id, row.nombre)}
              title="Eliminar registro"
              style={{
                background: '#fef2f2',
                color: '#dc2626',
                border: '1px solid #fecaca',
                borderRadius: '6px',
                padding: '4px 8px',
                fontSize: '11px',
                cursor: 'pointer',
              }}
            >
              <i className="fa-solid fa-trash-can"></i>
            </button>
          </div>
        );
      },
    },
  ], []);

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
            <i className="fa-solid fa-hand-holding-dollar" style={{ color: '#fbbf24', marginRight: '8px' }}></i>
            Adelantos &amp; Préstamos de Personal
          </h1>
          <p className="view-subtitle">
            Control de préstamos a choferes, materas y operadores con amortización automática en cuotas semanales de liquidación
          </p>
        </div>
        <div className="view-actions">
          <button
            type="button"
            onClick={() => setModalCrearOpen(true)}
            className="btn btn-primary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontWeight: 700,
              padding: '9px 16px',
              background: 'linear-gradient(135deg, #d97706, #b45309)',
              border: 'none',
              boxShadow: '0 4px 12px rgba(217, 119, 6, 0.35)',
            }}
          >
            <i className="fa-solid fa-plus-circle"></i> + Nuevo Préstamo / Adelanto
          </button>
        </div>
      </div>

      {/* 3 TARJETAS KPI (1:1 V2_3_11_26) */}
      <div className="kpi-grid" style={{ marginBottom: '24px' }}>
        <div className="kpi-card glass-blue">
          <div className="kpi-icon-wrap"><i className="fa-solid fa-hand-holding-dollar"></i></div>
          <div className="kpi-content">
            <span className="kpi-title">Total Préstamos Otorgados</span>
            <div className="kpi-value">
              $ {kpis.totalAdelantadoUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <span className="kpi-foot">{kpis.cantAdelantos} Préstamos registrados</span>
          </div>
        </div>

        <div className="kpi-card glass-emerald">
          <div className="kpi-icon-wrap"><i className="fa-solid fa-circle-check"></i></div>
          <div className="kpi-content">
            <span className="kpi-title">Total Amortizado (Cobrado)</span>
            <div className="kpi-value">
              $ {kpis.totalCobradoUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <span className="kpi-foot">{kpis.cantCuotasCobradas} Cuotas descontadas</span>
          </div>
        </div>

        <div className="kpi-card glass-amber">
          <div className="kpi-icon-wrap"><i className="fa-solid fa-clock-rotate-left"></i></div>
          <div className="kpi-content">
            <span className="kpi-title">Saldo Total Pendiente</span>
            <div className="kpi-value">
              $ {kpis.totalPendienteUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <span className="kpi-foot">Por descontar en nómina</span>
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
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
              className="form-input"
              style={{ height: '38px', fontWeight: 600, fontSize: '13px', padding: '0 10px' }}
            >
              <option value="">Todos los Estados</option>
              <option value="ACTIVO">Activos / Pendientes</option>
              <option value="PAGADO">Pagados / Amortizados</option>
            </select>
          </div>

          <button
            type="button"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['adelantos-personal'] })}
            className="btn btn-outline"
            title="Refrescar lista"
            style={{ fontWeight: 700, height: '38px', padding: '0 12px', background: '#fff', border: '1.5px solid #cbd5e1' }}
          >
            <i className="fa-solid fa-rotate-right"></i>
          </button>
        </div>

        <DataTable
          columns={columns}
          data={adelantosFiltrados}
          isLoading={isLoading}
          searchPlaceholder="Buscar por nombre, cédula..."
        />
      </div>

      {/* MODAL CREAR PRÉSTAMO / ADELANTO A PERSONAL */}
      {modalCrearOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            background: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '520px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                background: 'linear-gradient(135deg, #d97706, #b45309)',
                padding: '16px 20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                color: '#fff',
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800 }}>
                  <i className="fa-solid fa-hand-holding-dollar" style={{ marginRight: '6px' }}></i>
                  Registrar Préstamo / Adelanto a Personal
                </h3>
                <span style={{ fontSize: '11px', color: '#fef3c7' }}>
                  Descuento automático en nómina de choferes u operadores
                </span>
              </div>
              <button
                type="button"
                onClick={() => setModalCrearOpen(false)}
                style={{
                  background: 'rgba(255,255,255,0.2)',
                  border: 'none',
                  color: '#ffffff',
                  width: '28px',
                  height: '28px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <form onSubmit={crearAdelantoUsuario} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 800, color: '#334155', display: 'block', marginBottom: '6px' }}>
                  Beneficiario (Chofer / Personal) *
                </label>
                <SearchableSelect
                  options={choferesOptions}
                  value={usuarioId}
                  onChange={setUsuarioId}
                  placeholder="-- Seleccionar Beneficiario --"
                  searchPlaceholder="Escriba para buscar chofer..."
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 800, color: '#334155', display: 'block', marginBottom: '6px' }}>
                    Monto Total ($ USD) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    value={montoUSD || ''}
                    onChange={(e) => setMontoUSD(parseFloat(e.target.value) || 0)}
                    placeholder="100.00"
                    className="form-input"
                    style={{ height: '38px', fontWeight: 800 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 800, color: '#334155', display: 'block', marginBottom: '6px' }}>
                    Número de Cuotas *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="52"
                    required
                    value={numeroCuotas || ''}
                    onChange={(e) => setNumeroCuotas(parseInt(e.target.value, 10) || 1)}
                    className="form-input"
                    style={{ height: '38px', fontWeight: 800 }}
                  />
                </div>
              </div>

              {montoUSD > 0 && numeroCuotas > 0 && (
                <div style={{ background: '#fef3c7', padding: '10px 14px', borderRadius: '8px', border: '1px solid #fde68a' }}>
                  <span style={{ fontSize: '11px', color: '#92400e', fontWeight: 700 }}>Cuota Semanal Estimada: </span>
                  <span style={{ fontSize: '14px', color: '#b45309', fontWeight: 900 }}>
                    $ {(montoUSD / numeroCuotas).toFixed(2)} USD / semana
                  </span>
                </div>
              )}

              <div>
                <label style={{ fontSize: '12px', fontWeight: 800, color: '#334155', display: 'block', marginBottom: '6px' }}>
                  Fecha de Solicitud *
                </label>
                <input
                  type="date"
                  required
                  value={fechaSolicitud}
                  onChange={(e) => setFechaSolicitud(e.target.value)}
                  className="form-input"
                  style={{ height: '38px', fontWeight: 700 }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 800, color: '#334155', display: 'block', marginBottom: '6px' }}>
                  Motivo / Observación
                </label>
                <input
                  type="text"
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Ej: Préstamo personal para repuestos / gastos médicos..."
                  className="form-input"
                  style={{ height: '38px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setModalCrearOpen(false)}
                  disabled={loadingGuardar}
                  className="btn btn-outline"
                  style={{ fontWeight: 700, padding: '7px 14px', background: '#fff' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loadingGuardar}
                  className="btn btn-primary"
                  style={{ fontWeight: 800, padding: '7px 18px', background: '#d97706', border: 'none' }}
                >
                  {loadingGuardar ? 'Guardando...' : 'Confirmar Préstamo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL AMORTIZAR DIRECTO */}
      {modalAmortizarOpen && adelantoSeleccionado && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            background: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '440px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                background: 'linear-gradient(135deg, #10b981, #059669)',
                padding: '16px 20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                color: '#fff',
              }}
            >
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800 }}>
                Abonar a Préstamo #{adelantoSeleccionado.id}
              </h3>
              <button
                type="button"
                onClick={() => setModalAmortizarOpen(false)}
                style={{
                  background: 'rgba(255,255,255,0.2)',
                  border: 'none',
                  color: '#ffffff',
                  width: '28px',
                  height: '28px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>{adelantoSeleccionado.nombre}</div>
                <div style={{ fontSize: '11px', color: '#64748b' }}>
                  Saldo Pendiente: $ {adelantoSeleccionado.montoPendienteUSD.toFixed(2)} USD
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 800, color: '#334155', display: 'block', marginBottom: '6px' }}>
                  Monto a Abonar ($ USD) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={adelantoSeleccionado.montoPendienteUSD}
                  value={montoAmortizar || ''}
                  onChange={(e) => setMontoAmortizar(parseFloat(e.target.value) || 0)}
                  className="form-input"
                  style={{ height: '38px', fontWeight: 800, color: '#10b981' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setModalAmortizarOpen(false)}
                  className="btn btn-outline"
                  style={{ fontWeight: 700, padding: '7px 14px', background: '#fff' }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (montoAmortizar <= 0) return;
                    amortizarMutation.mutate({ id: adelantoSeleccionado.id, monto: montoAmortizar });
                  }}
                  className="btn btn-primary"
                  style={{ fontWeight: 800, padding: '7px 18px', background: '#10b981', border: 'none' }}
                >
                  Registrar Abono
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
