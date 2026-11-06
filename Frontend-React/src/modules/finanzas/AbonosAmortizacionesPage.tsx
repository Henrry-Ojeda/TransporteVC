import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Swal from 'sweetalert2';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { finanzasApi } from '@/api/finanzas.api';
import { catalogosApi } from '@/api/catalogos.api';
import { bcvApi } from '@/api/bcv.api';
import { DataTable, type ColumnDef } from '@/components/common/DataTable';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import type { CicloSemanalDto, FincaDto, AdelantoDto } from '@/types';

export const AbonosAmortizacionesPage: React.FC = () => {
  const queryClient = useQueryClient();

  const [modalAbonoDirectoOpen, setModalAbonoDirectoOpen] = useState(false);
  const [filtroTipoEntidad, setFiltroTipoEntidad] = useState<string>('');
  const [filtroCiclo, setFiltroCiclo] = useState<string>('');

  // Formulario Abono Directo
  const [tipoEntidadAbono, setTipoEntidadAbono] = useState<'FINCA' | 'RECEPTORIA'>('FINCA');
  const [entidadIdAbono, setEntidadIdAbono] = useState<string>('');
  const [adelantoIdAbono, setAdelantoIdAbono] = useState<string>('');
  const [cuotaIdAbono, setCuotaIdAbono] = useState<string>('');
  const [montoUSD, setMontoUSD] = useState<number>(0);
  const [tasaBcv, setTasaBcv] = useState<number>(36.5);
  const [referenciaBancaria, setReferenciaBancaria] = useState<string>('');
  const [observaciones, setObservaciones] = useState<string>('');
  const [loadingAbono, setLoadingAbono] = useState(false);

  // 1. Catálogos
  const { data: ciclos = [] } = useQuery<CicloSemanalDto[]>({
    queryKey: ['ciclos-semanas'],
    queryFn: () => finanzasApi.getCiclos(),
  });

  const { data: fincas = [] } = useQuery<FincaDto[]>({
    queryKey: ['fincas'],
    queryFn: () => catalogosApi.getFincas(true),
  });

  const { data: bcv } = useQuery({
    queryKey: ['bcv-rate'],
    queryFn: () => bcvApi.getTasaHoy(),
  });
  const tasaBcvActual = bcv?.tasa || 36.5;

  // 2. Abonos registrados
  const { data: abonosRaw = [], isLoading } = useQuery<any[]>({
    queryKey: ['abonos-amortizaciones', filtroTipoEntidad, filtroCiclo],
    queryFn: () => finanzasApi.getAbonos(filtroTipoEntidad || undefined, filtroCiclo ? parseInt(filtroCiclo, 10) : undefined),
  });

  // 3. Adelantos activos para el modal
  const { data: adelantosFincas = [] } = useQuery<AdelantoDto[]>({
    queryKey: ['adelantos-fincas-activos'],
    queryFn: () => finanzasApi.getAdelantos('FINCA'),
  });

  // Normalización
  const abonos = useMemo(() => {
    return abonosRaw.map((ab: any, idx: number) => {
      const id = ab.id ?? ab.Id ?? idx + 1;
      const fecha = (ab.fechaCobro ?? ab.FechaCobro ?? ab.fecha ?? ab.Fecha ?? '').split('T')[0] || '-';
      const semCod = ab.semanaCodigo ?? ab.SemanaCodigo ?? (ab.cicloId ? `Semana #${ab.cicloId}` : 'Ciclo general');
      const entidad = ab.entidadNombre ?? ab.EntidadNombre ?? ab.fincaNombre ?? ab.FincaNombre ?? 'Entidad';
      const tipoEnt = ab.tipoEntidad ?? ab.TipoEntidad ?? 'FINCA';
      const adelantoId = ab.adelantoId ?? ab.AdelantoId ?? '-';
      const numCuota = ab.numeroCuota ?? ab.NumeroCuota ?? '-';
      const mUSD = Number(ab.montoUSD ?? ab.MontoUSD ?? ab.montoCobradoUSD ?? ab.MontoCobradoUSD ?? 0);
      const tBCV = Number(ab.tasaBCV ?? ab.TasaBCV ?? ab.tasaBcvAplicada ?? ab.TasaBcvAplicada ?? tasaBcvActual);
      const mBs = Number(ab.montoCobradoBs ?? ab.MontoCobradoBs ?? ab.montoBs ?? ab.MontoBs ?? (mUSD * tBCV));
      const saldoRest = Number(ab.saldoRestanteUSD ?? ab.SaldoRestanteUSD ?? 0);
      const detalle = ab.detalle ?? ab.Detalle ?? ab.concepto ?? ab.observaciones ?? '-';
      const est = String(ab.estado ?? ab.Estado ?? 'COBRADO').toUpperCase();

      return {
        id,
        fecha,
        semanaCodigo: semCod,
        entidadNombre: entidad,
        tipoEntidad: tipoEnt,
        adelantoId,
        numeroCuota: numCuota,
        montoUSD: mUSD,
        tasaBCV: tBCV,
        montoCobradoBs: mBs,
        saldoRestanteUSD: saldoRest,
        detalle,
        estado: est,
      };
    });
  }, [abonosRaw, tasaBcvActual]);

  // KPIs 1:1 con tab-abonos
  const kpis = useMemo(() => {
    let totalAbonadoUSD = 0;
    let totalAbonadoBs = 0;
    let cuotasCobradas = 0;
    const entidadesSet = new Set<string>();

    abonos.forEach((a) => {
      totalAbonadoUSD += a.montoUSD;
      totalAbonadoBs += a.montoCobradoBs;
      cuotasCobradas++;
      if (a.entidadNombre) entidadesSet.add(a.entidadNombre);
    });

    return {
      totalUSD: totalAbonadoUSD,
      totalBs: totalAbonadoBs,
      cuotasCobradas,
      totalEntidades: entidadesSet.size,
    };
  }, [abonos]);

  // Fincas activas con saldo pendiente para el modal
  const adelantosDisponiblesModal = useMemo(() => {
    return adelantosFincas.filter((a: any) => {
      const saldo = Number(a.montoPendienteUSD ?? a.saldoPendienteUSD ?? 0);
      return saldo > 0.001;
    });
  }, [adelantosFincas]);

  const adelantoSeleccionadoModal = useMemo(() => {
    if (!adelantoIdAbono) return null;
    return adelantosDisponiblesModal.find((a: any) => String(a.id || a.Id) === adelantoIdAbono) || null;
  }, [adelantoIdAbono, adelantosDisponiblesModal]);

  // Exportar Excel
  const exportarAbonosExcel = () => {
    if (abonos.length === 0) {
      toast.info('No hay abonos para exportar');
      return;
    }
    const dataExcel = abonos.map((a) => ({
      'Fecha Cobro': a.fecha,
      'Semana Operativa': a.semanaCodigo,
      'Entidad / Finca': a.entidadNombre,
      'Tipo': a.tipoEntidad,
      'Adelanto #': a.adelantoId,
      'Cuota #': a.numeroCuota,
      'Monto ($ USD)': a.montoUSD,
      'Tasa BCV': a.tasaBCV,
      'Monto (Bs)': a.montoCobradoBs,
      'Saldo Restante ($)': a.saldoRestanteUSD,
      'Detalle': a.detalle,
      'Estado': a.estado,
    }));
    const ws = XLSX.utils.json_to_sheet(dataExcel);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Abonos_Amortizaciones');
    XLSX.writeFile(wb, `Abonos_Amortizaciones_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Guardar abono directo
  const handleGuardarAbonoDirecto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adelantoIdAbono) {
      toast.error('Debe seleccionar el adelanto a abonar.');
      return;
    }
    if (montoUSD <= 0) {
      toast.error('El monto debe ser mayor a 0.');
      return;
    }

    setLoadingAbono(true);
    try {
      const payload = {
        adelantoId: parseInt(adelantoIdAbono, 10),
        cuotaId: cuotaIdAbono ? parseInt(cuotaIdAbono, 10) : undefined,
        montoUSD,
        tasaBcvAplicada: tasaBcv,
        referenciaBancaria,
        observaciones,
      };

      const res = await finanzasApi.registrarAbonoDirecto(payload);
      Swal.fire({
        icon: 'success',
        title: '¡Abono Registrado!',
        text: res.message || 'El abono directo se ha aplicado exitosamente.',
        confirmButtonColor: '#f59e0b',
      });
      queryClient.invalidateQueries({ queryKey: ['abonos-amortizaciones'] });
      queryClient.invalidateQueries({ queryKey: ['adelantos-fincas'] });
      setModalAbonoDirectoOpen(false);
      setAdelantoIdAbono('');
      setCuotaIdAbono('');
      setMontoUSD(0);
      setReferenciaBancaria('');
      setObservaciones('');
    } catch (err: any) {
      Swal.fire({
        icon: 'error',
        title: 'Error al Registrar Abono',
        text: err.response?.data?.message || err.message || 'No se pudo registrar el abono.',
        confirmButtonColor: '#ef4444',
      });
    } finally {
      setLoadingAbono(false);
    }
  };

  // Columnas 1:1 con tab-abonos
  const columns = useMemo<ColumnDef<any>[]>(() => [
    {
      accessorKey: 'fecha',
      header: 'Fecha Cobro',
      cell: ({ row }) => (
        <span style={{ fontWeight: 700, color: '#334155', fontSize: '12px' }}>
          {row.fecha}
        </span>
      ),
    },
    {
      accessorKey: 'semanaCodigo',
      header: 'Semana',
      cell: ({ row }) => (
        <span style={{ fontWeight: 700, color: '#0369a1', fontSize: '11.5px' }}>
          {row.semanaCodigo}
        </span>
      ),
    },
    {
      accessorKey: 'entidadNombre',
      header: 'Entidad / Finca',
      cell: ({ row }) => (
        <div>
          <div style={{ fontWeight: 800, color: '#0f172a' }}>{row.entidadNombre}</div>
          <span style={{ fontSize: '10.5px', color: '#64748b' }}>{row.tipoEntidad}</span>
        </div>
      ),
    },
    {
      accessorKey: 'adelantoId',
      header: 'Adelanto #',
      cell: ({ row }) => (
        <div style={{ textAlign: 'center', fontWeight: 800, color: '#475569' }}>
          #{row.adelantoId}
        </div>
      ),
    },
    {
      accessorKey: 'numeroCuota',
      header: 'Cuota #',
      cell: ({ row }) => (
        <div style={{ textAlign: 'center', fontWeight: 800, color: '#2563eb' }}>
          {row.numeroCuota}
        </div>
      ),
    },
    {
      accessorKey: 'montoUSD',
      header: 'Monto USD',
      cell: ({ row }) => (
        <div style={{ textAlign: 'right', fontWeight: 900, color: '#059669' }}>
          $ {row.montoUSD.toFixed(2)}
        </div>
      ),
    },
    {
      accessorKey: 'tasaBCV',
      header: 'Tasa BCV',
      cell: ({ row }) => (
        <div style={{ textAlign: 'right', color: '#64748b', fontSize: '11px' }}>
          Bs. {row.tasaBCV > 0 ? row.tasaBCV.toFixed(2) : '-'}
        </div>
      ),
    },
    {
      accessorKey: 'montoCobradoBs',
      header: 'Monto Cobrado (Bs)',
      cell: ({ row }) => (
        <div style={{ textAlign: 'right', fontWeight: 800, color: '#0f172a', fontSize: '11.5px' }}>
          Bs. {row.montoCobradoBs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
      ),
    },
    {
      accessorKey: 'saldoRestanteUSD',
      header: 'Saldo Restante ($)',
      cell: ({ row }) => (
        <div style={{ textAlign: 'right', fontWeight: 800, color: '#b45309' }}>
          $ {row.saldoRestanteUSD.toFixed(2)}
        </div>
      ),
    },
    {
      accessorKey: 'detalle',
      header: 'Detalle / Concepto',
      cell: ({ row }) => (
        <span style={{ fontSize: '11.5px', color: '#475569' }}>
          {row.detalle}
        </span>
      ),
    },
    {
      accessorKey: 'estado',
      header: 'Estado',
      cell: ({ row }) => (
        <div style={{ textAlign: 'center' }}>
          <span
            style={{
              fontSize: '10px',
              fontWeight: 800,
              padding: '2px 8px',
              borderRadius: '6px',
              display: 'inline-block',
              background: '#dcfce7',
              color: '#15803d',
              border: '1px solid #86efac',
            }}
          >
            {row.estado}
          </span>
        </div>
      ),
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
            <i className="fa-solid fa-coins" style={{ color: '#f59e0b', marginRight: '8px' }}></i>
            Abonos &amp; Amortizaciones
          </h1>
          <p className="view-subtitle">
            Control de cuotas cobradas en liquidaciones y registro de abonos extraordinarios directos
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['abonos-amortizaciones'] })}
            className="btn btn-outline"
            style={{ borderColor: '#cbd5e1', color: '#475569', background: '#fff', fontWeight: 700 }}
          >
            <i className="fa-solid fa-rotate" style={{ marginRight: '6px' }}></i> Actualizar
          </button>
          <button
            type="button"
            onClick={exportarAbonosExcel}
            className="btn btn-outline"
            style={{ borderColor: '#10b981', color: '#047857', background: '#ecfdf5', fontWeight: 700 }}
          >
            <i className="fa-solid fa-file-excel" style={{ marginRight: '6px' }}></i> Exportar Excel
          </button>
          <button
            type="button"
            onClick={() => {
              setTasaBcv(tasaBcvActual);
              setModalAbonoDirectoOpen(true);
            }}
            className="btn btn-primary"
            style={{
              background: 'linear-gradient(135deg, #f59e0b, #d97706)',
              border: 'none',
              fontWeight: 800,
              boxShadow: '0 4px 12px rgba(245, 158, 11, 0.35)',
            }}
          >
            <i className="fa-solid fa-plus" style={{ marginRight: '6px' }}></i> + Registrar Abono Directo
          </button>
        </div>
      </div>

      {/* 4 STAT CARDS 1:1 V2_3_11_26 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
          marginBottom: '20px',
        }}
      >
        <div
          style={{
            background: 'linear-gradient(135deg, #1e293b, #0f172a)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '12px',
            padding: '18px',
            color: '#fff',
          }}
        >
          <div style={{ fontSize: '11.5px', fontWeight: 800, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
            Total Amortizado (USD)
          </div>
          <div style={{ fontSize: '24px', fontWeight: 900, color: '#34d399' }}>
            $ {kpis.totalUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <small style={{ color: '#94a3b8', fontSize: '11px' }}>Monto total recaudado en cuotas</small>
        </div>

        <div
          style={{
            background: 'linear-gradient(135deg, #1e293b, #0f172a)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '12px',
            padding: '18px',
            color: '#fff',
          }}
        >
          <div style={{ fontSize: '11.5px', fontWeight: 800, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
            Total Amortizado (Bs)
          </div>
          <div style={{ fontSize: '24px', fontWeight: 900, color: '#fde047' }}>
            Bs. {kpis.totalBs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <small style={{ color: '#94a3b8', fontSize: '11px' }}>Convertido a Tasa BCV aplicada</small>
        </div>

        <div
          style={{
            background: 'linear-gradient(135deg, #1e293b, #0f172a)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '12px',
            padding: '18px',
            color: '#fff',
          }}
        >
          <div style={{ fontSize: '11.5px', fontWeight: 800, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
            Cuotas Cobradas
          </div>
          <div style={{ fontSize: '24px', fontWeight: 900, color: '#c084fc' }}>
            {kpis.cuotasCobradas}
          </div>
          <small style={{ color: '#94a3b8', fontSize: '11px' }}>Descuentos procesados con éxito</small>
        </div>

        <div
          style={{
            background: 'linear-gradient(135deg, #1e293b, #0f172a)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '12px',
            padding: '18px',
            color: '#fff',
          }}
        >
          <div style={{ fontSize: '11.5px', fontWeight: 800, color: '#f472b6', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
            Fincas / Entidades con Abonos
          </div>
          <div style={{ fontSize: '24px', fontWeight: 900, color: '#f472b6' }}>
            {kpis.totalEntidades}
          </div>
          <small style={{ color: '#94a3b8', fontSize: '11px' }}>Entidades con saldo amortizado</small>
        </div>
      </div>

      {/* CONTENT CARD CON DATATABLE */}
      <div className="content-card">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '14px',
            marginBottom: '16px',
            paddingBottom: '14px',
            borderBottom: '1px solid #f1f5f9',
          }}
        >
          <div>
            <h3 style={{ margin: '0 0 4px 0', fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>
              <i className="fa-solid fa-list-check" style={{ color: '#f59e0b', marginRight: '6px' }}></i>
              Registro de Cuotas &amp; Abonos
            </h3>
            <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>
              Trazabilidad completa por finca, semana operativa y comprobante
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: '#475569' }}>
              <label>Entidad:</label>
              <select
                value={filtroTipoEntidad}
                onChange={(e) => setFiltroTipoEntidad(e.target.value)}
                className="form-input"
                style={{ height: '38px', padding: '0 10px', fontSize: '13px', fontWeight: 700 }}
              >
                <option value="">TODAS</option>
                <option value="FINCA">Fincas</option>
                <option value="RECEPTORIA">Receptoría</option>
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: '#475569' }}>
              <label>Semana:</label>
              <select
                value={filtroCiclo}
                onChange={(e) => setFiltroCiclo(e.target.value)}
                className="form-input"
                style={{ height: '38px', padding: '0 10px', fontSize: '13px', fontWeight: 700 }}
              >
                <option value="">TODAS LAS SEMANAS</option>
                {ciclos.map((s) => (
                  <option key={s.id} value={String(s.id)}>
                    {s.codigo || `Semana #${s.id}`} {String(s.estado || '').toUpperCase() === 'ABIERTO' ? '★ (ACTIVA)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={abonos}
          isLoading={isLoading}
          searchPlaceholder="Buscar por finca o adelanto..."
        />
      </div>

      {/* MODAL REGISTRAR ABONO DIRECTO */}
      {modalAbonoDirectoOpen && (
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
              maxWidth: '540px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                padding: '16px 20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                color: '#fff',
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800 }}>
                  <i className="fa-solid fa-coins" style={{ marginRight: '6px' }}></i>
                  Registrar Abono Directo
                </h3>
                <span style={{ fontSize: '11px', color: '#fef3c7' }}>
                  Pago extraordinario para amortizar saldo de adelanto
                </span>
              </div>
              <button
                type="button"
                onClick={() => setModalAbonoDirectoOpen(false)}
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

            <form onSubmit={handleGuardarAbonoDirecto} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 800, color: '#334155', display: 'block', marginBottom: '6px' }}>
                  Adelanto Activo a Abonar *
                </label>
                <select
                  required
                  value={adelantoIdAbono}
                  onChange={(e) => {
                    setAdelantoIdAbono(e.target.value);
                    const sel = adelantosDisponiblesModal.find((a: any) => String(a.id || (a as any).Id) === e.target.value);
                    if (sel) {
                      setMontoUSD(Number((sel as any).cuotaUSD || (sel as any).montoPendienteUSD || 0));
                    }
                  }}
                  className="form-input"
                  style={{ height: '40px', fontWeight: 700 }}
                >
                  <option value="">-- Seleccionar Adelanto Activo --</option>
                  {adelantosDisponiblesModal.map((a: any) => (
                    <option key={a.id} value={String(a.id)}>
                      #{a.id} - {a.fincaNombre || a.entidadNombre} (Pendiente: ${Number(a.montoPendienteUSD ?? a.saldoPendienteUSD ?? 0).toFixed(2)})
                    </option>
                  ))}
                </select>
              </div>

              {adelantoSeleccionadoModal && (
                <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>Saldo Pendiente:</span>
                    <div style={{ fontSize: '15px', fontWeight: 900, color: '#b45309' }}>
                      $ {Number(adelantoSeleccionadoModal.montoPendienteUSD ?? adelantoSeleccionadoModal.saldoPendienteUSD ?? 0).toFixed(2)} USD
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>Cuota Recomendada:</span>
                    <div style={{ fontSize: '15px', fontWeight: 900, color: '#2563eb' }}>
                      $ {Number((adelantoSeleccionadoModal as any).cuotaUSD || 0).toFixed(2)} USD
                    </div>
                  </div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 800, color: '#334155', display: 'block', marginBottom: '6px' }}>
                    Monto Abonado ($ USD) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={montoUSD || ''}
                    onChange={(e) => setMontoUSD(parseFloat(e.target.value) || 0)}
                    className="form-input"
                    style={{ height: '38px', fontWeight: 800, color: '#059669' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 800, color: '#334155', display: 'block', marginBottom: '6px' }}>
                    Tasa BCV (Bs/$) *
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    min="0.0001"
                    required
                    value={tasaBcv || ''}
                    onChange={(e) => setTasaBcv(parseFloat(e.target.value) || 0)}
                    className="form-input"
                    style={{ height: '38px', fontWeight: 800, color: '#2563eb' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 800, color: '#334155', display: 'block', marginBottom: '6px' }}>
                  Referencia Bancaria / Comprobante
                </label>
                <input
                  type="text"
                  value={referenciaBancaria}
                  onChange={(e) => setReferenciaBancaria(e.target.value)}
                  placeholder="Ej: Transf. 984124 / Pago móvil"
                  className="form-input"
                  style={{ height: '38px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 800, color: '#334155', display: 'block', marginBottom: '6px' }}>
                  Observaciones
                </label>
                <input
                  type="text"
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  placeholder="Ej: Pago directo en oficina..."
                  className="form-input"
                  style={{ height: '38px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setModalAbonoDirectoOpen(false)}
                  disabled={loadingAbono}
                  className="btn btn-outline"
                  style={{ fontWeight: 700, padding: '7px 14px', background: '#fff' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loadingAbono}
                  className="btn btn-primary"
                  style={{ fontWeight: 800, padding: '7px 18px', background: '#f59e0b', border: 'none' }}
                >
                  {loadingAbono ? 'Registrando...' : 'Confirmar Abono'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
