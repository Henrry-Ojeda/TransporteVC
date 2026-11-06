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
  const [modoEdicionId, setModoEdicionId] = useState<number | null>(null);
  const [modalPassword, setModalPassword] = useState(false);
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState<UsuarioDto | null>(null);

  // Formulario de Usuario
  const initialForm: GuardarUsuarioDto = {
    nombreUsuario: '',
    password: '',
    nombreCompleto: '',
    email: '',
    rol: 'OPERADOR',
    telefono: '',
    cedula: '',
    activo: true,
    bancoNombre: '',
    numeroCuenta: '',
    cedulaPagoMovil: '',
    telefonoPagoMovil: '',
    tarifaPorLitro: undefined,
  };
  const [form, setForm] = useState<GuardarUsuarioDto>(initialForm);
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [showPass1, setShowPass1] = useState(false);
  const [showPass2, setShowPass2] = useState(false);

  // Formulario de Contraseña Directa
  const [formPass, setFormPass] = useState({
    passwordActual: '',
    nuevoPassword: '',
  });

  const { data: usuarios = [], isLoading } = useQuery<UsuarioDto[]>({
    queryKey: ['usuarios'],
    queryFn: () => sistemaApi.getUsuarios(),
  });

  const guardarMutation = useMutation({
    mutationFn: (dto: GuardarUsuarioDto) => {
      const payload: any = {
        ...dto,
        username: dto.nombreUsuario.trim(),
        Username: dto.nombreUsuario.trim(),
        nombreUsuario: dto.nombreUsuario.trim(),
        nombreCompleto: dto.nombreCompleto.trim(),
      };
      return modoEdicionId ? sistemaApi.actualizarUsuario(modoEdicionId, payload) : sistemaApi.crearUsuario(payload);
    },
    onSuccess: (data: any) => {
      toast.success(data.message || (modoEdicionId ? 'Usuario actualizado exitosamente' : 'Usuario registrado exitosamente'));
      queryClient.invalidateQueries({ queryKey: ['usuarios'] });
      cerrarModal();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || err.message || 'Error al guardar usuario');
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
    setPasswordConfirm('');
    setShowPass1(false);
    setShowPass2(false);
    setModalAbierto(true);
  };

  const abrirModalEditar = (item: any) => {
    setModoEdicionId(item.id);
    setForm({
      nombreUsuario: item.nombreUsuario || item.username || '',
      password: '',
      nombreCompleto: item.nombreCompleto || item.nombre || '',
      email: item.email || '',
      rol: item.rol || 'OPERADOR',
      telefono: item.telefono || '',
      cedula: item.cedula || item.cedulaRIF || '',
      activo: item.activo !== false,
      bancoNombre: item.bancoNombre || '',
      numeroCuenta: item.numeroCuenta || '',
      cedulaPagoMovil: item.cedulaPagoMovil || '',
      telefonoPagoMovil: item.telefonoPagoMovil || '',
      tarifaPorLitro: item.tarifaPorLitro,
    });
    setPasswordConfirm('');
    setShowPass1(false);
    setShowPass2(false);
    setModalAbierto(true);
  };

  const cerrarModal = () => {
    setModalAbierto(false);
    setModoEdicionId(null);
    setPasswordConfirm('');
  };

  const handleSubmitUsuario = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nombreUsuario.trim()) {
      toast.error('El usuario de acceso es obligatorio');
      return;
    }
    if (!form.nombreCompleto.trim()) {
      toast.error('El nombre completo es obligatorio');
      return;
    }
    if (!modoEdicionId) {
      if (!form.password || form.password.trim().length < 4) {
        toast.error('La contraseña debe tener al menos 4 caracteres');
        return;
      }
      if (form.password !== passwordConfirm) {
        toast.error('Las contraseñas no coinciden. Por favor verifícalas');
        return;
      }
    } else {
      if (form.password && form.password.trim().length > 0) {
        if (form.password.trim().length < 4) {
          toast.error('La nueva contraseña debe tener al menos 4 caracteres');
          return;
        }
        if (form.password !== passwordConfirm) {
          toast.error('Las contraseñas no coinciden');
          return;
        }
      }
    }
    guardarMutation.mutate(form);
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
              border: '1px solid #bfdbfe',
              flexShrink: 0,
            }}
          >
            {(row.nombreCompleto || row.nombreUsuario || 'U').charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '13.5px' }}>
              {row.nombreCompleto || row.nombreUsuario}
            </div>
            <div style={{ fontSize: '11.5px', color: '#64748b', fontFamily: 'monospace' }}>
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
        const rol = (row.rol || '').toUpperCase();
        let bg = '#f1f5f9';
        let color = '#475569';
        let border = '#e2e8f0';

        if (rol.includes('ADMIN') || rol === 'SUPERADMIN') {
          bg = '#eff6ff';
          color = '#1d4ed8';
          border = '#bfdbfe';
        } else if (rol === 'CHOFER') {
          bg = '#fef3c7';
          color = '#b45309';
          border = '#fde68a';
        } else if (rol === 'SUPERVISOR') {
          bg = '#f3e8ff';
          color = '#7e22ce';
          border = '#e9d5ff';
        } else if (rol === 'FINANZAS') {
          bg = '#ecfdf5';
          color = '#047857';
          border = '#a7f3d0';
        }

        return (
          <span
            className="badge"
            style={{
              background: bg,
              color: color,
              border: `1px solid ${border}`,
              fontWeight: 800,
              fontSize: '11px',
              letterSpacing: '0.02em',
            }}
          >
            {rol}
          </span>
        );
      },
    },
    {
      header: 'Contacto',
      cell: (row) => (
        <div style={{ fontSize: '12px' }}>
          {row.telefono && (
            <div style={{ color: '#334155', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <i className="fa-solid fa-phone" style={{ color: '#94a3b8', fontSize: '10px' }}></i>
              <span>{row.telefono}</span>
            </div>
          )}
          {row.email && (
            <div style={{ color: '#64748b', marginTop: '2px' }}>{row.email}</div>
          )}
          {!row.telefono && !row.email && (
            <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Sin contacto</span>
          )}
        </div>
      ),
    },
    {
      header: 'Estado',
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
      header: 'Acciones',
      className: 'text-right',
      cell: (row) => (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
          <button
            type="button"
            onClick={() => {
              setUsuarioSeleccionado(row);
              setFormPass({ passwordActual: '', nuevoPassword: '' });
              setModalPassword(true);
            }}
            className="btn btn-sm btn-outline"
            style={{ height: '30px', padding: '0 8px', color: '#f59e0b', borderColor: '#fde68a' }}
            title="Cambiar Contraseña"
          >
            <i className="fa-solid fa-key"></i>
          </button>
          <button
            type="button"
            onClick={() => abrirModalEditar(row)}
            className="btn btn-sm btn-outline"
            style={{ height: '30px', padding: '0 8px', color: '#2563eb', borderColor: '#bfdbfe' }}
            title="Editar Usuario"
          >
            <i className="fa-solid fa-pen-to-square"></i>
          </button>
          <button
            type="button"
            onClick={async () => {
              if (await confirmDeleteOrDeactivate('Desactivar al usuario', row.nombreCompleto || row.nombreUsuario)) {
                eliminarMutation.mutate(row.id);
              }
            }}
            className="btn btn-sm btn-outline"
            style={{ height: '30px', padding: '0 8px', color: '#dc2626', borderColor: '#fecaca' }}
            title="Desactivar Usuario"
          >
            <i className="fa-solid fa-user-slash"></i>
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <i className="fa-solid fa-users-gear text-blue-600"></i>
            Gestión de Usuarios y Accesos
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Administración de credenciales, roles y asignación operativa del personal
          </p>
        </div>
        <button
          type="button"
          onClick={abrirModalCrear}
          className="btn btn-primary"
          style={{
            background: 'linear-gradient(135deg, #0284c7, #2563eb)',
            border: 'none',
            color: '#ffffff',
            fontWeight: 800,
            padding: '8px 18px',
            borderRadius: '8px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.2)',
          }}
        >
          <i className="fa-solid fa-user-plus"></i>
          Nuevo Usuario
        </button>
      </div>

      {/* Tabla Principal */}
      <DataTable
        data={usuarios}
        columns={columns}
        isLoading={isLoading}
        searchPlaceholder="Buscar por usuario, nombre, rol o cédula..."
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

      {/* MODAL USUARIO Y ROLES (CREAR / EDITAR) - PARIDAD EXACTA 1:1 CON V2_3_11_26 #modalUsuarioCustom */}
      {modalAbierto && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            backgroundColor: 'rgba(15, 23, 42, 0.7)',
            backdropFilter: 'blur(5px)',
          }}
        >
          <div
            className="content-card"
            style={{
              width: '100%',
              maxWidth: '640px',
              padding: '0',
              overflow: 'hidden',
              borderRadius: '16px',
              background: '#ffffff',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '92vh',
            }}
          >
            {/* CABECERA OSCURA 1:1 CON V2_3_11_26 */}
            <div
              style={{
                background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                padding: '18px 24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '10px',
                    background: 'rgba(37, 99, 235, 0.25)',
                    color: '#38bdf8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '18px',
                    border: '1px solid rgba(56, 189, 248, 0.3)',
                  }}
                >
                  <i className="fa-solid fa-users-gear"></i>
                </div>
                <div>
                  <h2 style={{ fontSize: '17px', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                    {modoEdicionId ? 'Editar Usuario' : 'Registrar Nuevo Usuario'}
                  </h2>
                  <p style={{ fontSize: '12px', color: '#94a3b8', margin: '2px 0 0 0' }}>
                    Credenciales de acceso, rol asignado y configuración de perfil
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={cerrarModal}
                title="Cerrar"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#94a3b8',
                  fontSize: '26px',
                  cursor: 'pointer',
                  lineHeight: 1,
                  padding: '4px 8px',
                }}
              >
                &times;
              </button>
            </div>

            {/* FORMULARIO BODY CON FONDO #f8fafc Y SCROLL */}
            <form onSubmit={handleSubmitUsuario} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              <div
                style={{
                  padding: '22px 24px',
                  background: '#f8fafc',
                  overflowY: 'auto',
                  maxHeight: 'calc(92vh - 145px)',
                }}
              >
                {/* FILA 1: USERNAME Y NOMBRE COMPLETO */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '16px', marginBottom: '16px' }}>
                  <div>
                    <label style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b', marginBottom: '6px', display: 'block' }}>
                      Usuario de Acceso <span style={{ color: '#e11d48' }}>*</span>
                    </label>
                    <input
                      type="text"
                      value={form.nombreUsuario}
                      onChange={(e) => setForm({ ...form, nombreUsuario: e.target.value })}
                      placeholder="Ej: ana.cabrera"
                      required
                      style={{
                        height: '42px',
                        fontSize: '13.5px',
                        fontWeight: 700,
                        color: '#0f172a',
                        border: '1.5px solid #cbd5e1',
                        borderRadius: '8px',
                        background: '#ffffff',
                        width: '100%',
                        padding: '0 12px',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b', marginBottom: '6px', display: 'block' }}>
                      Nombre Completo <span style={{ color: '#e11d48' }}>*</span>
                    </label>
                    <input
                      type="text"
                      value={form.nombreCompleto}
                      onChange={(e) => setForm({ ...form, nombreCompleto: e.target.value })}
                      placeholder="Ej: Ana Graciela Cabrera Dias"
                      required
                      style={{
                        height: '42px',
                        fontSize: '13.5px',
                        fontWeight: 600,
                        color: '#0f172a',
                        border: '1.5px solid #cbd5e1',
                        borderRadius: '8px',
                        background: '#ffffff',
                        width: '100%',
                        padding: '0 12px',
                      }}
                    />
                  </div>
                </div>

                {/* FILA 2: CONTRASEÑA Y CONFIRMAR CONTRASEÑA (DOBLE VERIFICACIÓN) */}
                <div
                  style={{
                    background: '#ffffff',
                    border: '1.5px solid #e2e8f0',
                    borderRadius: '10px',
                    padding: '14px 16px',
                    marginBottom: '16px',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <span style={{ fontSize: '12.5px', fontWeight: 800, color: '#334155', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <i className="fa-solid fa-key" style={{ color: '#3b82f6' }}></i>
                      Seguridad &amp; Contraseña (Doble Verificación)
                    </span>
                    {modoEdicionId && (
                      <small style={{ color: '#64748b', fontSize: '11px', fontWeight: 600, marginLeft: 'auto' }}>
                        (Dejar vacío para no modificar)
                      </small>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#1e293b', marginBottom: '6px', display: 'block' }}>
                        Contraseña {!modoEdicionId && <span style={{ color: '#e11d48' }}>*</span>}
                      </label>
                      <div style={{ position: 'relative' }}>
                        <input
                          type={showPass1 ? 'text' : 'password'}
                          value={form.password || ''}
                          onChange={(e) => setForm({ ...form, password: e.target.value })}
                          placeholder={modoEdicionId ? 'Nueva contraseña (opcional)' : 'Mín. 4 caracteres'}
                          required={!modoEdicionId}
                          style={{
                            height: '42px',
                            fontSize: '13.5px',
                            color: '#0f172a',
                            paddingRight: '40px',
                            border: '1.5px solid #cbd5e1',
                            borderRadius: '8px',
                            background: '#ffffff',
                            width: '100%',
                            paddingLeft: '12px',
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPass1(!showPass1)}
                          style={{
                            position: 'absolute',
                            right: '10px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            background: 'none',
                            border: 'none',
                            color: '#64748b',
                            cursor: 'pointer',
                            padding: '4px',
                          }}
                          title="Ver/Ocultar contraseña"
                        >
                          <i className={`fa-solid ${showPass1 ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                        </button>
                      </div>
                    </div>

                    <div>
                      <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#1e293b', marginBottom: '6px', display: 'block' }}>
                        Confirmar Contraseña {!modoEdicionId && <span style={{ color: '#e11d48' }}>*</span>}
                      </label>
                      <div style={{ position: 'relative' }}>
                        <input
                          type={showPass2 ? 'text' : 'password'}
                          value={passwordConfirm}
                          onChange={(e) => setPasswordConfirm(e.target.value)}
                          placeholder="Repite la contraseña"
                          required={!modoEdicionId && Boolean(form.password)}
                          style={{
                            height: '42px',
                            fontSize: '13.5px',
                            color: '#0f172a',
                            paddingRight: '40px',
                            border: '1.5px solid #cbd5e1',
                            borderRadius: '8px',
                            background: '#ffffff',
                            width: '100%',
                            paddingLeft: '12px',
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPass2(!showPass2)}
                          style={{
                            position: 'absolute',
                            right: '10px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            background: 'none',
                            border: 'none',
                            color: '#64748b',
                            cursor: 'pointer',
                            padding: '4px',
                          }}
                          title="Ver/Ocultar contraseña"
                        >
                          <i className={`fa-solid ${showPass2 ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                        </button>
                      </div>
                    </div>
                  </div>

                  {Boolean(form.password && passwordConfirm) && (
                    <div
                      style={{
                        marginTop: '8px',
                        fontSize: '12px',
                        fontWeight: 700,
                        color: form.password === passwordConfirm ? '#15803d' : '#b91c1c',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <i className={`fa-solid ${form.password === passwordConfirm ? 'fa-circle-check' : 'fa-triangle-exclamation'}`}></i>
                      <span>{form.password === passwordConfirm ? 'Las contraseñas coinciden perfectamente' : 'Las contraseñas no coinciden'}</span>
                    </div>
                  )}
                </div>

                {/* FILA 3: ROL Y CÉDULA */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div>
                    <label style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b', marginBottom: '6px', display: 'block' }}>
                      Rol / Nivel en Sistema <span style={{ color: '#e11d48' }}>*</span>
                    </label>
                    <select
                      value={form.rol}
                      onChange={(e) => setForm({ ...form, rol: e.target.value })}
                      required
                      style={{
                        height: '42px',
                        fontSize: '13.5px',
                        fontWeight: 700,
                        color: '#1e293b',
                        borderRadius: '8px',
                        border: '1.5px solid #cbd5e1',
                        background: '#ffffff',
                        width: '100%',
                        padding: '0 12px',
                      }}
                    >
                      <option value="SUPERADMIN">SUPERADMIN (Super Administrador)</option>
                      <option value="ADMIN">ADMIN (Administrador)</option>
                      <option value="SUPERVISOR">SUPERVISOR (Supervisor)</option>
                      <option value="OPERADOR">OPERADOR (Operador)</option>
                      <option value="FINANZAS">FINANZAS (Finanzas)</option>
                      <option value="CHOFER">CHOFER (Conductor)</option>
                      <option value="RECEPTOR">RECEPTOR (Operador Planta)</option>
                      <option value="MATERA">MATERA (Matera / Encargado Finca)</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b', marginBottom: '6px', display: 'block' }}>
                      Cédula / Documento
                    </label>
                    <input
                      type="text"
                      value={form.cedula || ''}
                      onChange={(e) => setForm({ ...form, cedula: e.target.value })}
                      placeholder="Ej: 1111111"
                      style={{
                        height: '42px',
                        fontSize: '13.5px',
                        fontFamily: 'monospace',
                        color: '#0f172a',
                        border: '1.5px solid #cbd5e1',
                        borderRadius: '8px',
                        background: '#ffffff',
                        width: '100%',
                        padding: '0 12px',
                      }}
                    />
                  </div>
                </div>

                {/* FILA 4: TELÉFONO Y EMAIL */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div>
                    <label style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b', marginBottom: '6px', display: 'block' }}>
                      Teléfono de Contacto
                    </label>
                    <input
                      type="text"
                      value={form.telefono || ''}
                      onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                      placeholder="Ej: 0412-1234567"
                      style={{
                        height: '42px',
                        fontSize: '13.5px',
                        color: '#0f172a',
                        border: '1.5px solid #cbd5e1',
                        borderRadius: '8px',
                        background: '#ffffff',
                        width: '100%',
                        padding: '0 12px',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b', marginBottom: '6px', display: 'block' }}>
                      Correo Electrónico
                    </label>
                    <input
                      type="email"
                      value={form.email || ''}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      placeholder="Ej: jose.perez@correo.com"
                      style={{
                        height: '42px',
                        fontSize: '13.5px',
                        color: '#0f172a',
                        border: '1.5px solid #cbd5e1',
                        borderRadius: '8px',
                        background: '#ffffff',
                        width: '100%',
                        padding: '0 12px',
                      }}
                    />
                  </div>
                </div>

                {/* SUBPANEL DATOS BANCARIOS (OPCIONAL) */}
                <div
                  style={{
                    background: '#f0fdf4',
                    border: '1.5px solid #bbf7d0',
                    borderRadius: '10px',
                    padding: '14px 16px',
                    marginBottom: '16px',
                  }}
                >
                  <div style={{ marginBottom: '10px' }}>
                    <span style={{ fontSize: '12.5px', fontWeight: 800, color: '#166534', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <i className="fa-solid fa-building-columns" style={{ color: '#15803d' }}></i>
                      Información Bancaria para Pagos y Transferencias (Opcional)
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '12px', marginBottom: '10px' }}>
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: 700, color: '#14532d', display: 'block', marginBottom: '4px' }}>
                        Banco
                      </label>
                      <input
                        type="text"
                        value={form.bancoNombre || ''}
                        onChange={(e) => setForm({ ...form, bancoNombre: e.target.value })}
                        placeholder="Ej: Banesco, Venezuela"
                        style={{
                          height: '38px',
                          fontSize: '13px',
                          border: '1.5px solid #86efac',
                          borderRadius: '8px',
                          background: '#ffffff',
                          width: '100%',
                          padding: '0 10px',
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: 700, color: '#14532d', display: 'block', marginBottom: '4px' }}>
                        Número de Cuenta (20 dígitos)
                      </label>
                      <input
                        type="text"
                        value={form.numeroCuenta || ''}
                        onChange={(e) => setForm({ ...form, numeroCuenta: e.target.value })}
                        placeholder="01340000000000000000"
                        maxLength={20}
                        style={{
                          height: '38px',
                          fontSize: '13px',
                          fontFamily: 'monospace',
                          border: '1.5px solid #86efac',
                          borderRadius: '8px',
                          background: '#ffffff',
                          width: '100%',
                          padding: '0 10px',
                        }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: 700, color: '#14532d', display: 'block', marginBottom: '4px' }}>
                        Cédula Pago Móvil
                      </label>
                      <input
                        type="text"
                        value={form.cedulaPagoMovil || ''}
                        onChange={(e) => setForm({ ...form, cedulaPagoMovil: e.target.value })}
                        placeholder="V-18408156"
                        style={{
                          height: '38px',
                          fontSize: '13px',
                          border: '1.5px solid #86efac',
                          borderRadius: '8px',
                          background: '#ffffff',
                          width: '100%',
                          padding: '0 10px',
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: 700, color: '#14532d', display: 'block', marginBottom: '4px' }}>
                        Teléfono Pago Móvil
                      </label>
                      <input
                        type="text"
                        value={form.telefonoPagoMovil || ''}
                        onChange={(e) => setForm({ ...form, telefonoPagoMovil: e.target.value })}
                        placeholder="0412-7869868"
                        style={{
                          height: '38px',
                          fontSize: '13px',
                          border: '1.5px solid #86efac',
                          borderRadius: '8px',
                          background: '#ffffff',
                          width: '100%',
                          padding: '0 10px',
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* CHECKBOX USUARIO ACTIVO */}
                <div>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      cursor: 'pointer',
                      color: '#1e293b',
                      fontSize: '13.5px',
                      fontWeight: 700,
                      height: '44px',
                      padding: '0 14px',
                      background: '#ffffff',
                      border: '1.5px solid #cbd5e1',
                      borderRadius: '8px',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={form.activo}
                      onChange={(e) => setForm({ ...form, activo: e.target.checked })}
                      style={{ width: '18px', height: '18px', accentColor: '#2563eb' }}
                    />
                    <span>Usuario Activo en el Sistema</span>
                  </label>
                </div>
              </div>

              {/* FOOTER 1:1 CON V2_3_11_26 */}
              <div
                style={{
                  padding: '16px 24px',
                  background: '#ffffff',
                  borderTop: '1px solid #e2e8f0',
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '12px',
                }}
              >
                <button
                  type="button"
                  onClick={cerrarModal}
                  className="btn btn-outline"
                  style={{ height: '42px', padding: '0 18px', borderRadius: '8px', fontWeight: 700 }}
                >
                  <i className="fa-solid fa-xmark"></i> Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardarMutation.isPending}
                  className="btn btn-primary"
                  style={{
                    height: '42px',
                    padding: '0 24px',
                    borderRadius: '8px',
                    background: '#2563eb',
                    border: 'none',
                    fontWeight: 800,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <i className="fa-solid fa-floppy-disk"></i>
                  {guardarMutation.isPending ? 'Guardando...' : 'Guardar Usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CAMBIAR CONTRASEÑA - ESTILO OSCURO 1:1 CON V2_3_11_26 */}
      {modalPassword && usuarioSeleccionado && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            backgroundColor: 'rgba(15, 23, 42, 0.7)',
            backdropFilter: 'blur(5px)',
          }}
        >
          <div
            className="content-card"
            style={{
              width: '100%',
              maxWidth: '460px',
              padding: '0',
              overflow: 'hidden',
              borderRadius: '16px',
              background: '#ffffff',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
            }}
          >
            {/* Header Oscuro */}
            <div
              style={{
                background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '8px',
                    background: 'rgba(245, 158, 11, 0.25)',
                    color: '#fbbf24',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '16px',
                  }}
                >
                  <i className="fa-solid fa-key"></i>
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#ffffff' }}>
                    Actualizar Contraseña
                  </h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: '11.5px', color: '#94a3b8' }}>
                    {usuarioSeleccionado.nombreCompleto || usuarioSeleccionado.nombreUsuario}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalPassword(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '24px' }}
              >
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
              style={{ padding: '20px', background: '#f8fafc' }}
            >
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#1e293b', marginBottom: '6px' }}>
                  Contraseña Actual (Administrador)
                </label>
                <input
                  type="password"
                  value={formPass.passwordActual}
                  onChange={(e) => setFormPass({ ...formPass, passwordActual: e.target.value })}
                  placeholder="••••••••"
                  style={{
                    width: '100%',
                    height: '40px',
                    borderRadius: '8px',
                    border: '1.5px solid #cbd5e1',
                    background: '#ffffff',
                    padding: '0 12px',
                    fontSize: '13px',
                  }}
                />
              </div>

              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#1e293b', marginBottom: '6px' }}>
                  Nueva Contraseña <span style={{ color: '#e11d48' }}>*</span>
                </label>
                <input
                  type="password"
                  value={formPass.nuevoPassword}
                  onChange={(e) => setFormPass({ ...formPass, nuevoPassword: e.target.value })}
                  placeholder="Mínimo 6 caracteres"
                  required
                  style={{
                    width: '100%',
                    height: '40px',
                    borderRadius: '8px',
                    border: '1.5px solid #cbd5e1',
                    background: '#ffffff',
                    padding: '0 12px',
                    fontSize: '13px',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setModalPassword(false)}
                  className="btn btn-outline"
                  style={{ height: '38px', padding: '0 16px', borderRadius: '8px', fontWeight: 700 }}
                >
                  <i className="fa-solid fa-xmark"></i> Cancelar
                </button>
                <button
                  type="submit"
                  disabled={cambiarPassMutation.isPending}
                  className="btn btn-primary"
                  style={{
                    height: '38px',
                    padding: '0 20px',
                    borderRadius: '8px',
                    background: '#f59e0b',
                    border: 'none',
                    fontWeight: 800,
                    color: '#ffffff',
                  }}
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
