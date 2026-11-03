import apiClient from './client';
import type { BcvRateResponse } from '@/types';

export interface BcvHistoricoDto {
  id?: number;
  fecha: string;
  tasaDolarBs?: number;
  tasa?: number;
  fuente?: string;
  observacion?: string;
  createdAt?: string;
  createdBy?: number;
}

export const bcvApi = {
  getTasaHoy: async (): Promise<BcvRateResponse> => {
    const res = await apiClient.get<BcvRateResponse>('/bcv/hoy');
    return res.data;
  },

  getHistorial: async (dias = 1000): Promise<BcvHistoricoDto[]> => {
    const res = await apiClient.get<BcvHistoricoDto[]>('/bcv/historial', { params: { dias } });
    return Array.isArray(res.data) ? res.data : [];
  },

  registrarTasa: async (dto: { fecha: string; tasa?: number; tasaDolarBs?: number }): Promise<{ success: boolean; message: string }> => {
    const payload = {
      fecha: dto.fecha,
      tasaDolarBs: dto.tasaDolarBs ?? dto.tasa ?? 0,
      tasa: dto.tasa ?? dto.tasaDolarBs ?? 0,
      fuente: 'BCV',
    };
    const res = await apiClient.post('/bcv/registrar', payload);
    return res.data;
  },
};
