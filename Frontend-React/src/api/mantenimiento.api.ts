import apiClient from './client';
import type {
  MantenimientoCamionDto,
  CrearMantenimientoCamionDto,
  AlertaPreventivaDto,
  CamionSimpleDto,
} from '@/types';

export const mantenimientoApi = {
  getMantenimientos: async (
    camionId?: number,
    tipoEvento?: string,
    estado?: string
  ): Promise<MantenimientoCamionDto[]> => {
    const params: Record<string, any> = {};
    if (camionId) params.camionId = camionId;
    if (tipoEvento) params.tipoEvento = tipoEvento;
    if (estado) params.estado = estado;
    const res = await apiClient.get<MantenimientoCamionDto[]>('/mantenimiento-camiones', { params });
    return Array.isArray(res.data) ? res.data : [];
  },

  getAlertas: async (): Promise<AlertaPreventivaDto[]> => {
    const res = await apiClient.get<AlertaPreventivaDto[]>('/mantenimiento-camiones/alertas');
    return Array.isArray(res.data) ? res.data : [];
  },

  getPorId: async (id: number): Promise<MantenimientoCamionDto> => {
    const res = await apiClient.get<MantenimientoCamionDto>(`/mantenimiento-camiones/${id}`);
    return res.data;
  },

  crear: async (dto: CrearMantenimientoCamionDto): Promise<{ id: number; message: string }> => {
    const res = await apiClient.post('/mantenimiento-camiones', dto);
    return res.data;
  },

  actualizar: async (
    id: number,
    dto: CrearMantenimientoCamionDto
  ): Promise<{ success: boolean; message: string }> => {
    const res = await apiClient.put(`/mantenimiento-camiones/${id}`, dto);
    return res.data;
  },

  eliminar: async (id: number): Promise<{ success: boolean; message: string }> => {
    const res = await apiClient.delete(`/mantenimiento-camiones/${id}`);
    return res.data;
  },

  getCamiones: async (): Promise<CamionSimpleDto[]> => {
    const res = await apiClient.get<CamionSimpleDto[]>('/camiones?soloActivos=true');
    return Array.isArray(res.data) ? res.data : [];
  },

  // INCIDENTES (CHOFER <-> TALLER)
  reportarIncidente: async (dto: {
    camionId: number;
    categoria?: string;
    titulo: string;
    descripcion: string;
    urgencia?: string;
    odometroKm?: number;
    fotoUrl?: string;
  }): Promise<{ id: number; message: string }> => {
    const res = await apiClient.post('/mantenimiento-camiones/incidentes', dto);
    return res.data;
  },

  getIncidentes: async (camionId?: number, estado?: string): Promise<MantenimientoCamionDto[]> => {
    const params: Record<string, any> = {};
    if (camionId) params.camionId = camionId;
    if (estado) params.estado = estado;
    const res = await apiClient.get<MantenimientoCamionDto[]>('/mantenimiento-camiones/incidentes', { params });
    return Array.isArray(res.data) ? res.data : [];
  },

  actualizarEstadoIncidente: async (
    id: number,
    dto: {
      estado: string;
      tallerOMecanico?: string;
      costoTotalUSD?: number;
      solucionAplicada?: string;
    }
  ): Promise<{ message: string }> => {
    const res = await apiClient.put(`/mantenimiento-camiones/incidentes/${id}/estado`, dto);
    return res.data;
  },
};

