import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { sistemaApi } from '@/api/sistema.api';
import type { PermisoModuloDto } from '@/types';

export const PermisosPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [rolActivo, setRolActivo] = useState<string>('OPERADOR');

  const { data: permisos = [], isLoading, refetch } = useQuery<PermisoModuloDto[]>({
    queryKey: ['permisos-matriz'],
    queryFn: () => sistemaApi.getMatrizPermisos(),
  });

  const toggleMutation = useMutation({
    mutationFn: ({
      rol,
      modulo,
      acciones,
    }: {
      rol: string;
      modulo: string;
      acciones: { puedeVer: boolean; puedeEditar: boolean; puedeAgregar: boolean; puedeEliminar: boolean };
    }) => sistemaApi.actualizarPermisoRol(rol, modulo, acciones),
    onSuccess: () => {
      toast.success('Permiso actualizado correctamente');
      queryClient.invalidateQueries({ queryKey: ['permisos-matriz'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Error al actualizar permiso');
    },
  });

  const modulosEstandar = [
    { codigo: 'DASHBOARD', nombre: 'Dashboard Principal', icono: 'fa-chart-pie' },
    { codigo: 'RUTAS', nombre: 'Recolección en Ruta & Tickets', icono: 'fa-truck' },
    { codigo: 'RECEPTORIA', nombre: 'Entregas & Receptoría', icono: 'fa-building-wheat' },
    { codigo: 'BALANCE', nombre: 'Balance Volumétrico & Merma', icono: 'fa-scale-balanced' },
    { codigo: 'FINCAS', nombre: 'Catálogo de Fincas', icono: 'fa-cow' },
    { codigo: 'PROPIETARIOS', nombre: 'Catálogo de Propietarios', icono: 'fa-user-tie' },
    { codigo: 'COMPANIAS', nombre: 'Compañías & Queseras', icono: 'fa-industry' },
    { codigo: 'CAMIONES', nombre: 'Flota de Camiones', icono: 'fa-truck-front' },
    { codigo: 'CONDUCTORES', nombre: 'Conductores & Choferes', icono: 'fa-id-card' },
    { codigo: 'COMBUSTIBLE', nombre: 'Gestión de Combustible', icono: 'fa-gas-pump' },
    { codigo: 'MANTENIMIENTO', nombre: 'Mantenimiento & Taller', icono: 'fa-wrench' },
    { codigo: 'REPUESTOS', nombre: 'Inventario de Repuestos', icono: 'fa-gears' },
    { codigo: 'LIQUIDACION', nombre: 'Liquidación & Semanas', icono: 'fa-file-invoice-dollar' },
    { codigo: 'ADELANTOS', nombre: 'Adelantos & Amortizaciones', icono: 'fa-hand-holding-dollar' },
    { codigo: 'PAGOS', nombre: 'Nómina & Pagos Personal', icono: 'fa-money-check-dollar' },
    { codigo: 'REPORTES', nombre: 'Reportes Ejecutivos', icono: 'fa-chart-line' },
    { codigo: 'DATA', nombre: 'Gestión de Data Masiva', icono: 'fa-database' },
    { codigo: 'USUARIOS', nombre: 'Usuarios & Seguridad', icono: 'fa-shield-halved' },
  ];

  return (
    <div>
      {/* VISTA HEADER 1:1 */}
      <div className="view-header">
        <div>
          <h1 className="view-title">
            <i className="fa-solid fa-shield-halved" style={{ color: '#0284c7', marginRight: '8px' }}></i>
            Matriz de Permisos & Seguridad
          </h1>
          <p className="view-subtitle">
            Control de accesos y facultades operativas por cada perfil de usuario en los módulos del sistema
          </p>
        </div>

        <div className="view-actions">
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => refetch()}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}
          >
            <i className="fa-solid fa-arrows-rotate"></i> Recargar Matriz
          </button>
        </div>
      </div>

      {/* SELECTOR DE ROL (PILLS) */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {['ADMIN', 'OPERADOR', 'CHOFER'].map((rol) => (
          <button
            key={rol}
            type="button"
            onClick={() => setRolActivo(rol)}
            style={{
              padding: '8px 20px',
              borderRadius: '20px',
              fontWeight: 800,
              fontSize: '13px',
              cursor: 'pointer',
              border: rolActivo === rol ? 'none' : '1.5px solid #cbd5e1',
              background: rolActivo === rol ? 'linear-gradient(135deg, #0284c7, #2563eb)' : '#ffffff',
              color: rolActivo === rol ? '#ffffff' : '#475569',
              boxShadow: rolActivo === rol ? '0 4px 12px rgba(37,99,235,0.3)' : 'none',
              transition: 'all 0.2s',
            }}
          >
            <i className={`fa-solid ${rol === 'ADMIN' ? 'fa-crown' : rol === 'OPERADOR' ? 'fa-user-gear' : 'fa-truck'}`} style={{ marginRight: '6px' }}></i>
            Rol: {rol}
          </button>
        ))}
      </div>

      {/* TABLA MATRIZ */}
      <div className="content-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="modern-table">
            <thead>
              <tr>
                <th>Módulo del Sistema</th>
                <th style={{ textAlign: 'center', width: '130px' }}>Puede Ver</th>
                <th style={{ textAlign: 'center', width: '130px' }}>Puede Crear</th>
                <th style={{ textAlign: 'center', width: '130px' }}>Puede Editar</th>
                <th style={{ textAlign: 'center', width: '130px' }}>Puede Eliminar</th>
              </tr>
            </thead>
            <tbody>
              {modulosEstandar.map((m) => {
                const perm = permisos.find((p) => p.rol === rolActivo && p.moduloCodigo === m.codigo) || {
                  puedeVer: rolActivo === 'ADMIN' || rolActivo === 'OPERADOR',
                  puedeAgregar: rolActivo === 'ADMIN' || (rolActivo === 'OPERADOR' && m.codigo !== 'USUARIOS'),
                  puedeEditar: rolActivo === 'ADMIN',
                  puedeEliminar: rolActivo === 'ADMIN',
                };

                const disabled = rolActivo === 'ADMIN';

                return (
                  <tr key={m.codigo}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '8px',
                            background: '#eff6ff',
                            color: '#2563eb',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '13px',
                          }}
                        >
                          <i className={`fa-solid ${m.icono}`}></i>
                        </div>
                        <div>
                          <div style={{ fontWeight: 800, color: '#0f172a' }}>{m.nombre}</div>
                          <div style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace' }}>
                            COD: {m.codigo}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td style={{ textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={perm.puedeVer}
                        disabled={disabled}
                        onChange={(e) =>
                          toggleMutation.mutate({
                            rol: rolActivo,
                            modulo: m.codigo,
                            acciones: { ...perm, puedeVer: e.target.checked },
                          })
                        }
                        style={{ width: '18px', height: '18px', cursor: disabled ? 'not-allowed' : 'pointer' }}
                      />
                    </td>

                    <td style={{ textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={perm.puedeAgregar}
                        disabled={disabled}
                        onChange={(e) =>
                          toggleMutation.mutate({
                            rol: rolActivo,
                            modulo: m.codigo,
                            acciones: { ...perm, puedeAgregar: e.target.checked },
                          })
                        }
                        style={{ width: '18px', height: '18px', cursor: disabled ? 'not-allowed' : 'pointer' }}
                      />
                    </td>

                    <td style={{ textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={perm.puedeEditar}
                        disabled={disabled}
                        onChange={(e) =>
                          toggleMutation.mutate({
                            rol: rolActivo,
                            modulo: m.codigo,
                            acciones: { ...perm, puedeEditar: e.target.checked },
                          })
                        }
                        style={{ width: '18px', height: '18px', cursor: disabled ? 'not-allowed' : 'pointer' }}
                      />
                    </td>

                    <td style={{ textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={perm.puedeEliminar}
                        disabled={disabled}
                        onChange={(e) =>
                          toggleMutation.mutate({
                            rol: rolActivo,
                            modulo: m.codigo,
                            acciones: { ...perm, puedeEliminar: e.target.checked },
                          })
                        }
                        style={{ width: '18px', height: '18px', cursor: disabled ? 'not-allowed' : 'pointer' }}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PermisosPage;
