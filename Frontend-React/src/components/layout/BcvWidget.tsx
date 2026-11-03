import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { DollarSign, RefreshCw } from 'lucide-react';
import apiClient from '@/api/client';

interface BcvResponse {
  tieneTasaHoy: boolean;
  tasaDolarBs: number;
  fecha?: string;
  fuente?: string;
}

export const BcvWidget: React.FC = () => {
  const { data, isLoading, isError, refetch } = useQuery<BcvResponse>({
    queryKey: ['bcv-hoy'],
    queryFn: async () => {
      const res = await apiClient.get<BcvResponse>('/bcv/hoy');
      return res.data;
    },
    staleTime: 1000 * 60 * 10, // 10 minutos
    refetchInterval: 1000 * 60 * 15, // Refrescar cada 15 min
  });

  const tasa = data?.tasaDolarBs ?? 0;

  return (
    <div
      onClick={() => refetch()}
      title="Tasa Oficial BCV - Haz clic para actualizar"
      className="flex items-center gap-2.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200/80 border border-slate-200 rounded-xl transition cursor-pointer select-none group"
    >
      <div className="w-7 h-7 rounded-lg bg-emerald-500/15 text-emerald-600 flex items-center justify-center font-bold text-xs group-hover:scale-105 transition">
        <DollarSign size={14} className="stroke-[2.5]" />
      </div>

      <div className="flex flex-col text-left">
        <div className="flex items-center gap-1">
          <span className="text-[10px] font-extrabold text-slate-500 tracking-wider">
            TASA BCV
          </span>
          <RefreshCw
            size={10}
            className={`text-slate-400 group-hover:text-slate-600 ${isLoading ? 'animate-spin' : ''}`}
          />
        </div>
        <span className="text-xs font-black text-slate-800 tracking-tight">
          {isLoading ? (
            'Cargando...'
          ) : isError || tasa === 0 ? (
            <span className="text-amber-600">Por definir</span>
          ) : (
            `Bs. ${tasa.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`
          )}
        </span>
      </div>
    </div>
  );
};

export default BcvWidget;

