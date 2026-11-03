import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { finanzasApi } from '@/api/finanzas.api';
import { catalogosApi } from '@/api/catalogos.api';
import { DataTable, type ColumnDef } from '@/components/common/DataTable';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import type { AbonoCompaniaDto, CompaniaDto } from '@/types';

export const AbonosCompaniasPage: React.FC = () => {
  const queryClient = useQueryClient();

  const [modalNuevo, setModalNuevo] = useState(false);
  const [filtroCompania, setFiltroCompania] = useState<string>('');

  const initialForm = {
    companiaId: 0,
    fecha: new Date().toISOString().split('T')[0],
    montoUSD: 0,
    referenciaBancaria: '',
    observaciones: '',
  };
  const [form, setForm] = useState(initialForm);

  const { data: abonos = [], isLoading } = useQuery<AbonoCompaniaDto[]>({
    queryKey: ['abonos-companias'],
    queryFn: () => finanzasApi.getAbonosCompanias(),
  });

  const { data: companias = [] } = useQuery<CompaniaDto[]>({
    queryKey: ['companias'],
    queryFn: () => catalogosApi.getCompanias(true),
  });

  const companiasOptions = useMemo(() => {
    return companias.map((c) => ({
      value: c.id,
      label: c.nombre,
      subLabel: c.contacto ? `Contacto: ${c.contacto}` : undefined,
    }));
  }, [companias]);

  const companiasFiltroOptions = useMemo(() => {
    return [
      { value: '', label: 'Todas las compañías' },
      ...companias.map((c) => ({
        value: String(c.id),
        label: c.nombre,
      })),
    ];
  }, [companias]);

  const crearMutation = useMutation({
    mutationFn: (dto: typeof initialForm) => finanzasApi.crearAbonoCompania(dto),
    onSuccess: (data: any) => {
      toast.success(data.message || 'Abono recibido registrado');
      queryClient.invalidateQueries({ queryKey: ['abonos-companias'] });
      setModalNuevo(false);
      setForm(initialForm);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Error al registrar abono');
    },
  });

  const totalRecaudado = abonos.reduce((acc, a) => acc + (a.montoUSD || 0), 0);
  const companiasActivasCount = new Set(abonos.map(a => a.companiaId)).size;

  const abonosFiltrados = abonos.filter((a) => {
    if (filtroCompania && a.companiaId?.toString() !== filtroCompania) return false;
    return true;
  });

  const exportarExcel = () => {
    const ws = XLSX.utils.json_to_sheet(abonosFiltrados);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'AbonosCompanias');
    XLSX.writeFile(wb, `Abonos_Companias_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const columns: ColumnDef<AbonoCompaniaDto>[] = [
    {
      header: 'Fecha & Ref.',
      accessorKey: 'fecha',
      sortable: true,
      cell: (row) => (
        <div>
          <span style={{ fontWeight: 700, color: '#0f172a' }}>
            {row.fecha ? new Date(row.fecha).toLocaleDateString('es-VE') : '-'}
          </span>
          <div style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace' }}>
            Ref: {row.referenciaBancaria || 'Depósito Bancario'}
          </div>
        </div>
      ),
    },
    {
      header: 'Compañía / Planta Receptora',
      accessorKey: 'companiaNombre',
      sortable: true,
      cell: (row) => {
        const comp = companias.find(c => c.id === row.companiaId);
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
              <div style={{ fontWeight: 700, color: '#0f172a' }}>{nombre}</div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>Cobro de leche recibida</div>
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
      header: 'Observaciones / Detalle',
      accessorKey: 'observaciones',
      cell: (row) => (
        <span style={{ color: '#475569', fontSize: '12.5px' }}>
          {row.observaciones || 'Pago registrado'}
        </span>
      ),
    },
  ];

  return (
    <div>
      {/* VISTA HEADER 1:1 */}
      <div className="view-header">
        <div>
          <h1 className="view-title">
            <i className="fa-solid fa-building-circle-check" style={{ color: '#059669', marginRight: '8px' }}></i>
            Abonos & Cobros a Compañías
          </h1>
          <p className="view-subtitle">
            Registro de cobros recibidos de plantas lácteas y queseras por concepto de leche despachada
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
            }}
          >
            <i className="fa-solid fa-plus-circle"></i> + Registrar Abono de Compañía
          </button>
        </div>
      </div>

      {/* TARJETAS KPI */}
      <div className="kpi-grid" style={{ marginBottom: '24px' }}>
        <div className="kpi-card glass-emerald">
          <div className="kpi-icon-wrap"><i className="fa-solid fa-dollar-sign"></i></div>
          <div className="kpi-content">
            <span className="kpi-title">Total Recaudado Compañías</span>
            <div className="kpi-value">${totalRecaudado.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <span className="kpi-foot">Cobros efectivos recibidos</span>
          </div>
        </div>

        <div className="kpi-card glass-blue">
          <div className="kpi-icon-wrap"><i className="fa-solid fa-receipt"></i></div>
          <div className="kpi-content">
            <span className="kpi-title">Transacciones de Pago</span>
            <div className="kpi-value">{abonos.length}</div>
            <span className="kpi-foot">Comprobantes procesados</span>
          </div>
        </div>

        <div className="kpi-card glass-purple">
          <div className="kpi-icon-wrap"><i className="fa-solid fa-building-wheat"></i></div>
          <div className="kpi-content">
            <span className="kpi-title">Plantas con Pagos</span>
            <div className="kpi-value">{companiasActivasCount}</div>
            <span className="kpi-foot">Compañías al día</span>
          </div>
        </div>
      </div>

      {/* BARRA DE FILTROS */}
      <div className="content-card" style={{ padding: '16px 20px', marginBottom: '18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <div>
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

      {/* Tabla Principal */}
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

      {/* Modal Registrar Abono */}
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
                <i className="fa-solid fa-building-circle-check" style={{ color: '#059669', marginRight: '8px' }}></i>
                Registrar Abono de Compañía
              </h3>
              <button type="button" onClick={() => setModalNuevo(false)} style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '18px' }}>
                &times;
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!form.companiaId || form.companiaId === 0) {
                  toast.error('Debe seleccionar la compañía');
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
                  Compañía / Planta Receptora *
                </label>
                <SearchableSelect
                  options={companiasOptions}
                  value={form.companiaId || ''}
                  onChange={(val) => setForm({ ...form, companiaId: Number(val) })}
                  placeholder="-- Seleccionar Compañía --"
                  searchPlaceholder="Buscar por nombre..."
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                    Monto Cobrado ($) *
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

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                  Referencia Bancaria
                </label>
                <input
                  type="text"
                  value={form.referenciaBancaria}
                  onChange={(e) => setForm({ ...form, referenciaBancaria: e.target.value })}
                  placeholder="Número de transferencia o depósito..."
                  className="form-input"
                  style={{ width: '100%', height: '38px', borderRadius: '8px', fontFamily: 'monospace' }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                  Observaciones / Concepto
                </label>
                <input
                  type="text"
                  value={form.observaciones}
                  onChange={(e) => setForm({ ...form, observaciones: e.target.value })}
                  placeholder="Ej: Pago factura semana 42..."
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
                  style={{ height: '38px', padding: '0 20px', borderRadius: '8px', background: '#059669', border: 'none', fontWeight: 700 }}
                >
                  {crearMutation.isPending ? 'Guardando...' : 'Registrar Abono'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AbonosCompaniasPage;
