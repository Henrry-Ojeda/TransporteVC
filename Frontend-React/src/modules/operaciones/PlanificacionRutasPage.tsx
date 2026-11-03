import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { operacionesApi } from '@/api/operaciones.api';
import { catalogosApi } from '@/api/catalogos.api';
import { DataTable, type ColumnDef } from '@/components/common/DataTable';
import type { RutaLogisticaDto, FincaDto } from '@/types';

export const PlanificacionRutasPage: React.FC = () => {
  const queryClient = useQueryClient();

  const [modalNuevaRuta, setModalNuevaRuta] = useState(false);
  const [modalFincas, setModalFincas] = useState(false);
  const [rutaActiva, setRutaActiva] = useState<RutaLogisticaDto | null>(null);

  const [formRuta, setFormRuta] = useState({
    nombre: '',
    codigo: '',
    descripcion: '',
    colorHex: '#3b82f6',
    activa: true,
  });

  const { data: rutas = [], isLoading, refetch } = useQuery<RutaLogisticaDto[]>({
    queryKey: ['rutas-planificacion'],
    queryFn: () => operacionesApi.getRutasLogistica(),
  });

  const { data: fincas = [] } = useQuery<FincaDto[]>({
    queryKey: ['fincas'],
    queryFn: () => catalogosApi.getFincas(true),
  });

  const fincasEnRuta = fincas.filter((f) => f.rutaId === rutaActiva?.id);
  const fincasSinRuta = fincas.filter((f) => !f.rutaId);

  const crearMutation = useMutation({
    mutationFn: (dto: typeof formRuta) => operacionesApi.crearRutaLogistica(dto),
    onSuccess: (data: any) => {
      toast.success(data.message || 'Ruta creada exitosamente');
      queryClient.invalidateQueries({ queryKey: ['rutas-planificacion'] });
      setModalNuevaRuta(false);
      setFormRuta({ nombre: '', codigo: '', descripcion: '', colorHex: '#3b82f6', activa: true });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Error al crear ruta');
    },
  });

  const asignarMutation = useMutation({
    mutationFn: ({ rutaId, ids }: { rutaId: number; ids: number[] }) =>
      operacionesApi.asignarFincasARuta(rutaId, ids),
    onSuccess: (data: any) => {
      toast.success(data.message || 'Secuencia de fincas actualizada');
      queryClient.invalidateQueries({ queryKey: ['rutas-planificacion'] });
      queryClient.invalidateQueries({ queryKey: ['fincas'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Error al asignar fincas');
    },
  });

  const agregarFinca = (fincaId: number) => {
    if (!rutaActiva) return;
    const nuevas = [...fincasEnRuta.map((f) => f.id), fincaId];
    asignarMutation.mutate({ rutaId: rutaActiva.id, ids: nuevas });
  };

  const removerFinca = (fincaId: number) => {
    if (!rutaActiva) return;
    const nuevas = fincasEnRuta.filter((f) => f.id !== fincaId).map((f) => f.id);
    asignarMutation.mutate({ rutaId: rutaActiva.id, ids: nuevas });
  };

  const columns: ColumnDef<RutaLogisticaDto>[] = [
    {
      header: 'Color',
      cell: (row) => (
        <div
          style={{
            width: '24px',
            height: '24px',
            borderRadius: '6px',
            backgroundColor: (row as any).colorHex || '#3b82f6',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          }}
        />
      ),
    },
    {
      header: 'Ruta / Zona',
      accessorKey: 'nombre',
      sortable: true,
      cell: (row) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <i className="fa-solid fa-route" style={{ color: (row as any).colorHex || '#3b82f6' }}></i>
          <span style={{ fontWeight: 800, color: '#0f172a' }}>{row.nombre}</span>
        </div>
      ),
    },
    {
      header: 'Código',
      accessorKey: 'id',
      sortable: true,
      cell: (row) => (
        <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#64748b' }}>
          {`RUT-${row.id}`}
        </span>
      ),
    },
    {
      header: 'Descripción',
      accessorKey: 'descripcion',
      cell: (row) => <span style={{ color: '#475569', fontSize: '12.5px' }}>{row.descripcion || 'Sin descripción'}</span>,
    },
    {
      header: 'Fincas Vinculadas',
      cell: (row) => {
        const count = fincas.filter((f) => f.rutaId === row.id).length;
        return (
          <span className="badge" style={{ background: '#ecfdf5', color: '#047857', fontWeight: 800, border: '1px solid #a7f3d0' }}>
            <i className="fa-solid fa-cow" style={{ marginRight: '4px' }}></i> {count} Fincas
          </span>
        );
      },
    },
    {
      header: 'Estado',
      accessorKey: 'activo',
      cell: (row) => (
        <span
          className="badge"
          style={{
            background: row.activo ? '#eff6ff' : '#fef2f2',
            color: row.activo ? '#1d4ed8' : '#dc2626',
            fontWeight: 800,
            border: `1px solid ${row.activo ? '#bfdbfe' : '#fecaca'}`,
          }}
        >
          {row.activo ? 'Operativa' : 'Inactiva'}
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
              setRutaActiva(row);
              setModalFincas(true);
            }}
            className="btn btn-sm btn-outline"
            style={{ height: '30px', padding: '0 10px', fontSize: '12px', color: '#2563eb', borderColor: '#bfdbfe' }}
            title="Asignar Fincas"
          >
            <i className="fa-solid fa-link" style={{ marginRight: '4px' }}></i> Fincas
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px',
                boxShadow: '0 4px 12px rgba(37,99,235,0.3)',
              }}
            >
              <i className="fa-solid fa-map-location-dot"></i>
            </div>
            <div>
              <h1 className="view-title" style={{ margin: 0 }}>Planificación de Rutas y Zonas</h1>
              <p className="view-subtitle" style={{ margin: '2px 0 0 0' }}>
                Gestión de zonas de recolección (Zona Sur, La Playa, Zona Norte, etc.) y asignación de fincas operativas
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => refetch()}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}
          >
            <i className="fa-solid fa-arrows-rotate"></i> Actualizar
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setModalNuevaRuta(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              fontWeight: 700,
              background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
              border: 'none',
              borderRadius: '8px',
              color: '#ffffff',
              boxShadow: '0 4px 14px rgba(37,99,235,0.35)',
            }}
          >
            <i className="fa-solid fa-plus-circle"></i> Nueva Ruta / Zona
          </button>
        </div>
      </div>

      {/* TARJETAS DE INDICADORES (KPIS) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: '#ffffff', borderRadius: '14px', border: '1.5px solid #e2e8f0', padding: '18px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Rutas / Zonas Activas
            </span>
            <div style={{ fontSize: '26px', fontWeight: 900, color: '#1e293b', marginTop: '4px' }}>
              {rutas.filter((r) => r.activo).length}
            </div>
            <span style={{ fontSize: '11.5px', color: '#2563eb', fontWeight: 600 }}>Circuitos de recolección</span>
          </div>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>
            <i className="fa-solid fa-route"></i>
          </div>
        </div>

        <div style={{ background: '#ffffff', borderRadius: '14px', border: '1.5px solid #e2e8f0', padding: '18px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Fincas Vinculadas a Rutas
            </span>
            <div style={{ fontSize: '26px', fontWeight: 900, color: '#059669', marginTop: '4px' }}>
              {fincas.filter((f) => f.rutaId).length}
            </div>
            <span style={{ fontSize: '11.5px', color: '#059669', fontWeight: 600 }}>Asignadas a un circuito</span>
          </div>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>
            <i className="fa-solid fa-cow"></i>
          </div>
        </div>

        <div style={{ background: '#ffffff', borderRadius: '14px', border: '1.5px solid #e2e8f0', padding: '18px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Fincas Sin Ruta Asignada
            </span>
            <div style={{ fontSize: '26px', fontWeight: 900, color: '#d97706', marginTop: '4px' }}>
              {fincasSinRuta.length}
            </div>
            <span style={{ fontSize: '11.5px', color: '#d97706', fontWeight: 600 }}>Pendientes de asignación</span>
          </div>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#fffbeb', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>
            <i className="fa-solid fa-triangle-exclamation"></i>
          </div>
        </div>
      </div>

      {/* Tabla Principal */}
      <DataTable
        data={rutas}
        columns={columns}
        isLoading={isLoading}
        searchPlaceholder="Buscar ruta o zona por nombre..."
        exportFileName="planificacion_rutas"
        searchFilter={(row, term) =>
          Boolean(row.nombre && row.nombre.toLowerCase().includes(term))
        }
      />

      {/* Modal Nueva Ruta */}
      {modalNuevaRuta && (
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
          <div className="content-card" style={{ width: '100%', maxWidth: '460px', padding: '0', overflow: 'hidden', borderRadius: '16px' }}>
            <div style={{ padding: '16px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                <i className="fa-solid fa-route" style={{ color: '#2563eb', marginRight: '8px' }}></i>
                Registrar Nueva Ruta / Zona
              </h3>
              <button type="button" onClick={() => setModalNuevaRuta(false)} style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '18px' }}>
                &times;
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!formRuta.nombre.trim()) {
                  toast.error('El nombre de la ruta es obligatorio');
                  return;
                }
                crearMutation.mutate(formRuta);
              }}
              style={{ padding: '20px' }}
            >
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                  Nombre de la Ruta / Zona *
                </label>
                <input
                  type="text"
                  value={formRuta.nombre}
                  onChange={(e) => setFormRuta({ ...formRuta, nombre: e.target.value })}
                  placeholder="Ej: Zona Sur - Sector La Playa"
                  className="form-input"
                  style={{ width: '100%', height: '38px', borderRadius: '8px', fontWeight: 600 }}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                    Código de Ruta
                  </label>
                  <input
                    type="text"
                    value={formRuta.codigo}
                    onChange={(e) => setFormRuta({ ...formRuta, codigo: e.target.value.toUpperCase() })}
                    placeholder="RUT-SUR-01"
                    className="form-input"
                    style={{ width: '100%', height: '38px', borderRadius: '8px', fontFamily: 'monospace' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                    Color Identificador
                  </label>
                  <input
                    type="color"
                    value={formRuta.colorHex}
                    onChange={(e) => setFormRuta({ ...formRuta, colorHex: e.target.value })}
                    className="form-input"
                    style={{ width: '100%', height: '38px', borderRadius: '8px', padding: '2px' }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                  Descripción / Observaciones
                </label>
                <input
                  type="text"
                  value={formRuta.descripcion}
                  onChange={(e) => setFormRuta({ ...formRuta, descripcion: e.target.value })}
                  placeholder="Detalles del circuito o accesos..."
                  className="form-input"
                  style={{ width: '100%', height: '38px', borderRadius: '8px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setModalNuevaRuta(false)} className="btn btn-outline" style={{ height: '38px', padding: '0 16px', borderRadius: '8px' }}>
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={crearMutation.isPending}
                  className="btn btn-primary"
                  style={{ height: '38px', padding: '0 20px', borderRadius: '8px', background: '#2563eb', border: 'none', fontWeight: 700 }}
                >
                  {crearMutation.isPending ? 'Guardando...' : 'Crear Ruta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Asignar Fincas a Ruta */}
      {modalFincas && rutaActiva && (
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
          <div className="content-card" style={{ width: '100%', maxWidth: '640px', padding: '0', overflow: 'hidden', borderRadius: '16px' }}>
            <div style={{ padding: '16px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                <i className="fa-solid fa-link" style={{ color: '#2563eb', marginRight: '8px' }}></i>
                Asignar Fincas a: {rutaActiva.nombre}
              </h3>
              <button type="button" onClick={() => setModalFincas(false)} style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '18px' }}>
                &times;
              </button>
            </div>

            <div style={{ padding: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                {/* Fincas ya en la ruta */}
                <div>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', fontWeight: 800, color: '#059669' }}>
                    <i className="fa-solid fa-circle-check"></i> Fincas en esta Ruta ({fincasEnRuta.length})
                  </h4>
                  <div style={{ maxHeight: '280px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px', background: '#fafafa' }}>
                    {fincasEnRuta.length === 0 ? (
                      <p style={{ fontSize: '12px', color: '#94a3b8', textAlign: 'center', margin: '20px 0' }}>No hay fincas asignadas</p>
                    ) : (
                      fincasEnRuta.map((f) => (
                        <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', background: '#fff', borderRadius: '6px', marginBottom: '4px', border: '1px solid #e2e8f0' }}>
                          <span style={{ fontSize: '12px', fontWeight: 600, color: '#0f172a' }}>{f.nombre}</span>
                          <button
                            type="button"
                            onClick={() => removerFinca(f.id)}
                            style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: '4px', padding: '2px 6px', fontSize: '11px', cursor: 'pointer' }}
                          >
                            Quitar
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Fincas sin ruta */}
                <div>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', fontWeight: 800, color: '#475569' }}>
                    <i className="fa-solid fa-plus-circle"></i> Fincas Disponibles ({fincasSinRuta.length})
                  </h4>
                  <div style={{ maxHeight: '280px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px', background: '#fafafa' }}>
                    {fincasSinRuta.length === 0 ? (
                      <p style={{ fontSize: '12px', color: '#94a3b8', textAlign: 'center', margin: '20px 0' }}>No hay fincas libres</p>
                    ) : (
                      fincasSinRuta.map((f) => (
                        <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', background: '#fff', borderRadius: '6px', marginBottom: '4px', border: '1px solid #e2e8f0' }}>
                          <span style={{ fontSize: '12px', fontWeight: 600, color: '#0f172a' }}>{f.nombre}</span>
                          <button
                            type="button"
                            onClick={() => agregarFinca(f.id)}
                            style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#2563eb', borderRadius: '4px', padding: '2px 6px', fontSize: '11px', cursor: 'pointer' }}
                          >
                            + Agregar
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
                <button type="button" onClick={() => setModalFincas(false)} className="btn btn-primary" style={{ height: '36px', padding: '0 20px', borderRadius: '8px' }}>
                  Listo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlanificacionRutasPage;
