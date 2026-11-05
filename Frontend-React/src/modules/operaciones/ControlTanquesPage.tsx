import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import Swal from 'sweetalert2';
import {
  Printer,
  Save,
  RotateCcw,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Truck,
  Lock,
  ShieldCheck,
  Check,
} from 'lucide-react';
import { catalogosApi } from '@/api/catalogos.api';
import { operacionesApi } from '@/api/operaciones.api';
import { useAuth } from '@/hooks/useAuth';
import type { ChoferDto, ControlTanquesDiarioDto } from '@/types';

interface FilaRecepcionTanque {
  id: number;
  fecha: string;
  choferRuta: string;
  litrosRuta: number;
  litrosRecepcion: number;
  diferencia: number;
}

const emptyFilas = (): FilaRecepcionTanque[] =>
  Array.from({ length: 15 }, (_, i) => ({
    id: i + 1,
    fecha: '',
    choferRuta: '',
    litrosRuta: 0,
    litrosRecepcion: 0,
    diferencia: 0,
  }));

export const ControlTanquesPage: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [fechaDocumento, setFechaDocumento] = useState(() => new Date().toISOString().split('T')[0]);

  // Tanques Iniciales (1 al 5)
  const [tanquesIniciales, setTanquesIniciales] = useState({
    t1: 0,
    t2: 0,
    t3: 0,
    t4: 0,
    t5: 0,
  });

  // Tanques Finales (1 al 5)
  const [tanquesFinales, setTanquesFinales] = useState({
    t1: 0,
    t2: 0,
    t3: 0,
    t4: 0,
    t5: 0,
  });

  // Total Despachado a Plantas / Cisternas
  const [totalDespachado, setTotalDespachado] = useState<number>(0);

  // 15 Registros de recepción
  const [filasRecepcion, setFilasRecepcion] = useState<FilaRecepcionTanque[]>(emptyFilas);

  // Consulta del registro diario del backend
  const {
    data: controlTanques,
    isLoading,
    refetch,
  } = useQuery<ControlTanquesDiarioDto | null>({
    queryKey: ['control-tanques-diario', fechaDocumento],
    queryFn: () => operacionesApi.getControlTanquesDiario(fechaDocumento),
  });

  const { data: choferes = [] } = useQuery<ChoferDto[]>({
    queryKey: ['choferes-tanques'],
    queryFn: () => catalogosApi.getChoferes(),
  });

  const { data: empresaConfig } = useQuery({
    queryKey: ['empresa-config'],
    queryFn: () => catalogosApi.getEmpresaConfig(),
  });

  const { data: viajesDelDia = [] } = useQuery({
    queryKey: ['viajes-dia-tanques', fechaDocumento],
    queryFn: () => operacionesApi.getControles(fechaDocumento),
  });

  const autoLlenarFilasConViajes = (viajes: any[]) => {
    if (!viajes || viajes.length === 0) return emptyFilas();
    const rows: FilaRecepcionTanque[] = [];
    for (let i = 0; i < 15; i++) {
      if (i < viajes.length) {
        const v = viajes[i];
        const lRuta = Number(v.totalLitrosFinca ?? v.totalLitrosRecogidos ?? 0);
        const lRecep = Number(v.litrosRecibidosReceptoria ?? v.totalLitrosReceptoria ?? v.totalLitrosEntregados ?? lRuta);
        rows.push({
          id: i + 1,
          fecha: v.fecha ? new Date(v.fecha).toISOString().split('T')[0] : fechaDocumento,
          choferRuta: `${v.choferNombre || v.nombreConductor || 'Chofer'} / ${v.rutaNombre || v.rutaLogisticaNombre || 'Ruta'}`,
          litrosRuta: lRuta,
          litrosRecepcion: lRecep,
          diferencia: lRuta - lRecep,
        });
      } else {
        rows.push({
          id: i + 1,
          fecha: '',
          choferRuta: '',
          litrosRuta: 0,
          litrosRecepcion: 0,
          diferencia: 0,
        });
      }
    }
    return rows;
  };

  // Verificar si el usuario puede modificar
  // Regla: si no es admin y (está cerrado o fecha < hoy), puedeModificar viene false
  const puedeModificar = useMemo(() => {
    if (isAdmin) return true;
    if (controlTanques?.puedeModificar === false) return false;
    if (controlTanques?.cierreConfirmado) return false;
    return true;
  }, [isAdmin, controlTanques]);

  const esSupervisorOAdmin = useMemo(() => {
    const rol = (user?.rol || '').toUpperCase();
    return rol === 'ADMIN' || rol === 'ADMINISTRADOR' || rol === 'SUPERVISOR';
  }, [user]);

  // Cargar datos recibidos de backend
  useEffect(() => {
    if (controlTanques) {
      setTanquesIniciales({
        t1: controlTanques.tanque1Inicial || 0,
        t2: controlTanques.tanque2Inicial || 0,
        t3: controlTanques.tanque3Inicial || 0,
        t4: controlTanques.tanque4Inicial || 0,
        t5: controlTanques.tanque5Inicial || 0,
      });

      // Si todos son 0 pero viene total inicial calculado de arrastre
      if (
        !controlTanques.tanque1Inicial &&
        !controlTanques.tanque2Inicial &&
        !controlTanques.tanque3Inicial &&
        !controlTanques.tanque4Inicial &&
        !controlTanques.tanque5Inicial &&
        controlTanques.totalInicialLitros > 0
      ) {
        setTanquesIniciales((prev) => ({ ...prev, t1: controlTanques.totalInicialLitros }));
      }

      setTanquesFinales({
        t1: controlTanques.tanque1Final || 0,
        t2: controlTanques.tanque2Final || 0,
        t3: controlTanques.tanque3Final || 0,
        t4: controlTanques.tanque4Final || 0,
        t5: controlTanques.tanque5Final || 0,
      });

      setTotalDespachado(controlTanques.totalSalidasPlantasLitros || 0);

      if (controlTanques.filasRecepcionJson) {
        try {
          const parsed = JSON.parse(controlTanques.filasRecepcionJson);
          if (Array.isArray(parsed) && parsed.length > 0 && parsed.some((p: any) => p.litrosRuta > 0 || p.litrosRecepcion > 0 || p.choferRuta)) {
            const padded = [...parsed];
            while (padded.length < 15) {
              padded.push({
                id: padded.length + 1,
                fecha: '',
                choferRuta: '',
                litrosRuta: 0,
                litrosRecepcion: 0,
                diferencia: 0,
              });
            }
            setFilasRecepcion(padded);
          } else if (viajesDelDia.length > 0) {
            setFilasRecepcion(autoLlenarFilasConViajes(viajesDelDia));
          } else {
            setFilasRecepcion(emptyFilas());
          }
        } catch {
          if (viajesDelDia.length > 0) {
            setFilasRecepcion(autoLlenarFilasConViajes(viajesDelDia));
          } else {
            setFilasRecepcion(emptyFilas());
          }
        }
      } else if (viajesDelDia.length > 0) {
        setFilasRecepcion(autoLlenarFilasConViajes(viajesDelDia));
      } else {
        setFilasRecepcion(emptyFilas());
      }
    } else if (viajesDelDia.length > 0) {
      setFilasRecepcion(autoLlenarFilasConViajes(viajesDelDia));
    } else {
      setFilasRecepcion(emptyFilas());
    }
  }, [controlTanques, viajesDelDia]);

  // Cálculos automáticos
  const totalTanquesIniciales = useMemo(() => {
    return (
      Number(tanquesIniciales.t1 || 0) +
      Number(tanquesIniciales.t2 || 0) +
      Number(tanquesIniciales.t3 || 0) +
      Number(tanquesIniciales.t4 || 0) +
      Number(tanquesIniciales.t5 || 0)
    );
  }, [tanquesIniciales]);

  const totalTanquesFinales = useMemo(() => {
    return (
      Number(tanquesFinales.t1 || 0) +
      Number(tanquesFinales.t2 || 0) +
      Number(tanquesFinales.t3 || 0) +
      Number(tanquesFinales.t4 || 0) +
      Number(tanquesFinales.t5 || 0)
    );
  }, [tanquesFinales]);

  const totalLitrosRuta = useMemo(() => {
    return filasRecepcion.reduce((acc, f) => acc + (Number(f.litrosRuta) || 0), 0);
  }, [filasRecepcion]);

  const totalLitrosRecepcion = useMemo(() => {
    return filasRecepcion.reduce((acc, f) => acc + (Number(f.litrosRecepcion) || 0), 0);
  }, [filasRecepcion]);

  const totalDiferenciaRecepcion = useMemo(() => {
    return totalLitrosRecepcion - totalLitrosRuta;
  }, [totalLitrosRecepcion, totalLitrosRuta]);

  // Balance Silo: Iniciales + Recibido - Despachado
  const volumenTeoricoFinal = useMemo(() => {
    return totalTanquesIniciales + totalLitrosRecepcion - (Number(totalDespachado) || 0);
  }, [totalTanquesIniciales, totalLitrosRecepcion, totalDespachado]);

  const mermaSilo = useMemo(() => {
    return totalTanquesFinales - volumenTeoricoFinal;
  }, [totalTanquesFinales, volumenTeoricoFinal]);

  // Manejo de cambio en fila de recepción
  const handleFilaChange = (index: number, field: keyof FilaRecepcionTanque, value: any) => {
    if (!puedeModificar) return;
    const updated = [...filasRecepcion];
    const item = { ...updated[index], [field]: value };
    if (field === 'litrosRuta' || field === 'litrosRecepcion') {
      const ruta = Number(field === 'litrosRuta' ? value : item.litrosRuta) || 0;
      const rec = Number(field === 'litrosRecepcion' ? value : item.litrosRecepcion) || 0;
      item.diferencia = rec - ruta;
    }
    updated[index] = item;
    setFilasRecepcion(updated);
  };

  // Mutación Guardar
  const guardarMutation = useMutation({
    mutationFn: async () => {
      const payload: ControlTanquesDiarioDto = {
        fecha: fechaDocumento,
        tanque1Inicial: Number(tanquesIniciales.t1) || 0,
        tanque2Inicial: Number(tanquesIniciales.t2) || 0,
        tanque3Inicial: Number(tanquesIniciales.t3) || 0,
        tanque4Inicial: Number(tanquesIniciales.t4) || 0,
        tanque5Inicial: Number(tanquesIniciales.t5) || 0,
        totalInicialLitros: totalTanquesIniciales,
        aperturaConfirmada: controlTanques?.aperturaConfirmada || false,
        totalEntradasRutasLitros: totalLitrosRecepcion,
        totalSalidasPlantasLitros: Number(totalDespachado) || 0,
        tanque1Final: Number(tanquesFinales.t1) || 0,
        tanque2Final: Number(tanquesFinales.t2) || 0,
        tanque3Final: Number(tanquesFinales.t3) || 0,
        tanque4Final: Number(tanquesFinales.t4) || 0,
        tanque5Final: Number(tanquesFinales.t5) || 0,
        totalFinalFisicoLitros: totalTanquesFinales,
        totalTeoricoLitros: volumenTeoricoFinal,
        diferenciaMermaLitros: mermaSilo,
        cierreConfirmado: controlTanques?.cierreConfirmado || false,
        filasRecepcionJson: JSON.stringify(filasRecepcion),
      };
      return await operacionesApi.guardarControlTanquesDiario(payload);
    },
    onSuccess: (res) => {
      toast.success(res.message || 'Control diario guardado correctamente');
      queryClient.invalidateQueries({ queryKey: ['control-tanques-diario'] });
      queryClient.invalidateQueries({ queryKey: ['balance-receptoria'] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Error al guardar control de tanques');
    },
  });

  // Mutación Confirmar Apertura
  const confirmarAperturaMutation = useMutation({
    mutationFn: async () => {
      // Guardar primero para que persistan los tanques iniciales actuales
      await guardarMutation.mutateAsync();
      return await operacionesApi.confirmarAperturaTanques(fechaDocumento);
    },
    onSuccess: (res) => {
      Swal.fire({
        title: '¡Apertura Confirmada!',
        text: res.message || 'Litros de apertura validados y sincronizados con el Balance de Receptoría.',
        icon: 'success',
        confirmButtonColor: '#1d4ed8',
      });
      queryClient.invalidateQueries({ queryKey: ['control-tanques-diario'] });
      queryClient.invalidateQueries({ queryKey: ['balance-receptoria'] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Error al confirmar apertura');
    },
  });

  // Mutación Confirmar Cierre
  const confirmarCierreMutation = useMutation({
    mutationFn: async () => {
      // Guardar primero para que persistan los tanques finales actuales
      await guardarMutation.mutateAsync();
      return await operacionesApi.confirmarCierreTanques(fechaDocumento);
    },
    onSuccess: (res) => {
      Swal.fire({
        title: '¡Cierre Diario Confirmado!',
        text: res.message || 'El formulario queda cerrado. Solo el Administrador podrá modificar datos a partir de este momento.',
        icon: 'success',
        confirmButtonColor: '#1d4ed8',
      });
      queryClient.invalidateQueries({ queryKey: ['control-tanques-diario'] });
      queryClient.invalidateQueries({ queryKey: ['balance-receptoria'] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Error al confirmar cierre');
    },
  });

  const handleConfirmarApertura = async () => {
    const res = await Swal.fire({
      title: '¿Confirmar Apertura del Día?',
      html: `
        <div class="text-left text-xs text-gray-600 space-y-2">
          <p>Total Litros Iniciales: <strong>${totalTanquesIniciales.toLocaleString()} Lts</strong></p>
          <p>Al confirmar, este valor quedará registrado como el aforo oficial de apertura del día y alimentará el balance de receptoría.</p>
        </div>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, Validar y Confirmar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#1d4ed8',
    });
    if (res.isConfirmed) {
      confirmarAperturaMutation.mutate();
    }
  };

  const handleConfirmarCierre = async () => {
    const res = await Swal.fire({
      title: '¿Confirmar Cierre Diario de Tanques?',
      html: `
        <div class="text-left text-xs text-gray-600 space-y-2">
          <p>Total Físico en Silos: <strong>${totalTanquesFinales.toLocaleString()} Lts</strong></p>
          <p>Volumen Teórico: <strong>${volumenTeoricoFinal.toLocaleString()} Lts</strong></p>
          <p>Merma Silo: <strong class="${mermaSilo < 0 ? 'text-red-600' : 'text-emerald-600'}">${mermaSilo.toLocaleString()} Lts</strong></p>
          <p class="text-red-600 font-bold mt-2">ATENCIÓN: De aquí en adelante los datos quedarán bloqueados para edición. Solo un Administrador podrá desbloquearlos.</p>
        </div>
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, Confirmar y Bloquear Día',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#b91c1c',
    });
    if (res.isConfirmed) {
      confirmarCierreMutation.mutate();
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleLimpiar = async () => {
    if (!puedeModificar) {
      toast.error('Este registro está confirmado y bloqueado. Solo el Administrador puede editarlo.');
      return;
    }
    const res = await Swal.fire({
      title: '¿Limpiar formulario?',
      text: 'Se reiniciarán los valores cargados en los tanques y recepciones para esta fecha.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, reiniciar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#2563eb',
    });
    if (res.isConfirmed) {
      setTanquesIniciales({ t1: 0, t2: 0, t3: 0, t4: 0, t5: 0 });
      setTanquesFinales({ t1: 0, t2: 0, t3: 0, t4: 0, t5: 0 });
      setTotalDespachado(0);
      setFilasRecepcion(emptyFilas());
      toast.success('Formulario reiniciado');
    }
  };

  return (
    <div className="space-y-6">
      {/* BARRA DE ACCIONES SUPERIOR (Se oculta al imprimir) */}
      <div className="actions-bar print:hidden flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4 p-4 bg-white rounded-2xl shadow-sm border border-gray-200">
        <div>
          <h2 className="text-lg font-bold text-blue-900 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-600" />
            Control Diario de Tanques y Recepción de Leche
          </h2>
          <p className="text-xs text-gray-500">
            Formulario operativo de aforos de silos 1 al 5, balance de entradas de rutas y mermas diarias
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-gray-700">Fecha Operativa:</label>
            <input
              type="date"
              value={fechaDocumento}
              onChange={(e) => setFechaDocumento(e.target.value)}
              className="form-input text-xs font-bold h-9 rounded-lg border border-slate-300 px-2"
            />
          </div>

          {puedeModificar && (
            <button
              type="button"
              onClick={() => guardarMutation.mutate()}
              disabled={guardarMutation.isPending}
              className="btn text-xs font-bold h-9 px-3 flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm"
              title="Guardar borrador o cambios del formulario"
            >
              <Save className="w-4 h-4" /> Guardar
            </button>
          )}

          {esSupervisorOAdmin && (
            <>
              {/* Botón Apertura */}
              {controlTanques?.aperturaConfirmada ? (
                <div className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold rounded-lg">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Apertura OK</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleConfirmarApertura}
                  disabled={confirmarAperturaMutation.isPending}
                  className="btn text-xs font-bold h-9 px-3 flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm"
                  title="Validar y confirmar litros iniciales de apertura"
                >
                  <ShieldCheck className="w-4 h-4" /> Confirmar Apertura
                </button>
              )}

              {/* Botón Cierre */}
              {controlTanques?.cierreConfirmado ? (
                <div className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 border border-slate-300 text-slate-700 text-xs font-bold rounded-lg">
                  <Lock className="w-3.5 h-3.5 text-slate-500" />
                  <span>Cierre OK</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleConfirmarCierre}
                  disabled={confirmarCierreMutation.isPending}
                  className="btn text-xs font-bold h-9 px-3 flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-sm"
                  title="Confirmar aforos finales y bloquear edición del día"
                >
                  <Check className="w-4 h-4" /> Confirmar Cierre Diario
                </button>
              )}
            </>
          )}

          <button
            type="button"
            onClick={handleLimpiar}
            disabled={!puedeModificar}
            className="btn btn-outline text-xs font-bold h-9 px-3 flex items-center gap-1.5 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            title="Reiniciar valores"
          >
            <RotateCcw className="w-3.5 h-3.5 text-gray-500" /> Limpiar
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="btn text-xs font-bold h-9 px-3 flex items-center gap-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg shadow-sm"
          >
            <Printer className="w-4 h-4" /> Imprimir / PDF
          </button>
        </div>
      </div>

      {/* AVISO DE BLOQUEO SI NO ES ADMINISTRADOR Y ESTÁ CERRADO */}
      {!puedeModificar && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 flex items-center justify-between text-amber-900 text-xs font-semibold print:hidden">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-amber-700 shrink-0" />
            <span>
              <strong>Registro Diario Cerrado y Confirmado:</strong> Los aforos y recepciones de esta fecha están validados.
              Por regla de auditoría, únicamente el <strong>Administrador</strong> tiene autorización para desbloquear y modificar datos de días anteriores o confirmados.
            </span>
          </div>
        </div>
      )}

      {/* DOCUMENTO PRINCIPAL (HOJA IMPRIMIBLE 1:1 CON FORMATO ORIGINAL) */}
      <div
        id="hojaImpresionTanques"
        className="bg-white rounded-xl shadow-lg border border-slate-300 mx-auto p-6 md:p-8 max-w-[850px] print:shadow-none print:border-none print:p-0"
      >
        {/* 1. ENCABEZADO CON MEMBRETE Y FECHA */}
        <div className="flex justify-between items-start border-b-2 border-blue-900 pb-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-center text-blue-900 text-xl font-black">
              <Truck className="w-6 h-6 text-blue-800" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-wide text-blue-900 leading-tight">
                {empresaConfig?.nombre || empresaConfig?.nombreEmpresa || 'SISTEMA DE CONTROL LOGÍSTICO'}
              </h1>
              <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                Sistema de Control Logístico y Recepción de Leche
              </p>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1.5">
            <span className="bg-slate-100 text-blue-900 text-[10px] font-extrabold uppercase px-2.5 py-1 rounded border border-slate-300">
              Formulario Silos-01
            </span>
            <div className="text-xs font-bold text-slate-800 flex items-center gap-1">
              <span>FECHA:</span>
              <span className="font-mono text-blue-700 font-extrabold border-b border-slate-400 px-2">
                {fechaDocumento}
              </span>
            </div>
          </div>
        </div>

        {/* 2. TANQUES INICIALES (1 al 5) */}
        <div className="bg-slate-50 border border-slate-300 rounded-lg p-3 mb-4">
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-extrabold text-blue-900 uppercase flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-blue-600" /> 1. Tanques Iniciales (Al Iniciar Jornada)
              </span>
              {controlTanques?.aperturaConfirmada && (
                <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-700" /> Validado
                </span>
              )}
            </div>
            <span className="text-xs font-bold text-slate-700">
              Total Inicial:{' '}
              <strong className="text-blue-800 text-sm font-mono">
                {totalTanquesIniciales.toLocaleString()} Lts
              </strong>
            </span>
          </div>

          <div className="grid grid-cols-5 gap-2">
            {[1, 2, 3, 4, 5].map((num) => {
              const key = `t${num}` as keyof typeof tanquesIniciales;
              return (
                <div key={num} className="bg-white border border-slate-300 rounded-md p-1.5 text-center">
                  <span className="text-[11px] font-bold text-slate-600 block">Tanque {num}</span>
                  <input
                    type="number"
                    disabled={!puedeModificar}
                    value={tanquesIniciales[key] || ''}
                    onChange={(e) =>
                      setTanquesIniciales({ ...tanquesIniciales, [key]: Number(e.target.value) })
                    }
                    placeholder="0"
                    className="w-full text-center font-mono font-bold text-xs h-7 border-b border-slate-400 outline-none focus:border-blue-600 disabled:bg-slate-100 disabled:text-slate-500"
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* 3. TABLA DE 15 RECEPCIONES */}
        <div className="mb-4 overflow-x-auto">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-xs font-extrabold text-blue-900 uppercase">
              2. Recepción de Leche en Ruta (Entradas)
            </span>
            <span className="text-[11px] text-gray-500 font-semibold">15 Registros Diarios</span>
          </div>

          <table className="w-full border-collapse border border-slate-400 text-xs">
            <thead>
              <tr className="bg-blue-900 text-white font-bold uppercase text-[10.5px]">
                <th className="border border-slate-400 p-1.5 w-8 text-center">#</th>
                <th className="border border-slate-400 p-1.5 w-24 text-center">Fecha</th>
                <th className="border border-slate-400 p-1.5 text-left">Chofer / Circuito de Ruta</th>
                <th className="border border-slate-400 p-1.5 w-24 text-right">Litros Ruta</th>
                <th className="border border-slate-400 p-1.5 w-24 text-right">Litros Recepción</th>
                <th className="border border-slate-400 p-1.5 w-24 text-right">Diferencia</th>
              </tr>
            </thead>
            <tbody>
              {filasRecepcion.map((row, idx) => {
                const diff = row.diferencia;
                const diffColor =
                  diff < 0
                    ? 'text-red-600 font-bold'
                    : diff > 0
                    ? 'text-emerald-600 font-bold'
                    : 'text-slate-500';
                return (
                  <tr key={row.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                    <td className="border border-slate-300 text-center font-bold text-slate-500 p-1 text-[11px]">
                      {row.id}
                    </td>
                    <td className="border border-slate-300 p-0.5 text-center">
                      <input
                        type="date"
                        disabled={!puedeModificar}
                        value={row.fecha}
                        onChange={(e) => handleFilaChange(idx, 'fecha', e.target.value)}
                        className="w-full text-center text-[10.5px] border-none outline-none bg-transparent disabled:text-slate-500"
                      />
                    </td>
                    <td className="border border-slate-300 p-0.5">
                      <input
                        type="text"
                        disabled={!puedeModificar}
                        value={row.choferRuta}
                        onChange={(e) => handleFilaChange(idx, 'choferRuta', e.target.value)}
                        placeholder="Chofer / Ruta..."
                        className="w-full text-[11px] px-1 font-medium border-none outline-none bg-transparent disabled:text-slate-500"
                      />
                    </td>
                    <td className="border border-slate-300 p-0.5">
                      <input
                        type="number"
                        disabled={!puedeModificar}
                        value={row.litrosRuta || ''}
                        onChange={(e) => handleFilaChange(idx, 'litrosRuta', e.target.value)}
                        placeholder="0"
                        className="w-full text-right font-mono font-semibold text-[11px] pr-1 border-none outline-none bg-transparent disabled:text-slate-500"
                      />
                    </td>
                    <td className="border border-slate-300 p-0.5">
                      <input
                        type="number"
                        disabled={!puedeModificar}
                        value={row.litrosRecepcion || ''}
                        onChange={(e) => handleFilaChange(idx, 'litrosRecepcion', e.target.value)}
                        placeholder="0"
                        className="w-full text-right font-mono font-semibold text-[11px] pr-1 border-none outline-none bg-transparent disabled:text-slate-500"
                      />
                    </td>
                    <td className={`border border-slate-300 text-right pr-2 font-mono text-[11px] ${diffColor}`}>
                      {diff !== 0
                        ? diff > 0
                          ? `+${diff.toLocaleString()}`
                          : diff.toLocaleString()
                        : '-'}
                    </td>
                  </tr>
                );
              })}
              {/* FILA DE TOTALES DE RECEPCIÓN */}
              <tr className="bg-slate-200 font-bold text-slate-800 text-[11px]">
                <td colSpan={3} className="border border-slate-400 p-1.5 text-right uppercase">
                  Totales Recepción Leche:
                </td>
                <td className="border border-slate-400 p-1.5 text-right font-mono text-blue-900">
                  {totalLitrosRuta.toLocaleString()} Lts
                </td>
                <td className="border border-slate-400 p-1.5 text-right font-mono text-blue-900">
                  {totalLitrosRecepcion.toLocaleString()} Lts
                </td>
                <td className="border border-slate-400 p-1.5 text-right font-mono text-blue-900">
                  {totalDiferenciaRecepcion > 0
                    ? `+${totalDiferenciaRecepcion.toLocaleString()}`
                    : totalDiferenciaRecepcion.toLocaleString()}{' '}
                  Lts
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 4. TANQUES FINALES (1 al 5) & DESPACHOS */}
        <div className="bg-slate-50 border border-slate-300 rounded-lg p-3 mb-4">
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-extrabold text-blue-900 uppercase flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-blue-600" /> 3. Tanques Finales (Aforo Físico al Cierre)
              </span>
              {controlTanques?.cierreConfirmado && (
                <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-700" /> Cierre Confirmado
                </span>
              )}
            </div>
            <span className="text-xs font-bold text-slate-700">
              Total Final Físico:{' '}
              <strong className="text-blue-800 text-sm font-mono">
                {totalTanquesFinales.toLocaleString()} Lts
              </strong>
            </span>
          </div>

          <div className="grid grid-cols-5 gap-2 mb-3">
            {[1, 2, 3, 4, 5].map((num) => {
              const key = `t${num}` as keyof typeof tanquesFinales;
              return (
                <div key={num} className="bg-white border border-slate-300 rounded-md p-1.5 text-center">
                  <span className="text-[11px] font-bold text-slate-600 block">Tanque {num}</span>
                  <input
                    type="number"
                    disabled={!puedeModificar}
                    value={tanquesFinales[key] || ''}
                    onChange={(e) =>
                      setTanquesFinales({ ...tanquesFinales, [key]: Number(e.target.value) })
                    }
                    placeholder="0"
                    className="w-full text-center font-mono font-bold text-xs h-7 border-b border-slate-400 outline-none focus:border-blue-600 disabled:bg-slate-100 disabled:text-slate-500"
                  />
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between border-t border-slate-200 pt-2 text-xs">
            <span className="font-bold text-slate-700">
              Total Despachado a Plantas / Compañías:
            </span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                disabled={!puedeModificar}
                value={totalDespachado || ''}
                onChange={(e) => setTotalDespachado(Number(e.target.value))}
                placeholder="0"
                className="w-32 text-right font-mono font-bold text-xs h-7 border border-slate-300 rounded px-2 disabled:bg-slate-100 disabled:text-slate-500"
              />
              <span className="font-bold text-slate-500">Lts</span>
            </div>
          </div>
        </div>

        {/* 5. BALANCE GENERAL DE SILOS Y MERMA */}
        <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-3.5 mb-6">
          <h4 className="text-xs font-extrabold text-blue-900 uppercase mb-2">
            4. Balance General de Silo & Cuadre de Mermas
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="bg-white p-2 rounded border border-blue-100">
              <span className="text-[10.5px] text-gray-500 block">Total Inicial:</span>
              <strong className="font-mono text-slate-800 text-sm">
                {totalTanquesIniciales.toLocaleString()} Lts
              </strong>
            </div>
            <div className="bg-white p-2 rounded border border-blue-100">
              <span className="text-[10.5px] text-gray-500 block">(+) Total Recibido:</span>
              <strong className="font-mono text-emerald-700 text-sm">
                +{totalLitrosRecepcion.toLocaleString()} Lts
              </strong>
            </div>
            <div className="bg-white p-2 rounded border border-blue-100">
              <span className="text-[10.5px] text-gray-500 block">(-) Despachos:</span>
              <strong className="font-mono text-amber-700 text-sm">
                -{Number(totalDespachado).toLocaleString()} Lts
              </strong>
            </div>
            <div className="bg-white p-2 rounded border border-blue-100">
              <span className="text-[10.5px] text-gray-500 block">(=) Teórico Esperado:</span>
              <strong className="font-mono text-blue-900 text-sm">
                {volumenTeoricoFinal.toLocaleString()} Lts
              </strong>
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-blue-200 flex justify-between items-center text-xs">
            <span className="font-bold text-slate-800">
              Diferencia / Merma Neta en Silos (Físico vs Teórico):
            </span>
            <span
              className={`font-mono text-sm font-extrabold px-3 py-1 rounded ${
                mermaSilo >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
              }`}
            >
              {mermaSilo >= 0 ? `+${mermaSilo.toLocaleString()}` : mermaSilo.toLocaleString()} Lts
            </span>
          </div>
        </div>

        {/* 6. FIRMAS DE RESPONSABILIDAD CON VALIDACIÓN DIGITAL */}
        <div className="grid grid-cols-2 gap-12 mt-10 pt-4 text-xs">
          <div className="text-center">
            <div className="border-b border-slate-700 w-3/4 mx-auto mb-1.5 h-10 flex items-end justify-center pb-1">
              {controlTanques?.aperturaConfirmadaPorNombre && (
                <span className="text-[11px] font-mono text-blue-900 font-bold">
                  ✓ Validado: {controlTanques.aperturaConfirmadaPorNombre}
                </span>
              )}
            </div>
            <span className="font-bold text-slate-800 block">Supervisor de Turno / Receptoría</span>
            <span className="text-[10.5px] text-gray-500">
              {controlTanques?.aperturaConfirmadaAt
                ? `Confirmado: ${new Date(controlTanques.aperturaConfirmadaAt).toLocaleString()}`
                : 'Firma y Sello Oficial'}
            </span>
          </div>

          <div className="text-center">
            <div className="border-b border-slate-700 w-3/4 mx-auto mb-1.5 h-10 flex items-end justify-center pb-1">
              {controlTanques?.cierreConfirmadoPorNombre && (
                <span className="text-[11px] font-mono text-blue-900 font-bold">
                  ✓ Cierre: {controlTanques.cierreConfirmadoPorNombre}
                </span>
              )}
            </div>
            <span className="font-bold text-slate-800 block">Operador de Silos y Tanques</span>
            <span className="text-[10.5px] text-gray-500">
              {controlTanques?.cierreConfirmadoAt
                ? `Cerrado: ${new Date(controlTanques.cierreConfirmadoAt).toLocaleString()}`
                : 'Firma y Cédula'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ControlTanquesPage;
