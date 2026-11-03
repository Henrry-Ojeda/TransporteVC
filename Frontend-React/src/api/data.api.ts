import apiClient from './client';
import type { EntidadData, PrerequisitosResponse, ImportResult } from '@/types';

export const dataApi = {
  validarPrerequisitos: async (entidad: EntidadData): Promise<PrerequisitosResponse> => {
    const res = await apiClient.get<PrerequisitosResponse>(`/data/validar-prerequisitos/${entidad}`);
    return res.data;
  },

  importarFincas: async (items: any[], autoCrearPropietarios = true): Promise<ImportResult> => {
    const res = await apiClient.post<ImportResult>('/data/importar/fincas', {
      items,
      autoCrearPropietarios,
    });
    return res.data;
  },

  importarPropietarios: async (items: any[]): Promise<ImportResult> => {
    const res = await apiClient.post<ImportResult>('/data/importar/propietarios', {
      items,
    });
    return res.data;
  },

  importarCompanias: async (items: any[]): Promise<ImportResult> => {
    const res = await apiClient.post<ImportResult>('/data/importar/companias', {
      items,
    });
    return res.data;
  },

  importarBancos: async (items: any[]): Promise<ImportResult> => {
    const res = await apiClient.post<ImportResult>('/data/importar/bancos', {
      items,
    });
    return res.data;
  },

  exportarExcel: async (entidad: EntidadData): Promise<Blob> => {
    const res = await apiClient.get(`/data/exportar/${entidad}`, {
      responseType: 'blob',
    });
    return res.data;
  },

  descargarPlantilla: async (entidad: EntidadData, formato: 'xlsx' | 'csv' = 'xlsx'): Promise<Blob> => {
    const res = await apiClient.get(`/data/descargar-plantilla/${entidad}?formato=${formato}`, {
      responseType: 'blob',
    });
    return res.data;
  },
};

