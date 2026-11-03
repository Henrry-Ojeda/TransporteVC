import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import Swal from 'sweetalert2';
import {
  Printer,
  FileSpreadsheet,
  Save,
  RotateCcw,
  Calendar,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Truck,
} from 'lucide-react';
import { catalogosApi } from '@/api/catalogos.api';
import type { ChoferDto } from '@/types';

interface FilaRecepcionTanque {
  id: number;
  fecha: string;
  choferRuta: string;
  litrosRuta: number;
  litrosRecepcion: number;
  diferencia: number;
}

export const ControlTanquesPage: React.FC = () => {
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
  const [filasRecepcion, setFilasRecepcion] = useState<FilaRecepcionTanque[]>(() => {
    return Array.from({ length: 15 }, (_, i) => ({
      id: i + 1,
      fecha: '',
      choferRuta: '',
      litrosRuta: 0,
      litrosRecepcion: 0,
      diferencia: 0,
    }));
  });

  const { data: choferes = [] } = useQuery<ChoferDto[]>({
    queryKey: ['choferes-tanques'],
    queryFn: () => catalogosApi.getChoferes(),
  });

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

  const handlePrint = () => {
    window.print();
  };

  const handleLimpiar = async () => {
    const res = await Swal.fire({
      title: '¿Limpiar formulario?',
      text: 'Se reiniciarán todos los valores cargados en los tanques y recepciones.',
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
      setFilasRecepcion(
        Array.from({ length: 15 }, (_, i) => ({
          id: i + 1,
          fecha: '',
          choferRuta: '',
          litrosRuta: 0,
          litrosRecepcion: 0,
          diferencia: 0,
        }))
      );
      toast.success('Formulario reiniciado');
    }
  };

  return (
    <div className="space-y-6">
      {/* BARRA DE ACCIONES SUPERIOR (Se oculta al imprimir) */}
      <div
        className="actions-bar print:hidden flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 bg-white rounded-2xl shadow-sm border border-gray-200"
      >
        <div>
          <h2 className="text-lg font-bold text-blue-900 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-600" />
            Control Diario de Tanques y Recepción de Leche
          </h2>
          <p className="text-xs text-gray-500">
            Formulario operativo de aforos de silos 1 al 5, balance de entradas de rutas y mermas diarias
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-gray-700">Fecha Operativa:</label>
            <input
              type="date"
              value={fechaDocumento}
              onChange={(e) => setFechaDocumento(e.target.value)}
              className="form-input text-xs font-bold h-9 rounded-lg"
            />
          </div>

          <button
            type="button"
            onClick={handleLimpiar}
            className="btn btn-outline text-xs font-bold h-9 flex items-center gap-1.5"
            title="Reiniciar valores"
          >
            <RotateCcw className="w-3.5 h-3.5 text-gray-500" /> Limpiar
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="btn btn-primary text-xs font-bold h-9 flex items-center gap-1.5 bg-linear-to-r from-blue-700 to-blue-600 text-white shadow-md shadow-blue-500/20"
          >
            <Printer className="w-4 h-4" /> Imprimir Hoja / PDF
          </button>
        </div>
      </div>

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
                TRANSPORTE VERGEL CARRILLO C.A.
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
            <span className="text-xs font-extrabold text-blue-900 uppercase flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-blue-600" /> 1. Tanques Iniciales (Al Iniciar Jornada)
            </span>
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
                    value={tanquesIniciales[key] || ''}
                    onChange={(e) =>
                      setTanquesIniciales({ ...tanquesIniciales, [key]: Number(e.target.value) })
                    }
                    placeholder="0"
                    className="w-full text-center font-mono font-bold text-xs h-7 border-b border-slate-400 outline-none focus:border-blue-600"
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
                const diffColor = diff < 0 ? 'text-red-600 font-bold' : diff > 0 ? 'text-emerald-600 font-bold' : 'text-slate-500';
                return (
                  <tr key={row.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                    <td className="border border-slate-300 text-center font-bold text-slate-500 p-1 text-[11px]">
                      {row.id}
                    </td>
                    <td className="border border-slate-300 p-0.5 text-center">
                      <input
                        type="date"
                        value={row.fecha}
                        onChange={(e) => handleFilaChange(idx, 'fecha', e.target.value)}
                        className="w-full text-center text-[10.5px] border-none outline-none bg-transparent"
                      />
                    </td>
                    <td className="border border-slate-300 p-0.5">
                      <input
                        type="text"
                        value={row.choferRuta}
                        onChange={(e) => handleFilaChange(idx, 'choferRuta', e.target.value)}
                        placeholder="Chofer / Ruta..."
                        className="w-full text-[11px] px-1 font-medium border-none outline-none bg-transparent"
                      />
                    </td>
                    <td className="border border-slate-300 p-0.5">
                      <input
                        type="number"
                        value={row.litrosRuta || ''}
                        onChange={(e) => handleFilaChange(idx, 'litrosRuta', e.target.value)}
                        placeholder="0"
                        className="w-full text-right font-mono font-semibold text-[11px] pr-1 border-none outline-none bg-transparent"
                      />
                    </td>
                    <td className="border border-slate-300 p-0.5">
                      <input
                        type="number"
                        value={row.litrosRecepcion || ''}
                        onChange={(e) => handleFilaChange(idx, 'litrosRecepcion', e.target.value)}
                        placeholder="0"
                        className="w-full text-right font-mono font-semibold text-[11px] pr-1 border-none outline-none bg-transparent"
                      />
                    </td>
                    <td className={`border border-slate-300 text-right pr-2 font-mono text-[11px] ${diffColor}`}>
                      {diff !== 0 ? (diff > 0 ? `+${diff.toLocaleString()}` : diff.toLocaleString()) : '-'}
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
                  {totalDiferenciaRecepcion > 0 ? `+${totalDiferenciaRecepcion.toLocaleString()}` : totalDiferenciaRecepcion.toLocaleString()} Lts
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 4. TANQUES FINALES (1 al 5) & DESPACHOS */}
        <div className="bg-slate-50 border border-slate-300 rounded-lg p-3 mb-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-extrabold text-blue-900 uppercase flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-blue-600" /> 3. Tanques Finales (Aforo Físico al Cierre)
            </span>
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
                    value={tanquesFinales[key] || ''}
                    onChange={(e) =>
                      setTanquesFinales({ ...tanquesFinales, [key]: Number(e.target.value) })
                    }
                    placeholder="0"
                    className="w-full text-center font-mono font-bold text-xs h-7 border-b border-slate-400 outline-none focus:border-blue-600"
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
                value={totalDespachado || ''}
                onChange={(e) => setTotalDespachado(Number(e.target.value))}
                placeholder="0"
                className="w-32 text-right font-mono font-bold text-xs h-7 border border-slate-300 rounded px-2"
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
              <strong className="font-mono text-slate-800 text-sm">{totalTanquesIniciales.toLocaleString()} Lts</strong>
            </div>
            <div className="bg-white p-2 rounded border border-blue-100">
              <span className="text-[10.5px] text-gray-500 block">(+) Total Recibido:</span>
              <strong className="font-mono text-emerald-700 text-sm">+{totalLitrosRecepcion.toLocaleString()} Lts</strong>
            </div>
            <div className="bg-white p-2 rounded border border-blue-100">
              <span className="text-[10.5px] text-gray-500 block">(-) Despachos:</span>
              <strong className="font-mono text-amber-700 text-sm">-{totalDespachado.toLocaleString()} Lts</strong>
            </div>
            <div className="bg-white p-2 rounded border border-blue-100">
              <span className="text-[10.5px] text-gray-500 block">(=) Teórico Esperado:</span>
              <strong className="font-mono text-blue-900 text-sm">{volumenTeoricoFinal.toLocaleString()} Lts</strong>
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

        {/* 6. FIRMAS DE RESPONSABILIDAD */}
        <div className="grid grid-cols-2 gap-12 mt-10 pt-4 text-xs">
          <div className="text-center">
            <div className="border-b border-slate-700 w-3/4 mx-auto mb-1.5 h-10" />
            <span className="font-bold text-slate-800 block">Supervisor de Turno / Receptoría</span>
            <span className="text-[10.5px] text-gray-500">Firma y Sello</span>
          </div>
          <div className="text-center">
            <div className="border-b border-slate-700 w-3/4 mx-auto mb-1.5 h-10" />
            <span className="font-bold text-slate-800 block">Operador de Silos y Tanques</span>
            <span className="text-[10.5px] text-gray-500">Firma y Cédula</span>
          </div>
        </div>
      </div>
    </div>
  );
};
