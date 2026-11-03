import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { catalogosApi } from '@/api/catalogos.api';
import { sistemaApi } from '@/api/sistema.api';
import { DataTable, type ColumnDef } from '@/components/common/DataTable';
import { confirmDeleteOrDeactivate } from '@/lib/sweetalert';
import type { ChoferDto, CamionDto } from '@/types';

export const ConductoresPage: React.FC = () => {
  const queryClient = useQueryClient();

  const [modalAbierto, setModalAbierto] = useState(false);
  const [modoEdicionId, setModoEdicionId] = useState<number | null>(null);

  const initialForm = {
    nombreUsuario: '',
    password: '',
    nombreCompleto: '',
    email: '',
    telefono: '',
    cedula: '',
    rol: 'CHOFER',
    activo: true,
  };
  const [form, setForm] = useState(initialForm);

  // Queries
  const { data: choferes = [], isLoading } = useQuery<ChoferDto[]>({
    queryKey: ['choferes'],
    queryFn: () => catalogosApi.getChoferes(),
  });

  const { data: camiones = [] } = useQuery<CamionDto[]>({
    queryKey: ['camiones'],
    queryFn: () => catalogosApi.getCamiones(false),
  });

  // Mutaciones
  const crearMutation = useMutation({
    mutationFn: (dto: typeof initialForm) =>
      modoEdicionId
        ? sistemaApi.actualizarUsuario(modoEdicionId, dto)
        : sistemaApi.crearUsuario(dto),
    onSuccess: (data: any) => {
      toast.success(data.message || 'Conductor guardado correctamente');
      queryClient.invalidateQueries({ queryKey: ['choferes'] });
      cerrarModal();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Error al guardar conductor');
    },
  });

  const eliminarMutation = useMutation({
    mutationFn: (id: number) => sistemaApi.eliminarUsuario(id),
    onSuccess: (data: any) => {
      toast.success(data.message || 'Conductor desactivado');
      queryClient.invalidateQueries({ queryKey: ['choferes'] });
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

  const abrirModalEditar = (item: ChoferDto) => {
    setModoEdicionId(item.id);
    setForm({
      ...initialForm,
      nombreUsuario: item.cedula || `chofer_${item.id}`,
      nombreCompleto: item.nombreCompleto,
      telefono: item.telefono || '',
      cedula: item.cedula || '',
      activo: item.activo,
    });
    setModalAbierto(true);
  };

  const cerrarModal = () => {
    setModalAbierto(false);
    setModoEdicionId(null);
  };

  const columns: ColumnDef<ChoferDto>[] = [
    {
      header: 'Conductor / Chofer',
      accessorKey: 'nombreCompleto',
      sortable: true,
      cell: (row) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '50%',
              background: '#e0f2fe',
              color: '#0284c7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '13px',
              flexShrink: 0,
            }}
          >
            {row.nombreCompleto.charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ fontWeight: 700, color: '#0f172a' }}>{row.nombreCompleto}</div>
            <div style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace' }}>
              C.I: {row.cedula || 'S/C'}
            </div>
          </div>
        </div>
      ),
    },
    {
      header: 'Teléfono',
      accessorKey: 'telefono',
      cell: (row) =>
        row.telefono ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', color: '#334155' }}>
            <i className="fa-solid fa-phone" style={{ color: '#0284c7', fontSize: '11px' }}></i>
            <span>{row.telefono}</span>
          </div>
        ) : (
          <span style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>Sin teléfono</span>
        ),
    },
    {
      header: 'Camión Asignado (Cisterna)',
      cell: (row) => {
        const camion = camiones.find((c) => c.usuarioId === row.id);
        return camion ? (
          <span
            className="badge"
            style={{
              background: '#f0fdf4',
              color: '#16a34a',
              border: '1px solid #bbf7d0',
              fontWeight: 700,
              padding: '4px 8px',
            }}
          >
            <i className="fa-solid fa-truck" style={{ marginRight: '4px' }}></i>
            {camion.placa} ({camion.marca} {camion.modelo}) - {camion.capacidadLitros?.toLocaleString()} L
          </span>
        ) : (
          <span style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>Sin camión asignado</span>
        );
      },
    },
    {
      header: 'Estado',
      accessorKey: 'activo',
      cell: (row) => {
        const esActivo = row.activo !== false && (row.activo === true || (row as any).Activo === 1 || (row as any).Activo === true || row.activo === undefined);
        return esActivo ? (
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
            Activo
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
            <i className="fa-solid fa-circle-xmark" style={{ marginRight: '4px' }}></i>
            Inactivo
          </span>
        );
      },
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
            title="Editar Conductor"
          >
            <i className="fa-solid fa-pen-to-square"></i>
          </button>
          <button
            type="button"
            onClick={async () => {
              if (await confirmDeleteOrDeactivate('Desactivar el conductor', row.nombreCompleto)) {
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
            <i className="fa-solid fa-truck" style={{ color: '#2563eb', marginRight: '8px' }}></i>
            Conductores & Choferes
          </h1>
          <p className="view-subtitle">
            Catálogo de choferes y operadores asignados a rutas de recolección y cisternas
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
            <i className="fa-solid fa-truck-moving"></i> + Nuevo Conductor
          </button>
        </div>
      </div>

      {/* Tabla Principal */}
      <DataTable
        data={choferes}
        columns={columns}
        isLoading={isLoading}
        searchPlaceholder="Buscar conductor por nombre o cédula..."
        exportFileName="conductores_flota"
        searchFilter={(row, term) =>
          Boolean(row.nombreCompleto.toLowerCase().includes(term) || (row.cedula && row.cedula.toLowerCase().includes(term)))
        }
      />

      {/* Modal Conductor */}
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
              maxWidth: '500px',
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
                <i className="fa-solid fa-user-check" style={{ color: '#0284c7' }}></i>
                {modoEdicionId ? 'Editar Conductor' : 'Registrar Nuevo Conductor'}
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
                if (!form.nombreCompleto.trim() || !form.cedula.trim()) {
                  toast.error('Nombre completo y cédula son requeridos');
                  return;
                }
                crearMutation.mutate(form);
              }}
              style={{ padding: '20px' }}
            >
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                  Nombre Completo *
                </label>
                <input
                  type="text"
                  value={form.nombreCompleto}
                  onChange={(e) => setForm({ ...form, nombreCompleto: e.target.value })}
                  placeholder="Ej: Pedro Martínez"
                  className="form-input"
                  style={{ width: '100%', height: '38px', borderRadius: '8px' }}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                    Cédula de Identidad *
                  </label>
                  <input
                    type="text"
                    value={form.cedula}
                    onChange={(e) => setForm({ ...form, cedula: e.target.value })}
                    placeholder="V-14567890"
                    className="form-input"
                    style={{ width: '100%', height: '38px', borderRadius: '8px', fontFamily: 'monospace' }}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                    Teléfono
                  </label>
                  <input
                    type="text"
                    value={form.telefono}
                    onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                    placeholder="0412-1234567"
                    className="form-input"
                    style={{ width: '100%', height: '38px', borderRadius: '8px' }}
                  />
                </div>
              </div>

              {!modoEdicionId && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                      Usuario de Acceso
                    </label>
                    <input
                      type="text"
                      value={form.nombreUsuario}
                      onChange={(e) => setForm({ ...form, nombreUsuario: e.target.value })}
                      placeholder="pedro.chofer"
                      className="form-input"
                      style={{ width: '100%', height: '38px', borderRadius: '8px' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                      Contraseña Inicial
                    </label>
                    <input
                      type="password"
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      placeholder="••••••••"
                      className="form-input"
                      style={{ width: '100%', height: '38px', borderRadius: '8px' }}
                    />
                  </div>
                </div>
              )}

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
                  disabled={crearMutation.isPending}
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
                  {crearMutation.isPending ? 'Guardando...' : (modoEdicionId ? 'Guardar Cambios' : 'Registrar Conductor')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConductoresPage;
