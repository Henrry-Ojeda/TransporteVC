import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Swal from 'sweetalert2';
import * as XLSX from 'xlsx';
import { finanzasApi } from '@/api/finanzas.api';
import { catalogosApi } from '@/api/catalogos.api';
import { DataTable, type ColumnDef } from '@/components/common/DataTable';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import type { AbonoCompaniaDto, CompaniaDto, BancoDto } from '@/types';

export const AbonosCompaniasPage: React.FC = () => {
  const queryClient = useQueryClient();

  const [modalNuevo, setModalNuevo] = useState(false);
  const [filtroCompania, setFiltroCompania] = useState<string>('');

  const initialForm = {
    companiaId: 0,
    fecha: new Date().toISOString().split('T')[0],
    montoUSD: 0,
    montoBs: 0,
    tasaBcv: 1,
    referenciaBancaria: '',
    bancoId: undefined as number | undefined,
    fechaLecheAbonada: new Date().toISOString().split('T')[0],
    litrosAbonados: 0,
    observaciones: '',
    tipoPago: 'TRANSFERENCIA',
  };
  const [form, setForm] = useState(initialForm);

  // Queries
  const { data: abonos = [], isLoading } = useQuery<AbonoCompaniaDto[]>({
    queryKey: ['abonos-companias'],
    queryFn: () => finanzasApi.getAbonosCompanias(),
  });

  const { data: companias = [] } = useQuery<CompaniaDto[]>({
    queryKey: ['companias'],
    queryFn: () => catalogosApi.getCompanias(true),
  });

  const { data: bancos = [] } = useQuery<BancoDto[]>({
    queryKey: ['bancos'],
    queryFn: () => catalogosApi.getBancos(),
  });

  const { data: resumenCobranzas = [] } = useQuery({
    queryKey: ['resumen-cobranzas-companias'],
    queryFn: () => finanzasApi.getResumenCobranzasCompanias(),
  });

  const companiasOptions = useMemo(() => {
    return companias.map((c) => ({
      value: c.id,
      label: c.nombre,
      subLabel: c.contacto ? `Contacto: ${c.contacto}` : `Precio: $${c.precioLitroUSD || 0}/Lt`,
    }));
  }, [companias]);

  const companiasFiltroOptions = useMemo(() => {
    return [
      { value: '', label: 'Todas las compañías / plantas' },
      ...companias.map((c) => ({
        value: String(c.id),
        label: c.nombre,
      })),
    ];
  }, [companias]);

  const bancosOptions = useMemo(() => {
    return [
      { value: '', label: '-- Seleccionar Banco Receptor --' },
      ...bancos.map((b) => ({
        value: b.id,
        label: b.nombre,
      })),
    ];
  }, [bancos]);

  const crearMutation = useMutation({
    mutationFn: (dto: typeof initialForm) => finanzasApi.crearAbonoCompania(dto),
    onSuccess: (data: any) => {
      Swal.fire({
        icon: 'success',
        title: '¡Abono Registrado!',
        text: data.message || 'El cobro a compañía se registró y abonó correctamente.',
        confirmButtonColor: '#059669',
      });
      queryClient.invalidateQueries({ queryKey: ['abonos-companias'] });
      queryClient.invalidateQueries({ queryKey: ['resumen-cobranzas-companias'] });
      setModalNuevo(false);
      setForm(initialForm);
    },
    onError: (err: any) => {
      Swal.fire({
        icon: 'error',
        title: 'Error al Registrar',
        text: err.response?.data?.message || 'Error al registrar abono',
        confirmButtonColor: '#ef4444',
      });
    },
  });

  // Cálculos de KPI y Totales
  const totalCobradoUSD = abonos.reduce((acc, a) => acc + (a.montoUSD || 0), 0);
  const totalFacturadoUSD = resumenCobranzas.reduce((acc: number, r: any) => acc + (Number(r.totalFacturadoUSD) || 0), 0);
  const totalSaldoPendienteUSD = Math.max(0, totalFacturadoUSD - totalCobradoUSD);
  const companiasConDeuda = resumenCobranzas.filter((r: any) => Number(r.saldoPendienteUSD) > 0).length;

  const abonosFiltrados = abonos.filter((a) => {
    if (filtroCompania && a.companiaId?.toString() !== filtroCompania) return false;
    return true;
  });

  const exportarExcel = () => {
    const dataExport = abonosFiltrados.map((a) => ({
      'Fecha Cobro': a.fecha ? new Date(a.fecha).toLocaleDateString('es-VE') : '-',
      'Compañía / Planta': a.companiaNombre || `Planta #${a.companiaId}`,
      'Monto Cobrado (USD)': a.montoUSD,
      'Referencia Bancaria': a.referenciaBancaria || 'Depósito',
      'Banco Receptor': a.bancoNombre || 'N/A',
      'Fecha Leche Abonada': a.fechaLecheAbonada ? new Date(a.fechaLecheAbonada).toLocaleDateString('es-VE') : 'Cuenta General',
      'Litros Leche Abonados': a.litrosAbonados || 0,
      'Observaciones': a.observaciones || 'Pago registrado',
    }));

    const ws = XLSX.utils.json_to_sheet(dataExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Abonos_Companias');
    XLSX.writeFile(wb, `Abonos_Companias_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const columns: ColumnDef<AbonoCompaniaDto>[] = [
    {
      header: 'Fecha & Ref.',
      accessorKey: 'fecha',
      sortable: true,
      cell: (row) => (
        <div>
          <span style={{ fontWeight: 800, color: '#0f172a' }}>
            {row.fecha ? new Date(row.fecha).toLocaleDateString('es-VE') : '-'}
          </span>
          <div style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace' }}>
            Ref: {row.referenciaBancaria || 'Sin Ref.'}
          </div>
        </div>
      ),
    },
    {
      header: 'Compañía / Planta Receptora',
      accessorKey: 'companiaNombre',
      sortable: true,
      cell: (row) => {
        const comp = companias.find((c) => c.id === row.companiaId);
        const nombre = row.companiaNombre || comp?.nombre || `Planta #${row.companiaId}`;
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: '#ecfdf5',
                color: '#059669',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                flexShrink: 0,
              }}
            >
              <i className="fa-solid fa-building"></i>
            </div>
            <div>
              <div style={{ fontWeight: 800, color: '#0f172a' }}>{nombre}</div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>
                {row.bancoNombre ? `Banco: ${row.bancoNombre}` : 'Recepción de fondos'}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      header: 'Monto Recibido ($)',
      accessorKey: 'montoUSD',
      sortable: true,
      cell: (row) => (
        <span style={{ fontWeight: 900, color: '#059669', fontSize: '14px', fontFamily: 'monospace' }}>
          ${Number(row.montoUSD || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      header: 'Leche de Fecha Abonada',
      accessorKey: 'fechaLecheAbonada',
      sortable: true,
      cell: (row) => (
        <div>
          {row.fechaLecheAbonada ? (
            <span
              style={{
                fontSize: '11.5px',
                fontWeight: 800,
                color: '#1d4ed8',
                background: '#eff6ff',
                padding: '2px 8px',
                borderRadius: '6px',
                border: '1px solid #bfdbfe',
              }}
            >
              📅 Leche del {new Date(row.fechaLecheAbonada).toLocaleDateString('es-VE')}
            </span>
          ) : (
            <span style={{ fontSize: '11.5px', color: '#64748b', fontStyle: 'italic' }}>
              Abono a Cuenta General
            </span>
          )}
          {row.litrosAbonados && row.litrosAbonados > 0 ? (
            <div style={{ fontSize: '11px', color: '#059669', fontWeight: 700, marginTop: '2px' }}>
              ✓ Cubre {Number(row.litrosAbonados).toLocaleString()} Lts
            </div>
          ) : null}
        </div>
      ),
    },
    {
      header: 'Observaciones / Detalle',
      accessorKey: 'observaciones',
      cell: (row) => (
        <span style={{ color: '#475569', fontSize: '12px' }}>
          {row.observaciones || 'Pago registrado'}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* HEADER DE LA VISTA */}
      <div className="view-header">
        <div>
          <h1 className="view-title">
            <i className="fa-solid fa-building-circle-check" style={{ color: '#059669', marginRight: '8px' }}></i>
            Historial de Cobros & Abonos de Compañías
          </h1>
          <p className="view-subtitle">
            Trazabilidad de entradas de dinero por venta de leche a plantas queseras, detallando fecha y ticket de leche abonado
          </p>
        </div>

        <div className="view-actions" style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            className="btn btn-outline"
            onClick={exportarExcel}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: 700,
              borderColor: '#10b981',
              color: '#047857',
              background: '#ecfdf5',
              height: '38px',
            }}
          >
            <i className="fa-solid fa-file-excel"></i> Exportar Cobros
          </button>
          <button
            type="button"
            onClick={() => setModalNuevo(true)}
            className="btn btn-primary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              fontWeight: 800,
              padding: '9px 18px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #059669, #047857)',
              border: 'none',
              boxShadow: '0 4px 12px rgba(5,150,105,0.25)',
              height: '38px',
            }}
          >
            <i className="fa-solid fa-plus-circle"></i> + Registrar Abono de Compañía
          </button>
        </div>
      </div>

      {/* TARJETAS KPI DE ENTRADAS VS FACTURACIÓN */}
      <div className="kpi-grid" style={{ marginBottom: '24px' }}>
        <div className="kpi-card glass-emerald">
          <div className="kpi-icon-wrap"><i className="fa-solid fa-hand-holding-dollar"></i></div>
          <div className="kpi-content">
            <span className="kpi-title">Total Cobrado (Entradas)</span>
            <div className="kpi-value">${totalCobradoUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <span className="kpi-foot">{abonos.length} abonos registrados</span>
          </div>
        </div>

        <div className="kpi-card glass-blue">
          <div className="kpi-icon-wrap"><i className="fa-solid fa-truck-ramp-box"></i></div>
          <div className="kpi-content">
            <span className="kpi-title">Total Facturado / Leche</span>
            <div className="kpi-value">${totalFacturadoUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <span className="kpi-foot">Despachos valorados a plantas</span>
          </div>
        </div>

        <div className="kpi-card glass-amber">
          <div className="kpi-icon-wrap"><i className="fa-solid fa-clock-rotate-left"></i></div>
          <div className="kpi-content">
            <span className="kpi-title">Saldo por Cobrar a Plantas</span>
            <div className="kpi-value">${totalSaldoPendienteUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <span className="kpi-foot">{companiasConDeuda} compañías con saldo</span>
          </div>
        </div>

        <div className="kpi-card glass-purple">
          <div className="kpi-icon-wrap"><i className="fa-solid fa-scale-balanced"></i></div>
          <div className="kpi-content">
            <span className="kpi-title">Tasa de Recuperación</span>
            <div className="kpi-value">
              {totalFacturadoUSD > 0 ? `${Math.round((totalCobradoUSD / totalFacturadoUSD) * 100)}%` : '100%'}
            </div>
            <span className="kpi-foot">Efectividad de cobranza</span>
          </div>
        </div>
      </div>

      {/* BARRA DE FILTROS */}
      <div className="content-card" style={{ padding: '16px 20px', marginBottom: '18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <div style={{ minWidth: '280px' }}>
            <label style={{ fontSize: '11.5px', fontWeight: 800, color: '#475569', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>
              <i className="fa-solid fa-building" style={{ color: '#059669', marginRight: '4px' }}></i> Filtrar por Compañía:
            </label>
            <SearchableSelect
              options={companiasFiltroOptions}
              value={filtroCompania}
              onChange={(val) => setFiltroCompania(val || '')}
              placeholder="Todas las compañías"
              searchPlaceholder="Buscar compañía..."
              allowClear={true}
            />
          </div>
        </div>
      </div>

      {/* Tabla Principal de Abonos */}
      <DataTable
        data={abonosFiltrados}
        columns={columns}
        isLoading={isLoading}
        searchPlaceholder="Buscar por compañía, referencia u observaciones..."
        exportFileName="abonos_companias"
        searchFilter={(row, term) =>
          Boolean(
            (row.companiaNombre && row.companiaNombre.toLowerCase().includes(term)) ||
            (row.referenciaBancaria && row.referenciaBancaria.toLowerCase().includes(term)) ||
            (row.observaciones && row.observaciones.toLowerCase().includes(term))
          )
        }
      />

      {/* MODAL REGISTRAR ABONO CON TRAZABILIDAD DE LECHE */}
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
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
          }}
        >
          <div
            className="content-card"
            style={{
              width: '100%',
              maxWidth: '560px',
              padding: '0',
              overflow: 'visible',
              borderRadius: '16px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              backgroundColor: '#ffffff',
            }}
          >
            {/* Header del modal */}
            <div
              style={{
                padding: '16px 22px',
                background: 'linear-gradient(135deg, #059669, #047857)',
                color: '#ffffff',
                borderTopLeftRadius: '16px',
                borderTopRightRadius: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className="fa-solid fa-building-circle-check text-white text-lg"></i>
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#ffffff' }}>
                    Registrar Cobro / Abono de Compañía
                  </h3>
                  <span style={{ fontSize: '11.5px', color: '#a7f3d0' }}>
                    Entrada de dinero y vinculación con despacho de leche
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalNuevo(false)}
                style={{ background: 'transparent', border: 'none', color: '#ffffff', cursor: 'pointer', fontSize: '20px' }}
              >
                &times;
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!form.companiaId || form.companiaId === 0) {
                  Swal.fire({ icon: 'warning', title: 'Compañía Requerida', text: 'Debes seleccionar la compañía que realiza el pago.', confirmButtonColor: '#059669' });
                  return;
                }
                if (form.montoUSD <= 0) {
                  Swal.fire({ icon: 'warning', title: 'Monto Requerido', text: 'El monto en dólares debe ser mayor a 0.', confirmButtonColor: '#059669' });
                  return;
                }
                crearMutation.mutate(form);
              }}
              style={{ padding: '22px' }}
            >
              {/* Selector Compañía con SearchableSelect */}
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                  Compañía / Planta Receptora <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <SearchableSelect
                  options={companiasOptions}
                  value={form.companiaId || ''}
                  onChange={(val) => setForm({ ...form, companiaId: Number(val) })}
                  placeholder="-- Seleccionar Compañía o Planta --"
                  searchPlaceholder="Buscar por nombre..."
                />
              </div>

              {/* Monto y Fecha de Pago */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                    Monto Cobrado (USD) <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.montoUSD || ''}
                    onChange={(e) => setForm({ ...form, montoUSD: Number(e.target.value) })}
                    placeholder="0.00"
                    className="form-input"
                    style={{ width: '100%', height: '38px', borderRadius: '8px', fontWeight: 800, color: '#059669', fontSize: '14px' }}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                    Fecha del Cobro
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

              {/* Banco Receptor y Referencia */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                    Banco Receptor de Fondos
                  </label>
                  <SearchableSelect
                    options={bancosOptions}
                    value={form.bancoId || ''}
                    onChange={(val) => setForm({ ...form, bancoId: val ? Number(val) : undefined })}
                    placeholder="-- Seleccionar Banco --"
                    searchPlaceholder="Buscar banco..."
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                    Referencia Bancaria
                  </label>
                  <input
                    type="text"
                    value={form.referenciaBancaria}
                    onChange={(e) => setForm({ ...form, referenciaBancaria: e.target.value })}
                    placeholder="Ej: 00928174..."
                    className="form-input"
                    style={{ width: '100%', height: '38px', borderRadius: '8px', fontFamily: 'monospace' }}
                  />
                </div>
              </div>

              {/* TRAZABILIDAD: ¿A QUÉ LECHE DE QUÉ DÍA SE ABONA? */}
              <div
                style={{
                  background: '#f0fdf4',
                  border: '1.5px solid #bbf7d0',
                  borderRadius: '12px',
                  padding: '12px 14px',
                  marginBottom: '14px',
                }}
              >
                <span style={{ fontSize: '11.5px', fontWeight: 800, color: '#166534', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', textTransform: 'uppercase' }}>
                  <i className="fa-solid fa-calendar-day text-emerald-600"></i>
                  Trazabilidad de Leche Abonada (¿Qué despacho está pagando?)
                </span>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#374151', marginBottom: '3px' }}>
                      Fecha de Entrega de Leche
                    </label>
                    <input
                      type="date"
                      value={form.fechaLecheAbonada}
                      onChange={(e) => setForm({ ...form, fechaLecheAbonada: e.target.value })}
                      className="form-input"
                      style={{ width: '100%', height: '36px', borderRadius: '8px', background: '#ffffff', fontSize: '12px' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#374151', marginBottom: '3px' }}>
                      Litros Abonados Estimados
                    </label>
                    <input
                      type="number"
                      value={form.litrosAbonados || ''}
                      onChange={(e) => setForm({ ...form, litrosAbonados: Number(e.target.value) })}
                      placeholder="Ej: 5000"
                      className="form-input"
                      style={{ width: '100%', height: '36px', borderRadius: '8px', background: '#ffffff', fontSize: '12px', fontWeight: 700 }}
                    />
                  </div>
                </div>
              </div>

              {/* Observaciones */}
              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                  Observaciones / Notas
                </label>
                <input
                  type="text"
                  value={form.observaciones}
                  onChange={(e) => setForm({ ...form, observaciones: e.target.value })}
                  placeholder="Ej: Abono correspondiente a despacho de leche fría matutina..."
                  className="form-input"
                  style={{ width: '100%', height: '38px', borderRadius: '8px' }}
                />
              </div>

              {/* Botones de acción */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '12px', borderTop: '1px solid #e2e8f0' }}>
                <button
                  type="button"
                  onClick={() => setModalNuevo(false)}
                  className="btn btn-outline"
                  style={{ height: '38px', padding: '0 18px', borderRadius: '8px', fontWeight: 600 }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={crearMutation.isPending}
                  className="btn btn-primary"
                  style={{
                    height: '38px',
                    padding: '0 24px',
                    borderRadius: '8px',
                    fontWeight: 800,
                    background: 'linear-gradient(135deg, #059669, #047857)',
                    border: 'none',
                    boxShadow: '0 4px 12px rgba(5,150,105,0.25)',
                  }}
                >
                  {crearMutation.isPending ? 'Guardando...' : '✓ Guardar Abono'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
