import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { catalogosApi } from '@/api/catalogos.api';
import { DataTable, type ColumnDef } from '@/components/common/DataTable';
import type { FincaDto, GuardarFincaDto, PropietarioDto } from '@/types';

export const FincasPage: React.FC = () => {
  const queryClient = useQueryClient();

  const [modalAbierto, setModalAbierto] = useState(false);
  const [modalPrecioMasivo, setModalPrecioMasivo] = useState(false);
  const [modoEdicionId, setModoEdicionId] = useState<number | null>(null);
  const [nuevoPrecioMasivo, setNuevoPrecioMasivo] = useState<number>(0.35);

  const initialForm: GuardarFincaDto = {
    codigo: '',
    nombre: '',
    propietarioId: undefined,
    rutaId: undefined,
    precioLitroUSD: 0.35,
    tipoLeche: 'VACA',
    telefono: '',
    ubicacion: '',
    activo: true,
  };
  const [form, setForm] = useState<GuardarFincaDto>(initialForm);

  // Queries
  const { data: fincas = [], isLoading } = useQuery<FincaDto[]>({
    queryKey: ['fincas'],
    queryFn: () => catalogosApi.getFincas(false),
  });

  const { data: propietarios = [] } = useQuery<PropietarioDto[]>({
    queryKey: ['propietarios'],
    queryFn: () => catalogosApi.getPropietarios(),
  });

  // Mutaciones
  const guardarMutation = useMutation({
    mutationFn: (dto: GuardarFincaDto) =>
      modoEdicionId ? catalogosApi.actualizarFinca(modoEdicionId, dto) : catalogosApi.crearFinca(dto),
    onSuccess: (data: any) => {
      toast.success(data.message || 'Finca guardada exitosamente');
      queryClient.invalidateQueries({ queryKey: ['fincas'] });
      cerrarModal();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Error al guardar finca');
    },
  });

  const eliminarMutation = useMutation({
    mutationFn: (id: number) => catalogosApi.eliminarFinca(id),
    onSuccess: (data) => {
      toast.success(data.message || 'Finca desactivada');
      queryClient.invalidateQueries({ queryKey: ['fincas'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Error al desactivar finca');
    },
  });

  const precioMasivoMutation = useMutation({
    mutationFn: (precio: number) => catalogosApi.actualizarPreciosMasivo(precio),
    onSuccess: (data) => {
      toast.success(data.message || 'Precios actualizados en lote');
      queryClient.invalidateQueries({ queryKey: ['fincas'] });
      setModalPrecioMasivo(false);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Error al actualizar precios');
    },
  });

  const abrirModalCrear = () => {
    setModoEdicionId(null);
    setForm(initialForm);
    setModalAbierto(true);
  };

  const abrirModalEditar = (item: FincaDto) => {
    setModoEdicionId(item.id);
    setForm({
      codigo: item.codigo,
      nombre: item.nombre,
      propietarioId: item.propietarioId,
      rutaId: item.rutaId,
      precioLitroUSD: item.precioLitroUSD || 0.35,
      tipoLeche: item.tipoLeche || 'VACA',
      telefono: item.telefono || '',
      ubicacion: item.ubicacion || '',
      activo: item.activo,
    });
    setModalAbierto(true);
  };

  const cerrarModal = () => {
    setModalAbierto(false);
    setModoEdicionId(null);
  };

  // Columnas exactas del sistema original
  const columns: ColumnDef<FincaDto>[] = [
    {
      header: 'CÓDIGO',
      accessorKey: 'codigo',
      sortable: true,
      cell: (row) => (
        <span style={{ fontWeight: 800, fontFamily: 'monospace', color: '#4f46e5' }}>
          {row.codigo || 'S/C'}
        </span>
      ),
    },
    {
      header: 'NOMBRE FINCA',
      accessorKey: 'nombre',
      sortable: true,
      cell: (row) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <i className="fa-solid fa-seedling" style={{ color: '#10b981' }}></i>
          <span style={{ fontWeight: 700, color: '#0f172a' }}>{row.nombre}</span>
        </div>
      ),
    },
    {
      header: 'SERVICIO',
      accessorKey: 'tipoLeche',
      sortable: true,
      cell: (row) => {
        const esBufala = row.tipoLeche === 'BUFALA';
        return (
          <span
            className="badge"
            style={{
              background: esBufala ? '#f3e8ff' : '#e0f2fe',
              color: esBufala ? '#7e22ce' : '#0369a1',
              border: `1px solid ${esBufala ? '#d8b4fe' : '#bae6fd'}`,
              fontWeight: 700,
            }}
          >
            <i className={`fa-solid ${esBufala ? 'fa-gem' : 'fa-cow'}`} style={{ marginRight: '4px' }}></i>
            {esBufala ? 'BÚFALA' : 'VACA'}
          </span>
        );
      },
    },
    {
      header: 'PROPIETARIO / CÉDULA',
      accessorKey: 'propietarioNombre',
      sortable: true,
      cell: (row) => (
        <div>
          <div style={{ fontWeight: 600, color: '#334155' }}>
            <i className="fa-regular fa-user" style={{ color: '#64748b', marginRight: '6px' }}></i>
            {row.propietarioNombre || 'Sin asignar'}
          </div>
          {row.ubicacion && (
            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
              <i className="fa-solid fa-location-dot" style={{ marginRight: '4px' }}></i>
              {row.ubicacion}
            </div>
          )}
        </div>
      ),
    },
    {
      header: 'TELÉFONO',
      accessorKey: 'telefono',
      cell: (row) => (
        <span style={{ color: '#64748b', fontSize: '12.5px' }}>
          {row.telefono ? (
            <>
              <i className="fa-solid fa-phone" style={{ color: '#94a3b8', marginRight: '4px' }}></i>
              {row.telefono}
            </>
          ) : (
            '-'
          )}
        </span>
      ),
    },
    {
      header: 'PRECIO ($/LT)',
      accessorKey: 'precioLitroUSD',
      sortable: true,
      cell: (row) => (
        <span style={{ fontWeight: 800, color: '#059669', fontSize: '13.5px' }}>
          ${(row.precioLitroUSD || 0).toFixed(4)} <small>/L</small>
        </span>
      ),
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
          <i className={`fa-solid ${row.activo ? 'fa-check' : 'fa-xmark'}`} style={{ marginRight: '4px' }}></i>
          {row.activo ? 'Activa' : 'Inactiva'}
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
            title="Editar Finca"
          >
            <i className="fa-solid fa-pen-to-square"></i>
          </button>
          <button
            type="button"
            onClick={() => {
              if (window.confirm(`¿Desactivar la finca "${row.nombre}"?`)) {
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
    <section id="tab-fincas" className="tab-content active" style={{ display: 'block' }}>
      {/* CABECERA VISTA */}
      <div className="view-header">
        <div>
          <h1 className="view-title">Catálogo de Fincas y Ganaderos</h1>
          <p className="view-subtitle">
            Productores registrados, cuentas bancarias y precios por litro de leche
          </p>
        </div>
        <div className="view-actions" style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => setModalPrecioMasivo(true)}
            style={{
              background: 'linear-gradient(135deg, #0284c7, #2563eb)',
              color: '#ffffff',
              border: 'none',
              fontWeight: 700,
              boxShadow: '0 4px 14px rgba(37,99,235,0.35)',
            }}
          >
            <i className="fa-solid fa-hand-holding-dollar"></i> Actualizar Precios Masivo
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={abrirModalCrear}
            style={{ fontWeight: 700 }}
          >
            <i className="fa-solid fa-cow"></i> + Nueva Finca
          </button>
        </div>
      </div>

      {/* TABLA DE FINCAS */}
      <DataTable
        data={fincas}
        columns={columns}
        isLoading={isLoading}
        searchPlaceholder="Buscar por nombre, código, propietario..."
        exportFileName="catalogo_fincas"
        searchFilter={(row, term) =>
          Boolean(
            (row.nombre && row.nombre.toLowerCase().includes(term)) ||
            (row.codigo && row.codigo.toLowerCase().includes(term)) ||
            (row.propietarioNombre && row.propietarioNombre.toLowerCase().includes(term))
          )
        }
      />

      {/* MODAL CREAR / EDITAR FINCA */}
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
                <i className="fa-solid fa-cow" style={{ color: '#4f46e5', marginRight: '8px' }}></i>
                {modoEdicionId ? 'Editar Finca Ganadera' : 'Registrar Nueva Finca Ganadera'}
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
                if (!form.nombre.trim()) {
                  toast.error('El nombre de la finca es obligatorio');
                  return;
                }
                guardarMutation.mutate(form);
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                      Código
                    </label>
                    <input
                      type="text"
                      value={form.codigo}
                      onChange={(e) => setForm({ ...form, codigo: e.target.value })}
                      className="form-input"
                      placeholder="Ej: F-102"
                      style={{ width: '100%', height: '38px', textTransform: 'uppercase' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                      Nombre de la Finca *
                    </label>
                    <input
                      type="text"
                      value={form.nombre}
                      onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                      className="form-input"
                      placeholder="Nombre de la hacienda o finca"
                      style={{ width: '100%', height: '38px' }}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                    Propietario Ganadero
                  </label>
                  <select
                    value={form.propietarioId || ''}
                    onChange={(e) => setForm({ ...form, propietarioId: e.target.value ? Number(e.target.value) : undefined })}
                    className="form-input"
                    style={{ width: '100%', height: '38px' }}
                  >
                    <option value="">-- Sin propietario asignado --</option>
                    {propietarios.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombreCompleto} ({p.cedulaRif || 'S/C'})
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                      Tipo de Leche
                    </label>
                    <select
                      value={form.tipoLeche}
                      onChange={(e) => setForm({ ...form, tipoLeche: e.target.value })}
                      className="form-input"
                      style={{ width: '100%', height: '38px' }}
                    >
                      <option value="VACA">🥛 Vaca</option>
                      <option value="BUFALA">🐃 Búfala</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                      Precio Pactado ($/Lt)
                    </label>
                    <input
                      type="number"
                      step="0.0001"
                      value={form.precioLitroUSD}
                      onChange={(e) => setForm({ ...form, precioLitroUSD: Number(e.target.value) })}
                      className="form-input"
                      style={{ width: '100%', height: '38px', fontWeight: 700, color: '#059669' }}
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
                      Ubicación / Sector
                    </label>
                    <input
                      type="text"
                      value={form.ubicacion}
                      onChange={(e) => setForm({ ...form, ubicacion: e.target.value })}
                      className="form-input"
                      placeholder="Sector o Carretera"
                      style={{ width: '100%', height: '38px' }}
                    />
                  </div>
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
                  {guardarMutation.isPending ? 'Guardando...' : modoEdicionId ? 'Actualizar Finca' : 'Registrar Finca'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PRECIOS MASIVO */}
      {modalPrecioMasivo && (
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
                <i className="fa-solid fa-hand-holding-dollar" style={{ color: '#0284c7', marginRight: '8px' }}></i>
                Actualizar Precios en Lote
              </h3>
              <button
                type="button"
                onClick={() => setModalPrecioMasivo(false)}
                style={{ background: 'none', border: 'none', fontSize: '18px', color: '#94a3b8', cursor: 'pointer' }}
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>
              Este valor se aplicará como precio por litro base a todas las fincas activas en el sistema.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                precioMasivoMutation.mutate(nuevoPrecioMasivo);
              }}
            >
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                  Nuevo Precio Unificado ($/Litro)
                </label>
                <input
                  type="number"
                  step="0.0001"
                  value={nuevoPrecioMasivo}
                  onChange={(e) => setNuevoPrecioMasivo(Number(e.target.value))}
                  className="form-input"
                  style={{ width: '100%', height: '40px', fontSize: '16px', fontWeight: 800, color: '#0284c7' }}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setModalPrecioMasivo(false)}
                  className="btn btn-outline"
                  style={{ height: '38px' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={precioMasivoMutation.isPending}
                  className="btn btn-primary"
                  style={{ height: '38px', background: 'linear-gradient(135deg, #0284c7, #2563eb)' }}
                >
                  {precioMasivoMutation.isPending ? 'Actualizando...' : 'Confirmar y Aplicar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};

export default FincasPage;
