import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Swal from 'sweetalert2';
import { confirmDeleteOrDeactivate } from '@/lib/sweetalert';
import { CamionSelect, ChoferSelect } from '@/components/selectors';
import {
  Route as RouteIcon,
  PlusCircle,
  Truck,
  User,
  Landmark,
  Edit2,
  Trash2,
  X,
  Loader2,
  CheckCircle2,
  Layers,
  Search,
} from 'lucide-react';
import { operacionesApi } from '@/api/operaciones.api';
import { catalogosApi } from '@/api/catalogos.api';
import { DataTable, type ColumnDef } from '@/components/common/DataTable';
import type { RutaLogisticaDto, CamionDto, ChoferDto, FincaDto } from '@/types';

export const RutasLogisticaPage: React.FC = () => {
  const queryClient = useQueryClient();

  const [modalAbierto, setModalAbierto] = useState(false);
  const [modalAsignarFincas, setModalAsignarFincas] = useState(false);
  const [rutaSeleccionada, setRutaSeleccionada] = useState<RutaLogisticaDto | null>(null);
  const [fincasSeleccionadas, setFincasSeleccionadas] = useState<number[]>([]);
  const [busquedaFincasModal, setBusquedaFincasModal] = useState('');
  const [modoEdicionId, setModoEdicionId] = useState<number | null>(null);

  const initialForm = {
    nombre: '',
    descripcion: '',
    camionPredeterminadoId: undefined as number | undefined,
    choferPredeterminadoId: undefined as number | undefined,
  };
  const [form, setForm] = useState(initialForm);

  // Queries
  const { data: rutas = [], isLoading } = useQuery<RutaLogisticaDto[]>({
    queryKey: ['rutas-logistica'],
    queryFn: () => operacionesApi.getRutasLogistica(),
  });

  const { data: camiones = [] } = useQuery<CamionDto[]>({
    queryKey: ['camiones'],
    queryFn: () => catalogosApi.getCamiones(true),
  });

  const { data: choferes = [] } = useQuery<ChoferDto[]>({
    queryKey: ['choferes'],
    queryFn: () => catalogosApi.getChoferes(),
  });

  const { data: fincas = [] } = useQuery<FincaDto[]>({
    queryKey: ['fincas'],
    queryFn: () => catalogosApi.getFincas(true),
  });

  // Mutaciones
  const guardarMutation = useMutation({
    mutationFn: async (dto: typeof initialForm) => {
      let rId = modoEdicionId;
      if (modoEdicionId) {
        await operacionesApi.actualizarRutaLogistica(modoEdicionId, dto);
      } else {
        const res = await operacionesApi.crearRutaLogistica(dto);
        rId = res.id;
      }
      if (rId && fincasSeleccionadas.length > 0) {
        await operacionesApi.asignarFincasARuta(rId, fincasSeleccionadas);
      }
      return { id: rId };
    },
    onSuccess: () => {
      Swal.fire({
        icon: 'success',
        title: modoEdicionId ? '¡Ruta Actualizada!' : '¡Ruta Creada!',
        text: `La ruta logística y sus ${fincasSeleccionadas.length} fincas asociadas se han guardado con éxito.`,
        confirmButtonColor: '#2563eb',
      });
      queryClient.invalidateQueries({ queryKey: ['rutas-logistica'] });
      queryClient.invalidateQueries({ queryKey: ['fincas'] });
      cerrarModal();
    },
    onError: (err: any) => {
      Swal.fire({
        icon: 'error',
        title: 'Error al Guardar Ruta',
        text: err.response?.data?.message || 'Error al guardar ruta',
        confirmButtonColor: '#ef4444',
      });
    },
  });

  const eliminarMutation = useMutation({
    mutationFn: (id: number) => operacionesApi.eliminarRutaLogistica(id),
    onSuccess: (data) => {
      Swal.fire({
        icon: 'success',
        title: 'Ruta Eliminada',
        text: (data as any)?.message || 'Ruta logística eliminada exitosamente',
        confirmButtonColor: '#2563eb',
      });
      queryClient.invalidateQueries({ queryKey: ['rutas-logistica'] });
      queryClient.invalidateQueries({ queryKey: ['fincas'] });
    },
    onError: (err: any) => {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: err.response?.data?.message || 'Error al eliminar',
        confirmButtonColor: '#ef4444',
      });
    },
  });

  const asignarFincasMutation = useMutation({
    mutationFn: ({ rutaId, ids }: { rutaId: number; ids: number[] }) =>
      operacionesApi.asignarFincasARuta(rutaId, ids),
    onSuccess: (data) => {
      Swal.fire({
        icon: 'success',
        title: 'Fincas Asignadas',
        text: (data as any)?.message || 'Fincas asignadas a la ruta exitosamente',
        confirmButtonColor: '#2563eb',
      });
      queryClient.invalidateQueries({ queryKey: ['rutas-logistica'] });
      queryClient.invalidateQueries({ queryKey: ['fincas'] });
      setModalAsignarFincas(false);
    },
    onError: (err: any) => {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: err.response?.data?.message || 'Error al asignar fincas',
        confirmButtonColor: '#ef4444',
      });
    },
  });

  const abrirModalCrear = () => {
    setModoEdicionId(null);
    setForm(initialForm);
    setFincasSeleccionadas([]);
    setBusquedaFincasModal('');
    setModalAbierto(true);
  };

  const abrirModalEditar = (item: RutaLogisticaDto) => {
    setModoEdicionId(item.id);
    setForm({
      nombre: item.nombre,
      descripcion: item.descripcion || '',
      camionPredeterminadoId: item.camionPredeterminadoId,
      choferPredeterminadoId: item.choferPredeterminadoId,
    });
    const fincasDeRuta = fincas.filter((f) => f.rutaId === item.id).map((f) => f.id);
    setFincasSeleccionadas(fincasDeRuta);
    setBusquedaFincasModal('');
    setModalAbierto(true);
  };

  const abrirModalAsignar = (item: RutaLogisticaDto) => {
    setRutaSeleccionada(item);
    const fincasDeRuta = fincas.filter((f) => f.rutaId === item.id).map((f) => f.id);
    setFincasSeleccionadas(fincasDeRuta);
    setModalAsignarFincas(true);
  };

  const cerrarModal = () => {
    setModalAbierto(false);
    setModoEdicionId(null);
    setFincasSeleccionadas([]);
    setBusquedaFincasModal('');
  };

  const columns: ColumnDef<RutaLogisticaDto>[] = [
    {
      header: 'Nombre de Ruta',
      accessorKey: 'nombre',
      sortable: true,
      cell: (row) => (
        <div>
          <div className="font-semibold text-gray-900">{row.nombre}</div>
          <div className="text-xs text-gray-400">{row.descripcion || 'Sin descripción'}</div>
        </div>
      ),
    },
    {
      header: 'Unidad Habitual',
      cell: (row) => (
        <div className="flex items-center gap-1.5 text-xs text-gray-700">
          <Truck className="w-3.5 h-3.5 text-gray-400" />
          <span>{row.camionPlaca || 'Sin asignar'}</span>
        </div>
      ),
    },
    {
      header: 'Chofer Habitual',
      cell: (row) => (
        <div className="flex items-center gap-1.5 text-xs text-gray-700">
          <User className="w-3.5 h-3.5 text-gray-400" />
          <span>{row.choferNombre || 'Sin asignar'}</span>
        </div>
      ),
    },
    {
      header: 'Fincas en Circuito',
      cell: (row) => {
        const count = fincas.filter((f) => f.rutaId === row.id).length;
        return (
          <button
            onClick={() => abrirModalAsignar(row)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors cursor-pointer"
          >
            <Landmark className="w-3 h-3" />
            {count} fincas asignadas
          </button>
        );
      },
    },
    {
      header: 'Acciones',
      className: 'text-right',
      cell: (row) => (
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={() => abrirModalEditar(row)}
            className="p-1 text-gray-400 hover:text-blue-600 rounded transition-colors cursor-pointer"
            title="Editar Ruta"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={async () => {
              if (await confirmDeleteOrDeactivate('Eliminar la ruta logística', row.nombre)) {
                eliminarMutation.mutate(row.id);
              }
            }}
            className="p-1 text-gray-400 hover:text-red-600 rounded transition-colors cursor-pointer"
            title="Eliminar"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Recolección en Ruta</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
              Circuitos de Transporte
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Definición de rutas fijas de recolección de leche, asignación de fincas asociadas y vehículos de carga.
          </p>
        </div>

        <button
          onClick={abrirModalCrear}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition-colors shadow-sm cursor-pointer"
        >
          <PlusCircle className="w-4 h-4" />
          Nueva Ruta
        </button>
      </div>

      {/* Tabla */}
      <DataTable
        data={rutas}
        columns={columns}
        isLoading={isLoading}
        searchPlaceholder="Buscar por nombre de ruta o camión..."
        exportFileName="rutas_recoleccion"
        searchFilter={(row, term) =>
          Boolean(
            row.nombre.toLowerCase().includes(term) ||
            (row.camionPlaca && row.camionPlaca.toLowerCase().includes(term))
          )
        }
      />

      {/* Modal Crear / Editar con Fincas Integradas y Diseño Ejecutivo */}
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
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
          }}
        >
          <div
            className="content-card"
            style={{
              width: '100%',
              maxWidth: '820px',
              padding: '0',
              overflow: 'visible',
              borderRadius: '16px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              backgroundColor: '#ffffff',
            }}
          >
            {/* Header del Modal */}
            <div
              style={{
                padding: '18px 24px',
                background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                color: '#ffffff',
                borderTopLeftRadius: '16px',
                borderTopRightRadius: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <RouteIcon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#ffffff' }}>
                    {modoEdicionId ? 'Editar Ruta Logística' : 'Planificar Nueva Ruta de Recolección'}
                  </h3>
                  <span style={{ fontSize: '12px', color: '#bfdbfe' }}>
                    Asignación de unidad de transporte, chofer y circuito de fincas ganaderas
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={cerrarModal}
                style={{ background: 'transparent', border: 'none', color: '#ffffff', cursor: 'pointer', fontSize: '20px', padding: '4px' }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!form.nombre.trim()) {
                  Swal.fire({ icon: 'warning', title: 'Campo Requerido', text: 'El nombre de la ruta es obligatorio', confirmButtonColor: '#2563eb' });
                  return;
                }
                guardarMutation.mutate(form);
              }}
              style={{ padding: '24px' }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', alignItems: 'start' }}>
                {/* Columna Izquierda: Datos de Ruta y Transporte */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                      Nombre de la Ruta <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="text"
                      value={form.nombre}
                      onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                      placeholder="Ej: Ruta 1 - El Palmar / Atarigua"
                      className="form-input"
                      style={{ width: '100%', height: '38px' }}
                      required
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                      Descripción / Circuito Operativo
                    </label>
                    <input
                      type="text"
                      value={form.descripcion}
                      onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                      placeholder="Ej: Turno matutino, circuito de tanques de frío"
                      className="form-input"
                      style={{ width: '100%', height: '38px' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                      Camión Cisterna Asignado
                    </label>
                    <CamionSelect
                      value={form.camionPredeterminadoId}
                      onChange={(id, camion) => {
                        setForm({
                          ...form,
                          camionPredeterminadoId: id || undefined,
                          choferPredeterminadoId: camion?.usuarioId || form.choferPredeterminadoId,
                        });
                      }}
                      placeholder="-- Seleccionar camión cisterna --"
                      allowClear
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                      Chofer Habitual de Ruta
                    </label>
                    <ChoferSelect
                      value={form.choferPredeterminadoId}
                      onChange={(id) => {
                        const camMatch = camiones.find((c) => c.usuarioId === id);
                        setForm({
                          ...form,
                          choferPredeterminadoId: id || undefined,
                          camionPredeterminadoId: form.camionPredeterminadoId || camMatch?.id,
                        });
                      }}
                      placeholder="-- Seleccionar o buscar chofer --"
                      allowClear
                    />
                  </div>
                </div>

                {/* Columna Derecha: Fincas Ganaderas Asignadas a esta Ruta */}
                <div style={{ background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ fontSize: '12.5px', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Landmark className="w-4 h-4 text-emerald-600" />
                      Fincas Ganaderas en Ruta
                    </div>
                    <span style={{ fontSize: '11px', fontWeight: 800, background: '#ecfdf5', color: '#059669', padding: '2px 8px', borderRadius: '6px', border: '1px solid #a7f3d0' }}>
                      {fincasSeleccionadas.length} {fincasSeleccionadas.length === 1 ? 'finca' : 'fincas'}
                    </span>
                  </div>
                  <p style={{ fontSize: '11.5px', color: '#64748b', margin: '0 0 10px 0' }}>
                    Selecciona las fincas que integran el recorrido logístico:
                  </p>

                  {/* Buscador rápido de fincas dentro del modal */}
                  <div style={{ position: 'relative', marginBottom: '10px' }}>
                    <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={busquedaFincasModal}
                      onChange={(e) => setBusquedaFincasModal(e.target.value)}
                      placeholder="Filtrar fincas..."
                      style={{
                        width: '100%',
                        padding: '6px 10px 6px 30px',
                        fontSize: '12px',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        outline: 'none',
                      }}
                    />
                  </div>

                  <div style={{ maxHeight: '220px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', paddingRight: '4px' }}>
                    {fincas
                      .filter((f) => {
                        if (!busquedaFincasModal.trim()) return true;
                        const term = busquedaFincasModal.toLowerCase();
                        return (
                          (f.nombre || '').toLowerCase().includes(term) ||
                          (f.propietarioNombre || '').toLowerCase().includes(term)
                        );
                      })
                      .map((f) => {
                        const check = fincasSeleccionadas.includes(f.id);
                        return (
                          <label
                            key={f.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px',
                              padding: '8px 10px',
                              backgroundColor: check ? '#eff6ff' : '#ffffff',
                              border: `1px solid ${check ? '#bfdbfe' : '#e2e8f0'}`,
                              borderRadius: '8px',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={check}
                              onChange={() => {
                                if (check) {
                                  setFincasSeleccionadas(fincasSeleccionadas.filter((id) => id !== f.id));
                                } else {
                                  setFincasSeleccionadas([...fincasSeleccionadas, f.id]);
                                }
                              }}
                              style={{ width: '15px', height: '15px', cursor: 'pointer' }}
                            />
                            <div style={{ flex: 1, overflow: 'hidden' }}>
                              <div style={{ fontSize: '12px', fontWeight: check ? 700 : 600, color: check ? '#1d4ed8' : '#1e293b' }}>
                                {f.nombre}
                              </div>
                              <div style={{ fontSize: '10.5px', color: '#64748b' }}>
                                {f.propietarioNombre || 'Sin propietario'}
                              </div>
                            </div>
                          </label>
                        );
                      })}
                  </div>
                </div>
              </div>

              <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={cerrarModal}
                  className="btn btn-outline"
                  style={{ height: '38px', padding: '0 18px', fontWeight: 600 }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardarMutation.isPending}
                  className="btn btn-primary"
                  style={{
                    height: '38px',
                    padding: '0 22px',
                    fontWeight: 700,
                    background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                    border: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  {guardarMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  {modoEdicionId ? 'Guardar Cambios de Ruta' : 'Crear Ruta Planificada'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Asignar Fincas a Ruta */}
      {modalAsignarFincas && rutaSeleccionada && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-blue-600" />
                <h3 className="font-semibold text-gray-800">
                  Fincas en {rutaSeleccionada.nombre}
                </h3>
              </div>
              <button
                onClick={() => setModalAsignarFincas(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-gray-500">
                Marca las fincas lecheras que componen este circuito de recolección:
              </p>

              <div className="max-h-60 overflow-y-auto space-y-2 border border-gray-100 p-3 rounded-lg bg-gray-50/50">
                {fincas.map((f) => {
                  const check = fincasSeleccionadas.includes(f.id);
                  return (
                    <label
                      key={f.id}
                      className="flex items-center gap-3 p-2 bg-white rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={check}
                        onChange={() => {
                          if (check) {
                            setFincasSeleccionadas(fincasSeleccionadas.filter((id) => id !== f.id));
                          } else {
                            setFincasSeleccionadas([...fincasSeleccionadas, f.id]);
                          }
                        }}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                      />
                      <div className="flex-1 text-xs">
                        <div className="font-semibold text-gray-800">{f.nombre}</div>
                        <div className="text-gray-400">{f.propietarioNombre || 'Independiente'}</div>
                      </div>
                    </label>
                  );
                })}
              </div>

              <div className="pt-4 border-t border-gray-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setModalAsignarFincas(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() =>
                    asignarFincasMutation.mutate({
                      rutaId: rutaSeleccionada.id,
                      ids: fincasSeleccionadas,
                    })
                  }
                  disabled={asignarFincasMutation.isPending}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {asignarFincasMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  Guardar Fincas en Ruta
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
