import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { sistemaApi } from '@/api/sistema.api';
import { DataTable, type ColumnDef } from '@/components/common/DataTable';
import { confirmDeleteOrDeactivate } from '@/lib/sweetalert';
import type { UsuarioDto, GuardarUsuarioDto } from '@/types';

export const UsuariosPage: React.FC = () => {
  const queryClient = useQueryClient();

  const [modalAbierto, setModalAbierto] = useState(false);
  const [modalPassword, setModalPassword] = useState(false);
  const [modoEdicionId, setModoEdicionId] = useState<number | null>(null);
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState<UsuarioDto | null>(null);

  const initialForm: GuardarUsuarioDto = {
    nombreUsuario: '',
    password: '',
    nombreCompleto: '',
    email: '',
    rol: 'OPERADOR',
    telefono: '',
    cedula: '',
    activo: true,
  };
  const [form, setForm] = useState<GuardarUsuarioDto>(initialForm);

  const [formPass, setFormPass] = useState({
    passwordActual: '',
    nuevoPassword: '',
  });

  const { data: usuarios = [], isLoading } = useQuery<UsuarioDto[]>({
    queryKey: ['usuarios'],
    queryFn: () => sistemaApi.getUsuarios(),
  });

  const guardarMutation = useMutation({
    mutationFn: (dto: GuardarUsuarioDto) =>
      modoEdicionId ? sistemaApi.actualizarUsuario(modoEdicionId, dto) : sistemaApi.crearUsuario(dto),
    onSuccess: (data: any) => {
      toast.success(data.message || 'Usuario guardado exitosamente');
      queryClient.invalidateQueries({ queryKey: ['usuarios'] });
      cerrarModal();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Error al guardar usuario');
    },
  });

  const cambiarPassMutation = useMutation({
    mutationFn: (dto: typeof formPass) =>
      usuarioSeleccionado
        ? sistemaApi.actualizarPassword(usuarioSeleccionado.id, dto.passwordActual, dto.nuevoPassword)
        : Promise.reject(new Error('Sin usuario seleccionado')),
    onSuccess: (data: any) => {
      toast.success(data.message || 'Contraseña cambiada exitosamente');
      setModalPassword(false);
      setFormPass({ passwordActual: '', nuevoPassword: '' });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Error al cambiar contraseña');
    },
  });

  const eliminarMutation = useMutation({
    mutationFn: (id: number) => sistemaApi.eliminarUsuario(id),
    onSuccess: (data: any) => {
      toast.success(data.message || 'Usuario desactivado');
      queryClient.invalidateQueries({ queryKey: ['usuarios'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Error al desactivar usuario');
    },
  });

  const abrirModalCrear = () => {
    setModoEdicionId(null);
    setForm(initialForm);
    setModalAbierto(true);
  };

  const abrirModalEditar = (item: UsuarioDto) => {
    setModoEdicionId(item.id);
    setForm({
      nombreUsuario: item.nombreUsuario,
      password: '',
      nombreCompleto: item.nombreCompleto,
      email: item.email || '',
      rol: item.rol,
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

  const columns: ColumnDef<UsuarioDto>[] = [
    {
      header: 'Usuario & Nombre',
      accessorKey: 'nombreCompleto',
      sortable: true,
      cell: (row) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              background: '#eff6ff',
              color: '#2563eb',
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
            <div style={{ fontWeight: 800, color: '#0f172a' }}>{row.nombreCompleto}</div>
            <div style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace' }}>
              @{row.nombreUsuario} {row.cedula ? `• C.I: ${row.cedula}` : ''}
            </div>
          </div>
        </div>
      ),
    },
    {
      header: 'Rol / Nivel',
      accessorKey: 'rol',
      sortable: true,
      cell: (row) => {
        const esAdmin = row.rol === 'ADMIN' || row.rol === 'SUPERADMIN';
        return (
          <span
            className="badge"
            style={{
              background: esAdmin ? '#fdf4ff' : '#eff6ff',
              color: esAdmin ? '#9333ea' : '#1d4ed8',
              border: `1px solid ${esAdmin ? '#e9d5ff' : '#bfdbfe'}`,
              fontWeight: 800,
            }}
          >
            <i className={`fa-solid ${esAdmin ? 'fa-shield-halved' : 'fa-user-gear'}`} style={{ marginRight: '4px' }}></i>
            {row.rol}
          </span>
        );
      },
    },
    {
      header: 'Contacto',
      cell: (row) => (
        <div>
          {row.telefono && (
            <div style={{ fontSize: '12px', color: '#334155' }}>
              <i className="fa-solid fa-phone" style={{ marginRight: '4px', color: '#64748b' }}></i> {row.telefono}
            </div>
          )}
          {row.email && (
            <div style={{ fontSize: '11px', color: '#64748b' }}>
              <i className="fa-solid fa-envelope" style={{ marginRight: '4px' }}></i> {row.email}
            </div>
          )}
          {!row.telefono && !row.email && <span style={{ fontSize: '11px', color: '#94a3b8' }}>-</span>}
        </div>
      ),
    },
    {
      header: 'Estado',
      accessorKey: 'activo',
      cell: (row) => (
        <span
          className="badge"
          style={{
            background: row.activo ? '#ecfdf5' : '#fef2f2',
            color: row.activo ? '#047857' : '#dc2626',
            fontWeight: 800,
            border: `1px solid ${row.activo ? '#a7f3d0' : '#fecaca'}`,
          }}
        >
          {row.activo ? 'Activo' : 'Inactivo'}
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
            onClick={() => {
              setUsuarioSeleccionado(row);
              setModalPassword(true);
            }}
            className="btn btn-sm btn-outline"
            style={{ height: '30px', padding: '0 8px', fontSize: '12px', color: '#f59e0b', borderColor: '#fde68a' }}
            title="Cambiar Contraseña"
          >
            <i className="fa-solid fa-key"></i>
          </button>
          <button
            type="button"
            onClick={() => abrirModalEditar(row)}
            className="btn btn-sm btn-outline"
            style={{ height: '30px', padding: '0 8px', fontSize: '12px' }}
            title="Editar Usuario"
          >
            <i className="fa-solid fa-pen-to-square"></i>
          </button>
          <button
            type="button"
            onClick={async () => {
              if (await confirmDeleteOrDeactivate('Desactivar el usuario', row.nombreCompleto)) {
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
            <i className="fa-solid fa-users" style={{ color: '#2563eb', marginRight: '8px' }}></i>
            Gestión de Usuarios del Sistema
          </h1>
          <p className="view-subtitle">
            Administración de cuentas, perfiles de seguridad, roles y credenciales de acceso
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
            <i className="fa-solid fa-user-plus"></i> + Nuevo Usuario
          </button>
        </div>
      </div>

      {/* Tabla Principal */}
      <DataTable
        data={usuarios}
        columns={columns}
        isLoading={isLoading}
        searchPlaceholder="Buscar por nombre, usuario, cédula o rol..."
        exportFileName="usuarios_sistema"
        searchFilter={(row, term) =>
          Boolean(
            (row.nombreCompleto && row.nombreCompleto.toLowerCase().includes(term)) ||
            (row.nombreUsuario && row.nombreUsuario.toLowerCase().includes(term)) ||
            (row.rol && row.rol.toLowerCase().includes(term)) ||
            (row.cedula && row.cedula.toLowerCase().includes(term))
          )
        }
      />

      {/* Modal Usuario */}
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
          <div className="content-card" style={{ width: '100%', maxWidth: '500px', padding: '0', overflow: 'hidden', borderRadius: '16px' }}>
            <div style={{ padding: '16px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                <i className="fa-solid fa-user-shield" style={{ color: '#0284c7', marginRight: '8px' }}></i>
                {modoEdicionId ? 'Editar Usuario' : 'Registrar Nuevo Usuario'}
              </h3>
              <button type="button" onClick={cerrarModal} style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '18px' }}>
                &times;
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!form.nombreUsuario.trim() || !form.nombreCompleto.trim()) {
                  toast.error('Nombre de usuario y nombre completo son requeridos');
                  return;
                }
                guardarMutation.mutate(form);
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
                  placeholder="Ej: Carlos Mendoza"
                  className="form-input"
                  style={{ width: '100%', height: '38px', borderRadius: '8px' }}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                    Usuario (Login) *
                  </label>
                  <input
                    type="text"
                    value={form.nombreUsuario}
                    onChange={(e) => setForm({ ...form, nombreUsuario: e.target.value })}
                    placeholder="carlos.m"
                    className="form-input"
                    style={{ width: '100%', height: '38px', borderRadius: '8px' }}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                    Rol en Sistema
                  </label>
                  <select
                    value={form.rol}
                    onChange={(e) => setForm({ ...form, rol: e.target.value })}
                    className="form-input"
                    style={{ width: '100%', height: '38px', borderRadius: '8px', fontWeight: 700 }}
                  >
                    <option value="OPERADOR">OPERADOR</option>
                    <option value="ADMIN">ADMIN</option>
                    <option value="CHOFER">CHOFER</option>
                    <option value="SUPERADMIN">SUPERADMIN</option>
                  </select>
                </div>
              </div>

              {!modoEdicionId && (
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                    Contraseña Inicial *
                  </label>
                  <input
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder="••••••••"
                    className="form-input"
                    style={{ width: '100%', height: '38px', borderRadius: '8px' }}
                    required={!modoEdicionId}
                  />
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                    Cédula
                  </label>
                  <input
                    type="text"
                    value={form.cedula}
                    onChange={(e) => setForm({ ...form, cedula: e.target.value })}
                    placeholder="V-12345678"
                    className="form-input"
                    style={{ width: '100%', height: '38px', borderRadius: '8px', fontFamily: 'monospace' }}
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
                    placeholder="0414-1234567"
                    className="form-input"
                    style={{ width: '100%', height: '38px', borderRadius: '8px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button type="button" onClick={cerrarModal} className="btn btn-outline" style={{ height: '38px', padding: '0 16px', borderRadius: '8px' }}>
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardarMutation.isPending}
                  className="btn btn-primary"
                  style={{ height: '38px', padding: '0 20px', borderRadius: '8px', background: '#0284c7', border: 'none', fontWeight: 700 }}
                >
                  {guardarMutation.isPending ? 'Guardando...' : (modoEdicionId ? 'Guardar Cambios' : 'Registrar Usuario')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Cambiar Contraseña */}
      {modalPassword && usuarioSeleccionado && (
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
          <div className="content-card" style={{ width: '100%', maxWidth: '400px', padding: '0', overflow: 'hidden', borderRadius: '16px' }}>
            <div style={{ padding: '16px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                <i className="fa-solid fa-key" style={{ color: '#f59e0b', marginRight: '8px' }}></i>
                Cambiar Contraseña
              </h3>
              <button type="button" onClick={() => setModalPassword(false)} style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '18px' }}>
                &times;
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!formPass.nuevoPassword.trim()) {
                  toast.error('Debe ingresar la nueva contraseña');
                  return;
                }
                cambiarPassMutation.mutate(formPass);
              }}
              style={{ padding: '20px' }}
            >
              <p style={{ margin: '0 0 14px 0', fontSize: '13px', color: '#475569' }}>
                Restablecer credenciales para <strong>{usuarioSeleccionado.nombreCompleto}</strong>:
              </p>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                  Contraseña Actual (Admin)
                </label>
                <input
                  type="password"
                  value={formPass.passwordActual}
                  onChange={(e) => setFormPass({ ...formPass, passwordActual: e.target.value })}
                  placeholder="••••••••"
                  className="form-input"
                  style={{ width: '100%', height: '38px', borderRadius: '8px' }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                  Nueva Contraseña *
                </label>
                <input
                  type="password"
                  value={formPass.nuevoPassword}
                  onChange={(e) => setFormPass({ ...formPass, nuevoPassword: e.target.value })}
                  placeholder="••••••••"
                  className="form-input"
                  style={{ width: '100%', height: '38px', borderRadius: '8px' }}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setModalPassword(false)} className="btn btn-outline" style={{ height: '36px', padding: '0 14px', borderRadius: '8px' }}>
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={cambiarPassMutation.isPending}
                  className="btn btn-primary"
                  style={{ height: '36px', padding: '0 18px', borderRadius: '8px', background: '#f59e0b', border: 'none', fontWeight: 700 }}
                >
                  {cambiarPassMutation.isPending ? 'Guardando...' : 'Cambiar Clave'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsuariosPage;
