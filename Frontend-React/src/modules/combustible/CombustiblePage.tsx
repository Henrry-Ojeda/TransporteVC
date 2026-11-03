import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { combustibleApi } from '@/api/combustible.api';
import { DataTable, type ColumnDef } from '@/components/common/DataTable';
import type {
  CombustibleHistorialDto,
  RegistrarDespachoCombustibleDto,
  RegistrarCompraCombustibleDto,
  AjustarStockCombustibleDto,
} from '@/types';

export const CombustiblePage: React.FC = () => {
  const queryClient = useQueryClient();

  const [filtroTipo, setFiltroTipo] = useState<string>('');
  const [filtroCombustible, setFiltroCombustible] = useState<string>('');
  const [filtroCamion, setFiltroCamion] = useState<string>('');

  // Modales
  const [modalDespacho, setModalDespacho] = useState(false);
  const [modalCompra, setModalCompra] = useState(false);
  const [modalAjuste, setModalAjuste] = useState(false);

  // Formularios
  const [formDespacho, setFormDespacho] = useState<RegistrarDespachoCombustibleDto>({
    camionId: 0,
    tipoCombustible: 'GASOIL',
    litros: 0,
    odometroKm: undefined,
    fecha: new Date().toISOString().split('T')[0],
    observaciones: '',
  });

  const [formCompra, setFormCompra] = useState<RegistrarCompraCombustibleDto>({
    tipoCombustible: 'GASOIL',
    litros: 0,
    costoPorLitroUSD: 0.5,
    proveedor: '',
    fecha: new Date().toISOString().split('T')[0],
    observaciones: '',
  });

  const [formAjuste, setFormAjuste] = useState<AjustarStockCombustibleDto>({
    tipoCombustible: 'GASOIL',
    nuevoStock: 0,
    motivo: '',
  });

  // Queries
  const { data: inventario = [], isLoading: cargandoInventario, refetch: recargarInventario } = useQuery({
    queryKey: ['combustible-inventario'],
    queryFn: combustibleApi.getInventario,
  });

  const { data: historial = [], isLoading: cargandoHistorial, refetch: recargarHistorial } = useQuery({
    queryKey: ['combustible-historial', filtroTipo, filtroCamion],
    queryFn: () => combustibleApi.getHistorial(filtroTipo || undefined, filtroCamion ? Number(filtroCamion) : undefined),
  });

  const { data: camiones = [] } = useQuery({
    queryKey: ['camiones-activos'],
    queryFn: combustibleApi.getCamiones,
  });

  // Mutaciones
  const mutationDespacho = useMutation({
    mutationFn: combustibleApi.registrarDespacho,
    onSuccess: (data) => {
      toast.success(data.message || 'Despacho registrado correctamente.');
      queryClient.invalidateQueries({ queryKey: ['combustible-inventario'] });
      queryClient.invalidateQueries({ queryKey: ['combustible-historial'] });
      setModalDespacho(false);
      setFormDespacho({
        camionId: 0,
        tipoCombustible: 'GASOIL',
        litros: 0,
        odometroKm: undefined,
        fecha: new Date().toISOString().split('T')[0],
        observaciones: '',
      });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Error al registrar el despacho.');
    },
  });

  const mutationCompra = useMutation({
    mutationFn: combustibleApi.registrarCompra,
    onSuccess: (data) => {
      toast.success(data.message || 'Compra registrada.');
      queryClient.invalidateQueries({ queryKey: ['combustible-inventario'] });
      queryClient.invalidateQueries({ queryKey: ['combustible-historial'] });
      setModalCompra(false);
      setFormCompra({
        tipoCombustible: 'GASOIL',
        litros: 0,
        costoPorLitroUSD: 0.5,
        proveedor: '',
        fecha: new Date().toISOString().split('T')[0],
        observaciones: '',
      });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Error al registrar la compra.');
    },
  });

  const mutationAjuste = useMutation({
    mutationFn: combustibleApi.ajustarStock,
    onSuccess: (data) => {
      toast.success(data.message || 'Ajuste de inventario aplicado.');
      queryClient.invalidateQueries({ queryKey: ['combustible-inventario'] });
      queryClient.invalidateQueries({ queryKey: ['combustible-historial'] });
      setModalAjuste(false);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Error al ajustar el stock.');
    },
  });

  // Tanques de inventario
  const gasoil = inventario.find((i) => i.tipoCombustible.toUpperCase().includes('GASOIL')) || {
    tipoCombustible: 'GASOIL (DIÉSEL)',
    stockActualLitros: 0,
    costoPromedioPorLitroUSD: 0.5,
  };

  const gasolina = inventario.find((i) => i.tipoCombustible.toUpperCase().includes('GASOLINA')) || {
    tipoCombustible: 'GASOLINA',
    stockActualLitros: 0,
    costoPromedioPorLitroUSD: 0.5,
  };

  const columns: ColumnDef<CombustibleHistorialDto>[] = [
    {
      header: 'FECHA',
      accessorKey: 'fecha',
      sortable: true,
      cell: (row) => (
        <span style={{ fontWeight: 700, color: '#0f172a' }}>
          {new Date(row.fecha).toLocaleDateString('es-VE')}
        </span>
      ),
    },
    {
      header: 'TIPO',
      accessorKey: 'tipoMovimiento',
      sortable: true,
      cell: (row) => {
        const esDespacho = row.tipoMovimiento === 'DESPACHO_CAMION';
        const esCompra = row.tipoMovimiento === 'COMPRA_INGRESO';
        return (
          <span
            className="badge"
            style={{
              background: esDespacho ? '#eff6ff' : esCompra ? '#ecfdf5' : '#fef3c7',
              color: esDespacho ? '#1d4ed8' : esCompra ? '#047857' : '#b45309',
              border: `1px solid ${esDespacho ? '#bfdbfe' : esCompra ? '#a7f3d0' : '#fde68a'}`,
              fontWeight: 700,
            }}
          >
            <i className={`fa-solid ${esDespacho ? 'fa-truck-arrow-right' : esCompra ? 'fa-cart-arrow-down' : 'fa-sliders'}`} style={{ marginRight: '4px' }}></i>
            {esDespacho ? 'Despacho Camión' : esCompra ? 'Ingreso Compra' : 'Ajuste Stock'}
          </span>
        );
      },
    },
    {
      header: 'COMBUSTIBLE',
      accessorKey: 'tipoCombustible',
      cell: (row) => (
        <span style={{ fontWeight: 800, color: row.tipoCombustible === 'GASOIL' ? '#0369a1' : '#b45309' }}>
          {row.tipoCombustible}
        </span>
      ),
    },
    {
      header: 'LITROS',
      accessorKey: 'litros',
      sortable: true,
      cell: (row) => {
        const esDespacho = row.tipoMovimiento === 'DESPACHO_CAMION';
        return (
          <span style={{ fontWeight: 800, color: esDespacho ? '#dc2626' : '#059669', fontSize: '13.5px' }}>
            {esDespacho ? '-' : '+'}
            {(row.litros || 0).toLocaleString()} <small>L</small>
          </span>
        );
      },
    },
    {
      header: 'STOCK NUEVO',
      accessorKey: 'stockNuevoLitros',
      cell: (row) => (
        <span style={{ fontWeight: 700, color: '#334155' }}>
          {(row.stockNuevoLitros || 0).toLocaleString()} L
        </span>
      ),
    },
    {
      header: 'DESTINO / VEHÍCULO',
      cell: (row) => (
        <div>
          {row.camionPlaca ? (
            <div style={{ fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <i className="fa-solid fa-truck" style={{ color: '#64748b' }}></i>
              {row.camionPlaca}
            </div>
          ) : row.proveedor ? (
            <div style={{ fontWeight: 600, color: '#059669' }}>
              <i className="fa-solid fa-building" style={{ marginRight: '4px' }}></i>
              {row.proveedor}
            </div>
          ) : (
            <span style={{ color: '#94a3b8' }}>Ajuste de inventario</span>
          )}
          {row.choferNombre && (
            <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>{row.choferNombre}</span>
          )}
        </div>
      ),
    },
    {
      header: 'ODÓMETRO',
      accessorKey: 'odometroKm',
      cell: (row) => (
        <span style={{ color: '#475569', fontFamily: 'monospace' }}>
          {row.odometroKm ? `${row.odometroKm.toLocaleString()} Km` : '-'}
        </span>
      ),
    },
    {
      header: 'DETALLES / OBSERVACIÓN',
      accessorKey: 'observaciones',
      cell: (row) => (
        <span style={{ fontSize: '12px', color: '#64748b' }}>{row.observaciones || '-'}</span>
      ),
    },
  ];

  return (
    <section id="tab-combustible" className="tab-content active" style={{ display: 'block' }}>
      {/* CABECERA VISTA */}
      <div className="view-header">
        <div>
          <h1 className="view-title">
            <i className="fa-solid fa-gas-pump" style={{ color: '#0284c7', marginRight: '8px' }}></i>
            Gestión y Control de Combustible
          </h1>
          <p className="view-subtitle">
            Control de niveles en tanques de almacenamiento, registro de compras y suministros a la flota cisterna
          </p>
        </div>
        <div className="view-actions" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => setModalAjuste(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}
          >
            <i className="fa-solid fa-sliders"></i> Ajustar Tanque
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setModalCompra(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: '#059669',
              borderColor: '#059669',
              fontWeight: 700,
            }}
          >
            <i className="fa-solid fa-cart-plus"></i> Registrar Compra / Ingreso
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setModalDespacho(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: '#0284c7',
              borderColor: '#0284c7',
              fontWeight: 700,
            }}
          >
            <i className="fa-solid fa-truck-droplet"></i> Despachar a Camión
          </button>
        </div>
      </div>

      {/* TARJETAS DE NIVELES DE TANQUE (KPIS DINÁMICOS) */}
      <div
        className="kpi-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '18px',
          marginBottom: '24px',
        }}
      >
        {/* Tanque GASOIL */}
        <div className="kpi-card glass-blue" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div className="kpi-icon-wrap" style={{ background: '#e0f2fe', color: '#0369a1' }}>
                <i className="fa-solid fa-oil-well"></i>
              </div>
              <div>
                <span className="kpi-title" style={{ fontSize: '14px', fontWeight: 800 }}>Tanque GASOIL (Diésel)</span>
                <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>Combustible Principal Flota</span>
              </div>
            </div>
            <span className="badge" style={{ background: '#dbeafe', color: '#1e40af', fontWeight: 800, fontSize: '12px' }}>
              Capacidad: 10,000 L
            </span>
          </div>

          <div style={{ marginBottom: '10px' }}>
            <div style={{ fontSize: '26px', fontWeight: 900, color: '#0f172a' }}>
              {(gasoil.stockActualLitros || 0).toLocaleString()} <small style={{ fontSize: '14px', color: '#64748b' }}>Litros</small>
            </div>
          </div>

          <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
            <div
              style={{
                width: `${Math.min(100, (gasoil.stockActualLitros / 10000) * 100)}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #0284c7, #2563eb)',
                borderRadius: '4px',
              }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '11.5px', color: '#64748b' }}>
            <span>Nivel: {((gasoil.stockActualLitros / 10000) * 100).toFixed(1)}%</span>
            <span>Costo Prom: ${(gasoil.costoPromedioPorLitroUSD || 0.5).toFixed(2)}/L</span>
          </div>
        </div>

        {/* Tanque GASOLINA */}
        <div className="kpi-card glass-amber" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div className="kpi-icon-wrap" style={{ background: '#fef3c7', color: '#d97706' }}>
                <i className="fa-solid fa-gas-pump"></i>
              </div>
              <div>
                <span className="kpi-title" style={{ fontSize: '14px', fontWeight: 800 }}>Tanque GASOLINA</span>
                <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>Vehículos de Supervisión</span>
              </div>
            </div>
            <span className="badge" style={{ background: '#fef3c7', color: '#92400e', fontWeight: 800, fontSize: '12px' }}>
              Capacidad: 5,000 L
            </span>
          </div>

          <div style={{ marginBottom: '10px' }}>
            <div style={{ fontSize: '26px', fontWeight: 900, color: '#0f172a' }}>
              {(gasolina.stockActualLitros || 0).toLocaleString()} <small style={{ fontSize: '14px', color: '#64748b' }}>Litros</small>
            </div>
          </div>

          <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
            <div
              style={{
                width: `${Math.min(100, (gasolina.stockActualLitros / 5000) * 100)}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #f59e0b, #d97706)',
                borderRadius: '4px',
              }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '11.5px', color: '#64748b' }}>
            <span>Nivel: {((gasolina.stockActualLitros / 5000) * 100).toFixed(1)}%</span>
            <span>Costo Prom: ${(gasolina.costoPromedioPorLitroUSD || 0.5).toFixed(2)}/L</span>
          </div>
        </div>
      </div>

      {/* TABLA DE HISTORIAL DE MOVIMIENTOS */}
      <div className="content-card" style={{ padding: '20px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '14px',
            marginBottom: '18px',
            borderBottom: '1px solid #f1f5f9',
            paddingBottom: '14px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '8px',
                background: '#e0f2fe',
                color: '#0369a1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '16px',
              }}
            >
              <i className="fa-solid fa-clock-rotate-left"></i>
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
                Historial de Movimientos de Combustible
              </h3>
              <p style={{ margin: '2px 0 0', color: '#64748b', fontSize: '12px' }}>
                Despachos a vehículos cisterna, ingresos por compra y ajustes de stock
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value)}
              className="form-input"
              style={{ height: '38px', fontSize: '12.5px', fontWeight: 600 }}
            >
              <option value="">-- Todos los Movimientos --</option>
              <option value="DESPACHO_CAMION">Despachos a Camión</option>
              <option value="COMPRA_INGRESO">Compras / Ingresos</option>
              <option value="AJUSTE">Ajustes de Inventario</option>
            </select>

            <select
              value={filtroCombustible}
              onChange={(e) => setFiltroCombustible(e.target.value)}
              className="form-input"
              style={{ height: '38px', fontSize: '12.5px', fontWeight: 600 }}
            >
              <option value="">-- Todos los Tipos --</option>
              <option value="GASOIL">GASOIL (Diésel)</option>
              <option value="GASOLINA">GASOLINA</option>
            </select>

            <button
              type="button"
              className="btn btn-outline"
              onClick={() => {
                recargarInventario();
                recargarHistorial();
              }}
              title="Refrescar datos"
              style={{ height: '38px', padding: '0 12px' }}
            >
              <i className={`fa-solid fa-arrows-rotate ${cargandoHistorial ? 'fa-spin' : ''}`}></i>
            </button>
          </div>
        </div>

        <DataTable
          data={historial.filter((h) => {
            if (filtroCombustible && h.tipoCombustible !== filtroCombustible) return false;
            return true;
          })}
          columns={columns}
          isLoading={cargandoHistorial}
          searchPlaceholder="Buscar por camión, chofer, proveedor u observación..."
          exportFileName="historial_combustible"
        />
      </div>

      {/* MODAL DESPACHO A CAMIÓN */}
      {modalDespacho && (
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
                <i className="fa-solid fa-truck-droplet" style={{ color: '#0284c7', marginRight: '8px' }}></i>
                Despachar Combustible a Vehículo
              </h3>
              <button
                type="button"
                onClick={() => setModalDespacho(false)}
                style={{ background: 'none', border: 'none', fontSize: '18px', color: '#94a3b8', cursor: 'pointer' }}
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!formDespacho.camionId || formDespacho.litros <= 0) {
                  toast.error('Selecciona camión y litros válidos');
                  return;
                }
                mutationDespacho.mutate(formDespacho);
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                    Vehículo / Camión Cisterna *
                  </label>
                  <select
                    value={formDespacho.camionId}
                    onChange={(e) => setFormDespacho({ ...formDespacho, camionId: Number(e.target.value) })}
                    className="form-input"
                    style={{ width: '100%', height: '38px' }}
                    required
                  >
                    <option value="0">Seleccionar camión...</option>
                    {camiones.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.placa} ({c.marca || 'Cisterna'}) {c.choferNombre ? `- ${c.choferNombre}` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                      Tipo de Combustible
                    </label>
                    <select
                      value={formDespacho.tipoCombustible}
                      onChange={(e) => setFormDespacho({ ...formDespacho, tipoCombustible: e.target.value })}
                      className="form-input"
                      style={{ width: '100%', height: '38px' }}
                    >
                      <option value="GASOIL">GASOIL (Diésel)</option>
                      <option value="GASOLINA">GASOLINA</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                      Litros Despachados *
                    </label>
                    <input
                      type="number"
                      value={formDespacho.litros || ''}
                      onChange={(e) => setFormDespacho({ ...formDespacho, litros: Number(e.target.value) })}
                      className="form-input"
                      placeholder="Ej: 150"
                      style={{ width: '100%', height: '38px', fontWeight: 700, color: '#0284c7' }}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                      Fecha Despacho
                    </label>
                    <input
                      type="date"
                      value={formDespacho.fecha}
                      onChange={(e) => setFormDespacho({ ...formDespacho, fecha: e.target.value })}
                      className="form-input"
                      style={{ width: '100%', height: '38px' }}
                      required
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                      Odómetro Actual (Km)
                    </label>
                    <input
                      type="number"
                      value={formDespacho.odometroKm || ''}
                      onChange={(e) => setFormDespacho({ ...formDespacho, odometroKm: e.target.value ? Number(e.target.value) : undefined })}
                      className="form-input"
                      placeholder="Ej: 145000"
                      style={{ width: '100%', height: '38px' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                    Observaciones
                  </label>
                  <input
                    type="text"
                    value={formDespacho.observaciones}
                    onChange={(e) => setFormDespacho({ ...formDespacho, observaciones: e.target.value })}
                    className="form-input"
                    placeholder="Turno, surtidor, etc."
                    style={{ width: '100%', height: '38px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button
                  type="button"
                  onClick={() => setModalDespacho(false)}
                  className="btn btn-outline"
                  style={{ height: '38px' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={mutationDespacho.isPending}
                  className="btn btn-primary"
                  style={{ height: '38px', background: '#0284c7', borderColor: '#0284c7' }}
                >
                  {mutationDespacho.isPending ? 'Guardando...' : 'Confirmar Despacho'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL COMPRA / INGRESO */}
      {modalCompra && (
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
                <i className="fa-solid fa-cart-plus" style={{ color: '#059669', marginRight: '8px' }}></i>
                Registrar Compra / Ingreso de Combustible
              </h3>
              <button
                type="button"
                onClick={() => setModalCompra(false)}
                style={{ background: 'none', border: 'none', fontSize: '18px', color: '#94a3b8', cursor: 'pointer' }}
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (formCompra.litros <= 0) {
                  toast.error('Ingresa una cantidad de litros válida');
                  return;
                }
                mutationCompra.mutate(formCompra);
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                      Tipo Combustible
                    </label>
                    <select
                      value={formCompra.tipoCombustible}
                      onChange={(e) => setFormCompra({ ...formCompra, tipoCombustible: e.target.value })}
                      className="form-input"
                      style={{ width: '100%', height: '38px' }}
                    >
                      <option value="GASOIL">GASOIL (Diésel)</option>
                      <option value="GASOLINA">GASOLINA</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                      Litros Comprados *
                    </label>
                    <input
                      type="number"
                      value={formCompra.litros || ''}
                      onChange={(e) => setFormCompra({ ...formCompra, litros: Number(e.target.value) })}
                      className="form-input"
                      placeholder="Ej: 5000"
                      style={{ width: '100%', height: '38px', fontWeight: 700, color: '#059669' }}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                      Costo / Litro ($ USD)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formCompra.costoPorLitroUSD}
                      onChange={(e) => setFormCompra({ ...formCompra, costoPorLitroUSD: Number(e.target.value) })}
                      className="form-input"
                      style={{ width: '100%', height: '38px' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                      Proveedor / Distribuidor
                    </label>
                    <input
                      type="text"
                      value={formCompra.proveedor}
                      onChange={(e) => setFormCompra({ ...formCompra, proveedor: e.target.value })}
                      className="form-input"
                      placeholder="PDVSA / Cisterna"
                      style={{ width: '100%', height: '38px' }}
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button
                  type="button"
                  onClick={() => setModalCompra(false)}
                  className="btn btn-outline"
                  style={{ height: '38px' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={mutationCompra.isPending}
                  className="btn btn-primary"
                  style={{ height: '38px', background: '#059669', borderColor: '#059669' }}
                >
                  {mutationCompra.isPending ? 'Guardando...' : 'Confirmar Ingreso'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL AJUSTE DE STOCK */}
      {modalAjuste && (
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
              maxWidth: '420px',
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
                <i className="fa-solid fa-sliders" style={{ color: '#0284c7', marginRight: '8px' }}></i>
                Ajuste Manual de Inventario
              </h3>
              <button
                type="button"
                onClick={() => setModalAjuste(false)}
                style={{ background: 'none', border: 'none', fontSize: '18px', color: '#94a3b8', cursor: 'pointer' }}
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                mutationAjuste.mutate(formAjuste);
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                    Tanque a Ajustar
                  </label>
                  <select
                    value={formAjuste.tipoCombustible}
                    onChange={(e) => setFormAjuste({ ...formAjuste, tipoCombustible: e.target.value })}
                    className="form-input"
                    style={{ width: '100%', height: '38px' }}
                  >
                    <option value="GASOIL">Tanque GASOIL</option>
                    <option value="GASOLINA">Tanque GASOLINA</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                    Nuevo Stock Físico Medido (Litros) *
                  </label>
                  <input
                    type="number"
                    value={formAjuste.nuevoStock || ''}
                    onChange={(e) => setFormAjuste({ ...formAjuste, nuevoStock: Number(e.target.value) })}
                    className="form-input"
                    style={{ width: '100%', height: '38px', fontWeight: 800, fontSize: '15px' }}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                    Motivo del Ajuste *
                  </label>
                  <input
                    type="text"
                    value={formAjuste.motivo}
                    onChange={(e) => setFormAjuste({ ...formAjuste, motivo: e.target.value })}
                    className="form-input"
                    placeholder="Medición con varilla, calibración, etc."
                    style={{ width: '100%', height: '38px' }}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button
                  type="button"
                  onClick={() => setModalAjuste(false)}
                  className="btn btn-outline"
                  style={{ height: '38px' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={mutationAjuste.isPending}
                  className="btn btn-primary"
                  style={{ height: '38px' }}
                >
                  {mutationAjuste.isPending ? 'Guardando...' : 'Aplicar Ajuste'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};

export default CombustiblePage;
