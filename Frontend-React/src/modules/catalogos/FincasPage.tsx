import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { catalogosApi } from '@/api/catalogos.api';
import { DataTable, type ColumnDef } from '@/components/common/DataTable';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import { PropietarioSelect } from '@/components/selectors';
import { confirmDeleteOrDeactivate } from '@/lib/sweetalert';
import { useAuthStore } from '@/stores/authStore';
import type { FincaDto, GuardarFincaDto, PropietarioDto } from '@/types';

export const FincasPage: React.FC = () => {
  const queryClient = useQueryClient();
  const hasBufala = useAuthStore((state) => state.hasTenantModule('MOD_LECHE_BUFALA'));

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
    precioLitroAcidaUSD: 0.20,
    tieneDosTiposLeche: false,
    precioBufalaLitroUSD: 0.40,
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
      precioLitroAcidaUSD: item.precioLitroAcidaUSD || 0.20,
      tieneDosTiposLeche: Boolean(item.tieneDosTiposLeche),
      precioBufalaLitroUSD: item.precioBufalaLitroUSD || 0.40,
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

  // Columnas de la tabla
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
    ...(hasBufala
      ? [
          {
            header: 'SERVICIO',
            accessorKey: 'tipoLeche',
            sortable: true,
            cell: (row: FincaDto) => {
              const esDual = Boolean(row.tieneDosTiposLeche);
              const esBufala = row.tipoLeche === 'BUFALA';
              if (esDual) {
                return (
                  <span
                    className="badge"
                    style={{
                      background: '#eff6ff',
                      color: '#1d4ed8',
                      border: '1px solid #bfdbfe',
                      fontWeight: 700,
                    }}
                  >
                    <i className="fa-solid fa-code-fork" style={{ marginRight: '4px' }}></i>
                    DUAL (VACA + BÚFALA)
                  </span>
                );
              }
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
          } as ColumnDef<FincaDto>,
        ]
      : []),
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
      header: 'PRECIO NORMAL',
      accessorKey: 'precioLitroUSD',
      sortable: true,
      cell: (row) => (
        <span style={{ fontWeight: 800, color: '#059669', fontSize: '13.5px' }}>
          ${(row.precioLitroUSD || 0).toFixed(4)} <small>/L</small>
        </span>
      ),
    },
    {
      header: 'PRECIO ÁCIDA',
      accessorKey: 'precioLitroAcidaUSD',
      sortable: true,
      cell: (row) => (
        <span style={{ fontWeight: 800, color: '#d97706', fontSize: '12.5px' }}>
          ${(row.precioLitroAcidaUSD || 0).toFixed(4)} <small>/L</small>
        </span>
      ),
    },
    ...(hasBufala
      ? [
          {
            header: 'PRECIO BÚFALA',
            accessorKey: 'precioBufalaLitroUSD',
            sortable: true,
            cell: (row: FincaDto) =>
              row.tieneDosTiposLeche || row.tipoLeche === 'BUFALA' ? (
                <span style={{ fontWeight: 800, color: '#0284c7', fontSize: '12.5px' }}>
                  ${(row.precioBufalaLitroUSD || 0).toFixed(4)} <small>/L</small>
                </span>
              ) : (
                <span style={{ color: '#94a3b8', fontSize: '11.5px' }}>N/A</span>
              ),
          } as ColumnDef<FincaDto>,
        ]
      : []),
    {
      header: 'ESTADO',
      accessorKey: 'activo',
      sortable: true,
      cell: (row) => (
        <span
          className="badge"
          style={{
            background: row.activo ? '#ecfdf5' : '#fff1f2',
            color: row.activo ? '#047857' : '#e11d48',
            border: `1px solid ${row.activo ? '#a7f3d0' : '#fecdd3'}`,
          }}
        >
          {row.activo ? 'ACTIVO' : 'INACTIVO'}
        </span>
      ),
    },
    {
      header: 'ACCIONES',
      cell: (row) => (
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            onClick={() => abrirModalEditar(row)}
            className="btn btn-sm btn-outline"
            title="Editar Finca"
            style={{ padding: '4px 8px' }}
          >
            <i className="fa-solid fa-pen-to-square" style={{ color: '#4f46e5' }}></i>
          </button>
          <button
            onClick={async () => {
              if (await confirmDeleteOrDeactivate('Desactivar la finca', row.nombre)) {
                eliminarMutation.mutate(row.id);
              }
            }}
            className="btn btn-sm btn-outline"
            title="Desactivar Finca"
            style={{ padding: '4px 8px' }}
          >
            <i className="fa-solid fa-trash-can" style={{ color: '#e11d48' }}></i>
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="catalogos-page">
      {/* HEADER DE LA VISTA */}
      <div className="view-header" style={{ marginBottom: '24px' }}>
        <div>
          <h1 className="view-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <i className="fa-solid fa-seedling" style={{ color: '#10b981' }}></i>
            Fincas Ganaderas
          </h1>
          <p className="view-subtitle">
            Catálogo maestro de unidades de producción de leche, precios por litro y asignación de productores
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setModalPrecioMasivo(true)}
            className="btn btn-secondary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              background: '#ecfdf5',
              color: '#059669',
              border: '1.5px solid #a7f3d0',
              fontWeight: 700,
            }}
          >
            <i className="fa-solid fa-tags"></i>
            Actualizar Precios en Lote
          </button>

          <button
            onClick={abrirModalCrear}
            className="btn btn-primary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 14px rgba(79, 70, 229, 0.3)',
            }}
          >
            <i className="fa-solid fa-plus"></i>
            Nueva Finca
          </button>
        </div>
      </div>

      {/* MÉTRICAS RÁPIDAS SUPERIORES */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        <div
          className="dashboard-card"
          style={{
            padding: '16px 20px',
            background: '#ffffff',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
          }}
        >
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '10px',
              background: '#eef2ff',
              color: '#4f46e5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
            }}
          >
            <i className="fa-solid fa-cow"></i>
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
              Total Fincas
            </div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a' }}>{fincas.length}</div>
          </div>
        </div>

        <div
          className="dashboard-card"
          style={{
            padding: '16px 20px',
            background: '#ffffff',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
          }}
        >
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '10px',
              background: '#ecfdf5',
              color: '#059669',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
            }}
          >
            <i className="fa-solid fa-circle-check"></i>
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
              Fincas Activas
            </div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: '#059669' }}>
              {fincas.filter((f) => f.activo).length}
            </div>
          </div>
        </div>

        <div
          className="dashboard-card"
          style={{
            padding: '16px 20px',
            background: '#ffffff',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
          }}
        >
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '10px',
              background: '#f0fdf4',
              color: '#16a34a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
            }}
          >
            <i className="fa-solid fa-dollar-sign"></i>
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
              Precio Promedio Vaca
            </div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a' }}>
              $
              {fincas.length > 0
                ? (fincas.reduce((acc, f) => acc + (f.precioLitroUSD || 0), 0) / fincas.length).toFixed(4)
                : '0.0000'}
            </div>
          </div>
        </div>

        {hasBufala && (
          <div
            className="dashboard-card"
            style={{
              padding: '16px 20px',
              background: '#ffffff',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
            }}
          >
            <div
              style={{
                width: '46px',
                height: '46px',
                borderRadius: '10px',
                background: '#f5f3ff',
                color: '#7c3aed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px',
              }}
            >
              <i className="fa-solid fa-gem"></i>
            </div>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                Fincas con Búfala / Dual
              </div>
              <div style={{ fontSize: '22px', fontWeight: 800, color: '#7c3aed' }}>
                {fincas.filter((f) => f.tipoLeche === 'BUFALA' || f.tieneDosTiposLeche).length}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* TABLA PRINCIPAL DE DATOS */}
      <DataTable
        data={fincas}
        columns={columns}
        isLoading={isLoading}
        searchPlaceholder="Buscar por código, nombre de finca o propietario..."
        exportFileName="Catalogo_Fincas_Ganaderas"
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
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            padding: '16px',
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '540px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              overflow: 'visible',
              border: '1px solid #cbd5e1',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '16px 24px',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: '#f8fafc',
                borderTopLeftRadius: '16px',
                borderTopRightRadius: '16px',
              }}
            >
              <h2
                style={{
                  fontSize: '17px',
                  fontWeight: 800,
                  color: '#0f172a',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  margin: 0,
                }}
              >
                <i className="fa-solid fa-seedling" style={{ color: '#10b981' }}></i>
                {modoEdicionId ? 'Editar Finca Ganadera' : 'Registrar Nueva Finca'}
              </h2>
              <button
                type="button"
                onClick={cerrarModal}
                style={{
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  color: '#94a3b8',
                  fontSize: '18px',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            {/* Modal Body */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!form.nombre.trim()) {
                  toast.error('El nombre de la finca es obligatorio');
                  return;
                }
                guardarMutation.mutate(form);
              }}
              style={{ padding: '20px 24px' }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* 1. Código (NO EDITABLE, GENERADO AUTOMÁTICAMENTE) y Nombre de la Finca */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                      Código <span style={{ fontSize: '10.5px', color: '#94a3b8', fontWeight: 500 }}>(Automático)</span>
                    </label>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <input
                        type="text"
                        value={modoEdicionId ? form.codigo || 'S/C' : '(Auto-generado)'}
                        disabled
                        readOnly
                        className="form-input"
                        style={{
                          width: '100%',
                          height: '38px',
                          backgroundColor: '#f1f5f9',
                          color: '#64748b',
                          fontWeight: 700,
                          cursor: 'not-allowed',
                          paddingLeft: '30px',
                          border: '1px solid #cbd5e1',
                          borderRadius: '8px',
                        }}
                      />
                      <i
                        className="fa-solid fa-lock"
                        style={{
                          position: 'absolute',
                          left: '10px',
                          fontSize: '12px',
                          color: '#94a3b8',
                          pointerEvents: 'none',
                        }}
                      ></i>
                    </div>
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

                {/* 2. Propietario Ganadero con Componente Reutilizable PropietarioSelect */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                    Propietario Ganadero <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 500 }}>(Busca escribiendo)</span>
                  </label>
                  <PropietarioSelect
                    value={form.propietarioId}
                    onChange={(val) => setForm({ ...form, propietarioId: val })}
                    placeholder="-- Seleccionar o buscar ganadero --"
                  />
                </div>

                {/* 3. Check Dual (SOLO SI EL TENANT TIENE BÚFALA HABILITADA) */}
                {hasBufala && (
                  <div
                    style={{
                      padding: '10px 14px',
                      background: '#eff6ff',
                      border: '1.5px solid #bfdbfe',
                      borderRadius: '8px',
                    }}
                  >
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        cursor: 'pointer',
                        color: '#1e293b',
                        fontSize: '13px',
                        fontWeight: 700,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={form.tieneDosTiposLeche || false}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setForm({
                            ...form,
                            tieneDosTiposLeche: checked,
                            tipoLeche: checked ? 'AMBOS' : form.tipoLeche,
                          });
                        }}
                        style={{ width: '18px', height: '18px', accentColor: '#2563eb' }}
                      />
                      <span>
                        <i className="fa-solid fa-code-fork" style={{ color: '#2563eb', marginRight: '6px' }}></i>
                        ¿Maneja dos tipos de leche? (Vaca y Búfala)
                      </span>
                    </label>
                  </div>
                )}

                {/* 4. Grid de Precios: Precio Normal + Precio Ácida / Mala (+ Precio Búfala si aplica) */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: hasBufala && form.tieneDosTiposLeche ? '1fr 1fr 1fr' : '1fr 1fr',
                    gap: '12px',
                  }}
                >
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#1e293b', marginBottom: '4px' }}>
                      🥛 Precio Normal ($/Lt) *
                    </label>
                    <input
                      type="number"
                      step="0.0001"
                      value={form.precioLitroUSD}
                      onChange={(e) => setForm({ ...form, precioLitroUSD: Number(e.target.value) })}
                      className="form-input"
                      style={{
                        width: '100%',
                        height: '38px',
                        fontWeight: 800,
                        color: '#047857',
                        background: '#f0fdf4',
                        border: '1.5px solid #86efac',
                      }}
                      required
                    />
                  </div>

                  {hasBufala && form.tieneDosTiposLeche && (
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#0369a1', marginBottom: '4px' }}>
                        🐃 Precio Búfala ($/Lt) *
                      </label>
                      <input
                        type="number"
                        step="0.0001"
                        value={form.precioBufalaLitroUSD || 0.40}
                        onChange={(e) => setForm({ ...form, precioBufalaLitroUSD: Number(e.target.value) })}
                        className="form-input"
                        style={{
                          width: '100%',
                          height: '38px',
                          fontWeight: 800,
                          color: '#0369a1',
                          background: '#f0f9ff',
                          border: '1.5px solid #7dd3fc',
                        }}
                      />
                    </div>
                  )}

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#b45309', marginBottom: '4px' }}>
                      <i className="fa-solid fa-flask" style={{ color: '#d97706', marginRight: '4px' }}></i>
                      Precio Leche Ácida / Mala ($/Lt)
                    </label>
                    <input
                      type="number"
                      step="0.0001"
                      value={form.precioLitroAcidaUSD || 0.20}
                      onChange={(e) => setForm({ ...form, precioLitroAcidaUSD: Number(e.target.value) })}
                      className="form-input"
                      placeholder="0.2000"
                      style={{
                        width: '100%',
                        height: '38px',
                        fontWeight: 800,
                        color: '#b45309',
                        background: '#fffbeb',
                        border: '1.5px solid #fde68a',
                      }}
                    />
                  </div>
                </div>

                {/* 5. Teléfono y Ubicación */}
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

              {/* Botones del Modal */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
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
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            padding: '16px',
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '440px',
              padding: '24px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              border: '1px solid #cbd5e1',
            }}
          >
            <h2
              style={{
                fontSize: '18px',
                fontWeight: 800,
                color: '#0f172a',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '8px',
              }}
            >
              <i className="fa-solid fa-tags" style={{ color: '#059669' }}></i>
              Actualizar Precio en Lote
            </h2>
            <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '20px' }}>
              Este valor se aplicará de forma global a todas las fincas activas registradas en el sistema.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                precioMasivoMutation.mutate(nuevoPrecioMasivo);
              }}
            >
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                  Nuevo Precio por Litro ($/Lt)
                </label>
                <input
                  type="number"
                  step="0.0001"
                  value={nuevoPrecioMasivo}
                  onChange={(e) => setNuevoPrecioMasivo(Number(e.target.value))}
                  className="form-input"
                  style={{
                    width: '100%',
                    height: '42px',
                    fontSize: '16px',
                    fontWeight: 800,
                    color: '#059669',
                    background: '#f0fdf4',
                    border: '1.5px solid #86efac',
                  }}
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
                  style={{ height: '38px', background: '#059669', borderColor: '#059669' }}
                >
                  {precioMasivoMutation.isPending ? 'Actualizando...' : 'Confirmar y Aplicar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default FincasPage;
