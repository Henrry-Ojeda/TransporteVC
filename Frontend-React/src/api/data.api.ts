import apiClient from './client';
import type { EntidadData, PrerequisitosResponse, ImportResult } from '@/types';

export const dataApi = {
  validarPrerequisitos: async (entidad: EntidadData): Promise<PrerequisitosResponse> => {
    const ent = String(entidad || '').trim().toUpperCase();
    try {
      if (ent === 'FINCAS' || ent === 'TB_FINCAS') {
        const [propsRes, compsRes, bancosRes] = await Promise.all([
          apiClient.get<any[]>('/propietarios').catch(() => ({ data: [] })),
          apiClient.get<any[]>('/catalogos/companias').catch(() => ({ data: [] })),
          apiClient.get<any[]>('/catalogos/bancos').catch(() => ({ data: [] })),
        ]);
        const totalPropietarios = Array.isArray(propsRes.data) ? propsRes.data.length : 0;
        const totalCompanias = Array.isArray(compsRes.data) ? compsRes.data.length : 0;
        const totalBancos = Array.isArray(bancosRes.data) ? bancosRes.data.length : 0;
        const tienePropietarios = totalPropietarios > 0;
        return {
          entidad: 'FINCAS' as EntidadData,
          requierePrevio: true,
          prerequisitos: [
            {
              nombre: 'Propietarios',
              cantidad: totalPropietarios,
              cumplido: tienePropietarios,
              mensaje: tienePropietarios
                ? `${totalPropietarios} propietarios registrados.`
                : 'No hay propietarios registrados.',
            },
            {
              nombre: 'Compañías',
              cantidad: totalCompanias,
              cumplido: totalCompanias > 0,
              mensaje: `${totalCompanias} compañías registradas.`,
            },
            {
              nombre: 'Bancos',
              cantidad: totalBancos,
              cumplido: totalBancos > 0,
              mensaje: `${totalBancos} bancos registrados.`,
            },
          ],
          listo: tienePropietarios,
        };
      }

      if (ent === 'PROPIETARIOS' || ent === 'TB_PROPIETARIOS') {
        const bancosRes = await apiClient.get<any[]>('/catalogos/bancos').catch(() => ({ data: [] }));
        const totalBancos = Array.isArray(bancosRes.data) ? bancosRes.data.length : 0;
        return {
          entidad: 'PROPIETARIOS' as EntidadData,
          requierePrevio: false,
          prerequisitos: [
            {
              nombre: 'Bancos',
              cantidad: totalBancos,
              cumplido: totalBancos > 0,
              mensaje: `${totalBancos} bancos registrados para cuentas bancarias.`,
            },
          ],
          listo: true,
        };
      }

      return {
        entidad,
        requierePrevio: false,
        prerequisitos: [],
        listo: true,
      };
    } catch {
      return {
        entidad,
        requierePrevio: false,
        prerequisitos: [],
        listo: true,
      };
    }
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
