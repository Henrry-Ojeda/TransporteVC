import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import Swal from 'sweetalert2';
import {
  Printer,
  CheckCircle2,
  Lock,
  ShieldCheck,
  Check,
  Droplets,
} from 'lucide-react';
import { catalogosApi } from '@/api/catalogos.api';
import { operacionesApi } from '@/api/operaciones.api';
import { useAuth } from '@/hooks/useAuth';
import type { ControlTanquesDiarioDto } from '@/types';

interface FilaRecepcionTanque {
  id: number;
  fecha: string;
  choferRuta: string;
  litrosRuta: number;
  litrosRecepcion: number;
  recepcionObs?: string;
  diferencia: number;
}

const TOTAL_FILAS = 22;

const emptyFilas = (): FilaRecepcionTanque[] =>
  Array.from({ length: TOTAL_FILAS }, (_, i) => ({
    id: i + 1,
    fecha: '',
    choferRuta: '',
    litrosRuta: 0,
    litrosRecepcion: 0,
    recepcionObs: '',
    diferencia: 0,
  }));

export const ControlTanquesPage: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [fechaDocumento, setFechaDocumento] = useState(() => new Date().toISOString().split('T')[0]);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInitialLoadRef = useRef<boolean>(true);

  // Tanques Iniciales (Tanque 1, Tanque 2, Tanque 3, Tanque 4, Silo)
  const [tanquesIniciales, setTanquesIniciales] = useState({
    t1: 0,
    t2: 0,
    t3: 0,
    t4: 0,
    t5: 0,
  });

  // Tanques Finales (Tanque 1, Tanque 2, Tanque 3, Tanque 4, Silo)
  const [tanquesFinales, setTanquesFinales] = useState({
    t1: 0,
    t2: 0,
    t3: 0,
    t4: 0,
    t5: 0,
  });

  const [totalDespachado, setTotalDespachado] = useState<number>(0);
  const [filasRecepcion, setFilasRecepcion] = useState<FilaRecepcionTanque[]>(emptyFilas);

  // Consulta del registro diario del backend
  const { data: controlTanques } = useQuery<ControlTanquesDiarioDto | null>({
    queryKey: ['control-tanques-diario', fechaDocumento],
    queryFn: () => operacionesApi.getControlTanquesDiario(fechaDocumento),
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
    for (let i = 0; i < TOTAL_FILAS; i++) {
      if (i < viajes.length) {
        const v = viajes[i];
        const lRuta = Number(v.totalLitrosFinca ?? v.totalLitrosRecogidos ?? 0);
        const lRecep = Number(v.litrosRecibidosReceptoria ?? v.totalLitrosReceptoria ?? v.totalLitrosEntregados ?? lRuta);
        const diff = lRecep - lRuta;
        const fechaFormat = v.fecha
          ? new Date(v.fecha).toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' })
          : fechaDocumento;
        rows.push({
          id: i + 1,
          fecha: fechaFormat,
          choferRuta: `${v.choferNombre || v.nombreConductor || 'Chofer'} / ${v.rutaNombre || v.rutaLogisticaNombre || 'Ruta'}`,
          litrosRuta: lRuta,
          litrosRecepcion: lRecep,
          recepcionObs: lRecep > 0 ? String(lRecep) : '',
          diferencia: diff,
        });
      } else {
        rows.push({
          id: i + 1,
          fecha: '',
          choferRuta: '',
          litrosRuta: 0,
          litrosRecepcion: 0,
          recepcionObs: '',
          diferencia: 0,
        });
      }
    }
    return rows;
  };

  const puedeModificar = useMemo(() => {
    if (isAdmin) return true;
    if (controlTanques?.puedeModificar === false) return false;
    if (controlTanques?.cierreConfirmado) return false;
    return true;
  }, [isAdmin, controlTanques]);

  const esSupervisorOAdmin = useMemo(() => {
    const rol = (user?.rol || '').toUpperCase();
    return rol.includes('ADMIN') || rol === 'SUPERVISOR' || rol === 'GERENTE';
  }, [user]);

  // Cargar datos recibidos de backend o autollenar al cambiar la fecha
  useEffect(() => {
    isInitialLoadRef.current = true;
    if (controlTanques) {
      setTanquesIniciales({
        t1: controlTanques.tanque1Inicial || 0,
        t2: controlTanques.tanque2Inicial || 0,
        t3: controlTanques.tanque3Inicial || 0,
        t4: controlTanques.tanque4Inicial || 0,
        t5: controlTanques.tanque5Inicial || 0,
      });

      if (
        !controlTanques.tanque1Inicial &&
        !controlTanques.tanque2Inicial &&
        !controlTanques.tanque3Inicial &&
        !controlTanques.tanque4Inicial &&
        !controlTanques.tanque5Inicial &&
        controlTanques.totalInicialLitros > 0
      ) {
        setTanquesIniciales((prev) => ({ ...prev, t5: controlTanques.totalInicialLitros }));
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
          if (
            Array.isArray(parsed) &&
            parsed.length > 0 &&
            parsed.some((p: any) => p.litrosRuta > 0 || p.litrosRecepcion > 0 || p.choferRuta)
          ) {
            const padded = parsed.slice(0, TOTAL_FILAS).map((item: any, idx: number) => ({
              id: idx + 1,
              fecha: item.fecha || '',
              choferRuta: item.choferRuta || '',
              litrosRuta: Number(item.litrosRuta) || 0,
              litrosRecepcion: Number(item.litrosRecepcion) || 0,
              recepcionObs:
                item.recepcionObs !== undefined
                  ? String(item.recepcionObs)
                  : item.litrosRecepcion
                  ? String(item.litrosRecepcion)
                  : '',
              diferencia: Number(item.diferencia) || 0,
            }));
            while (padded.length < TOTAL_FILAS) {
              padded.push({
                id: padded.length + 1,
                fecha: '',
                choferRuta: '',
                litrosRuta: 0,
                litrosRecepcion: 0,
                recepcionObs: '',
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
    setTimeout(() => {
      isInitialLoadRef.current = false;
    }, 300);
  }, [controlTanques, viajesDelDia, fechaDocumento]);

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

  const totalLitrosRecibidosTabla = useMemo(() => {
    return filasRecepcion.reduce((acc, f) => acc + (Number(f.litrosRuta) || 0), 0);
  }, [filasRecepcion]);

  const diferenciaTanques = useMemo(() => {
    return totalTanquesFinales - totalTanquesIniciales;
  }, [totalTanquesFinales, totalTanquesIniciales]);

  const volumenTeoricoFinal = useMemo(() => {
    return totalTanquesIniciales + totalLitrosRecibidosTabla - (Number(totalDespachado) || 0);
  }, [totalTanquesIniciales, totalLitrosRecibidosTabla, totalDespachado]);

  const mermaSilo = useMemo(() => {
    return totalTanquesFinales - volumenTeoricoFinal;
  }, [totalTanquesFinales, volumenTeoricoFinal]);

  // Mutación Guardar
  const guardarMutation = useMutation({
    mutationFn: async (silent?: boolean) => {
      const payload: ControlTanquesDiarioDto = {
        fecha: fechaDocumento,
        tanque1Inicial: Number(tanquesIniciales.t1) || 0,
        tanque2Inicial: Number(tanquesIniciales.t2) || 0,
        tanque3Inicial: Number(tanquesIniciales.t3) || 0,
        tanque4Inicial: Number(tanquesIniciales.t4) || 0,
        tanque5Inicial: Number(tanquesIniciales.t5) || 0,
        totalInicialLitros: totalTanquesIniciales,
        aperturaConfirmada: controlTanques?.aperturaConfirmada || false,
        totalEntradasRutasLitros: totalLitrosRecibidosTabla,
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
      const res = await operacionesApi.guardarControlTanquesDiario(payload);
      return { res, silent };
    },
    onSuccess: ({ res, silent }) => {
      if (!silent) {
        toast.success(res.message || 'Control diario guardado correctamente');
      }
      queryClient.invalidateQueries({ queryKey: ['balance-receptoria'] });
    },
  });

  // Autoguardado silencioso cuando el usuario edita campos
  const triggerAutoSave = () => {
    if (!puedeModificar || isInitialLoadRef.current) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      guardarMutation.mutate(true);
    }, 1200);
  };

  const handleFilaChange = (index: number, field: keyof FilaRecepcionTanque, value: any) => {
    if (!puedeModificar) return;
    const updated = [...filasRecepcion];
    const item = { ...updated[index], [field]: value };

    if (field === 'litrosRuta') {
      item.litrosRuta = Number(value) || 0;
      const recNum = Number(item.recepcionObs);
      if (!isNaN(recNum) && item.recepcionObs !== '') {
        item.litrosRecepcion = recNum;
        item.diferencia = recNum - item.litrosRuta;
      }
    } else if (field === 'recepcionObs') {
      item.recepcionObs = String(value);
      const recNum = Number(value);
      if (!isNaN(recNum) && String(value).trim() !== '') {
        item.litrosRecepcion = recNum;
        item.diferencia = recNum - (Number(item.litrosRuta) || 0);
      }
    } else if (field === 'diferencia') {
      item.diferencia = Number(value) || 0;
    }

    updated[index] = item;
    setFilasRecepcion(updated);
    triggerAutoSave();
  };

  // Mutación Confirmar Apertura
  const confirmarAperturaMutation = useMutation({
    mutationFn: async () => {
      await guardarMutation.mutateAsync(true);
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
      await guardarMutation.mutateAsync(true);
      return await operacionesApi.confirmarCierreTanques(fechaDocumento);
    },
    onSuccess: (res) => {
      Swal.fire({
        title: '¡Cierre Diario Confirmado!',
        text:
          res.message ||
          'El formulario queda cerrado. Solo el Administrador podrá modificar datos a partir de este momento.',
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
          <p>Total Físico en Tanques y Silo: <strong>${totalTanquesFinales.toLocaleString()} Lts</strong></p>
          <p>Total Litros Recibidos (Tabla): <strong>${totalLitrosRecibidosTabla.toLocaleString()} Lts</strong></p>
          <p>Diferencia Tanques (Final - Inicial): <strong>${diferenciaTanques.toLocaleString()} Lts</strong></p>
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

  const tankColumns = [
    { key: 't1' as const, label: 'Tanque 1' },
    { key: 't2' as const, label: 'Tanque 2' },
    { key: 't3' as const, label: 'Tanque 3' },
    { key: 't4' as const, label: 'Tanque 4' },
    { key: 't5' as const, label: 'Silo' },
  ];

  const formattedHeaderDate = useMemo(() => {
    if (!fechaDocumento) return '';
    const [yyyy, mm, dd] = fechaDocumento.split('-');
    return `${dd}/${mm}/${yyyy}`;
  }, [fechaDocumento]);

  return (
    <div className="space-y-4">
      {/* BARRA DE ACCIONES (No se imprime) */}
      <div className="actions-bar print:hidden max-w-[800px] mx-auto bg-white px-5 py-3 rounded-xl shadow-sm border border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
          <Droplets className="w-5 h-5 text-blue-600" />
          <span>Formulario de Control Diario de Tanques y Recepción</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={fechaDocumento}
            onChange={(e) => setFechaDocumento(e.target.value)}
            className="h-9 px-2.5 text-xs font-bold text-slate-800 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
            title="Seleccionar Fecha (Autollena automáticamente los viajes del día)"
          />

          {esSupervisorOAdmin && (
            <>
              {controlTanques?.aperturaConfirmada ? (
                <div className="inline-flex items-center gap-1 px-3 h-9 bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold rounded-lg">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Apertura OK</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleConfirmarApertura}
                  disabled={confirmarAperturaMutation.isPending}
                  className="h-9 px-3.5 text-xs font-bold flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm transition-colors cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4" /> Confirmar Apertura
                </button>
              )}

              {controlTanques?.cierreConfirmado ? (
                <div className="inline-flex items-center gap-1 px-3 h-9 bg-slate-100 border border-slate-300 text-slate-700 text-xs font-bold rounded-lg">
                  <Lock className="w-3.5 h-3.5 text-slate-500" />
                  <span>Cierre OK</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleConfirmarCierre}
                  disabled={confirmarCierreMutation.isPending}
                  className="h-9 px-3.5 text-xs font-bold flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-sm transition-colors cursor-pointer"
                >
                  <Check className="w-4 h-4" /> Confirmar Cierre
                </button>
              )}
            </>
          )}

          <button
            type="button"
            onClick={handlePrint}
            className="h-9 px-4 text-xs font-bold flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4" /> Imprimir / Guardar en PDF
          </button>
        </div>
      </div>

      {/* AVISO DE BLOQUEO SI ESTÁ CERRADO Y NO ES ADMIN */}
      {!puedeModificar && (
        <div className="max-w-[800px] mx-auto bg-amber-50 border border-amber-300 rounded-xl p-3 flex items-center gap-2 text-amber-900 text-xs font-semibold print:hidden">
          <Lock className="w-4 h-4 text-amber-700 shrink-0" />
          <span>
            <strong>Registro Diario Cerrado:</strong> Solo el Administrador puede modificar datos confirmados.
          </span>
        </div>
      )}

      {/* HOJA PRINCIPAL (Imprimible 1:1 con Formulario_Control_Tanques.html) */}
      <div
        id="hojaImpresionTanques"
        className="page-sheet max-w-[800px] mx-auto bg-white rounded-xl shadow-md border border-slate-300 px-7 py-5 flex flex-col justify-between print:shadow-none print:border-none print:rounded-none print:p-0"
      >
        {/* 1. ENCABEZADO */}
        <header className="flex justify-between items-center border-b-2 border-[#1e3a8a] pb-2.5 mb-2.5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-[#1e3a8a] to-[#2563eb] rounded-lg flex items-center justify-center text-white text-lg font-extrabold shadow-sm">
              🐄
            </div>
            <div>
              <h1 className="text-[17px] font-black text-[#1e3a8a] tracking-tight uppercase leading-tight">
                {empresaConfig?.nombre || empresaConfig?.nombreEmpresa || 'TRANSPORTE VERGEL & CARRILLO'}
              </h1>
              <p className="text-[11px] font-semibold text-slate-500">
                Sistema de Control y Recepción de Leche
              </p>
            </div>
          </div>

          <div className="text-right">
            <div className="inline-block bg-slate-100 border border-slate-300 px-2.5 py-0.5 rounded-md text-[11px] font-extrabold text-[#1e3a8a] uppercase tracking-wide mb-1">
              Control Diario de Tanques
            </div>
            <div className="flex items-center justify-end gap-1.5 text-xs font-bold text-slate-700">
              <span>FECHA:</span>
              <input
                type="text"
                readOnly
                value={formattedHeaderDate}
                className="border-none border-b border-slate-400 font-sans text-xs font-bold text-slate-900 px-1 py-0.5 w-[110px] text-center bg-transparent outline-none"
              />
            </div>
          </div>
        </header>

        {/* 2. LECTURA DE TANQUES (INICIAL / APERTURA) */}
        <section className="mb-2.5">
          <div className="flex items-center justify-between bg-slate-100 border border-slate-300 border-l-4 border-l-[#1e3a8a] px-2.5 py-1 rounded-t-md text-[11px] font-extrabold text-slate-800 uppercase tracking-wide">
            <span className="flex items-center gap-1.5">
              <span className="text-[#2563eb]">🛢️</span> Lectura de Tanques — Nivel Inicial (Apertura)
            </span>
            <span className="text-[10px] font-semibold text-slate-500 normal-case">
              Expresado en Litros (Lts)
            </span>
          </div>
          <div className="grid grid-cols-5 border border-slate-300 border-t-0 rounded-b-md overflow-hidden">
            {tankColumns.map((col, idx) => (
              <div
                key={`init-${col.key}`}
                className={`flex flex-col text-center ${
                  idx < tankColumns.length - 1 ? 'border-r border-slate-300' : ''
                }`}
              >
                <div className="bg-slate-50 py-1 text-[10.5px] font-extrabold text-[#1e3a8a] uppercase border-b border-slate-200">
                  {col.label}
                </div>
                <div className="p-1 bg-white">
                  <input
                    type="number"
                    disabled={!puedeModificar}
                    value={tanquesIniciales[col.key] || ''}
                    onChange={(e) => {
                      setTanquesIniciales({
                        ...tanquesIniciales,
                        [col.key]: Number(e.target.value),
                      });
                      triggerAutoSave();
                    }}
                    placeholder="0.00"
                    className="w-full border-none text-center text-xs font-bold text-slate-900 py-0.5 outline-none focus:bg-blue-50 rounded disabled:bg-transparent"
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 3. TABLA DE REGISTRO DE RECEPCIÓN (22 FILAS) */}
        <section className="my-1.5">
          <table className="w-full border-collapse border border-slate-400 table-fixed">
            <thead>
              <tr>
                <th className="bg-[#1e3a8a] text-white text-[10.5px] font-extrabold uppercase tracking-wide py-1.5 px-1.5 border border-[#1e3a8a] text-center w-[34px]">
                  #
                </th>
                <th className="bg-[#1e3a8a] text-white text-[10.5px] font-extrabold uppercase tracking-wide py-1.5 px-1.5 border border-[#1e3a8a] text-left w-[16%]">
                  FECHA / HORA
                </th>
                <th className="bg-[#1e3a8a] text-white text-[10.5px] font-extrabold uppercase tracking-wide py-1.5 px-1.5 border border-[#1e3a8a] text-left w-[32%]">
                  CHOFER / CONDUCTOR
                </th>
                <th className="bg-[#1e3a8a] text-white text-[10.5px] font-extrabold uppercase tracking-wide py-1.5 px-1.5 border border-[#1e3a8a] text-right w-[16%]">
                  LITROS
                </th>
                <th className="bg-[#1e3a8a] text-white text-[10.5px] font-extrabold uppercase tracking-wide py-1.5 px-1.5 border border-[#1e3a8a] text-left w-[20%]">
                  RECEPCIÓN / OBS
                </th>
                <th className="bg-[#1e3a8a] text-white text-[10.5px] font-extrabold uppercase tracking-wide py-1.5 px-1.5 border border-[#1e3a8a] text-right w-[16%]">
                  DIFERENCIA
                </th>
              </tr>
            </thead>
            <tbody>
              {filasRecepcion.map((row, idx) => (
                <tr key={row.id} className={idx % 2 === 1 ? 'bg-slate-50/70' : 'bg-white'}>
                  <td className="border border-slate-300 h-[23px] px-1 text-center font-bold text-slate-400 text-[10px] bg-slate-50">
                    {row.id}
                  </td>
                  <td className="border border-slate-300 h-[23px] px-1.5">
                    <input
                      type="text"
                      disabled={!puedeModificar}
                      value={row.fecha}
                      onChange={(e) => handleFilaChange(idx, 'fecha', e.target.value)}
                      className="w-full h-full border-none bg-transparent text-[11px] font-medium text-slate-800 outline-none focus:bg-blue-50"
                    />
                  </td>
                  <td className="border border-slate-300 h-[23px] px-1.5">
                    <input
                      type="text"
                      disabled={!puedeModificar}
                      value={row.choferRuta}
                      onChange={(e) => handleFilaChange(idx, 'choferRuta', e.target.value)}
                      className="w-full h-full border-none bg-transparent text-[11px] font-medium text-slate-800 outline-none focus:bg-blue-50"
                    />
                  </td>
                  <td className="border border-slate-300 h-[23px] px-1.5">
                    <input
                      type="number"
                      step="any"
                      disabled={!puedeModificar}
                      value={row.litrosRuta || ''}
                      onChange={(e) => handleFilaChange(idx, 'litrosRuta', e.target.value)}
                      className="w-full h-full border-none bg-transparent text-[11px] font-bold text-slate-900 text-right outline-none focus:bg-blue-50"
                    />
                  </td>
                  <td className="border border-slate-300 h-[23px] px-1.5">
                    <input
                      type="text"
                      disabled={!puedeModificar}
                      value={row.recepcionObs ?? ''}
                      onChange={(e) => handleFilaChange(idx, 'recepcionObs', e.target.value)}
                      className="w-full h-full border-none bg-transparent text-[11px] font-medium text-slate-800 outline-none focus:bg-blue-50"
                    />
                  </td>
                  <td className="border border-slate-300 h-[23px] px-1.5">
                    <input
                      type="number"
                      step="any"
                      disabled={!puedeModificar}
                      value={row.diferencia !== 0 ? row.diferencia : ''}
                      onChange={(e) => handleFilaChange(idx, 'diferencia', e.target.value)}
                      className="w-full h-full border-none bg-transparent text-[11px] font-bold text-slate-900 text-right outline-none focus:bg-blue-50"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* 4. LECTURA DE TANQUES (FINAL / CIERRE) */}
        <section className="mt-2">
          <div className="flex items-center justify-between bg-slate-100 border border-slate-300 border-l-4 border-l-[#059669] px-2.5 py-1 rounded-t-md text-[11px] font-extrabold text-slate-800 uppercase tracking-wide">
            <span className="flex items-center gap-1.5">
              <span className="text-[#059669]">🛢️</span> Lectura de Tanques — Nivel Final (Cierre del Día)
            </span>
            <span className="text-[10px] font-semibold text-slate-500 normal-case">
              Expresado en Litros (Lts)
            </span>
          </div>
          <div className="grid grid-cols-5 border border-slate-300 border-t-0 rounded-b-md overflow-hidden">
            {tankColumns.map((col, idx) => (
              <div
                key={`final-${col.key}`}
                className={`flex flex-col text-center ${
                  idx < tankColumns.length - 1 ? 'border-r border-slate-300' : ''
                }`}
              >
                <div className="bg-slate-50 py-1 text-[10.5px] font-extrabold text-[#1e3a8a] uppercase border-b border-slate-200">
                  {col.label}
                </div>
                <div className="p-1 bg-white">
                  <input
                    type="number"
                    disabled={!puedeModificar}
                    value={tanquesFinales[col.key] || ''}
                    onChange={(e) => {
                      setTanquesFinales({
                        ...tanquesFinales,
                        [col.key]: Number(e.target.value),
                      });
                      triggerAutoSave();
                    }}
                    placeholder="0.00"
                    className="w-full border-none text-center text-xs font-bold text-slate-900 py-0.5 outline-none focus:bg-blue-50 rounded disabled:bg-transparent"
                  />
                </div>
              </div>
            ))}
          </div>

          {/* PIE DE RESUMEN Y FIRMA (1:1 con Formulario_Control_Tanques.html) */}
          <div className="grid grid-cols-2 gap-4 mt-2.5 pt-2 border-t border-dashed border-slate-300 items-end">
            <div className="flex gap-3 bg-slate-50 border border-slate-200 px-3 py-2 rounded-md">
              <div className="flex-1 text-xs">
                <span className="text-slate-500 font-semibold block text-[10px] uppercase">
                  Total Litros Recibidos (Tabla):
                </span>
                <input
                  type="text"
                  readOnly
                  value={
                    totalLitrosRecibidosTabla > 0
                      ? totalLitrosRecibidosTabla.toLocaleString('es-VE', {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 2,
                        })
                      : ''
                  }
                  placeholder="0.00"
                  className="w-full border-none border-b border-slate-400 bg-transparent font-extrabold text-[13px] text-[#1e3a8a] py-0.5 outline-none"
                />
              </div>
              <div className="flex-1 text-xs">
                <span className="text-slate-500 font-semibold block text-[10px] uppercase">
                  Diferencia Tanques (Final - Inicial):
                </span>
                <input
                  type="text"
                  readOnly
                  value={
                    totalTanquesIniciales > 0 || totalTanquesFinales > 0
                      ? diferenciaTanques.toLocaleString('es-VE', {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 2,
                        })
                      : ''
                  }
                  placeholder="0.00"
                  className="w-full border-none border-b border-slate-400 bg-transparent font-extrabold text-[13px] text-[#1e3a8a] py-0.5 outline-none"
                />
              </div>
            </div>

            <div className="text-center pt-3">
              <div className="border-t border-slate-600 w-[75%] mx-auto pt-1 text-[10.5px] font-bold text-slate-600 uppercase">
                Firma del Responsable / Receptor
                {(controlTanques?.cierreConfirmadoPorNombre || controlTanques?.aperturaConfirmadaPorNombre) && (
                  <span className="block text-[9.5px] font-mono text-emerald-700 normal-case mt-0.5">
                    ✓ Validado: {controlTanques?.cierreConfirmadoPorNombre || controlTanques?.aperturaConfirmadaPorNombre}
                  </span>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default ControlTanquesPage;
