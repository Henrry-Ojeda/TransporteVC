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

  // Queries (En el módulo Fincas se muestran TODAS: activas e inactivas)
  const { data: fincas = [], isLoading } = useQuery<FincaDto[]>({
    queryKey: ['fincas-catalogo-completo'],
    queryFn: () => catalogosApi.getFincas(false),
  });

  const { data: propietarios = [] } = useQuery<PropietarioDto[]>({
    queryKey: ['propietarios-selector'],
    queryFn: () => catalogosApi.getPropietarios(),
  });

  const invalidarCachesFincas = () => {
    queryClient.invalidateQueries({ queryKey: ['fincas-catalogo-completo'] });
    queryClient.invalidateQueries({ queryKey: ['fincas'] });
    queryClient.invalidateQueries({ queryKey: ['fincas-catalogos'] });
    queryClient.invalidateQueries({ queryKey: ['fincas-evolucion'] });
    queryClient.invalidateQueries({ queryKey: ['fincas-bufala'] });
    queryClient.invalidateQueries({ queryKey: ['rutas-logistica'] });
    queryClient.invalidateQueries({ queryKey: ['propietarios'] });
    queryClient.invalidateQueries({ queryKey: ['propietarios-selector'] });
  };

  // Mutaciones
  const guardarMutation = useMutation({
    mutationFn: (dto: GuardarFincaDto) => {
      const propObj = propietarios.find((p) => Number(p.id) === Number(dto.propietarioId));
      const propNombre = propObj
        ? propObj.nombre || propObj.nombreCompleto || ''
        : (dto as any).propietario || (dto as any).propietarioNombre || '';
      
      const esDual = hasBufala && (dto.tipoLeche === 'AMBOS' || Boolean(dto.tieneDosTiposLeche));
      const esSoloBufala = hasBufala && dto.tipoLeche === 'BUFALA';

      const payload: any = {
        ...dto,
        propietario: propNombre,
        propietarioNombre: propNombre,
        rutaId: dto.activo === false ? undefined : dto.rutaId,
        tipoLeche: !hasBufala ? 'VACA' : (esDual ? 'AMBOS' : (esSoloBufala ? 'BUFALA' : 'VACA')),
        tieneDosTiposLeche: esDual,
        precioBufalaLitroUSD: (hasBufala && (esDual || esSoloBufala)) ? (dto.precioBufalaLitroUSD || 0.40) : 0,
      };
      return modoEdicionId ? catalogosApi.actualizarFinca(modoEdicionId, payload) : catalogosApi.crearFinca(payload);
    },
    onSuccess: (data: any) => {
      toast.success(data.message || 'Finca guardada exitosamente');
      invalidarCachesFincas();
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
      invalidarCachesFincas();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Error al desactivar finca');
    },
  });

  const precioMasivoMutation = useMutation({
    mutationFn: (precio: number) => catalogosApi.actualizarPreciosMasivo(precio),
    onSuccess: (data) => {
      toast.success(data.message || 'Precios actualizados en lote');
      invalidarCachesFincas();
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
    const propNameRaw = String((item as any).propietario || item.propietarioNombre || '').trim().toLowerCase();
    const matchedProp =
      propietarios.find((p) => Number(p.id) === Number(item.propietarioId)) ||
      (propNameRaw
        ? propietarios.find(
            (p) => String(p.nombre || p.nombreCompleto || '').trim().toLowerCase() === propNameRaw
          )
        : undefined);

    setForm({
      codigo: item.codigo,
      nombre: item.nombre,
      propietarioId: matchedProp ? matchedProp.id : item.propietarioId,
      rutaId: item.activo !== false ? item.rutaId : undefined,
      precioLitroUSD: item.precioLitroUSD || 0.35,
      precioLitroAcidaUSD: item.precioLitroAcidaUSD || 0.20,
      tieneDosTiposLeche: Boolean(item.tieneDosTiposLeche),
      precioBufalaLitroUSD: item.precioBufalaLitroUSD || 0.40,
      tipoLeche: item.tieneDosTiposLeche ? 'AMBOS' : (item.tipoLeche || 'VACA'),
      telefono: item.telefono || '',
      ubicacion: item.ubicacion || '',
      activo: item.activo !== false,
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
        <button
          type="button"
          onClick={async () => {
            const nuevoEstado = !row.activo;
            try {
              await catalogosApi.actualizarFinca(row.id, {
                codigo: row.codigo,
                nombre: row.nombre,
                propietarioId: row.propietarioId,
                rutaId: nuevoEstado ? row.rutaId : undefined,
                precioLitroUSD: row.precioLitroUSD || 0.35,
                precioLitroAcidaUSD: row.precioLitroAcidaUSD || 0.2,
                tieneDosTiposLeche: Boolean(row.tieneDosTiposLeche),
                precioBufalaLitroUSD: row.precioBufalaLitroUSD || 0.4,
                tipoLeche: row.tipoLeche || 'VACA',
                telefono: row.telefono || '',
                ubicacion: row.ubicacion || '',
                activo: nuevoEstado,
                ...( { propietario: (row as any).propietario || row.propietarioNombre || '' } as any ),
              });
              toast.success(
                nuevoEstado
                  ? `Finca "${row.nombre}" activada exitosamente`
                  : `Finca "${row.nombre}" marcada como INACTIVA (oculta en rutas y operaciones)`
              );
              invalidarCachesFincas();
            } catch {
              toast.error('No se pudo cambiar el estado de la finca');
            }
          }}
          title="Clic para cambiar entre Activo / Inactivo"
          className="badge"
          style={{
            background: row.activo ? '#ecfdf5' : '#fff1f2',
            color: row.activo ? '#047857' : '#e11d48',
            border: `1.5px solid ${row.activo ? '#a7f3d0' : '#fecdd3'}`,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            fontWeight: 800,
            padding: '4px 10px',
          }}
        >
          <i className={`fa-solid ${row.activo ? 'fa-circle-check' : 'fa-circle-xmark'}`}></i>
          {row.activo ? 'ACTIVO' : 'INACTIVO'}
        </button>
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

                {/* 3. Consulta de Tipo de Leche y Búfala (SOLO SI EL TENANT TIENE BÚFALA HABILITADA) */}
                {hasBufala ? (
                  <div
                    style={{
                      padding: '12px 14px',
                      background: '#f8fafc',
                      border: '1.5px solid #cbd5e1',
                      borderRadius: '10px',
                    }}
                  >
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#1e293b', marginBottom: '8px' }}>
                      <i className="fa-solid fa-gem" style={{ color: '#0d9488', marginRight: '6px' }}></i>
                      ¿Qué tipo de leche produce esta finca? *
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => {
                          setForm({ ...form, tipoLeche: 'VACA', tieneDosTiposLeche: false });
                        }}
                        style={{
                          padding: '8px 10px',
                          borderRadius: '8px',
                          border: form.tipoLeche === 'VACA' && !form.tieneDosTiposLeche ? '2px solid #2563eb' : '1px solid #cbd5e1',
                          background: form.tipoLeche === 'VACA' && !form.tieneDosTiposLeche ? '#eff6ff' : '#ffffff',
                          color: form.tipoLeche === 'VACA' && !form.tieneDosTiposLeche ? '#1d4ed8' : '#64748b',
                          fontWeight: 700,
                          fontSize: '12px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                        }}
                      >
                        🥛 Solo Vaca
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setForm({ ...form, tipoLeche: 'BUFALA', tieneDosTiposLeche: false });
                        }}
                        style={{
                          padding: '8px 10px',
                          borderRadius: '8px',
                          border: form.tipoLeche === 'BUFALA' && !form.tieneDosTiposLeche ? '2px solid #9333ea' : '1px solid #cbd5e1',
                          background: form.tipoLeche === 'BUFALA' && !form.tieneDosTiposLeche ? '#faf5ff' : '#ffffff',
                          color: form.tipoLeche === 'BUFALA' && !form.tieneDosTiposLeche ? '#7e22ce' : '#64748b',
                          fontWeight: 700,
                          fontSize: '12px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                        }}
                      >
                        🐃 Solo Búfala
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setForm({ ...form, tipoLeche: 'AMBOS', tieneDosTiposLeche: true });
                        }}
                        style={{
                          padding: '8px 10px',
                          borderRadius: '8px',
                          border: form.tieneDosTiposLeche || form.tipoLeche === 'AMBOS' ? '2px solid #0d9488' : '1px solid #cbd5e1',
                          background: form.tieneDosTiposLeche || form.tipoLeche === 'AMBOS' ? '#f0fdfa' : '#ffffff',
                          color: form.tieneDosTiposLeche || form.tipoLeche === 'AMBOS' ? '#0f766e' : '#64748b',
                          fontWeight: 700,
                          fontSize: '12px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                        }}
                      >
                        🥛+🐃 Dual (Ambas)
                      </button>
                    </div>
                  </div>
                ) : null}

                {/* 4. Grid de Precios adaptado al tipo de leche */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns:
                      hasBufala && (form.tieneDosTiposLeche || form.tipoLeche === 'AMBOS')
                        ? '1fr 1fr 1fr'
                        : '1fr 1fr',
                    gap: '12px',
                  }}
                >
                  {/* Precio Vaca (si es Vaca o Dual, o si no hay módulo búfala) */}
                  {(!hasBufala || form.tipoLeche !== 'BUFALA' || form.tieneDosTiposLeche) && (
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#1e293b', marginBottom: '4px' }}>
                        🥛 Precio Leche Vaca ($/Lt) *
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
                  )}

                  {/* Precio Búfala (si es Solo Búfala o Dual) */}
                  {hasBufala && (form.tipoLeche === 'BUFALA' || form.tieneDosTiposLeche || form.tipoLeche === 'AMBOS') && (
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#7e22ce', marginBottom: '4px' }}>
                        🐃 Precio Leche Búfala ($/Lt) *
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
                          color: '#7e22ce',
                          background: '#faf5ff',
                          border: '1.5px solid #d8b4fe',
                        }}
                        required
                      />
                    </div>
                  )}

                  {/* Precio Leche Ácida */}
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#b45309', marginBottom: '4px' }}>
                      <i className="fa-solid fa-flask" style={{ color: '#d97706', marginRight: '4px' }}></i>
                      Precio Leche Ácida ($/Lt)
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

                {/* 6. Estado Activo / Inactivo de la Finca */}
                <div
                  style={{
                    padding: '10px 14px',
                    background: form.activo !== false ? '#f0fdf4' : '#fff1f2',
                    border: `1.5px solid ${form.activo !== false ? '#86efac' : '#fecdd3'}`,
                    borderRadius: '8px',
                  }}
                >
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      cursor: 'pointer',
                      color: form.activo !== false ? '#065f46' : '#9f1239',
                      fontSize: '13.5px',
                      fontWeight: 700,
                      margin: 0,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={form.activo !== false}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          activo: e.target.checked,
                          rutaId: e.target.checked ? form.rutaId : undefined,
                        })
                      }
                      style={{
                        width: '18px',
                        height: '18px',
                        accentColor: form.activo !== false ? '#059669' : '#e11d48',
                        cursor: 'pointer',
                      }}
                    />
                    <span>
                      <i
                        className={`fa-solid ${form.activo !== false ? 'fa-circle-check' : 'fa-ban'}`}
                        style={{ marginRight: '6px' }}
                      ></i>
                      {form.activo !== false
                        ? 'Finca Activa para Recolecciones (Visible en todo el sistema)'
                        : 'Finca Inactiva (Solo visible en catálogo de Fincas, sin ruta asociada)'}
                    </span>
                  </label>
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
