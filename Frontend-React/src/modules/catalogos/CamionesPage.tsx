import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { catalogosApi } from '@/api/catalogos.api';
import { DataTable, type ColumnDef } from '@/components/common/DataTable';
import type { CamionDto, GuardarCamionDto, ChoferDto } from '@/types';

export const CamionesPage: React.FC = () => {
  const queryClient = useQueryClient();

  const [modalAbierto, setModalAbierto] = useState(false);
  const [modoEdicionId, setModoEdicionId] = useState<number | null>(null);

  const initialForm: GuardarCamionDto = {
    placa: '',
    marca: '',
    modelo: '',
    año: new Date().getFullYear(),
    capacidadLitros: 10000,
    odometroActualKm: 0,
    usuarioId: undefined,
    activo: true,
  };
  const [form, setForm] = useState<GuardarCamionDto>(initialForm);

  // Queries
  const { data: camiones = [], isLoading } = useQuery<CamionDto[]>({
    queryKey: ['camiones'],
    queryFn: () => catalogosApi.getCamiones(false),
  });

  const { data: choferes = [] } = useQuery<ChoferDto[]>({
    queryKey: ['choferes'],
    queryFn: () => catalogosApi.getChoferes(),
  });

  // Mutaciones
  const guardarMutation = useMutation({
    mutationFn: (dto: GuardarCamionDto) =>
      modoEdicionId ? catalogosApi.actualizarCamion(modoEdicionId, dto) : catalogosApi.crearCamion(dto),
    onSuccess: (data: any) => {
      toast.success(data.message || 'Camión guardado exitosamente');
      queryClient.invalidateQueries({ queryKey: ['camiones'] });
      cerrarModal();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Error al guardar camión');
    },
  });

  const eliminarMutation = useMutation({
    mutationFn: (id: number) => catalogosApi.eliminarCamion(id),
    onSuccess: (data: any) => {
      toast.success(data.message || 'Camión desactivado');
      queryClient.invalidateQueries({ queryKey: ['camiones'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Error al eliminar');
    },
  });

  const abrirModalCrear = () => {
    setModoEdicionId(null);
    setForm(initialForm);
    setModalAbierto(true);
  };

  const abrirModalEditar = (item: CamionDto) => {
    setModoEdicionId(item.id);
    setForm({
      placa: item.placa,
      marca: item.marca,
      modelo: item.modelo,
      año: item.año || new Date().getFullYear(),
      capacidadLitros: item.capacidadLitros,
      odometroActualKm: item.odometroActualKm,
      usuarioId: item.usuarioId,
      activo: item.activo,
    });
    setModalAbierto(true);
  };

  const cerrarModal = () => {
    setModalAbierto(false);
    setModoEdicionId(null);
  };

  const columns: ColumnDef<CamionDto>[] = [
    {
      header: 'Placa & Vehículo',
      accessorKey: 'placa',
      sortable: true,
      cell: (row) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: '#e0f2fe',
              color: '#0284c7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '15px',
              flexShrink: 0,
            }}
          >
            <i className="fa-solid fa-truck-front"></i>
          </div>
          <div>
            <div style={{ fontWeight: 800, color: '#0f172a', fontFamily: 'monospace', letterSpacing: '0.05em' }}>
              {row.placa}
            </div>
            <div style={{ fontSize: '11px', color: '#64748b' }}>
              {row.marca} {row.modelo} {row.año ? `(${row.año})` : ''}
            </div>
          </div>
        </div>
      ),
    },
    {
      header: 'Capacidad Cisterna',
      accessorKey: 'capacidadLitros',
      sortable: true,
      cell: (row) => (
        <span style={{ fontWeight: 800, color: '#0284c7', fontSize: '13.5px' }}>
          {row.capacidadLitros?.toLocaleString()} <small style={{ color: '#64748b', fontWeight: 600 }}>Litros</small>
        </span>
      ),
    },
    {
      header: 'Odómetro Actual',
      accessorKey: 'odometroActualKm',
      sortable: true,
      cell: (row) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', color: '#334155' }}>
          <i className="fa-solid fa-gauge" style={{ color: '#64748b', fontSize: '11px' }}></i>
          <span>{row.odometroActualKm ? `${row.odometroActualKm.toLocaleString()} Km` : '0 Km'}</span>
        </div>
      ),
    },
    {
      header: 'Chofer Asignado',
      cell: (row) => {
        const chofer = choferes.find((c) => c.id === row.usuarioId);
        const nombre = chofer ? chofer.nombreCompleto : row.choferNombre;
        return nombre ? (
          <span
            className="badge"
            style={{
              background: '#f8fafc',
              color: '#334155',
              border: '1px solid #e2e8f0',
              fontWeight: 700,
              padding: '4px 8px',
            }}
          >
            <i className="fa-solid fa-user" style={{ color: '#64748b', marginRight: '4px' }}></i>
            {nombre}
          </span>
        ) : (
          <span style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>Sin chofer asignado</span>
        );
      },
    },
    {
      header: 'Estado',
      accessorKey: 'activo',
      cell: (row) =>
        row.activo ? (
          <span
            className="badge"
            style={{
              background: '#ecfdf5',
              color: '#059669',
              border: '1px solid #a7f3d0',
              fontWeight: 700,
            }}
          >
            <i className="fa-solid fa-check-circle" style={{ marginRight: '4px' }}></i>
            Operativo
          </span>
        ) : (
          <span
            className="badge"
            style={{
              background: '#fef2f2',
              color: '#dc2626',
              border: '1px solid #fecaca',
              fontWeight: 700,
            }}
          >
            <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: '4px' }}></i>
            Inactivo
          </span>
        ),
    },
    {
      header: 'Acciones',
      className: 'text-right',
      cell: (row) => (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
          <button
            type="button"
            onClick={() => abrirModalEditar(row)}
            className="btn btn-sm btn-outline"
            style={{ height: '30px', padding: '0 8px', fontSize: '12px' }}
            title="Editar Camión"
          >
            <i className="fa-solid fa-pen-to-square"></i>
          </button>
          <button
            type="button"
            onClick={() => {
              if (window.confirm(`¿Desactivar el vehículo "${row.placa}"?`)) {
                eliminarMutation.mutate(row.id);
              }
            }}
            className="btn btn-sm btn-outline"
            style={{ height: '30px', padding: '0 8px', fontSize: '12px', color: '#dc2626', borderColor: '#fecaca' }}
            title="Desactivar"
          >
            <i className="fa-solid fa-trash-can"></i>
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      {/* VISTA HEADER 1:1 */}
      <div className="view-header">
        <div>
          <h1 className="view-title">
            <i className="fa-solid fa-truck-front" style={{ color: '#2563eb', marginRight: '8px' }}></i>
            Gestión de Camiones (Flota)
          </h1>
          <p className="view-subtitle">
            Catálogo de vehículos cisterna, compartimientos, capacidad en litros y chofer asignado
          </p>
        </div>

        <div className="view-actions">
          <button
            type="button"
            onClick={abrirModalCrear}
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
              boxShadow: '0 4px 12px rgba(37,99,235,0.25)',
            }}
          >
            <i className="fa-solid fa-plus"></i> + Nuevo Camión
          </button>
        </div>
      </div>

      {/* Tabla Principal */}
      <DataTable
        data={camiones}
        columns={columns}
        isLoading={isLoading}
        searchPlaceholder="Buscar por placa, marca o chofer..."
        exportFileName="camiones_flota"
        searchFilter={(row, term) =>
          Boolean(
            row.placa.toLowerCase().includes(term) ||
            row.marca.toLowerCase().includes(term) ||
            row.modelo.toLowerCase().includes(term) ||
            (row.choferNombre && row.choferNombre.toLowerCase().includes(term))
          )
        }
      />

      {/* Modal Camión */}
      {modalAbierto && (
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
          <div
            className="content-card"
            style={{
              width: '100%',
              maxWidth: '520px',
              padding: '0',
              overflow: 'hidden',
              borderRadius: '16px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
            }}
          >
            <div
              style={{
                padding: '16px 20px',
                background: '#f8fafc',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fa-solid fa-truck" style={{ color: '#0284c7' }}></i>
                {modoEdicionId ? 'Editar Camión Cisterna' : 'Registrar Nuevo Camión'}
              </h3>
              <button
                type="button"
                onClick={cerrarModal}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#64748b',
                  cursor: 'pointer',
                  fontSize: '18px',
                }}
              >
                &times;
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!form.placa.trim()) {
                  toast.error('La placa es obligatoria');
                  return;
                }
                guardarMutation.mutate(form);
              }}
              style={{ padding: '20px' }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                    Placa del Vehículo *
                  </label>
                  <input
                    type="text"
                    value={form.placa}
                    onChange={(e) => setForm({ ...form, placa: e.target.value.toUpperCase() })}
                    placeholder="Ej: A84DE3A"
                    className="form-input"
                    style={{ width: '100%', height: '38px', borderRadius: '8px', fontFamily: 'monospace', fontWeight: 700 }}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                    Capacidad (Litros) *
                  </label>
                  <input
                    type="number"
                    value={form.capacidadLitros}
                    onChange={(e) => setForm({ ...form, capacidadLitros: Number(e.target.value) })}
                    placeholder="10000"
                    className="form-input"
                    style={{ width: '100%', height: '38px', borderRadius: '8px', fontWeight: 700 }}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                    Marca
                  </label>
                  <input
                    type="text"
                    value={form.marca}
                    onChange={(e) => setForm({ ...form, marca: e.target.value })}
                    placeholder="Mack, Ford..."
                    className="form-input"
                    style={{ width: '100%', height: '38px', borderRadius: '8px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                    Modelo
                  </label>
                  <input
                    type="text"
                    value={form.modelo}
                    onChange={(e) => setForm({ ...form, modelo: e.target.value })}
                    placeholder="CH613, Cargo..."
                    className="form-input"
                    style={{ width: '100%', height: '38px', borderRadius: '8px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                    Año
                  </label>
                  <input
                    type="number"
                    value={form.año || ''}
                    onChange={(e) => setForm({ ...form, año: Number(e.target.value) })}
                    placeholder="2012"
                    className="form-input"
                    style={{ width: '100%', height: '38px', borderRadius: '8px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                    Odómetro Actual (Km)
                  </label>
                  <input
                    type="number"
                    value={form.odometroActualKm || 0}
                    onChange={(e) => setForm({ ...form, odometroActualKm: Number(e.target.value) })}
                    placeholder="150000"
                    className="form-input"
                    style={{ width: '100%', height: '38px', borderRadius: '8px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                    Chofer Habitual
                  </label>
                  <select
                    value={form.usuarioId || ''}
                    onChange={(e) => setForm({ ...form, usuarioId: e.target.value ? Number(e.target.value) : undefined })}
                    className="form-input"
                    style={{ width: '100%', height: '38px', borderRadius: '8px' }}
                  >
                    <option value="">-- Sin chofer asignado --</option>
                    {choferes.map((ch) => (
                      <option key={ch.id} value={ch.id}>
                        {ch.nombreCompleto} ({ch.cedula})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button
                  type="button"
                  onClick={cerrarModal}
                  className="btn btn-outline"
                  style={{ height: '38px', padding: '0 16px', borderRadius: '8px' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardarMutation.isPending}
                  className="btn btn-primary"
                  style={{
                    height: '38px',
                    padding: '0 20px',
                    borderRadius: '8px',
                    background: '#0284c7',
                    border: 'none',
                    fontWeight: 700,
                  }}
                >
                  {guardarMutation.isPending ? 'Guardando...' : (modoEdicionId ? 'Guardar Cambios' : 'Registrar Camión')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CamionesPage;
