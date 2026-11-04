import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { catalogosApi } from '@/api/catalogos.api';
import { DataTable, type ColumnDef } from '@/components/common/DataTable';
import { confirmDeleteOrDeactivate } from '@/lib/sweetalert';
import type { PropietarioDto, CrearPropietarioDto, BancoDto, FincaDto } from '@/types';

export const PropietariosPage: React.FC = () => {
  const queryClient = useQueryClient();

  const [modalAbierto, setModalAbierto] = useState(false);
  const [modalAsignarFincas, setModalAsignarFincas] = useState(false);
  const [propietarioSeleccionado, setPropietarioSeleccionado] = useState<PropietarioDto | null>(null);
  const [fincasSeleccionadas, setFincasSeleccionadas] = useState<number[]>([]);
  const [modoEdicionId, setModoEdicionId] = useState<number | null>(null);

  const initialForm: CrearPropietarioDto = {
    nombreCompleto: '',
    cedulaRif: '',
    telefono: '',
    email: '',
    bancoId: undefined,
    numeroCuenta: '',
    pagoMovilTelefono: '',
    pagoMovilCedula: '',
    pagoMovilBancoId: undefined,
    activo: true,
  };
  const [form, setForm] = useState<CrearPropietarioDto>(initialForm);

  // Queries
  const { data: propietarios = [], isLoading } = useQuery<PropietarioDto[]>({
    queryKey: ['propietarios'],
    queryFn: () => catalogosApi.getPropietarios(),
  });

  const { data: bancos = [] } = useQuery<BancoDto[]>({
    queryKey: ['bancos'],
    queryFn: () => catalogosApi.getBancos(),
  });

  const { data: fincas = [] } = useQuery<FincaDto[]>({
    queryKey: ['fincas'],
    queryFn: () => catalogosApi.getFincas(true),
  });

  // Mutaciones
  const guardarMutation = useMutation({
    mutationFn: (dto: CrearPropietarioDto) =>
      modoEdicionId ? catalogosApi.actualizarPropietario(modoEdicionId, dto) : catalogosApi.crearPropietario(dto),
    onSuccess: (data: any) => {
      toast.success(data.message || 'Propietario guardado exitosamente');
      queryClient.invalidateQueries({ queryKey: ['propietarios'] });
      cerrarModal();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Error al guardar propietario');
    },
  });

  const eliminarMutation = useMutation({
    mutationFn: (id: number) => catalogosApi.eliminarPropietario(id),
    onSuccess: (data) => {
      toast.success(data.message || 'Propietario desactivado');
      queryClient.invalidateQueries({ queryKey: ['propietarios'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Error al eliminar');
    },
  });

  const asignarFincasMutation = useMutation({
    mutationFn: ({ propId, ids }: { propId: number; ids: number[] }) =>
      catalogosApi.asignarFincasPropietario(propId, ids),
    onSuccess: (data) => {
      toast.success(data.message || 'Fincas asignadas exitosamente');
      queryClient.invalidateQueries({ queryKey: ['propietarios'] });
      queryClient.invalidateQueries({ queryKey: ['fincas'] });
      setModalAsignarFincas(false);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Error al asignar fincas');
    },
  });

  const abrirModalCrear = () => {
    setModoEdicionId(null);
    setForm(initialForm);
    setModalAbierto(true);
  };

  const abrirModalEditar = (item: PropietarioDto) => {
    setModoEdicionId(item.id);
    setForm({
      nombreCompleto: item.nombreCompleto || item.nombre || '',
      cedulaRif: item.cedulaRif || item.cedulaRIF || '',
      telefono: item.telefono || '',
      email: item.email || '',
      bancoId: item.bancoId,
      numeroCuenta: item.numeroCuenta || '',
      pagoMovilTelefono: item.pagoMovilTelefono || '',
      pagoMovilCedula: item.pagoMovilCedula || '',
      pagoMovilBancoId: item.pagoMovilBancoId,
      activo: item.activo,
    });
    setModalAbierto(true);
  };

  const abrirModalAsignar = (item: PropietarioDto) => {
    setPropietarioSeleccionado(item);
    const fincasActuales = fincas.filter((f) => f.propietarioId === item.id).map((f) => f.id);
    setFincasSeleccionadas(fincasActuales);
    setModalAsignarFincas(true);
  };

  const cerrarModal = () => {
    setModalAbierto(false);
    setModoEdicionId(null);
  };

  const columns: ColumnDef<PropietarioDto>[] = [
    {
      header: 'PROPIETARIO / CÉDULA',
      accessorKey: 'nombreCompleto',
      sortable: true,
      cell: (row) => (
        <div>
          <div style={{ fontWeight: 800, color: '#0f172a' }}>{row.nombre || row.nombreCompleto}</div>
          <span style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace' }}>
            C.I / RIF: {row.cedulaRIF || row.cedulaRif || 'S/C'}
          </span>
        </div>
      ),
    },
    {
      header: 'CONTACTO',
      cell: (row) => (
        <div>
          {row.telefono && (
            <div style={{ fontSize: '12px', color: '#334155', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <i className="fa-solid fa-phone" style={{ color: '#94a3b8' }}></i>
              {row.telefono}
            </div>
          )}
          {row.email && (
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>{row.email}</div>
          )}
        </div>
      ),
    },
    {
      header: 'DATOS BANCARIOS',
      cell: (row) => (
        <div style={{ fontSize: '12px' }}>
          {row.numeroCuenta ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'monospace', color: '#1e293b' }}>
              <i className="fa-solid fa-building-columns" style={{ color: '#0284c7' }}></i>
              <span>{row.bancoNombre ? `${row.bancoNombre}: ` : ''}{row.numeroCuenta}</span>
            </div>
          ) : (
            <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Sin cuenta</span>
          )}
          {row.pagoMovilTelefono && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#059669', fontFamily: 'monospace', marginTop: '2px' }}>
              <i className="fa-solid fa-mobile-screen"></i>
              <span>PM: {row.pagoMovilTelefono}</span>
            </div>
          )}
        </div>
      ),
    },
    {
      header: 'FINCAS ASOCIADAS',
      cell: (row) => {
        const count = fincas.filter((f) => f.propietarioId === row.id).length;
        return (
          <button
            type="button"
            onClick={() => abrirModalAsignar(row)}
            className="btn btn-sm btn-outline"
            style={{
              height: '28px',
              padding: '0 10px',
              fontSize: '11.5px',
              fontWeight: 700,
              color: '#2563eb',
              borderColor: '#bfdbfe',
              background: '#eff6ff',
              borderRadius: '6px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
            }}
          >
            <i className="fa-solid fa-seedling"></i>
            {count} finca{count !== 1 ? 's' : ''}
          </button>
        );
      },
    },
    {
      header: 'ESTADO',
      accessorKey: 'activo',
      sortable: true,
      cell: (row) => (
        <span
          className="badge"
          style={{
            background: row.activo ? '#ecfdf5' : '#fef2f2',
            color: row.activo ? '#047857' : '#b91c1c',
            border: `1px solid ${row.activo ? '#a7f3d0' : '#fecaca'}`,
            fontWeight: 700,
          }}
        >
          {row.activo ? 'Activo' : 'Inactivo'}
        </span>
      ),
    },
    {
      header: 'ACCIONES',
      className: 'text-right',
      cell: (row) => (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
          <button
            type="button"
            onClick={() => abrirModalEditar(row)}
            className="btn btn-sm btn-outline"
            style={{ height: '30px', padding: '0 8px', color: '#2563eb', borderColor: '#bfdbfe' }}
            title="Editar Propietario"
          >
            <i className="fa-solid fa-pen-to-square"></i>
          </button>
          <button
            type="button"
            onClick={async () => {
              if (await confirmDeleteOrDeactivate('Desactivar al propietario', row.nombreCompleto)) {
                eliminarMutation.mutate(row.id);
              }
            }}
            className="btn btn-sm btn-outline"
            style={{ height: '30px', padding: '0 8px', color: '#dc2626', borderColor: '#fecaca' }}
            title="Desactivar"
          >
            <i className="fa-solid fa-trash-can"></i>
          </button>
        </div>
      ),
    },
  ];

  return (
    <section id="tab-propietarios" className="tab-content active" style={{ display: 'block' }}>
      {/* CABECERA VISTA */}
      <div className="view-header">
        <div>
          <h1 className="view-title">Propietarios & Productores</h1>
          <p className="view-subtitle">
            Gestión de productores de leche, datos bancarios y agrupación de fincas
          </p>
        </div>
        <div className="view-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={abrirModalCrear}
            style={{ fontWeight: 700 }}
          >
            <i className="fa-solid fa-user-plus"></i> + Nuevo Propietario
          </button>
        </div>
      </div>

      {/* TABLA PRINCIPAL */}
      <DataTable
        data={propietarios}
        columns={columns}
        isLoading={isLoading}
        searchPlaceholder="Buscar por nombre, cédula, teléfono..."
        exportFileName="catalogo_propietarios"
        searchFilter={(row, term) => {
          const nom = (row.nombre || row.nombreCompleto || '').toLowerCase();
          const rif = (row.cedulaRIF || row.cedulaRif || '').toLowerCase();
          const tel = (row.telefono || '').toLowerCase();
          return Boolean(nom.includes(term) || rif.includes(term) || tel.includes(term));
        }}
      />

      {/* MODAL CREAR / EDITAR */}
      {modalAbierto && (
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
              maxWidth: '520px',
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
                <i className="fa-solid fa-user" style={{ color: '#2563eb', marginRight: '8px' }}></i>
                {modoEdicionId ? 'Editar Propietario Ganadero' : 'Registrar Nuevo Propietario'}
              </h3>
              <button
                type="button"
                onClick={cerrarModal}
                style={{ background: 'none', border: 'none', fontSize: '18px', color: '#94a3b8', cursor: 'pointer' }}
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!form.nombreCompleto.trim()) {
                  toast.error('El nombre completo es obligatorio');
                  return;
                }
                guardarMutation.mutate(form);
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                      Nombre Completo *
                    </label>
                    <input
                      type="text"
                      value={form.nombreCompleto}
                      onChange={(e) => setForm({ ...form, nombreCompleto: e.target.value })}
                      className="form-input"
                      style={{ width: '100%', height: '38px' }}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                      Cédula / RIF *
                    </label>
                    <input
                      type="text"
                      value={form.cedulaRif}
                      onChange={(e) => setForm({ ...form, cedulaRif: e.target.value })}
                      className="form-input"
                      placeholder="V-XXXXXXX"
                      style={{ width: '100%', height: '38px' }}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                      Teléfono
                    </label>
                    <input
                      type="text"
                      value={form.telefono}
                      onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                      className="form-input"
                      placeholder="0414-XXXXXXX"
                      style={{ width: '100%', height: '38px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                      Correo Electrónico
                    </label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      className="form-input"
                      placeholder="productor@correo.com"
                      style={{ width: '100%', height: '38px' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                    Entidad Bancaria
                  </label>
                  <select
                    value={form.bancoId || ''}
                    onChange={(e) => setForm({ ...form, bancoId: e.target.value ? Number(e.target.value) : undefined })}
                    className="form-input"
                    style={{ width: '100%', height: '38px' }}
                  >
                    <option value="">-- Seleccionar Banco --</option>
                    {bancos.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.nombre} ({b.codigo || ''})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                    Número de Cuenta (20 dígitos)
                  </label>
                  <input
                    type="text"
                    value={form.numeroCuenta}
                    onChange={(e) => setForm({ ...form, numeroCuenta: e.target.value })}
                    className="form-input"
                    placeholder="01020000000000000000"
                    style={{ width: '100%', height: '38px', fontFamily: 'monospace' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                    Teléfono Pago Móvil
                  </label>
                  <input
                    type="text"
                    value={form.pagoMovilTelefono}
                    onChange={(e) => setForm({ ...form, pagoMovilTelefono: e.target.value })}
                    className="form-input"
                    placeholder="0414-XXXXXXX"
                    style={{ width: '100%', height: '38px', fontFamily: 'monospace' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button
                  type="button"
                  onClick={cerrarModal}
                  className="btn btn-outline"
                  style={{ height: '38px' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardarMutation.isPending}
                  className="btn btn-primary"
                  style={{ height: '38px' }}
                >
                  {guardarMutation.isPending ? 'Guardando...' : modoEdicionId ? 'Actualizar Propietario' : 'Registrar Propietario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL ASIGNAR FINCAS */}
      {modalAsignarFincas && propietarioSeleccionado && (
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
              maxWidth: '500px',
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
                <i className="fa-solid fa-seedling" style={{ color: '#10b981', marginRight: '8px' }}></i>
                Asignar Fincas a {propietarioSeleccionado.nombreCompleto}
              </h3>
              <button
                type="button"
                onClick={() => setModalAsignarFincas(false)}
                style={{ background: 'none', border: 'none', fontSize: '18px', color: '#94a3b8', cursor: 'pointer' }}
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '14px' }}>
              Marca las fincas que pertenecen a este propietario ganadero:
            </p>

            <div style={{ maxHeight: '280px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
              {fincas.map((f) => {
                const checked = fincasSeleccionadas.includes(f.id);
                return (
                  <label
                    key={f.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      background: checked ? '#eff6ff' : '#f8fafc',
                      border: `1px solid ${checked ? '#93c5fd' : '#e2e8f0'}`,
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFincasSeleccionadas([...fincasSeleccionadas, f.id]);
                        } else {
                          setFincasSeleccionadas(fincasSeleccionadas.filter((id) => id !== f.id));
                        }
                      }}
                      style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: '13px', fontWeight: checked ? 700 : 500, color: checked ? '#1d4ed8' : '#334155' }}>
                      {f.nombre} ({f.codigo || 'S/C'})
                    </span>
                  </label>
                );
              })}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setModalAsignarFincas(false)}
                className="btn btn-outline"
                style={{ height: '38px' }}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={asignarFincasMutation.isPending}
                onClick={() =>
                  asignarFincasMutation.mutate({
                    propId: propietarioSeleccionado.id,
                    ids: fincasSeleccionadas,
                  })
                }
                className="btn btn-primary"
                style={{ height: '38px' }}
              >
                {asignarFincasMutation.isPending ? 'Guardando...' : 'Guardar Asignación'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default PropietariosPage;
