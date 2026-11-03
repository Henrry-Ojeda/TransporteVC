import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
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
      if (modoEdicionId) {
        return await operacionesApi.actualizarRutaLogistica(modoEdicionId, dto);
      }
      return await operacionesApi.crearRutaLogistica(dto);
    },
    onSuccess: (data: any) => {
      toast.success(data.message || 'Ruta guardada');
      queryClient.invalidateQueries({ queryKey: ['rutas-logistica'] });
      cerrarModal();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Error al guardar ruta');
    },
  });

  const eliminarMutation = useMutation({
    mutationFn: (id: number) => operacionesApi.eliminarRutaLogistica(id),
    onSuccess: (data) => {
      toast.success(data.message || 'Ruta eliminada');
      queryClient.invalidateQueries({ queryKey: ['rutas-logistica'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Error al eliminar');
    },
  });

  const asignarFincasMutation = useMutation({
    mutationFn: ({ rutaId, ids }: { rutaId: number; ids: number[] }) =>
      operacionesApi.asignarFincasARuta(rutaId, ids),
    onSuccess: (data) => {
      toast.success(data.message || 'Fincas asignadas a la ruta');
      queryClient.invalidateQueries({ queryKey: ['rutas-logistica'] });
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

  const abrirModalEditar = (item: RutaLogisticaDto) => {
    setModoEdicionId(item.id);
    setForm({
      nombre: item.nombre,
      descripcion: item.descripcion || '',
      camionPredeterminadoId: item.camionPredeterminadoId,
      choferPredeterminadoId: item.choferPredeterminadoId,
    });
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
            onClick={() => {
              if (window.confirm(`¿Eliminar la ruta "${row.nombre}"?`)) {
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

      {/* Modal Crear / Editar */}
      {modalAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div className="flex items-center gap-2">
                <RouteIcon className="w-5 h-5 text-blue-600" />
                <h3 className="font-semibold text-gray-800">
                  {modoEdicionId ? 'Editar Ruta' : 'Crear Nueva Ruta'}
                </h3>
              </div>
              <button
                onClick={cerrarModal}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!form.nombre.trim()) {
                  toast.error('El nombre de la ruta es obligatorio');
                  return;
                }
                guardarMutation.mutate(form);
              }}
              className="p-6 space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Nombre de la Ruta <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  placeholder="Ej: Ruta 1 - El Palmar / Atarigua"
                  className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Descripción / Notas</label>
                <input
                  type="text"
                  value={form.descripcion}
                  onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                  placeholder="Circuito matutino"
                  className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Camión Predeterminado
                  </label>
                  <select
                    value={form.camionPredeterminadoId ?? ''}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        camionPredeterminadoId: e.target.value ? Number(e.target.value) : undefined,
                      })
                    }
                    className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Sin asignar</option>
                    {camiones.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.placa} ({c.marca})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Chofer Predeterminado
                  </label>
                  <select
                    value={form.choferPredeterminadoId ?? ''}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        choferPredeterminadoId: e.target.value ? Number(e.target.value) : undefined,
                      })
                    }
                    className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Sin asignar</option>
                    {choferes.map((ch) => (
                      <option key={ch.id} value={ch.id}>
                        {ch.nombreCompleto}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={cerrarModal}
                  className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardarMutation.isPending}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {guardarMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  {modoEdicionId ? 'Guardar Cambios' : 'Crear Ruta'}
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
